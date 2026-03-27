import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  CloseDayRequest,
  FiscalDayCounter,
  FiscalDayDocumentQuantity,
  FiscalDayProcessingError,
  FiscalDayReconciliationMode,
  FiscalDayStatus,
  GetStatusResponse,
  OpenDayRequest,
  OpenDayResponse,
  Receipt,
  SignatureDataEx,
  SubmitReceiptResponse,
} from '../models/api.models';
import { FiscalDayService } from '../services/fiscal-day.service';
import { ReceiptHistoryService } from '../services/receipt-history.service';

export interface FiscalDayState {
  status: FiscalDayStatus | null;
  fiscalDayNo: number | null;
  fiscalDayOpened: string | null;
  counters: FiscalDayCounter[];
  documentQuantities: FiscalDayDocumentQuantity[];
  receiptCounter: number;
  lastReceiptGlobalNo: number;
  lastReceiptHash: string | null;
  reconciliationMode: FiscalDayReconciliationMode | null;
  serverSignature: SignatureDataEx | null;
  closingErrorCode: FiscalDayProcessingError | null;
}

interface FiscalDayDbSchema extends DBSchema {
  fiscalDayState: {
    key: string;
    value: FiscalDayState;
  };
}

const DB_NAME = 'zimra-fdms-fiscal-day';
const DB_VERSION = 1;
const STATE_KEY = 'state';

@Injectable({ providedIn: 'root' })
export class FiscalDayStore {
  private readonly fiscalDayService = inject(FiscalDayService);
  private readonly history = inject(ReceiptHistoryService);

  private dbPromise: Promise<IDBPDatabase<FiscalDayDbSchema>> | null = null;
  private activeDeviceID: number | null = null;

  private readonly state = signal<FiscalDayState>({
    status: null,
    fiscalDayNo: null,
    fiscalDayOpened: null,
    counters: [],
    documentQuantities: [],
    receiptCounter: 0,
    lastReceiptGlobalNo: 0,
    lastReceiptHash: null,
    reconciliationMode: null,
    serverSignature: null,
    closingErrorCode: null,
  });

  readonly view = computed(() => this.state());

  constructor() {
    void this.hydrateFromIndexedDb();
  }

  reset(): void {
    this.state.set({
      status: null,
      fiscalDayNo: null,
      fiscalDayOpened: null,
      counters: [],
      documentQuantities: [],
      receiptCounter: 0,
      lastReceiptGlobalNo: 0,
      lastReceiptHash: null,
      reconciliationMode: null,
      serverSignature: null,
      closingErrorCode: null,
    });
    void this.persistToIndexedDb();
  }

  async openDay(request: OpenDayRequest): Promise<OpenDayResponse> {
    this.activeDeviceID = request.deviceID;
    const res = (await firstValueFrom(this.fiscalDayService.openDay(request))) as OpenDayResponse;
    this.patch({
      status: FiscalDayStatus.FiscalDayOpened,
      fiscalDayNo: res.fiscalDayNo,
      fiscalDayOpened: request.fiscalDayOpened,
      counters: [],
      documentQuantities: [],
      reconciliationMode: null,
      serverSignature: null,
      closingErrorCode: null,
      receiptCounter: this.computeReceiptCounterForDay(request.deviceID, res.fiscalDayNo),
      lastReceiptGlobalNo: this.computeLastReceiptGlobalNoForDay(request.deviceID, res.fiscalDayNo),
      lastReceiptHash: this.computeLastReceiptHashForDay(request.deviceID, res.fiscalDayNo),
    });
    return res;
  }

  async closeDay(request: CloseDayRequest): Promise<void> {
    await firstValueFrom(this.fiscalDayService.closeDay(request));
    this.patch({
      status: FiscalDayStatus.FiscalDayCloseInitiated,
      fiscalDayNo: request.fiscalDayNo,
      // fiscalDayOpened is kept as-is.
      serverSignature: null,
      closingErrorCode: null,
    });
  }

  /**
   * Lightweight mutation patch used by interceptors on successful API calls
   * (so we don't need to re-call endpoints just to update persisted state).
   */
  applyOpenDaySuccess(input: { deviceID: number; fiscalDayNo: number; fiscalDayOpened: string }): void {
    this.activeDeviceID = input.deviceID;
    this.patch({
      status: FiscalDayStatus.FiscalDayOpened,
      fiscalDayNo: input.fiscalDayNo,
      fiscalDayOpened: input.fiscalDayOpened,
      counters: [],
      documentQuantities: [],
      reconciliationMode: null,
      serverSignature: null,
      closingErrorCode: null,
      receiptCounter: this.computeReceiptCounterForDay(input.deviceID, input.fiscalDayNo),
      lastReceiptGlobalNo: this.computeLastReceiptGlobalNoForDay(input.deviceID, input.fiscalDayNo),
      lastReceiptHash: this.computeLastReceiptHashForDay(input.deviceID, input.fiscalDayNo),
    });
  }

  /**
   * Lightweight mutation patch used by interceptors on successful API calls.
   */
  applyCloseDaySuccess(input: { fiscalDayNo: number }): void {
    this.patch({
      status: FiscalDayStatus.FiscalDayCloseInitiated,
      fiscalDayNo: input.fiscalDayNo,
      serverSignature: null,
      closingErrorCode: null,
    });
  }

  applyCloseDayError(input: { fiscalDayNo: number | null; error: FiscalDayProcessingError }): void {
    this.patch({
      status: FiscalDayStatus.FiscalDayCloseFailed,
      fiscalDayNo: input.fiscalDayNo,
      closingErrorCode: input.error,
      serverSignature: null,
    });
  }

  applyOpenDayError(input: { deviceID: number | null; fiscalDayNo: number | null; error: FiscalDayProcessingError }): void {
    if (input.deviceID != null) this.activeDeviceID = input.deviceID;
    this.patch({
      status: FiscalDayStatus.FiscalDayCloseFailed,
      fiscalDayNo: input.fiscalDayNo ?? this.state().fiscalDayNo,
      // We re-use `closingErrorCode` as the global fiscal-day failure code so UI can show guidance.
      closingErrorCode: input.error,
      serverSignature: null,
    });
  }

  /**
   * Call after a successful `SubmitReceipt` so the state contains the latest receipt hash/global no.
   */
  submitReceiptSuccess(input: { receipt: Receipt; response: SubmitReceiptResponse }): void {
    this.patch({
      lastReceiptGlobalNo: input.receipt.receiptGlobalNo,
      lastReceiptHash: input.receipt.receiptDeviceSignature?.hash ?? null,
      receiptCounter: input.receipt.receiptCounter,
    });
  }

  async loadStatus(deviceID: number): Promise<void> {
    this.activeDeviceID = deviceID;
    const res = (await firstValueFrom(this.fiscalDayService.getStatus({ deviceID }))) as GetStatusResponse;
    const fiscalDayNo = res.lastFiscalDayNo ?? null;
    const lastReceiptGlobalNo = res.lastReceiptGlobalNo ?? 0;

    // Best-effort: try to recover last receipt hash from the locally stored receipt history.
    let lastReceiptHash: string | null = null;
    if (fiscalDayNo != null) {
      const local = this.history.findByDeviceGlobalFiscal(deviceID, lastReceiptGlobalNo, fiscalDayNo);
      lastReceiptHash = local?.receipt.receiptDeviceSignature?.hash ?? null;
    }

    this.patch(
      {
      status: res.fiscalDayStatus ?? null,
      fiscalDayNo,
      counters: res.fiscalDayCounters ?? [],
      documentQuantities: res.fiscalDayDocumentQuantities ?? [],
      receiptCounter: fiscalDayNo != null ? this.computeReceiptCounterForDay(deviceID, fiscalDayNo) : 0,
      lastReceiptGlobalNo,
      lastReceiptHash,
      reconciliationMode: res.fiscalDayReconciliationMode ?? null,
      serverSignature: res.fiscalDayServerSignature ?? null,
      closingErrorCode: res.fiscalDayClosingErrorCode ?? null,
      // fiscalDayOpened not returned by the current getStatus payload in this codebase.
      },
      false
    );
  }

  private computeReceiptCounterForDay(deviceID: number, fiscalDayNo: number): number {
    // Receipt counter is per fiscal day: number of receipts already submitted in that day.
    return this.history.listByDeviceFiscalDay(deviceID, fiscalDayNo).length;
  }

  private computeLastReceiptGlobalNoForDay(deviceID: number, fiscalDayNo: number): number {
    const list = this.history.listByDeviceFiscalDay(deviceID, fiscalDayNo);
    const max = list.reduce((acc, r) => Math.max(acc, r.receipt.receiptGlobalNo), 0);
    return max;
  }

  private computeLastReceiptHashForDay(deviceID: number, fiscalDayNo: number): string | null {
    const list = this.history.listByDeviceFiscalDay(deviceID, fiscalDayNo);
    const last = list
      .map((r) => r.receipt)
      .sort((a, b) => b.receiptGlobalNo - a.receiptGlobalNo)[0];
    return last?.receiptDeviceSignature?.hash ?? null;
  }

  private patch(partial: Partial<FiscalDayState>, persist = true): void {
    this.state.set({ ...this.state(), ...partial });
    if (persist) void this.persistToIndexedDb();
  }

  private async db(): Promise<IDBPDatabase<FiscalDayDbSchema>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<FiscalDayDbSchema>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('fiscalDayState')) {
            db.createObjectStore('fiscalDayState', { keyPath: 'key' });
          }
        },
      });
    }
    return this.dbPromise;
  }

  private async persistToIndexedDb(): Promise<void> {
    const db = await this.db();
    await db.put('fiscalDayState', { key: STATE_KEY, value: this.state() } as any);
  }

  private async hydrateFromIndexedDb(): Promise<void> {
    try {
      const db = await this.db();
      const row = (await db.get('fiscalDayState', STATE_KEY)) as any;
      if (!row?.value) return;
      // Fill defaults for fields added after earlier versions.
      const loaded = row.value as Partial<FiscalDayState>;
      this.state.set({
        ...this.state(),
        ...loaded,
        documentQuantities: loaded.documentQuantities ?? [],
      });
    } catch {
      // ignore
    }
  }
}

