import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const htmlPath = new URL("../index.html", import.meta.url);

function makeElement() {
  const listeners = new Map();
  return {
    checked: false,
    value: "",
    type: "password",
    disabled: false,
    textContent: "",
    className: "",
    dataset: {},
    scrollHeight: 0,
    scrollTop: 0,
    listeners,
    addEventListener(type, listener) { listeners.set(type, listener); },
    querySelector() { return makeElement(); }
  };
}

function loadHarness(navigator = {}) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const elements = new Map();
  const element = (selector) => {
    if (!elements.has(selector)) elements.set(selector, makeElement());
    return elements.get(selector);
  };
  const context = {
    console,
    Uint8Array,
    BigInt,
    Date,
    setTimeout,
    clearTimeout,
    window: { isSecureContext: true },
    navigator,
    document: {
      querySelector: element
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(scripts.at(-1)[1], context, { filename: htmlPath.pathname });
  return { core: context.SafeBaiyunCore, elements, element };
}

function loadCore() {
  return loadHarness().core;
}

test("Bluefy 设备请求按规范化后的 bluetoothName 精确过滤", () => {
  const core = loadCore();

  assert.equal(typeof core.buildDeviceRequestOptions, "function", "缺少 bluetoothName 设备过滤函数");
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
  const { element } = loadHarness({
    bluetooth: {
      async requestDevice(options) {
        requestOptions.push(options);
        throw new Error("测试到设备选择器为止");
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
  const { element } = loadHarness();
  const input = element("#bluetooth-name");
  input.value = " by-aa:12 ";

  assert.equal(typeof input.listeners.get("input"), "function", "缺少 bluetoothName 输入规范化处理");
  input.listeners.get("input")();

  assert.equal(input.value, "BYAA12");
});
