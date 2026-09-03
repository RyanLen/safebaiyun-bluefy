(() => {
  "use strict";

  const STORAGE_KEY = "safebaiyun.doors.v1";
  const { validateDoor } = globalThis.SafeBaiyunCore;

  function normalizeStoredDoor(door, index) {
    const result = validateDoor(door);
    if (!result.ok || !door || !String(door.id ?? "")) {
      throw new Error(`第 ${index + 1} 个门禁配置无效`);
    }
    return { id: String(door.id), ...result.value };
  }

  function create(storage) {
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
      throw new Error("当前环境不支持本地存储");
    }

    return Object.freeze({
      load() {
        const raw = storage.getItem(STORAGE_KEY);
        if (raw === null) return { doors: [], error: null };
        try {
          const bundle = JSON.parse(raw);
          if (!bundle || bundle.version !== 1 || !Array.isArray(bundle.doors)) throw new Error("格式错误");
          return { doors: bundle.doors.map(normalizeStoredDoor), error: null };
        } catch {
          return { doors: [], error: "本地门禁配置已损坏，请重新导入或添加" };
        }
      },

      save(doors) {
        if (!Array.isArray(doors)) throw new Error("门禁配置必须是数组");
        const normalized = doors.map(normalizeStoredDoor);
        storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, doors: normalized }));
      }
    });
  }

  globalThis.SafeBaiyunStore = Object.freeze({ STORAGE_KEY, create });
})();
