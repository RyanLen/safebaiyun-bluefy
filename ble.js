(() => {
  "use strict";

  const {
    SERVICE_UUID,
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

  function mapBluetoothError(error) {
    if (error?.name === "NotFoundError") return new Error("已取消选择设备");
    if (error?.name === "SecurityError") return new Error("浏览器拒绝了蓝牙权限，请确认页面使用 HTTPS");
    if (error?.name === "NetworkError") return new Error("蓝牙连接中断，请靠近门锁后重试");
    return new Error(error?.message || "蓝牙解锁失败");
  }

  function create({ bluetooth, onEvent = () => {}, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
    let selectedDevice = null;
    let busy = false;
    const emit = event => onEvent({ tone: "working", ...event });

    async function chooseDevice(door) {
      emit({ phase: "select", message: "请在列表中选择门锁" });
      return bluetooth.requestDevice(buildDeviceRequestOptions(door.bluetoothName));
    }

    async function disconnect() {
      if (selectedDevice?.gatt?.connected) selectedDevice.gatt.disconnect();
      selectedDevice = null;
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

      try {
        selectedDevice = await chooseDevice(door);
        if (typeof selectedDevice.addEventListener === "function") {
          selectedDevice.addEventListener("gattserverdisconnected", () => {
            emit({ phase: "disconnected", tone: "idle", message: "蓝牙连接已断开" });
          });
        }

        emit({ phase: "connect", message: `正在连接 ${selectedDevice.name || door.name}` });
        const server = await selectedDevice.gatt.connect();
        const service = await server.getPrimaryService(SERVICE_UUID);
        const characteristics = await service.getCharacteristics();
        const readableCandidates = characteristics.filter(item => item.properties.read);
        const writeCandidates = characteristics.filter(item => item.properties.write);
        const writeWithoutResponseCandidates = characteristics.filter(item => item.properties.writeWithoutResponse);
        const readable = readableCandidates[readableCandidates.length - 1];
        const writable = writeCandidates[writeCandidates.length - 1]
          || writeWithoutResponseCandidates[writeWithoutResponseCandidates.length - 1];
        if (!readable) throw new Error("目标服务中没有可读特征");
        if (!writable) throw new Error("目标服务中没有可写特征");

        await startNotifications(characteristics, emit);
        emit({ phase: "read", message: "正在读取门锁挑战" });
        const challenge = dataViewToBytes(await readable.readValue());
        if (challenge.length === 0) throw new Error("门锁返回了空挑战值");

        emit({ phase: "compute", message: "正在计算本地应答" });
        const computed = buildUnlockFrame(challenge, parseMac(door.mac), hexToBytes(door.productKey));
        emit({ phase: "write", message: "正在写入解锁指令" });
        const writeMode = await writeCharacteristic(writable, computed.frame);
        emit({
          phase: "done",
          tone: "success",
          message: "指令已写入",
          detail: `20 字节 · ${writeMode}`
        });

        const deviceName = selectedDevice.name || door.bluetoothName;
        await wait(900);
        await disconnect();
        return { deviceName, frame: computed.frame };
      } catch (error) {
        const mapped = mapBluetoothError(error);
        emit({ phase: "error", tone: "danger", message: mapped.message });
        await disconnect();
        throw mapped;
      } finally {
        busy = false;
      }
    }

    return Object.freeze({ unlock, disconnect });
  }

  globalThis.SafeBaiyunBle = Object.freeze({ create });
})();
