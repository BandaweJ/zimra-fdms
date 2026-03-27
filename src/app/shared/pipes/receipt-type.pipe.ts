import { Pipe, PipeTransform } from '@angular/core';
import { ReceiptPrintForm } from '../../core/models/enums';

@Pipe({
  name: 'receiptType',
  standalone: true,
})
export class ReceiptTypePipe implements PipeTransform {
  transform(value: ReceiptPrintForm | string | number | null | undefined): string {
    const v = value ?? '';
    if (v === ReceiptPrintForm.Receipt48 || v === 0 || v === 'Receipt48' || v === 'receipt48') return 'Receipt 48';
    if (v === ReceiptPrintForm.InvoiceA4 || v === 1 || v === 'InvoiceA4' || v === 'invoicea4') return 'Invoice A4';
    return 'Unknown';
  }
}

