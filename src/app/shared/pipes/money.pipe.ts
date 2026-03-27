import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'money',
  standalone: true,
})
export class MoneyPipe implements PipeTransform {
  transform(value: number | string | null | undefined, currency = 'USD'): string {
    const num = typeof value === 'string' ? Number(value) : value;
    if (num === null || num === undefined || Number.isNaN(num)) return '0.00';

    // Placeholder: replace with spec-defined formatting (decimals=2, decimal(21,2), etc.).
    return new Intl.NumberFormat('en-ZW', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }
}

