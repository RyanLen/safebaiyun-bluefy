(() => {
  "use strict";

  const {
    SERVICE_UUIDS,
    bytesToHex,
    buildDeviceRequestOptions,
    buildUnlockFrame,
    hexToBytes,
    parseMac,
    runDesSelfTest,
    validateDoor
  } = globalThis.SafeBaiyunCore;

  function dataViewToBytes(view) {
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice();
  }

  async function writeCharacteristic(characteristic, value) {
    if (characteristic.properties.write && typeof characteristic.writeValueWithResponse === "function") {
      await characteristic.writeValueWithResponse(value);
      return "withResponse";
    }
    if (characteristic.properties.write && typeof characteristic.writeValue === "function") {
      await characteristic.writeValue(value);
      return "legacy-withResponse";
    }
    if (characteristic.properties.writeWithoutResponse && typeof characteristic.writeValueWithoutResponse === "function") {
      await characteristic.writeValueWithoutResponse(value);
      return "withoutResponse";
    }
    if (typeof characteristic.writeValue === "function") {
      await characteristic.writeValue(value);
      return "legacy";
    }
    throw new Error("Bluefy 没有提供可用的特征写入方法");
  }

  async function startNotifications(characteristics, emit) {
    let count = 0;
    for (const characteristic of characteristics) {
      if (!characteristic.properties.notify && !characteristic.properties.indicate) continue;
      try {
        if (typeof characteristic.addEventListener === "function") {
          characteristic.addEventListener("characteristicvaluechanged", event => {
            const value = dataViewToBytes(event.target.value);
            emit({ phase: "read", tone: "info", message: "收到门锁通知", detail: bytesToHex(value) });
          });
        }
        await characteristic.startNotifications();
        count += 1;
      } catch {
        emit({ phase: "read", tone: "warning", message: "通知订阅失败，将继续尝试写入" });
      }
    }
    return count;
  }

  function errorInfo(error) {
    if (typeof error === "string") {
      return { name: "", message: error, detail: error };
    }
    const name = typeof error?.name === "string" ? error.name : "";
    const message = typeof error?.message === "string" ? error.message
      : typeof error?.errMsg === "string" ? error.errMsg : "";
    const code = error?.code ?? error?.errCode;
    const fields = { name, message };
    if (code !== undefined && code !== null) fields.code = String(code);
    const detail = Object.entries(fields)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}=${value}`)
      .join("; ") || String(error ?? "");
    return { name, message, detail };
  }

  function mapBluetoothError(error, failedStage) {
    const info = errorInfo(error);
    let message = info.message || "蓝牙解锁失败";
    if (info.name === "NotFoundError") message = "已取消选择设备";
    if (info.name === "SecurityError") message = "浏览器拒绝了蓝牙权限，请确认页面使用 HTTPS";
    if (info.name === "NetworkError") message = "蓝牙连接中断，请靠近门锁后重试";
    const mapped = new Error(message);
    mapped.failedStage = failedStage;
    mapped.errorName = info.name || "UnknownError";
    mapped.errorDetail = info.detail;
    return mapped;
  }

  function create({ bluetooth, onEvent = () => {}, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
    let activeSession = null;
    let busy = false;
    const emit = event => onEvent({ tone: "working", ...event });

    async function chooseDevice(door) {
      emit({ phase: "select", message: "请在列表中选择门锁" });
      return bluetooth.requestDevice(buildDeviceRequestOptions(door.bluetoothName));
    }

    async function disconnect(targetSession = activeSession) {
      if (!targetSession || activeSession !== targetSession) return;
      activeSession = null;
      if (targetSession.device?.gatt?.connected) targetSession.device.gatt.disconnect();
      emit({ phase: "disconnected", tone: "idle", message: "蓝牙连接已断开" });
    }

    async function unlock(input) {
      if (busy) throw new Error("已有解锁任务正在执行");
      if (!bluetooth) throw new Error("当前浏览器没有 Web Bluetooth，请使用 Bluefy");
      const validation = validateDoor(input);
      if (!validation.ok) throw new Error(Object.values(validation.errors).join("；"));
      if (!runDesSelfTest()) throw new Error("DES 自检失败，已阻止写入");
      const door = validation.value;
      busy = true;
      const session = { device: null };
      activeSession = session;
      let failedStage = "select";

      try {
        session.device = await chooseDevice(door);
        if (typeof session.device.addEventListener === "function") {
          session.device.addEventListener("gattserverdisconnected", () => {
            if (activeSession !== session) return;
            emit({ phase: "disconnected", tone: "idle", message: "蓝牙连接已断开" });
          });
        }

        failedStage = "connect";
        emit({ phase: "connect", message: `正在连接 ${session.device.name || door.name}` });
        const server = await session.device.gatt.connect();
        failedStage = "service";
        let service;
        let serviceError;
        for (const serviceUuid of SERVICE_UUIDS) {
          try {
            service = await server.getPrimaryService(serviceUuid);
            break;
          } catch (error) {
            serviceError = error;
          }
        }
        if (!service) throw serviceError || new Error("未找到目标蓝牙服务");
        const characteristics = await service.getCharacteristics();
        const readableCandidates = characteristics.filter(item => item.properties.read);
        const writeCandidates = characteristics.filter(item => item.properties.write);
        const writeWithoutResponseCandidates = characteristics.filter(item => item.properties.writeWithoutResponse);
        const readable = readableCandidates[readableCandidates.length - 1];
        const writable = writeCandidates[writeCandidates.length - 1]
          || writeWithoutResponseCandidates[writeWithoutResponseCandidates.length - 1];
        if (!readable) throw new Error("目标服务中没有可读特征");
        if (!writable) throw new Error("目标服务中没有可写特征");

        failedStage = "notify";
        await startNotifications(characteristics, emit);
        failedStage = "read";
        emit({ phase: "read", message: "正在读取门锁挑战" });
        const challenge = dataViewToBytes(await readable.readValue());
        if (challenge.length === 0) throw new Error("门锁返回了空挑战值");

        failedStage = "compute";
        emit({ phase: "compute", message: "正在计算本地应答" });
        const computed = buildUnlockFrame(challenge, parseMac(door.mac), hexToBytes(door.productKey));
        failedStage = "write";
        emit({ phase: "write", message: "正在写入解锁指令" });
        const writeMode = await writeCharacteristic(writable, computed.frame);
        emit({
          phase: "done",
          tone: "success",
          message: "指令已写入",
          detail: `20 字节 · ${writeMode}`
        });

        const deviceName = session.device.name || door.bluetoothName;
        await wait(900);
        await disconnect(session);
        return { deviceName, frame: computed.frame };
      } catch (error) {
        const mapped = mapBluetoothError(error, failedStage);
        emit({
          phase: "error",
          tone: "danger",
          message: mapped.message,
          failedStage: mapped.failedStage,
          errorName: mapped.errorName,
          errorDetail: mapped.errorDetail
        });
        await disconnect(session);
        throw mapped;
      } finally {
        busy = false;
      }
    }

    return Object.freeze({ unlock, disconnect });
  }

  globalThis.SafeBaiyunBle = Object.freeze({ create });
})();
