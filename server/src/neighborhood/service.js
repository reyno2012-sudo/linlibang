const { ConflictError, NotFoundError, ValidationError } = require("../errors");

const orderSteps = ["待确认", "已接单", "服务中", "待验收", "已完成", "争议中"];

const creditEvents = {
  safe_completion: { delta: 2, text: "安全完成订单" },
  community_endorsement: { delta: 3, text: "同小区熟人背书" },
  minor_violation: { delta: -6, text: "轻微违规" },
  safety_complaint: { delta: -18, text: "安全投诉" },
  severe_incident: { delta: -100, text: "人身伤害/虐待/盗窃等严重事故" },
};

const scenarioPolicies = {
  child_pickup: {
    key: "child_pickup",
    label: "代接小孩",
    serviceTag: "儿童接送",
    riskLevel: "红色 - 最高风险",
    minCredit: 95,
    permissionKey: "childPickup",
    priceRange: [25, 50],
    requiresTrialCompleted: true,
    requiredChecks: ["三重实名", "实时人脸", "小区居住核验", "无犯罪记录已核验", "试用期已完成"],
    preferredCertificates: ["幼师证", "育儿证", "退休教师", "儿童安全培训"],
    requiredAuthorizations: ["监护人电子授权书", "孩子姓名/班级/衣着特征", "紧急备用联系人"],
    requiredEvidence: ["到校门口拍摄校门+孩子全身合照", "送达小区单元门后拍照", "GPS 轨迹保存至少 180 天"],
    forbiddenActions: ["禁止带孩子去超市、游乐场或路边逗留", "禁止私自搭乘电动车/私家车绕行", "禁止带孩子进入接单者家中", "禁止给孩子零食、饮料、手机"],
    moneyRules: ["全款平台托管", "完成节点确认后结算", "自动附赠当日第三方责任险"],
    emergencyRules: ["偏离学校-小区路线超过 3 分钟自动预警", "接单者失联 10 分钟通知监护人、备用联系人和平台"],
  },
  elder_care: {
    key: "elder_care",
    label: "独居老人陪护",
    serviceTag: "老人陪护",
    riskLevel: "红色 - 高风险",
    minCredit: 92,
    permissionKey: "elderCare",
    priceRange: [60, 140],
    requiresTrialCompleted: true,
    requiredChecks: ["三重实名", "小区居住核验", "无犯罪记录已核验"],
    preferredCertificates: ["护士证", "护工证", "急救培训"],
    requiredAuthorizations: ["直系紧急联系人绑定", "老人基础身体状况勾选", "白天 9:00-18:00 服务限制"],
    requiredEvidence: ["进门拍摄公共区域照片", "离开拍摄公共区域照片", "APP 内置录音留存至少 180 天"],
    forbiddenActions: ["认知不清老人必须家属陪同", "夜间不开放独居老人陪护订单", "禁止私自处理老人财物"],
    moneyRules: ["平台托管资金", "异常争议自动冻结佣金", "订单责任险覆盖服务时段"],
    emergencyRules: ["身体不适一键通知家属和平台", "必要时联动物业上门查看"],
  },
  pet_care: {
    key: "pet_care",
    label: "遛宠照看",
    serviceTag: "遛宠照看",
    riskLevel: "黄色 - 中风险",
    minCredit: 85,
    permissionKey: "petCare",
    priceRange: [15, 40],
    requiresTrialCompleted: false,
    requiredChecks: ["实名", "小区居住核验", "信用分 85+"],
    preferredCertificates: ["宠物医师证", "训犬证"],
    requiredAuthorizations: ["宠物品种/性格/牵引规则", "宠物伤人责任协议"],
    requiredEvidence: ["出门拍照", "返还拍照", "GPS 轨迹保存至少 180 天"],
    forbiddenActions: ["禁止私自长时间带离小区", "禁止解开牵引绳", "禁止交给第三人照看"],
    moneyRules: ["平台托管资金", "宠物伤人责任提前协议划分"],
    emergencyRules: ["轨迹长时间停留或离开小区自动提醒"],
  },
  home_repair: {
    key: "home_repair",
    label: "上门维修",
    serviceTag: "上门维修",
    riskLevel: "黄色 - 中风险",
    minCredit: 90,
    permissionKey: "homeRepair",
    priceRange: [30, 120],
    requiresTrialCompleted: true,
    requiredChecks: ["三重实名", "小区居住核验", "物业/维修资质备案"],
    preferredCertificates: ["电工证", "物业维修备案"],
    requiredAuthorizations: ["上门时间确认", "维修范围确认", "贵重物品提醒"],
    requiredEvidence: ["进门拍摄公共区域照片", "维修前后照片", "离开确认"],
    forbiddenActions: ["禁止私自扩大维修范围", "禁止触碰无关财物", "禁止夜间单独上门"],
    moneyRules: ["平台托管资金", "材料费用单独确认"],
    emergencyRules: ["争议一键转物业管家复核"],
  },
  medical_care: {
    key: "medical_care",
    label: "陪诊调度",
    serviceTag: "陪诊调度",
    riskLevel: "红色 - 高风险",
    minCredit: 92,
    permissionKey: "elderCare",
    priceRange: [80, 160],
    requiresTrialCompleted: true,
    requiredChecks: ["三重实名", "机构/护工资质", "无犯罪记录已核验"],
    preferredCertificates: ["护士证", "护工证", "急救培训"],
    requiredAuthorizations: ["家属授权", "病史风险告知", "紧急联系人"],
    requiredEvidence: ["到达医院照片", "关键节点定位", "离开确认"],
    forbiddenActions: ["禁止替代家属签署医疗决定", "禁止私自收取费用"],
    moneyRules: ["平台托管资金", "医疗费用不经平台代收"],
    emergencyRules: ["身体异常立即联系家属和医院工作人员"],
  },
  tool: {
    key: "tool",
    label: "工具借用",
    serviceTag: "工具借用",
    riskLevel: "绿色 - 低风险",
    minCredit: 80,
    permissionKey: "lowRisk",
    priceRange: [0, 8],
    requiredChecks: ["实名", "小区居住核验"],
    preferredCertificates: [],
    requiredAuthorizations: ["取还规则确认"],
    requiredEvidence: ["取用确认", "归还确认", "到期提醒"],
    forbiddenActions: ["禁止转借第三人"],
    moneyRules: ["押金/信用免押按工具规则执行"],
    emergencyRules: ["逾期自动提醒物主和平台"],
  },
  moving: {
    key: "moving",
    label: "小型搬运",
    serviceTag: "小型搬运",
    riskLevel: "绿色 - 低风险",
    minCredit: 80,
    permissionKey: "lowRisk",
    priceRange: [18, 35],
    requiredChecks: ["实名", "小区居住核验"],
    preferredCertificates: [],
    requiredAuthorizations: ["物品重量/是否上楼确认"],
    requiredEvidence: ["取件照片", "送达照片"],
    forbiddenActions: ["禁止搬运违禁品或贵重现金"],
    moneyRules: ["平台托管资金"],
    emergencyRules: ["纠纷时冻结佣金并留存证据"],
  },
  errand: {
    key: "errand",
    label: "邻里跑腿",
    serviceTag: "代取快递",
    riskLevel: "绿色 - 低风险",
    minCredit: 80,
    permissionKey: "lowRisk",
    priceRange: [8, 15],
    requiredChecks: ["实名", "小区居住核验"],
    preferredCertificates: [],
    requiredAuthorizations: ["取件码/代垫规则确认"],
    requiredEvidence: ["取件照片", "送达照片"],
    forbiddenActions: ["禁止私拆包裹", "禁止线下私收费用"],
    moneyRules: ["平台托管资金"],
    emergencyRules: ["超时自动提醒双方"],
  },
};

function requireText(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError([{ field, message: "请填写有效文本" }]);
  }
  return value.trim();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function creditLevel(score) {
  if (score >= 96) return "S";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 60) return "C";
  return "D";
}

function compactBuilding(value) {
  return value.replace(/\s+/g, "");
}

function detectScenario(raw) {
  if (/接孩子|接娃|放学|学校|校门|班级|未成年|儿童/.test(raw)) return scenarioPolicies.child_pickup;
  if (/老人|独居|陪护|看护|搀扶|阿尔茨海默|认知/.test(raw)) return scenarioPolicies.elder_care;
  if (/陪诊|医院|挂号|门诊|医疗/.test(raw)) return scenarioPolicies.medical_care;
  if (/遛狗|遛猫|遛宠|宠物|猫|狗/.test(raw)) return scenarioPolicies.pet_care;
  if (/上门维修|维修|电路|水管|家电|打孔|换灯/.test(raw)) return scenarioPolicies.home_repair;
  if (/借|小推车|梯|工具|电钻|轮椅|折叠/.test(raw)) return scenarioPolicies.tool;
  if (/搬|搬运|收纳|箱|书/.test(raw)) return scenarioPolicies.moving;
  return scenarioPolicies.errand;
}

function buildSafetyPlan(policy) {
  return {
    scenario: policy.label,
    minCredit: policy.minCredit,
    requiredChecks: policy.requiredChecks,
    preferredCertificates: policy.preferredCertificates,
    requiredAuthorizations: policy.requiredAuthorizations,
    requiredEvidence: policy.requiredEvidence,
    forbiddenActions: policy.forbiddenActions,
    moneyRules: policy.moneyRules,
    emergencyRules: policy.emergencyRules,
    insurance: "付费订单自动附赠当日短期责任险/意外险占位",
    escrow: "资金全程平台托管，节点确认后结算",
    evidenceRetentionDays: 180,
  };
}

function parseTaskText(text) {
  const raw = requireText(text, "text");
  const policy = detectScenario(raw);
  const priceMatch = raw.match(/(\d+)\s*元/);
  const budget = priceMatch ? Number(priceMatch[1]) : policy.priceRange[0];
  const timeMatch = raw.match(/今晚|今天|明天|周[一二三四五六日天]|上午|下午|晚上|[0-9]{1,2}\s*点(?:前|后)?/);
  const locationMatches = raw.match(/实验小学|学校|校门|小区门口|[1-9]\s*栋(?:楼下|门口|大堂|单元门口)?|楼下|花园|物业中心/g) || [];
  const missing = [];

  if (policy.key === "child_pickup" && !/孩子|班级|衣着|联系人|监护/.test(raw)) {
    missing.push("儿童接送需补充孩子姓名、学校班级、衣着特征、监护人和备用联系人");
  }
  if (policy.key === "elder_care" && !/联系人|家属|病史|高血压|腿脚|认知/.test(raw)) {
    missing.push("老人陪护需补充家属联系人、基础身体状况和服务时段");
  }
  if (policy.key === "pet_care" && !/牵引|性格|品种|咬人|疫苗/.test(raw)) {
    missing.push("遛宠需补充宠物品种、性格、牵引要求和伤人责任约定");
  }
  if (!["child_pickup", "elder_care", "pet_care"].includes(policy.key) && !/是否|需要|上楼|重量|多重|多久|半小时/.test(raw)) {
    missing.push("建议补充是否需要上楼、物品大小和是否可议价");
  }

  return {
    id: `task-${Date.now()}`,
    raw,
    serviceTag: policy.serviceTag,
    description: raw,
    time: timeMatch ? timeMatch[0].replace(/\s+/g, "") : "今天内",
    location: locationMatches.length
      ? Array.from(new Set(locationMatches.map(compactBuilding))).join(" / ")
      : "同小区",
    budget,
    negotiable: /议价|以内|预算|元/.test(raw),
    riskLevel: policy.riskLevel,
    authRule: policy.requiredChecks.join(" + "),
    evidenceRule: policy.requiredEvidence.join(" + "),
    missing,
    type: ["child_pickup", "elder_care", "medical_care"].includes(policy.key) ? "high-risk" : policy.key,
    scenario: { key: policy.key, label: policy.label },
    safetyPlan: buildSafetyPlan(policy),
  };
}

function suggestPrice(task) {
  const policy = scenarioPolicies[task.scenario?.key] || scenarioPolicies.errand;
  const range = policy.priceRange;
  const [low, high] = range;
  let note = `期望价位于参考区间 ${low}-${high} 元内。`;
  if (task.budget < low) note = `期望价低于参考区间 ${low}-${high} 元，建议补充任务简单程度或允许议价。`;
  if (task.budget > high) note = `期望价高于参考区间 ${low}-${high} 元，通常能更快获得响应。`;
  return { range, low, high, note };
}

function hasPreferredCertificate(user, policy) {
  const certs = user.safety?.certificates || [];
  return policy.preferredCertificates.some((item) => certs.includes(item) || user.trustBadges?.includes(item));
}

function evaluateSafetyEligibility(user, task) {
  const policy = scenarioPolicies[task.scenario?.key] || scenarioPolicies.errand;
  const reasons = [];
  const safety = user.safety || {};
  const permissions = user.permissions || {};

  if (!permissions[policy.permissionKey]) reasons.push(`未开通${policy.label}权限`);
  if ((user.credit || 0) < policy.minCredit) reasons.push(`信用分需达到 ${policy.minCredit}+`);
  if (!safety.idVerified || !safety.faceVerified || !safety.phoneVerified) reasons.push("三重实名未完成");
  if (!safety.residenceVerified) reasons.push("小区居住核验未完成");
  if (policy.riskLevel.includes("红色") && safety.noCriminalRecord !== "approved") reasons.push("无犯罪记录未通过");
  if (policy.requiresTrialCompleted && !user.trialCompleted) reasons.push("试用期未完成");
  if (policy.key === "home_repair" && !hasPreferredCertificate(user, policy)) reasons.push("缺少物业/维修资质备案");

  return {
    allowed: reasons.length === 0,
    reasons,
    minCredit: policy.minCredit,
    requiredChecks: policy.requiredChecks,
  };
}

function rankWorkers(task, users) {
  const policy = scenarioPolicies[task.scenario?.key] || scenarioPolicies.errand;
  return users
    .map((user) => ({ user, eligibility: evaluateSafetyEligibility(user, task) }))
    .filter(({ user, eligibility }) => {
      if (!eligibility.allowed) return false;
      if (policy.key === "tool") return user.skills.includes("工具借还");
      if (policy.key === "errand") return user.skills.includes(task.serviceTag) || user.skills.includes("代取快递");
      return user.skills.includes(task.serviceTag) || hasPreferredCertificate(user, policy);
    })
    .map(({ user, eligibility }) => {
      const distanceScore = Math.max(0, 25 - user.distance / 40);
      const authScore = Math.min(24, (user.verified?.length || 0) * 6);
      const quoteScore = Math.max(0, 20 - Math.abs(user.baseQuote - task.budget) * 1.2);
      const skillScore = user.skills.includes(task.serviceTag) ? 16 : 10;
      const creditScore = Math.min(20, (user.credit || 0) / 5);
      const certificateScore = hasPreferredCertificate(user, policy) ? 8 : 0;
      const responseScore = Math.max(1, 6 - user.avgResponse / 3);
      const score = Math.round(distanceScore + authScore + quoteScore + skillScore + creditScore + certificateScore + responseScore);
      const quote = task.scenario?.key === "tool" ? 0 : Math.max(user.baseQuote, Math.round(task.budget || user.baseQuote));

      return {
        ...user,
        quote,
        score,
        safetyScore: score,
        creditLevel: creditLevel(user.credit || 0),
        trustBadges: user.trustBadges || [],
        safetyEligibility: eligibility,
        reason: `${user.building}，距离约 ${user.distance} 米；信用 ${user.credit} 分；${(user.trustBadges || user.verified || []).join("、")}；完成 ${user.completed} 单，评分 ${user.rating}。`,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function parseAndMatch(store, text) {
  const data = store.read();
  const task = parseTaskText(text);
  const priceAdvice = suggestPrice(task);
  const matches = rankWorkers(task, data.users);
  return {
    task,
    priceAdvice,
    matches,
    riskPolicy: scenarioPolicies[task.scenario.key],
    agentLog: [
      {
        tool: "parse_task",
        text: `识别为「${task.serviceTag}」，风险等级为「${task.riskLevel}」。`,
      },
      { tool: "risk_gate", text: `已启用${task.safetyPlan.scenario}安全闭环：${task.safetyPlan.requiredChecks.join("、")}。` },
      { tool: "suggest_price", text: priceAdvice.note },
      { tool: "rank_workers", text: `已按信用分、准入资格、距离、报价和证书排序出 ${matches.length} 位候选人。` },
    ],
  };
}

function normalizeAssistantLocation(raw, matchedLocation) {
  const namedStation = raw.match(/((?:中通|菜鸟|圆通|申通|韵达|顺丰|京东|丰巢)[^，。,\.\s]{0,6}(?:快递站|驿站|快递柜|门口))/);
  if (namedStation) return namedStation[1];
  const communityPlace = raw.match(/(小区门口|北门|南门|东门|西门|物业中心)/);
  if (communityPlace) return communityPlace[1];
  return matchedLocation || "小区快递站";
}

function detectRouteIntent(text) {
  const raw = requireText(text, "message");
  const isGoing = /去|路过|顺路|经过|到/.test(raw);
  const isStation = /快递站|驿站|菜鸟|丰巢|快递柜|门口/.test(raw);
  const asksForHelp = /帮我|求助|需要.*帮|谁能|能不能.*帮|有没有人.*帮|没时间|来不及|不方便|代取|带回|取一下|拿一下|接送|接一下|帮忙接|照看|看护/.test(raw);
  const offersHelp = /有没有.*要|谁要|可以帮|顺手帮|顺路帮|帮邻居|带快递的|要带|可帮/.test(raw);
  const locationMatch = raw.match(/([^，。,.\s]{1,12}(?:快递站|驿站|快递柜|门口))/);
  const timeMatch = raw.match(/今天|今晚|明天|上午|下午|晚上|\d{1,2}\s*点/);

  return {
    raw,
    type: asksForHelp ? "help_request" : offersHelp || (isGoing && isStation) ? "route_offer" : "general_help",
    location: normalizeAssistantLocation(raw, locationMatch?.[1]),
    time: timeMatch?.[0] || "今天",
  };
}

function inferAssistantService(intent) {
  if (/接送|接一下|帮忙接|孩子|小孩|学校|幼儿园/.test(intent.raw)) return "求助接送";
  if (/快递|驿站|快递站|快递柜|取件/.test(intent.raw)) return intent.type === "help_request" ? "求助取件" : "顺路帮取";
  if (/买菜|超市|带菜|采购/.test(intent.raw)) return intent.type === "help_request" ? "求助代买" : "顺路代买";
  return intent.type === "help_request" ? "求助互助" : intent.type === "route_offer" ? "顺路互助" : "邻里互助";
}

function buildAssistantDescription(intent, serviceTag) {
  if (serviceTag === "求助接送") return `${intent.time}没时间接送孩子，想请邻居帮忙接一下，可免费或付费协商。`;
  if (serviceTag === "求助取件") return `${intent.time}想请邻居帮忙从${intent.location}取快递。`;
  if (serviceTag === "顺路帮取") return `${intent.time}去${intent.location}，可以顺手帮邻居取小件快递。`;
  return intent.raw;
}

function findNearbyRequests(intent) {
  const requests = [
    {
      id: "help-101",
      title: "顺手取一个快递",
      requester: "安安",
      place: "3栋楼下",
      distance: 80,
      budget: 5,
      text: `在${intent.location}有一个小件快递，想请顺路邻居带到 3 栋楼下。`,
      mode: "paid",
    },
    {
      id: "help-102",
      title: "帮忙看下快递柜编号",
      requester: "阿树",
      place: "小区门口",
      distance: 140,
      budget: 0,
      text: `如果路过${intent.location}，想麻烦拍一下取件柜屏幕提示。`,
      mode: "free",
    },
    {
      id: "help-103",
      title: "代取文件袋",
      requester: "林小禾",
      place: "5栋门口",
      distance: 220,
      budget: 8,
      text: `今天有个文件袋到${intent.location}，希望同小区邻居顺手带回。`,
      mode: "paid",
    },
  ];

  return requests
    .map((item) => ({ ...item, score: Math.max(60, 96 - Math.round(item.distance / 8)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function findNearbyHelpers(intent) {
  if (/接送|接一下|帮忙接|孩子|小孩|学校|幼儿园/.test(intent.raw)) {
    return [
      {
        id: "helper-child-101",
        helper: "林小禾",
        title: "同小区家长可帮接孩子",
        place: "小区北门",
        distance: 180,
        budget: 15,
        text: "林小禾今天 18:00 左右在小区北门附近，可帮忙接孩子到门岗或楼下。",
        mode: "paid",
        score: 91,
      },
      {
        id: "helper-child-102",
        helper: "王启明",
        title: "3栋邻居可临时照应",
        place: "3栋楼下",
        distance: 80,
        budget: 0,
        text: "王启明傍晚在 3 栋附近，可短时间帮忙照应，建议先确认孩子信息。",
        mode: "free",
        score: 86,
      },
    ];
  }
  return [
    {
      id: "helper-101",
      helper: "王启明",
      title: "3栋邻居可帮取件",
      place: "3栋楼下",
      distance: 80,
      budget: 6,
      text: `王启明今天会路过${intent.location}，可帮忙带小件快递到 3 栋楼下。`,
      mode: "paid",
      score: 92,
    },
    {
      id: "helper-102",
      helper: "林小禾",
      title: "物业认证服务者可接单",
      place: "5栋门口",
      distance: 220,
      budget: 8,
      text: `林小禾可在${intent.time}去${intent.location}取件，支持送到楼下。`,
      mode: "paid",
      score: 84,
    },
    {
      id: "helper-103",
      helper: "陈海",
      title: "社区达人顺手帮忙",
      place: "1栋",
      distance: 410,
      budget: 0,
      text: "陈海常在小区门口附近活动，可以免费帮看快递柜编号。",
      mode: "free",
      score: 73,
    },
  ];
}

function buildAssistantFallback(store, message) {
  store.read();
  const intent = detectRouteIntent(message);
  const nearbyRequests = findNearbyRequests(intent);
  const nearbyHelpers = intent.type === "help_request" ? findNearbyHelpers(intent) : [];
  const serviceTag = inferAssistantService(intent);
  const publishTask = {
    id: `ai-${Date.now()}`,
    serviceTag,
    category: intent.type === "help_request" ? "ask" : "offer",
    description: buildAssistantDescription(intent, serviceTag),
    time: intent.time,
    location: intent.location,
    budget: 0,
    negotiable: true,
    riskLevel: "绿色 - 低风险",
    authRule: "手机号 + 同小区认证优先",
    evidenceRule: "取件拍照 + 送达确认",
    type: "service",
  };

  return {
    reply:
      intent.type === "route_offer"
        ? `我识别到你今天会去${intent.location}，可以把这条顺路能力发布成互助，也可以先看看附近有没有人正好需要帮忙。`
        : intent.type === "help_request"
          ? `我理解你是在求帮助：${buildAssistantDescription(intent, serviceTag)} 我先帮你找了附近可能能帮忙的人，也可以整理成求助帖发到发现页。`
        : "我可以帮你把需求整理成邻里互助任务，并匹配附近可响应的人。",
    intent,
    nearbyRequests: intent.type === "help_request" ? [] : nearbyRequests,
    nearbyHelpers,
    publishTask,
    quickReplies: intent.type === "help_request" ? ["发布求助帖", "邀请附近邻居", "改成付费求助"] : ["自动发布顺路任务", "看看附近求助", "改成付费帮助"],
    source: "local_rules",
  };
}

async function callAssistantModel(message, fallback, env = process.env) {
  const apiKey = env.ASSISTANT_API_KEY;
  const baseUrl = env.ASSISTANT_BASE_URL || "https://api.aigcly.top";
  const model = env.ASSISTANT_MODEL || "grok-4.20-multi-agent-xhigh";
  if (!apiKey) return fallback;

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "你是邻里帮的对话式 AI 助手。先判断用户是在提供帮助还是需要帮助：例如'我今天去中通快递站，有没有邻居要带快递的'是提供帮助；'谁能帮我取快递'是需要帮助。只返回 JSON，字段为 reply, quickReplies。语气温暖、简洁、可靠。",
        },
        { role: "user", content: message },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) return { ...fallback, source: "local_rules", modelError: response.status };
  const raw = await response.text();
  const payload = parseModelPayload(raw);
  const content = payload?.choices?.[0]?.message?.content || payload?.choices?.[0]?.delta?.content;
  if (!content) return fallback;

  try {
    const parsed = JSON.parse(content);
    return {
      ...fallback,
      reply: parsed.reply || fallback.reply,
      quickReplies: Array.isArray(parsed.quickReplies) ? parsed.quickReplies.slice(0, 4) : fallback.quickReplies,
      source: "model",
    };
  } catch {
    return { ...fallback, reply: content, source: "model" };
  }
}

function parseModelPayload(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const chunks = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:") && line !== "data: [DONE]")
      .map((line) => line.slice(5).trim());
    const contents = [];
    let lastPayload = null;
    for (const chunk of chunks) {
      try {
        const parsed = JSON.parse(chunk);
        lastPayload = parsed;
        const delta = parsed.choices?.[0]?.delta?.content;
        const message = parsed.choices?.[0]?.message?.content;
        if (delta) contents.push(delta);
        if (message) contents.push(message);
      } catch {
        // Ignore malformed stream fragments and fall back to local rules.
      }
    }
    if (contents.length) return { choices: [{ message: { content: contents.join("") } }] };
    return lastPayload;
  }
}

async function assistantChat(store, input, env = process.env) {
  if (!input || typeof input !== "object") throw new ValidationError([{ field: "body", message: "请求体不能为空" }]);
  const message = requireText(input.message, "message");
  const fallback = buildAssistantFallback(store, message);
  return callAssistantModel(message, fallback, env);
}

function findOrder(data, id) {
  const order = data.orders.find((item) => item.id === id);
  if (!order) throw new NotFoundError("订单", id);
  return order;
}

function getRiskPolicy() {
  return {
    scenarios: scenarioPolicies,
    creditEvents,
    rules: [
      "新接单者前 5 单只开放低风险订单",
      "安全投诉会永久关闭儿童接送和老人陪护权限",
      "严重人身伤害、虐待、盗窃类投诉直接封号并留存证据",
      "高风险订单必须使用平台托管、电子授权、节点拍照和 GPS 留痕",
    ],
  };
}

function createOrder(store, input) {
  if (!input || typeof input !== "object") throw new ValidationError([{ field: "body", message: "请求体不能为空" }]);
  if (!input.task || typeof input.task !== "object") throw new ValidationError([{ field: "task", message: "任务不能为空" }]);

  return store.update((data) => {
    const candidate =
      input.candidate ||
      data.users.find((user) => user.id === input.candidateId) ||
      data.users.find((user) => user.id === input.task.candidateId);
    if (!candidate) throw new NotFoundError("候选人", input.candidateId || input.task.candidateId || "unknown");

    const eligibility = evaluateSafetyEligibility(candidate, input.task);
    if (!eligibility.allowed) {
      throw new ConflictError("候选人未满足该场景安全准入", eligibility.reasons.map((reason) => ({ reason })));
    }

    const price = input.source === "tool" ? input.task.budget : candidate.quote ?? Math.max(candidate.baseQuote || 0, input.task.budget || 0);
    const order = {
      id: `NB-${String(data.orders.length + 1).padStart(4, "0")}`,
      task: input.task,
      candidate: {
        id: candidate.id,
        name: candidate.name,
        role: candidate.role,
        quote: candidate.quote ?? Math.max(candidate.baseQuote || 0, input.task.budget || 0),
        credit: candidate.credit,
        trustBadges: candidate.trustBadges || [],
      },
      source: input.source || "task",
      price,
      statusIndex: input.statusIndex || 0,
      status: orderSteps[input.statusIndex || 0],
      createdAt: new Date().toISOString(),
      evidence: [],
      escrow: { status: "holding", amount: price },
      insurance: input.task.safetyPlan?.insurance || "低风险互助责任险占位",
      safetyPlan: input.task.safetyPlan || buildSafetyPlan(scenarioPolicies.errand),
    };
    data.orders.unshift(order);
    return order;
  });
}

function advanceOrder(store, id) {
  return store.update((data) => {
    const order = findOrder(data, id);
    if (order.statusIndex >= 4) throw new ConflictError("订单已结束，不能继续推进", [{ field: "status" }]);
    order.statusIndex = Math.min(order.statusIndex + 1, 4);
    order.status = orderSteps[order.statusIndex];
    return order;
  });
}

function addEvidence(store, id, note = "完成凭证已提交") {
  return store.update((data) => {
    const order = findOrder(data, id);
    order.evidence.push(requireText(note, "note"));
    order.statusIndex = 3;
    order.status = orderSteps[3];
    return order;
  });
}

function disputeOrder(store, id, reason = "用户发起争议") {
  return store.update((data) => {
    const order = findOrder(data, id);
    order.statusIndex = 5;
    order.status = orderSteps[5];
    order.dispute = { reason: requireText(reason, "reason"), createdAt: new Date().toISOString() };
    return order;
  });
}

function applyCreditEvent(store, userId, input) {
  if (!input || typeof input !== "object") throw new ValidationError([{ field: "body", message: "请求体不能为空" }]);
  const eventConfig = creditEvents[input.type];
  if (!eventConfig) throw new ValidationError([{ field: "type", message: "未知信用事件类型" }]);

  return store.update((data) => {
    const user = data.users.find((item) => item.id === userId);
    if (!user) throw new NotFoundError("用户", userId);

    user.credit = clamp((user.credit || 80) + eventConfig.delta, 0, 100);
    user.creditLevel = creditLevel(user.credit);
    user.creditEvents = user.creditEvents || [];
    const event = {
      type: input.type,
      delta: eventConfig.delta,
      text: eventConfig.text,
      note: input.note || "",
      createdAt: new Date().toISOString(),
    };
    user.creditEvents.unshift(event);

    if (input.type === "safety_complaint") {
      user.permissions.childPickup = false;
      user.permissions.elderCare = false;
      user.restrictions = Array.from(new Set([...(user.restrictions || []), "永久关闭儿童接送权限", "永久关闭老人陪护权限"]));
    }
    if (input.type === "severe_incident") {
      Object.keys(user.permissions).forEach((key) => {
        user.permissions[key] = false;
      });
      user.restrictions = Array.from(new Set([...(user.restrictions || []), "账号封禁并留存证据"]));
    }

    return { user, event };
  });
}

function borrowTool(store, toolId, borrowerId = "me") {
  return store.update((data) => {
    const tool = data.tools.find((item) => item.id === toolId);
    if (!tool) throw new NotFoundError("工具", toolId);
    if (tool.status !== "可借") throw new ConflictError("工具当前不可借", [{ field: "status", value: tool.status }]);

    const policy = scenarioPolicies.tool;
    const order = {
      id: `NB-${String(data.orders.length + 1).padStart(4, "0")}`,
      task: {
        id: `borrow-${Date.now()}`,
        serviceTag: "工具借用",
        description: `申请借用${tool.name}`,
        time: tool.availability,
        location: tool.building,
        budget: tool.price,
        negotiable: false,
        riskLevel: policy.riskLevel,
        authRule: tool.deposit,
        evidenceRule: policy.requiredEvidence.join(" + "),
        type: "tool",
        scenario: { key: "tool", label: policy.label },
        safetyPlan: buildSafetyPlan(policy),
      },
      candidate: { id: tool.id, name: tool.owner, role: "物主", quote: tool.price },
      borrowerId,
      source: "tool",
      price: tool.price,
      statusIndex: 1,
      status: orderSteps[1],
      createdAt: new Date().toISOString(),
      evidence: [],
      escrow: { status: "holding", amount: tool.price },
      insurance: "低风险工具借用责任规则占位",
      safetyPlan: buildSafetyPlan(policy),
    };
    data.orders.unshift(order);
    return order;
  });
}

module.exports = {
  addEvidence,
  advanceOrder,
  applyCreditEvent,
  borrowTool,
  createOrder,
  disputeOrder,
  evaluateSafetyEligibility,
  getRiskPolicy,
  orderSteps,
  parseAndMatch,
  parseTaskText,
  assistantChat,
  rankWorkers,
  suggestPrice,
};
