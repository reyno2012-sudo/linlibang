const data = window.NB_MOCK;
const orders = [];
const profileStorageKey = "neighborhood_profile";

let activeScreen = "home";
let lastTask = null;
let profileState = loadProfile();

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const riskPolicies = {
  child_pickup: {
    title: "儿童接送",
    risk: "红色最高风险",
    minCredit: 95,
    evidence: ["监护人电子授权", "校门+孩子全身合照", "送达单元门拍照", "GPS 轨迹留存"],
    forbidden: ["禁止绕行逗留", "禁止进入接单者家中", "禁止给孩子零食饮料"],
    money: "平台托管资金 + 当日责任险",
  },
  elder_care: {
    title: "老人陪护",
    risk: "红色高风险",
    minCredit: 92,
    evidence: ["家属紧急联系人", "进门/离开拍照", "APP 录音留存", "白天 9:00-18:00"],
    forbidden: ["认知不清需家属陪同", "禁止夜间独居陪护", "禁止处理无关财物"],
    money: "平台托管资金 + 争议冻结佣金",
  },
  pet_care: {
    title: "遛宠照看",
    risk: "黄色中风险",
    minCredit: 85,
    evidence: ["宠物牵引规则", "出门/返还拍照", "GPS 轨迹留存", "宠物伤人责任协议"],
    forbidden: ["禁止解开牵引绳", "禁止长时间带离小区", "禁止转交第三人"],
    money: "平台托管资金 + 责任提前划分",
  },
  home_repair: {
    title: "上门维修",
    risk: "黄色中风险",
    minCredit: 90,
    evidence: ["维修范围确认", "进门/离开拍照", "维修前后照片", "物业备案优先"],
    forbidden: ["禁止扩大维修范围", "禁止触碰无关财物", "禁止夜间单独上门"],
    money: "平台托管资金 + 材料费单独确认",
  },
  low_risk: {
    title: "邻里互助",
    risk: "绿色低风险",
    minCredit: 80,
    evidence: ["实名接单", "小区居住核验", "完成拍照"],
    forbidden: ["禁止线下私收费用", "禁止私拆包裹"],
    money: "平台托管资金",
  },
};

function icon(name) {
  const icons = {
    bell: '<svg viewBox="0 0 24 24"><path d="M18 9.5a6 6 0 0 0-12 0c0 7-2.2 7.5-2.2 7.5h16.4S18 16.5 18 9.5Z"/><path d="M10 20a2.4 2.4 0 0 0 4 0"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></svg>',
    chevron: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
  };
  return icons[name] || "";
}

function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(profileStorageKey) || "{}");
    return {
      name: saved.name || data.user.name,
      avatar: saved.avatar || "",
    };
  } catch {
    return { name: data.user.name, avatar: "" };
  }
}

function saveProfileState(nextProfile) {
  profileState = {
    name: nextProfile.name?.trim() || data.user.name,
    avatar: nextProfile.avatar || profileState.avatar,
  };
  localStorage.setItem(profileStorageKey, JSON.stringify(profileState));
}

function AvatarContent(className = "") {
  if (profileState.avatar) {
    return `<img class="${className}" src="${profileState.avatar}" alt="${profileState.name}的头像" />`;
  }
  return `<span>${profileState.name.slice(0, 1)}</span>`;
}

function HomeHeader() {
  return `
    <header class="home-header">
      <button class="profile-chip" type="button" data-action="edit-profile" aria-label="编辑头像和昵称">
        <div class="user-avatar">${AvatarContent("avatar-image")}</div>
        <div>
          <p>${profileState.name} 👋</p>
          <strong>欢迎回家</strong>
        </div>
      </button>
      <div class="top-actions" aria-label="快捷操作">
        <button type="button" class="icon-button has-dot" data-action="notify" aria-label="通知">${icon("bell")}</button>
        <button type="button" class="icon-button" data-action="search" aria-label="搜索">${icon("search")}</button>
      </div>
    </header>
  `;
}

function HeroSection() {
  return `
    <section class="hero-section">
      <div class="hero-copy">
        <h1>远亲不如近邻，<br />省心省力邻里帮。</h1>
        <span class="short-line" aria-hidden="true"></span>
      </div>
      <div class="hero-illustration" aria-label="原创社区生活插画">
        <div class="sky-note">今天的风，很舒服 ☁️</div>
        <div class="balcony-rail"></div>
        <div class="window-glow"></div>
        <div class="notice-board">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div class="plant plant-left"></div>
        <div class="plant plant-right"></div>
        <div class="mail-stack">
          <i></i>
          <i></i>
          <i></i>
        </div>
        <div class="coffee-cup"></div>
        <div class="ground-shadow"></div>
      </div>
    </section>
  `;
}

function QuickActionCard(item) {
  return `
    <button class="quick-card quick-${item.tone}" data-quick-id="${item.id}" type="button">
      <span class="quick-title">${item.title}</span>
      <small>${item.subtitle}</small>
      <span class="quick-art art-${item.art}" aria-hidden="true"></span>
      <span class="quick-arrow" aria-hidden="true">${icon("chevron")}</span>
    </button>
  `;
}

function NearbyPostCard(post) {
  const visual = post.visual ? `<div class="post-visual visual-${post.visual}" aria-hidden="true"></div>` : `<div class="post-status">${post.meta}</div>`;
  return `
    <article class="nearby-card">
      <div class="mini-profile">
        <span class="mini-avatar avatar-${post.avatar}" aria-hidden="true"></span>
        <div>
          <strong>${post.name}</strong>
          <small>${post.time}</small>
        </div>
      </div>
      <p>${post.text}</p>
      ${visual}
      <div class="post-foot">
        <span>${post.tag}</span>
        <span>${post.meta}</span>
      </div>
    </article>
  `;
}

function NearbySection() {
  return `
    <section class="nearby-section">
      <div class="section-head">
        <h2>附近的人 · 正在发生</h2>
        <button type="button" data-action="see-more">查看更多 ${icon("chevron")}</button>
      </div>
      <div class="nearby-scroll">
        ${data.nearbyPosts.map(NearbyPostCard).join("")}
      </div>
    </section>
  `;
}

function renderHome() {
  $("#screen-home").innerHTML = `
    ${HomeHeader()}
    ${HeroSection()}
    <section class="quick-grid" aria-label="快捷功能入口">
      ${data.quickActions.map(QuickActionCard).join("")}
    </section>
    <section class="agent-result" id="agentResult"></section>
    ${NearbySection()}
  `;
}

function renderDiscover() {
  $("#screen-discover").innerHTML = `
    <header class="simple-header">
      <div>
        <p>附近发现</p>
        <h1>今天社区里有什么</h1>
      </div>
      <button type="button" data-action="open-search">搜索</button>
    </header>
    <section class="discover-list">
      ${data.discoverCards
        .map(
          (item) => `
            <article class="discover-card">
              <div>
                <h2>${item.title}</h2>
                <p>${item.text}</p>
              </div>
              <span>${item.count}</span>
            </article>
          `
        )
        .join("")}
    </section>
    <section class="tool-bank">
      <div class="section-head">
        <h2>互助小站</h2>
        <button type="button" data-action="borrow-first">借小推车 ${icon("chevron")}</button>
      </div>
      <div class="tool-list">
        ${data.tools.map(ToolItem).join("")}
      </div>
    </section>
  `;
}

function ToolItem(tool) {
  return `
    <article class="tool-item">
      <div class="tool-symbol tool-${tool.icon}" aria-hidden="true"></div>
      <div>
        <h3>${tool.name}</h3>
        <p>${tool.owner} · ${tool.place} · ${tool.time}</p>
        <span>${tool.rule}</span>
      </div>
      <button type="button" class="small-action" data-borrow-id="${tool.id}">申请</button>
    </article>
  `;
}

function renderMessages() {
  const content = orders.length
    ? orders
        .map(
          (order) => `
            <article class="message-card">
              <div>
                <p>${order.id}</p>
                <h2>${order.title}</h2>
                <span>${order.desc}</span>
              </div>
              <button type="button" class="small-action" data-next-order="${order.id}">${order.status}</button>
            </article>
          `
        )
        .join("")
    : `<div class="empty-box">还没有新的消息。发布一个需求后，候选邻居和工单提醒会出现在这里。</div>`;

  $("#screen-messages").innerHTML = `
    <header class="simple-header">
      <div>
        <p>消息与工单</p>
        <h1>邻里往来有回应</h1>
      </div>
      <button type="button" data-action="simulate-order">模拟提醒</button>
    </header>
    <section class="message-list">${content}</section>
  `;
}

function renderProfile() {
  $("#screen-profile").innerHTML = `
    <header class="simple-header">
      <div>
        <p>我的邻里帮</p>
        <h1>${data.user.community} · ${profileState.name}</h1>
      </div>
    </header>
    <section class="profile-card">
      <div class="profile-score">${data.user.credit}</div>
      <div>
        <h2>同小区认证已通过</h2>
        <p>实名、楼栋、手机号均已完成。可发布低风险互助任务，也可以申请借用公共工具。</p>
      </div>
    </section>
    <section class="credit-status-grid" aria-label="信用与安全权限">
      <div><span>信用等级</span><strong>A</strong><small>高信用优先匹配</small></div>
      <div><span>熟人背书</span><strong>6 人</strong><small>同小区注册用户认证</small></div>
      <div><span>低风险互助</span><strong>已开放</strong><small>跑腿、工具、遛宠</small></div>
      <div><span>高风险服务</span><strong>待补充</strong><small>需无犯罪记录/押金/专项协议</small></div>
    </section>
    <section class="profile-list">
      <div><span>完成互助</span><strong>23</strong></div>
      <div><span>准时履约</span><strong>98%</strong></div>
      <div><span>近 30 天投诉</span><strong>0</strong></div>
    </section>
  `;
}

function detectRiskScenario(raw) {
  if (/接孩子|接娃|放学|学校|校门|班级|儿童|未成年/.test(raw)) return "child_pickup";
  if (/老人|独居|陪护|搀扶|看护|认知|阿尔茨海默/.test(raw)) return "elder_care";
  if (/遛狗|遛猫|遛宠|宠物|猫|狗/.test(raw)) return "pet_care";
  if (/上门维修|维修|电路|水管|家电|打孔|换灯/.test(raw)) return "home_repair";
  return "low_risk";
}

function parseTask(text) {
  const raw = text.trim();
  const isTool = /借|小推车|梯|工具|电钻/.test(raw);
  const riskKey = detectRiskScenario(raw);
  const riskPolicy = riskPolicies[riskKey];
  const priceMatch = raw.match(/(\d+)\s*元/);
  return {
    title: riskKey === "low_risk" ? (isTool ? "工具借用" : "邻里互助") : riskPolicy.title,
    desc: raw || "想请附近邻居帮个小忙。",
    time: raw.match(/今晚|今天|明天|周六|周日/)?.[0] || "今天",
    place: raw.match(/[1-9]\s*栋|小区门口|楼下|花园/)?.[0] || "同小区",
    budget: priceMatch ? Number(priceMatch[1]) : isTool ? 0 : 10,
    risk: riskPolicy.risk,
    riskKey,
    safetyPlan: riskPolicy,
    advice:
      riskKey === "child_pickup"
        ? "请补充监护人授权、孩子班级衣着、固定交接点和备用联系人。"
        : riskKey === "elder_care"
          ? "请补充家属联系人、老人基础身体状况和服务时段。"
          : riskKey === "pet_care"
            ? "请补充宠物性格、牵引规则和伤人责任约定。"
            : isTool
              ? "建议补充预计归还时间。"
              : "建议补充是否上楼、物品大小和是否可议价。",
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function taskReferenceText(task) {
  return Number(task.budget) === 0 ? "免费/押金" : "8-15 元";
}

function TaskInfoButton(field, label, value) {
  return `
    <button class="info-edit-button" type="button" data-edit-task-field="${field}" aria-label="修改${label}">
      <small>${label}</small>
      <b>${escapeHtml(value)}</b>
    </button>
  `;
}

function SafetyPlanPanel(task) {
  const plan = task.safetyPlan || riskPolicies.low_risk;
  return `
    <section class="safety-plan" aria-label="信用与安全规则">
      <div class="safety-plan-head">
        <div>
          <small>信用准入</small>
          <strong>${plan.title} · ${plan.risk}</strong>
        </div>
        <span>${plan.minCredit}+ 分</span>
      </div>
      <div class="safety-chip-row">
        ${plan.evidence.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
      <div class="safety-rule-grid">
        <div>
          <small>硬性禁令</small>
          <p>${plan.forbidden.map(escapeHtml).join("；")}</p>
        </div>
        <div>
          <small>资金保险</small>
          <p>${escapeHtml(plan.money)}</p>
        </div>
      </div>
    </section>
  `;
}

function normalizeTaskField(field, value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  if (field !== "budget") return trimmed;

  const number = Number(trimmed.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number);
}

function editTaskField(field) {
  if (!lastTask) return;
  const labels = { time: "时间", place: "位置", budget: "预算" };
  const label = labels[field];
  if (!label) return;

  const current = field === "budget" ? `${lastTask.budget}` : lastTask[field];
  const nextValue = window.prompt(`修改${label}`, current);
  if (nextValue === null) return;

  const normalized = normalizeTaskField(field, nextValue);
  if (normalized === null) {
    window.alert(field === "budget" ? "请输入有效预算" : `请输入有效${label}`);
    return;
  }

  lastTask = { ...lastTask, [field]: normalized };
  renderAgentResult({ shouldScroll: false });
}

function renderAgentResult(options = {}) {
  const result = $("#agentResult");
  if (!result || !lastTask) return;
  result.innerHTML = `
    <article class="task-card">
      <div class="task-top">
        <div>
          <p>Agent 已整理好</p>
          <h2>${lastTask.title}</h2>
          <span>${lastTask.desc}</span>
        </div>
        <strong>${lastTask.risk}</strong>
      </div>
      <div class="info-grid">
        ${TaskInfoButton("time", "时间", lastTask.time)}
        ${TaskInfoButton("place", "位置", lastTask.place)}
        ${TaskInfoButton("budget", "预算", `${lastTask.budget} 元`)}
        <div><small>参考</small><b>${taskReferenceText(lastTask)}</b></div>
      </div>
      <p>${lastTask.advice}</p>
      ${SafetyPlanPanel(lastTask)}
      <button type="button" class="primary-action" data-action="create-order">生成候选匹配</button>
    </article>
  `;
  if (options.shouldScroll !== false) {
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function openCompose(template) {
  const index = template === "tool" ? 2 : template === "social" ? 1 : 0;
  $("#mobileText").value = data.presets[index];
  $("#composeSheet").classList.add("open");
  $("#sheetBackdrop").classList.add("open");
}

function closeCompose() {
  $("#composeSheet").classList.remove("open");
  $("#sheetBackdrop").classList.remove("open");
}

function openProfileEditor() {
  $("#profileNameInput").value = profileState.name;
  updateProfilePreview();
  $("#profileSheet").classList.add("open");
  $("#sheetBackdrop").classList.add("open");
}

function closeProfileEditor() {
  $("#profileSheet").classList.remove("open");
  if (!$("#composeSheet").classList.contains("open")) {
    $("#sheetBackdrop").classList.remove("open");
  }
}

function updateProfilePreview() {
  const preview = $("#profileAvatarPreview");
  if (!preview) return;
  preview.innerHTML = profileState.avatar
    ? `<img src="${profileState.avatar}" alt="${profileState.name}的头像预览" />`
    : profileState.name.slice(0, 1);
}

function refreshProfileViews() {
  renderHome();
  renderProfile();
  showScreen(activeScreen, false);
}

function showScreen(name, shouldScroll = true) {
  activeScreen = name;
  $$(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === `screen-${name}`));
  $$(".bottom-tabs button[data-screen]").forEach((button) => button.classList.toggle("active", button.dataset.screen === name));
  if (shouldScroll) window.scrollTo({ top: 0, behavior: "smooth" });
}

function createOrderFromTask(task = lastTask) {
  if (!task) return;
  orders.unshift({
    id: `NB-${String(orders.length + 1).padStart(3, "0")}`,
    title: task.title,
    desc: task.desc,
    status: "查看",
  });
  renderMessages();
  showScreen("messages");
}

function borrowTool(id) {
  const tool = data.tools.find((item) => item.id === id);
  if (!tool) return;
  createOrderFromTask({
    title: `借用${tool.name}`,
    desc: `${tool.owner} · ${tool.place} · ${tool.rule}`,
  });
}

function bindEvents() {
  document.body.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.dataset.editTaskField) {
      editTaskField(button.dataset.editTaskField);
      return;
    }

    if (button.dataset.screen) showScreen(button.dataset.screen);
    if (button.id === "openCompose") openCompose();
    if (button.id === "closeCompose") closeCompose();
    if (button.id === "closeProfileEditor") closeProfileEditor();
    if (button.id === "chooseAvatar") $("#avatarInput").click();
    if (button.id === "saveProfile") {
      saveProfileState({ name: $("#profileNameInput").value, avatar: profileState.avatar });
      closeProfileEditor();
      refreshProfileViews();
    }
    if (button.id === "mobileParse") {
      lastTask = parseTask($("#mobileText").value);
      closeCompose();
      showScreen("home", false);
      renderAgentResult();
    }

    const quickId = button.dataset.quickId;
    if (quickId) {
      const item = data.quickActions.find((entry) => entry.id === quickId);
      if (item?.compose) openCompose();
      if (item?.target) showScreen(item.target);
    }

    const action = button.dataset.action;
    if (action === "edit-profile") openProfileEditor();
    if (action === "notify") showScreen("messages");
    if (action === "search" || action === "open-search") showSearchPlaceholder();
    if (action === "see-more") showScreen("discover");
    if (action === "borrow-first") borrowTool("tool-1");
    if (action === "simulate-order") createOrderFromTask({ title: "周六散步局提醒", desc: "阿树邀请你加入 19:30 的河堤散步局。" });
    if (action === "create-order") createOrderFromTask();

    if (button.dataset.borrowId) borrowTool(button.dataset.borrowId);
    if (button.dataset.nextOrder) button.textContent = "已读";
  });

  $("#sheetBackdrop").addEventListener("click", () => {
    closeCompose();
    closeProfileEditor();
  });

  $("#avatarInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      profileState.avatar = String(reader.result || "");
      updateProfilePreview();
    });
    reader.readAsDataURL(file);
  });

  $("#profileNameInput").addEventListener("input", (event) => {
    if (profileState.avatar) return;
    const preview = $("#profileAvatarPreview");
    if (preview) preview.textContent = event.target.value.trim().slice(0, 1) || data.user.name.slice(0, 1);
  });
}

function showSearchPlaceholder() {
  showScreen("discover");
  const first = $("#screen-discover .discover-card");
  if (first) {
    first.classList.add("highlight");
    window.setTimeout(() => first.classList.remove("highlight"), 700);
  }
}

function initPresets() {
  $("#presetRow").innerHTML = data.presets
    .map((text, index) => `<button type="button" data-preset-index="${index}">${index === 0 ? "代取快递" : index === 1 ? "周末活动" : "借小推车"}</button>`)
    .join("");

  $("#presetRow").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-preset-index]");
    if (!button) return;
    $("#mobileText").value = data.presets[Number(button.dataset.presetIndex)];
  });
}

function init() {
  renderHome();
  renderDiscover();
  renderMessages();
  renderProfile();
  initPresets();
  bindEvents();
}

init();
