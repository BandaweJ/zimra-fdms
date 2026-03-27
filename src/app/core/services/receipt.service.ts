import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { FdmsContextService } from './fdms-context.service';
import {
  FiscalCounterType,
  FiscalDayCounter,
  MoneyType,
  Receipt,
  ReceiptTax,
  SubmitReceiptRequest,
  SubmitReceiptResponse,
  ReceiptType,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private readonly api = inject(ApiService);
  private readonly fdmsContext = inject(FdmsContextService);

  submitReceipt(
    request: SubmitReceiptRequest
  ): Observable<SubmitReceiptResponse> {
    const { deviceID, receipt } = request;
    const headers = this.fdmsContext.getRequiredHeaders();
    return this.api.post<SubmitReceiptResponse>(`/Device/v1/${deviceID}/SubmitReceipt`, { receipt }, {
      headers: {
        DeviceModelName: headers.deviceModelName,
        DeviceModelVersion: headers.deviceModelVersion,
      },
    });
  }

  /**
   * Spec section 6: accumulate `fiscalDayCounters` from a receipt.
   *
   * - Values added for `ByTax` counters use `salesAmountWithTax` and `taxAmount`.
   * - Values added for `BalanceByMoneyType` use `receiptPayments.paymentAmount`.
   * - CreditNote deltas are always applied as negative values (per spec).
   * - `fiscalCounterValue` is treated as "cents" (integer) in this app.
   * - Zero-value counters are removed (must NOT be submitted).
   */
  updateCounters(receipt: Receipt, existingCounters: FiscalDayCounter[]): FiscalDayCounter[] {
    const toCents = (amount: number): number => Math.round((amount ?? 0) * 100);

    const counters = existingCounters.map((c) => ({ ...c }));

    const upsertByKey = (key: string, updater: () => FiscalDayCounter): void => {
      const idx = counters.findIndex((c) => `${c.fiscalCounterType}|${c.fiscalCounterCurrency}|${c.fiscalCounterTaxID ?? ''}|${c.fiscalCounterTaxPercent ?? ''}|${c.fiscalCounterMoneyType ?? ''}` === key);
      if (idx >= 0) {
        counters[idx].fiscalCounterValue += updater().fiscalCounterValue;
      } else {
        counters.push(updater());
      }
    };

    const currency = receipt.receiptCurrency;
    const taxes: ReceiptTax[] = receipt.receiptTaxes ?? [];

    // Determine which ByTax counters to update based on receipt type.
    const isInvoice = receipt.receiptType === ReceiptType.FiscalInvoice;
    const isCredit = receipt.receiptType === ReceiptType.CreditNote;
    const isDebit = receipt.receiptType === ReceiptType.DebitNote;

    for (const t of taxes) {
      const taxPercent = t.taxPercent ?? undefined;
      // Spec says group by (taxPercent + taxCode). In this app, taxCode isn't persisted in counters,
      // so we use `taxID` as the tax code identifier.
      const taxCodeKey = t.taxID;
      const salesDeltaCentsRaw = toCents(t.salesAmountWithTax);
      const taxDeltaCentsRaw = toCents(t.taxAmount);
      const salesDeltaCents = isCredit ? -Math.abs(salesDeltaCentsRaw) : salesDeltaCentsRaw;
      const taxDeltaCents = isCredit ? -Math.abs(taxDeltaCentsRaw) : taxDeltaCentsRaw;

      if (isInvoice) {
        // SaleByTax += salesAmountWithTax; SaleTaxByTax += taxAmount
        upsertByKey(
          `${FiscalCounterType.SaleByTax}|${currency}|${taxCodeKey}|${taxPercent ?? ''}|`,
          () => ({
            fiscalCounterType: FiscalCounterType.SaleByTax,
            fiscalCounterCurrency: currency,
            fiscalCounterTaxID: t.taxID,
            fiscalCounterTaxPercent: taxPercent,
            fiscalCounterValue: salesDeltaCents,
          })
        );
        upsertByKey(
          `${FiscalCounterType.SaleTaxByTax}|${currency}|${taxCodeKey}|${taxPercent ?? ''}|`,
          () => ({
            fiscalCounterType: FiscalCounterType.SaleTaxByTax,
            fiscalCounterCurrency: currency,
            fiscalCounterTaxID: t.taxID,
            fiscalCounterTaxPercent: taxPercent,
            fiscalCounterValue: taxDeltaCents,
          })
        );
      } else if (isCredit) {
        // CreditNoteByTax += salesAmountWithTax; CreditNoteTaxByTax += taxAmount
        upsertByKey(
          `${FiscalCounterType.CreditNoteByTax}|${currency}|${taxCodeKey}|${taxPercent ?? ''}|`,
          () => ({
            fiscalCounterType: FiscalCounterType.CreditNoteByTax,
            fiscalCounterCurrency: currency,
            fiscalCounterTaxID: t.taxID,
            fiscalCounterTaxPercent: taxPercent,
            fiscalCounterValue: salesDeltaCents,
          })
        );
        upsertByKey(
          `${FiscalCounterType.CreditNoteTaxByTax}|${currency}|${taxCodeKey}|${taxPercent ?? ''}|`,
          () => ({
            fiscalCounterType: FiscalCounterType.CreditNoteTaxByTax,
            fiscalCounterCurrency: currency,
            fiscalCounterTaxID: t.taxID,
            fiscalCounterTaxPercent: taxPercent,
            fiscalCounterValue: taxDeltaCents,
          })
        );
      } else if (isDebit) {
        // DebitNoteByTax += salesAmountWithTax; DebitNoteTaxByTax += taxAmount
        upsertByKey(
          `${FiscalCounterType.DebitNoteByTax}|${currency}|${taxCodeKey}|${taxPercent ?? ''}|`,
          () => ({
            fiscalCounterType: FiscalCounterType.DebitNoteByTax,
            fiscalCounterCurrency: currency,
            fiscalCounterTaxID: t.taxID,
            fiscalCounterTaxPercent: taxPercent,
            fiscalCounterValue: salesDeltaCents,
          })
        );
        upsertByKey(
          `${FiscalCounterType.DebitNoteTaxByTax}|${currency}|${taxCodeKey}|${taxPercent ?? ''}|`,
          () => ({
            fiscalCounterType: FiscalCounterType.DebitNoteTaxByTax,
            fiscalCounterCurrency: currency,
            fiscalCounterTaxID: t.taxID,
            fiscalCounterTaxPercent: taxPercent,
            fiscalCounterValue: taxDeltaCents,
          })
        );
      }
    }

    // BalanceByMoneyType += paymentAmount (CreditNote must always decrease).
    const payments = receipt.receiptPayments ?? [];
    for (const p of payments) {
      const moneyType = p.moneyTypeCode as unknown as MoneyType;
      const paymentDeltaRaw = toCents(p.paymentAmount);
      const deltaCents = isCredit ? -Math.abs(paymentDeltaRaw) : paymentDeltaRaw;
      if (deltaCents === 0) continue;

      upsertByKey(
        `${FiscalCounterType.BalanceByMoneyType}|${currency}|||${moneyType}`,
        () => ({
          fiscalCounterType: FiscalCounterType.BalanceByMoneyType,
          fiscalCounterCurrency: currency,
          fiscalCounterMoneyType: moneyType,
          fiscalCounterValue: deltaCents,
        })
      );
    }

    // Zero-value counters must NOT be submitted to FDMS.
    return counters.filter((c) => Math.round(c.fiscalCounterValue) !== 0);
  }
}

