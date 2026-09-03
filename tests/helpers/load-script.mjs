import fs from "node:fs";
import vm from "node:vm";

const projectRoot = new URL("../../", import.meta.url);

function makeElement() {
  const listeners = new Map();
  return {
    checked: false,
    value: "",
    type: "password",
    disabled: false,
    textContent: "",
    className: "",
    dataset: {},
    scrollHeight: 0,
    scrollTop: 0,
    listeners,
    addEventListener(type, listener) { listeners.set(type, listener); },
    querySelector() { return makeElement(); }
  };
}

export function loadScripts(files, overrides = {}) {
  const elements = new Map();
  const element = (selector) => {
    if (!elements.has(selector)) elements.set(selector, makeElement());
    return elements.get(selector);
  };
  const context = {
    console,
    Uint8Array,
    BigInt,
    Date,
    setTimeout,
    clearTimeout,
    window: { isSecureContext: true },
    navigator: {},
    document: { querySelector: element },
    ...overrides
  };
  context.globalThis = context;
  vm.createContext(context);
  for (const file of files) {
    const fileUrl = new URL(file, projectRoot);
    vm.runInContext(fs.readFileSync(fileUrl, "utf8"), context, { filename: fileUrl.pathname });
  }
  return { context, elements, element };
}
