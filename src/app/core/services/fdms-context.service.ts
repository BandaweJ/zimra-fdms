import { Injectable, computed, signal } from '@angular/core';
import { Address, Contacts } from '../models/api.models';

export type FdmsBaseUrl = string;

export interface TaxpayerVerificationContext {
  taxPayerName: string;
  taxPayerTIN: string;
  vatNumber?: string;
  deviceBranchName: string;
  deviceBranchAddress: Address;
  deviceBranchContacts?: Contacts;
}

interface StoredTheme {
  baseUrl?: string;
  deviceModelName?: string;
  deviceModelVersion?: string;
  deviceID?: number;
  deviceSerialNo?: string;
  activationKey?: string;
  verifyResult?: TaxpayerVerificationContext;
}

@Injectable({ providedIn: 'root' })
export class FdmsContextService {
  private readonly baseUrl = signal<FdmsBaseUrl>('https://fdmsapitest.zimra.co.zw');
  private readonly deviceModelName = signal<string>('');
  private readonly deviceModelVersion = signal<string>('');
  private readonly deviceID = signal<number | null>(null);
  private readonly deviceSerialNo = signal<string>('');
  private readonly activationKey = signal<string>('');
  private readonly verifyResult = signal<TaxpayerVerificationContext | null>(null);

  readonly headers = computed(() => {
    return this.getRequiredHeaders();
  });

  initFromStorage(): void {
    // NOTE: using localStorage for now; IndexedDB can replace this later.
    try {
      const raw = localStorage.getItem('zimra-fdms-context');
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredTheme;
      if (parsed.baseUrl) this.baseUrl.set(parsed.baseUrl);
      if (parsed.deviceModelName) this.deviceModelName.set(parsed.deviceModelName);
      if (parsed.deviceModelVersion) this.deviceModelVersion.set(parsed.deviceModelVersion);
      if (typeof parsed.deviceID === 'number') this.deviceID.set(parsed.deviceID);
      if (parsed.deviceSerialNo) this.deviceSerialNo.set(parsed.deviceSerialNo);
      if (parsed.activationKey) this.activationKey.set(parsed.activationKey);
      if (parsed.verifyResult) this.verifyResult.set(parsed.verifyResult);
    } catch {
      // ignore
    }
  }

  setBaseUrl(url: string): void {
    this.baseUrl.set(url);
    this.persist();
  }

  setDeviceModel(deviceModelName: string, deviceModelVersion: string): void {
    this.deviceModelName.set(deviceModelName);
    this.deviceModelVersion.set(deviceModelVersion);
    this.persist();
  }

  setDeviceRegistrationContext(input: {
    deviceID: number;
    activationKey: string;
    deviceSerialNo: string;
    verifyResult?: TaxpayerVerificationContext | null;
  }): void {
    this.deviceID.set(input.deviceID);
    this.activationKey.set(input.activationKey);
    this.deviceSerialNo.set(input.deviceSerialNo);
    this.verifyResult.set(input.verifyResult ?? null);
    this.persist();
  }

  getDeviceID(): number | null {
    return this.deviceID();
  }

  getDeviceSerialNo(): string {
    return this.deviceSerialNo();
  }

  getActivationKey(): string {
    return this.activationKey();
  }

  getVerifyResult(): TaxpayerVerificationContext | null {
    return this.verifyResult();
  }

  private persist(): void {
    try {
      const payload: StoredTheme = {
        baseUrl: this.baseUrl(),
        deviceModelName: this.deviceModelName(),
        deviceModelVersion: this.deviceModelVersion(),
        deviceID: this.deviceID() ?? undefined,
        deviceSerialNo: this.deviceSerialNo() || undefined,
        activationKey: this.activationKey() || undefined,
        verifyResult: this.verifyResult() ?? undefined,
      };
      localStorage.setItem('zimra-fdms-context', JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  getRequiredHeaders(): { deviceModelName: string; deviceModelVersion: string } {
    const name = this.deviceModelName();
    const version = this.deviceModelVersion();
    if (!name || !version) {
      throw new Error(
        'FDMS context is not configured. Set device model name/version in setup flow before calling device endpoints.'
      );
    }
    return { deviceModelName: name, deviceModelVersion: version };
  }

  getBaseUrl(): string {
    return this.baseUrl();
  }
}

