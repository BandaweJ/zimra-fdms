import { Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'zimra-card',
  standalone: true,
  imports: [NgIf],
  template: `
    <div class="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm dark:border-slate-800 dark:bg-zimra-charcoal-light">
      <div class="mb-4 flex items-center justify-between" *ngIf="showHeader">
        <div class="text-base font-semibold text-slate-900 dark:text-slate-100">
          <ng-content select="[card-title]"></ng-content>
        </div>
        <div>
          <ng-content select="[card-action]"></ng-content>
        </div>
      </div>
      <ng-content></ng-content>
      <div class="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800" *ngIf="showFooter">
        <ng-content select="[card-footer]"></ng-content>
      </div>
    </div>
  `,
})
export class CardComponent {
  @Input() showHeader = false;
  @Input() showFooter = false;
}

