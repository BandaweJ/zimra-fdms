import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'zimra-modal',
  standalone: true,
  imports: [NgIf],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center"
      *ngIf="open"
    >
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" (click)="onBackdropClick()"></div>
      <div class="relative h-full w-full scale-100 overflow-y-auto rounded-none bg-white p-6 shadow-xl transition-all duration-150 animate-[fadeSlideIn_150ms_ease_both] sm:h-auto sm:max-w-lg sm:rounded-2xl">
        <div class="mb-3 text-lg font-semibold text-slate-900">
          <ng-content select="[modal-title]"></ng-content>
        </div>
        <div class="text-slate-700">
          <ng-content></ng-content>
        </div>
        <div class="mt-6 flex justify-end gap-2" *ngIf="showDefaultClose">
          <button
            type="button"
            class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            (click)="closed.emit()"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ModalComponent {
  @Input() open = false;
  @Input() closeOnBackdrop = true;
  @Input() showDefaultClose = true;
  @Output() closed = new EventEmitter<void>();

  onBackdropClick(): void {
    if (this.closeOnBackdrop) this.closed.emit();
  }
}

