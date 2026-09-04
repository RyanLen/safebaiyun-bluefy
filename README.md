# SafeBaiyun Bluefy 门禁钥匙

面向 iPhone Bluefy 浏览器的本地多门禁网页。门禁配置一次后保存在当前浏览器，打开首页即可选择门禁并解锁。

线上地址：<https://ryanlen.github.io/safebaiyun-bluefy/>

## 功能

- 首页以移动端优先界面展示多个门禁，每个门禁都有独立的快速解锁按钮。
- 添加、编辑、删除门禁，并按 `MAC + bluetoothName` 合并重复导入项。
- 将全部门禁复制为版本化 JSON，或从 JSON 原子导入。
- 失败时显示 BLE 阶段、Bluefy 错误类型和原始错误摘要，方便定位偶发问题。
- React + TypeScript + Vite + Tailwind CSS；shadcn/ui 风格基础组件和 Radix Dialog 均随项目构建，不依赖 CDN。

## iPhone 使用

1. 安装并打开 Bluefy。
2. 在 Bluefy 中访问上面的 HTTPS 地址。
3. 在“管理”中添加门禁，填写门禁名、MAC、`bluetoothName` 和 `PRODUCT_KEY`。
4. 回到“钥匙”，打开系统蓝牙并靠近门锁，点击对应门禁的“解锁”。

`bluetoothName` 必须与 Bluefy 扫描到的设备名完全一致。浏览器无法按 MAC 地址直接过滤 iOS BLE 设备，因此 MAC 只参与协议帧构造。

如果失败，点击“查看诊断”：

- `选择设备`：设备选择器被取消、名称不匹配或设备未广播。
- `连接门锁`：设备距离、系统蓝牙或连接状态问题。
- `连接门锁服务`：设备可能使用另一候选服务，或目标服务未暴露。
- `读取挑战` / `写入指令`：特征权限、门锁状态或连接中断问题。

页面显示“指令已写入”只代表 GATT 写调用完成，不等同于门锁已经开门；请以门锁动作和诊断信息为准。

## 数据与安全

门禁参数只保存在 Bluefy 的 `localStorage`，键名为 `safebaiyun.doors.v1`；页面没有后端、统计代码或运行时 CDN，也不会主动上传配置。

浏览器本地存储不是保险箱：`PRODUCT_KEY` 以明文形式保存在当前设备。不要在公共设备使用，也不要把导出的 JSON 发到群聊或公开仓库。JSON 包含完整密钥，只应通过可信渠道点对点分享。

## 本地开发

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

构建产物在 `dist/`。BLE 解锁必须在支持 Web Bluetooth 的 Bluefy HTTPS 页面中验证；普通浏览器只能检查页面与配置功能。

## GitHub Pages

`.github/workflows/pages.yml` 会在 `main` 分支提交后执行测试、TypeScript 检查和 Vite 构建，再将 `dist/` 发布到 GitHub Pages。仓库设置中的 Pages 来源需要选择 **GitHub Actions**。

## 协议约束

- 服务候选：`14839ac4-7d7e-415c-9a42-167340cf2339`、`0734594a-a8e7-4b1a-a6b1-cd5243059a57`。
- 解锁帧为 `A5 14 05` + MAC 后四字节 + `00 01 07` + DES 应答 + 补码校验 + `5A`，当前固定向量与参考项目一致。
- 每次解锁都用带名称过滤的 `requestDevice()` 重新选择设备，不使用 `getDevices()` 复用可能失效的句柄。
