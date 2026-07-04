const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

test("agent task fields are rendered as editable controls", () => {
  const mobileJs = fs.readFileSync(path.join(root, "mobile.js"), "utf8");
  const mobileCss = fs.readFileSync(path.join(root, "mobile-components.css"), "utf8");

  assert.match(mobileJs, /data-edit-task-field="\$\{field\}"/);
  assert.match(mobileJs, /TaskInfoButton\("time"/);
  assert.match(mobileJs, /TaskInfoButton\("place"/);
  assert.match(mobileJs, /TaskInfoButton\("budget"/);
  assert.match(mobileJs, /function editTaskField/);
  assert.match(mobileJs, /button\.dataset\.editTaskField/);
  assert.match(mobileCss, /\.info-edit-button/);
});

test("mobile task card exposes credit and safety risk controls", () => {
  const mobileJs = fs.readFileSync(path.join(root, "mobile.js"), "utf8");
  const mobileCss = fs.readFileSync(path.join(root, "mobile-components.css"), "utf8");

  assert.match(mobileJs, /function detectRiskScenario/);
  assert.match(mobileJs, /function SafetyPlanPanel/);
  assert.match(mobileJs, /信用准入/);
  assert.match(mobileJs, /儿童接送/);
  assert.match(mobileJs, /GPS 轨迹/);
  assert.match(mobileCss, /\.safety-plan/);
  assert.match(mobileCss, /\.credit-status-grid/);
});
