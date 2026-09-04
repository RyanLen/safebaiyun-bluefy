# Mobile Keyring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已经能在 Bluefy 真机开锁的单门页面升级为可持久化多个门禁、首页一键发起开锁并支持 JSON 导入导出的移动端钥匙夹。

**Architecture:** 保持无框架静态站点，把协议、存储、BLE 会话和 DOM 界面拆成传统 `defer` 脚本。核心数据与 BLE 依赖通过参数注入，使 Node 内置测试运行器可以在没有浏览器和门锁的环境中覆盖真实控制流。

**Tech Stack:** HTML5、CSS、浏览器原生 JavaScript、Web Bluetooth、Web Storage、Clipboard API、Node.js `node:test`、GitHub Pages。

**Spec:** `docs/superpowers/specs/2026-09-04-mobile-keyring-design.md`

## Global Constraints

- 只面向手机视口；桌面只居中显示最大 520px 画布。
- 不使用框架、UI 库、第三方脚本、CDN、外部字体或后端。
- 保持服务 UUID `14839ac4-7d7e-415c-9a42-167340cf2339`、DES 算法和 20 字节握手帧不变。
- 本地存储键固定为 `safebaiyun.doors.v1`，JSON 格式版本固定为 `1`。
- 日志不得包含完整 `PRODUCT_KEY`，页面不得发送门禁参数到网络。
- 所有新增行为遵循测试先失败、最小实现、测试通过的循环。

---

### Task 1: 拆分静态资源并锁定现有协议

**Files:**
- Modify: `index.html`
- Create: `styles.css`
- Create: `core.js`
- Create: `tests/helpers/load-script.mjs`
- Modify: `tests/bluefy-core.test.mjs`

**Interfaces:**
- Produces: `globalThis.SafeBaiyunCore`，包含 `SERVICE_UUID`、`normalizeBluetoothName(value)`、`buildDeviceRequestOptions(value)`、`parseMac(value)`、`hexToBytes(value)`、`bytesToHex(bytes)`、`desEncryptBlock(block,key)`、`buildUnlockFrame(challenge,mac,key)`、`runDesSelfTest()`。

- [x] **Step 1: 写拆分后的协议特征测试**

```js
test("已验证的握手帧在资源拆分后保持不变", () => {
  const core = loadScript("core.js").SafeBaiyunCore;
  const frame = core.buildUnlockFrame(
    core.hexToBytes("01020304"),
    core.hexToBytes("AABBCCDDEEFF"),
    core.hexToBytes("0123456789ABCDEF")
  ).frame;
  assert.equal(core.bytesToHex(frame), "A51405CCDDEEFF0001075F24E313C59D06EB7D5A");
});
```

- [x] **Step 2: 运行测试并确认因 `core.js` 尚不存在而失败**

Run: `node --test tests/bluefy-core.test.mjs`
Expected: FAIL，错误明确指向无法加载 `core.js`。

- [x] **Step 3: 将 CSS 与纯协议代码机械拆出**

`index.html` 改为加载：

```html
<link rel="stylesheet" href="./styles.css">
<script defer src="./core.js"></script>
```

`core.js` 保留现有函数实现并在末尾挂载：

```js
globalThis.SafeBaiyunCore = Object.freeze({
  SERVICE_UUID,
  normalizeBluetoothName,
  buildDeviceRequestOptions,
  parseMac,
  hexToBytes,
  bytesToHex,
  desEncryptBlock,
  buildUnlockFrame,
  runDesSelfTest
});
```

- [x] **Step 4: 运行协议测试并确认全部通过**

Run: `node --test tests/bluefy-core.test.mjs`
Expected: 当前 4 项测试及固定握手帧测试全部 PASS。

- [x] **Step 5: 提交协议拆分**

```bash
git add index.html styles.css core.js tests
git commit -m "refactor: isolate Bluefy protocol core"
```

### Task 2: 门禁模型、版本化 JSON 与本地存储

**Files:**
- Modify: `core.js`
- Create: `store.js`
- Create: `tests/door-config.test.mjs`

**Interfaces:**
- Produces: `SafeBaiyunCore.validateDoor(input)` → `{ ok, errors, value }`。
- Produces: `SafeBaiyunCore.exportDoorBundle(doors)` → 格式化 JSON 字符串。
- Produces: `SafeBaiyunCore.importDoorBundle(text)` → 无 `id` 的规范化门禁数组；任一项错误时抛出且不返回部分结果。
- Produces: `SafeBaiyunCore.mergeDoors(current,incoming,idFactory)` → `{ doors, added, updated }`。
- Produces: `SafeBaiyunStore.create(storage)` → `{ load(), save(doors) }`。

- [x] **Step 1: 写合法门禁规范化与逐字段错误测试**

```js
assert.deepEqual(validateDoor({
  name: " 东门 ", mac: "aa-bb-cc-dd-ee-ff",
  bluetoothName: " by-aa:12 ", productKey: "01 23 45 67 89 ab cd ef"
}).value, {
  name: "东门", mac: "AA:BB:CC:DD:EE:FF",
  bluetoothName: "BYAA12", productKey: "0123456789ABCDEF"
});
assert.equal(validateDoor({ name: "", mac: "x", bluetoothName: "", productKey: "1" }).ok, false);
```

- [x] **Step 2: 运行测试并确认新接口缺失**

Run: `node --test tests/door-config.test.mjs`
Expected: FAIL，`validateDoor is not a function`。

- [x] **Step 3: 实现门禁规范化和校验**

校验规则：门名去首尾空格后 1–30 字；MAC 规范化为六段大写十六进制；蓝牙名只保留大写字母数字且 1–20 字；Key 为 16–32 位偶数长度十六进制。

- [x] **Step 4: 写导出、原子导入和重复合并测试**

```js
const text = exportDoorBundle([{ id: "local", ...door }]);
assert.equal(JSON.parse(text).doors[0].id, undefined);
assert.throws(() => importDoorBundle('{"version":2,"doors":[]}'), /不支持的配置版本/);
assert.deepEqual(mergeDoors([doorA], [{ ...doorA, name: "新东门" }], () => "new"), {
  doors: [{ ...doorA, name: "新东门" }], added: 0, updated: 1
});
```

- [x] **Step 5: 运行测试确认失败，再实现 JSON 与合并接口**

Run: `node --test tests/door-config.test.mjs`
Expected before implementation: FAIL；after implementation: PASS。

- [x] **Step 6: 写存储损坏、保存和刷新恢复测试**

使用内存实现 `{ getItem, setItem }`；断言损坏 JSON 返回 `{ doors: [], error }`，保存后新 store 实例能读回等价门禁。

- [x] **Step 7: 实现 `SafeBaiyunStore` 并运行全部测试**

Run: `node --test tests/*.test.mjs`
Expected: 全部 PASS。

- [x] **Step 8: 提交数据层**

```bash
git add core.js store.js tests/door-config.test.mjs
git commit -m "feat: add local multi-door configuration"
```

### Task 3: 可复用 BLE 解锁会话与可靠设备选择

**Files:**
- Create: `ble.js`
- Create: `tests/ble-session.test.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: `SafeBaiyunCore.buildDeviceRequestOptions()` 与 `buildUnlockFrame()`。
- Produces: `SafeBaiyunBle.create({ bluetooth, onEvent, wait })` → `{ unlock(door), disconnect() }`。
- `onEvent({ phase, tone, message, detail? })` 的 `phase` 仅为 `select|connect|read|compute|write|done|error|disconnected`。

- [x] **Step 1: 写每次重新选择设备测试**

给 `getDevices()` 返回一个无法连接的同名缓存设备，同时让 `requestDevice()` 返回正常设备；断言流程不调用 `getDevices()`，并最终把固定 20 字节帧写入正常设备。

- [x] **Step 2: 运行并确认因 `ble.js` 缺失而失败**

Run: `node --test tests/ble-session.test.mjs`
Expected: FAIL，无法加载 `ble.js`。

- [x] **Step 3: 实现设备选择与现有 GATT 流程**

```js
async function chooseDevice(door) {
  return bluetooth.requestDevice(buildDeviceRequestOptions(door.bluetoothName));
}
```

Bluefy 的缓存设备句柄可能失效，因此每次都沿用旧版真机成功的设备选择器。连接、服务发现、通知订阅、挑战读取、帧写入顺序保持不变；写入后等待 900ms 再断开。

- [x] **Step 4: 写未授权设备回退、取消和 GATT 错误测试**

断言无匹配设备时调用带名称过滤的 `requestDevice()`；`NotFoundError` 映射为“已取消选择设备”；服务缺失映射为错误事件并执行断开。

- [x] **Step 5: 实现错误映射并运行全部测试**

Run: `node --test tests/*.test.mjs`
Expected: 全部 PASS，固定握手帧不变。

- [x] **Step 6: 提交 BLE 会话层**

```bash
git add ble.js index.html tests/ble-session.test.mjs
git commit -m "refactor: make unlock flow reusable per door"
```

### Task 4: 移动端钥匙首页和完整视觉状态

**Files:**
- Rewrite: `index.html`
- Rewrite: `styles.css`
- Create: `app.js`
- Create: `tests/app-render.test.mjs`

**Interfaces:**
- Consumes: `SafeBaiyunStore.create(localStorage)` 与 `SafeBaiyunBle.create(...)`。
- Produces: `SafeBaiyunApp.renderHome(doors, session)`、`renderManage(doors)`、`renderEditor(draft,errors)`、`renderSession(session)`，均返回可直接插入容器的安全 HTML。

- [x] **Step 1: 写首页空状态和多门禁渲染测试**

```js
assert.match(renderHome([], idle), /添加第一个门禁/);
const html = renderHome([eastDoor, garageDoor], idle);
assert.equal((html.match(/data-action="unlock"/g) || []).length, 2);
assert.match(html, /东门/);
assert.doesNotMatch(html, /0123456789ABCDEF/);
```

- [x] **Step 2: 运行并确认渲染接口缺失**

Run: `node --test tests/app-render.test.mjs`
Expected: FAIL，无法加载 `app.js` 或接口不存在。

- [x] **Step 3: 实现语义页面骨架和安全渲染函数**

所有用户文本先经过 `escapeHtml`；首页卡片仅显示门名、蓝牙名和遮蔽后的 MAC。底部导航使用原生 `<button>`，通过 `aria-current` 表示当前页。

- [x] **Step 4: 实现设计令牌和手机布局**

```css
:root {
  --bg: #0c0d0b; --surface: #171814; --surface-raised: #20211c;
  --text: #f3efe4; --muted: #9c9b92; --line: #34362f;
  --action: #ffb000; --success: #79d990; --danger: #ff715f;
  --radius-card: 18px; --radius-control: 14px;
}
.app-shell { width: min(100%, 520px); min-height: 100dvh; margin: 0 auto; }
.bottom-nav { padding-bottom: max(10px, env(safe-area-inset-bottom)); }
```

门禁按钮最小高度 64px；内容底部留出导航安全距离；390×844 与 430×932 不产生横向滚动。

- [x] **Step 5: 写 BLE 进行中、成功、失败状态渲染测试并实现**

进行中禁用同一门禁的重复点击；成功文案为“指令已写入”，错误状态提供 `retry` 和 `show-diagnostics` 动作。

- [x] **Step 6: 运行测试并提交 UI 壳层**

Run: `node --test tests/*.test.mjs`
Expected: 全部 PASS。

```bash
git add index.html styles.css app.js tests/app-render.test.mjs
git commit -m "feat: build mobile-first door keyring"
```

### Task 5: 门禁增删改与 JSON 迁移交互

**Files:**
- Modify: `app.js`
- Modify: `index.html`
- Modify: `styles.css`
- Create: `tests/app-actions.test.mjs`

**Interfaces:**
- Produces: `SafeBaiyunApp.createController({ store, ble, clipboard, idFactory })`。
- Controller methods: `addDoor(input)`、`updateDoor(id,input)`、`deleteDoor(id)`、`importJson(text)`、`exportJson()`、`unlockDoor(id)`。

- [x] **Step 1: 写新增、编辑、删除后立即持久化测试**

断言合法新增返回门禁并调用一次 `store.save`；非法新增返回逐字段错误且不保存；更新保留 `id`；删除只影响目标门禁。

- [x] **Step 2: 运行确认控制器接口缺失，再实现最小 CRUD**

Run: `node --test tests/app-actions.test.mjs`
Expected before implementation: FAIL；after implementation: CRUD tests PASS。

- [x] **Step 3: 写导出复制、剪贴板失败和原子导入测试**

成功时断言写入剪贴板的文本可被 `importDoorBundle` 读回；剪贴板拒绝时返回 `{ copied:false,text }`；坏 JSON 不调用 `store.save`；重复导入返回准确 `added/updated`。

- [x] **Step 4: 实现编辑页、删除确认和导入导出底部面板**

编辑页保持输入；导入面板包含多行文本框、合并规则说明和提交按钮；导出面板显示敏感配置警告、复制按钮及手动选择文本的后备区域。

- [x] **Step 5: 实现事件委托并运行全部测试**

Run: `node --test tests/*.test.mjs`
Expected: 全部 PASS；用户提供的门名不得进入 `innerHTML` 未转义位置。

- [x] **Step 6: 提交管理与迁移功能**

```bash
git add app.js index.html styles.css tests/app-actions.test.mjs
git commit -m "feat: manage and share door configurations"
```

### Task 6: 文档、视觉检查、真机回归入口与部署

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-09-04-mobile-keyring.md`

**Interfaces:**
- Consumes: 所有前述模块和测试。
- Produces: GitHub Pages 上可直接使用的完整移动端应用。

- [x] **Step 1: 更新 README**

说明多门禁、明文本地存储、JSON 内含密钥、Bluefy 使用方式、清除本站数据的方法和测试命令 `node --test tests/*.test.mjs`。

- [x] **Step 2: 运行完整自动验证**

Run: `node --test tests/*.test.mjs && git diff --check`
Expected: 0 failures，退出码 0。

- [x] **Step 3: 启动本地静态服务器并检查手机视口**

Run: `python3 -m http.server 4173`
检查 390×844、430×932：无横向滚动；底部导航不遮挡按钮；空状态、两门禁列表、编辑页、导入导出和 BLE 状态层均可触达。

本地服务器与全部资源响应 200；当前执行环境没有可用浏览器实例，手机视口改由响应式约束审查和完整状态渲染测试覆盖，最终视觉仍需在 Bluefy 真机复核。

- [x] **Step 4: 运行安全检查**

Run: `rg -n 'fetch\(|XMLHttpRequest|sendBeacon|WebSocket' index.html app.js core.js store.js ble.js`
Expected: 无匹配；完整 Key 只存在表单、内存、localStorage 与用户主动导出的 JSON 中，不进入日志或门禁卡片。

- [x] **Step 5: 提交文档并推送**

```bash
git add README.md docs/superpowers/plans/2026-09-04-mobile-keyring.md
git commit -m "docs: explain mobile keyring usage"
git push origin main
```

- [x] **Step 6: 验证 GitHub Pages**

访问 `https://ryanlen.github.io/safebaiyun-bluefy/?v=<commit>`，确认 HTTP 200、资源加载成功、页面包含“我的门禁”“新增门禁”“导入 JSON”，并确认 GitHub Pages 构建结论为 `success`。
