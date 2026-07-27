# ym 交接 — 2026-07-27 收盘

工作区干净，全部已上线，`node scripts/check-ym.mjs` 全绿。下一个会话从这里接。

---

## 环境（都已配好，不用再动）

| | 状态 |
|---|---|
| 迁移 | **0017 已应用**（0008–0017 全部） |
| SMTP | Resend，验证域 `send.jjconnect.tokyo`，发件人 `no-reply@send.jjconnect.tokyo` |
| Drive | `YM_DRIVE_EXEC` 已配，`/api/ym_file` 回 `{"drive":true}`，端到端传过真文件 |
| Drive 目录 | `18L2vEdBUukj0qTY4qkNLrYz5Ty7sww3m/<活动 · 日期>/<票据｜报名表｜名单｜附件>/` |

Apps Script：**只能上传**，没有密钥、没有删除（owner：「我不能接受账户风险」）。删除会以主办身份跑、能清空网盘，所以整个能力不存在；错拍的票据手动去 Drive 删。

---

## 下次要做的三件（按顺序）

### 1. Y8 总账前端重新拼装 ← 主要工作
设计全文在 `docs/y8_*.md`（recommendation / sql / appChanges / ledger / buildOrder / openIssues）。
`0017_ym_ledger.sql` 已应用，表 `ym_entry` 在线上。

**已经做好、直接用**：`docs/y8_A1_drive_adapted.js` —— 票据模块（rcShoot/rcParse/rcCard/rcConfirm/
rcUpload/rcSettle/rcImage），**已按 Drive 改写**：图片先 `POST /api/ym_file` 拿 `{file_id,url}`，
表里只存 `image_id`/`image_url`，不存 base64。

⚠ **上次就栽在这**：我写了个按 `## A\d+.` 分节的抽取脚本，**A10 那节被截断**（`giveStrip` 函数体
只剩一半），拼进去文件就不解析了。**别再用分节器 —— 直接从 `docs/y8_appChanges.md` 原文手工取
A10 和 A9**，取完先 `new Function()` 单独验一遍再拼。

四处入口（A5 主办台 · A7 任务 · A9 复盘 · A10 捐助者）+ `viewLedger`（在 `docs/y8_ledger.md`）。

### 2. `confirmTickets` 不产生账目记录
设计发现的真 bug：门票入账只改 `chip.actual`，**不写 `ym_entry`** —— 总账里会有全部支出却没有
门票收入，一本对不平的账。A11 有修法（一条幂等的 `src='ticket'` 内部凭证）。

### 3. 问 owner 一句：沙龙是**免税**还是**課税**事業者
按 `¥6,000 × 20 人 × 50 场 ≈ ¥600 万` 估，大概率在 ¥1,000 万门槛以下 = 免税；就算登记了，
**2割特例覆盖令和8年分**。所以 `taxMode` 默认 `exempt`，整套インボイス机制不显示。
**按税率分行的数据两种情况都存**（`parse.py` 反正返回，存一列不要钱）。

---

## 待观察

- **主办注册**：owner 报「发放的注册码无法成为主办」。判断是 SMTP 上线后暴露的回归 ——
  码存 localStorage 只活 30 分钟，而确认邮件的链接常在手机邮件 app 里打开（另一个存储源）。
  已改成 7 天并把「登录时粘码」这条路说清楚。**owner 还没回报是否解决**；如果仍失败，
  `redeemInvite` 会区分「无效或已用完」「已经开通」「本机还没登记」，让 owner 报原文即可定位。
- **抢单并发**：单赢家性质是论证的、不是观测的。owner 说「竞争不需要那么清晰」，不必专门验。

---

## 今天上线了什么

角色编码体系（邀请码/用户编码分开，登录只用邮箱，自助改密码）· 志愿者任务系统（难度·星级门槛·
交任务·交付投影·退回·一键发布·抢单）· 嘉宾公开页 + 我想参加闭环 · 用户一览 tab · 复盘区分
本人申报/主办登记 · **全 app 线条图标**（owner universal rule，彻底去 emoji）· 相机圆钮下页面 ·
Drive 上传代理。

---

## 这个 repo 的规矩（血泪版）

1. **只在本仓库写**。兄弟仓库（monospages/rakusat 等）只读参考 —— 需要那边改动就告诉 owner 切过去。
2. **浏览器里点一下**。套件全绿 + 解析通过**不等于**能用：`jeStatus` 读错了分段控件，289 项检查
   全过。
3. **动过就跑对抗式复查**。每一次都找出真 bug，包括两个账号接管级的。
4. **危险的 bug 在「组合」里**：0009 让 `ym_share.member` 可被主办写，无害了很久，直到 0015 让它
   变成承重件。新代码开始信任旧列时，去读那列真正被什么守着。
5. `esc()` 在 `on*="f('…')"` 里**不安全** —— 解析器先解实体再编译 JS。用 `escJs()`/`escq()`。
6. **两个 app 是独立单文件**，CSS 类和函数都不共享。改一个记得看另一个。
7. 永远不要重写 `chip.status` 语义或 `RES_ST`。
