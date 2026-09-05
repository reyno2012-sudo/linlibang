const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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

test("mobile bottom navigation keeps publish centered without messages tab", () => {
  const mobileHtml = fs.readFileSync(path.join(root, "mobile.html"), "utf8");
  const navMatch = mobileHtml.match(/<nav class="bottom-tabs"[\s\S]*?<\/nav>/);

  assert.ok(navMatch);
  const nav = navMatch[0];
  assert.equal((nav.match(/<button/g) || []).length, 5);
  assert.equal(nav.includes('data-screen="messages"'), false);
  assert.equal(nav.includes("消息"), false);
  assert.ok(nav.indexOf('data-screen="assistant"') < nav.indexOf('id="openCompose"'));
  assert.ok(nav.indexOf('id="openCompose"') < nav.indexOf('data-screen="discover"'));
});

test("mobile home hero uses compact title and raised content", () => {
  const mobileJs = fs.readFileSync(path.join(root, "mobile.js"), "utf8");
  const mobileCss = fs.readFileSync(path.join(root, "mobile-components.css"), "utf8");

  assert.match(mobileJs, /<span class="hero-brand-name">邻里帮<\/span>/);
  assert.match(mobileCss, /\.hero-section\s*\{[\s\S]*?min-height:\s*330px/);
  assert.match(mobileCss, /\.hero-copy\s*\{[\s\S]*?padding:\s*8px 0 0/);
  assert.match(mobileCss, /\.hero-copy h1\s*\{[\s\S]*?font-size:\s*22px/);
  assert.match(mobileCss, /\.hero-brand-name\s*\{[\s\S]*?font-size:\s*1\.16em/);
  assert.match(mobileCss, /\.hero-brand-name\s*\{[\s\S]*?color:\s*#2f8f5b/);
  assert.match(mobileCss, /\.hero-brand-name\s*\{[\s\S]*?margin-left:\s*6px/);
  assert.match(mobileCss, /\.hero-brand-name\s*\{[\s\S]*?font-weight:\s*950/);
  assert.match(mobileCss, /\.hero-illustration\s*\{[\s\S]*?bottom:\s*22px/);
  assert.match(mobileCss, /\.quick-grid\s*\{[\s\S]*?margin-top:\s*-8px/);
});

test("mobile home removes weather bubble and shortens quick cards without changing width", () => {
  const mobileJs = fs.readFileSync(path.join(root, "mobile.js"), "utf8");
  const mobileCss = fs.readFileSync(path.join(root, "mobile-components.css"), "utf8");

  assert.equal(mobileJs.includes("sky-note"), false);
  assert.equal(mobileCss.includes(".sky-note"), false);
  assert.match(mobileCss, /\.quick-card\s*\{[\s\S]*?flex:\s*0 0 calc\(\(100% - 20px\) \/ 3\)/);
  assert.match(mobileCss, /\.quick-card\s*\{[\s\S]*?max-width:\s*132px/);
  assert.match(mobileCss, /\.quick-card\s*\{[\s\S]*?min-height:\s*164px/);
});

test("mobile neighborhood circle opens a BBS feed with posts, replies, and composers", () => {
  const mobileHtml = fs.readFileSync(path.join(root, "mobile.html"), "utf8");
  const mobileJs = fs.readFileSync(path.join(root, "mobile.js"), "utf8");
  const mobileCss = fs.readFileSync(path.join(root, "mobile-components.css"), "utf8");
  const mobileDataSource = fs.readFileSync(path.join(root, "mobile-data.js"), "utf8");
  const sandbox = { window: {} };

  vm.runInNewContext(mobileDataSource, sandbox);
  const mock = sandbox.window.NB_MOCK;

  assert.match(mobileHtml, /id="screen-circle"/);
  assert.equal(mock.quickActions.find((item) => item.id === "circle").target, "circle");
  assert.equal(mock.circlePosts.length, 20);
  assert.ok(mock.circlePosts.every((post) => post.author.avatar && post.replies.every((reply) => reply.avatar)));
  assert.match(mobileJs, /function renderCircleBbs/);
  assert.match(mobileJs, /showAllCirclePosts \? data\.circlePosts : data\.circlePosts\.slice\(0, 6\)/);
  assert.match(mobileJs, /data-action="toggle-circle-posts"/);
  assert.match(mobileJs, /function publishCirclePost/);
  assert.match(mobileJs, /function replyCirclePost/);
  assert.match(mobileJs, /circle-post-meta/);
  assert.match(mobileJs, /post\.replies\.slice\(0, 3\)/);
  assert.match(mobileJs, /circle-post-stats/);
  assert.doesNotMatch(mobileJs, /circle-tags/);
  assert.match(mobileJs, /circle-composer/);
  assert.match(mobileJs, /circle-reply-form/);
  assert.match(mobileCss, /\.circle-bbs-list/);
  assert.match(mobileCss, /\.circle-composer/);
  assert.match(mobileCss, /\.circle-reply-form/);
  assert.doesNotMatch(mobileCss, /\.circle-tags/);
  assert.match(mobileCss, /\.circle-post-card\s*\{[\s\S]*?gap:\s*8px/);
  assert.match(mobileCss, /\.circle-post-card\s*\{[\s\S]*?padding:\s*12px 14px/);
  assert.match(mobileCss, /\.circle-avatar\s*\{[\s\S]*?width:\s*34px/);
  assert.match(mobileCss, /\.circle-replies\s*\{[\s\S]*?gap:\s*4px/);
  assert.match(mobileCss, /\.circle-reply-form input\s*\{[\s\S]*?min-height:\s*36px/);
});

test("mobile home nearby feed uses synced colleague posts with local avatars", () => {
  const mobileJs = fs.readFileSync(path.join(root, "mobile.js"), "utf8");
  const mobileCss = fs.readFileSync(path.join(root, "mobile-components.css"), "utf8");
  const mobileDataSource = fs.readFileSync(path.join(root, "mobile-data.js"), "utf8");
  const sandbox = { window: {} };

  vm.runInNewContext(mobileDataSource, sandbox);
  const mock = sandbox.window.NB_MOCK;
  const nearbyNames = mock.nearbyPosts.map((post) => post.name).slice(0, 6).join(",");
  const nearbyTitles = mock.nearbyPosts.map((post) => post.title).join("\n");

  assert.equal(nearbyNames, "王启明,林晓悦,陈海宁,沈清禾,赵明远,刘雨桐");
  assert.match(nearbyTitles, /下班前能帮带一件中通快递吗？ #跑腿互助/);
  assert.match(nearbyTitles, /我在菜鸟驿站附近，可以顺路帮带 #跑腿互助/);
  assert.match(nearbyTitles, /折叠小推车今晚可借 #物品共享/);
  assert.match(nearbyTitles, /今晚楼下桂花香好明显 #邻友圈/);
  assert.match(nearbyTitles, /想借一把电钻装窗帘 #物品共享/);
  assert.match(nearbyTitles, /周六亲子跳蚤小摊报名 #邻里动态/);
  assert.ok(mock.nearbyPosts.slice(0, 6).every((post) => post.avatar.startsWith("assets/avatars/")));
  assert.equal(mock.nearbyPosts.some((post) => post.avatar.includes("randomuser.me")), false);
  assert.ok(mock.nearbyPosts.slice(0, 6).every((post) => post.count && post.tag));
  assert.match(mobileJs, /function NearbyAvatar/);
  assert.match(mobileJs, /class="mini-avatar-image"/);
  assert.match(mobileJs, /class="nearby-title"/);
  assert.match(mobileJs, /class="post-status"/);
  assert.match(mobileCss, /\.mini-avatar-image/);
  assert.match(mobileCss, /\.nearby-title/);
});

test("mobile assistant exposes upgraded AI workspace and voice input", () => {
  const mobileJs = fs.readFileSync(path.join(root, "mobile.js"), "utf8");
  const mobileCss = fs.readFileSync(path.join(root, "mobile-components.css"), "utf8");

  assert.match(mobileJs, /let voiceRecognition/);
  assert.match(mobileJs, /let isRecordingVoice/);
  assert.match(mobileJs, /function renderAssistant/);
  assert.match(mobileJs, /assistant-page-shell/);
  assert.match(mobileJs, /assistant-hero-header/);
  assert.match(mobileJs, /说一句话，匹配顺路互助/);
  assert.match(mobileJs, /assistant-example-row/);
  assert.match(mobileJs, /data-assistant-example/);
  assert.match(mobileJs, /assistant-workspace/);
  assert.match(mobileJs, /assistant-conversation-panel/);
  assert.match(mobileJs, /id="assistantVoice"/);
  assert.match(mobileJs, /function AssistantEmptyState/);
  assert.match(mobileJs, /function startAssistantVoice/);
  assert.match(mobileJs, /function stopAssistantVoice/);
  assert.match(mobileJs, /SpeechRecognition \|\| window\.webkitSpeechRecognition/);
  assert.match(mobileJs, /voiceStatusText/);
  assert.match(mobileJs, /button\.dataset\.assistantExample/);
  assert.match(mobileJs, /startAssistantVoice\(\)/);
  assert.match(mobileJs, /stopAssistantVoice\(\)/);
  assert.match(mobileJs, /assistantSourceNote/);
  assert.match(mobileCss, /\.assistant-page-shell/);
  assert.match(mobileCss, /\.assistant-hero-header/);
  assert.match(mobileCss, /\.assistant-example-row/);
  assert.match(mobileCss, /\.assistant-workspace/);
  assert.match(mobileCss, /\.assistant-conversation-panel/);
  assert.match(mobileCss, /\.assistant-empty-card/);
  assert.match(mobileCss, /\.voice-action/);
  assert.match(mobileCss, /\.voice-status/);
});

test("mobile errand quick action opens a full orderable service page", () => {
  const mobileHtml = fs.readFileSync(path.join(root, "mobile.html"), "utf8");
  const mobileJs = fs.readFileSync(path.join(root, "mobile.js"), "utf8");
  const mobileCss = fs.readFileSync(path.join(root, "mobile-components.css"), "utf8");
  const mobileDataSource = fs.readFileSync(path.join(root, "mobile-data.js"), "utf8");
  const sandbox = { window: {} };

  vm.runInNewContext(mobileDataSource, sandbox);
  const mock = sandbox.window.NB_MOCK;

  assert.match(mobileHtml, /id="screen-errand"/);
  assert.equal(mock.quickActions.find((item) => item.id === "errand").target, "errand");
  assert.equal(Boolean(mock.quickActions.find((item) => item.id === "errand").compose), false);
  assert.ok(mock.errandServices.length >= 6);
  assert.ok(mock.errandServices.every((service) => service.id && service.price && service.reward));
  assert.match(mobileJs, /let selectedErrandServiceId/);
  assert.match(mobileJs, /function renderErrandServices/);
  assert.match(mobileJs, /function ErrandServiceCard/);
  assert.match(mobileJs, /function placeErrandOrder/);
  assert.match(mobileJs, /data-errand-service-id/);
  assert.match(mobileJs, /id="errandContact"/);
  assert.match(mobileJs, /id="errandPhone"/);
  assert.match(mobileJs, /id="errandAddress"/);
  assert.match(mobileJs, /id="errandTime"/);
  assert.match(mobileJs, /id="errandOrderSubmit"/);
  assert.match(mobileJs, /createOrderFromTask\(\{\s*title:\s*service\.title/);
  assert.match(mobileCss, /\.errand-hero/);
  assert.match(mobileCss, /\.errand-service-card/);
  assert.match(mobileCss, /\.errand-order-form/);
  assert.match(mobileCss, /\.errand-submit-bar/);
});

test("mobile errand and credit sheets expose service rules", () => {
  const mobileHtml = fs.readFileSync(path.join(root, "mobile.html"), "utf8");
  const mobileJs = fs.readFileSync(path.join(root, "mobile.js"), "utf8");
  const mobileCss = fs.readFileSync(path.join(root, "mobile-components.css"), "utf8");
  const mobileBaseCss = fs.readFileSync(path.join(root, "mobile.css"), "utf8");
  const mobileDataSource = fs.readFileSync(path.join(root, "mobile-data.js"), "utf8");
  const sandbox = { window: {} };

  vm.runInNewContext(mobileDataSource, sandbox);
  const mock = sandbox.window.NB_MOCK;

  assert.match(mobileHtml, /id="errandRuleSheet"/);
  assert.match(mobileHtml, /id="errandRuleBody"/);
  assert.match(mobileHtml, /id="closeErrandRules"/);
  assert.equal(mock.errandServiceRules.map((rule) => rule.id).join(","), "pickup,delivery,meal,repair");
  assert.equal(mock.highRiskServiceRules.map((rule) => rule.id).join(","), "child_pickup,elder_care,pet_care,home_repair");
  assert.ok(mock.errandServices.every((service) => service.ruleId));
  assert.ok(mock.errandServiceRules.every((rule) => rule.summary && rule.standards.length && rule.flow.length));
  assert.ok(mock.highRiskServiceRules.every((rule) => rule.level && rule.points.length >= 3));
  assert.match(mobileJs, /function selectedErrandRule/);
  assert.match(mobileJs, /function renderErrandRuleSheet/);
  assert.match(mobileJs, /function openErrandRules/);
  assert.match(mobileJs, /function closeErrandRules/);
  assert.match(mobileJs, /function renderHighRiskRules/);
  assert.match(mobileJs, /data\.errandServiceRules\.find/);
  assert.match(mobileJs, /data\.highRiskServiceRules/);
  assert.match(mobileJs, /if \(action === "show-errand-rule"\) openErrandRules\(\)/);
  assert.match(mobileJs, /selectedErrandServiceId = button\.dataset\.errandServiceId;[\s\S]*renderErrandRuleSheet\(\);/);
  assert.match(mobileCss, /\.errand-rule-sheet/);
  assert.match(mobileCss, /\.errand-rule-body/);
  assert.match(mobileCss, /\.service-rule-block/);
  assert.match(mobileCss, /\.high-risk-rule-grid/);
  assert.match(mobileBaseCss, /\.errand-rule-sheet\.open/);
});

test("mobile profile exposes credit center rules, verification uploads, and ranking", () => {
  const mobileHtml = fs.readFileSync(path.join(root, "mobile.html"), "utf8");
  const mobileJs = fs.readFileSync(path.join(root, "mobile.js"), "utf8");
  const mobileCss = fs.readFileSync(path.join(root, "mobile-components.css"), "utf8");
  const mobileData = fs.readFileSync(path.join(root, "mobile-data.js"), "utf8");

  assert.match(mobileHtml, /id="creditRuleSheet"/);
  assert.match(mobileHtml, /id="creditProofInput"/);
  assert.match(mobileData, /creditRules/);
  assert.match(mobileData, /creditRanking/);
  assert.match(mobileData, /实名人脸/);
  assert.match(mobileData, /无犯罪记录/);
  assert.match(mobileData, /涉及人身安全、入户隐私、财产资金、需要专业资质部分服务。/);
  assert.match(mobileData, /保险/);
  assert.match(mobileJs, /查看信用分说明/);
  assert.match(mobileJs, /data-action="open-credit-rules"/);
  assert.match(mobileJs, /data-proof-type="identity"/);
  assert.match(mobileJs, /信用分排行/);
  assert.match(mobileJs, /function renderCreditRuleSheet/);
  assert.match(mobileJs, /function handleCreditProofUpload/);
  assert.match(mobileJs, /<img class="ranking-avatar"/);
  assert.match(mobileJs, /src="\$\{item\.avatar\}"/);
  assert.doesNotMatch(mobileJs, /<span>\$\{item\.rank\}<\/span>/);
  assert.match(mobileCss, /\.credit-rule-sheet/);
  assert.match(mobileCss, /\.profile-verification-grid/);
  assert.match(mobileCss, /\.credit-ranking-list/);
  assert.match(mobileCss, /\.ranking-avatar/);
  assert.match(mobileData, /avatar:\s*"assets\/avatars\/teacher-woman\.png"/);
  assert.match(mobileData, /avatar:\s*"assets\/avatars\/veteran-man\.png"/);
});

test("mobile profile credit score uses green compact card with photo upload", () => {
  const mobileJs = fs.readFileSync(path.join(root, "mobile.js"), "utf8");
  const mobileCss = fs.readFileSync(path.join(root, "mobile-components.css"), "utf8");

  assert.match(mobileJs, /profile-credit-panel/);
  assert.match(mobileJs, /profile-photo-upload/);
  assert.match(mobileJs, /profile-action-row/);
  assert.match(mobileJs, /profile-credit-panel[\s\S]*profile-photo-upload[\s\S]*profile-score[\s\S]*<\/div>\s*<div>\s*<h2>/);
  assert.doesNotMatch(mobileJs, /profile-action-row[\s\S]*profile-score/);
  assert.match(mobileJs, /data-action="upload-profile-photo"/);
  assert.match(mobileJs, /上传个人照片/);
  assert.match(mobileCss, /\.profile-card\s*\{[\s\S]*?grid-template-columns:\s*92px 1fr/);
  assert.match(mobileCss, /\.profile-card\s*\{[\s\S]*?align-items:\s*start/);
  assert.match(mobileCss, /\.profile-score\s*\{[\s\S]*?width:\s*58px/);
  assert.match(mobileCss, /\.profile-score\s*\{[\s\S]*?height:\s*44px/);
  assert.match(mobileCss, /\.profile-score\s*\{[\s\S]*?background:\s*linear-gradient\(145deg,\s*#2f8f5b,\s*#63c982\)/);
  assert.match(mobileCss, /\.profile-score\s*\{[\s\S]*?font-size:\s*21px/);
  assert.match(mobileCss, /\.profile-photo-upload\s*\{[\s\S]*?width:\s*72px/);
  assert.match(mobileCss, /\.profile-photo-upload\s*\{[\s\S]*?height:\s*116px/);
  assert.match(mobileCss, /\.profile-photo-upload\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(mobileCss, /\.profile-action-row\s*\{[\s\S]*?align-items:\s*center/);
});

test("mobile profile photo crops to ellipse and supports drag repositioning", () => {
  const mobileJs = fs.readFileSync(path.join(root, "mobile.js"), "utf8");
  const mobileCss = fs.readFileSync(path.join(root, "mobile-components.css"), "utf8");

  assert.match(mobileJs, /avatarPosition/);
  assert.match(mobileJs, /function avatarPositionStyle/);
  assert.match(mobileJs, /object-position:\s*\$\{profileState\.avatarPosition\.x\}% \$\{profileState\.avatarPosition\.y\}%/);
  assert.match(mobileJs, /function updateAvatarPositionViews/);
  assert.match(mobileJs, /function handleAvatarDragMove/);
  assert.match(mobileJs, /pointerdown/);
  assert.match(mobileJs, /pointermove/);
  assert.match(mobileJs, /pointerup/);
  assert.match(mobileJs, /setPointerCapture/);
  assert.match(mobileJs, /suppressNextAvatarUploadClick/);
  assert.match(mobileCss, /\.profile-photo-upload\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.match(mobileCss, /\.profile-photo-upload\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(mobileCss, /\.profile-photo-upload img\s*\{[\s\S]*?object-fit:\s*cover/);
  assert.match(mobileCss, /\.profile-photo-upload img\s*\{[\s\S]*?object-position:\s*var\(--avatar-position,\s*50% 50%\)/);
  assert.match(mobileCss, /\.profile-photo-upload img\s*\{[\s\S]*?cursor:\s*grab/);
  assert.match(mobileCss, /\.profile-photo-upload\s*\{[\s\S]*?touch-action:\s*none/);
});

test("mobile experience exposes Monad wallet and escrow actions", () => {
  const mobileHtml = fs.readFileSync(path.join(root, "mobile.html"), "utf8");
  const mobileJs = fs.readFileSync(path.join(root, "mobile.js"), "utf8");
  const mobileCss = fs.readFileSync(path.join(root, "mobile-components.css"), "utf8");

  assert.match(mobileHtml, /ethers\.umd\.min\.js[\s\S]*web3-config\.js[\s\S]*web3-client\.js[\s\S]*mobile\.js/);
  assert.match(mobileJs, /function connectMonadWallet/);
  assert.match(mobileJs, /function createEscrowForOrder/);
  assert.match(mobileJs, /function runEscrowAction/);
  assert.match(mobileJs, /data-action="connect-wallet"/);
  assert.match(mobileJs, /data-escrow-action="acceptTask"/);
  assert.match(mobileJs, /data-escrow-action="markCompleted"/);
  assert.match(mobileJs, /data-escrow-action="approveAndRelease"/);
  assert.match(mobileJs, /链上只保存任务摘要哈希和资金状态/);
  assert.doesNotMatch(mobileJs, /taskDigestInput[\s\S]{0,160}(phone|address|contact)/);
  assert.match(mobileCss, /\.wallet-button/);
  assert.match(mobileCss, /\.escrow-panel/);
  assert.match(mobileCss, /\.chain-progress/);
});
