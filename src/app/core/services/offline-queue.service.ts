import { Injectable } from '@angular/core';
import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { Receipt } from '../models/api.models';

export type OfflineReceiptState = 'Queued' | 'InFile' | 'Sent';

export interface OfflineQueuedReceipt {
  localID: string;
  deviceID: number;
  fiscalDayNo: number;
  receipt: Receipt;
  createdAt: string;
  state: OfflineReceiptState;
  fileSequence?: number;
}

interface OfflineSubmissionMeta {
  operationID: string;
  deviceID: number;
  fiscalDayNo: number;
  fileSequence: number;
  queuedReceiptLocalIDs: string[];
  createdAt: string;
}

interface OfflineDbSchema extends DBSchema {
  offlineReceipts: {
    key: string;
    value: OfflineQueuedReceipt;
  };
}

const DB_NAME = 'zimra-fdms-offline';
const DB_VERSION = 1;
const META_KEY = 'zimra:offline:submission-meta:v1';
const SEQ_PREFIX = 'zimra:offline:seq:';

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private dbPromise: Promise<IDBPDatabase<OfflineDbSchema>> | null = null;

  private async db(): Promise<IDBPDatabase<OfflineDbSchema>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<OfflineDbSchema>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('offlineReceipts')) {
            db.createObjectStore('offlineReceipts', { keyPath: 'localID' });
          }
        },
      });
    }
    return this.dbPromise;
  }

  async enqueueReceipt(input: Omit<OfflineQueuedReceipt, 'localID' | 'createdAt' | 'state'>): Promise<OfflineQueuedReceipt> {
    const rec: OfflineQueuedReceipt = {
      ...input,
      localID: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      state: 'Queued',
    };
    const db = await this.db();
    await db.put('offlineReceipts', rec);
    return rec;
  }

  async listReceipts(deviceID: number, fiscalDayNo?: number): Promise<OfflineQueuedReceipt[]> {
    const db = await this.db();
    const all = await db.getAll('offlineReceipts');
    return all
      .filter((r) => r.deviceID === deviceID && (fiscalDayNo == null || r.fiscalDayNo === fiscalDayNo))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async listAllReceipts(): Promise<OfflineQueuedReceipt[]> {
    const db = await this.db();
    const all = await db.getAll('offlineReceipts');
    return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async updateState(localIDs: string[], state: OfflineReceiptState, fileSequence?: number): Promise<void> {
    if (!localIDs.length) return;
    const db = await this.db();
    const tx = db.transaction('offlineReceipts', 'readwrite');
    for (const id of localIDs) {
      const row = await tx.store.get(id);
      if (!row) continue;
      await tx.store.put({ ...row, state, ...(fileSequence != null ? { fileSequence } : {}) });
    }
    await tx.done;
  }

  getNextFileSequence(deviceID: number, fiscalDayNo: number): number {
    const key = `${SEQ_PREFIX}${deviceID}:${fiscalDayNo}`;
    const current = Number(localStorage.getItem(key) ?? '0');
    return Number.isFinite(current) && current > 0 ? current + 1 : 1;
  }

  commitFileSequence(deviceID: number, fiscalDayNo: number, sequence: number): void {
    const key = `${SEQ_PREFIX}${deviceID}:${fiscalDayNo}`;
    localStorage.setItem(key, String(sequence));
  }

  addSubmissionMeta(meta: OfflineSubmissionMeta): void {
    const all = this.getSubmissionMeta();
    all.unshift(meta);
    localStorage.setItem(META_KEY, JSON.stringify(all.slice(0, 200)));
  }

  getSubmissionMeta(): OfflineSubmissionMeta[] {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as OfflineSubmissionMeta[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  getLastOperationID(): string {
    return this.getSubmissionMeta()[0]?.operationID ?? '';
  }

  findByOperationID(operationID: string): OfflineSubmissionMeta | null {
    return this.getSubmissionMeta().find((m) => m.operationID === operationID) ?? null;
  }

  async clearAllReceipts(): Promise<void> {
    const db = await this.db();
    await db.clear('offlineReceipts');
  }
}

