export {};

declare global {
  interface DoorConfig {
    id?: string;
    name: string;
    mac: string;
    bluetoothName: string;
    productKey: string;
  }

  interface Bluetooth {
    requestDevice(options: unknown): Promise<unknown>;
  }

  interface Navigator {
    bluetooth?: Bluetooth;
  }

  interface BleSession {
    phase: string;
    tone?: string;
    doorId: string | null;
    doorName: string;
    message: string;
    detail: string;
    failedStage?: string;
    errorName?: string;
    errorDetail?: string;
  }

  interface AppState {
    doors: DoorConfig[];
    view: "home" | "manage" | "editor";
    draft: Partial<DoorConfig> | null;
    errors: Record<string, string>;
    session: BleSession;
    modal: string | null;
    importValue: string;
    importError: string;
    toast: string | null;
  }

  interface AppController {
    getState(): AppState;
    subscribe(listener: (state: AppState) => void): () => void;
    saveDoor(input: Partial<DoorConfig>): { ok: boolean; errors: Record<string, string>; value?: DoorConfig };
    deleteDoor(id: string): boolean;
    exportDoors(): Promise<string>;
    importDoors(text: string): { added: number; updated: number };
    handleBleEvent(event: Partial<BleSession>): void;
    unlock(id: string): Promise<unknown>;
    openHome(): void;
    openManage(): void;
    startAdd(): void;
    startEdit(id: string): boolean;
    openImport(): void;
    closeModal(): void;
    setImportError(value: string, error: string): void;
    showDiagnostics(): void;
    closeSession(): void;
    clearToast(): void;
    setToast(toast: string | null): void;
  }

  var SafeBaiyunCore: {
    normalizeBluetoothName(value: string): string;
  };
  var SafeBaiyunStore: {
    create(storage: Storage): unknown;
  };
  var SafeBaiyunBle: {
    create(options: { bluetooth?: Bluetooth; onEvent(event: Partial<BleSession>): void }): unknown;
  };
  var SafeBaiyunApp: {
    createController(options: {
      store: unknown;
      ble: unknown;
      clipboard: { writeText(text: string): Promise<void> };
      idFactory: () => string;
    }): AppController;
  };
}
