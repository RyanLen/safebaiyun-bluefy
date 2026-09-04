# React + shadcn/ui 门禁钥匙重构计划

## 目标

- 保留当前已核对的白云门禁 DES 帧和本地门禁数据格式。
- 用 React 18、Vite、Tailwind CSS 3 和 shadcn/ui 风格组件重做移动端界面。
- 保证构建产物为可直接部署到 GitHub Pages 的静态文件。
- 让 BLE 失败可诊断、旧连接事件不污染下一次门禁会话，并为参考项目中的双服务候选保留兼容边界。

## 方案约束

- `core.js`、`store.js`、`ble.js` 继续作为协议、存储和 BLE 边界；页面层通过控制器订阅状态。
- UI 依赖固定版本并进入 `package-lock.json`，运行时不请求 CDN。
- Vite 构建目标设为 Safari 12，避免 Bluefy 旧 WebView 因过新的语法或 CSS 失败。
- 解锁按钮事件中同步进入控制器和 `requestDevice()` 调用链；在设备选择前不弹窗、不 `await`、不定时。
- 诊断只记录阶段、错误类型、服务/特征元数据和脱敏帧信息，不记录完整 `PRODUCT_KEY`。

## 实施顺序与验证

1. 给 BLE 会话增加阶段和错误保真、设备会话令牌、双服务枚举测试；验证 `node --test tests/*.test.mjs`。
2. 把现有控制器从 DOM 渲染脚本中分离出来；验证原有配置/导入/并发测试仍通过。
3. 初始化 React/Vite/Tailwind，加入本地 shadcn/ui 风格基础组件和移动端页面状态；验证 `npm run build`。
4. 更新 GitHub Pages Actions，将 `dist` 部署到 Pages；验证构建产物引用均为同源静态资源。
5. 在 macOS 本地启动静态站点检查页面资源和协议测试；真机 Bluefy 仍需人工验证选择器、双服务和门锁回执。
