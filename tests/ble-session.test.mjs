import assert from "node:assert/strict";
import test from "node:test";

import { loadScripts } from "./helpers/load-script.mjs";

const door = {
  id: "door-a",
  name: "东门",
  mac: "AA:BB:CC:DD:EE:FF",
  bluetoothName: "BYAA12",
  productKey: "0123456789ABCDEF"
};

function makeGattDevice(name = "BYAA12") {
  const writes = [];
  const readable = {
    uuid: "read",
    properties: { read: true },
    async readValue() {
      return new DataView(Uint8Array.from([1, 2, 3, 4]).buffer);
    }
  };
  const writable = {
    uuid: "write",
    properties: { write: true },
    async writeValueWithResponse(value) {
      writes.push(Uint8Array.from(value));
    }
  };
  const gatt = {
    connected: false,
    async connect() {
      this.connected = true;
      return {
        async getPrimaryService() {
          return { async getCharacteristics() { return [readable, writable]; } };
        }
      };
    },
    disconnect() { this.connected = false; }
  };
  return {
    device: { name, gatt, addEventListener() {} },
    writes,
    gatt
  };
}

test("即使存在同名授权设备也沿用旧版选择器流程", async () => {
  const stale = makeGattDevice();
  stale.device.gatt.connect = async () => { throw new Error("缓存设备连接失败"); };
  const fresh = makeGattDevice();
  let getDevicesCount = 0;
  let requestCount = 0;
  const bluetooth = {
    async getDevices() { getDevicesCount += 1; return [stale.device]; },
    async requestDevice() { requestCount += 1; return fresh.device; }
  };
  const events = [];
  const { context } = loadScripts(["core.js", "ble.js"]);
  const session = context.SafeBaiyunBle.create({
    bluetooth,
    onEvent: event => events.push(event),
    wait: async () => {}
  });

  await session.unlock(door);

  assert.equal(getDevicesCount, 0);
  assert.equal(requestCount, 1);
  assert.equal(stale.writes.length, 0);
  assert.equal(fresh.writes.length, 1);
  assert.equal(
    context.SafeBaiyunCore.bytesToHex(fresh.writes[0]),
    "A51405CCDDEEFF0001075F24E313C59D06EB7D5A"
  );
  assert.equal(events.at(-1).phase, "disconnected");
  assert.equal(events.some(event => event.phase === "done"), true);
});

test("每次设备选择器都使用 bluetoothName 精确过滤", async () => {
  const fake = makeGattDevice();
  const requestOptions = [];
  const bluetooth = {
    async getDevices() { return [{ name: "OTHER" }]; },
    async requestDevice(options) { requestOptions.push(options); return fake.device; }
  };
  const { context } = loadScripts(["core.js", "ble.js"]);

  await context.SafeBaiyunBle.create({ bluetooth, wait: async () => {} }).unlock(door);

  assert.deepEqual(JSON.parse(JSON.stringify(requestOptions)), [{
    filters: [{ name: "BYAA12" }],
    optionalServices: [
      "14839ac4-7d7e-415c-9a42-167340cf2339",
      "0734594a-a8e7-4b1a-a6b1-cd5243059a57"
    ]
  }]);
});

test("选择器流程完全不依赖 getDevices", async () => {
  const fake = makeGattDevice();
  let requestCount = 0;
  const bluetooth = {
    async getDevices() { throw new Error("not implemented"); },
    async requestDevice() { requestCount += 1; return fake.device; }
  };
  const { context } = loadScripts(["core.js", "ble.js"]);

  await context.SafeBaiyunBle.create({ bluetooth, wait: async () => {} }).unlock(door);

  assert.equal(requestCount, 1);
  assert.equal(fake.writes.length, 1);
});

test("取消设备选择会映射为可读错误事件", async () => {
  const cancelled = new Error("User cancelled");
  cancelled.name = "NotFoundError";
  const events = [];
  const bluetooth = {
    async getDevices() { return []; },
    async requestDevice() { throw cancelled; }
  };
  const { context } = loadScripts(["core.js", "ble.js"]);
  const session = context.SafeBaiyunBle.create({
    bluetooth,
    onEvent: event => events.push(event),
    wait: async () => {}
  });

  await assert.rejects(() => session.unlock(door), /已取消选择设备/);
  assert.equal(events.some(event => event.phase === "error" && /已取消选择设备/.test(event.message)), true);
});

test("GATT 服务错误会产生错误事件并断开设备", async () => {
  const fake = makeGattDevice();
  fake.device.gatt.connect = async function connect() {
    this.connected = true;
    return {
      async getPrimaryService() { throw new Error("服务不存在"); }
    };
  };
  const events = [];
  const { context } = loadScripts(["core.js", "ble.js"]);
  const session = context.SafeBaiyunBle.create({
    bluetooth: { async requestDevice() { return fake.device; } },
    onEvent: event => events.push(event),
    wait: async () => {}
  });

  await assert.rejects(() => session.unlock(door), /服务不存在/);
  assert.equal(fake.gatt.connected, false);
  assert.equal(events.some(event => event.phase === "error"), true);
  assert.equal(events.at(-1).phase, "disconnected");
});

test("Bluefy 的普通对象错误会保留错误类型和失败阶段", async () => {
  const rawError = { name: "NetworkError", errMsg: "The device is out of range" };
  const events = [];
  const { context } = loadScripts(["core.js", "ble.js"]);
  const session = context.SafeBaiyunBle.create({
    bluetooth: { async requestDevice() { throw rawError; } },
    onEvent: event => events.push(event)
  });

  await assert.rejects(() => session.unlock(door), /蓝牙连接中断/);
  const failure = events.find(event => event.phase === "error");
  assert.equal(failure.failedStage, "select");
  assert.equal(failure.errorName, "NetworkError");
  assert.match(failure.errorDetail, /out of range/);
});

test("上一扇门的延迟断开事件不会污染下一扇门会话", async () => {
  const first = makeGattDevice("BYAA12");
  const second = makeGattDevice("BYGARAGE");
  const listeners = [];
  first.device.addEventListener = (type, listener) => {
    if (type === "gattserverdisconnected") listeners.push(listener);
  };
  const selected = [first.device, second.device];
  const events = [];
  const { context } = loadScripts(["core.js", "ble.js"]);
  const session = context.SafeBaiyunBle.create({
    bluetooth: { async requestDevice() { return selected.shift(); } },
    onEvent: event => events.push(event),
    wait: async () => {}
  });

  await session.unlock(door);
  const secondDoor = { ...door, id: "door-b", name: "车库", bluetoothName: "BYGARAGE" };
  const secondUnlock = session.unlock(secondDoor);
  listeners[0]?.();
  await secondUnlock;

  assert.equal(events.filter(event => event.phase === "disconnected").length, 2);
});

test("参考项目的第二服务候选可回退连接", async () => {
  const fake = makeGattDevice();
  const originalConnect = fake.gatt.connect;
  fake.gatt.connect = async function connect() {
    const server = await originalConnect.call(this);
    const originalGetPrimaryService = server.getPrimaryService;
    server.getPrimaryService = async uuid => {
      if (uuid === "14839ac4-7d7e-415c-9a42-167340cf2339") {
        const error = new Error("service not found");
        error.name = "NotFoundError";
        throw error;
      }
      return originalGetPrimaryService.call(server, uuid);
    };
    return server;
  };
  const { context } = loadScripts(["core.js", "ble.js"]);

  await context.SafeBaiyunBle.create({
    bluetooth: { async requestDevice() { return fake.device; } },
    wait: async () => {}
  }).unlock(door);

  assert.equal(fake.writes.length, 1);
});
