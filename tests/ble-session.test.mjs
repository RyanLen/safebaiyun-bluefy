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

test("优先命中 Bluefy 已授权设备并写入固定解锁帧", async () => {
  const fake = makeGattDevice();
  let requestCount = 0;
  const bluetooth = {
    async getDevices() { return [fake.device]; },
    async requestDevice() { requestCount += 1; throw new Error("不应打开选择器"); }
  };
  const events = [];
  const { context } = loadScripts(["core.js", "ble.js"]);
  const session = context.SafeBaiyunBle.create({
    bluetooth,
    onEvent: event => events.push(event),
    wait: async () => {}
  });

  await session.unlock(door);

  assert.equal(requestCount, 0);
  assert.equal(fake.writes.length, 1);
  assert.equal(
    context.SafeBaiyunCore.bytesToHex(fake.writes[0]),
    "A51405CCDDEEFF0001075F24E313C59D06EB7D5A"
  );
  assert.equal(events.at(-1).phase, "disconnected");
  assert.equal(events.some(event => event.phase === "done"), true);
});

test("没有匹配的已授权设备时回退到名称过滤选择器", async () => {
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
    optionalServices: ["14839ac4-7d7e-415c-9a42-167340cf2339"]
  }]);
});

test("读取已授权设备失败时仍会回退到设备选择器", async () => {
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
    bluetooth: { async getDevices() { return [fake.device]; } },
    onEvent: event => events.push(event),
    wait: async () => {}
  });

  await assert.rejects(() => session.unlock(door), /服务不存在/);
  assert.equal(fake.gatt.connected, false);
  assert.equal(events.some(event => event.phase === "error"), true);
  assert.equal(events.at(-1).phase, "disconnected");
});
