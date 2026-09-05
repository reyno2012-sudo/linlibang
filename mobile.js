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
let voiceRecognition = null;
let isRecordingVoice = false;
let voiceStatusText = "";
let isPressingVoice = false;
let voiceStopRequested = false;
let discoverMode = "hot";
let discoverCategory = "ask";
let discoverSearch = "";
let composeMode = "manual";
let composeCategory = "ask";
let selectedErrandServiceId = data.errandServices?.[0]?.id || "";
let showAllCirclePosts = false;
let showFullCreditRanking = false;
let activeProofType = "identity";
let creditProofResult = null;
let suppressNextAvatarUploadClick = false;
let avatarDragState = null;
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
let web3Client = null;
let web3Artifact = null;
let activeEscrowOrderId = null;
const walletState = {
  account: "",
  balance: "",
  phase: "idle",
  message: "",
};

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
      avatarPosition: saved.avatarPosition || { x: 50, y: 50 },
    };
  } catch {
    return { name: data.user.name, avatar: "", avatarPosition: { x: 50, y: 50 } };
  }
}

function saveProfileState(nextProfile) {
  profileState = {
    name: nextProfile.name?.trim() || data.user.name,
    avatar: nextProfile.avatar || profileState.avatar,
    avatarPosition: nextProfile.avatarPosition || profileState.avatarPosition || { x: 50, y: 50 },
  };
  localStorage.setItem(profileStorageKey, JSON.stringify(profileState));
}

function avatarPositionStyle() {
  const position = profileState.avatarPosition || { x: 50, y: 50 };
  return `style="--avatar-position: ${position.x}% ${position.y}%; object-position: ${profileState.avatarPosition.x}% ${profileState.avatarPosition.y}%;"`;
}

function AvatarContent(className = "") {
  if (profileState.avatar) {
    return `<img class="${className}" src="${profileState.avatar}" alt="${profileState.name}的头像" ${avatarPositionStyle()} />`;
  }
  return `<span>${profileState.name.slice(0, 1)}</span>`;
}

function HomeHeader() {
  const walletLabel = walletState.account
    ? window.NeighborWeb3.shortAddress(walletState.account)
    : walletState.phase === "connecting"
      ? "连接中…"
      : "连接钱包";
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
        <button type="button" class="wallet-button ${walletState.account ? "connected" : ""}" data-action="connect-wallet" aria-label="连接 Monad 钱包">
          <span class="wallet-dot"></span>${walletLabel}
        </button>
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
        <h1>远亲不如近邻，<br />省心省力<span class="hero-brand-name">邻里帮</span>。</h1>
        <span class="short-line" aria-hidden="true"></span>
      </div>
      <div class="hero-illustration" aria-label="原创社区生活插画">
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

function NearbyAvatar(post) {
  if (post.avatar && post.avatar.includes("/")) {
    return `<img class="mini-avatar-image" src="${post.avatar}" alt="${escapeHtml(post.name)}的头像" loading="lazy" />`;
  }
  return `<span class="mini-avatar avatar-${post.avatar}" aria-hidden="true"></span>`;
}

function NearbyPostCard(post) {
  const status = post.count || post.meta || "";
  return `
    <article class="nearby-card">
      <div class="mini-profile">
        ${NearbyAvatar(post)}
        <div>
          <strong>${escapeHtml(post.name)}</strong>
          <small>${escapeHtml(post.time)}</small>
        </div>
      </div>
      ${post.title ? `<strong class="nearby-title">${escapeHtml(post.title)}</strong>` : ""}
      <p>${escapeHtml(post.text)}</p>
      ${status ? `<div class="post-status">${escapeHtml(status)}</div>` : ""}
      <div class="post-foot">
        <span>${escapeHtml(post.tag)}</span>
        <span>${escapeHtml(status)}</span>
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

function selectedErrandService() {
  return data.errandServices.find((service) => service.id === selectedErrandServiceId) || data.errandServices[0];
}

function selectedErrandRule() {
  const service = selectedErrandService();
  const ruleId = service?.ruleId || service?.id || selectedErrandServiceId;
  return data.errandServiceRules.find((rule) => rule.id === ruleId) || data.errandServiceRules[0];
}

function ServiceRuleList(title, items) {
  return `
    <div class="service-rule-list">
      <h3>${escapeHtml(title)}</h3>
      <ul>
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderErrandRuleSheet() {
  const service = selectedErrandService();
  const rule = selectedErrandRule();
  $("#errandRuleBody").innerHTML = `
    <article class="service-rule-block">
      <div class="service-rule-kicker">
        <span>${escapeHtml(service.risk)}</span>
        <strong>${escapeHtml(service.price)}</strong>
      </div>
      <h3>${escapeHtml(rule.title)}</h3>
      <p>${escapeHtml(rule.summary)}</p>
      ${ServiceRuleList("标准说明", rule.standards)}
      ${ServiceRuleList("下单流程", rule.flow)}
      ${ServiceRuleList("风险边界", rule.warnings)}
    </article>
  `;
}

function ErrandServiceCard(service) {
  const active = service.id === selectedErrandServiceId;
  return `
    <button class="errand-service-card ${active ? "active" : ""}" type="button" data-errand-service-id="${service.id}">
      <div>
        <span>${escapeHtml(service.reward)}</span>
        <h2>${escapeHtml(service.title)}</h2>
        <p>${escapeHtml(service.desc)}</p>
      </div>
      <strong>${escapeHtml(service.price)}</strong>
      <small>${escapeHtml(service.risk)}</small>
    </button>
  `;
}

function renderErrandServices() {
  const service = selectedErrandService();
  $("#screen-errand").innerHTML = `
    <header class="simple-header">
      <div>
        <p>跑腿互助</p>
        <h1>闲置时间，帮点小忙</h1>
      </div>
      <button type="button" data-action="back-home">返回</button>
    </header>
    <section class="errand-hero">
      <div>
        <span>服务本社区 · 平台留痕</span>
        <h2>把小事交给附近可信邻居</h2>
        <p>代取快递、门口垃圾、周边取送、买东西、带饭和简单维修，都可以走平台托管和信用筛选。</p>
      </div>
    </section>
    <section class="errand-service-list" aria-label="跑腿互助服务">
      ${data.errandServices.map(ErrandServiceCard).join("")}
    </section>
    <section class="errand-order-form" aria-label="跑腿下单信息">
      <div class="section-head">
        <h2>${escapeHtml(service.title)}</h2>
        <button type="button" data-action="show-errand-rule">规则说明</button>
      </div>
      <div class="errand-field-grid">
        <label><span>联系人</span><input id="errandContact" type="text" placeholder="怎么称呼你" /></label>
        <label><span>手机号</span><input id="errandPhone" type="tel" placeholder="用于邻居联系" /></label>
        <label><span>地址/房号</span><input id="errandAddress" type="text" placeholder="如 3 栋 1202" /></label>
        <label><span>期望时间</span><input id="errandTime" type="text" placeholder="如 今晚 7 点前" /></label>
      </div>
      <label class="errand-note">
        <span>备注和凭证</span>
        <textarea id="errandNote" rows="3" placeholder="${service.fields.map(escapeHtml).join(" / ")}，也可以补充取件码、忌口、照片说明。"></textarea>
      </label>
      <div class="errand-safety-note">
        <strong>${escapeHtml(service.note)}</strong>
        <p>平台建议选择高信用邻居接单，完成时上传照片，资金确认后再结算。</p>
      </div>
    </section>
    <section class="errand-submit-bar">
      <div>
        <span>预估费用</span>
        <strong>${escapeHtml(service.price)}</strong>
      </div>
      <button type="button" class="primary-action" id="errandOrderSubmit">确认下单</button>
    </section>
  `;
}

function CircleAvatar(name, avatar) {
  return `<img class="circle-avatar" src="${avatar}" alt="${escapeHtml(name)}的头像" loading="lazy" />`;
}

function CircleReply(reply) {
  return `
    <article class="circle-reply">
      ${CircleAvatar(reply.name, reply.avatar)}
      <div>
        <strong>${escapeHtml(reply.name)}</strong>
        <p>${escapeHtml(reply.text)}</p>
      </div>
    </article>
  `;
}

function CirclePostCard(post) {
  const visibleReplies = post.replies.slice(0, 3);
  const hiddenReplyCount = post.replies.length - visibleReplies.length;
  return `
    <article class="circle-post-card">
      <div class="circle-post-head">
        ${CircleAvatar(post.author.name, post.author.avatar)}
        <div class="circle-post-meta">
          <strong>${escapeHtml(post.author.name)}</strong>
          <small>回复于 ${escapeHtml(post.time)}</small>
        </div>
        <span>${escapeHtml(post.category)}</span>
      </div>
      <h2 class="circle-post-title">${escapeHtml(post.title)}</h2>
      <p class="circle-post-content">${escapeHtml(post.content)}</p>
      <div class="circle-post-stats" aria-label="帖子互动">
        <span>分享</span>
        <span>回复 ${post.replies.length}</span>
        <span>赞 ${post.tags.length + post.replies.length}</span>
      </div>
      <div class="circle-replies">
        ${visibleReplies.map(CircleReply).join("")}
        ${hiddenReplyCount > 0 ? `<small>还有 ${hiddenReplyCount} 条回复</small>` : ""}
      </div>
      <div class="circle-reply-form">
        <input type="text" data-circle-reply-input="${post.id}" placeholder="回复 ${escapeHtml(post.author.name)} 或加入讨论" />
        <button type="button" class="small-action" data-reply-circle-post="${post.id}">回复</button>
      </div>
    </article>
  `;
}

function renderCircleBbs() {
  const visiblePosts = showAllCirclePosts ? data.circlePosts : data.circlePosts.slice(0, 6);
  $("#screen-circle").innerHTML = `
    <header class="simple-header circle-header">
      <div>
        <p>邻里动态</p>
        <h1>社区 BBS</h1>
      </div>
      <button type="button" data-action="toggle-circle-posts">${showAllCirclePosts ? "收起" : "查看更多"}</button>
    </header>
    <section class="circle-composer">
      <div>
        <strong>发一条非交易动态</strong>
        <p>约跑步、骑行搭子、闲置赠送、美食交流、居住环境讨论都可以。</p>
      </div>
      <textarea id="circlePostInput" rows="3" placeholder="今天想和邻居聊点什么？"></textarea>
      <button type="button" class="primary-action" id="circlePublish">发布帖子</button>
    </section>
    <section class="circle-bbs-list">
      ${visiblePosts.map(CirclePostCard).join("")}
    </section>
    ${
      data.circlePosts.length > 6
        ? `<button type="button" class="circle-more-button" data-action="toggle-circle-posts">${showAllCirclePosts ? "收起帖子" : `查看更多，展开全部 ${data.circlePosts.length} 条`}</button>`
        : ""
    }
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
                ${EscrowPanel(order)}
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

function EscrowPanel(order) {
  const chain = order.chain;
  if (!chain) {
    return `
      <section class="escrow-panel">
        <div><strong>NeighborTrust 托管</strong><span>Monad Testnet · 0.01 Test MON</span></div>
        <p>链上只保存任务摘要哈希和资金状态，住址、电话与聊天内容仍留在本地。</p>
        <button type="button" class="escrow-action" data-create-escrow="${order.id}">创建链上托管</button>
      </section>
    `;
  }

  const progress = chain.phase ? window.NeighborWeb3.finalityLabel(chain.phase) : "等待确认";
  const actionByStatus = {
    0: `<button type="button" data-escrow-action="acceptTask" data-order-id="${order.id}">邻居接单</button><button type="button" data-escrow-action="cancelTask" data-order-id="${order.id}">取消并退款</button>`,
    1: `<button type="button" data-escrow-action="markCompleted" data-order-id="${order.id}">提交完成</button><button type="button" data-escrow-action="raiseDispute" data-order-id="${order.id}">发起争议</button>`,
    2: `<button type="button" data-escrow-action="approveAndRelease" data-order-id="${order.id}">验收并放款</button><button type="button" data-escrow-action="raiseDispute" data-order-id="${order.id}">冻结争议</button>`,
  };
  return `
    <section class="escrow-panel active">
      <div><strong>${chain.statusText || "等待接单"}</strong><span>Monad Testnet</span></div>
      <p class="chain-progress"><i class="${chain.phase || "submitted"}"></i>${progress}${chain.message ? ` · ${chain.message}` : ""}</p>
      <div class="escrow-actions">${actionByStatus[chain.status] || ""}</div>
      ${chain.hash ? `<a href="${chain.explorerUrl}" target="_blank" rel="noreferrer">在 Monad 浏览器查看交易</a>` : ""}
    </section>
  `;
}

async function getWeb3Client() {
  if (web3Client) return web3Client;
  if (!window.ethereum) throw new Error("Wallet not installed");
  if (!window.ethers || !window.NeighborWeb3 || !window.NB_WEB3_CONFIG) throw new Error("Web3 unavailable");
  web3Artifact ||= await fetch(window.NB_WEB3_CONFIG.artifactUrl).then((response) => {
    if (!response.ok) throw new Error("Artifact unavailable");
    return response.json();
  });
  web3Client = window.NeighborWeb3.createClient({
    ethereum: window.ethereum,
    ethers: window.ethers,
    config: window.NB_WEB3_CONFIG,
    artifact: web3Artifact,
    onProgress(phase, hash) {
      walletState.phase = phase;
      const order = orders.find((item) => item.id === activeEscrowOrderId);
      if (order?.chain) {
        order.chain.phase = phase;
        order.chain.hash = hash;
        order.chain.explorerUrl = web3Client.transactionUrl(hash);
        renderMessages();
      }
    },
  });
  return web3Client;
}

async function connectMonadWallet() {
  walletState.phase = "connecting";
  walletState.message = "";
  renderHome();
  try {
    const client = await getWeb3Client();
    const result = await client.connect();
    walletState.account = result.account;
    walletState.balance = Number(result.balanceFormatted).toFixed(3);
    walletState.phase = "connected";
  } catch (error) {
    walletState.phase = "error";
    walletState.message = error.message === "Wallet not installed"
      ? "请先安装 MetaMask 或其他 EVM 钱包。"
      : window.NeighborWeb3?.normalizeWalletError(error) || "钱包连接失败。";
    window.alert(walletState.message);
  }
  renderHome();
}

async function createEscrowForOrder(orderId) {
  const order = orders.find((item) => item.id === orderId);
  if (!order) return;
  activeEscrowOrderId = orderId;
  try {
    const client = await getWeb3Client();
    if (!walletState.account) await connectMonadWallet();
    if (!walletState.account) return;
    order.chain = { status: 0, statusText: "等待接单", phase: "submitted", message: "请在钱包中确认" };
    renderMessages();
    const result = await client.createTask({
      title: order.title,
      time: "待协商",
      place: "小区公共区域",
      budget: 0.01,
    }, "0.01");
    order.chain = {
      ...order.chain,
      taskId: result.taskId,
      hash: result.hash,
      phase: result.finality,
      status: 0,
      statusText: "等待接单",
      explorerUrl: client.transactionUrl(result.hash),
      message: "0.01 Test MON 已锁定",
    };
  } catch (error) {
    order.chain = null;
    window.alert(window.NeighborWeb3.normalizeWalletError(error));
  } finally {
    activeEscrowOrderId = null;
    renderMessages();
  }
}

async function runEscrowAction(orderId, method) {
  const order = orders.find((item) => item.id === orderId);
  if (!order?.chain?.taskId) return;
  activeEscrowOrderId = orderId;
  try {
    const client = await getWeb3Client();
    const result = await client[method](order.chain.taskId);
    const task = await client.readTask(order.chain.taskId);
    Object.assign(order.chain, {
      hash: result.hash,
      phase: result.finality,
      status: task.status,
      statusText: task.statusText,
      explorerUrl: client.transactionUrl(result.hash),
      message: "链上状态已同步",
    });
  } catch (error) {
    window.alert(window.NeighborWeb3.normalizeWalletError(error));
  } finally {
    activeEscrowOrderId = null;
    renderMessages();
  }
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

function CreditProofButton(action, forceIdentity = false) {
  const proofAttribute = forceIdentity ? 'data-proof-type="identity"' : `data-proof-type="${action.id}"`;
  return `
    <button class="verification-card" type="button" ${proofAttribute}>
      <span>${action.tag}</span>
      <strong>${action.title}</strong>
      <small>${action.desc}</small>
      <em>${action.score}</em>
    </button>
  `;
}

function CreditRankingSection() {
  const ranking = showFullCreditRanking ? data.creditRanking : data.creditRanking.slice(0, 5);
  return `
    <section class="credit-ranking-card">
      <div class="section-head">
        <h2>本小区信用分排行</h2>
        <button type="button" data-action="toggle-credit-ranking">${showFullCreditRanking ? "收起" : "查看更多"} &gt;</button>
      </div>
      <div class="credit-ranking-list">
        ${ranking
          .map(
            (item) => `
              <article class="${item.name === profileState.name ? "is-me" : ""}">
                <img class="ranking-avatar" src="${item.avatar}" alt="${item.name}的头像" loading="lazy" />
                <div>
                  <strong>${item.name}</strong>
                  <small>${item.label}</small>
                </div>
                <em>${item.score}</em>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderProfile() {
  const profile = data.creditProfile;
  const identityAction = data.creditProofActions.find((item) => item.id === "identity") || data.creditProofActions[0];
  const otherProofActions = data.creditProofActions.filter((item) => item.id !== "identity");
  $("#screen-profile").innerHTML = `
    <header class="simple-header">
      <div>
        <p>我的邻里帮</p>
        <h1>${data.user.community} · ${profileState.name}</h1>
      </div>
    </header>
    <section class="profile-card">
      <div class="profile-credit-panel">
        <button class="profile-photo-upload" type="button" data-action="upload-profile-photo" aria-label="上传个人照片">
          ${AvatarContent("profile-photo-image")}
          <small>上传个人照片</small>
        </button>
        <div class="profile-score">${data.user.credit}</div>
      </div>
      <div>
        <h2>${profile.level} · ${profile.title}</h2>
        <p>${profile.summary}</p>
        <div class="profile-action-row">
          <button class="small-action credit-rule-trigger" type="button" data-action="open-credit-rules">查看信用分说明</button>
        </div>
      </div>
    </section>
    <section class="credit-status-grid" aria-label="信用与安全权限">
      ${profile.metrics.map((item) => `<div><span>${item.label}</span><strong>${item.value}</strong><small>${item.note}</small></div>`).join("")}
    </section>
    <section class="profile-verification-card">
      <div class="section-head">
        <h2>认证资料与加分动作</h2>
        <button type="button" data-action="open-credit-rules">规则</button>
      </div>
      <div class="profile-verification-grid">
        ${CreditProofButton(identityAction, true)}
        ${otherProofActions.map((action) => CreditProofButton(action)).join("")}
      </div>
      ${
        creditProofResult
          ? `<div class="credit-proof-result"><strong>${creditProofResult.title}</strong><p>${creditProofResult.message}</p></div>`
          : `<p class="credit-proof-hint">上传后系统会根据材料类型生成预计加分动作，涉及实名、人脸、无犯罪记录和高风险权限的材料需人工复核后生效。</p>`
      }
    </section>
    ${CreditRankingSection()}
  `;
}

function renderHighRiskRules() {
  return `
    <section class="high-risk-rule-grid" aria-label="高风险服务规则">
      <div class="high-risk-rule-head">
        <span>高风险权限</span>
        <h3>接孩子、老人陪护、遛宠、上门维修</h3>
        <p>这些规则挂在信用分说明中，用来决定谁可以接高风险服务，以及发生纠纷时如何留痕、预警和追责。</p>
      </div>
      ${data.highRiskServiceRules
        .map(
          (rule) => `
            <article class="high-risk-rule-card">
              <div>
                <strong>${escapeHtml(rule.title)}</strong>
                <span>${escapeHtml(rule.level)}</span>
              </div>
              <ul>
                ${rule.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}
              </ul>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderCreditRuleSheet() {
  $("#creditRuleBody").innerHTML = `
    <div class="credit-rule-summary">
      <strong>信用分不是装饰分，而是邻里服务的风控准入。</strong>
      <p>需求方可以优先选择高信用、强实名、持证、熟人背书多、履约记录好的邻居；平台也会用它来限制接孩子、老人陪护、遛宠、上门维修等高风险场景。</p>
    </div>
    ${data.creditRules
      .map(
        (section) => `
          <article class="credit-rule-block">
            <h3>${section.title}</h3>
            <ul>
              ${section.points.map((point) => `<li>${point}</li>`).join("")}
            </ul>
          </article>
        `,
      )
      .join("")}
    ${renderHighRiskRules()}
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
    <section class="assistant-page-shell">
      <header class="assistant-hero-header">
        <div>
          <p>AI 助手</p>
          <h1>说一句话，匹配顺路互助</h1>
          <span>你可以直接和我说：我今天去中通快递站，有没有邻居要带快递的。我会先帮你匹配附近求助，再问你要不要发帖。</span>
        </div>
        <button type="button" data-action="open-ai-compose">发布</button>
      </header>
      <section class="assistant-example-row" aria-label="AI 示例句">
        <button type="button" data-assistant-example="我今天去中通快递站，有没有邻居要带快递的">顺路带快递</button>
        <button type="button" data-assistant-example="今晚 6 点前谁能帮我取一个快递到 6 栋门口">找人帮取件</button>
        <button type="button" data-assistant-example="周六上午想借一把电钻装窗帘">借工具</button>
      </section>
      <section class="assistant-workspace">
        <div class="assistant-conversation-panel">
          <section class="assistant-chat" id="assistantChatLog">
            ${assistantMessages.map(AssistantBubble).join("")}
          </section>
          ${voiceStatusText ? `<p class="voice-status ${isRecordingVoice ? "listening" : ""}">${voiceStatusText}</p>` : ""}
          <section class="assistant-composer">
            <button type="button" class="voice-action ${isRecordingVoice ? "recording" : ""}" id="assistantVoice" aria-label="${isRecordingVoice ? "停止语音输入" : "语音输入"}" title="${isRecordingVoice ? "停止语音输入" : "语音输入"}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/><path d="M8 22h8"/></svg>
              <span>${isRecordingVoice ? "松开发送" : "按住说"}</span>
            </button>
            <input id="assistantInput" type="text" placeholder="例如：我今天去菜鸟驿站" />
            <button type="button" class="primary-action" id="assistantSend">发送</button>
          </section>
        </div>
        <section class="assistant-suggestions" id="assistantSuggestions">
          ${pendingAssistantPost ? AssistantPublishCard(pendingAssistantPost) : ""}
          ${assistantHelpers.map(AssistantHelperCard).join("")}
          ${assistantSuggestions.map(AssistantHelpCard).join("")}
          ${!pendingAssistantPost && !assistantHelpers.length && !assistantSuggestions.length ? AssistantEmptyState() : ""}
        </section>
      </section>
    </section>
  `;
}

function AssistantEmptyState() {
  return `
    <article class="assistant-empty-card">
      <strong>先说一句自然语言</strong>
      <p>AI 会判断你是在提供顺路帮助，还是需要邻居帮忙，再匹配附近帖子、邻居和可发布内容。</p>
    </article>
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

function assistantSourceNote(result) {
  if (result.source === "model") return "";
  if (result.modelError) return `（当前使用本地规则：模型接口返回 ${result.modelError}）`;
  return "（当前使用本地规则：未连接大模型）";
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
    assistantMessages.push({ role: "assistant", text: `${result.reply || "我整理好了。"} ${targetText}。要不要我帮你发一条帖子，让邻居在发现里看到？${assistantSourceNote(result)}` });
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

function startAssistantVoice() {
  if (isRecordingVoice || voiceRecognition) return;
  isPressingVoice = true;
  voiceStopRequested = false;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    voiceStatusText = "当前浏览器暂不支持语音输入";
    assistantMessages.push({ role: "assistant", text: "当前浏览器不支持内置语音识别，请用 Chrome 或 Edge 打开，或直接打字发送。" });
    renderAssistant();
    return;
  }
  voiceRecognition = new Recognition();
  voiceRecognition.lang = "zh-CN";
  voiceRecognition.interimResults = true;
  voiceRecognition.continuous = true;
  voiceRecognition.lastTranscript = "";
  voiceRecognition.addEventListener("start", () => {
    isRecordingVoice = true;
    voiceStatusText = "按住说话，松开后发送...";
    renderAssistant();
  });
  voiceRecognition.addEventListener("audiostart", () => {
    voiceStatusText = "麦克风已接入，按住继续说...";
    renderAssistant();
  });
  voiceRecognition.addEventListener("speechstart", () => {
    voiceStatusText = "听到你说话了，松开后发送...";
    renderAssistant();
  });
  voiceRecognition.addEventListener("result", (event) => {
    const transcript = Array.from(event.results, (result) => result[0]?.transcript || "")
      .join("")
      .trim();
    if (!transcript) return;
    voiceRecognition.lastTranscript = transcript;
    voiceStatusText = `已识别：${transcript}（松开发送）`;
    renderAssistant();
  });
  voiceRecognition.addEventListener("error", (event) => {
    const messages = {
      "not-allowed": "浏览器没有拿到麦克风权限，请在地址栏左侧允许麦克风后再试。",
      "service-not-allowed": "浏览器语音服务被禁用，请换 Chrome 或 Edge 再试。",
      "audio-capture": "没有找到可用麦克风，请检查系统输入设备。",
      "no-speech": "没有听到语音，请靠近麦克风再说一遍。",
      network: "浏览器语音识别服务网络失败，可以直接打字发送。",
      aborted: "语音输入已停止。",
    };
    const message = messages[event.error] || `语音没有识别成功，错误：${event.error || "unknown"}`;
    if (event.error !== "aborted" || !voiceStopRequested) assistantMessages.push({ role: "assistant", text: message });
    voiceStatusText = "语音输入已结束";
    isRecordingVoice = false;
    isPressingVoice = false;
    voiceRecognition = null;
    renderAssistant();
  });
  voiceRecognition.addEventListener("end", () => {
    const transcript = voiceRecognition?.lastTranscript?.trim() || "";
    isRecordingVoice = false;
    isPressingVoice = false;
    voiceRecognition = null;
    if (transcript) {
      voiceStatusText = `已发送语音文字：${transcript}`;
      sendAssistantMessage(transcript);
      return;
    }
    voiceStatusText = voiceStopRequested ? "没有听清，可以长按再说一次" : voiceStatusText;
    renderAssistant();
  });
  try {
    voiceStatusText = "正在唤起麦克风...";
    isRecordingVoice = true;
    voiceRecognition.start();
    renderAssistant();
  } catch {
    voiceStatusText = "语音输入启动失败";
    assistantMessages.push({ role: "assistant", text: "语音输入没有启动成功，请确认浏览器允许麦克风权限，或直接打字发送。" });
    isRecordingVoice = false;
    isPressingVoice = false;
    voiceRecognition = null;
    renderAssistant();
  }
}

function stopAssistantVoice() {
  if (!voiceRecognition) return;
  voiceStopRequested = true;
  voiceStatusText = "正在整理刚才听到的内容...";
  try {
    voiceRecognition.stop();
  } catch {
    voiceRecognition.abort();
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
  renderHome();
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
  if (
    !$("#profileSheet").classList.contains("open") &&
    !$("#creditRuleSheet").classList.contains("open") &&
    !$("#errandRuleSheet").classList.contains("open")
  ) {
    $("#sheetBackdrop").classList.remove("open");
  }
}

function openProfileEditor() {
  $("#profileNameInput").value = profileState.name;
  updateProfilePreview();
  $("#profileSheet").classList.add("open");
  $("#sheetBackdrop").classList.add("open");
}

function closeProfileEditor() {
  $("#profileSheet").classList.remove("open");
  if (
    !$("#composeSheet").classList.contains("open") &&
    !$("#creditRuleSheet").classList.contains("open") &&
    !$("#errandRuleSheet").classList.contains("open")
  ) {
    $("#sheetBackdrop").classList.remove("open");
  }
}

function openCreditRules() {
  renderCreditRuleSheet();
  $("#creditRuleSheet").classList.add("open");
  $("#sheetBackdrop").classList.add("open");
}

function closeCreditRules() {
  $("#creditRuleSheet").classList.remove("open");
  if (
    !$("#composeSheet").classList.contains("open") &&
    !$("#profileSheet").classList.contains("open") &&
    !$("#errandRuleSheet").classList.contains("open")
  ) {
    $("#sheetBackdrop").classList.remove("open");
  }
}

function openErrandRules() {
  renderErrandRuleSheet();
  $("#errandRuleSheet").classList.add("open");
  $("#sheetBackdrop").classList.add("open");
}

function closeErrandRules() {
  $("#errandRuleSheet").classList.remove("open");
  if (
    !$("#composeSheet").classList.contains("open") &&
    !$("#profileSheet").classList.contains("open") &&
    !$("#creditRuleSheet").classList.contains("open")
  ) {
    $("#sheetBackdrop").classList.remove("open");
  }
}

function updateProfilePreview() {
  const preview = $("#profileAvatarPreview");
  if (!preview) return;
  preview.innerHTML = profileState.avatar
    ? `<img src="${profileState.avatar}" alt="${profileState.name}的头像预览" ${avatarPositionStyle()} />`
    : profileState.name.slice(0, 1);
}

function refreshProfileViews() {
  renderHome();
  renderAssistant();
  renderProfile();
  showScreen(activeScreen, false);
}

function clampAvatarPosition(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function updateAvatarPositionViews() {
  const position = profileState.avatarPosition || { x: 50, y: 50 };
  $$(".avatar-image, .profile-photo-image, .avatar-upload-preview img, #profileAvatarPreview img").forEach((image) => {
    image.style.setProperty("--avatar-position", `${position.x}% ${position.y}%`);
    image.style.objectPosition = `${position.x}% ${position.y}%`;
  });
  localStorage.setItem(profileStorageKey, JSON.stringify(profileState));
}

function startAvatarDrag(event, target) {
  if (!profileState.avatar) return;
  const rect = target.getBoundingClientRect();
  avatarDragState = {
    target,
    startX: event.clientX,
    startY: event.clientY,
    startPosition: { ...(profileState.avatarPosition || { x: 50, y: 50 }) },
    width: rect.width || 1,
    height: rect.height || 1,
    didDrag: false,
  };
  target.setPointerCapture?.(event.pointerId);
}

function handleAvatarDragMove(event) {
  if (!avatarDragState) return;
  const dx = event.clientX - avatarDragState.startX;
  const dy = event.clientY - avatarDragState.startY;
  avatarDragState.didDrag = avatarDragState.didDrag || Math.abs(dx) + Math.abs(dy) > 3;
  profileState.avatarPosition = {
    x: clampAvatarPosition(avatarDragState.startPosition.x + (dx / avatarDragState.width) * 50),
    y: clampAvatarPosition(avatarDragState.startPosition.y + (dy / avatarDragState.height) * 50),
  };
  updateAvatarPositionViews();
}

function endAvatarDrag() {
  if (!avatarDragState) return;
  suppressNextAvatarUploadClick = avatarDragState.didDrag;
  avatarDragState = null;
}

function handleCreditProofUpload(file) {
  const action = data.creditProofActions.find((item) => item.id === activeProofType) || data.creditProofActions[0];
  if (!file || !action) return;
  creditProofResult = {
    title: `${action.tag} · 已生成加分动作`,
    message: `系统已接收「${escapeHtml(file.name)}」，识别为${action.title}材料，预计信用加分 ${action.score}。涉及实名、人脸、无犯罪记录或高风险权限的材料会进入人工复核。`,
  };
  renderProfile();
  showScreen("profile", false);
}

function currentCircleAvatar() {
  return profileState.avatar || "assets/avatars/resident-man.png";
}

function publishCirclePost() {
  const input = $("#circlePostInput");
  const content = input?.value.trim();
  if (!content) return;
  data.circlePosts.unshift({
    id: `bbs-user-${Date.now()}`,
    category: "新帖",
    title: content.length > 24 ? `${content.slice(0, 24)}...` : content,
    content,
    time: "刚刚",
    author: { name: profileState.name, avatar: currentCircleAvatar() },
    tags: ["邻里讨论", "新鲜事"],
    replies: [],
  });
  showAllCirclePosts = true;
  renderCircleBbs();
  showScreen("circle", false);
}

function replyCirclePost(postId) {
  const input = document.querySelector(`[data-circle-reply-input="${postId}"]`);
  const text = input?.value.trim();
  if (!text) return;
  const post = data.circlePosts.find((item) => item.id === postId);
  if (!post) return;
  post.replies.push({
    name: profileState.name,
    avatar: currentCircleAvatar(),
    text,
  });
  renderCircleBbs();
  showScreen("circle", false);
}

function placeErrandOrder() {
  const service = selectedErrandService();
  const contact = $("#errandContact")?.value.trim() || "待补充联系人";
  const phone = $("#errandPhone")?.value.trim() || "待补充手机号";
  const address = $("#errandAddress")?.value.trim() || "待补充地址";
  const time = $("#errandTime")?.value.trim() || "待补充时间";
  const note = $("#errandNote")?.value.trim() || service.note;
  createOrderFromTask({
    title: service.title,
    desc: `${service.price} · ${contact} · ${phone} · ${address} · ${time} · ${note}`,
    category: "ask",
    safetyPlan: riskPolicies.low_risk,
  });
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
    budget: task.budget || 0,
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
    if (button.id === "closeCreditRules") closeCreditRules();
    if (button.id === "closeErrandRules") closeErrandRules();
    if (button.id === "chooseAvatar") $("#avatarInput").click();
    if (button.id === "saveProfile") {
      saveProfileState({ name: $("#profileNameInput").value, avatar: profileState.avatar });
      closeProfileEditor();
      refreshProfileViews();
    }
    if (button.dataset.proofType) {
      activeProofType = button.dataset.proofType;
      $("#creditProofInput").click();
      return;
    }
    if (button.id === "mobileParse") {
      if (composeMode === "agent") {
        publishAgentTask();
      } else {
        publishManualPost();
      }
    }
    if (button.id === "circlePublish") publishCirclePost();
    if (button.id === "errandOrderSubmit") placeErrandOrder();
    if (button.id === "assistantSend") sendAssistantMessage($("#assistantInput").value);
    if (button.id === "assistantVoice") return;
    if (button.id === "privateChatSend") sendPrivateChat();
    if (button.dataset.createEscrow) createEscrowForOrder(button.dataset.createEscrow);
    if (button.dataset.escrowAction) runEscrowAction(button.dataset.orderId, button.dataset.escrowAction);

    if (button.dataset.assistantExample) {
      const input = $("#assistantInput");
      if (input) {
        input.value = button.dataset.assistantExample;
        input.focus();
      }
      return;
    }

    const quickId = button.dataset.quickId;
    if (quickId) {
      const item = data.quickActions.find((entry) => entry.id === quickId);
      if (item?.compose) openCompose();
      if (item?.target) showScreen(item.target);
    }

    const action = button.dataset.action;
    if (action === "edit-profile") openProfileEditor();
    if (action === "connect-wallet") connectMonadWallet();
    if (action === "upload-profile-photo") {
      if (suppressNextAvatarUploadClick) {
        suppressNextAvatarUploadClick = false;
        return;
      }
      $("#avatarInput").click();
    }
    if (action === "open-credit-rules") openCreditRules();
    if (action === "back-home") showScreen("home");
    if (action === "show-errand-rule") openErrandRules();
    if (action === "toggle-circle-posts") {
      showAllCirclePosts = !showAllCirclePosts;
      renderCircleBbs();
      showScreen("circle", false);
    }
    if (action === "toggle-credit-ranking") {
      showFullCreditRanking = !showFullCreditRanking;
      renderProfile();
    }
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
    if (button.dataset.errandServiceId) {
      selectedErrandServiceId = button.dataset.errandServiceId;
      renderErrandServices();
      renderErrandRuleSheet();
      showScreen("errand", false);
    }
    if (button.dataset.replyCirclePost) replyCirclePost(button.dataset.replyCirclePost);
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

  document.body.addEventListener("pointerdown", (event) => {
    const target = event.target.closest(".profile-photo-upload");
    if (!target) return;
    startAvatarDrag(event, target);
  });

  document.body.addEventListener("pointerdown", (event) => {
    const button = event.target.closest("#assistantVoice");
    if (!button) return;
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    startAssistantVoice();
  });

  document.body.addEventListener("pointerup", (event) => {
    const button = event.target.closest("#assistantVoice");
    if (!button && !isPressingVoice) return;
    event.preventDefault();
    stopAssistantVoice();
  });

  document.body.addEventListener("pointercancel", () => {
    if (isPressingVoice) stopAssistantVoice();
  });

  document.body.addEventListener("pointermove", handleAvatarDragMove);
  document.body.addEventListener("pointerup", endAvatarDrag);
  document.body.addEventListener("pointercancel", endAvatarDrag);

  $("#sheetBackdrop").addEventListener("click", () => {
    closeCompose();
    closeProfileEditor();
    closeCreditRules();
    closeErrandRules();
  });

  $("#avatarInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      profileState.avatar = String(reader.result || "");
      profileState.avatarPosition = { x: 50, y: 50 };
      updateProfilePreview();
      refreshProfileViews();
    });
    reader.readAsDataURL(file);
  });

  $("#creditProofInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    handleCreditProofUpload(file);
    event.target.value = "";
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
  renderErrandServices();
  renderCircleBbs();
  renderDiscover();
  renderMessages();
  renderProfile();
  renderCreditRuleSheet();
  renderErrandRuleSheet();
  initPresets();
  bindEvents();
}

init();
