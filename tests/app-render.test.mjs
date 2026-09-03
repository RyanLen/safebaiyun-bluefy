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
const garageDoor = {
  id: "garage",
  name: "车库",
  mac: "11:22:33:44:55:66",
  bluetoothName: "BYGARAGE",
  productKey: "0011223344556677"
};
const idle = { phase: "idle", doorId: null, message: "", detail: "" };

function loadApp() {
  return loadScripts(["core.js", "app.js"]).context.SafeBaiyunApp;
}

test("首页空状态引导添加第一个门禁", () => {
  const { renderHome } = loadApp();
  const html = renderHome([], idle);

  assert.match(html, /添加第一个门禁/);
  assert.match(html, /data-action="add"/);
});

test("首页为每个门禁提供大号解锁按钮且绝不渲染密钥", () => {
  const { renderHome } = loadApp();
  const html = renderHome([eastDoor, garageDoor], idle);

  assert.equal((html.match(/data-action="unlock"/g) || []).length, 2);
  assert.match(html, /东门/);
  assert.match(html, /车库/);
  assert.doesNotMatch(html, /0123456789ABCDEF/);
  assert.doesNotMatch(html, /0011223344556677/);
});

test("用户配置文本会在渲染前转义", () => {
  const { renderHome } = loadApp();
  const html = renderHome([{ ...eastDoor, name: '<img src=x onerror="alert(1)">' }], idle);

  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});

test("解锁进行中会禁用当前门禁并显示阶段", () => {
  const { renderHome, renderSession } = loadApp();
  const session = {
    phase: "connect",
    doorId: "east",
    doorName: "东门",
    tone: "working",
    message: "正在连接东门",
    detail: ""
  };

  assert.match(renderHome([eastDoor], session), /data-action="unlock"[^>]*disabled/);
  assert.match(renderSession(session), /正在连接东门/);
  assert.match(renderSession(session), /连接门锁/);
});

test("成功与失败状态提供明确结果和恢复动作", () => {
  const { renderSession } = loadApp();
  const success = renderSession({
    phase: "done", doorId: "east", doorName: "东门", tone: "success",
    message: "指令已写入", detail: "请观察门锁"
  });
  const failure = renderSession({
    phase: "error", doorId: "east", doorName: "东门", tone: "danger",
    message: "蓝牙连接失败", detail: ""
  });

  assert.match(success, /指令已写入/);
  assert.match(failure, /data-action="retry"/);
  assert.match(failure, /data-action="show-diagnostics"/);
});
