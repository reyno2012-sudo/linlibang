const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createApp } = require("../src/app");

async function startTestServer(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "linlibang-"));
  const dataFile = path.join(dir, "data.json");
  const app = createApp({
    dataFile,
    staticRoot: path.resolve(__dirname, "../.."),
    logRequests: false,
  });

  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => app.server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const address = app.server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function jsonRequest(baseUrl, route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.json();
  return { response, body };
}

test("parses a resident errand request and ranks nearby helpers", async (t) => {
  const baseUrl = await startTestServer(t);
  const { response, body } = await jsonRequest(baseUrl, "/api/tasks/parse", {
    method: "POST",
    body: JSON.stringify({
      text: "今晚 7 点前帮我从小区门口取个快递，送到 3 栋楼下，10 元以内。",
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.task.serviceTag, "代取快递");
  assert.equal(body.task.budget, 10);
  assert.equal(body.task.location, "小区门口 / 3栋楼下");
  assert.deepEqual(body.priceAdvice.range, [8, 15]);
  assert.ok(body.matches.length >= 2);
  assert.equal(body.matches[0].name, "王启明");
  assert.equal(body.agentLog[0].tool, "parse_task");
});

test("creates an order and advances it through fulfillment states", async (t) => {
  const baseUrl = await startTestServer(t);
  const parsed = await jsonRequest(baseUrl, "/api/tasks/parse", {
    method: "POST",
    body: JSON.stringify({ text: "今天下午帮我把两箱书搬到 5 栋门口，预算 25 元。" }),
  });

  const created = await jsonRequest(baseUrl, "/api/orders", {
    method: "POST",
    body: JSON.stringify({
      task: parsed.body.task,
      candidateId: parsed.body.matches[0].id,
    }),
  });

  assert.equal(created.response.status, 201);
  assert.equal(created.body.order.id, "NB-0001");
  assert.equal(created.body.order.status, "待确认");

  const advanced = await jsonRequest(baseUrl, `/api/orders/${created.body.order.id}/advance`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
  assert.equal(advanced.body.order.status, "已接单");

  const evidenced = await jsonRequest(baseUrl, `/api/orders/${created.body.order.id}/evidence`, {
    method: "PATCH",
    body: JSON.stringify({ note: "已上传到达照片" }),
  });
  assert.equal(evidenced.body.order.status, "待验收");
  assert.deepEqual(evidenced.body.order.evidence, ["已上传到达照片"]);
});

test("borrows a shared tool by creating a tool order", async (t) => {
  const baseUrl = await startTestServer(t);
  const { response, body } = await jsonRequest(baseUrl, "/api/tools/tool-1/borrow", {
    method: "POST",
    body: JSON.stringify({ borrowerId: "u-101" }),
  });

  assert.equal(response.status, 201);
  assert.equal(body.order.source, "tool");
  assert.equal(body.order.task.serviceTag, "工具借用");
  assert.equal(body.order.price, 0);
  assert.equal(body.order.status, "已接单");
});

test("rejects empty task text with a structured validation error", async (t) => {
  const baseUrl = await startTestServer(t);
  const { response, body } = await jsonRequest(baseUrl, "/api/tasks/parse", {
    method: "POST",
    body: JSON.stringify({ text: "   " }),
  });

  assert.equal(response.status, 422);
  assert.equal(body.code, "VALIDATION_ERROR");
  assert.equal(body.details[0].field, "text");
});

test("gates child pickup orders behind high-risk credit and safety requirements", async (t) => {
  const baseUrl = await startTestServer(t);
  const { response, body } = await jsonRequest(baseUrl, "/api/tasks/parse", {
    method: "POST",
    body: JSON.stringify({
      text: "明天下午帮我到实验小学接孩子，放学后送到 3 栋单元门口，预算 30 元。",
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.task.serviceTag, "儿童接送");
  assert.equal(body.task.scenario.key, "child_pickup");
  assert.equal(body.task.riskLevel, "红色 - 最高风险");
  assert.ok(body.task.safetyPlan.requiredAuthorizations.includes("监护人电子授权书"));
  assert.ok(body.task.safetyPlan.requiredEvidence.includes("到校门口拍摄校门+孩子全身合照"));
  assert.ok(body.task.safetyPlan.forbiddenActions.includes("禁止带孩子去超市、游乐场或路边逗留"));
  assert.ok(body.matches.length >= 1);
  assert.ok(body.matches.every((match) => match.safetyEligibility.allowed));
  assert.ok(body.matches[0].trustBadges.includes("无犯罪记录已核验"));
  assert.equal(body.matches.some((match) => match.id === "u-103"), false);
});

test("safety complaints reduce credit and close high-risk permissions", async (t) => {
  const baseUrl = await startTestServer(t);
  const { response, body } = await jsonRequest(baseUrl, "/api/users/u-105/credit-events", {
    method: "POST",
    body: JSON.stringify({
      type: "safety_complaint",
      note: "儿童接送路线偏离超过 3 分钟",
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.user.credit, 80);
  assert.equal(body.user.permissions.childPickup, false);
  assert.equal(body.user.permissions.elderCare, false);
  assert.equal(body.event.delta, -18);

  const parsed = await jsonRequest(baseUrl, "/api/tasks/parse", {
    method: "POST",
    body: JSON.stringify({ text: "今天帮我接孩子放学，送到小区门口。" }),
  });
  assert.equal(parsed.body.matches.some((match) => match.id === "u-105"), false);
});
