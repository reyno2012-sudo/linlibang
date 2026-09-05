const test = require("node:test");
const assert = require("node:assert/strict");
const originalWarn = console.warn;
console.warn = () => {};
const ganache = require("ganache");
console.warn = originalWarn;
const ethers = require("ethers");

const { compileNeighborEscrow } = require("../../scripts/compile-contract");

async function deployEscrow(t) {
  const ganacheProvider = ganache.provider({
    logging: { quiet: true },
    wallet: { totalAccounts: 4, defaultBalance: 100 },
  });
  t.after(() => ganacheProvider.disconnect());

  const provider = new ethers.BrowserProvider(ganacheProvider);
  const requester = await provider.getSigner(0);
  const helper = await provider.getSigner(1);
  const other = await provider.getSigner(2);
  const artifact = compileNeighborEscrow();
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, requester);
  const escrow = await factory.deploy();
  await escrow.waitForDeployment();
  return { provider, escrow, requester, helper, other };
}

test("escrows funds through create, accept, complete, and release", async (t) => {
  const { provider, escrow, requester, helper } = await deployEscrow(t);
  const amount = ethers.parseEther("0.01");
  const taskId = ethers.id("NB-0001");

  await (await escrow.connect(requester).createTask(taskId, { value: amount })).wait();
  assert.equal(await provider.getBalance(await escrow.getAddress()), amount);
  await (await escrow.connect(helper).acceptTask(taskId)).wait();
  await (await escrow.connect(helper).markCompleted(taskId)).wait();
  await (await escrow.connect(requester).approveAndRelease(taskId)).wait();

  const taskState = await escrow.tasks(taskId);
  assert.equal(Number(taskState.status), 3);
  assert.equal(await provider.getBalance(await escrow.getAddress()), 0n);
  assert.equal(await escrow.completedTasks(await helper.getAddress()), 1n);
});

test("refunds only an open task to its requester", async (t) => {
  const { provider, escrow, requester, other } = await deployEscrow(t);
  const taskId = ethers.id("refund");
  await (await escrow.connect(requester).createTask(taskId, { value: ethers.parseEther("0.01") })).wait();

  await assert.rejects(escrow.connect(other).cancelTask(taskId));
  assert.equal(Number((await escrow.tasks(taskId)).status), 0);
  await (await escrow.connect(requester).cancelTask(taskId)).wait();

  assert.equal(Number((await escrow.tasks(taskId)).status), 4);
  assert.equal(await provider.getBalance(await escrow.getAddress()), 0n);
});

test("rejects requester accepting their own task", async (t) => {
  const { escrow, requester } = await deployEscrow(t);
  const taskId = ethers.id("self-accept");
  await (await escrow.connect(requester).createTask(taskId, { value: ethers.parseEther("0.01") })).wait();
  await assert.rejects(escrow.connect(requester).acceptTask(taskId));
  assert.equal(Number((await escrow.tasks(taskId)).status), 0);
});

test("rejects completion by a wallet that is not the helper", async (t) => {
  const { escrow, requester, helper, other } = await deployEscrow(t);
  const taskId = ethers.id("wrong-helper");
  await (await escrow.connect(requester).createTask(taskId, { value: ethers.parseEther("0.01") })).wait();
  await (await escrow.connect(helper).acceptTask(taskId)).wait();
  await assert.rejects(escrow.connect(other).markCompleted(taskId));
  assert.equal(Number((await escrow.tasks(taskId)).status), 1);
});

test("rejects release by a wallet that is not the requester", async (t) => {
  const { escrow, requester, helper, other } = await deployEscrow(t);
  const taskId = ethers.id("wrong-requester");
  await (await escrow.connect(requester).createTask(taskId, { value: ethers.parseEther("0.01") })).wait();
  await (await escrow.connect(helper).acceptTask(taskId)).wait();
  await (await escrow.connect(helper).markCompleted(taskId)).wait();
  await assert.rejects(escrow.connect(other).approveAndRelease(taskId));
  assert.equal(Number((await escrow.tasks(taskId)).status), 2);
});

test("rejects repeat release", async (t) => {
  const { escrow, requester, helper } = await deployEscrow(t);
  const taskId = ethers.id("repeat-release");
  await (await escrow.connect(requester).createTask(taskId, { value: ethers.parseEther("0.01") })).wait();
  await (await escrow.connect(helper).acceptTask(taskId)).wait();
  await (await escrow.connect(helper).markCompleted(taskId)).wait();
  await (await escrow.connect(requester).approveAndRelease(taskId)).wait();
  await assert.rejects(async () => (await escrow.connect(requester).approveAndRelease(taskId)).wait());
  assert.equal(Number((await escrow.tasks(taskId)).status), 3);
});

test("uses independent task hashes without a shared counter", async (t) => {
  const { escrow, requester } = await deployEscrow(t);
  const firstId = ethers.id("parallel-a");
  const secondId = ethers.id("parallel-b");

  await (await escrow.connect(requester).createTask(firstId, { value: ethers.parseEther("0.01") })).wait();
  await (await escrow.connect(requester).createTask(secondId, { value: ethers.parseEther("0.02") })).wait();

  assert.equal((await escrow.tasks(firstId)).amount, ethers.parseEther("0.01"));
  assert.equal((await escrow.tasks(secondId)).amount, ethers.parseEther("0.02"));
  assert.equal(escrow.interface.fragments.some((fragment) => fragment.name === "taskCount"), false);
});

test("freezes accepted work when either participant raises a dispute", async (t) => {
  const { escrow, requester, helper, other } = await deployEscrow(t);
  const taskId = ethers.id("disputed");
  await (await escrow.connect(requester).createTask(taskId, { value: ethers.parseEther("0.01") })).wait();
  await (await escrow.connect(helper).acceptTask(taskId)).wait();

  await assert.rejects(escrow.connect(other).raiseDispute(taskId));
  await (await escrow.connect(helper).raiseDispute(taskId)).wait();

  assert.equal(Number((await escrow.tasks(taskId)).status), 5);
  await assert.rejects(escrow.connect(requester).approveAndRelease(taskId));
});

test("rejects empty identifiers and empty escrow", async (t) => {
  const { escrow, requester } = await deployEscrow(t);
  await assert.rejects(escrow.connect(requester).createTask(ethers.ZeroHash, { value: 1n }));
  await assert.rejects(escrow.connect(requester).createTask(ethers.id("no-value")));
});
