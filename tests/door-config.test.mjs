import assert from "node:assert/strict";
import test from "node:test";

import { loadScripts } from "./helpers/load-script.mjs";

function loadCore() {
  return loadScripts(["core.js"]).context.SafeBaiyunCore;
}

function makeMemoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

test("合法门禁会被规范化", () => {
  const { validateDoor } = loadCore();
  const result = validateDoor({
    name: " 东门 ",
    mac: "aa-bb-cc-dd-ee-ff",
    bluetoothName: " by-aa:12 ",
    productKey: "01 23 45 67 89 ab cd ef"
  });

  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.value)), {
    name: "东门",
    mac: "AA:BB:CC:DD:EE:FF",
    bluetoothName: "BYAA12",
    productKey: "0123456789ABCDEF"
  });
});

test("非法门禁返回逐字段错误", () => {
  const { validateDoor } = loadCore();
  const result = validateDoor({
    name: "",
    mac: "x",
    bluetoothName: "",
    productKey: "1"
  });

  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.errors).sort(), [
    "bluetoothName",
    "mac",
    "name",
    "productKey"
  ]);
});

test("导出配置包含版本但不包含本地 id", () => {
  const { exportDoorBundle } = loadCore();
  const text = exportDoorBundle([{
    id: "local-only",
    name: "东门",
    mac: "AA:BB:CC:DD:EE:FF",
    bluetoothName: "BYAA12",
    productKey: "0123456789ABCDEF"
  }]);
  const bundle = JSON.parse(text);

  assert.equal(bundle.version, 1);
  assert.equal(bundle.doors[0].id, undefined);
  assert.equal(bundle.doors[0].name, "东门");
});

test("导入会拒绝未知版本和任一非法门禁", () => {
  const { importDoorBundle } = loadCore();

  assert.throws(
    () => importDoorBundle('{"version":2,"doors":[]}'),
    /不支持的配置版本/
  );
  assert.throws(
    () => importDoorBundle(JSON.stringify({
      version: 1,
      doors: [
        {
          name: "东门",
          mac: "AA:BB:CC:DD:EE:FF",
          bluetoothName: "BYAA12",
          productKey: "0123456789ABCDEF"
        },
        { name: "坏数据", mac: "x", bluetoothName: "", productKey: "1" }
      ]
    })),
    /第 2 个门禁配置无效/
  );
});

test("重复门禁按 MAC 与蓝牙名更新并保留本地 id", () => {
  const { mergeDoors } = loadCore();
  const current = [{
    id: "door-a",
    name: "旧东门",
    mac: "AA:BB:CC:DD:EE:FF",
    bluetoothName: "BYAA12",
    productKey: "0123456789ABCDEF"
  }];
  const incoming = [
    {
      name: "新东门",
      mac: "aa-bb-cc-dd-ee-ff",
      bluetoothName: "by-aa:12",
      productKey: "FEDCBA9876543210"
    },
    {
      name: "车库",
      mac: "11:22:33:44:55:66",
      bluetoothName: "BYGARAGE",
      productKey: "0011223344556677"
    }
  ];
  const result = mergeDoors(current, incoming, () => "door-b");

  assert.equal(result.added, 1);
  assert.equal(result.updated, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(result.doors)), [
    { id: "door-a", ...incoming[0], mac: "AA:BB:CC:DD:EE:FF", bluetoothName: "BYAA12" },
    { id: "door-b", ...incoming[1] }
  ]);
});

test("本地存储损坏时返回空列表和错误", () => {
  const storage = makeMemoryStorage({ "safebaiyun.doors.v1": "{坏" });
  const { context } = loadScripts(["core.js", "store.js"]);
  const result = context.SafeBaiyunStore.create(storage).load();

  assert.deepEqual(JSON.parse(JSON.stringify(result.doors)), []);
  assert.match(result.error, /本地门禁配置已损坏/);
});

test("保存后新 store 实例能恢复全部门禁", () => {
  const storage = makeMemoryStorage();
  const { context } = loadScripts(["core.js", "store.js"]);
  const door = {
    id: "door-a",
    name: "东门",
    mac: "AA:BB:CC:DD:EE:FF",
    bluetoothName: "BYAA12",
    productKey: "0123456789ABCDEF"
  };

  context.SafeBaiyunStore.create(storage).save([door]);
  const result = context.SafeBaiyunStore.create(storage).load();

  assert.equal(result.error, null);
  assert.deepEqual(JSON.parse(JSON.stringify(result.doors)), [door]);
});
