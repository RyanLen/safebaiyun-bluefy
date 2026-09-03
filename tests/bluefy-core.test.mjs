import assert from "node:assert/strict";
import test from "node:test";

import { loadScripts } from "./helpers/load-script.mjs";

function loadCore() {
  return loadScripts(["core.js"]).context.SafeBaiyunCore;
}

test("已验证的握手帧在资源拆分后保持不变", () => {
  const core = loadCore();
  const frame = core.buildUnlockFrame(
    core.hexToBytes("01020304"),
    core.hexToBytes("AABBCCDDEEFF"),
    core.hexToBytes("0123456789ABCDEF")
  ).frame;

  assert.equal(core.bytesToHex(frame), "A51405CCDDEEFF0001075F24E313C59D06EB7D5A");
});

test("Bluefy 设备请求按规范化后的 bluetoothName 精确过滤", () => {
  const core = loadCore();
  const options = core.buildDeviceRequestOptions(" by-aa:12 ");

  assert.deepEqual(JSON.parse(JSON.stringify(options)), {
    filters: [{ name: "BYAA12" }],
    optionalServices: ["14839ac4-7d7e-415c-9a42-167340cf2339"]
  });
});

test("空 bluetoothName 会在打开设备选择器前被拒绝", () => {
  const core = loadCore();

  assert.throws(
    () => core.buildDeviceRequestOptions(" -: "),
    /iOS 必须填写蓝牙名称 bluetoothName/
  );
});

test("点击解锁时把 bluetoothName 传给 Bluefy 设备过滤器", async () => {
  const requestOptions = [];
  const { element } = loadScripts(["core.js", "app.js"], {
    navigator: {
      bluetooth: {
        async requestDevice(options) {
          requestOptions.push(options);
          throw new Error("测试到设备选择器为止");
        }
      }
    }
  });
  element("#authorized").checked = true;
  element("#mac").value = "AA:BB:CC:DD:EE:FF";
  element("#product-key").value = "0123456789ABCDEF";
  element("#bluetooth-name").value = " by-aa:12 ";

  await element("#unlock").listeners.get("click")();

  assert.deepEqual(JSON.parse(JSON.stringify(requestOptions)), [{
    filters: [{ name: "BYAA12" }],
    optionalServices: ["14839ac4-7d7e-415c-9a42-167340cf2339"]
  }]);
});

test("输入 bluetoothName 时立即转为大写字母数字", () => {
  const { element } = loadScripts(["core.js", "app.js"]);
  const input = element("#bluetooth-name");
  input.value = " by-aa:12 ";

  assert.equal(typeof input.listeners.get("input"), "function", "缺少 bluetoothName 输入规范化处理");
  input.listeners.get("input")();

  assert.equal(input.value, "BYAA12");
});
