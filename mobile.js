const data = window.NB_MOCK;
const orders = [];
const profileStorageKey = "neighborhood_profile";

let activeScreen = "home";
let lastTask = null;
let profileState = loadProfile();
let assistantMessages = [
  {
    role: "assistant",
    text: "你可以直接和我说：我今天去中通快递站，有没有邻居要带快递的。我会先帮你匹配附近求助，再问你要不要发帖。",
  },
];
let assistantSuggestions = [];
let assistantHelpers = [];
let pendingAssistantPost = null;
let discoverMode = "hot";
let discoverCategory = "ask";
let discoverSearch = "";
let composeMode = "manual";
let composeCategory = "ask";
const communityPosts = data.discoverCards.map((item, index) => ({
  id: `seed-${index}`,
  title: item.title,
  text: item.text,
  count: item.count,
  author: index === 0 ? "阿树" : index === 1 ? "物业工具柜" : "安安",
  time: index === 0 ? "刚刚" : `${index + 1}小时前`,
  heat: 88 - index * 13,
  source: "seed",
  category: index === 1 ? "offer" : "ask",
}));
let messageMode = "all";
let activeChatId = null;
const chats = {};

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

function analyzeMobileRequest(text) {
  const task = parseTask(text);
  const needs = [];

  if (!/(今晚|今天|明天|周[一二三四五六日天]|上午|下午|晚上|\d{1,2}\s*点)/.test(task.desc)) {
    needs.push("补充完成时间");
  }
  if (!/([1-9]\s*栋|小区门口|楼下|花园|物业|同小区)/.test(task.desc)) {
    needs.push("补充位置范围");
  }
  if (task.title === "工具借用" && !/(还|归还|小时|明天)/.test(task.desc)) {
    needs.push("补充归还时间");
  }
  if (task.title !== "工具借用" && !/(上楼|重量|代垫|大小|议价)/.test(task.desc)) {
    needs.push("说明是否上楼或代垫");
  }

  return {
    task,
    needs: needs.length ? needs : ["信息清楚，可以直接整理任务"],
    matchText: task.title === "工具借用" ? "可优先匹配工具柜和同楼栋物主" : "可优先匹配 3 位附近邻居",
  };
}

function MobileAssistantCard() {
  const sourceText = lastTask?.desc || data.presets[0];
  const { task, needs, matchText } = analyzeMobileRequest(sourceText);

  return `
    <section class="mobile-ai-card" aria-label="AI 发单助手">
      <div class="mobile-ai-head">
        <span>AI</span>
        <div>
          <p>发单助手</p>
          <h2>${task.title}</h2>
        </div>
      </div>
      <div class="mobile-ai-metrics">
        <div><small>风险</small><strong>${task.risk}</strong></div>
        <div><small>预算</small><strong>${task.budget} 元</strong></div>
      </div>
      <p>${matchText}</p>
      <div class="mobile-ai-tags">
        ${needs.map((item) => `<span>${item}</span>`).join("")}
      </div>
      <button type="button" class="primary-action" data-action="open-ai-compose">找 AI 帮我整理</button>
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
  const posts = getDiscoverPosts();
  $("#screen-discover").innerHTML = `
    <header class="simple-header">
      <div>
        <p>附近发现</p>
        <h1>今天社区里有什么</h1>
      </div>
      <button type="button" data-action="open-search">搜索</button>
    </header>
    <section class="discover-controls">
      <div class="discover-tabs" role="tablist" aria-label="发现筛选">
        <button type="button" class="${discoverMode === "hot" ? "active" : ""}" data-discover-mode="hot">热门</button>
        <button type="button" class="${discoverMode === "latest" ? "active" : ""}" data-discover-mode="latest">最新</button>
        <button type="button" class="${discoverMode === "search" ? "active" : ""}" data-discover-mode="search">搜索</button>
      </div>
      <div class="discover-tabs sub-tabs" role="tablist" aria-label="互助分类">
        <button type="button" class="${discoverCategory === "ask" ? "active" : ""}" data-discover-category="ask">求帮助</button>
        <button type="button" class="${discoverCategory === "offer" ? "active" : ""}" data-discover-category="offer">帮助</button>
      </div>
      <input class="discover-search ${discoverMode === "search" ? "show" : ""}" id="discoverSearch" type="search" placeholder="搜快递、工具、活动" value="${discoverSearch}" />
    </section>
    <section class="discover-list">
      ${posts.length
        ? posts
            .map(
              (item) => `
            <article class="discover-card">
              <div>
                <p>${item.author} · ${item.time}</p>
                <h2>${item.title}</h2>
                <p>${item.text}</p>
              </div>
              <span>${item.category === "offer" ? "帮助" : "求帮助"}</span>
            </article>
          `
            )
            .join("")
        : `<div class="empty-box">没有搜到相关帖子，换个关键词试试。</div>`}
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
  if (activeChatId) {
    renderPrivateChat();
    return;
  }
  const filteredOrders = messageMode === "all" ? orders : orders.filter((order) => order.category === messageMode);
  const content = filteredOrders.length
    ? filteredOrders
        .map(
          (order) => `
            <article class="message-card">
              <div>
                <p>${order.id}</p>
                <h2>${order.title}</h2>
                <span>${order.desc}</span>
              </div>
              <button type="button" class="small-action" data-open-chat="${order.id}">私聊</button>
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
    <section class="discover-tabs message-tabs" aria-label="消息分类">
      <button type="button" class="${messageMode === "all" ? "active" : ""}" data-message-mode="all">全部</button>
      <button type="button" class="${messageMode === "ask" ? "active" : ""}" data-message-mode="ask">求帮助</button>
        <button type="button" class="${messageMode === "offer" ? "active" : ""}" data-message-mode="offer">帮助</button>
    </section>
    <section class="message-list">${content}</section>
  `;
}

function renderPrivateChat() {
  const order = orders.find((item) => item.id === activeChatId);
  if (!order) {
    activeChatId = null;
    renderMessages();
    return;
  }
  const messages = chats[activeChatId] || [];
  $("#screen-messages").innerHTML = `
    <header class="simple-header chat-header">
      <div>
                <p>${order.category === "offer" ? "帮助" : "求帮助"}</p>
        <h1>${order.title}</h1>
      </div>
      <button type="button" data-action="close-chat">返回</button>
    </header>
    <section class="private-chat-log">
      <article class="private-chat-meta">
        <strong>${order.title}</strong>
        <p>${order.desc}</p>
      </article>
      ${messages.map((item) => `<div class="private-bubble ${item.role}"><p>${item.text}</p></div>`).join("")}
    </section>
    <section class="private-chat-composer">
      <input id="privateChatInput" type="text" placeholder="和邻居说点什么" />
      <button type="button" class="primary-action" id="privateChatSend">发送</button>
    </section>
  `;
}

function openPrivateChat(id) {
  const order = orders.find((item) => item.id === id);
  if (!order) return;
  activeChatId = id;
  if (!chats[id]) {
    chats[id] = [
      { role: "neighbor", text: order.category === "offer" ? "你好，我看到了你的帮助帖，想问问细节。" : "你好，我看到了你的求助，可以先确认一下时间和地点吗？" },
    ];
  }
  renderPrivateChat();
}

function sendPrivateChat() {
  const input = $("#privateChatInput");
  const text = input?.value.trim();
  if (!text || !activeChatId) return;
  chats[activeChatId].push({ role: "me", text });
  input.value = "";
  renderPrivateChat();
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

function updateMobileAssistantSheet() {
  const sheet = $("#mobileAssistantSheet");
  if (!sheet) return;
  if (composeMode === "manual") {
    sheet.innerHTML = `
      <div>
        <strong>${composeCategory === "ask" ? "手动发布求帮助" : "手动发布帮助"}</strong>
        <span>你填写的内容会直接同步到发现页，也会生成一条消息记录。</span>
      </div>
    `;
    return;
  }
  const { task, needs, matchText } = analyzeMobileRequest($("#mobileText").value);
  sheet.innerHTML = `
    <div>
      <strong>AI 预判：${task.title}</strong>
      <span>${task.risk} · ${task.budget} 元 · ${task.place}</span>
    </div>
    <p>${matchText}</p>
    <div class="mobile-ai-tags compact">
      ${needs.map((item) => `<span>${item}</span>`).join("")}
    </div>
  `;
}

function syncComposeControls() {
  $$('[data-compose-mode]').forEach((button) => button.classList.toggle("active", button.dataset.composeMode === composeMode));
  $$('[data-compose-category]').forEach((button) => button.classList.toggle("active", button.dataset.composeCategory === composeCategory));
  $("#mobileParse").textContent = composeMode === "agent" ? "让 Agent 整理任务" : "发布";
  updateMobileAssistantSheet();
}

function publishManualPost() {
  const text = $("#mobileText").value.trim();
  if (!text) return;
  const post = {
    id: `post-${Date.now()}`,
    title: composeCategory === "ask" ? "邻里求帮助" : "我可以帮助",
    text,
    count: "等待回应",
    author: profileState.name,
    time: "刚刚",
    heat: 98,
    category: composeCategory,
    source: "manual",
  };
  communityPosts.unshift(post);
  createOrderFromTask({ title: post.title, desc: post.text, category: post.category }, false);
  closeCompose();
  discoverMode = "latest";
  discoverCategory = post.category;
  renderDiscover();
  showScreen("discover");
}

async function publishAgentTask() {
  const text = $("#mobileText").value.trim();
  if (!text) return;
  $("#mobileParse").textContent = "Agent 整理中...";
  try {
    const response = await fetch("/api/assistant/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    const result = await response.json();
    const post = buildPostFromAssistant(result, text);
    communityPosts.unshift({ ...post, id: `post-${Date.now()}`, source: "agent" });
    createOrderFromTask({ title: post.title, desc: post.text, category: post.category }, false);
    assistantMessages.push({ role: "assistant", text: result.reply || "我已经帮你整理并发布到发现页。" });
    closeCompose();
    discoverMode = "latest";
    discoverCategory = post.category;
    renderAssistant();
    renderDiscover();
    showScreen("discover");
  } finally {
    syncComposeControls();
  }
}

function getDiscoverPosts() {
  const source = communityPosts.filter((item) => item.category === discoverCategory);
  if (discoverMode === "latest") return [...source].sort((a, b) => Number(b.id.startsWith("post-")) - Number(a.id.startsWith("post-")) || b.heat - a.heat);
  if (discoverMode === "search") {
    const keyword = discoverSearch.trim();
    if (!keyword) return source;
    return source.filter((item) => `${item.title}${item.text}${item.author}`.includes(keyword));
  }
  return [...source].sort((a, b) => b.heat - a.heat);
}

function renderAssistant() {
  $("#screen-assistant").innerHTML = `
    <header class="simple-header">
      <div>
        <p>AI 助手</p>
        <h1>说一句话，匹配顺路互助</h1>
      </div>
      <button type="button" data-action="open-ai-compose">发布</button>
    </header>
    <section class="assistant-chat" id="assistantChatLog">
      ${assistantMessages.map(AssistantBubble).join("")}
    </section>
    <section class="assistant-suggestions" id="assistantSuggestions">
      ${pendingAssistantPost ? AssistantPublishCard(pendingAssistantPost) : ""}
      ${assistantHelpers.map(AssistantHelperCard).join("")}
      ${assistantSuggestions.map(AssistantHelpCard).join("")}
    </section>
    <section class="assistant-composer">
      <input id="assistantInput" type="text" placeholder="例如：我今天去菜鸟驿站" />
      <button type="button" class="primary-action" id="assistantSend">发送</button>
    </section>
  `;
}

function AssistantHelperCard(item) {
  const action = getHelperAction(item);
  return `
    <article class="assistant-help-card helper">
      <div>
        <p>${item.helper} · ${item.distance} 米 · 匹配 ${item.score}</p>
        <h2>${item.title}</h2>
        <span>${item.text}</span>
      </div>
      <div class="assistant-help-actions">
        <button type="button" class="small-action" data-helper-id="${item.id}" data-helper-mode="invite">${action.inviteLabel}</button>
        <button type="button" class="small-action paid" data-helper-id="${item.id}" data-helper-mode="paid">${action.paidLabel}</button>
      </div>
    </article>
  `;
}

function getHelperAction(item) {
  const text = `${item.title}${item.text}`;
  const budget = item.budget || 0;
  if (/接孩子|接送|照应|学校|幼儿园/.test(text)) {
    return {
      inviteLabel: "邀请接孩子",
      paidLabel: budget > 0 ? `付费接送 ${budget} 元` : "协商接送",
      inviteMessage: "想请你帮忙接一下孩子，我会补充学校、接送人和联系方式。",
      paidMessage: budget > 0 ? `想请你帮忙接一下孩子，${budget} 元可以，细节我们再确认。` : "想请你帮忙接一下孩子，费用可以再协商。",
    };
  }
  if (/快递|取件|快递柜|驿站/.test(text)) {
    return {
      inviteLabel: "邀请取件",
      paidLabel: budget > 0 ? `付费取件 ${budget} 元` : "免费取件",
      inviteMessage: "想请你帮忙取一下快递，我会补充取件码和送达位置。",
      paidMessage: budget > 0 ? `想请你帮忙取一下快递，${budget} 元可以。` : "想请你帮忙取一下快递，可以免费互助吗？",
    };
  }
  return {
    inviteLabel: "邀请协助",
    paidLabel: budget > 0 ? `协商报酬 ${budget} 元` : "免费互助",
    inviteMessage: "想请你帮忙处理这个邻里小事，方便的话回复我。",
    paidMessage: budget > 0 ? `想请你帮忙，${budget} 元可以。` : "想请你帮忙，可以免费互助吗？",
  };
}

function AssistantBubble(message) {
  return `
    <div class="assistant-bubble ${message.role === "user" ? "user" : "assistant"}">
      <p>${message.text}</p>
    </div>
  `;
}

function AssistantHelpCard(item) {
  const action = getRequestAction(item);
  return `
    <article class="assistant-help-card">
      <div>
        <p>${item.requester} · ${item.distance} 米 · 匹配 ${item.score}</p>
        <h2>${item.title}</h2>
        <span>${item.text}</span>
      </div>
      <div class="assistant-help-actions">
        <button type="button" class="small-action" data-help-id="${item.id}" data-help-mode="free">${action.freeLabel}</button>
        <button type="button" class="small-action paid" data-help-id="${item.id}" data-help-mode="paid">${action.paidLabel}</button>
      </div>
    </article>
  `;
}

function getRequestAction(item) {
  const text = `${item.title}${item.text}`;
  const budget = item.budget || 0;
  if (/快递|取件|快递柜|驿站/.test(text)) {
    return {
      freeLabel: "顺路带件",
      paidLabel: budget > 0 ? `接单 ${budget} 元` : "免费帮带",
      freeMessage: "我正好顺路，可以帮你带一下快递。",
      paidMessage: budget > 0 ? `我可以顺路帮忙，${budget} 元可以。` : "我可以免费帮你带一下。",
    };
  }
  return {
    freeLabel: "直接响应",
    paidLabel: budget > 0 ? `接单 ${budget} 元` : "免费互助",
    freeMessage: "我可以免费帮忙。",
    paidMessage: budget > 0 ? `我可以帮忙，${budget} 元可以。` : "我可以免费帮忙。",
  };
}

function AssistantPublishCard(post) {
  return `
    <article class="assistant-publish-card">
      <p>AI 已整理成帖子</p>
      <h2>${post.title}</h2>
      <span>${post.text}</span>
      <button type="button" class="primary-action" data-action="publish-ai-post">发帖到发现</button>
    </article>
  `;
}

function buildPostFromAssistant(result, text) {
  const task = result.publishTask || parseTask(text);
  const location = task.location || task.place || "小区快递站";
  const isRequest = task.category === "ask" || /^求助/.test(task.serviceTag || "");
  return {
    title: task.serviceTag === "顺路帮取" ? "今天顺路去快递站，可帮邻居带件" : isRequest ? task.serviceTag.replace("求助", "想请邻居帮忙") : "邻里顺路互助",
    text: task.description || (isRequest ? `想请邻居帮忙从${location}取快递，可以免费或付费协商。` : `我今天会去${location}，如果有邻居需要顺手带快递，可以留言。`),
    count: "等待回应",
    author: profileState.name,
    time: "刚刚",
    heat: 99,
    category: isRequest ? "ask" : "offer",
  };
}

async function sendAssistantMessage(message) {
  const text = message.trim();
  if (!text) return;
  assistantMessages.push({ role: "user", text });
  assistantMessages.push({ role: "assistant", text: "正在匹配附近顺路求助..." });
  renderAssistant();

  try {
    const response = await fetch("/api/assistant/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    const result = await response.json();
    assistantMessages.pop();
    const targetText = result.intent?.type === "help_request" ? "下面是可能能帮忙的邻居" : "下面是可能顺路匹配的求助";
    assistantMessages.push({ role: "assistant", text: `${result.reply || "我整理好了。"} ${targetText}。要不要我帮你发一条帖子，让邻居在发现里看到？` });
    assistantSuggestions = result.nearbyRequests || [];
    assistantHelpers = result.nearbyHelpers || [];
    pendingAssistantPost = buildPostFromAssistant(result, text);
  } catch {
    assistantMessages.pop();
    assistantMessages.push({ role: "assistant", text: "网络暂时不可用，我先按本地规则帮你匹配。" });
    assistantSuggestions = analyzeMobileRequest(text).task.title === "工具借用" ? [] : assistantSuggestions;
    assistantHelpers = [];
    pendingAssistantPost = buildPostFromAssistant({}, text);
  }

  renderAssistant();
}

function publishAssistantPost() {
  if (!pendingAssistantPost) return;
  const postCategory = pendingAssistantPost.category || "ask";
  communityPosts.unshift({
    ...pendingAssistantPost,
    id: `post-${Date.now()}`,
    source: "assistant",
  });
  assistantMessages.push({ role: "assistant", text: "已发帖，同步到发现页了。邻居可以在热门或最新里看到这条顺路互助。" });
  pendingAssistantPost = null;
  discoverMode = "latest";
  discoverCategory = postCategory;
  renderAssistant();
  renderDiscover();
  showScreen("discover");
}

function openHelpReply(id, mode) {
  const item = assistantSuggestions.find((entry) => entry.id === id);
  if (!item) return;
  const action = getRequestAction(item);
  const label = mode === "free" ? action.freeLabel : action.paidLabel;
  const note = window.prompt(`${label}：给 ${item.requester} 留一句话`, mode === "free" ? action.freeMessage : action.paidMessage);
  if (!note) return;
  createOrderFromTask({
    title: item.title,
    desc: `${label} · ${note}`,
  });
}

function openHelperInvite(id, mode) {
  const item = assistantHelpers.find((entry) => entry.id === id);
  if (!item) return;
  const action = getHelperAction(item);
  const label = mode === "paid" ? action.paidLabel : action.inviteLabel;
  const note = window.prompt(`${label}：给 ${item.helper} 留一句话`, mode === "paid" ? action.paidMessage : action.inviteMessage);
  if (!note) return;
  createOrderFromTask({ title: item.title, desc: `${label} · ${note}` });
}

function openCompose(template) {
  const index = template === "tool" ? 2 : template === "social" ? 1 : 0;
  $("#mobileText").value = data.presets[index];
  syncComposeControls();
  updateMobileAssistantSheet();
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
  renderAssistant();
  renderProfile();
  showScreen(activeScreen, false);
}

function showScreen(name, shouldScroll = true) {
  activeScreen = name;
  $$(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === `screen-${name}`));
  $$(".bottom-tabs button[data-screen]").forEach((button) => button.classList.toggle("active", button.dataset.screen === name));
  if (shouldScroll) window.scrollTo({ top: 0, behavior: "smooth" });
}

function createOrderFromTask(task = lastTask, shouldShowMessages = true) {
  if (!task) return;
  orders.unshift({
    id: `NB-${String(orders.length + 1).padStart(3, "0")}`,
    title: task.title,
    desc: task.desc,
    status: "查看",
    category: task.category || "ask",
  });
  renderMessages();
  if (shouldShowMessages) showScreen("messages");
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
      if (composeMode === "agent") {
        publishAgentTask();
      } else {
        publishManualPost();
      }
    }
    if (button.id === "assistantSend") sendAssistantMessage($("#assistantInput").value);
    if (button.id === "privateChatSend") sendPrivateChat();

    const quickId = button.dataset.quickId;
    if (quickId) {
      const item = data.quickActions.find((entry) => entry.id === quickId);
      if (item?.compose) openCompose();
      if (item?.target) showScreen(item.target);
    }

    const action = button.dataset.action;
    if (action === "edit-profile") openProfileEditor();
    if (action === "open-ai-compose") openCompose(lastTask?.title === "工具借用" ? "tool" : undefined);
    if (action === "publish-ai-post") publishAssistantPost();
    if (action === "notify") showScreen("messages");
    if (action === "search" || action === "open-search") showSearchPlaceholder();
    if (action === "see-more") showScreen("discover");
    if (action === "borrow-first") borrowTool("tool-1");
    if (action === "simulate-order") createOrderFromTask({ title: "周六散步局提醒", desc: "阿树邀请你加入 19:30 的河堤散步局。", category: "offer" });
    if (action === "create-order") createOrderFromTask();
    if (action === "close-chat") {
      activeChatId = null;
      renderMessages();
    }

    if (button.dataset.borrowId) borrowTool(button.dataset.borrowId);
    if (button.dataset.nextOrder) button.textContent = "已读";
    if (button.dataset.openChat) openPrivateChat(button.dataset.openChat);
    if (button.dataset.helpId) openHelpReply(button.dataset.helpId, button.dataset.helpMode);
    if (button.dataset.helperId) openHelperInvite(button.dataset.helperId, button.dataset.helperMode);
    if (button.dataset.discoverMode) {
      discoverMode = button.dataset.discoverMode;
      renderDiscover();
    }
    if (button.dataset.discoverCategory) {
      discoverCategory = button.dataset.discoverCategory;
      renderDiscover();
    }
    if (button.dataset.messageMode) {
      messageMode = button.dataset.messageMode;
      renderMessages();
    }
    if (button.dataset.composeMode) {
      composeMode = button.dataset.composeMode;
      syncComposeControls();
    }
    if (button.dataset.composeCategory) {
      composeCategory = button.dataset.composeCategory;
      syncComposeControls();
    }
  });

  document.body.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.target?.id !== "assistantInput") return;
    event.preventDefault();
    sendAssistantMessage(event.target.value);
  });

  document.body.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.target?.id !== "privateChatInput") return;
    event.preventDefault();
    sendPrivateChat();
  });

  document.body.addEventListener("input", (event) => {
    if (event.target?.id !== "discoverSearch") return;
    discoverSearch = event.target.value;
    renderDiscover();
    const input = $("#discoverSearch");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
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

  $("#mobileText").addEventListener("input", updateMobileAssistantSheet);

  $("#profileNameInput").addEventListener("input", (event) => {
    if (profileState.avatar) return;
    const preview = $("#profileAvatarPreview");
    if (preview) preview.textContent = event.target.value.trim().slice(0, 1) || data.user.name.slice(0, 1);
  });
}

function showSearchPlaceholder() {
  discoverMode = "search";
  showScreen("discover");
  renderDiscover();
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
  renderAssistant();
  renderDiscover();
  renderMessages();
  renderProfile();
  initPresets();
  bindEvents();
}

init();
