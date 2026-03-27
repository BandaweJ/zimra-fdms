import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgClass, NgIf } from '@angular/common';

@Component({
  selector: 'zimra-input',
  standalone: true,
  imports: [NgIf, NgClass],
  template: `
    <label class="block space-y-1">
      <div class="mb-1 text-xs font-medium text-slate-700" *ngIf="label">{{ label }}</div>
      @if (type === 'textarea') {
        <textarea
          class="w-full rounded-xl bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400
                 focus:outline-none focus:ring-2"
          [ngClass]="fieldClasses"
          [value]="value"
          [placeholder]="placeholder"
          [disabled]="disabled"
          [attr.maxlength]="maxlength || null"
          (input)="onInput($event)"
        ></textarea>
      } @else if (type === 'select') {
        <select
          class="w-full rounded-xl bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2"
          [ngClass]="fieldClasses"
          [disabled]="disabled"
          [value]="value"
          (change)="onInput($event)"
        >
          <ng-content select="option"></ng-content>
        </select>
      } @else {
        <input
          class="w-full rounded-xl bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400
                 focus:outline-none focus:ring-2"
          [ngClass]="fieldClasses"
          [type]="type"
          [value]="value"
          [placeholder]="placeholder"
          [disabled]="disabled"
          [attr.maxlength]="maxlength || null"
          (input)="onInput($event)"
        />
      }
      <div class="flex items-center justify-between">
        <div class="text-xs text-slate-500" *ngIf="hint && !error">{{ hint }}</div>
        <div class="text-xs text-red-600" *ngIf="error">{{ error }}</div>
        <div class="ml-auto text-xs text-slate-500" *ngIf="maxlength">
          {{ value.length }}/{{ maxlength }}
        </div>
      </div>
    </label>
  `,
})
export class InputComponent {
  @Input() label?: string;
  @Input() placeholder?: string;
  @Input() hint?: string;
  @Input() error?: string;
  @Input() maxlength?: number;
  @Input() type: 'text' | 'number' | 'password' | 'select' | 'textarea' = 'text';
  @Input() validationState: 'neutral' | 'valid' | 'error' = 'neutral';
  @Input() disabled = false;
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();

  get fieldClasses(): string {
    if (this.validationState === 'error' || this.error) {
      return 'border border-red-300 focus:ring-red-100';
    }
    if (this.validationState === 'valid') {
      return 'border border-emerald-300 focus:ring-emerald-100';
    }
    return 'border border-slate-200 focus:ring-slate-900/10';
  }

  onInput(e: Event): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    this.valueChange.emit(target?.value ?? '');
  }
}

