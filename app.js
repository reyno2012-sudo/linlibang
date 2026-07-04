const users = [
  {
    id: "u-101",
    name: "王启明",
    role: "社区志愿者",
    building: "3 栋",
    distance: 80,
    verified: ["实名", "活体", "同小区"],
    skills: ["跑腿", "小型搬运", "工具借还"],
    rating: 4.9,
    completed: 23,
    complaint: 0,
    avgResponse: 3,
    baseQuote: 10,
    credit: 96,
  },
  {
    id: "u-102",
    name: "林小禾",
    role: "物业认证服务者",
    building: "5 栋",
    distance: 220,
    verified: ["实名", "同小区", "物业认证"],
    skills: ["跑腿", "工具借还"],
    rating: 4.8,
    completed: 41,
    complaint: 1,
    avgResponse: 6,
    baseQuote: 12,
    credit: 93,
  },
  {
    id: "u-103",
    name: "陈海",
    role: "社区达人",
    building: "1 栋",
    distance: 410,
    verified: ["实名", "同小区"],
    skills: ["小型搬运", "工具借还"],
    rating: 4.7,
    completed: 17,
    complaint: 0,
    avgResponse: 9,
    baseQuote: 16,
    credit: 90,
  },
  {
    id: "u-104",
    name: "周南",
    role: "机构认证服务者",
    building: "社区服务站",
    distance: 680,
    verified: ["实名", "活体", "机构认证"],
    skills: ["陪诊", "关怀调度"],
    rating: 4.9,
    completed: 36,
    complaint: 0,
    avgResponse: 8,
    baseQuote: 100,
    credit: 98,
  },
];

const tools = [
  {
    id: "tool-1",
    name: "博世电钻",
    owner: "物业工具柜",
    building: "物业中心",
    availability: "今天 18:00-22:00",
    price: "免费借用",
    deposit: "信用分 85+ 免押",
    status: "可借",
    icon: "钻",
  },
  {
    id: "tool-2",
    name: "小推车",
    owner: "3 栋管家",
    building: "3 栋大厅",
    availability: "全天",
    price: "2 小时内免费",
    deposit: "逾期需登记",
    status: "可借",
    icon: "车",
  },
  {
    id: "tool-3",
    name: "折叠梯",
    owner: "林小禾",
    building: "5 栋",
    availability: "明天 9:00 后",
    price: "5 元/次",
    deposit: "需实名",
    status: "需确认",
    icon: "梯",
  },
  {
    id: "tool-4",
    name: "工具箱",
    owner: "社区维修间",
    building: "物业中心",
    availability: "工作日 9:00-18:00",
    price: "免费",
    deposit: "物业见证",
    status: "可借",
    icon: "箱",
  },
];

const orders = [];
let currentTask = null;
let selectedCandidate = null;
let desktopAssistantMessages = [
  { role: "assistant", text: "可以直接告诉我你的顺路计划，比如：我今天去中通快递站，有没有邻居要带快递的。" },
];
let desktopAssistantSuggestions = [];
let desktopAssistantHelpers = [];
let desktopPendingPost = null;
let desktopDiscoverMode = "hot";
let desktopDiscoverCategory = "ask";
let desktopDiscoverSearch = "";
const desktopPosts = [
  { id: "seed-1", title: "傍晚散步局", text: "今天 19:30，梧桐步道慢走 30 分钟。", count: "5人感兴趣", author: "阿树", time: "刚刚", heat: 88, category: "offer" },
  { id: "seed-2", title: "共享工具角", text: "小推车、折叠梯、打气筒今天可借。", count: "4件可用", author: "物业工具柜", time: "1小时前", heat: 76, category: "offer" },
  { id: "seed-3", title: "邻里问答", text: "谁知道 2 栋快递柜临时密码怎么查？", count: "8条回复", author: "安安", time: "2小时前", heat: 65, category: "ask" },
];

const orderSteps = ["待确认", "已接单", "服务中", "待验收", "已完成", "争议中"];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function parseTask(text) {
  const normalized = text.trim();
  const isTool = /借|电钻|梯|推车|工具|轮椅|拐杖/.test(normalized);
  const isMedical = /陪诊|医院|挂号|老人|妈妈|儿童|钥匙|门禁|医疗/.test(normalized);
  const isMoving = /搬|收纳箱|搬运/.test(normalized);
  const serviceTag = isMedical ? "陪诊调度" : isTool ? "工具借用" : isMoving ? "小型搬运" : "代取快递";
  const priceMatch = normalized.match(/(\d+)\s*元/);
  const budget = priceMatch ? Number(priceMatch[1]) : isMedical ? 100 : isTool ? 0 : 10;
  const timeMatch = normalized.match(/(今晚|今天|明天|周[一二三四五六日天]|上午|下午|晚上|[\d]{1,2}\s*点[^，。]*)/);
  const locationMatch = normalized.match(/([1-9]\s*栋|小区门口|同楼栋|同小区|物业中心|楼下)/g);
  const riskLevel = isMedical ? "红色 - 高风险" : isMoving ? "绿色 - 低风险" : "绿色 - 低风险";
  const missing = [];

  if (!/是否|需要|上楼|代垫|重量|多久|半小时/.test(normalized) && !isTool) {
    missing.push("是否需要代垫、是否需要送上楼、物品是否较重");
  }

  if (isTool && !/还|归还|半小时|小时|明天/.test(normalized)) {
    missing.push("预计归还时间");
  }

  return {
    id: `task-${Date.now()}`,
    raw: normalized,
    serviceTag,
    description: normalized,
    time: timeMatch ? timeMatch[0].replace(/\s+/g, "") : "今天内",
    location: locationMatch ? Array.from(new Set(locationMatch)).join(" / ").replace(/\s+/g, "") : "同小区",
    budget,
    negotiable: /议价|以内|预算|元/.test(normalized),
    riskLevel,
    authRule: isMedical ? "仅机构认证服务者可接单" : "手机号 + 同小区认证优先",
    evidenceRule: isTool ? "取还双方确认 + 到期提醒" : "送达拍照 + 需求方确认",
    missing,
    type: isTool ? "tool" : isMedical ? "high-risk" : "service",
  };
}

function suggestPrice(task) {
  const table = {
    "代取快递": [8, 15],
    "小型搬运": [18, 35],
    "工具借用": [0, 8],
    "陪诊调度": [80, 160],
  };
  const [low, high] = table[task.serviceTag] || [10, 30];
  const note =
    task.budget < low
      ? `期望价低于参考区间 ${low}-${high} 元，可能需要解释任务很简单或允许议价。`
      : task.budget > high
        ? `期望价高于参考区间 ${low}-${high} 元，可更快获得响应。`
        : `期望价位于参考区间 ${low}-${high} 元内。`;

  return { low, high, note };
}

function rankWorkers(task) {
  return users
    .filter((user) => {
      if (task.type === "high-risk") return user.verified.includes("机构认证");
      if (task.type === "tool") return user.skills.includes("工具借还");
      return user.skills.includes(task.serviceTag) || user.skills.includes("跑腿");
    })
    .map((user) => {
      const distanceScore = Math.max(0, 25 - user.distance / 40);
      const authScore = Math.min(20, user.verified.length * 6.5);
      const quoteScore = Math.max(0, 20 - Math.abs(user.baseQuote - task.budget) * 1.8);
      const skillScore = user.skills.includes(task.serviceTag) ? 15 : 10;
      const creditScore = Math.min(15, user.credit / 7);
      const responseScore = Math.max(1, 6 - user.avgResponse / 3);
      const score = Math.round(distanceScore + authScore + quoteScore + skillScore + creditScore + responseScore);
      const quote = task.type === "tool" ? 0 : Math.max(user.baseQuote, Math.round(task.budget || user.baseQuote));

      return {
        ...user,
        quote,
        score,
        reason: `${user.building}，距离约 ${user.distance} 米；${user.verified.join("、")}；完成 ${user.completed} 单，评分 ${user.rating}，近 30 天投诉 ${user.complaint} 次。`,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function createOrder(task, candidate, source = "task") {
  const order = {
    id: `NB-${String(orders.length + 1).padStart(4, "0")}`,
    task,
    candidate,
    source,
    price: source === "tool" ? task.budget : candidate.quote,
    statusIndex: 0,
    createdAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    evidence: [],
  };
  orders.unshift(order);
  renderOrders();
  return order;
}

function addLog(entries) {
  const log = $("#agentLog");
  log.className = "agent-log";
  log.innerHTML = "";
  entries.forEach(([tool, text]) => {
    const item = document.importNode($("#logItemTemplate").content, true);
    item.querySelector("span").textContent = tool;
    item.querySelector("p").textContent = text;
    log.appendChild(item);
  });
}

function getAssistantAdvice(task, priceAdvice, matches) {
  const questions = [...task.missing];

  if (!/(小区门口|楼下|物业中心|[1-9]\s*栋|同楼栋|同小区)/.test(task.raw)) {
    questions.push("补充取送位置或楼栋范围，方便优先匹配同楼栋服务者");
  }

  if (!/(今晚|今天|明天|周[一二三四五六日天]|上午|下午|晚上|\d{1,2}\s*点)/.test(task.raw)) {
    questions.push("补充期望完成时间，避免候选人响应后再反复确认");
  }

  if (task.type === "tool" && !/(用途|挂画|维修|安装)/.test(task.raw)) {
    questions.push("说明工具用途，便于物主判断是否需要配件或安全提醒");
  }

  if (task.type === "high-risk") {
    questions.push("高风险需求建议说明陪同对象、联系人和紧急情况处理方式");
  }

  const next = matches.length
    ? `可以先解析任务卡，再从 ${matches.length} 位候选人里选择报价和距离最合适的人。`
    : "当前规则下候选人不足，建议补充信息或转给物业人工处理。";

  return {
    questions: questions.length ? Array.from(new Set(questions)).slice(0, 4) : ["描述已经足够清楚，可以直接生成任务卡"],
    next,
    summary: [
      ["识别类型", task.serviceTag],
      ["风险等级", task.riskLevel],
      ["参考价格", `${priceAdvice.low}-${priceAdvice.high} 元`],
      ["可匹配人数", `${matches.length} 人`],
    ],
  };
}

function updateAssistant() {
  const text = $("#requestText").value.trim();
  if (!text) {
    $("#assistantSummary").innerHTML = '<p class="reason">输入需求后，助手会预判类型、风险、价格和补问项。</p>';
    $("#assistantQuestions").innerHTML = "<li>先用一句话说清楚要做什么、在哪里、什么时候完成</li>";
    $("#assistantNext").textContent = "可以从左侧示例开始，也可以直接输入真实需求。";
    return;
  }

  const task = parseTask(text);
  const priceAdvice = suggestPrice(task);
  const matches = rankWorkers(task);
  const advice = getAssistantAdvice(task, priceAdvice, matches);

  $("#assistantSummary").innerHTML = advice.summary
    .map(([label, value]) => `<div class="assistant-metric"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
  $("#assistantQuestions").innerHTML = advice.questions.map((item) => `<li>${item}</li>`).join("");
  $("#assistantNext").textContent = advice.next;
}

function polishRequestText() {
  const task = parseTask($("#requestText").value);
  const additions = [];

  if (task.location === "同小区") additions.push("位置在同小区内");
  if (task.time === "今天内") additions.push("希望今天内完成");
  if (task.missing.length) additions.push(task.missing.join("，"));

  if (!additions.length) {
    updateAssistant();
    return;
  }

  const suffix = `补充：${additions.join("；")}。`;
  $("#requestText").value = `${task.raw.replace(/[。\s]*$/, "")}。${suffix}`;
  updateAssistant();
}

function renderDesktopAssistant() {
  const log = $("#desktopAssistantLog");
  const suggestions = $("#desktopAssistantSuggestions");
  if (!log || !suggestions) return;
  log.innerHTML = desktopAssistantMessages
    .map((message) => `<div class="desktop-chat-bubble ${message.role}"><p>${message.text}</p></div>`)
    .join("");
  suggestions.innerHTML = `
    ${desktopPendingPost ? renderDesktopPublishCard(desktopPendingPost) : ""}
    ${desktopAssistantHelpers.map(renderDesktopHelperCard).join("")}
    ${desktopAssistantSuggestions.map(renderDesktopHelpCard).join("")}
  `;
}

function renderDesktopHelperCard(item) {
  const action = getDesktopHelperAction(item);
  return `
    <article class="desktop-help-card helper">
      <p>${item.helper} · ${item.distance} 米 · 匹配 ${item.score}</p>
      <h3>${item.title}</h3>
      <span>${item.text}</span>
      <div class="action-row">
        <button class="small-button" data-helper-id="${item.id}" data-helper-mode="invite">${action.inviteLabel}</button>
        <button class="small-button" data-helper-id="${item.id}" data-helper-mode="paid">${action.paidLabel}</button>
      </div>
    </article>
  `;
}

function renderDesktopHelpCard(item) {
  const action = getDesktopRequestAction(item);
  return `
    <article class="desktop-help-card">
      <p>${item.requester} · ${item.distance} 米 · 匹配 ${item.score}</p>
      <h3>${item.title}</h3>
      <span>${item.text}</span>
      <div class="action-row">
        <button class="small-button" data-help-id="${item.id}" data-help-mode="free">${action.freeLabel}</button>
        <button class="small-button" data-help-id="${item.id}" data-help-mode="paid">${action.paidLabel}</button>
      </div>
    </article>
  `;
}

function getDesktopHelperAction(item) {
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

function getDesktopRequestAction(item) {
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

function renderDesktopPublishCard(post) {
  return `
    <article class="desktop-publish-card">
      <p>AI 已整理成帖子</p>
      <h3>${post.title}</h3>
      <span>${post.text}</span>
      <button class="primary-button" id="desktopPublishPost">发帖到发现</button>
    </article>
  `;
}

function buildDesktopPost(result, text) {
  const task = result.publishTask || parseTask(text);
  const location = task.location || "小区快递站";
  const isRequest = task.category === "ask" || /^求助/.test(task.serviceTag || "");
  return {
    title: task.serviceTag === "顺路帮取" ? "今天顺路去快递站，可帮邻居带件" : isRequest ? (task.serviceTag || "求助互助").replace("求助", "想请邻居帮忙") : "邻里顺路互助",
    text: task.description || (isRequest ? `想请邻居帮忙从${location}取快递，可以免费或付费协商。` : `我今天会去${location}，如果有邻居需要顺手带快递，可以留言。`),
    count: "等待回应",
    author: "小赵",
    time: "刚刚",
    heat: 99,
    category: isRequest ? "ask" : "offer",
  };
}

async function sendDesktopAssistantMessage() {
  const input = $("#desktopAssistantInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  desktopAssistantMessages.push({ role: "user", text });
  desktopAssistantMessages.push({ role: "assistant", text: "正在匹配附近顺路求助..." });
  renderDesktopAssistant();

  try {
    const response = await fetch("/api/assistant/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    const result = await response.json();
    desktopAssistantMessages.pop();
    desktopAssistantMessages.push({ role: "assistant", text: `${result.reply || "我整理好了，可以看看下面的附近求助。"} 要不要我帮你发一条帖子？` });
    desktopAssistantSuggestions = result.nearbyRequests || [];
    desktopAssistantHelpers = result.nearbyHelpers || [];
    desktopPendingPost = buildDesktopPost(result, text);
  } catch {
    desktopAssistantMessages.pop();
    desktopAssistantMessages.push({ role: "assistant", text: "暂时没连上 AI，我先按本地规则整理成帖子。" });
    desktopAssistantHelpers = [];
    desktopPendingPost = buildDesktopPost({}, text);
  }

  renderDesktopAssistant();
}

function getDesktopDiscoverPosts() {
  const source = desktopPosts.filter((item) => item.category === desktopDiscoverCategory);
  if (desktopDiscoverMode === "latest") return [...source].sort((a, b) => Number(b.id.startsWith("post-")) - Number(a.id.startsWith("post-")) || b.heat - a.heat);
  if (desktopDiscoverMode === "search") {
    const keyword = desktopDiscoverSearch.trim();
    if (!keyword) return source;
    return source.filter((item) => `${item.title}${item.text}${item.author}`.includes(keyword));
  }
  return [...source].sort((a, b) => b.heat - a.heat);
}

function renderDesktopDiscover() {
  const list = $("#desktopDiscoverList");
  if (!list) return;
  $$(".discover-tabs button[data-discover-mode]").forEach((button) => button.classList.toggle("active", button.dataset.discoverMode === desktopDiscoverMode));
  $$(".discover-tabs button[data-discover-category]").forEach((button) => button.classList.toggle("active", button.dataset.discoverCategory === desktopDiscoverCategory));
  const search = $("#desktopDiscoverSearch");
  if (search) search.classList.toggle("show", desktopDiscoverMode === "search");
  const posts = getDesktopDiscoverPosts();
  list.innerHTML = posts.length
    ? posts
        .map(
          (post) => `
            <article class="desktop-discover-card">
              <p>${post.author} · ${post.time}</p>
              <h3>${post.title}</h3>
              <span>${post.text}</span>
              <strong>${post.category === "offer" ? "帮助" : "求帮助"} · ${post.count}</strong>
            </article>
          `
        )
        .join("")
    : '<div class="empty-state tall">没有搜到相关帖子。</div>';
}

function publishDesktopPost() {
  if (!desktopPendingPost) return;
  const postCategory = desktopPendingPost.category || "ask";
  desktopPosts.unshift({ ...desktopPendingPost, id: `post-${Date.now()}` });
  desktopAssistantMessages.push({ role: "assistant", text: "已发帖，并同步到社区发现的最新列表。" });
  desktopPendingPost = null;
  desktopDiscoverMode = "latest";
  desktopDiscoverCategory = postCategory;
  renderDesktopAssistant();
  renderDesktopDiscover();
  switchView("discover");
}

function replyDesktopHelp(id, mode) {
  const item = desktopAssistantSuggestions.find((entry) => entry.id === id);
  if (!item) return;
  const action = getDesktopRequestAction(item);
  const label = mode === "free" ? action.freeLabel : action.paidLabel;
  const note = window.prompt(`${label}：给 ${item.requester} 留一句话`, mode === "free" ? action.freeMessage : action.paidMessage);
  if (!note) return;
  createOrder({ serviceTag: item.title, description: `${label} · ${note}`, budget: item.budget || 0, authRule: "同小区认证", evidenceRule: "送达确认" }, { name: item.requester, quote: item.budget || 0 });
  switchView("orders");
}

function inviteDesktopHelper(id, mode) {
  const item = desktopAssistantHelpers.find((entry) => entry.id === id);
  if (!item) return;
  const action = getDesktopHelperAction(item);
  const label = mode === "paid" ? action.paidLabel : action.inviteLabel;
  const note = window.prompt(`${label}：给 ${item.helper} 留一句话`, mode === "paid" ? action.paidMessage : action.inviteMessage);
  if (!note) return;
  createOrder({ serviceTag: item.title, description: `${label} · ${note}`, budget: item.budget || 0, authRule: "同小区认证", evidenceRule: "送达确认" }, { name: item.helper, quote: item.budget || 0 });
  switchView("orders");
}

function renderTaskCard(task, priceAdvice) {
  const riskClass = task.riskLevel.includes("红色") ? "danger" : task.riskLevel.includes("黄色") ? "warn" : "";
  $("#taskCardPanel").innerHTML = `
    <article class="task-card">
      <header>
        <div>
          <p class="eyebrow">Task Card</p>
          <h3>${task.serviceTag}</h3>
          <p class="reason">${task.description}</p>
        </div>
        <span class="badge ${riskClass}">${task.riskLevel}</span>
      </header>
      <div class="badge-row">
        <span class="badge">${task.authRule}</span>
        <span class="badge">${task.evidenceRule}</span>
        <span class="badge">${task.negotiable ? "可议价" : "固定条件"}</span>
      </div>
      <div class="field-grid">
        <div class="field-box"><small>服务时间</small><strong>${task.time}</strong></div>
        <div class="field-box"><small>位置范围</small><strong>${task.location}</strong></div>
        <div class="field-box"><small>期望报价</small><strong>${task.budget} 元</strong></div>
        <div class="field-box"><small>价格建议</small><strong>${priceAdvice.low}-${priceAdvice.high} 元</strong></div>
      </div>
      <div class="field-box">
        <small>补问策略</small>
        <strong>${task.missing.length ? task.missing.join("；") : "信息足够，不继续打扰用户。"}</strong>
      </div>
      <p class="reason">${priceAdvice.note}</p>
    </article>
  `;
}

function renderMatches(matches) {
  const list = $("#matchList");
  if (!matches.length) {
    list.className = "match-list empty-state";
    list.textContent = "当前规则下没有候选人，建议升级给物业处理。";
    return;
  }

  list.className = "match-list";
  list.innerHTML = matches
    .map(
      (candidate, index) => `
        <article class="match-card">
          <div class="person-line">
            <div class="avatar">${candidate.name.slice(0, 1)}</div>
            <div>
              <strong>${candidate.name}</strong>
              <p class="reason">${candidate.role} · 报价 ${candidate.quote} 元</p>
            </div>
            <div class="score">${candidate.score}</div>
          </div>
          <p class="reason">${candidate.reason}</p>
          <div class="action-row">
            <button class="small-button accept-offer" data-id="${candidate.id}">接受报价</button>
            <button class="small-button counter-offer" data-id="${candidate.id}">还价 ${Math.max(0, candidate.quote - 2)} 元</button>
          </div>
        </article>
      `
    )
    .join("");

  $$(".accept-offer").forEach((button) => {
    button.addEventListener("click", () => {
      const candidate = matches.find((item) => item.id === button.dataset.id);
      selectedCandidate = candidate;
      const order = createOrder(currentTask, candidate);
      addLog([
        ["negotiate", `${candidate.name} 的报价 ${candidate.quote} 元已被接受，双方条件写入报价链路。`],
        ["create_order", `已创建工单 ${order.id}，状态为待确认。`],
      ]);
      switchView("orders");
    });
  });

  $$(".counter-offer").forEach((button) => {
    button.addEventListener("click", () => {
      const candidate = matches.find((item) => item.id === button.dataset.id);
      const counterPrice = Math.max(0, candidate.quote - 2);
      candidate.quote = counterPrice;
      addLog([
        ["negotiate", `已向 ${candidate.name} 发起 ${counterPrice} 元还价，保留议价记录并设置 15 分钟响应时限。`],
        ["suggest", "还价仍处于合理区间，若超时可关闭并重新匹配。"],
      ]);
      renderMatches(matches);
    });
  });
}

function renderTools() {
  $("#toolGrid").innerHTML = tools
    .map(
      (tool) => `
        <article class="tool-card">
          <div class="tool-icon">${tool.icon}</div>
          <div>
            <h3>${tool.name}</h3>
            <p class="reason">${tool.owner} · ${tool.building}</p>
          </div>
          <div class="badge-row">
            <span class="badge">${tool.status}</span>
            <span class="badge">${tool.price}</span>
          </div>
          <div class="field-box"><small>可用时间</small><strong>${tool.availability}</strong></div>
          <div class="field-box"><small>规则</small><strong>${tool.deposit}</strong></div>
          <button class="small-button borrow-tool" data-id="${tool.id}">申请借用</button>
        </article>
      `
    )
    .join("");

  $$(".borrow-tool").forEach((button) => {
    button.addEventListener("click", () => {
      const tool = tools.find((item) => item.id === button.dataset.id);
      const task = {
        id: `borrow-${Date.now()}`,
        serviceTag: "工具借用",
        description: `申请借用${tool.name}`,
        time: tool.availability,
        location: tool.building,
        budget: tool.price.includes("免费") ? 0 : 5,
        negotiable: false,
        riskLevel: "绿色 - 低风险",
        authRule: tool.deposit,
        evidenceRule: "取用确认 + 归还确认 + 到期提醒",
        type: "tool",
      };
      const order = createOrder(task, { name: tool.owner, quote: task.budget, role: "物主", id: tool.id }, "tool");
      order.statusIndex = 1;
      renderOrders();
      switchView("orders");
    });
  });
}

function renderOrders() {
  const board = $("#orderBoard");
  if (!orders.length) {
    board.className = "order-board empty-state tall";
    board.textContent = "还没有创建订单。";
    return;
  }

  board.className = "order-board";
  board.innerHTML = `
    <div class="order-list">
      ${orders
        .map(
          (order) => `
            <article class="order-card">
              <header>
                <p class="eyebrow">${order.id} · ${order.createdAt}</p>
                <h3>${order.task.serviceTag}：${order.task.description}</h3>
                <p class="reason">执行方：${order.candidate.name} · 成交价：${order.price} 元 · 当前状态：${orderSteps[order.statusIndex]}</p>
              </header>
              <div class="timeline">
                ${orderSteps
                  .map((step, index) => `<div class="timeline-step ${index === order.statusIndex ? "active" : ""}">${step}</div>`)
                  .join("")}
              </div>
              <div class="badge-row">
                <span class="badge">${order.task.authRule}</span>
                <span class="badge">${order.task.evidenceRule}</span>
              </div>
              <div class="action-row">
                <button class="small-button advance-order" data-id="${order.id}">推进状态</button>
                <button class="small-button add-evidence" data-id="${order.id}">上传完成凭证</button>
                <button class="small-button dispute-order" data-id="${order.id}">升级争议</button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;

  $$(".advance-order").forEach((button) => {
    button.addEventListener("click", () => {
      const order = orders.find((item) => item.id === button.dataset.id);
      order.statusIndex = Math.min(order.statusIndex + 1, 4);
      renderOrders();
    });
  });

  $$(".add-evidence").forEach((button) => {
    button.addEventListener("click", () => {
      const order = orders.find((item) => item.id === button.dataset.id);
      order.evidence.push("完成照片已提交");
      order.statusIndex = 3;
      renderOrders();
    });
  });

  $$(".dispute-order").forEach((button) => {
    button.addEventListener("click", () => {
      const order = orders.find((item) => item.id === button.dataset.id);
      order.statusIndex = 5;
      renderOrders();
    });
  });
}

function parseAndRender() {
  currentTask = parseTask($("#requestText").value);
  const priceAdvice = suggestPrice(currentTask);
  const matches = rankWorkers(currentTask);

  addLog([
    ["parse_task", `识别为「${currentTask.serviceTag}」，风险等级为「${currentTask.riskLevel}」，抽取时间 ${currentTask.time}、位置 ${currentTask.location}、预算 ${currentTask.budget} 元。`],
    ["suggest", priceAdvice.note],
    ["rank_workers", currentTask.type === "high-risk" ? "高风险任务仅筛选机构认证服务者。" : `已按 LBS、认证、报价、信用排序出 ${matches.length} 位候选人。`],
  ]);
  renderTaskCard(currentTask, priceAdvice);
  renderMatches(matches);
  updateAssistant();
}

function switchView(name) {
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === name));
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${name}`));
}

function initEvents() {
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  $$(".quick-chip").forEach((button) => {
    button.addEventListener("click", () => {
      $("#requestText").value = button.dataset.template;
      updateAssistant();
    });
  });

  $("#requestText").addEventListener("input", updateAssistant);
  $("#parseTaskButton").addEventListener("click", parseAndRender);
  $("#assistantParse").addEventListener("click", parseAndRender);
  $("#assistantPolish").addEventListener("click", polishRequestText);
  $("#desktopAssistantSend").addEventListener("click", sendDesktopAssistantMessage);
  $("#desktopAssistantInput").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    sendDesktopAssistantMessage();
  });
  $("#desktopDiscoverSearch").addEventListener("input", (event) => {
    desktopDiscoverSearch = event.target.value;
    renderDesktopDiscover();
  });
  $$(".discover-tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.discoverMode) desktopDiscoverMode = button.dataset.discoverMode;
      if (button.dataset.discoverCategory) desktopDiscoverCategory = button.dataset.discoverCategory;
      renderDesktopDiscover();
    });
  });
  document.body.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.id === "desktopPublishPost") publishDesktopPost();
    if (button.dataset.helpId) replyDesktopHelp(button.dataset.helpId, button.dataset.helpMode);
    if (button.dataset.helperId) inviteDesktopHelper(button.dataset.helperId, button.dataset.helperMode);
  });
  $("#seedRunTask").addEventListener("click", () => {
    $("#requestText").value = "今晚 7 点前帮我从小区门口取个快递，送到 3 栋楼下，10 元以内。";
    switchView("resident");
    parseAndRender();
  });
  $("#seedToolTask").addEventListener("click", () => {
    $("#requestText").value = "今晚 8 点想借电钻挂画，半小时后还，最好同楼栋。";
    switchView("resident");
    parseAndRender();
  });
  $("#openToolRequest").addEventListener("click", () => {
    const drillButton = document.querySelector('.borrow-tool[data-id="tool-1"]');
    if (drillButton) drillButton.click();
  });
  $("#simulateTimeout").addEventListener("click", () => {
    if (!orders.length) {
      const task = parseTask("今晚 7 点前帮我从小区门口取个快递，送到 3 栋楼下，10 元以内。");
      const candidate = rankWorkers(task)[0];
      createOrder(task, candidate);
    }
    orders[0].statusIndex = 5;
    renderOrders();
  });
}

renderTools();
renderOrders();
initEvents();
updateAssistant();
renderDesktopAssistant();
renderDesktopDiscover();
