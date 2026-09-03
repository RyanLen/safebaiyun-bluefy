# Bluefy 兼容性原型

这是一个 throwaway Spike，用来验证 SafeBaiyun 的 BLE 挑战—应答流程能否在 iOS Bluefy 中完成。页面不保存 `MAC_NUM`、`PRODUCT_KEY` 或 `bluetoothName`，也不加载任何第三方 JavaScript。

## 文件

- `index.html`：完整单文件页面。

## 为什么不能直接双击运行

Bluefy 和 Web Bluetooth 要求页面处于 HTTPS 安全上下文。`file://` 或局域网普通 `http://` 页面通常不能调用蓝牙。

## 免费试用方式

最省事的是把 `index.html` 放进一个不含真实密钥的 GitHub 仓库，然后启用 GitHub Pages：

1. 新建仓库，只上传 `index.html`，不要把 `MAC_NUM`、`PRODUCT_KEY` 或 `bluetoothName` 写进文件。
2. 在仓库 Settings → Pages 中选择从分支部署。
3. 等 GitHub Pages 给出 `https://...github.io/.../` 地址。
4. 在 iPhone 的 Bluefy 中打开该 HTTPS 地址。
5. 页面三项诊断都通过后，临时输入 `MAC_NUM`、`PRODUCT_KEY` 和 `bluetoothName`。
6. 靠近门锁，点击“选择设备并尝试解锁”；Bluefy 只会列出名称与 `bluetoothName` 完全匹配的设备。

## 验收顺序

1. Bluefy 能按 `bluetoothName` 列出并选择设备。
2. 能获取固定服务 `14839ac4-7d7e-415c-9a42-167340cf2339`。
3. 能发现可读和可写特征。
4. 能读取非空挑战值。
5. 页面 DES 标准向量自检通过。
6. 能完成 20 字节写入。
7. 最后观察门锁是否实际动作，以及日志里是否出现通知回执。

“响应帧已写入”仅表示浏览器完成 GATT 写调用，不等于机械锁已经打开。
