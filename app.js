(() => {
  "use strict";

  const {
    SERVICE_UUID,
    hexToBytes,
    bytesToHex,
    parseMac,
    normalizeBluetoothName,
    buildDeviceRequestOptions,
    buildUnlockFrame,
    runDesSelfTest
  } = globalThis.SafeBaiyunCore;

  const elements = {
    mac: document.querySelector("#mac"),
    bluetoothName: document.querySelector("#bluetooth-name"),
    productKey: document.querySelector("#product-key"),
    authorized: document.querySelector("#authorized"),
    unlock: document.querySelector("#unlock"),
    disconnect: document.querySelector("#disconnect"),
    reveal: document.querySelector("#reveal"),
    clearLog: document.querySelector("#clear-log"),
    log: document.querySelector("#log"),
    statusLamp: document.querySelector("#status-lamp"),
    statusTitle: document.querySelector("#status-title"),
    statusDetail: document.querySelector("#status-detail"),
    deviceName: document.querySelector("#device-name"),
    checkSecure: document.querySelector("#check-secure"),
    checkBluetooth: document.querySelector("#check-bluetooth"),
    checkDes: document.querySelector("#check-des")
  };

  let selectedDevice = null;
  let isBusy = false;

  function log(message, tone = "info") {
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    const marker = tone === "error" ? "ERR" : tone === "warn" ? "WRN" : "INF";
    elements.log.textContent += `[${time}] ${marker}  ${message}\n`;
    elements.log.scrollTop = elements.log.scrollHeight;
  }

  function setStatus(title, detail, tone = "idle") {
    elements.statusTitle.textContent = title;
    elements.statusDetail.textContent = detail;
    elements.statusLamp.dataset.tone = tone;
  }

  function setStep(name, state) {
    const element = document.querySelector(`#step-${name}`);
    element.dataset.state = state;
    const label = { idle: "等待", working: "进行中", done: "完成", failed: "失败" }[state];
    element.querySelector(".step-state").textContent = label;
  }

  function resetSteps() {
    ["select", "connect", "read", "compute", "write"].forEach(name => setStep(name, "idle"));
  }

  function setCheck(element, text, tone) {
    element.textContent = text;
    element.className = tone;
  }

  function dataViewToBytes(view) {
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice();
  }

  function onDisconnected() {
    elements.disconnect.disabled = true;
    log("BLE 连接已断开");
  }

  async function disconnect() {
    if (selectedDevice?.gatt?.connected) selectedDevice.gatt.disconnect();
    elements.disconnect.disabled = true;
  }

  async function startNotifications(characteristics) {
    let count = 0;
    for (const characteristic of characteristics) {
      if (!characteristic.properties.notify && !characteristic.properties.indicate) continue;
      try {
        characteristic.addEventListener("characteristicvaluechanged", event => {
          const value = dataViewToBytes(event.target.value);
          log(`收到通知 ${characteristic.uuid}: ${bytesToHex(value)}`);
        });
        await characteristic.startNotifications();
        count += 1;
        log(`已订阅通知特征 ${characteristic.uuid}`);
      } catch (error) {
        log(`通知订阅失败 ${characteristic.uuid}: ${error.message}`, "warn");
      }
    }
    return count;
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

  async function runUnlock() {
    if (isBusy) return;

    let macBytes;
    let productKeyBytes;
    let deviceRequestOptions;
    try {
      if (!elements.authorized.checked) throw new Error("请先确认你有权操作这台门锁");
      macBytes = parseMac(elements.mac.value);
      deviceRequestOptions = buildDeviceRequestOptions(elements.bluetoothName.value);
      productKeyBytes = hexToBytes(elements.productKey.value);
      if (productKeyBytes.length < 8) throw new Error("PRODUCT_KEY 至少需要 16 位十六进制字符");
      if (!window.isSecureContext) throw new Error("当前不是 HTTPS 安全页面，Web Bluetooth 会被浏览器拒绝");
      if (!navigator.bluetooth) throw new Error("当前浏览器没有 Web Bluetooth，请确认正在 Bluefy 中打开");
      if (!runDesSelfTest()) throw new Error("DES 自检失败，已阻止写入");
    } catch (error) {
      setStatus("配置未通过", error.message, "bad");
      log(error.message, "error");
      return;
    }

    isBusy = true;
    elements.unlock.disabled = true;
    resetSteps();
    setStatus("正在选择设备", "请在系统列表中选择附近门锁", "working");

    try {
      setStep("select", "working");
      selectedDevice = await navigator.bluetooth.requestDevice(deviceRequestOptions);
      selectedDevice.addEventListener("gattserverdisconnected", onDisconnected);
      elements.deviceName.textContent = selectedDevice.name || "未命名 BLE 设备";
      elements.disconnect.disabled = false;
      setStep("select", "done");
      log(`已选择设备：${selectedDevice.name || "未命名设备"}`);

      setStep("connect", "working");
      setStatus("正在连接", "连接 GATT 并发现固定服务", "working");
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
      setStep("connect", "done");
      log(`服务已连接，共发现 ${characteristics.length} 个特征`);
      log(`读取特征：${readable.uuid}`);
      log(`写入特征：${writable.uuid}`);

      const notificationCount = await startNotifications(characteristics);
      if (notificationCount === 0) log("没有成功订阅通知特征；只能确认写入，无法确认门锁回执", "warn");

      setStep("read", "working");
      setStatus("正在读取挑战", "等待门锁返回动态字节", "working");
      const challenge = dataViewToBytes(await readable.readValue());
      if (challenge.length === 0) throw new Error("门锁返回了空挑战值");
      setStep("read", "done");
      log(`挑战值（${challenge.length} 字节）：${bytesToHex(challenge)}`);

      setStep("compute", "working");
      const computed = buildUnlockFrame(challenge, macBytes, productKeyBytes);
      setStep("compute", "done");
      log(`求和：${computed.sum}；DES 输入：${bytesToHex(computed.padded)}`);
      log(`DES 首块：${bytesToHex(computed.encryptedBlock)}`);
      log(`响应帧：${bytesToHex(computed.frame)}`);

      setStep("write", "working");
      setStatus("正在写入应答", "向门锁提交 20 字节响应帧", "working");
      const writeMode = await writeCharacteristic(writable, computed.frame);
      setStep("write", "done");
      setStatus("响应帧已写入", "请观察门锁；此状态不是机械开锁确认", "ok");
      log(`写入调用完成，模式：${writeMode}`);

      await new Promise(resolve => setTimeout(resolve, 900));
      await disconnect();
    } catch (error) {
      const active = ["select", "connect", "read", "compute", "write"]
        .find(name => document.querySelector(`#step-${name}`).dataset.state === "working");
      if (active) setStep(active, "failed");
      setStatus("执行失败", `${error.name || "Error"}: ${error.message}`, "bad");
      log(`${error.name || "Error"}: ${error.message}`, "error");
      await disconnect();
    } finally {
      isBusy = false;
      elements.unlock.disabled = false;
    }
  }

  elements.bluetoothName.addEventListener("input", () => {
    elements.bluetoothName.value = normalizeBluetoothName(elements.bluetoothName.value);
  });
  elements.unlock.addEventListener("click", runUnlock);
  elements.disconnect.addEventListener("click", disconnect);
  elements.reveal.addEventListener("click", () => {
    const showing = elements.productKey.type === "text";
    elements.productKey.type = showing ? "password" : "text";
    elements.reveal.textContent = showing ? "显示" : "隐藏";
  });
  elements.clearLog.addEventListener("click", () => { elements.log.textContent = ""; });

  const secure = window.isSecureContext;
  const bluetooth = Boolean(navigator.bluetooth);
  const desOk = runDesSelfTest();
  setCheck(elements.checkSecure, secure ? "通过 / HTTPS" : "未通过 / 需要 HTTPS", secure ? "ok" : "bad");
  setCheck(elements.checkBluetooth, bluetooth ? "可用" : "不可用 / 请用 Bluefy", bluetooth ? "ok" : "bad");
  setCheck(elements.checkDes, desOk ? "通过" : "失败 / 已禁用", desOk ? "ok" : "bad");
  log(`环境检查：HTTPS=${secure ? "YES" : "NO"}，WebBluetooth=${bluetooth ? "YES" : "NO"}，DES=${desOk ? "PASS" : "FAIL"}`);
})();

