import { Component, Input, OnChanges, inject, isDevMode, signal } from '@angular/core';
import * as x509 from '@peculiar/x509';
import { SignatureDataEx } from '../../../core/models/api.models';
import { CertificateService } from '../../../core/services/certificate.service';

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

@Component({
  selector: 'zimra-signature-verification',
  standalone: true,
  template: `
    <div class="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-zimra-charcoal/60">
      <div class="text-xs text-slate-500">Signature verification</div>
      <div class="mt-2 text-xs">
        @if (!signatureData) {
          <span class="text-slate-500">No signature data.</span>
        } @else if (result() === 'valid') {
          <span class="text-emerald-700">Valid signature</span>
        } @else if (result() === 'invalid') {
          <span class="text-red-700">Invalid signature</span>
        } @else {
          <span class="text-slate-600">Not verified</span>
        }
      </div>
      @if (details()) {
        <div class="mt-1 text-xs text-slate-600 dark:text-slate-300">{{ details() }}</div>
      }
      <div class="mt-3 flex justify-end">
        <button class="rounded border px-3 py-1.5 text-xs" (click)="verify()">Verify</button>
      </div>
      @if (devMode() && diagnostics().length) {
        <details class="mt-3 rounded border border-slate-200 bg-slate-50 p-2 text-xs">
          <summary class="cursor-pointer font-semibold text-slate-700">Dev diagnostics</summary>
          <div class="mt-2 space-y-1">
            @for (d of diagnostics(); track $index) {
              <div class="font-mono text-slate-600">{{ d }}</div>
            }
          </div>
        </details>
      }
    </div>
  `,
})
export class SignatureVerificationComponent implements OnChanges {
  private readonly certService = inject(CertificateService);

  @Input() signatureData?: SignatureDataEx | null;
  @Input() payloadText?: string;
  @Input() recomputedHash?: string;
  @Input() certificatePem?: string;

  readonly result = signal<'unknown' | 'valid' | 'invalid'>('unknown');
  readonly details = signal<string>('');
  readonly devMode = signal<boolean>(isDevMode());
  readonly diagnostics = signal<string[]>([]);

  ngOnChanges(): void {
    this.result.set('unknown');
    this.details.set('');
    this.diagnostics.set([]);
  }

  async verify(): Promise<void> {
    const sig = this.signatureData;
    if (!sig) {
      this.result.set('invalid');
      this.details.set('Missing signature data.');
      this.pushDiag('missing_signature_data');
      return;
    }

    const certPem = (this.certificatePem?.trim() || this.certService.getVerificationCertificatePem()).trim();
    if (!certPem) {
      this.result.set('invalid');
      this.details.set('No verification certificate selected.');
      this.pushDiag('missing_verification_cert');
      return;
    }

    try {
      const expectedHash = this.recomputedHash?.trim() || (await this.computePayloadHash());
      if (!expectedHash) {
        this.result.set('invalid');
        this.details.set('No recomputed hash/payload provided.');
        this.pushDiag('missing_recomputed_hash');
        return;
      }
      if (expectedHash !== sig.hash) {
        this.result.set('invalid');
        this.details.set('Hash mismatch between recomputed hash and SignatureDataEx.hash.');
        this.pushDiag(`hash_mismatch expected=${expectedHash} got=${sig.hash}`);
        return;
      }

      const cert = new (x509 as any).X509Certificate(certPem) as x509.X509Certificate;
      const spki = new Uint8Array((cert as any).publicKey.rawData as ArrayBuffer);
      this.pushDiag(`cert_subject=${(cert as any).subject || '-'}`);
      this.pushDiag(`cert_public_key_bytes=${spki.byteLength}`);
      const signatureBytes = b64ToBytes(sig.signature);
      const payloadBytes = new TextEncoder().encode(this.payloadText ?? '');
      const hashBytes = b64ToBytes(sig.hash);

      const ok = await this.tryVerify(spki, signatureBytes, payloadBytes, hashBytes);
      this.result.set(ok ? 'valid' : 'invalid');
      this.details.set(ok ? 'Signature and hash are valid.' : 'Crypto verification failed for tested algorithms.');
    } catch (e) {
      this.result.set('invalid');
      this.details.set(e instanceof Error ? e.message : String(e));
      this.pushDiag(`verify_exception=${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private async computePayloadHash(): Promise<string> {
    if (!this.payloadText) return '';
    const bytes = new TextEncoder().encode(this.payloadText);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return bytesToB64(new Uint8Array(digest));
  }

  private async tryVerify(spki: Uint8Array, signature: Uint8Array, payloadBytes: Uint8Array, hashBytes: Uint8Array): Promise<boolean> {
    const attempts: Array<{ importAlgo: RsaHashedImportParams | EcKeyImportParams; verifyAlgo: any; data: Uint8Array }> = [
      {
        importAlgo: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        verifyAlgo: { name: 'RSASSA-PKCS1-v1_5' },
        data: payloadBytes,
      },
      {
        importAlgo: { name: 'RSA-PSS', hash: 'SHA-256' },
        verifyAlgo: { name: 'RSA-PSS', saltLength: 32 },
        data: payloadBytes,
      },
      {
        importAlgo: { name: 'ECDSA', namedCurve: 'P-256' },
        verifyAlgo: { name: 'ECDSA', hash: 'SHA-256' },
        data: payloadBytes,
      },
      {
        importAlgo: { name: 'ECDSA', namedCurve: 'P-256' },
        verifyAlgo: { name: 'ECDSA', hash: 'SHA-256' },
        data: hashBytes,
      },
    ];

    const spkiBuffer = spki.buffer.slice(spki.byteOffset, spki.byteOffset + spki.byteLength) as ArrayBuffer;
    const signatureBuffer = signature.buffer.slice(signature.byteOffset, signature.byteOffset + signature.byteLength) as ArrayBuffer;
    for (let i = 0; i < attempts.length; i++) {
      const a = attempts[i];
      const label = `${i + 1}:${(a.importAlgo as any).name}/${(a.verifyAlgo as any).name}`;
      try {
        const key = await crypto.subtle.importKey('spki', spkiBuffer, a.importAlgo as any, false, ['verify']);
        const dataBuffer = a.data.buffer.slice(a.data.byteOffset, a.data.byteOffset + a.data.byteLength) as ArrayBuffer;
        const ok = await crypto.subtle.verify(a.verifyAlgo as any, key, signatureBuffer, dataBuffer);
        this.pushDiag(`${label}:ok=${ok}`);
        if (ok) return true;
      } catch (e) {
        this.pushDiag(`${label}:error=${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return false;
  }

  private pushDiag(msg: string): void {
    if (!this.devMode()) return;
    this.diagnostics.update((d) => [...d, msg]);
  }
}

