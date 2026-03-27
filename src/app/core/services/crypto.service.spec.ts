import { TestBed } from '@angular/core/testing';
import { FiscalCounterType, MoneyType, ReceiptType } from '../models/api.models';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CryptoService],
    });
    service = TestBed.inject(CryptoService);
  });

  it('builds receipt signature concat string with sorted taxes and cents', () => {
    const out = service.buildReceiptDeviceSignatureConcatString({
      deviceID: 123,
      receiptType: ReceiptType.FiscalInvoice,
      currency: 'zwl',
      receiptGlobalNo: 45,
      receiptDateISO8601: '2026-03-23T10:30:00',
      receiptTotal: 12.34,
      taxes: [
        { taxID: 2, taxCode: 'B', taxPercent: 0, taxAmount: 0, salesAmountWithTax: 2 },
        { taxID: 1, taxCode: 'A', taxPercent: 15, taxAmount: 1.5, salesAmountWithTax: 10.34 },
      ],
      previousReceiptHash: ' PREVHASH ',
    });

    // Sorted by taxID then taxCode, tax percent fixed to 2 decimals, values in cents.
    expect(out).toBe(
      '123FISCALINVOICEZWL452026-03-23T10:30:001234A15.001501034B0.000200PREVHASH'
    );
  });

  it('builds fiscal day signature concat string with deterministic counter ordering', () => {
    const out = service.buildFiscalDayDeviceSignatureConcatString({
      deviceID: 123,
      fiscalDayNo: 7,
      fiscalDayDateYYYYMMDD: '2026-03-23',
      counters: [
        {
          fiscalCounterType: FiscalCounterType.BalanceByMoneyType,
          fiscalCounterCurrency: 'USD',
          fiscalCounterMoneyType: MoneyType.Cash,
          fiscalCounterValue: 1000,
        },
        {
          fiscalCounterType: FiscalCounterType.SaleByTax,
          fiscalCounterCurrency: 'USD',
          fiscalCounterTaxID: 1,
          fiscalCounterTaxPercent: 15,
          fiscalCounterValue: 2000,
        },
      ],
    });

    // SaleByTax (type 0) comes before BalanceByMoneyType (type 6).
    expect(out).toBe('12372026-03-230USD15.0020006USD01000');
  });

  it('creates QR data from signature as uppercase 16-char MD5 prefix', () => {
    const qrData = service.receiptQrDataFromDeviceSignature('abc');
    expect(qrData).toBe('900150983CD24FB0');
  });

  it('builds receipt QR payload with padded IDs and ddMMyyyy date', () => {
    const payload = service.buildReceiptQrPayload({
      qrUrlBase: 'https://receipt.zimra.org',
      deviceID: 123,
      receiptDateISO8601: '2026-03-23T10:30:00',
      receiptGlobalNo: 45,
      receiptDeviceSignatureBase64: 'abc',
    });

    expect(payload).toBe('https://receipt.zimra.org/0000000123/23032026/0000000045/900150983CD24FB0');
  });
});

