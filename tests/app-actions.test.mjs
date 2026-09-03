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
  const saves = [];
  return {
    load() { return { doors: persisted.map(door => ({ ...door })), error: null }; },
    save(doors) {
      persisted = doors.map(door => ({ ...door }));
      saves.push(persisted);
    },
    saves,
    persisted() { return persisted; }
  };
}

function makeController(overrides = {}) {
  const { context } = loadScripts(["core.js", "app.js"]);
  const store = overrides.store || makeStore();
  const ble = overrides.ble || { async unlock() {}, async disconnect() {} };
  const controller = context.SafeBaiyunApp.createController({
    store,
    ble,
    clipboard: overrides.clipboard || { async writeText() {} },
    idFactory: overrides.idFactory || (() => "new-door")
  });
  return { context, controller, store };
}

test("新增、编辑和删除后立即持久化", () => {
  const { controller, store } = makeController();
  const created = controller.saveDoor({
    name: " 东门 ", mac: "aa-bb-cc-dd-ee-ff",
    bluetoothName: "by-aa:12", productKey: "0123456789abcdef"
  });

  assert.equal(created.ok, true);
  assert.equal(store.persisted()[0].id, "new-door");
  assert.equal(store.persisted()[0].name, "东门");

  const edited = controller.saveDoor({ ...store.persisted()[0], name: "公司东门" });
  assert.equal(edited.ok, true);
  assert.equal(store.persisted()[0].name, "公司东门");

  assert.equal(controller.deleteDoor("new-door"), true);
  assert.deepEqual(JSON.parse(JSON.stringify(store.persisted())), []);
  assert.equal(store.saves.length, 3);
});

test("非法编辑只返回字段错误且不会写入存储", () => {
  const store = makeStore([eastDoor]);
  const { controller } = makeController({ store });

  const result = controller.saveDoor({ ...eastDoor, mac: "错了" });

  assert.equal(result.ok, false);
  assert.match(result.errors.mac, /MAC/);
  assert.equal(store.saves.length, 0);
  assert.deepEqual(store.persisted(), [eastDoor]);
});

test("导出复制不含 id，剪贴板失败返回明确错误", async () => {
  const copied = [];
  const store = makeStore([eastDoor]);
  const { controller } = makeController({
    store,
    clipboard: { async writeText(text) { copied.push(text); } }
  });

  const text = await controller.exportDoors();
  assert.equal(copied[0], text);
  assert.equal(JSON.parse(text).doors[0].id, undefined);

  const failed = makeController({
    store,
    clipboard: { async writeText() { throw new Error("denied"); } }
  }).controller;
  await assert.rejects(() => failed.exportDoors(), /复制失败/);
});

test("导入会原子校验，并按设备身份更新重复门禁", () => {
  const store = makeStore([eastDoor]);
  const { controller } = makeController({ store, idFactory: () => "garage" });
  const valid = JSON.stringify({
    version: 1,
    doors: [
      { ...eastDoor, id: undefined, name: "新东门", productKey: "FEDCBA9876543210" },
      {
        name: "车库", mac: "11:22:33:44:55:66",
        bluetoothName: "BYGARAGE", productKey: "0011223344556677"
      }
    ]
  });

  const result = controller.importDoors(valid);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { added: 1, updated: 1 });
  assert.equal(store.persisted()[0].id, "east");
  assert.equal(store.persisted()[0].name, "新东门");
  assert.equal(store.persisted()[1].id, "garage");

  const savesBeforeInvalid = store.saves.length;
  assert.throws(
    () => controller.importDoors('{"version":1,"doors":[{"name":"坏"}]}'),
    /配置无效/
  );
  assert.equal(store.saves.length, savesBeforeInvalid);
  assert.equal(store.persisted().length, 2);
});

test("蓝牙断开事件不会覆盖已显示的成功或失败结果", () => {
  const { controller } = makeController({ store: makeStore([eastDoor]) });

  controller.handleBleEvent({ phase: "error", tone: "danger", message: "连接失败" });
  controller.handleBleEvent({ phase: "disconnected", tone: "idle", message: "已断开" });
  assert.equal(controller.getState().session.phase, "error");

  controller.handleBleEvent({ phase: "done", tone: "success", message: "指令已写入" });
  controller.handleBleEvent({ phase: "disconnected", tone: "idle", message: "已断开" });
  assert.equal(controller.getState().session.phase, "done");
});

test("解锁进行中拒绝启动第二个门禁会话", async () => {
  let finishFirst;
  let calls = 0;
  const ble = {
    unlock() {
      calls += 1;
      if (calls > 1) throw new Error("底层不应收到第二次调用");
      return new Promise(resolve => { finishFirst = resolve; });
    },
    async disconnect() {}
  };
  const garageDoor = {
    id: "garage", name: "车库", mac: "11:22:33:44:55:66",
    bluetoothName: "BYGARAGE", productKey: "0011223344556677"
  };
  const { controller } = makeController({ store: makeStore([eastDoor, garageDoor]), ble });

  const first = controller.unlock("east");
  await assert.rejects(() => controller.unlock("garage"), /正在解锁“东门”/);
  assert.equal(calls, 1);
  assert.equal(controller.getState().session.doorId, "east");
  finishFirst();
  await first;
});

test("直接保存表单会读取四个字段并写入本地存储", () => {
  const { context, controller, store } = makeController();
  const values = {
    id: "",
    name: "东门",
    mac: "AA:BB:CC:DD:EE:FF",
    bluetoothName: "BYAA12",
    productKey: "0123456789ABCDEF"
  };
  const form = {
    elements: {
      namedItem(name) { return { value: values[name] }; }
    }
  };

  const result = context.SafeBaiyunApp.saveDoorForm(form, controller);

  assert.equal(result.ok, true);
  assert.equal(store.persisted()[0].name, "东门");
  assert.equal(store.persisted()[0].bluetoothName, "BYAA12");
});
