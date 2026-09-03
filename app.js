(() => {
  "use strict";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function maskMac(mac) {
    const parts = String(mac).split(":");
    return parts.length === 6 ? `••:••:••:${parts.slice(3).join(":")}` : "MAC 已隐藏";
  }

  function renderDoorIcon() {
    return `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 20V5.8c0-.5.3-.9.8-1L17 2v18M5 20h14M13.5 11.5h.01"/></svg>`;
  }

  function renderHome(doors, session = {}) {
    const items = Array.isArray(doors) ? doors : [];
    const doorCards = items.map(door => {
      const isBusy = session.doorId === door.id && !["idle", "done", "error", "disconnected"].includes(session.phase);
      const label = isBusy ? "解锁中…" : "解锁";
      return `
        <article class="door-card${isBusy ? " is-active" : ""}">
          <div class="door-card__identity">
            <span class="door-icon">${renderDoorIcon()}</span>
            <div>
              <h2>${escapeHtml(door.name)}</h2>
              <p>${escapeHtml(door.bluetoothName)}</p>
            </div>
          </div>
          <p class="door-card__mac">${escapeHtml(maskMac(door.mac))}</p>
          <button class="unlock-button" type="button" data-action="unlock" data-id="${escapeHtml(door.id)}"${isBusy ? " disabled aria-busy=\"true\"" : ""}>
            <span>${label}</span>
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h13M14 7l5 5-5 5"/></svg>
          </button>
        </article>`;
    }).join("");

    const content = items.length > 0
      ? `<section class="door-list" aria-label="我的门禁">${doorCards}</section>`
      : `<section class="empty-state">
          <span class="empty-state__icon">${renderDoorIcon()}</span>
          <h2>还没有门禁</h2>
          <p>添加一次，以后打开页面就能直接解锁。</p>
          <button class="action-button" type="button" data-action="add">添加第一个门禁</button>
        </section>`;

    return `
      <section class="view home-view" data-view="home">
        <header class="page-header">
          <div>
            <p class="eyebrow"><span class="status-dot"></span>BLUEFY KEYRING</p>
            <h1>门禁钥匙</h1>
            <p class="page-intro">靠近门锁，轻点即可解锁</p>
          </div>
          <button class="icon-button" type="button" data-action="add" aria-label="添加门禁">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </header>
        ${content}
      </section>`;
  }

  const PHASE_LABELS = Object.freeze({
    select: "选择设备",
    connect: "连接门锁",
    read: "读取挑战",
    compute: "计算应答",
    write: "写入指令",
    done: "已完成",
    error: "未完成"
  });

  function renderSession(session = {}) {
    if (!session.phase || ["idle", "disconnected"].includes(session.phase)) return "";
    const isError = session.phase === "error";
    const isSuccess = session.phase === "done";
    const tone = isError ? "danger" : isSuccess ? "success" : "working";
    const phaseLabel = PHASE_LABELS[session.phase] || "正在解锁";
    const actions = isError
      ? `<div class="session-actions">
          <button class="action-button" type="button" data-action="retry" data-id="${escapeHtml(session.doorId)}">重试</button>
          <button class="text-button" type="button" data-action="show-diagnostics">查看诊断</button>
        </div>`
      : isSuccess
        ? `<button class="action-button" type="button" data-action="close-session">完成</button>`
        : `<div class="progress-track" aria-hidden="true"><span></span></div>`;

    return `
      <section class="session-sheet session-sheet--${tone}" role="status" aria-live="polite">
        <span class="sheet-handle" aria-hidden="true"></span>
        <div class="session-sheet__topline">
          <span class="session-badge">${escapeHtml(phaseLabel)}</span>
          <span>${escapeHtml(session.doorName || "门禁")}</span>
        </div>
        <h2>${escapeHtml(session.message || phaseLabel)}</h2>
        ${session.detail ? `<p>${escapeHtml(session.detail)}</p>` : ""}
        ${actions}
      </section>`;
  }

  function renderManage(doors) {
    const items = Array.isArray(doors) ? doors : [];
    const rows = items.map(door => `
      <article class="manage-row">
        <span class="manage-row__icon">${renderDoorIcon()}</span>
        <button class="manage-row__body" type="button" data-action="edit" data-id="${escapeHtml(door.id)}">
          <strong>${escapeHtml(door.name)}</strong>
          <span>${escapeHtml(door.bluetoothName)} · ${escapeHtml(maskMac(door.mac))}</span>
        </button>
        <button class="row-action" type="button" data-action="edit" data-id="${escapeHtml(door.id)}" aria-label="编辑 ${escapeHtml(door.name)}">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </article>`).join("");

    return `
      <section class="view manage-view" data-view="manage">
        <header class="page-header compact">
          <div>
            <p class="eyebrow">LOCAL CONFIGURATION</p>
            <h1>管理门禁</h1>
          </div>
          <button class="icon-button" type="button" data-action="add" aria-label="添加门禁">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </header>
        <p class="privacy-note"><span>仅存此设备</span> 密钥以明文保存在 Bluefy 本地存储中，请勿在公共设备使用。</p>
        <section class="manage-list" aria-label="已配置门禁">
          ${rows || `<div class="small-empty"><p>暂无门禁配置</p><button class="text-button" type="button" data-action="add">现在添加</button></div>`}
        </section>
        <section class="transfer-panel">
          <div><p class="section-kicker">迁移配置</p><h2>复制或导入 JSON</h2></div>
          <p>导出的内容包含完整密钥，只通过可信渠道发送。</p>
          <div class="split-actions">
            <button class="secondary-button" type="button" data-action="export"${items.length ? "" : " disabled"}>复制 JSON</button>
            <button class="secondary-button" type="button" data-action="open-import">导入 JSON</button>
          </div>
        </section>
      </section>`;
  }

  function fieldError(errors, name) {
    return errors?.[name] ? `<span class="field-error">${escapeHtml(errors[name])}</span>` : "";
  }

  function renderEditor(draft = {}, errors = {}) {
    const editing = Boolean(draft.id);
    return `
      <section class="view editor-view" data-view="editor">
        <header class="editor-header">
          <button class="text-button back-button" type="button" data-action="back-manage">取消</button>
          <h1>${editing ? "编辑门禁" : "添加门禁"}</h1>
          <span aria-hidden="true"></span>
        </header>
        <form id="door-form" novalidate>
          <input type="hidden" name="id" value="${escapeHtml(draft.id || "")}">
          <label class="form-field">
            <span>门禁名</span>
            <input name="name" type="text" maxlength="30" autocomplete="off" placeholder="例如：公司东门" value="${escapeHtml(draft.name || "")}" aria-invalid="${Boolean(errors.name)}">
            ${fieldError(errors, "name")}
          </label>
          <label class="form-field">
            <span>门锁蓝牙 MAC</span>
            <input name="mac" type="text" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="AA:BB:CC:DD:EE:FF" value="${escapeHtml(draft.mac || "")}" aria-invalid="${Boolean(errors.mac)}">
            ${fieldError(errors, "mac")}
          </label>
          <label class="form-field">
            <span>蓝牙名称 <small>iOS 必填</small></span>
            <input name="bluetoothName" type="text" maxlength="20" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="例如：BYAA12" value="${escapeHtml(draft.bluetoothName || "")}" aria-invalid="${Boolean(errors.bluetoothName)}">
            ${fieldError(errors, "bluetoothName")}
            <em>必须和 Bluefy 扫描到的设备名完全一致</em>
          </label>
          <label class="form-field">
            <span>PRODUCT_KEY</span>
            <div class="secret-input">
              <input name="productKey" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="16–32 位十六进制" value="${escapeHtml(draft.productKey || "")}" aria-invalid="${Boolean(errors.productKey)}">
              <button type="button" data-action="toggle-secret" aria-label="显示或隐藏密钥">显示</button>
            </div>
            ${fieldError(errors, "productKey")}
          </label>
          <p class="form-warning">密钥只会保存在这台设备的浏览器本地，不会上传。</p>
          <button class="action-button save-button" type="submit">保存门禁</button>
          ${editing ? `<button class="danger-button" type="button" data-action="delete" data-id="${escapeHtml(draft.id)}">删除此门禁</button>` : ""}
        </form>
      </section>`;
  }

  function renderImportPanel(value = "", error = "") {
    return `
      <section class="modal-backdrop" data-action="close-import">
        <div class="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="import-title" data-modal-body>
          <span class="sheet-handle" aria-hidden="true"></span>
          <h2 id="import-title">导入门禁 JSON</h2>
          <p>导入前会完整校验；重复门禁会更新，不会产生半截数据。</p>
          <textarea id="import-json" rows="9" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder='粘贴 {"version":1,"doors":[…]}'>${escapeHtml(value)}</textarea>
          ${error ? `<p class="field-error import-error">${escapeHtml(error)}</p>` : ""}
          <button class="action-button" type="button" data-action="import">校验并导入</button>
          <button class="text-button" type="button" data-action="close-import">取消</button>
        </div>
      </section>`;
  }

  function renderDiagnostics(session = {}) {
    return `
      <section class="modal-backdrop" data-action="close-diagnostics">
        <div class="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="diagnostics-title" data-modal-body>
          <span class="sheet-handle" aria-hidden="true"></span>
          <h2 id="diagnostics-title">解锁诊断</h2>
          <dl class="diagnostics-list">
            <div><dt>安全页面</dt><dd>${globalThis.window?.isSecureContext ? "正常" : "需要 HTTPS"}</dd></div>
            <div><dt>Web Bluetooth</dt><dd>${globalThis.navigator?.bluetooth ? "可用" : "当前浏览器不可用"}</dd></div>
            <div><dt>最后阶段</dt><dd>${escapeHtml(PHASE_LABELS[session.phase] || session.phase || "无")}</dd></div>
            <div><dt>错误</dt><dd>${escapeHtml(session.message || "无")}</dd></div>
          </dl>
          <p>请使用 Bluefy，打开系统蓝牙并靠近门锁。蓝牙名称必须完全匹配。</p>
          <button class="action-button" type="button" data-action="close-diagnostics">知道了</button>
        </div>
      </section>`;
  }

  function renderNav(current) {
    return `
      <nav class="bottom-nav" aria-label="主导航">
        <button type="button" data-action="nav-home"${current === "home" ? ' aria-current="page"' : ""}>
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M9.5 20v-6h5v6"/></svg><span>钥匙</span>
        </button>
        <button type="button" data-action="nav-manage"${current !== "home" ? ' aria-current="page"' : ""}>
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6"/></svg><span>管理</span>
        </button>
      </nav>`;
  }

  globalThis.SafeBaiyunApp = Object.freeze({
    escapeHtml,
    renderHome,
    renderManage,
    renderEditor,
    renderSession,
    renderImportPanel,
    renderDiagnostics,
    renderNav
  });
})();
