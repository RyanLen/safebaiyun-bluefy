(() => {
  "use strict";

  function saveDoorForm(form, controller) {
    const value = name => form?.elements?.namedItem(name)?.value ?? "";
    return controller.saveDoor({
      id: value("id"),
      name: value("name"),
      mac: value("mac"),
      bluetoothName: value("bluetoothName"),
      productKey: value("productKey")
    });
  }

  function createController({ store, ble, clipboard, idFactory }) {
    const { exportDoorBundle, importDoorBundle, mergeDoors, validateDoor } = globalThis.SafeBaiyunCore;
    const loaded = store.load();
    const listeners = new Set();
    const state = {
      doors: loaded.doors,
      view: "home",
      draft: null,
      errors: {},
      session: {
        phase: "idle",
        doorId: null,
        doorName: "",
        message: "",
        detail: "",
        failedStage: "",
        errorName: "",
        errorDetail: ""
      },
      modal: null,
      importValue: "",
      importError: "",
      toast: loaded.error
    };

    function snapshot() {
      return {
        ...state,
        doors: state.doors.map(door => ({ ...door })),
        draft: state.draft ? { ...state.draft } : null,
        errors: { ...state.errors },
        session: { ...state.session }
      };
    }

    function publish() {
      const value = snapshot();
      listeners.forEach(listener => listener(value));
    }

    function setState(changes) {
      Object.assign(state, changes);
      publish();
    }

    function subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    }

    function persist(doors) {
      store.save(doors);
      state.doors = doors;
    }

    function saveDoor(input) {
      const result = validateDoor(input);
      if (!result.ok) {
        setState({ draft: { ...input }, errors: result.errors });
        return result;
      }

      const id = String(input.id || "");
      const position = state.doors.findIndex(door => door.id === id);
      if (id && position < 0) {
        const errors = { name: "要编辑的门禁已不存在" };
        setState({ draft: { ...input }, errors });
        return { ok: false, errors, value: result.value };
      }
      if (!id && state.doors.some(door => door.mac === result.value.mac && door.bluetoothName === result.value.bluetoothName)) {
        const errors = { bluetoothName: "相同 MAC 与蓝牙名称的门禁已存在" };
        setState({ draft: { ...input }, errors });
        return { ok: false, errors, value: result.value };
      }

      const saved = { id: id || String(idFactory()), ...result.value };
      const nextDoors = position >= 0
        ? state.doors.map((door, index) => index === position ? saved : door)
        : [...state.doors, saved];
      persist(nextDoors);
      setState({ view: "manage", draft: null, errors: {}, toast: "门禁已保存" });
      return { ok: true, errors: {}, value: saved };
    }

    function deleteDoor(id) {
      const nextDoors = state.doors.filter(door => door.id !== id);
      if (nextDoors.length === state.doors.length) return false;
      persist(nextDoors);
      setState({ view: "manage", draft: null, errors: {}, toast: "门禁已删除" });
      return true;
    }

    async function exportDoors() {
      const text = exportDoorBundle(state.doors);
      try {
        await clipboard.writeText(text);
      } catch {
        throw new Error("复制失败，请允许剪贴板权限后重试");
      }
      setState({ toast: "配置 JSON 已复制" });
      return text;
    }

    function importDoors(text) {
      const incoming = importDoorBundle(text);
      const merged = mergeDoors(state.doors, incoming, idFactory);
      persist(merged.doors);
      setState({
        view: "manage",
        modal: null,
        importValue: "",
        importError: "",
        toast: `已导入：新增 ${merged.added}，更新 ${merged.updated}`
      });
      return { added: merged.added, updated: merged.updated };
    }

    function handleBleEvent(event) {
      if (event.phase === "disconnected" && ["done", "error"].includes(state.session.phase)) return;
      setState({ session: { ...state.session, ...event } });
    }

    async function unlock(id) {
      if (!["idle", "done", "error", "disconnected"].includes(state.session.phase)) {
        throw new Error(`正在解锁“${state.session.doorName}”，请稍候`);
      }
      const door = state.doors.find(item => item.id === id);
      if (!door) throw new Error("门禁不存在");
      setState({
        session: {
          phase: "select",
          tone: "working",
          doorId: door.id,
          doorName: door.name,
          message: "正在准备蓝牙",
          detail: "",
          failedStage: "",
          errorName: "",
          errorDetail: ""
        }
      });
      try {
        return await ble.unlock(door);
      } catch (error) {
        if (state.session.phase !== "error") {
          handleBleEvent({
            phase: "error",
            tone: "danger",
            message: error.message,
            failedStage: error.failedStage || "",
            errorName: error.errorName || error.name || "UnknownError",
            errorDetail: error.errorDetail || ""
          });
        }
        throw error;
      }
    }

    function openHome() {
      setState({ view: "home", draft: null, errors: {}, modal: null });
    }

    function openManage() {
      setState({ view: "manage", draft: null, errors: {}, modal: null });
    }

    function startAdd() {
      setState({ view: "editor", draft: {}, errors: {}, modal: null });
    }

    function startEdit(id) {
      const door = state.doors.find(item => item.id === id);
      if (!door) return false;
      setState({ view: "editor", draft: { ...door }, errors: {}, modal: null });
      return true;
    }

    function openImport() {
      setState({ modal: "import", importValue: "", importError: "" });
    }

    function closeModal() {
      setState({ modal: null, importError: "" });
    }

    function setImportError(importValue, importError) {
      setState({ importValue, importError });
    }

    function showDiagnostics() {
      setState({ modal: "diagnostics" });
    }

    function closeSession() {
      setState({
        session: {
          phase: "idle",
          doorId: null,
          doorName: "",
          message: "",
          detail: "",
          failedStage: "",
          errorName: "",
          errorDetail: ""
        }
      });
    }

    function clearToast() {
      if (state.toast) setState({ toast: null });
    }

    function setToast(toast) {
      setState({ toast });
    }

    return Object.freeze({
      getState: snapshot,
      subscribe,
      saveDoor,
      deleteDoor,
      exportDoors,
      importDoors,
      handleBleEvent,
      unlock,
      openHome,
      openManage,
      startAdd,
      startEdit,
      openImport,
      closeModal,
      setImportError,
      showDiagnostics,
      closeSession,
      clearToast,
      setToast
    });
  }

  globalThis.SafeBaiyunApp = Object.freeze({ saveDoorForm, createController });
})();
