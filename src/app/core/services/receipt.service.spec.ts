import { TestBed } from '@angular/core/testing';
import {
  FiscalCounterType,
  FiscalDayCounter,
  MoneyType,
  Receipt,
  ReceiptType,
} from '../models/api.models';
import { ApiService } from './api.service';
import { FdmsContextService } from './fdms-context.service';
import { ReceiptService } from './receipt.service';

function makeReceipt(input: {
  receiptType: ReceiptType;
  receiptTaxes?: Array<{ taxID: number; taxPercent?: number; taxAmount: number; salesAmountWithTax: number }>;
  receiptPayments?: Array<{ moneyTypeCode: MoneyType; paymentAmount: number }>;
  currency?: string;
}): Receipt {
  return {
    receiptType: input.receiptType,
    receiptCurrency: input.currency ?? 'ZWL',
    receiptCounter: 1,
    receiptGlobalNo: 1,
    invoiceNo: '1/1',
    receiptDate: '2026-03-23T10:00:00',
    receiptLinesTaxInclusive: true,
    receiptLines: [],
    receiptTaxes: input.receiptTaxes ?? [],
    receiptPayments: input.receiptPayments ?? [],
    receiptTotal: 0,
    receiptDeviceSignature: { hash: 'h', signature: 's' },
  };
}

function pickCounter(
  counters: FiscalDayCounter[],
  type: FiscalCounterType,
  extra: Partial<FiscalDayCounter>
): FiscalDayCounter | undefined {
  return counters.find(
    (c) =>
      c.fiscalCounterType === type &&
      c.fiscalCounterCurrency === (extra.fiscalCounterCurrency ?? c.fiscalCounterCurrency) &&
      c.fiscalCounterTaxID === (extra.fiscalCounterTaxID ?? c.fiscalCounterTaxID) &&
      c.fiscalCounterTaxPercent === (extra.fiscalCounterTaxPercent ?? c.fiscalCounterTaxPercent) &&
      c.fiscalCounterMoneyType === (extra.fiscalCounterMoneyType ?? c.fiscalCounterMoneyType)
  );
}

describe('ReceiptService.updateCounters', () => {
  let service: ReceiptService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ReceiptService,
        { provide: ApiService, useValue: { post: () => undefined } },
        { provide: FdmsContextService, useValue: { getRequiredHeaders: () => ({ deviceModelName: 'M', deviceModelVersion: '1' }) } },
      ],
    });
    service = TestBed.inject(ReceiptService);
  });

  it('updates FiscalInvoice counters by tax and by money type', () => {
    const receipt = makeReceipt({
      receiptType: ReceiptType.FiscalInvoice,
      receiptTaxes: [
        { taxID: 1, taxPercent: 15, taxAmount: 1.5, salesAmountWithTax: 10 },
        { taxID: 1, taxPercent: 15, taxAmount: 0.5, salesAmountWithTax: 2 },
      ],
      receiptPayments: [
        { moneyTypeCode: MoneyType.Cash, paymentAmount: 7 },
        { moneyTypeCode: MoneyType.Cash, paymentAmount: 5 },
      ],
    });
    const existing: FiscalDayCounter[] = [
      {
        fiscalCounterType: FiscalCounterType.SaleByTax,
        fiscalCounterCurrency: 'ZWL',
        fiscalCounterTaxID: 1,
        fiscalCounterTaxPercent: 15,
        fiscalCounterValue: 300,
      },
    ];

    const updated = service.updateCounters(receipt, existing);

    expect(
      pickCounter(updated, FiscalCounterType.SaleByTax, {
        fiscalCounterCurrency: 'ZWL',
        fiscalCounterTaxID: 1,
        fiscalCounterTaxPercent: 15,
      })?.fiscalCounterValue
    ).toBe(1500);
    expect(
      pickCounter(updated, FiscalCounterType.SaleTaxByTax, {
        fiscalCounterCurrency: 'ZWL',
        fiscalCounterTaxID: 1,
        fiscalCounterTaxPercent: 15,
      })?.fiscalCounterValue
    ).toBe(200);
    expect(
      pickCounter(updated, FiscalCounterType.BalanceByMoneyType, {
        fiscalCounterCurrency: 'ZWL',
        fiscalCounterMoneyType: MoneyType.Cash,
      })?.fiscalCounterValue
    ).toBe(1200);
  });

  it('forces CreditNote deltas to negative values', () => {
    const receipt = makeReceipt({
      receiptType: ReceiptType.CreditNote,
      receiptTaxes: [{ taxID: 2, taxPercent: 0, taxAmount: 3, salesAmountWithTax: 20 }],
      receiptPayments: [{ moneyTypeCode: MoneyType.Card, paymentAmount: 20 }],
    });

    const updated = service.updateCounters(receipt, []);

    expect(
      pickCounter(updated, FiscalCounterType.CreditNoteByTax, {
        fiscalCounterCurrency: 'ZWL',
        fiscalCounterTaxID: 2,
        fiscalCounterTaxPercent: 0,
      })?.fiscalCounterValue
    ).toBe(-2000);
    expect(
      pickCounter(updated, FiscalCounterType.CreditNoteTaxByTax, {
        fiscalCounterCurrency: 'ZWL',
        fiscalCounterTaxID: 2,
        fiscalCounterTaxPercent: 0,
      })?.fiscalCounterValue
    ).toBe(-300);
    expect(
      pickCounter(updated, FiscalCounterType.BalanceByMoneyType, {
        fiscalCounterCurrency: 'ZWL',
        fiscalCounterMoneyType: MoneyType.Card,
      })?.fiscalCounterValue
    ).toBe(-2000);
  });

  it('updates DebitNote counters and keeps grouping by taxPercent + taxID', () => {
    const receipt = makeReceipt({
      receiptType: ReceiptType.DebitNote,
      receiptTaxes: [
        { taxID: 1, taxPercent: 15, taxAmount: 1.5, salesAmountWithTax: 10 },
        { taxID: 1, taxPercent: 0, taxAmount: 0, salesAmountWithTax: 8 },
      ],
      receiptPayments: [{ moneyTypeCode: MoneyType.BankTransfer, paymentAmount: 18 }],
    });

    const updated = service.updateCounters(receipt, []);

    expect(
      pickCounter(updated, FiscalCounterType.DebitNoteByTax, {
        fiscalCounterCurrency: 'ZWL',
        fiscalCounterTaxID: 1,
        fiscalCounterTaxPercent: 15,
      })?.fiscalCounterValue
    ).toBe(1000);
    expect(
      pickCounter(updated, FiscalCounterType.DebitNoteByTax, {
        fiscalCounterCurrency: 'ZWL',
        fiscalCounterTaxID: 1,
        fiscalCounterTaxPercent: 0,
      })?.fiscalCounterValue
    ).toBe(800);
    expect(
      pickCounter(updated, FiscalCounterType.BalanceByMoneyType, {
        fiscalCounterCurrency: 'ZWL',
        fiscalCounterMoneyType: MoneyType.BankTransfer,
      })?.fiscalCounterValue
    ).toBe(1800);
  });

  it('removes counters whose aggregated value becomes zero', () => {
    const receipt = makeReceipt({
      receiptType: ReceiptType.FiscalInvoice,
      receiptPayments: [{ moneyTypeCode: MoneyType.Cash, paymentAmount: -5 }],
    });
    const existing: FiscalDayCounter[] = [
      {
        fiscalCounterType: FiscalCounterType.BalanceByMoneyType,
        fiscalCounterCurrency: 'ZWL',
        fiscalCounterMoneyType: MoneyType.Cash,
        fiscalCounterValue: 500,
      },
    ];

    const updated = service.updateCounters(receipt, existing);

    expect(
      pickCounter(updated, FiscalCounterType.BalanceByMoneyType, {
        fiscalCounterCurrency: 'ZWL',
        fiscalCounterMoneyType: MoneyType.Cash,
      })
    ).toBeUndefined();
  });
});
