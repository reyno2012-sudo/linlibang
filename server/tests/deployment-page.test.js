const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

test("deployment page uses an injected wallet and verifies deployed bytecode", () => {
  const html = fs.readFileSync(path.join(root, "deploy-contract.html"), "utf8");
  const js = fs.readFileSync(path.join(root, "deploy-contract.js"), "utf8");
  const config = fs.readFileSync(path.join(root, "web3-config.js"), "utf8");

  assert.match(html, /部署 NeighborEscrow/);
  assert.match(html, /ethers\.umd\.min\.js[\s\S]*web3-config\.js[\s\S]*deploy-contract\.js/);
  assert.match(js, /eth_requestAccounts/);
  assert.match(js, /ContractFactory/);
  assert.match(js, /getCode/);
  assert.match(js, /neighbortrust_contract_address/);
  assert.match(config, /neighbortrust_contract_address/);
  assert.match(config, /0x999531e68550e708F5D460b581C18A737FEE2D1c/);
  assert.doesNotMatch(`${html}\n${js}\n${config}`, /PRIVATE_KEY|privateKey|mnemonic/);
});
