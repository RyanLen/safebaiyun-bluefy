import React, { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  ArrowRight,
  Bluetooth,
  CheckCircle2,
  ChevronRight,
  Copy,
  DoorOpen,
  Eye,
  EyeOff,
  FileJson,
  Home,
  Info,
  Loader2,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "./components/ui/alert-dialog";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import "./index.css";
import "../core.js";
import "../store.js";
import "../ble.js";
import "../app.js";

const PHASE_LABELS = Object.freeze({
  select: "选择设备",
  connect: "连接门锁",
  service: "连接门锁服务",
  notify: "订阅通知",
  read: "读取挑战",
  compute: "计算应答",
  write: "写入指令",
  done: "已完成",
  error: "未完成"
});

const TERMINAL_PHASES = new Set(["idle", "done", "error", "disconnected"]);

function phaseLabel(value?: string) {
  return (value && PHASE_LABELS[value as keyof typeof PHASE_LABELS]) || value || "正在解锁";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function createClipboard() {
  return {
    async writeText(text: string) {
      if (globalThis.navigator?.clipboard?.writeText) {
        await globalThis.navigator.clipboard.writeText(text);
        return;
      }
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) throw new Error("copy failed");
    }
  };
}

function createRuntime() {
  const App = globalThis.SafeBaiyunApp;
  let controller: AppController | undefined;
  const ble = globalThis.SafeBaiyunBle.create({
    bluetooth: globalThis.navigator?.bluetooth,
    onEvent: event => controller?.handleBleEvent(event)
  });
  controller = App.createController({
    store: globalThis.SafeBaiyunStore.create(globalThis.localStorage),
    ble,
    clipboard: createClipboard(),
    idFactory: () => globalThis.crypto?.randomUUID?.()
      || `door-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  });
  return controller;
}

function useRuntime() {
  const controller = useMemo(createRuntime, []);
  const [state, setState] = useState(controller.getState);
  useEffect(() => controller.subscribe(setState), [controller]);
  return { controller, state };
}

function Field({ label, hint, error, children }: { label: ReactNode; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error ? <p className="field-error">{error}</p> : null}
      {hint ? <p className="form-hint">{hint}</p> : null}
    </div>
  );
}

function PageHeader({ eyebrow, title, intro, action }: { eyebrow: string; title: string; intro?: string; action: ReactNode }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow"><span className="status-dot" />{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        {intro ? <p className="page-intro">{intro}</p> : null}
      </div>
      {action}
    </header>
  );
}

function DoorCard({ door, busy, active, onUnlock }: { door: DoorConfig; busy: boolean; active: boolean; onUnlock: (id: string) => void }) {
  return (
    <Card className={`door-card ${active ? "ring-1 ring-accent/60" : ""}`}>
      <CardContent className="relative z-[1] p-5">
        <div className="flex items-center gap-3">
          <span className="door-icon-wrap"><DoorOpen className="size-6" aria-hidden="true" /></span>
          <div className="door-meta">
            <h2>{door.name}</h2>
            <p>{door.bluetoothName}</p>
          </div>
        </div>
        <p className="mac-line">••:••:••:{door.mac.split(":").slice(3).join(":")}</p>
        <Button
          className="unlock-button"
          disabled={busy}
          aria-busy={active || undefined}
          onClick={() => onUnlock(door.id || "")}
        >
          {active ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Bluetooth className="size-4" aria-hidden="true" />}
          {active ? "解锁中…" : "解锁"}
          {!active ? <ArrowRight className="ml-auto size-4" aria-hidden="true" /> : null}
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyHome({ onAdd }: { onAdd: () => void }) {
  return (
    <Card className="border-dashed bg-panel/55">
      <CardContent className="flex flex-col items-center px-6 py-12 text-center">
        <span className="empty-mark"><DoorOpen className="size-7" aria-hidden="true" /></span>
        <h2 className="mt-2 text-xl font-semibold">还没有门禁</h2>
        <p className="mt-2 max-w-xs text-sm leading-6 text-muted">添加一次，以后打开页面就能直接解锁。</p>
        <Button className="mt-6" onClick={onAdd}><Plus className="size-4" />添加第一个门禁</Button>
      </CardContent>
    </Card>
  );
}

function HomeView({ doors, session, onAdd, onUnlock }: { doors: DoorConfig[]; session: BleSession; onAdd: () => void; onUnlock: (id: string) => void }) {
  const busy = !TERMINAL_PHASES.has(session.phase);
  return (
    <main className="app-view">
      <PageHeader
        eyebrow="BLUEFY KEYRING"
        title="门禁钥匙"
        intro="靠近门锁，轻点即可解锁"
        action={<Button variant="secondary" size="icon" aria-label="添加门禁" onClick={onAdd}><Plus className="size-5" /></Button>}
      />
      {doors.length ? (
        <section className="space-y-3" aria-label="我的门禁">
          {doors.map(door => (
            <DoorCard key={door.id} door={door} busy={busy} active={busy && session.doorId === door.id} onUnlock={onUnlock} />
          ))}
        </section>
      ) : <EmptyHome onAdd={onAdd} />}
    </main>
  );
}

function ManageRow({ door, onEdit }: { door: DoorConfig; onEdit: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-line py-4 last:border-0">
      <span className="door-icon-wrap size-11 rounded-xl"><DoorOpen className="size-5" aria-hidden="true" /></span>
      <button className="min-w-0 flex-1 text-left" onClick={() => onEdit(door.id || "")}>
        <strong className="block truncate text-[15px] font-semibold">{door.name}</strong>
        <span className="mt-1 block truncate text-xs text-muted">{door.bluetoothName} · ••:••:{door.mac.split(":").slice(2).join(":")}</span>
      </button>
      <button className="inline-flex size-10 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-ink" aria-label={`编辑 ${door.name}`} onClick={() => onEdit(door.id || "")}>
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}

function ManageView({ doors, onAdd, onEdit, onImport, onExport }: { doors: DoorConfig[]; onAdd: () => void; onEdit: (id: string) => boolean; onImport: () => void; onExport: () => void }) {
  return (
    <main className="app-view">
      <PageHeader
        eyebrow="LOCAL CONFIGURATION"
        title="管理门禁"
        action={<Button variant="secondary" size="icon" aria-label="添加门禁" onClick={onAdd}><Plus className="size-5" /></Button>}
      />
      <div className="mb-5 flex gap-2 rounded-control border border-line bg-panel/55 px-4 py-3 text-xs leading-5 text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
        <span>仅存此设备。密钥保存在 Bluefy 本地，请勿在公共设备使用。</span>
      </div>
      <Card className="mb-4 px-4">
        {doors.length ? doors.map(door => <ManageRow key={door.id} door={door} onEdit={onEdit} />) : (
          <div className="py-8 text-center text-sm text-muted">暂无门禁配置</div>
        )}
      </Card>
      <Card>
        <CardHeader>
          <p className="eyebrow mb-2">TRANSFER</p>
          <CardTitle>复制或导入 JSON</CardTitle>
          <CardDescription className="mt-1">配置包含完整密钥，只通过可信渠道传递。</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="secondary" disabled={!doors.length} onClick={onExport}><Copy className="size-4" />复制 JSON</Button>
          <Button variant="secondary" onClick={onImport}><Upload className="size-4" />导入 JSON</Button>
        </CardContent>
      </Card>
    </main>
  );
}

function EditorView({ draft, errors, onCancel, onSave, onDelete }: { draft: Partial<DoorConfig> | null; errors: Record<string, string>; onCancel: () => void; onSave: (form: Partial<DoorConfig>) => void; onDelete: (door: Partial<DoorConfig>) => void }) {
  const [form, setForm] = useState<Partial<DoorConfig>>(draft || {});
  const [showSecret, setShowSecret] = useState(false);
  useEffect(() => {
    setForm(draft || {});
    setShowSecret(false);
  }, [draft]);
  const update = (name: keyof DoorConfig, value: string) => setForm(current => ({ ...current, [name]: value }));
  const editing = Boolean(form.id);
  const normalizeBluetoothName = globalThis.SafeBaiyunCore.normalizeBluetoothName;

  return (
    <main className="app-view">
      <header className="mb-7 flex items-center justify-between gap-3">
        <button className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted hover:bg-white/10 hover:text-ink" onClick={onCancel}>
          <X className="size-4" />取消
        </button>
        <h1 className="text-lg font-semibold">{editing ? "编辑门禁" : "添加门禁"}</h1>
        <span className="w-16" aria-hidden="true" />
      </header>
      <Card>
        <CardContent className="space-y-5 p-5">
          <Field label="门禁名" error={errors.name}>
            <Input value={form.name || ""} maxLength={30} autoComplete="off" placeholder="例如：公司东门" onChange={event => update("name", event.target.value)} />
          </Field>
          <Field label="门锁蓝牙 MAC" error={errors.mac}>
            <Input value={form.mac || ""} inputMode="text" autoCapitalize="characters" autoComplete="off" spellCheck="false" placeholder="AA:BB:CC:DD:EE:FF" onChange={event => update("mac", event.target.value.toUpperCase())} />
          </Field>
          <Field label={<span>蓝牙名称 <span className="text-xs text-muted">· iOS 必填</span></span>} error={errors.bluetoothName} hint="必须和 Bluefy 扫描到的设备名完全一致">
            <Input value={form.bluetoothName || ""} maxLength={20} autoCapitalize="characters" autoComplete="off" spellCheck="false" placeholder="例如：BYAA12" onChange={event => update("bluetoothName", normalizeBluetoothName(event.target.value))} />
          </Field>
          <Field label="PRODUCT_KEY" error={errors.productKey}>
            <div className="relative">
              <Input className="pr-16 font-mono tracking-[.08em]" type={showSecret ? "text" : "password"} value={form.productKey || ""} autoComplete="off" autoCapitalize="off" spellCheck="false" placeholder="16–32 位十六进制" onChange={event => update("productKey", event.target.value.toUpperCase())} />
              <button type="button" className="absolute right-2 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-white/10 hover:text-ink" aria-label={showSecret ? "隐藏密钥" : "显示密钥"} onClick={() => setShowSecret(value => !value)}>
                {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <div className="flex gap-2 rounded-control border border-accent/20 bg-accent/5 px-3 py-3 text-xs leading-5 text-muted">
            <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            <span>密钥只会保存在这台设备的浏览器本地，不会上传。</span>
          </div>
          <Button className="w-full" onClick={() => onSave({ ...form })}>保存门禁</Button>
          {editing ? <Button variant="danger" className="w-full" onClick={() => onDelete({ ...form })}><Trash2 className="size-4" />删除此门禁</Button> : null}
        </CardContent>
      </Card>
    </main>
  );
}

function SessionSheet({ session, onRetry, onClose, onDiagnostics }: { session: BleSession; onRetry: (id: string) => void; onClose: () => void; onDiagnostics: () => void }) {
  if (!session.phase || TERMINAL_PHASES.has(session.phase) && session.phase !== "done" && session.phase !== "error") return null;
  const error = session.phase === "error";
  const success = session.phase === "done";
  const phase = phaseLabel(session.phase);
  return (
    <section className={`session-sheet ${success ? "success" : error ? "error" : ""}`} role="status" aria-live="polite">
      <div className="session-kicker">
        <span className="inline-flex items-center gap-1.5">
          {error ? <AlertTriangle className="size-4 text-danger" /> : success ? <CheckCircle2 className="size-4 text-[#79d990]" /> : <Loader2 className="size-4 animate-spin text-accent" />}
          {phase}
        </span>
        <span className="truncate">{session.doorName || "门禁"}</span>
      </div>
      <h2>{session.message || phase}</h2>
      {session.detail ? <p>{session.detail}</p> : null}
      {error ? (
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" disabled={!session.doorId} onClick={() => { if (session.doorId) onRetry(session.doorId); }}>重试</Button>
          <Button variant="secondary" onClick={onDiagnostics}>查看诊断</Button>
        </div>
      ) : success ? (
        <Button className="mt-4 w-full" onClick={onClose}>完成</Button>
      ) : <div className="progress-line"><span /></div>}
    </section>
  );
}

function BottomNav({ view, onHome, onManage }: { view: AppState["view"]; onHome: () => void; onManage: () => void }) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      <button type="button" aria-current={view === "home" ? "page" : undefined} onClick={onHome}><Home aria-hidden="true" /><span>钥匙</span></button>
      <button type="button" aria-current={view === "manage" ? "page" : undefined} onClick={onManage}><Settings2 aria-hidden="true" /><span>管理</span></button>
    </nav>
  );
}

function ImportDialog({ open, value, error, onOpenChange, onChange, onSubmit }: { open: boolean; value: string; error: string; onOpenChange: (open: boolean) => void; onChange: (value: string) => void; onSubmit: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>导入门禁 JSON</DialogTitle>
          <DialogDescription>导入前会完整校验；重复门禁会更新，不会产生半截数据。</DialogDescription>
        </DialogHeader>
        <Textarea value={value} rows={8} autoCapitalize="off" autoComplete="off" spellCheck="false" placeholder='粘贴 {"version":1,"doors":[…]}' onChange={event => onChange(event.target.value)} />
        {error ? <p className="field-error">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={onSubmit}><FileJson className="size-4" />校验并导入</Button>
          <DialogClose asChild><Button variant="secondary">取消</Button></DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DiagnosticsDialog({ open, session, onOpenChange }: { open: boolean; session: BleSession; onOpenChange: (open: boolean) => void }) {
  const secure = globalThis.window?.isSecureContext;
  const bluetooth = globalThis.navigator?.bluetooth;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>解锁诊断</DialogTitle>
          <DialogDescription>这些信息只在当前页面显示，不会上传。</DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-line overflow-hidden rounded-control border border-line">
          <div className="flex items-start justify-between gap-4 px-3 py-3 text-sm"><dt className="text-muted">安全页面</dt><dd>{secure ? "正常" : "需要 HTTPS"}</dd></div>
          <div className="flex items-start justify-between gap-4 px-3 py-3 text-sm"><dt className="text-muted">Web Bluetooth</dt><dd>{bluetooth ? "可用" : "当前浏览器不可用"}</dd></div>
          <div className="flex items-start justify-between gap-4 px-3 py-3 text-sm"><dt className="text-muted">失败阶段</dt><dd className="text-right">{session.failedStage ? phaseLabel(session.failedStage) : phaseLabel(session.phase)}</dd></div>
          <div className="flex items-start justify-between gap-4 px-3 py-3 text-sm"><dt className="text-muted">错误类型</dt><dd className="max-w-[12rem] break-words text-right">{session.errorName || "未提供"}</dd></div>
          <div className="flex items-start justify-between gap-4 px-3 py-3 text-sm"><dt className="text-muted">错误</dt><dd className="max-w-[12rem] break-words text-right">{session.message || "无"}</dd></div>
          {session.errorDetail ? <div className="flex flex-col gap-1 px-3 py-3 text-sm"><dt className="text-muted">原始信息</dt><dd className="break-words font-mono text-xs text-muted">{session.errorDetail}</dd></div> : null}
        </dl>
        <p className="mt-4 flex gap-2 text-sm leading-6 text-muted"><Bluetooth className="mt-1 size-4 shrink-0 text-accent" />请使用 Bluefy，打开系统蓝牙并靠近门锁。蓝牙名称必须完全匹配。</p>
        <Button className="mt-4 w-full" onClick={() => onOpenChange(false)}>知道了</Button>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDeleteDialog({ door, onOpenChange, onConfirm }: { door: Partial<DoorConfig> | null; onOpenChange: (open: boolean) => void; onConfirm: () => void }) {
  return (
    <AlertDialog open={Boolean(door)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle className="block text-xl font-semibold">删除“{door?.name}”？</AlertDialogTitle>
        <AlertDialogDescription className="mt-2 block text-sm leading-6 text-muted">此操作只影响这台设备，删除后需要重新填写门禁参数。</AlertDialogDescription>
        <div className="mt-6 flex gap-2">
          <AlertDialogCancel asChild><Button variant="secondary" className="flex-1">取消</Button></AlertDialogCancel>
          <AlertDialogAction asChild><Button variant="danger" className="flex-1" onClick={onConfirm}><Trash2 className="size-4" />删除</Button></AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConfirmExportDialog({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle className="block text-xl font-semibold">复制完整门禁配置？</AlertDialogTitle>
        <AlertDialogDescription className="mt-2 block text-sm leading-6 text-muted">JSON 包含 PRODUCT_KEY。只通过可信渠道分享，复制后请及时清理剪贴板。</AlertDialogDescription>
        <div className="mt-6 flex gap-2">
          <AlertDialogCancel asChild><Button variant="secondary" className="flex-1">取消</Button></AlertDialogCancel>
          <AlertDialogAction asChild><Button className="flex-1" onClick={onConfirm}><Copy className="size-4" />确认复制</Button></AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function App() {
  const { controller, state } = useRuntime();
  const [importText, setImportText] = useState("");
  const [deleteDoor, setDeleteDoor] = useState<Partial<DoorConfig> | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    if (state.modal === "import") setImportText(state.importValue || "");
  }, [state.modal, state.importValue]);

  useEffect(() => {
    if (!state.toast) return undefined;
    const timer = setTimeout(() => controller.clearToast(), 2400);
    return () => clearTimeout(timer);
  }, [controller, state.toast]);

  const onUnlock = (id: string) => {
    controller.unlock(id).catch(() => {});
  };

  const onSave = (form: Partial<DoorConfig>) => {
    try {
      const result = controller.saveDoor(form);
      if (!result.ok) controller.setToast("请检查标红字段");
    } catch (error) {
      controller.setToast(`保存失败：${errorMessage(error)}`);
    }
  };

  const onImport = () => {
    try {
      controller.importDoors(importText);
    } catch (error) {
      controller.setImportError(importText, errorMessage(error));
    }
  };

  const onExport = () => setExportOpen(true);
  const confirmExport = () => {
    setExportOpen(false);
    controller.exportDoors().catch(error => controller.setToast(error.message));
  };

  let view;
  if (state.view === "home") {
    view = <HomeView doors={state.doors} session={state.session} onAdd={controller.startAdd} onUnlock={onUnlock} />;
  } else if (state.view === "manage") {
    view = <ManageView doors={state.doors} onAdd={controller.startAdd} onEdit={controller.startEdit} onImport={controller.openImport} onExport={onExport} />;
  } else {
    view = <EditorView draft={state.draft} errors={state.errors} onCancel={controller.openManage} onSave={onSave} onDelete={setDeleteDoor} />;
  }

  return (
    <div className="app-shell">
      {view}
      {state.view !== "editor" ? <BottomNav view={state.view} onHome={controller.openHome} onManage={controller.openManage} /> : null}
      <SessionSheet session={state.session} onRetry={onUnlock} onClose={controller.closeSession} onDiagnostics={controller.showDiagnostics} />
      <ImportDialog open={state.modal === "import"} value={importText} error={state.importError} onOpenChange={open => { if (!open) controller.closeModal(); }} onChange={setImportText} onSubmit={onImport} />
      <DiagnosticsDialog open={state.modal === "diagnostics"} session={state.session} onOpenChange={open => { if (!open) controller.closeModal(); }} />
      <ConfirmDeleteDialog door={deleteDoor} onOpenChange={open => { if (!open) setDeleteDoor(null); }} onConfirm={() => { if (deleteDoor?.id) controller.deleteDoor(deleteDoor.id); setDeleteDoor(null); }} />
      <ConfirmExportDialog open={exportOpen} onOpenChange={setExportOpen} onConfirm={confirmExport} />
      {state.toast ? <div className="toast" role="status">{state.toast}</div> : null}
    </div>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
