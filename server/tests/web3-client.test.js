const test = require("node:test");
const assert = require("node:assert/strict");

const {
  addGasBuffer,
  finalityLabel,
  normalizeWalletError,
  shortAddress,
  statusLabel,
  taskDigestInput,
} = require("../../web3-client");

test("formats wallet addresses without losing their identity", () => {
  assert.equal(shortAddress("0x1234567890abcdef1234567890abcdef12345678"), "0x1234…5678");
  assert.equal(shortAddress(""), "未连接");
});

test("maps contract and Monad finality states to resident-friendly labels", () => {
  assert.equal(statusLabel(0), "等待接单");
  assert.equal(statusLabel(3), "资金已释放");
  assert.equal(statusLabel(5), "争议冻结");
  assert.equal(statusLabel(99), "未知状态");
  assert.equal(finalityLabel("submitted"), "交易已提交");
  assert.equal(finalityLabel("safe"), "已安全确认");
  assert.equal(finalityLabel("finalized"), "已最终确认");
});

test("builds a deterministic public task payload without private details", () => {
  assert.deepEqual(
    taskDigestInput({
      title: "代取快递",
      time: "今晚 7 点",
      place: "3 栋楼下",
      budget: 10,
      desc: "手机号 13800000000，送到 3 栋 101",
      phone: "13800000000",
    }),
    { title: "代取快递", time: "今晚 7 点", place: "3 栋楼下", budget: 10 },
  );
});

test("caps the Monad gas buffer at ten percent", () => {
  assert.equal(addGasBuffer(100_000n), 110_000n);
  assert.equal(addGasBuffer(21_001n), 23_101n);
});

test("normalizes common wallet failures without exposing provider internals", () => {
  assert.equal(normalizeWalletError({ code: 4001 }), "你取消了钱包签名，任务草稿已保留。");
  assert.equal(normalizeWalletError({ message: "insufficient funds for gas" }), "测试币余额不足，请先领取 Test MON。");
  assert.equal(normalizeWalletError({ code: 4902 }), "钱包中还没有 Monad Testnet，请先添加网络。");
  assert.equal(normalizeWalletError(new Error("opaque rpc failure")), "链上操作暂时失败，请稍后重试。");
});
