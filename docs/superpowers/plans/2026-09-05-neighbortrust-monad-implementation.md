# NeighborTrust Monad MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real Monad escrow flow to the existing 邻里帮 mobile app so a resident can create, accept, complete, and release a Test MON-backed neighborhood task while preserving private task details off-chain.

**Architecture:** Keep the existing vanilla browser UI and Node HTTP server. Add one Solidity escrow contract, compile/deploy scripts using `solc` and `ethers`, an isolated browser Web3 adapter, a backend endpoint for chain receipt metadata, and focused UI additions that render chain state as the source of truth.

**Tech Stack:** Solidity 0.8.30, ethers 6, solc-js, Ganache, Node.js 24 `node:test`, existing vanilla HTML/CSS/JavaScript and native Node HTTP server.

---

## File map

- Create `contracts/NeighborEscrow.sol`: escrow state machine, access control, transfers, events, and completed-task counters.
- Create `contracts/test/neighbor-escrow.test.js`: in-memory EVM tests against Ganache.
- Create `scripts/compile-contract.js`: compile Solidity and write the browser/deployment artifact.
- Create `scripts/deploy-contract.js`: deploy the compiled artifact to the configured Monad RPC.
- Create `contracts/artifacts/NeighborEscrow.json`: generated ABI and bytecode consumed by deployment and browser code.
- Create `web3-config.js`: Monad chain metadata and deployed contract address.
- Create `web3-client.js`: wallet/network/contract adapter with pure formatting helpers.
- Create `server/tests/web3-client.test.js`: unit tests for deterministic hashing, status mapping, address formatting, and errors.
- Modify `server/src/neighborhood/service.js`: attach validated chain metadata to an existing business order.
- Modify `server/src/app.js`: expose `PATCH /api/orders/:id/chain`.
- Modify `server/tests/neighborhood.test.js`: cover chain metadata persistence and validation.
- Modify `mobile.html`: load ethers, Web3 config, and the Web3 adapter before `mobile.js`.
- Modify `mobile.js`: wallet state, publish flow, on-chain actions, transaction feedback, order cards, and profile count.
- Modify `mobile-components.css`: wallet chip, escrow panel, transaction steps, badges, and chain action states.
- Modify `server/tests/mobile-editable-task.test.js`: verify the Web3 UI wiring remains present.
- Modify `package.json`: contract scripts and exact dependencies.
- Modify `.env.example`: deployer RPC and private-key variable documentation without secrets.
- Modify `README.md`: local contract tests, Monad deployment, configuration, and three-minute demo steps.

### Task 1: Contract toolchain and compilation

**Files:**
- Modify: `package.json`
- Create: `scripts/compile-contract.js`
- Modify: `.gitignore`

- [ ] **Step 1: Add a failing compile smoke test command**

Add scripts and exact dependencies to `package.json`:

```json
{
  "scripts": {
    "start": "node server/index.js",
    "test": "node server/tests/neighborhood.test.js && node server/tests/mobile-editable-task.test.js",
    "contract:compile": "node scripts/compile-contract.js",
    "contract:test": "node contracts/test/neighbor-escrow.test.js",
    "contract:deploy": "node scripts/deploy-contract.js"
  },
  "dependencies": {
    "ethers": "6.15.0",
    "ganache": "7.9.2",
    "solc": "0.8.30"
  }
}
```

- [ ] **Step 2: Install dependencies and confirm compilation fails before the source exists**

Run: `npm install`

Run: `npm run contract:compile`

Expected: FAIL with a clear `ENOENT` for `contracts/NeighborEscrow.sol`.

- [ ] **Step 3: Add the deterministic compiler**

Create `scripts/compile-contract.js` exporting `compileNeighborEscrow` and, when run directly, writing `contracts/artifacts/NeighborEscrow.json`. The compiler input must enable the optimizer for 200 runs and request `abi`, `evm.bytecode.object`, and `evm.deployedBytecode.object`. Treat every Solidity diagnostic with severity `error` as fatal. Write this artifact shape:

```js
{
  contractName: "NeighborEscrow",
  compilerVersion: solc.version(),
  abi: contract.abi,
  bytecode: `0x${contract.evm.bytecode.object}`,
  deployedBytecode: `0x${contract.evm.deployedBytecode.object}`
}
```

Add `contracts/artifacts/*.json` to `.gitignore`, followed by `!contracts/artifacts/NeighborEscrow.json`, so only the required browser artifact is versioned.

- [ ] **Step 4: Run the existing suite**

Run: `npm test`

Expected: the unchanged backend and mobile suites PASS.

- [ ] **Step 5: Commit the toolchain**

```powershell
git add package.json package-lock.json .gitignore scripts/compile-contract.js
git commit -m "build: add Solidity contract toolchain"
```

### Task 2: Escrow contract with EVM lifecycle tests

**Files:**
- Create: `contracts/NeighborEscrow.sol`
- Create: `contracts/test/neighbor-escrow.test.js`
- Create: `contracts/artifacts/NeighborEscrow.json`
- Modify: `package.json`

- [ ] **Step 1: Write failing lifecycle and permission tests**

Use `node:test`, `ganache.provider({ logging: { quiet: true } })`, `ethers.BrowserProvider`, and `ethers.ContractFactory`. Compile through `compileNeighborEscrow()`. Cover these exact behaviors:

```js
test("escrows funds through create, accept, complete, and release", async () => {
  const amount = ethers.parseEther("0.01");
  const created = await escrow.connect(requester).createTask(ethers.id("NB-0001"), { value: amount });
  await created.wait();
  await (await escrow.connect(helper).acceptTask(1)).wait();
  await (await escrow.connect(helper).markCompleted(1)).wait();
  await (await escrow.connect(requester).approveAndRelease(1)).wait();
  const task = await escrow.tasks(1);
  assert.equal(Number(task.status), 3);
  assert.equal(await escrow.completedTasks(helper.address), 1n);
});

test("refunds only an open task to its requester", async () => {
  await (await escrow.connect(requester).createTask(ethers.id("refund"), { value: ethers.parseEther("0.01") })).wait();
  await assert.rejects(escrow.connect(other).cancelTask(1));
  await (await escrow.connect(requester).cancelTask(1)).wait();
  assert.equal(Number((await escrow.tasks(1)).status), 4);
});

test("rejects self acceptance, wrong roles, invalid transitions, and repeat release", async () => {
  await (await escrow.connect(requester).createTask(ethers.id("roles"), { value: ethers.parseEther("0.01") })).wait();
  await assert.rejects(escrow.connect(requester).acceptTask(1));
  await (await escrow.connect(helper).acceptTask(1)).wait();
  await assert.rejects(escrow.connect(other).markCompleted(1));
  await (await escrow.connect(helper).markCompleted(1)).wait();
  await assert.rejects(escrow.connect(other).approveAndRelease(1));
  await (await escrow.connect(requester).approveAndRelease(1)).wait();
  await assert.rejects(escrow.connect(requester).approveAndRelease(1));
});
```

- [ ] **Step 2: Run the contract tests and verify failure**

Run: `npm run contract:test`

Expected: FAIL because `NeighborEscrow.sol` does not exist or lacks the required API.

- [ ] **Step 3: Implement the minimal contract**

Create `contracts/NeighborEscrow.sol` with:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract NeighborEscrow {
    enum Status { Open, Accepted, Completed, Released, Cancelled, Disputed }

    struct Task {
        bytes32 taskHash;
        address payable requester;
        address payable helper;
        uint256 amount;
        Status status;
        uint64 createdAt;
        uint64 completedAt;
    }

    uint256 public taskCount;
    mapping(uint256 => Task) public tasks;
    mapping(address => uint256) public completedTasks;
    bool private locked;

    event TaskCreated(uint256 indexed taskId, bytes32 indexed taskHash, address indexed requester, uint256 amount);
    event TaskAccepted(uint256 indexed taskId, address indexed helper);
    event TaskCompleted(uint256 indexed taskId, address indexed helper);
    event FundsReleased(uint256 indexed taskId, address indexed helper, uint256 amount);
    event TaskCancelled(uint256 indexed taskId);
    event TaskDisputed(uint256 indexed taskId, address indexed raisedBy);

    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    function createTask(bytes32 taskHash) external payable returns (uint256 taskId) {
        require(taskHash != bytes32(0), "Empty task hash");
        require(msg.value > 0, "Escrow required");
        taskId = ++taskCount;
        tasks[taskId] = Task(taskHash, payable(msg.sender), payable(address(0)), msg.value, Status.Open, uint64(block.timestamp), 0);
        emit TaskCreated(taskId, taskHash, msg.sender, msg.value);
    }

    function acceptTask(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(task.status == Status.Open, "Task not open");
        require(msg.sender != task.requester, "Requester cannot accept");
        task.helper = payable(msg.sender);
        task.status = Status.Accepted;
        emit TaskAccepted(taskId, msg.sender);
    }

    function markCompleted(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(task.status == Status.Accepted, "Task not accepted");
        require(msg.sender == task.helper, "Only helper");
        task.status = Status.Completed;
        task.completedAt = uint64(block.timestamp);
        emit TaskCompleted(taskId, msg.sender);
    }

    function approveAndRelease(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];
        require(task.status == Status.Completed, "Task not completed");
        require(msg.sender == task.requester, "Only requester");
        task.status = Status.Released;
        completedTasks[task.helper] += 1;
        (bool sent, ) = task.helper.call{value: task.amount}("");
        require(sent, "Release failed");
        emit FundsReleased(taskId, task.helper, task.amount);
    }

    function cancelTask(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];
        require(task.status == Status.Open, "Task not open");
        require(msg.sender == task.requester, "Only requester");
        task.status = Status.Cancelled;
        (bool sent, ) = task.requester.call{value: task.amount}("");
        require(sent, "Refund failed");
        emit TaskCancelled(taskId);
    }

    function raiseDispute(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(task.status == Status.Accepted || task.status == Status.Completed, "Cannot dispute");
        require(msg.sender == task.requester || msg.sender == task.helper, "Not a participant");
        task.status = Status.Disputed;
        emit TaskDisputed(taskId, msg.sender);
    }
}
```

- [ ] **Step 4: Compile and run contract tests**

Append `&& node contracts/test/neighbor-escrow.test.js` to the `test` script in `package.json` before running the checks.

Run: `npm run contract:compile`

Expected: `Compiled NeighborEscrow with solc 0.8.30...` and artifact created.

Run: `npm run contract:test`

Expected: all lifecycle, refund, role, and repeat-release tests PASS.

- [ ] **Step 5: Commit the contract**

```powershell
git add contracts/NeighborEscrow.sol contracts/test/neighbor-escrow.test.js contracts/artifacts/NeighborEscrow.json package.json
git commit -m "feat: add neighborhood escrow contract"
```

### Task 3: Browser Web3 adapter and deployment script

**Files:**
- Create: `web3-config.js`
- Create: `web3-client.js`
- Create: `server/tests/web3-client.test.js`
- Create: `scripts/deploy-contract.js`
- Modify: `.env.example`
- Modify: `package.json`

- [ ] **Step 1: Write failing pure adapter tests**

Test exported functions with these assertions:

```js
assert.equal(shortAddress("0x1234567890abcdef1234567890abcdef12345678"), "0x1234…5678");
assert.equal(statusLabel(0), "等待接单");
assert.equal(statusLabel(3), "资金已释放");
assert.equal(statusLabel(5), "争议冻结");
assert.deepEqual(taskDigestInput({ title: "代取快递", time: "今晚 7 点", place: "3 栋楼下", budget: 10 }), {
  title: "代取快递",
  time: "今晚 7 点",
  place: "3 栋楼下",
  budget: 10,
});
assert.equal(normalizeWalletError({ code: 4001 }), "你取消了钱包签名，任务草稿已保留。");
```

- [ ] **Step 2: Run and confirm failure**

Run: `node server/tests/web3-client.test.js`

Expected: FAIL because `web3-client.js` does not exist.

- [ ] **Step 3: Implement the adapter**

Use a UMD-style wrapper so Node tests receive `module.exports` and browsers receive `window.NeighborWeb3`. Export `shortAddress`, `statusLabel`, `taskDigestInput`, `normalizeWalletError`, and `createClient`. `createClient({ ethereum, ethers, config, artifact })` must expose:

```js
connect()
switchNetwork()
createTask(task, amount = "0.01")
acceptTask(taskId)
markCompleted(taskId)
approveAndRelease(taskId)
cancelTask(taskId)
raiseDispute(taskId)
readTask(taskId)
completedCount(address)
transactionUrl(hash)
```

`createTask` must compute `ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(taskDigestInput(task))))`, submit the payable call, wait for the receipt, parse `TaskCreated`, and return `{ taskId, hash, receipt }`. All write methods return only after `tx.wait()`.

- [ ] **Step 4: Add chain configuration and deployment**

Set `web3-config.js` to chain ID `0x279f`/10143, chain name `Monad Testnet`, native symbol `MON`, RPC `https://testnet-rpc.monad.xyz`, explorer `https://testnet.monadexplorer.com`, artifact URL `/contracts/artifacts/NeighborEscrow.json`, and an initially empty contract address.

Create `scripts/deploy-contract.js` that reads `MONAD_RPC_URL`, `MONAD_DEPLOYER_PRIVATE_KEY`, and the compiled artifact; verifies network chain ID 10143; deploys with `ethers.JsonRpcProvider`, `ethers.Wallet`, and `ethers.ContractFactory`; prints the address and transaction hash; and never logs the private key. Add these names to `.env.example` with empty values.

- [ ] **Step 5: Run unit tests**

Insert `node server/tests/web3-client.test.js` in the `test` script before the contract test, preserving all existing suites.

Run: `node server/tests/web3-client.test.js`

Expected: all adapter helper tests PASS.

- [ ] **Step 6: Commit adapter and deployment support**

```powershell
git add web3-config.js web3-client.js server/tests/web3-client.test.js scripts/deploy-contract.js .env.example package.json
git commit -m "feat: add Monad wallet adapter and deploy script"
```

### Task 4: Persist chain metadata on business orders

**Files:**
- Modify: `server/src/neighborhood/service.js`
- Modify: `server/src/app.js`
- Modify: `server/tests/neighborhood.test.js`

- [ ] **Step 1: Write the failing API test**

Create an order through the existing API, then call:

```js
const linked = await jsonRequest(baseUrl, `/api/orders/${created.body.order.id}/chain`, {
  method: "PATCH",
  body: JSON.stringify({
    network: "monad-testnet",
    chainId: 10143,
    contractAddress: "0x1111111111111111111111111111111111111111",
    taskId: "7",
    transactionHash: `0x${"a".repeat(64)}`,
    taskHash: `0x${"b".repeat(64)}`,
    status: "Open",
  }),
});
assert.equal(linked.response.status, 200);
assert.equal(linked.body.order.chain.taskId, "7");
assert.equal(linked.body.order.chain.chainId, 10143);
```

Add a second request with malformed addresses/hashes and assert status 422 with `VALIDATION_ERROR`.

- [ ] **Step 2: Run the server test and confirm failure**

Run: `node server/tests/neighborhood.test.js`

Expected: FAIL because `/chain` returns 404.

- [ ] **Step 3: Implement chain metadata validation and routing**

Add `attachChainMetadata(store, id, input)` to `service.js`. Require chain ID 10143, `/^0x[a-fA-F0-9]{40}$/` for the contract, `/^0x[a-fA-F0-9]{64}$/` for transaction/task hashes, a positive decimal task ID, and one of `Open`, `Accepted`, `Completed`, `Released`, `Cancelled`, or `Disputed`. Store only these fields plus `linkedAt`.

Add `chain` to the existing order only after validation. Export the function. In `app.js`, extend the order route to match `chain` and call it for `PATCH /api/orders/:id/chain`.

- [ ] **Step 4: Run backend tests**

Run: `node server/tests/neighborhood.test.js`

Expected: all existing tests and the two new chain metadata tests PASS.

- [ ] **Step 5: Commit backend linking**

```powershell
git add server/src/neighborhood/service.js server/src/app.js server/tests/neighborhood.test.js
git commit -m "feat: persist chain receipts on orders"
```

### Task 5: Wallet and escrow UI

**Files:**
- Modify: `mobile.html`
- Modify: `mobile.js`
- Modify: `mobile-components.css`
- Modify: `server/tests/mobile-editable-task.test.js`

- [ ] **Step 1: Add failing UI wiring assertions**

Assert that `mobile.html` loads `/node_modules/ethers/dist/ethers.umd.min.js`, `web3-config.js`, and `web3-client.js` before `mobile.js`. Assert that `mobile.js` contains `connectWallet`, `publishTaskOnChain`, `runChainAction`, `WalletButton`, `EscrowPanel`, and action values `chain-accept`, `chain-complete`, `chain-release`, and `chain-cancel`. Assert CSS includes `.wallet-button`, `.escrow-panel`, `.chain-progress`, `.chain-badge`, and `.chain-action-row`.

- [ ] **Step 2: Run the mobile test and confirm failure**

Run: `node server/tests/mobile-editable-task.test.js`

Expected: FAIL on missing Web3 UI markers.

- [ ] **Step 3: Add browser dependencies and wallet state**

Load the three scripts before `mobile.js`. In `mobile.js`, add one `web3State` object containing `client`, `account`, `balance`, `phase`, `message`, and `error`; initialize the adapter lazily after fetching the artifact; listen to `accountsChanged` and `chainChanged`; and render a wallet button in `HomeHeader`.

Wallet phases must be exactly `idle`, `connecting`, `ready`, `signing`, `confirming`, `success`, and `error`. Reject duplicate submissions while signing or confirming.

- [ ] **Step 4: Add the AI escrow panel and publish flow**

Extend `renderAgentResult()` with an `EscrowPanel(lastTask)` that visibly separates `${lastTask.budget} 元` from `0.01 Test MON`, states that only a hash is public, and uses `data-action="publish-on-chain"`. `publishTaskOnChain()` must:

1. Connect or switch network if required.
2. Set `phase` to `signing` and preserve `lastTask`.
3. Call `client.createTask(lastTask, "0.01")`.
4. Add a local order containing `chain.taskId`, `chain.hash`, and `chain.status`.
5. Set `phase` to `success`, render the order, and expose an explorer link.
6. Convert wallet rejection, insufficient funds, wrong network, and generic failures through `normalizeWalletError`.

- [ ] **Step 5: Render contract-driven order actions**

For chain-linked orders, render the status returned by `readTask` and show only actions legal for the connected wallet and current status. Wire buttons to `runChainAction(orderId, action)`, wait for confirmation, reread the task, and update the local order. Use these mappings:

```js
{
  "chain-accept": "acceptTask",
  "chain-complete": "markCompleted",
  "chain-release": "approveAndRelease",
  "chain-cancel": "cancelTask",
  "chain-dispute": "raiseDispute"
}
```

Escape all task strings and chain identifiers before interpolating into HTML. Explorer links must include `target="_blank" rel="noreferrer"`.

- [ ] **Step 6: Add restrained Web3 styling**

Style Web3 controls within the existing warm community visual language: purple is limited to chain badges and progress indicators, wallet/account text remains compact, pending buttons display disabled state, and transaction hashes wrap without widening the phone layout. Add visible focus styles and do not remove existing mobile breakpoints.

- [ ] **Step 7: Run mobile and full tests**

Run: `node server/tests/mobile-editable-task.test.js`

Expected: all UI source assertions PASS.

Run: `npm test`

Expected: backend, mobile, adapter, and contract tests PASS.

- [ ] **Step 8: Commit the UI integration**

```powershell
git add mobile.html mobile.js mobile-components.css server/tests/mobile-editable-task.test.js
git commit -m "feat: add Monad escrow flow to mobile app"
```

### Task 6: Deployment configuration and live testnet verification

**Files:**
- Modify: `web3-config.js`
- Modify: `README.md`

- [ ] **Step 1: Verify a funded deployment wallet without exposing secrets**

Set `MONAD_DEPLOYER_PRIVATE_KEY` only in the current shell environment and never in a file. Set `MONAD_RPC_URL` to the workshop-confirmed Monad testnet RPC. Run a balance check that prints only the derived public address and MON balance.

Expected: chain ID is 10143 and the deployer has enough Test MON for deployment.

- [ ] **Step 2: Deploy the contract**

Run: `npm run contract:compile`

Run: `npm run contract:deploy`

Expected: output contains `NeighborEscrow deployed`, a `0x` contract address, and a deployment transaction hash.

- [ ] **Step 3: Configure the deployed address**

Set `contractAddress` in `web3-config.js` to the exact deployed address. Do not add a private key, mnemonic, or API token.

- [ ] **Step 4: Verify two-wallet lifecycle on Monad**

Start the app with `npm start`. Using two funded test accounts, create a 0.01 Test MON order, accept it, mark it complete, release funds, refresh the page, and confirm the final status and completed count still load from the contract.

Expected: every write has a successful explorer transaction; the contract balance returns to zero after release; the helper completed count increases by one.

- [ ] **Step 5: Document repeatable setup and demo**

Add README commands for install, compile, test, deploy, wallet network setup, contract-address configuration, and the exact three-minute demo sequence. Include warnings that Test MON has no guaranteed fiat value and that no private data is stored on-chain.

- [ ] **Step 6: Commit deployment configuration and docs**

```powershell
git add web3-config.js README.md
git commit -m "docs: add Monad deployment and demo guide"
```

### Task 7: Final regression and demo readiness

**Files:**
- Verify all changed files

- [ ] **Step 1: Run all automated checks**

Run: `npm test`

Expected: every Node, frontend source, adapter, and Ganache contract test PASS.

Run: `git diff --check HEAD~4..HEAD`

Expected: no whitespace errors.

- [ ] **Step 2: Verify server health and assets**

Run `npm start`, then request `/health`, `/mobile.html`, `/web3-config.js`, `/web3-client.js`, `/contracts/artifacts/NeighborEscrow.json`, and `/node_modules/ethers/dist/ethers.umd.min.js`.

Expected: every request returns HTTP 200 and the JSON artifact contains non-empty ABI and bytecode.

- [ ] **Step 3: Perform the three-minute demo rehearsal**

Rehearse: AI parses “今晚 7 点帮我从小区门口取快递，送到 3 栋楼下，预算 10 元” → requester publishes with 0.01 Test MON → helper accepts and completes → requester releases → explorer opens → profile count increases.

Expected: no console errors, no private address text appears on-chain, and the narrative distinguishes AI analysis, contract trust, and Monad execution.

- [ ] **Step 4: Prepare degraded-network evidence**

Record the deployed contract address, one completed task ID, and its four transaction URLs in the README demo section so judges can independently verify the chain history if venue networking is slow.

- [ ] **Step 5: Commit any verification-only corrections**

If verification required corrections, stage only the corrected project files and commit:

```powershell
git commit -m "fix: harden Monad demo flow"
```

If no corrections were needed, do not create an empty commit.
