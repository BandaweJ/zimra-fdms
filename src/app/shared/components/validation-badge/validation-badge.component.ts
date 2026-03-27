import { Component, Input, computed } from '@angular/core';
import { ValidationColor } from '../../../core/models/api.models';
import {
  getValidationErrorMeta,
  isFiscalDayCloseBlockedByColor,
  ReceiptValidationColor,
} from '../../../core/validation/receipt-validation-catalog';

@Component({
  selector: 'zimra-validation-badge',
  standalone: true,
  template: `
    <span
      class="rounded-full border px-2 py-1 text-xs font-semibold"
      [class]="badgeClass()"
      [title]="tooltipText()"
    >
      {{ label() }}
    </span>
  `,
})
export class ValidationBadgeComponent {
  @Input() color: ReceiptValidationColor = 'white';
  @Input() codes: string[] = [];

  readonly label = computed(() => {
    const c = this.color;
    return c === 'white' ? 'WHITE' : c.toUpperCase();
  });

  readonly badgeClass = computed(() => {
    const c = this.color;
    if (c === ValidationColor.Red) return 'bg-red-50 text-red-700 border-red-200';
    if (c === ValidationColor.Yellow) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    if (c === ValidationColor.Grey) return 'bg-slate-100 text-slate-700 border-slate-200';
    return 'bg-white text-slate-700 border-slate-200';
  });

  readonly tooltipText = computed(() => {
    const codes = this.codes ?? [];
    const header = `Validation: ${this.label()}`;
    if (!codes.length) {
      const blocked = isFiscalDayCloseBlockedByColor(this.color) ? 'Yes' : 'No';
      return `${header}\nNo validation error codes.\nFiscal day close blocked: ${blocked}`;
    }
    const rows = codes.map((code) => {
      const m = getValidationErrorMeta(code);
      return `${code} - ${m.text} (requiresPrevious: ${m.requiresPrevious ? 'yes' : 'no'})`;
    });
    const blocked = isFiscalDayCloseBlockedByColor(this.color) ? 'Yes' : 'No';
    return `${header}\n${rows.join('\n')}\nFiscal day close blocked: ${blocked}`;
  });
}

