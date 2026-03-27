import { Injectable } from '@angular/core';
import { Receipt, SubmitReceiptResponse } from '../models/api.models';

export type ReceiptValidationLevel = 'white' | 'grey' | 'yellow' | 'red';

export interface StoredSubmittedReceipt {
  localID: string;
  deviceID: number;
  fiscalDayNo: number;
  createdAt: string;
  qrUrl?: string;
  receipt: Receipt;
  response: SubmitReceiptResponse;
  validationLevel: ReceiptValidationLevel;
  validationCodes?: string[];
}

const KEY = 'zimra:submitted-receipts:v1';

@Injectable({ providedIn: 'root' })
export class ReceiptHistoryService {
  listAll(): StoredSubmittedReceipt[] {
    return this.read().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  listByFiscalDay(fiscalDayNo: number): StoredSubmittedReceipt[] {
    return this.listAll().filter((r) => r.fiscalDayNo === fiscalDayNo);
  }

  listByDeviceFiscalDay(deviceID: number, fiscalDayNo: number): StoredSubmittedReceipt[] {
    return this.listAll().filter((r) => r.deviceID === deviceID && r.fiscalDayNo === fiscalDayNo);
  }

  findByLocalID(localID: string): StoredSubmittedReceipt | null {
    return this.listAll().find((r) => r.localID === localID) ?? null;
  }

  findByReceiptID(receiptID: number): StoredSubmittedReceipt | null {
    return this.listAll().find((r) => r.response.receiptID === receiptID) ?? null;
  }

  findByDeviceGlobalFiscal(deviceID: number, receiptGlobalNo: number, fiscalDayNo: number): StoredSubmittedReceipt | null {
    return (
      this.listAll().find(
        (r) => r.deviceID === deviceID && r.fiscalDayNo === fiscalDayNo && r.receipt.receiptGlobalNo === receiptGlobalNo
      ) ?? null
    );
  }

  save(entry: Omit<StoredSubmittedReceipt, 'localID' | 'createdAt'>): StoredSubmittedReceipt {
    const record: StoredSubmittedReceipt = {
      ...entry,
      localID: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const all = this.read();
    all.unshift(record);
    localStorage.setItem(KEY, JSON.stringify(all));
    return record;
  }

  getPreviousReceiptHash(
    fiscalDayNo: number,
    currentReceiptGlobalNo: number,
    deviceID?: number
  ): string {
    const list = deviceID != null ? this.listByDeviceFiscalDay(deviceID, fiscalDayNo) : this.listByFiscalDay(fiscalDayNo);
    const prev = list
      .map((r) => r.receipt)
      .filter((r) => r.receiptGlobalNo < currentReceiptGlobalNo)
      .sort((a, b) => b.receiptGlobalNo - a.receiptGlobalNo)[0];
    return prev?.receiptDeviceSignature?.hash ?? '';
  }

  private read(): StoredSubmittedReceipt[] {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as StoredSubmittedReceipt[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

