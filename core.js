(() => {
  "use strict";

  const SERVICE_UUID = "14839ac4-7d7e-415c-9a42-167340cf2339";
  const IP = [58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,64,56,48,40,32,24,16,8,57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7];
  const FP = [40,8,48,16,56,24,64,32,39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26,33,1,41,9,49,17,57,25];
  const E = [32,1,2,3,4,5,4,5,6,7,8,9,8,9,10,11,12,13,12,13,14,15,16,17,16,17,18,19,20,21,20,21,22,23,24,25,24,25,26,27,28,29,28,29,30,31,32,1];
  const P = [16,7,20,21,29,12,28,17,1,15,23,26,5,18,31,10,2,8,24,14,32,27,3,9,19,13,30,6,22,11,4,25];
  const PC1 = [57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4];
  const PC2 = [14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32];
  const SHIFTS = [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];
  const SBOX = [
    [[14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7],[0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8],[4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0],[15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13]],
    [[15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10],[3,13,4,7,15,2,8,14,12,0,1,10,6,9,11,5],[0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15],[13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9]],
    [[10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8],[13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1],[13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7],[1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12]],
    [[7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15],[13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9],[10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4],[3,15,0,6,10,1,13,8,9,4,5,11,12,7,2,14]],
    [[2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9],[14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6],[4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14],[11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3]],
    [[12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11],[10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8],[9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6],[4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13]],
    [[4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1],[13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6],[1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2],[6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12]],
    [[13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7],[1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2],[7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8],[2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11]]
  ];

  function hexToBytes(value) {
    const normalized = String(value).replace(/[\s:\-]/g, "").toUpperCase();
    if (!normalized || normalized.length % 2 !== 0 || !/^[0-9A-F]+$/.test(normalized)) {
      throw new Error("十六进制内容格式错误");
    }
    return Uint8Array.from(normalized.match(/../g).map(pair => Number.parseInt(pair, 16)));
  }

  function bytesToHex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  function parseMac(value) {
    const bytes = hexToBytes(value);
    if (bytes.length !== 6) throw new Error("MAC 必须正好包含 6 个字节");
    return bytes;
  }

  function normalizeBluetoothName(value) {
    return String(value).toUpperCase().replace(/[^0-9A-Z]/g, "");
  }

  function buildDeviceRequestOptions(value) {
    const bluetoothName = normalizeBluetoothName(value);
    if (!bluetoothName) throw new Error("iOS 必须填写蓝牙名称 bluetoothName");
    return {
      filters: [{ name: bluetoothName }],
      optionalServices: [SERVICE_UUID]
    };
  }

  function bytesToBigInt(bytes) {
    let result = 0n;
    for (const byte of bytes) result = (result << 8n) | BigInt(byte);
    return result;
  }

  function bigIntToBytes(value, length) {
    const out = new Uint8Array(length);
    for (let index = length - 1; index >= 0; index -= 1) {
      out[index] = Number(value & 0xffn);
      value >>= 8n;
    }
    return out;
  }

  function permute(value, table, inputBits) {
    let result = 0n;
    for (const position of table) {
      result = (result << 1n) | ((value >> BigInt(inputBits - position)) & 1n);
    }
    return result;
  }

  function rotateLeft28(value, shift) {
    const mask = 0x0fffffffn;
    return ((value << BigInt(shift)) | (value >> BigInt(28 - shift))) & mask;
  }

  function makeSubkeys(keyBytes) {
    let key56 = permute(bytesToBigInt(keyBytes), PC1, 64);
    let left = (key56 >> 28n) & 0x0fffffffn;
    let right = key56 & 0x0fffffffn;
    return SHIFTS.map(shift => {
      left = rotateLeft28(left, shift);
      right = rotateLeft28(right, shift);
      return permute((left << 28n) | right, PC2, 56);
    });
  }

  function feistel(right, subkey) {
    const mixed = permute(right, E, 32) ^ subkey;
    let substituted = 0n;
    for (let index = 0; index < 8; index += 1) {
      const chunk = Number((mixed >> BigInt((7 - index) * 6)) & 0x3fn);
      const row = ((chunk & 0x20) >> 4) | (chunk & 0x01);
      const column = (chunk >> 1) & 0x0f;
      substituted = (substituted << 4n) | BigInt(SBOX[index][row][column]);
    }
    return permute(substituted, P, 32);
  }

  function desEncryptBlock(blockBytes, keyBytes) {
    if (blockBytes.length !== 8 || keyBytes.length !== 8) {
      throw new Error("DES 块和密钥必须各为 8 字节");
    }
    const subkeys = makeSubkeys(keyBytes);
    const initial = permute(bytesToBigInt(blockBytes), IP, 64);
    let left = (initial >> 32n) & 0xffffffffn;
    let right = initial & 0xffffffffn;
    for (const subkey of subkeys) {
      const nextLeft = right;
      const nextRight = left ^ feistel(right, subkey);
      left = nextLeft;
      right = nextRight;
    }
    return bigIntToBytes(permute((right << 32n) | left, FP, 64), 8);
  }

  function buildUnlockFrame(challenge, macBytes, productKeyBytes) {
    if (!(challenge instanceof Uint8Array) || challenge.length === 0) throw new Error("门锁返回了空挑战值");
    if (macBytes.length !== 6) throw new Error("MAC 长度错误");
    if (productKeyBytes.length < 8) throw new Error("PRODUCT_KEY 至少需要 8 字节");

    let sum = 0;
    for (const byte of challenge) sum += byte;
    for (const byte of productKeyBytes) sum += byte;

    const rawLength = 2 + challenge.length;
    const paddedLength = Math.ceil(rawLength / 8) * 8;
    const padded = new Uint8Array(paddedLength);
    padded[0] = sum & 0xff;
    padded[1] = (sum >>> 8) & 0xff;
    padded.set(challenge, 2);

    const desKey = new Uint8Array(8);
    desKey.set(productKeyBytes.slice(0, 8));
    const encryptedBlock = desEncryptBlock(padded.slice(0, 8), desKey);

    const frame = new Uint8Array(20);
    frame.set([0xa5, 0x14, 0x05], 0);
    frame.set(macBytes.slice(2, 6), 3);
    frame.set([0x00, 0x01, 0x07], 7);
    frame.set(encryptedBlock, 10);
    frame[18] = 0x00;
    frame[19] = 0x5a;

    let checksumSum = 0;
    for (const byte of frame) checksumSum += byte;
    frame[18] = (~checksumSum) & 0xff;

    return { frame, padded, encryptedBlock, sum };
  }

  function runDesSelfTest() {
    const plain = hexToBytes("0123456789ABCDEF");
    const key = hexToBytes("133457799BBCDFF1");
    return bytesToHex(desEncryptBlock(plain, key)) === "85E813540F0AB405";
  }

  globalThis.SafeBaiyunCore = Object.freeze({
    SERVICE_UUID,
    hexToBytes,
    bytesToHex,
    parseMac,
    normalizeBluetoothName,
    buildDeviceRequestOptions,
    desEncryptBlock,
    buildUnlockFrame,
    runDesSelfTest
  });
})();
