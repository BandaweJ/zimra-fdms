import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CardComponent } from '../../shared/components/ui/card.component';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { ReceiptHistoryService } from '../../core/services/receipt-history.service';
import { ReceiptPrintForm } from '../../core/models/api.models';
import { CryptoService } from '../../core/services/crypto.service';
import QRCode from 'qrcode';
import { SignatureVerificationComponent } from '../../shared/components/signature-verification/signature-verification.component';

function fix48(v: string): string {
  if (v.length === 48) return v;
  if (v.length > 48) return v.slice(0, 48);
  return v.padEnd(48, ' ');
}

@Component({
  selector: 'zimra-receipt-print-view',
  standalone: true,
  imports: [CommonModule, CardComponent, ButtonComponent, SignatureVerificationComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface px-4 py-10 print:bg-white">
      <div class="mx-auto w-full max-w-4xl">
        <div class="mb-4 flex items-center justify-between print:hidden">
          <div class="flex gap-2">
            <zimra-button variant="secondary" (click)="form.set(ReceiptPrintForm.Receipt48)">Receipt48</zimra-button>
            <zimra-button variant="secondary" (click)="form.set(ReceiptPrintForm.InvoiceA4)">InvoiceA4</zimra-button>
          </div>
          <zimra-button variant="primary" (click)="print()">Print</zimra-button>
        </div>

        <zimra-card>
          @if (entry()) {
            @if (form() === ReceiptPrintForm.Receipt48) {
              <pre class="font-mono text-xs whitespace-pre-wrap">
{{ receipt48Text() }}
              </pre>
            } @else {
              <div class="text-sm">
                <h2 class="text-xl font-semibold">Invoice A4</h2>
                <div class="mt-2 grid grid-cols-2 gap-2">
                  <div>Invoice No: <span class="font-mono">{{ entry()!.receipt.invoiceNo }}</span></div>
                  <div>Date: <span class="font-mono">{{ entry()!.receipt.receiptDate }}</span></div>
                  <div>Type: {{ entry()!.receipt.receiptType }}</div>
                  <div>Currency: {{ entry()!.receipt.receiptCurrency }}</div>
                  <div>Receipt Counter: <span class="font-mono">{{ entry()!.receipt.receiptCounter }}</span></div>
                  <div>Receipt Global No: <span class="font-mono">{{ entry()!.receipt.receiptGlobalNo }}</span></div>
                </div>
                @if (entry()!.receipt.buyerData) {
                  <div class="mt-3 rounded border border-slate-200 p-2">
                    <div class="text-xs font-semibold">Buyer</div>
                    <div>{{ entry()!.receipt.buyerData!.buyerRegisterName }}</div>
                    <div>TIN: {{ entry()!.receipt.buyerData!.buyerTIN }}</div>
                    @if (entry()!.receipt.buyerData!.buyerTradeName) { <div>Trade: {{ entry()!.receipt.buyerData!.buyerTradeName }}</div> }
                  </div>
                }
                <div class="mt-3 overflow-x-auto">
                  <table class="w-full text-left text-sm border border-slate-200">
                    <thead>
                      <tr>
                        <th class="p-2">Line</th>
                        <th class="p-2">Name</th>
                        <th class="p-2">Qty</th>
                        <th class="p-2">Price</th>
                        <th class="p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (line of entry()!.receipt.receiptLines; track line.receiptLineNo) {
                        <tr class="border-t border-slate-200">
                          <td class="p-2">{{ line.receiptLineNo }}</td>
                          <td class="p-2">{{ line.receiptLineName }}</td>
                          <td class="p-2">{{ line.receiptLineQuantity }}</td>
                          <td class="p-2">{{ line.receiptLinePrice }}</td>
                          <td class="p-2">{{ line.receiptLineTotal }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-3">
                  <div class="rounded border border-slate-200 p-2">
                    <div class="text-xs font-semibold">Taxes</div>
                    @for (t of entry()!.receipt.receiptTaxes; track t.taxID + '-' + t.taxPercent) {
                      <div class="text-xs font-mono">Tax {{ t.taxID }} {{ t.taxPercent }}% => {{ t.taxAmount }} / {{ t.salesAmountWithTax }}</div>
                    }
                  </div>
                  <div class="rounded border border-slate-200 p-2">
                    <div class="text-xs font-semibold">Payments</div>
                    @for (p of entry()!.receipt.receiptPayments; track $index) {
                      <div class="text-xs font-mono">{{ p.moneyTypeCode }} => {{ p.paymentAmount }}</div>
                    }
                  </div>
                </div>
                @if (entry()!.receipt.receiptNotes) {
                  <div class="mt-3 rounded border border-slate-200 p-2 text-xs">
                    <span class="font-semibold">Notes:</span> {{ entry()!.receipt.receiptNotes }}
                  </div>
                }
                <div class="mt-3 text-right font-semibold">TOTAL: {{ entry()!.receipt.receiptTotal }}</div>
              </div>
            }

            <div class="mt-4">
              <div class="text-xs text-slate-500">Verification code: {{ verificationCode() }}</div>
              @if (qrDataUrl()) {
                <img [src]="qrDataUrl()!" alt="QR" class="mt-2 h-36 w-36 border border-slate-200 p-1" />
              }
              <div class="mt-3">
                <zimra-signature-verification
                  [signatureData]="entry()!.response.receiptServerSignature"
                  [payloadText]="receiptServerSignaturePayload()"
                  [recomputedHash]="receiptServerSignatureHash()"
                />
              </div>
            </div>
          }
        </zimra-card>
      </div>
    </div>
  `,
})
export class ReceiptPrintViewComponent implements OnInit {
  readonly route = inject(ActivatedRoute);
  private readonly history = inject(ReceiptHistoryService);
  private readonly crypto = inject(CryptoService);

  readonly ReceiptPrintForm = ReceiptPrintForm;
  readonly form = signal<ReceiptPrintForm>(ReceiptPrintForm.Receipt48);
  readonly entry = signal<ReturnType<ReceiptHistoryService['findByLocalID']>>(null);
  readonly qrDataUrl = signal<string | null>(null);

  readonly verificationCode = computed(() => {
    const sig = this.entry()?.receipt.receiptDeviceSignature.signature ?? '';
    if (!sig.trim()) return '';
    const qrData = this.crypto.receiptQrDataFromDeviceSignature(sig);
    return `${qrData.slice(0, 4)}-${qrData.slice(4, 8)}-${qrData.slice(8, 12)}-${qrData.slice(12, 16)}`;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    const e = this.history.findByLocalID(id);
    this.entry.set(e);
    void this.buildQr();
  }

  async buildQr(): Promise<void> {
    const e = this.entry();
    if (!e) return;
    const sig = e.receipt.receiptDeviceSignature.signature ?? '';
    const qrUrlBase = e.qrUrl ?? 'https://invoice.zimra.co.zw';
    const payload = this.crypto.buildReceiptQrPayload({
      qrUrlBase,
      deviceID: e.deviceID,
      receiptDateISO8601: e.receipt.receiptDate,
      receiptGlobalNo: e.receipt.receiptGlobalNo,
      receiptDeviceSignatureBase64: sig,
    });
    this.qrDataUrl.set(await QRCode.toDataURL(payload));
  }

  receipt48Text(): string {
    const e = this.entry();
    if (!e) return '';
    const r = e.receipt;
    const lines = [
      fix48('ZIMRA RECEIPT48'),
      fix48(`Invoice: ${r.invoiceNo}`),
      fix48(`Date: ${r.receiptDate}`),
      fix48(`Type: ${r.receiptType}`),
      fix48(`Currency: ${r.receiptCurrency}`),
      ''.padEnd(48, '-'),
      ...r.receiptLines.map((l) => fix48(`${String(l.receiptLineNo).padStart(2, '0')} ${l.receiptLineName} ${l.receiptLineTotal}`)),
      ''.padEnd(48, '-'),
      ...r.receiptTaxes.map((t) => fix48(`TAX ${t.taxID} ${t.taxPercent ?? ''}% ${t.taxAmount}`)),
      ...r.receiptPayments.map((p) => fix48(`PAY ${p.moneyTypeCode} ${p.paymentAmount}`)),
      ''.padEnd(48, '-'),
      fix48(`TOTAL: ${r.receiptTotal}`),
      fix48(`VERIFY: ${this.verificationCode()}`),
    ];
    return lines.join('\n');
  }

  receiptServerSignaturePayload(): string {
    const e = this.entry();
    if (!e) return '';
    return `${e.receipt.receiptDeviceSignature.signature}${e.response.receiptID}${e.response.serverDate}`;
  }

  receiptServerSignatureHash(): string {
    return this.entry()?.response.receiptServerSignature?.hash ?? '';
  }

  print(): void {
    window.print();
  }
}

