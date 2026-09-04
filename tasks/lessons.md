# 项目教训

- 只测控制器或 mock BLE 不能证明 Bluefy 真机交互；每次 UI 事件改动都要覆盖真实 DOM/event 路径，并保留真机验证清单。
- 不要用 `navigator.bluetooth.getDevices()` 作为快速路径复用 Bluefy 设备句柄；缓存句柄失效会让多门禁流程间歇失败。
- 弹层遮罩不能挂通用 `data-action`，否则事件委托会把内部点击误判为关闭。
- 静态页面的资源或构建产物必须版本化/由 Pages 构建输出，避免 Bluefy 缓存旧脚本。
