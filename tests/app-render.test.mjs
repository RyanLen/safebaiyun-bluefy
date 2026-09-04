import assert from "node:assert/strict";
import test from "node:test";

import { loadScripts } from "./helpers/load-script.mjs";

const eastDoor = {
  id: "east",
  name: "东门",
  mac: "AA:BB:CC:DD:EE:FF",
  bluetoothName: "BYAA12",
  productKey: "0123456789ABCDEF"
};

function makeStore(initial = []) {
  let persisted = initial.map(door => ({ ...door }));
  return {
    load() { return { doors: persisted.map(door => ({ ...door })), error: null }; },
    save(doors) { persisted = doors.map(door => ({ ...door })); },
    persisted() { return persisted; }
  };
}

test("控制器初始化时暴露门禁状态和首页视图", () => {
  const { context } = loadScripts(["core.js", "app.js"]);
  const controller = context.SafeBaiyunApp.createController({
    store: makeStore([eastDoor]),
    ble: { async unlock() {}, async disconnect() {} },
    clipboard: { async writeText() {} },
    idFactory: () => "new-door"
  });

  assert.equal(controller.getState().view, "home");
  assert.deepEqual(JSON.parse(JSON.stringify(controller.getState().doors)), [eastDoor]);
});

test("控制器会把 BLE 阶段诊断字段交给页面状态", () => {
  const { context } = loadScripts(["core.js", "app.js"]);
  const controller = context.SafeBaiyunApp.createController({
    store: makeStore([eastDoor]),
    ble: { async unlock() {}, async disconnect() {} },
    clipboard: { async writeText() {} },
    idFactory: () => "new-door"
  });

  controller.handleBleEvent({
    phase: "error",
    message: "未找到目标蓝牙服务",
    failedStage: "service",
    errorName: "NotFoundError",
    errorDetail: "name=NotFoundError; message=service missing"
  });

  assert.equal(controller.getState().session.failedStage, "service");
  assert.equal(controller.getState().session.errorName, "NotFoundError");
  assert.match(controller.getState().session.errorDetail, /service missing/);
});
