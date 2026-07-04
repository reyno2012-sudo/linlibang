# 邻里帮 Agent Demo

这是一个「社区互助 + Agent 发单 + 信用风控」原型，包含移动端首页、居民端任务发布、工具借用、候选人匹配、订单履约、用户信用分和高风险场景安全管控。

## 已实现

- 移动端首页：暖白背景、社区感 Hero、快捷入口、附近动态、底部导航。
- 个人资料：点击头像可上传本地照片并修改昵称，头像圆形裁剪展示。
- Agent 任务解析：识别代取快递、小型搬运、工具借用、陪诊调度、儿童接送、老人陪护、遛宠照看、上门维修等需求。
- 任务卡可编辑：Agent 整理出的时间、位置、预算可点击修改。
- 信用风控系统：信用分、信用等级、熟人背书、试用期、高危服务权限、信用事件扣分/封禁。
- 高风险场景闭环：儿童接送、老人陪护、遛宠、上门维修分别生成准入门槛、电子授权、拍照留痕、GPS/录音占位、禁令、资金托管和保险规则。
- 候选人匹配：按信用分、准入资格、证书标签、距离、报价、响应速度排序。
- 订单流转：待确认、已接单、服务中、待验收、已完成、争议中。
- 后端 API：Node.js 原生 HTTP 服务，无需安装第三方依赖，JSON 文件持久化。

## 风控策略摘要

- 低风险订单：实名、小区居住核验、信用分 80+。
- 遛宠/上门维修：信用分 85-90+，需要轨迹/拍照/责任协议，禁止私自转交或扩大服务范围。
- 儿童接送：信用分 95+，三重实名、小区居住核验、无犯罪记录、试用期完成、监护人电子授权、接送节点拍照、GPS 轨迹留存。
- 老人陪护：信用分 92+，无犯罪记录、家属联系人绑定、服务时间限制、进门/离开拍照、录音留存占位。
- 安全投诉：扣 18 分，并永久关闭儿童接送和老人陪护权限。
- 严重事故：扣至 0 分，关闭全部接单权限并留存证据。

> 当前实现是产品规则和工程占位，不构成法律意见。上线前仍需要接入合规实名、无犯罪记录复核、保险、支付托管、隐私协议和法律审查。

## 运行后端

```powershell
npm start
```

默认地址：

```text
http://127.0.0.1:3001/
http://127.0.0.1:3001/mobile.html
```

配置项见 `.env.example`。当前实现不依赖 dotenv，如需修改端口可直接在 PowerShell 设置环境变量：

```powershell
$env:PORT="3002"; npm start
```

## 测试

```powershell
npm test
```

测试覆盖：

- 任务解析与候选人匹配
- 工单创建和状态推进
- 工具借用生成工单
- 空输入结构化校验错误
- 儿童接送高危风控准入
- 安全投诉扣分并关闭高危权限
- 移动端任务字段可编辑
- 移动端信用/安全规则展示

## API 概览

```text
GET    /health
GET    /ready
GET    /api/profile
GET    /api/users
GET    /api/tools
GET    /api/orders
GET    /api/community/feed
GET    /api/risk/policy
POST   /api/tasks/parse
POST   /api/orders
POST   /api/users/:id/credit-events
PATCH  /api/orders/:id/advance
PATCH  /api/orders/:id/evidence
PATCH  /api/orders/:id/dispute
POST   /api/tools/:id/borrow
```

示例：

```powershell
Invoke-WebRequest `
  -Uri "http://127.0.0.1:3001/api/tasks/parse" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"text":"明天下午帮我到实验小学接孩子，放学后送到 3 栋单元门口，预算 30 元。"}'
```

信用事件示例：

```powershell
Invoke-WebRequest `
  -Uri "http://127.0.0.1:3001/api/users/u-105/credit-events" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"type":"safety_complaint","note":"儿童接送路线偏离超过 3 分钟"}'
```

## 目录

```text
server/
  index.js                     # 服务入口和优雅关闭
  src/app.js                   # HTTP 路由、静态文件服务、统一错误响应
  src/config.js                # 环境配置
  src/data/store.js            # JSON 文件存储和 seed 合并
  src/neighborhood/seed.js     # 初始用户、信用、工具、动态数据
  src/neighborhood/service.js  # 任务解析、信用风控、匹配、订单、工具借用业务规则
  tests/neighborhood.test.js   # 后端行为测试
```

## 下一步建议

1. 接入真实账号体系：手机号登录、小区认证、角色权限。
2. 接入合规第三方实名、人脸、无犯罪证明人工复核流程。
3. 将 JSON store 替换为 SQLite 或 PostgreSQL，并加入迁移脚本。
4. 接入支付托管、短期订单保险、文件上传和证据云存储。
5. 前端接入 API client，把当前 localStorage/mock 数据逐步替换为后端数据。
