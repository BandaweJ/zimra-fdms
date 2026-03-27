import { Injectable } from '@angular/core';
import md5 from 'crypto-js/md5';
import { FiscalDayCounter, ReceiptTax, ReceiptType, SignatureData } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class CryptoService {
  private encodeUtf8(str: string): Uint8Array {
    return new TextEncoder().encode(str);
  }

  private centsFromAmount(amount: number): string {
    return String(Math.round(amount * 100));
  }

  private percentToFixed2String(v?: number): string {
    if (v == null || !Number.isFinite(v)) return '';
    return v.toFixed(2);
  }

  private localDateToYmd(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private isoToDdMmYyyy(iso: string): string {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}${mm}${yyyy}`;
  }

  private pad10(n: number): string {
    return String(n).padStart(10, '0');
  }

  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  private pemToDerBytes(pem: string): Uint8Array {
    const trimmed = pem.trim();
    const body = trimmed
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/[\r\n\s]/g, '');
    if (!body) throw new Error('Invalid PEM. Missing PRIVATE KEY body.');

    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async sha256Digest(data: Uint8Array): Promise<Uint8Array> {
    const webCrypto = globalThis.crypto;
    if (!webCrypto?.subtle) throw new Error('WebCrypto is not available in this browser context.');
    const dataBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const digest = await webCrypto.subtle.digest('SHA-256', dataBuffer);
    return new Uint8Array(digest);
  }

  async sha256Base64(data: Uint8Array): Promise<string> {
    const digest = await this.sha256Digest(data);
    return this.toBase64(digest);
  }

  /**
   * Signs the provided payload bytes using an ECDSA (P-256 / secp256r1) PKCS#8 PEM private key.
   * @remarks
   * Expects a PEM of the form `-----BEGIN PRIVATE KEY-----` (PKCS#8).
   * WebCrypto returns a signature in its native format (commonly DER).
   */
  async sign(payload: Uint8Array, privateKeyPem: string): Promise<Uint8Array> {
    const webCrypto = globalThis.crypto;
    if (!webCrypto?.subtle) throw new Error('WebCrypto is not available in this browser context.');

    const der = this.pemToDerBytes(privateKeyPem);
    const derBuffer = der.buffer.slice(der.byteOffset, der.byteOffset + der.byteLength) as ArrayBuffer;
    const payloadBuffer = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength) as ArrayBuffer;
    const key = await webCrypto.subtle.importKey(
      'pkcs8',
      derBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );

    // Sign the raw bytes (caller can pass in a hash digest instead).
    const sig = await webCrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, payloadBuffer);
    return new Uint8Array(sig);
  }

  // ------------------------------------------------------------
  // Spec 13.1–13.3 signing (device signatures + QR data)
  // ------------------------------------------------------------

  /**
   * Build the exact concatenation string for `receiptDeviceSignature` (spec 13.1 / 13.2.1 preimage).
   * Then the caller hashes the bytes with SHA-256 and signs using the device private key.
   */
  buildReceiptDeviceSignatureConcatString(input: {
    deviceID: number;
    receiptType: ReceiptType;
    currency: string;
    receiptGlobalNo: number;
    receiptDateISO8601: string; // ISO8601 string
    receiptTotal: number; // currency amount
    taxes: ReceiptTax[]; // receiptTaxes in same order they are provided by UI/API
    previousReceiptHash?: string | null;
  }): string {
    const receiptTypeStr = ReceiptType[input.receiptType]?.toUpperCase() ?? String(input.receiptType);
    const currencyStr = input.currency.toUpperCase();
    const receiptTotalCents = this.centsFromAmount(input.receiptTotal);

    const taxesSorted = [...input.taxes].sort((a, b) => {
      if (a.taxID !== b.taxID) return a.taxID - b.taxID;
      const ac = a.taxCode ?? '';
      const bc = b.taxCode ?? '';
      return ac.localeCompare(bc);
    });

    const taxesConcat = taxesSorted
      .map((t) => {
        const taxCode = t.taxCode ?? '';
        const taxPercent = this.percentToFixed2String(t.taxPercent);
        const taxAmountCents = this.centsFromAmount(t.taxAmount);
        const salesAmountWithTaxCents = this.centsFromAmount(t.salesAmountWithTax);
        return `${taxCode}${taxPercent}${taxAmountCents}${salesAmountWithTaxCents}`;
      })
      .join('');

    const prev = input.previousReceiptHash?.trim() ? input.previousReceiptHash.trim() : '';
    // Spec: `previousReceiptHash` is omitted if it is the first in the day.
    return [
      input.deviceID,
      receiptTypeStr,
      currencyStr,
      input.receiptGlobalNo,
      input.receiptDateISO8601,
      receiptTotalCents,
      taxesConcat,
      prev ? prev : undefined,
    ]
      .filter((x) => x !== undefined)
      .join('');
  }

  async computeReceiptDeviceSignature(input: {
    deviceID: number;
    receiptType: ReceiptType;
    currency: string;
    receiptGlobalNo: number;
    receiptDateISO8601: string;
    receiptTotal: number;
    taxes: ReceiptTax[];
    previousReceiptHash?: string | null;
    privateKeyPem: string; // PKCS#8 PEM
  }): Promise<SignatureData> {
    const concat = this.buildReceiptDeviceSignatureConcatString(input);
    const bytes = this.encodeUtf8(concat);
    const hashB64 = await this.sha256Base64(bytes);
    const sigBytes = await this.sign(bytes, input.privateKeyPem);
    return { hash: hashB64, signature: this.toBase64(sigBytes) };
  }

  /**
   * Spec QR rule: `receiptQrData` = first 16 chars of MD5 hex of `receiptDeviceSignature`.
   * In our UI/API, `receiptDeviceSignature` corresponds to `receiptDeviceSignature.signature` (base64 string).
   */
  receiptQrDataFromDeviceSignature(signatureBase64: string): string {
    const hex = md5(signatureBase64).toString(); // hex
    return hex.slice(0, 16).toUpperCase();
  }

  /**
   * Build the QR payload (data inside the QR code) per spec.
   */
  buildReceiptQrPayload(input: {
    qrUrlBase: string;
    deviceID: number;
    receiptDateISO8601: string;
    receiptGlobalNo: number;
    receiptDeviceSignatureBase64: string; // receiptDeviceSignature.signature
  }): string {
    const receiptQrData = this.receiptQrDataFromDeviceSignature(input.receiptDeviceSignatureBase64);
    return `${input.qrUrlBase}/${this.pad10(input.deviceID)}/${this.isoToDdMmYyyy(input.receiptDateISO8601)}/${this.pad10(
      input.receiptGlobalNo
    )}/${receiptQrData}`;
  }

  /**
   * Build concatenation string for `fiscalDayDeviceSignature` (spec 13.1 / 13.3 preimage).
   */
  buildFiscalDayDeviceSignatureConcatString(input: {
    deviceID: number;
    fiscalDayNo: number;
    fiscalDayDateYYYYMMDD: string; // YYYY-MM-DD
    counters: FiscalDayCounter[];
  }): string {
    const countersSorted = [...input.counters].sort((a, b) => {
      if (a.fiscalCounterType !== b.fiscalCounterType) return a.fiscalCounterType - b.fiscalCounterType;
      const curA = a.fiscalCounterCurrency ?? '';
      const curB = b.fiscalCounterCurrency ?? '';
      const curCmp = curA.localeCompare(curB);
      if (curCmp !== 0) return curCmp;

      // Tax counters: sort by taxID; balance counters: sort by moneyType.
      const aKey = a.fiscalCounterTaxID != null ? a.fiscalCounterTaxID : a.fiscalCounterMoneyType ?? -1;
      const bKey = b.fiscalCounterTaxID != null ? b.fiscalCounterTaxID : b.fiscalCounterMoneyType ?? -1;
      return aKey - bKey;
    });

    const countersConcat = countersSorted
      .map((c) => {
        const typeStr = String(c.fiscalCounterType);
        const currencyStr = c.fiscalCounterCurrency ?? '';
        const percentOrMoneyType =
          c.fiscalCounterTaxID != null
            ? this.percentToFixed2String(c.fiscalCounterTaxPercent)
            : c.fiscalCounterMoneyType != null
              ? String(c.fiscalCounterMoneyType)
              : '';
        // Spec 13.3.2 preimage uses counters VALUE in cents.
        // In this app we treat `fiscalCounterValue` as already "cents" (integer), so do not multiply by 100 again.
        const valueCents = String(Math.round(c.fiscalCounterValue));
        return `${typeStr}${currencyStr}${percentOrMoneyType}${valueCents}`;
      })
      .join('');

    return [input.deviceID, input.fiscalDayNo, input.fiscalDayDateYYYYMMDD, countersConcat].join('');
  }

  async computeFiscalDayDeviceSignature(input: {
    deviceID: number;
    fiscalDayNo: number;
    fiscalDayDateYYYYMMDD: string; // YYYY-MM-DD
    counters: FiscalDayCounter[];
    privateKeyPem: string; // PKCS#8 PEM
  }): Promise<SignatureData> {
    const concat = this.buildFiscalDayDeviceSignatureConcatString(input);
    const bytes = this.encodeUtf8(concat);
    const hashB64 = await this.sha256Base64(bytes);
    const sigBytes = await this.sign(bytes, input.privateKeyPem);
    return { hash: hashB64, signature: this.toBase64(sigBytes) };
  }

  /**
   * Utility for components that need a local `YYYY-MM-DD`.
   * (Avoid UTC drift with `toISOString()`.)
   */
  localDateYmd(d: Date): string {
    return this.localDateToYmd(d);
  }
}

