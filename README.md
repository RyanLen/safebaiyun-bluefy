# SafeBaiyun Bluefy 门禁钥匙

面向 iPhone Bluefy 浏览器的本地多门禁网页。门禁配置一次后会保存在当前浏览器中，之后打开首页即可选择门禁并解锁。

线上地址：<https://ryanlen.github.io/safebaiyun-bluefy/>

## 功能

- 保存多个门禁，并给每个门禁设置易读名称。
- 首页提供每个门禁的快速解锁按钮。
- 优先连接 Bluefy 已授权的同名设备，必要时打开设备选择器。
- 新增、编辑和删除后立即写入本地存储。
- 将全部门禁复制为版本化 JSON，或从 JSON 原子导入。
- 导入时按 `MAC + bluetoothName` 识别重复门禁：重复项更新，新项目追加。

## iPhone 使用

1. 安装并打开 Bluefy。
2. 在 Bluefy 中访问上面的 HTTPS 地址。
3. 在“管理”中添加门禁，填写门禁名、MAC、`bluetoothName` 和 `PRODUCT_KEY`。
4. 回到“钥匙”，靠近门锁后点击对应的“解锁”。

`bluetoothName` 必须与 Bluefy 扫描到的设备名完全一致。页面显示“指令已写入”只代表 GATT 写调用完成，仍需观察门锁是否实际动作。

## 数据与安全

门禁参数只保存在 Bluefy 的 `localStorage`，键名为 `safebaiyun.doors.v1`；页面没有后端、统计代码、CDN 或第三方脚本，也不会主动上传配置。

浏览器本地存储不是保险箱：`PRODUCT_KEY` 以明文形式保存在当前设备。不要在公共设备使用，也不要把导出的 JSON 发到群聊或公开仓库。JSON 包含完整密钥，只应通过可信渠道点对点分享。

如需清空配置，请在 Bluefy 的隐私或网站数据设置中清除本站数据。该操作会同时删除全部门禁，建议先复制 JSON 并妥善保存。

## 本地验证

```bash
node --test tests/*.test.mjs
python3 -m http.server 4173
```

普通浏览器可检查界面与配置功能；蓝牙解锁必须在支持 Web Bluetooth 的 Bluefy HTTPS 页面中验证。

## 协议约束

- 固定服务 UUID：`14839ac4-7d7e-415c-9a42-167340cf2339`
- 保留已经真机验证成功的 DES 挑战—应答算法与 20 字节写入帧。
- 网页无法按 MAC 扫描 iOS BLE 设备，因此用 `bluetoothName` 精确过滤设备；MAC 仅参与协议帧构造。
