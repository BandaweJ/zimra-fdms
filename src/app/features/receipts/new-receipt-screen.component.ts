import { Component, computed, inject, isDevMode, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CdkDrag, CdkDropList, CdkDragHandle, moveItemInArray } from '@angular/cdk/drag-drop';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { CryptoService } from '../../core/services/crypto.service';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { FiscalDayService } from '../../core/services/fiscal-day.service';
import {
  GetConfigResponse,
  MoneyType,
  Receipt,
  ReceiptLineType,
  ReceiptType,
  SignatureData,
} from '../../core/models/api.models';
import { ReceiptService } from '../../core/services/receipt.service';
import { StorageService } from '../../core/services/storage.service';
import { ReceiptHistoryService } from '../../core/services/receipt-history.service';
import { OfflineQueueService } from '../../core/services/offline-queue.service';
import {
  extractRcptValidationCodes,
  resolveValidationColorFromCodes,
} from '../../core/validation/receipt-validation-catalog';

type DraftLine = {
  receiptLineType: ReceiptLineType;
  receiptLineName: string;
  receiptLineHSCode: string;
  receiptLinePrice: number;
  receiptLineQuantity: number;
  taxID: number;
  taxPercent: number;
};

type DraftPayment = {
  moneyTypeCode: MoneyType;
  paymentAmount: number;
};

type RefLookupMode = 'receiptID' | 'tuple';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function localDateTimeValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

@Component({
  selector: 'zimra-new-receipt-screen',
  standalone: true,
  imports: [CardComponent, ButtonComponent, CdkDropList, CdkDrag, CdkDragHandle],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-6xl px-4 py-10">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">New Receipt Wizard</h1>
        <div class="mt-3 text-xs text-slate-500">Step {{ step() }} / 6</div>
        <div class="mt-2 h-2 rounded bg-slate-200"><div class="h-full rounded bg-zimra-gold" [style.width.%]="(step()/6)*100"></div></div>

        <zimra-card class="mt-5">
          @if (step() === 1) {
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="text-xs font-semibold">Receipt Type</label>
                <select class="mt-1 w-full rounded border p-2" [value]="receiptType()" (change)="receiptType.set(+$any($event.target).value)">
                  <option [value]="ReceiptType.FiscalInvoice">FiscalInvoice</option>
                  <option [value]="ReceiptType.CreditNote">CreditNote</option>
                  <option [value]="ReceiptType.DebitNote">DebitNote</option>
                </select>
              </div>
              <div>
                <label class="text-xs font-semibold">Currency</label>
                <select class="mt-1 w-full rounded border p-2" [value]="currency()" (change)="currency.set($any($event.target).value)">
                  <option value="ZWL">ZWL</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label class="text-xs font-semibold">Invoice No</label>
                <input class="mt-1 w-full rounded border p-2" maxlength="50" [value]="invoiceNo()" (input)="invoiceNo.set($any($event.target).value)" />
              </div>
              <div>
                <label class="text-xs font-semibold">Receipt Date/Time (local)</label>
                <input class="mt-1 w-full rounded border p-2" type="datetime-local" [value]="receiptDate()" (input)="receiptDate.set($any($event.target).value)" />
              </div>
              <div>
                <label class="text-xs font-semibold">Tax mode</label>
                <select class="mt-1 w-full rounded border p-2" [value]="isTaxInclusive() ? 'inclusive' : 'exclusive'" (change)="isTaxInclusive.set($any($event.target).value === 'inclusive')">
                  <option value="inclusive">Tax Inclusive</option>
                  <option value="exclusive">Tax Exclusive</option>
                </select>
              </div>
              @if (receiptType() !== ReceiptType.FiscalInvoice) {
                <div>
                  <label class="text-xs font-semibold">Notes (required for credit/debit)</label>
                  <input class="mt-1 w-full rounded border p-2" [value]="notes()" (input)="notes.set($any($event.target).value)" />
                </div>
              }
            </div>
            @if (receiptType() !== ReceiptType.FiscalInvoice) {
              <div class="mt-4 rounded border border-slate-200 p-3">
                <div class="text-xs font-semibold">Credited/Debited invoice lookup</div>
                <div class="mt-2 grid gap-2 md:grid-cols-2">
                  <select class="rounded border p-2" [value]="lookupMode()" (change)="lookupMode.set($any($event.target).value)">
                    <option value="receiptID">Search by receiptID</option>
                    <option value="tuple">Search by deviceID + receiptGlobalNo + fiscalDayNo</option>
                  </select>
                  @if (lookupMode() === 'receiptID') {
                    <input class="rounded border p-2" type="number" placeholder="receiptID" [value]="lookupReceiptID()" (input)="lookupReceiptID.set(+$any($event.target).value)" />
                  } @else {
                    <div class="grid gap-2 md:grid-cols-3">
                      <input class="rounded border p-2" type="number" placeholder="deviceID" [value]="lookupDeviceID()" (input)="lookupDeviceID.set(+$any($event.target).value)" />
                      <input class="rounded border p-2" type="number" placeholder="receiptGlobalNo" [value]="lookupReceiptGlobalNo()" (input)="lookupReceiptGlobalNo.set(+$any($event.target).value)" />
                      <input class="rounded border p-2" type="number" placeholder="fiscalDayNo" [value]="lookupFiscalDayNo()" (input)="lookupFiscalDayNo.set(+$any($event.target).value)" />
                    </div>
                  }
                </div>
                <div class="mt-2">
                  <zimra-button variant="secondary" (click)="lookupReference()">Lookup</zimra-button>
                </div>
                @if (referencedReceipt()) {
                  <div class="mt-2 text-xs rounded border border-emerald-200 bg-emerald-50 p-2">
                    Found: invoice {{ referencedReceipt()!.receipt.invoiceNo }}, total {{ referencedReceipt()!.receipt.receiptTotal }}, global {{ referencedReceipt()!.receipt.receiptGlobalNo }}
                  </div>
                } @else if (lookupTried()) {
                  <div class="mt-2 text-xs text-red-600">No referenced invoice found.</div>
                }
              </div>
            }
          }

          @if (step() === 2) {
            <div>
              <label class="inline-flex items-center gap-2"><input type="checkbox" [checked]="withBuyer()" (change)="withBuyer.set($any($event.target).checked)" /> Add buyer details</label>
              @if (withBuyer()) {
                <div class="mt-3 grid gap-3 md:grid-cols-2">
                  <input class="rounded border p-2" placeholder="buyerRegisterName" [value]="buyerName()" (input)="buyerName.set($any($event.target).value)" />
                  <input class="rounded border p-2" placeholder="buyerTIN" [value]="buyerTIN()" (input)="buyerTIN.set($any($event.target).value)" />
                  <input class="rounded border p-2" placeholder="buyerTradeName" [value]="buyerTradeName()" (input)="buyerTradeName.set($any($event.target).value)" />
                  <input class="rounded border p-2" placeholder="VATNumber" [value]="buyerVAT()" (input)="buyerVAT.set($any($event.target).value)" />
                  <input class="rounded border p-2" placeholder="Address province" [value]="buyerProvince()" (input)="buyerProvince.set($any($event.target).value)" />
                  <input class="rounded border p-2" placeholder="Address city" [value]="buyerCity()" (input)="buyerCity.set($any($event.target).value)" />
                  <input class="rounded border p-2" placeholder="Address street" [value]="buyerStreet()" (input)="buyerStreet.set($any($event.target).value)" />
                  <input class="rounded border p-2" placeholder="Address houseNo" [value]="buyerHouseNo()" (input)="buyerHouseNo.set($any($event.target).value)" />
                  <input class="rounded border p-2" placeholder="Contact phoneNo" [value]="buyerPhone()" (input)="buyerPhone.set($any($event.target).value)" />
                  <input class="rounded border p-2" placeholder="Contact email" [value]="buyerEmail()" (input)="buyerEmail.set($any($event.target).value)" />
                </div>
                @if (withBuyer() && ((!buyerName() && buyerTIN()) || (buyerName() && !buyerTIN()))) {
                  <div class="mt-2 text-xs text-red-600">RCPT043: buyerRegisterName and buyerTIN must be provided together.</div>
                }
              }
            </div>
          }

          @if (step() === 3) {
            <div class="space-y-2">
              <zimra-button variant="secondary" (click)="addLine()">Add line</zimra-button>
              <div cdkDropList (cdkDropListDropped)="dropLine($event)" class="space-y-2">
                @for (line of lines(); track $index; let i = $index) {
                  <div cdkDrag class="rounded border p-2">
                    <div class="mb-2 text-xs text-slate-500 flex items-center gap-2">
                      <span cdkDragHandle class="cursor-move rounded border px-2 py-0.5">Drag</span>
                      <span>Line {{ i + 1 }}</span>
                    </div>
                    <div class="grid gap-2 md:grid-cols-7">
                      <select class="rounded border p-1" [value]="line.receiptLineType" (change)="setLine(i, 'receiptLineType', +$any($event.target).value)">
                        <option [value]="ReceiptLineType.Sale">Sale</option>
                        <option [value]="ReceiptLineType.Discount">Discount</option>
                      </select>
                      <input class="rounded border p-1" placeholder="HS code" [value]="line.receiptLineHSCode" (input)="setLine(i, 'receiptLineHSCode', $any($event.target).value)" />
                      <input class="rounded border p-1" placeholder="Name" [value]="line.receiptLineName" (input)="setLine(i, 'receiptLineName', $any($event.target).value)" />
                      <input class="rounded border p-1" type="number" placeholder="Price" [value]="line.receiptLinePrice" (input)="setLine(i, 'receiptLinePrice', +$any($event.target).value)" />
                      <input class="rounded border p-1" type="number" placeholder="Qty" [value]="line.receiptLineQuantity" (input)="setLine(i, 'receiptLineQuantity', +$any($event.target).value)" />
                      <input class="rounded border p-1" type="number" placeholder="Tax ID" [value]="line.taxID" (input)="setLine(i, 'taxID', +$any($event.target).value)" />
                      <input class="rounded border p-1" type="number" placeholder="Tax %" [value]="line.taxPercent" (input)="setLine(i, 'taxPercent', +$any($event.target).value)" />
                    </div>
                  </div>
                }
              </div>
              <div class="text-xs text-slate-500">Subtotal: {{ subtotal() }}</div>
              <div class="text-xs text-slate-500">
                HS code rule: 4 or 8 digits; for VAT-exempt lines (tax percent empty/0 on VAT taxpayer), 8 digits required.
              </div>
            </div>
          }

          @if (step() === 4) {
            <div class="space-y-2 text-sm">
              <div>Auto-calculated taxes</div>
              @for (t of taxes(); track t.taxID + '-' + t.taxPercent) {
                <div class="rounded border p-2">
                  <div class="text-xs mb-2">Tax {{ t.taxID }} ({{ t.taxPercent }}%)</div>
                  <div class="grid gap-2 md:grid-cols-3">
                    <div class="font-mono text-xs">autoTax={{ t.taxAmount }}</div>
                    <input class="rounded border p-1 text-xs" type="number" [value]="taxOverrideAmount(t.taxID, t.taxPercent) ?? t.taxAmount" (input)="setTaxOverride(t.taxID, t.taxPercent, +$any($event.target).value, taxOverrideSales(t.taxID, t.taxPercent) ?? t.salesAmountWithTax)" />
                    <input class="rounded border p-1 text-xs" type="number" [value]="taxOverrideSales(t.taxID, t.taxPercent) ?? t.salesAmountWithTax" (input)="setTaxOverride(t.taxID, t.taxPercent, taxOverrideAmount(t.taxID, t.taxPercent) ?? t.taxAmount, +$any($event.target).value)" />
                  </div>
                </div>
              }
              <div class="text-xs text-slate-500">Manual override allowed; values revalidated during submit.</div>
            </div>
          }

          @if (step() === 5) {
            <div class="space-y-2">
              <zimra-button variant="secondary" (click)="addPayment()">Add payment</zimra-button>
              @for (p of payments(); track $index; let i = $index) {
                <div class="grid gap-2 md:grid-cols-2">
                  <select class="rounded border p-2" [value]="p.moneyTypeCode" (change)="setPayment(i, 'moneyTypeCode', +$any($event.target).value)">
                    <option [value]="MoneyType.Cash">Cash</option>
                    <option [value]="MoneyType.Card">Card</option>
                    <option [value]="MoneyType.MobileWallet">MobileWallet</option>
                  </select>
                  <input class="rounded border p-2" type="number" [value]="p.paymentAmount" (input)="setPayment(i, 'paymentAmount', +$any($event.target).value)" />
                </div>
              }
              <div class="text-xs">Payments total: {{ paymentTotal() }} vs receipt total: {{ receiptTotal() }}</div>
              @if (paymentTotal() !== receiptTotal()) {
                <div class="text-xs text-red-600">RCPT039: sum of payments must equal receiptTotal.</div>
              }
            </div>
          }

          @if (step() === 6) {
            <div class="space-y-3">
              <div class="text-sm">Review and sign</div>
              <textarea class="w-full rounded border p-2 font-mono text-xs" rows="5" [value]="signConcatPreview()" readonly></textarea>
              <div class="grid gap-2 md:grid-cols-2">
                <div>
                  <div class="text-xs font-semibold">Private key PEM (manual upload)</div>
                  <textarea class="mt-1 w-full rounded border p-2 font-mono text-xs" rows="6" [value]="privateKeyPem()" (input)="privateKeyPem.set($any($event.target).value)"></textarea>
                </div>
                <div>
                  <div class="text-xs">Hash</div>
                  <pre class="rounded border p-2 text-xs">{{ generatedHash() || '-' }}</pre>
                  <div class="text-xs mt-2">Signature</div>
                  <pre class="rounded border p-2 text-xs">{{ generatedSignature() || '-' }}</pre>
                </div>
              </div>
              <div class="flex gap-2">
                <zimra-button variant="secondary" (click)="generateDeviceSignature()">Generate Signature</zimra-button>
                <zimra-button variant="primary" [disabled]="!canSubmit()" (click)="submit()">Submit Receipt</zimra-button>
              </div>
              @if (devMode() && validationDebugInfo()) {
                <div class="rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
                  Debug: {{ validationDebugInfo() }}
                </div>
              }
              @if (error()) { <div class="text-xs text-red-600">{{ error() }}</div> }
            </div>
          }
        </zimra-card>

        <div class="mt-4 flex justify-between">
          <zimra-button variant="secondary" [disabled]="step()===1" (click)="step.set(step()-1)">Back</zimra-button>
          <zimra-button variant="primary" [disabled]="step()===6" (click)="step.set(step()+1)">Next</zimra-button>
        </div>
      </div>
    </div>
  `,
})
export class NewReceiptScreenComponent implements OnInit {
  readonly router = inject(Router);
  private readonly receiptService = inject(ReceiptService);
  private readonly fdmsContext = inject(FdmsContextService);
  private readonly storage = inject(StorageService);
  private readonly fiscalDayService = inject(FiscalDayService);
  private readonly crypto = inject(CryptoService);
  private readonly history = inject(ReceiptHistoryService);
  private readonly offlineQueue = inject(OfflineQueueService);

  readonly ReceiptType = ReceiptType;
  readonly ReceiptLineType = ReceiptLineType;
  readonly MoneyType = MoneyType;

  readonly step = signal<number>(1);
  readonly error = signal<string | null>(null);
  readonly config = signal<GetConfigResponse | null>(null);
  readonly fiscalDayStatus = signal<number | null>(null);
  readonly lastKnownGlobalNo = signal<number>(0);
  readonly fiscalDayNo = signal<number>(1);
  readonly receiptGlobalNo = signal<number>(1);
  readonly receiptCounter = signal<number>(1);

  readonly receiptType = signal<ReceiptType>(ReceiptType.FiscalInvoice);
  readonly currency = signal<string>('USD');
  readonly invoiceNo = signal<string>('');
  readonly receiptDate = signal<string>(localDateTimeValue(new Date()));
  readonly isTaxInclusive = signal<boolean>(true);
  readonly notes = signal<string>('');
  readonly lookupMode = signal<RefLookupMode>('receiptID');
  readonly lookupReceiptID = signal<number>(0);
  readonly lookupDeviceID = signal<number>(0);
  readonly lookupReceiptGlobalNo = signal<number>(0);
  readonly lookupFiscalDayNo = signal<number>(0);
  readonly lookupTried = signal<boolean>(false);
  readonly referencedReceipt = signal<ReturnType<ReceiptHistoryService['findByLocalID']>>(null);

  readonly withBuyer = signal<boolean>(false);
  readonly buyerName = signal<string>('');
  readonly buyerTIN = signal<string>('');
  readonly buyerTradeName = signal<string>('');
  readonly buyerVAT = signal<string>('');
  readonly buyerProvince = signal<string>('');
  readonly buyerCity = signal<string>('');
  readonly buyerStreet = signal<string>('');
  readonly buyerHouseNo = signal<string>('');
  readonly buyerPhone = signal<string>('');
  readonly buyerEmail = signal<string>('');

  readonly lines = signal<DraftLine[]>([]);
  readonly payments = signal<DraftPayment[]>([]);
  readonly taxOverrides = signal<Record<string, { taxAmount: number; salesAmountWithTax: number }>>({});

  readonly generatedHash = signal<string>('');
  readonly generatedSignature = signal<string>('');
  readonly validationDebugInfo = signal<string | null>(null);
  readonly devMode = signal<boolean>(isDevMode());

  readonly privateKeyPem = signal<string>('');

  readonly subtotal = computed(() => this.lines().reduce((s, l) => s + l.receiptLinePrice * l.receiptLineQuantity, 0));
  readonly taxes = computed(() => {
    const groups = new Map<string, { taxID: number; taxPercent: number; base: number }>();
    for (const l of this.lines()) {
      const k = `${l.taxID}|${l.taxPercent}`;
      const g = groups.get(k) ?? { taxID: l.taxID, taxPercent: l.taxPercent, base: 0 };
      g.base += l.receiptLinePrice * l.receiptLineQuantity;
      groups.set(k, g);
    }
    return [...groups.values()].map((g) => {
      const taxAmount = this.isTaxInclusive() ? g.base * (g.taxPercent / 100) / (1 + g.taxPercent / 100) : g.base * (g.taxPercent / 100);
      const salesAmountWithTax = this.isTaxInclusive() ? g.base : g.base * (1 + g.taxPercent / 100);
      return { taxID: g.taxID, taxPercent: g.taxPercent, taxAmount: +taxAmount.toFixed(2), salesAmountWithTax: +salesAmountWithTax.toFixed(2) };
    });
  });
  readonly effectiveTaxes = computed(() =>
    this.taxes().map((t) => {
      const key = `${t.taxID}|${t.taxPercent}`;
      const override = this.taxOverrides()[key];
      return override ? { ...t, taxAmount: override.taxAmount, salesAmountWithTax: override.salesAmountWithTax } : t;
    })
  );
  readonly receiptTotal = computed(() => +this.effectiveTaxes().reduce((s, t) => s + t.salesAmountWithTax, 0).toFixed(2));
  readonly paymentTotal = computed(() => +this.payments().reduce((s, p) => s + p.paymentAmount, 0).toFixed(2));

  readonly signConcatPreview = computed(() => {
    const prev = this.history.getPreviousReceiptHash(
      this.fiscalDayNo(),
      this.receiptGlobalNo(),
      this.fdmsContext.getDeviceID() ?? undefined
    );
    return this.crypto.buildReceiptDeviceSignatureConcatString({
      deviceID: this.fdmsContext.getDeviceID() ?? 0,
      receiptType: this.receiptType(),
      currency: this.currency(),
      receiptGlobalNo: this.receiptGlobalNo(),
      receiptDateISO8601: this.isoDateSecond(),
      receiptTotal: this.receiptTotal(),
      taxes: this.effectiveTaxes(),
      previousReceiptHash: prev,
    });
  });

  ngOnInit(): void {
    void this.bootstrap();
    this.addLine();
    this.addPayment();
  }

  async bootstrap(): Promise<void> {
    const deviceID = await this.resolveDeviceID();
    if (!deviceID) return;
    this.fiscalDayService.getStatus({ deviceID }).subscribe({
      next: (s) => {
        this.fiscalDayStatus.set(s.fiscalDayStatus ?? null);
        this.fiscalDayNo.set(s.lastFiscalDayNo ?? 1);
        const lastGlobal = s.lastReceiptGlobalNo ?? 0;
        this.lastKnownGlobalNo.set(lastGlobal);
        this.receiptGlobalNo.set(lastGlobal + 1);
        const dayCount = this.history.listByFiscalDay(s.lastFiscalDayNo ?? 1).length;
        this.receiptCounter.set(dayCount + 1);
      },
    });
    this.fiscalDayService.getConfig({ deviceID }).subscribe({ next: (c) => this.config.set(c) });
  }

  async resolveDeviceID(): Promise<number | null> {
    if (this.fdmsContext.getDeviceID() != null) return this.fdmsContext.getDeviceID();
    const cert = await this.storage.getAnyDeviceCertificate();
    return cert?.deviceID ?? null;
  }

  addLine(): void {
    this.lines.update((v) => [
      ...v,
      { receiptLineType: ReceiptLineType.Sale, receiptLineName: '', receiptLineHSCode: '', receiptLinePrice: 0, receiptLineQuantity: 1, taxID: 1, taxPercent: 15 },
    ]);
  }

  dropLine(event: { previousIndex: number; currentIndex: number }): void {
    this.lines.update((arr) => {
      const out = [...arr];
      moveItemInArray(out, event.previousIndex, event.currentIndex);
      return out;
    });
  }

  setLine(idx: number, key: keyof DraftLine, value: any): void {
    this.lines.update((arr) => arr.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));
  }

  addPayment(): void {
    this.payments.update((v) => [...v, { moneyTypeCode: MoneyType.Cash, paymentAmount: 0 }]);
  }

  setPayment(idx: number, key: keyof DraftPayment, value: any): void {
    this.payments.update((arr) => arr.map((p, i) => (i === idx ? { ...p, [key]: value } : p)));
  }

  taxOverrideAmount(taxID: number, taxPercent: number): number | null {
    return this.taxOverrides()[`${taxID}|${taxPercent}`]?.taxAmount ?? null;
  }

  taxOverrideSales(taxID: number, taxPercent: number): number | null {
    return this.taxOverrides()[`${taxID}|${taxPercent}`]?.salesAmountWithTax ?? null;
  }

  setTaxOverride(taxID: number, taxPercent: number, taxAmount: number, salesAmountWithTax: number): void {
    const key = `${taxID}|${taxPercent}`;
    this.taxOverrides.update((v) => ({ ...v, [key]: { taxAmount, salesAmountWithTax } }));
  }

  lookupReference(): void {
    this.lookupTried.set(true);
    if (this.lookupMode() === 'receiptID') {
      const found = this.history.findByReceiptID(this.lookupReceiptID());
      this.referencedReceipt.set(found);
      return;
    }
    const found = this.history.findByDeviceGlobalFiscal(this.lookupDeviceID(), this.lookupReceiptGlobalNo(), this.lookupFiscalDayNo());
    this.referencedReceipt.set(found);
  }

  private canUseReferenceForCreditDebit(): boolean {
    if (this.lookupMode() === 'receiptID') return this.lookupReceiptID() > 0 || !!this.referencedReceipt();
    return this.lookupDeviceID() > 0 && this.lookupReceiptGlobalNo() > 0 && this.lookupFiscalDayNo() > 0;
  }

  isoDateSecond(): string {
    return `${this.receiptDate()}:00`;
  }

  async generateDeviceSignature(): Promise<void> {
    try {
      const deviceID = await this.resolveDeviceID();
      if (!deviceID) throw new Error('Device ID is missing. Complete setup first.');

      const prev = this.history.getPreviousReceiptHash(
        this.fiscalDayNo(),
        this.receiptGlobalNo(),
        deviceID
      );
      const sigData = await this.crypto.computeReceiptDeviceSignature({
        deviceID,
        receiptType: this.receiptType(),
        currency: this.currency(),
        receiptGlobalNo: this.receiptGlobalNo(),
        receiptDateISO8601: this.isoDateSecond(),
        receiptTotal: this.receiptTotal(),
        taxes: this.effectiveTaxes(),
        previousReceiptHash: prev,
        privateKeyPem: this.privateKeyPem(),
      });

      this.generatedHash.set(sigData.hash);
      this.generatedSignature.set(sigData.signature);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  canSubmit(): boolean {
    // Rule 11: fiscal day must be opened before receipts are submitted.
    if (this.fiscalDayStatus() !== 1) return false;

    // Rule 13: must submit in ascending globalNo order without gaps.
    const expectedNext = this.lastKnownGlobalNo() + 1;
    if (this.receiptGlobalNo() !== expectedNext) return false;

    // Rule 7: only allow reset to 1 as first receipt of a new day.
    if (this.receiptGlobalNo() === 1 && this.receiptCounter() !== 1) return false;

    if (!this.generatedHash() || !this.generatedSignature()) return false;
    if (!this.invoiceNo().trim()) return false;
    if (this.paymentTotal() !== this.receiptTotal()) return false;
    if (this.receiptType() !== ReceiptType.FiscalInvoice && !this.notes().trim()) return false;
    if (this.receiptType() !== ReceiptType.FiscalInvoice && !this.canUseReferenceForCreditDebit()) return false;
    if (this.lines().some((l) => !/^\d{4}(\d{4})?$/.test(l.receiptLineHSCode || ''))) return false;
    if (this.lines().some((l) => l.receiptLineType === ReceiptLineType.Discount && l.receiptLinePrice >= 0)) return false;
    if (this.receiptType() === ReceiptType.CreditNote && this.lines().some((l) => l.receiptLinePrice > 0)) return false;
    if (this.receiptType() === ReceiptType.CreditNote && this.payments().some((p) => p.paymentAmount > 0)) return false;

    // Rule 9: VAT-taxed lines require taxpayer to be VAT payer.
    const taxpayerVatNo = this.config()?.vatNumber;
    if (!taxpayerVatNo && this.lines().some((l) => (l.taxPercent ?? 0) > 0)) return false;

    return true;
  }

  submit(): void {
    void this.submitAsync();
  }

  private async submitAsync(): Promise<void> {
    const deviceID = await this.resolveDeviceID();
    if (!deviceID) return;
    if (!this.canSubmit()) return;

    if (this.fiscalDayStatus() !== 1) {
      this.error.set('Fiscal day must be opened before submitting receipts.');
      return;
    }
    const expectedNext = this.lastKnownGlobalNo() + 1;
    if (this.receiptGlobalNo() !== expectedNext) {
      this.error.set(`Receipt global number must be sequential with no gaps (expected ${expectedNext}).`);
      return;
    }
    if (this.receiptGlobalNo() === 1 && this.receiptCounter() !== 1) {
      this.error.set('Reset to receiptGlobalNo=1 is only allowed as the first receipt of a new fiscal day.');
      return;
    }
    if (!this.config()?.vatNumber && this.lines().some((l) => (l.taxPercent ?? 0) > 0)) {
      this.error.set('VAT-taxed goods are not allowed because taxpayer has no VAT number in current config.');
      return;
    }

    const cdn = this.referencedReceipt();
    const receipt: Receipt = {
      receiptType: this.receiptType(),
      receiptCurrency: this.currency(),
      receiptCounter: this.receiptCounter(),
      receiptGlobalNo: this.receiptGlobalNo(),
      invoiceNo: this.invoiceNo().trim(),
      receiptNotes: this.notes().trim() || undefined,
      receiptDate: this.isoDateSecond(),
      receiptLinesTaxInclusive: this.isTaxInclusive(),
      receiptLines: this.lines().map((l, i) => ({
        receiptLineType: l.receiptLineType,
        receiptLineNo: i + 1,
        receiptLineHSCode: l.receiptLineHSCode || undefined,
        receiptLineName: l.receiptLineType === ReceiptLineType.Discount ? `Discount: ${l.receiptLineName}` : l.receiptLineName,
        receiptLinePrice: l.receiptLinePrice,
        receiptLineQuantity: l.receiptLineQuantity,
        receiptLineTotal: +(l.receiptLinePrice * l.receiptLineQuantity).toFixed(2),
        taxID: l.taxID,
        taxPercent: l.taxPercent,
      })),
      receiptTaxes: this.effectiveTaxes().map((t) => ({
        taxID: t.taxID,
        taxPercent: t.taxPercent,
        taxAmount: t.taxAmount,
        salesAmountWithTax: t.salesAmountWithTax,
      })),
      receiptPayments: this.payments(),
      receiptTotal: this.receiptTotal(),
      receiptDeviceSignature: { hash: this.generatedHash(), signature: this.generatedSignature() } as SignatureData,
    };

    if (this.withBuyer() && this.buyerName().trim() && this.buyerTIN().trim()) {
      const hasAddress = this.buyerProvince().trim() || this.buyerCity().trim() || this.buyerStreet().trim() || this.buyerHouseNo().trim();
      const hasContacts = this.buyerPhone().trim() || this.buyerEmail().trim();
      receipt.buyerData = {
        buyerRegisterName: this.buyerName().trim(),
        buyerTIN: this.buyerTIN().trim(),
        buyerTradeName: this.buyerTradeName().trim() || undefined,
        VATNumber: this.buyerVAT().trim() || undefined,
        ...(hasAddress
          ? {
              buyerAddress: {
                province: this.buyerProvince().trim() || '-',
                city: this.buyerCity().trim() || '-',
                street: this.buyerStreet().trim() || '-',
                houseNo: this.buyerHouseNo().trim() || '-',
              },
            }
          : {}),
        ...(hasContacts
          ? {
              buyerContacts: {
                phoneNo: this.buyerPhone().trim() || undefined,
                email: this.buyerEmail().trim() || undefined,
              },
            }
          : {}),
      };
    }
    if (this.receiptType() === ReceiptType.CreditNote || this.receiptType() === ReceiptType.DebitNote) {
      if (this.lookupMode() === 'receiptID') {
        receipt.creditDebitNote = { receiptID: cdn?.response.receiptID ?? this.lookupReceiptID() };
      } else {
        receipt.creditDebitNote = {
          deviceID: this.lookupDeviceID(),
          receiptGlobalNo: this.lookupReceiptGlobalNo(),
          fiscalDayNo: this.lookupFiscalDayNo(),
        };
      }
    }

    this.receiptService.submitReceipt({ deviceID, receipt }).subscribe({
      next: (res) => {
        const validation = this.deriveValidationInfo(res);
        const stored = this.history.save({
          deviceID,
          fiscalDayNo: this.fiscalDayNo(),
          qrUrl: this.config()?.qrUrl,
          receipt,
          response: res,
          validationLevel: validation.level,
          validationCodes: validation.codes,
        });
        void this.offlineQueue.enqueueReceipt({
          deviceID,
          fiscalDayNo: this.fiscalDayNo(),
          receipt,
        });
        this.validationDebugInfo.set(
          `resolvedLevel=${validation.level}; sourceField=${validation.source}; rawValue=${validation.rawValue || '-'}`
        );
        this.router.navigate(['/receipts/print', stored.localID]);
      },
      error: (e) => this.error.set(e instanceof Error ? e.message : String(e)),
    });
  }

  private deriveValidationInfo(response: unknown): {
    level: 'white' | 'grey' | 'yellow' | 'red';
    source: 'validationColor' | 'receiptValidationColor' | 'receiptColor' | 'default';
    rawValue: string;
    codes: string[];
  } {
    const anyRes = response as Record<string, unknown>;
    const codes = extractRcptValidationCodes(response);
    const fieldOrder: Array<'validationColor' | 'receiptValidationColor' | 'receiptColor'> = [
      'validationColor',
      'receiptValidationColor',
      'receiptColor',
    ];
    const source = fieldOrder.find((f) => anyRes[f] != null) ?? 'default';
    const raw =
      source === 'default'
        ? ''
        : String(anyRes[source] ?? '')
            .toLowerCase()
            .trim();
    const fromColorField =
      raw === 'grey' || raw === 'gray' ? 'grey' : raw === 'yellow' ? 'yellow' : raw === 'red' ? 'red' : 'white';
    const fromCodes = resolveValidationColorFromCodes(codes);
    const level = fromCodes !== 'white' ? fromCodes : fromColorField;
    return { level, source, rawValue: raw, codes };
  }
}

