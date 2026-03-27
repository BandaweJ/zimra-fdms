import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgClass } from '@angular/common';

export interface DataTableColumn<T = Record<string, unknown>> {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
}

@Component({
  selector: 'zimra-data-table',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="overflow-x-auto rounded-xl border border-slate-200">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs font-semibold text-slate-500">
          <tr>
            @for (c of columns; track c.key) {
              <th class="px-3 py-2" [ngClass]="c.sortable ? 'cursor-pointer select-none' : ''" (click)="onSort(c)">
                {{ c.label }}
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @if (loading) {
            @for (_ of skeletonRows(); track $index) {
              <tr class="border-t border-slate-100">
                @for (c of columns; track c.key) {
                  <td class="px-3 py-2"><div class="h-4 w-24 animate-pulse rounded bg-slate-200"></div></td>
                }
              </tr>
            }
          } @else if (!pagedRows().length) {
            <tr>
              <td class="px-3 py-6 text-center text-slate-500" [attr.colspan]="columns.length">
                <ng-content select="[empty-state]"></ng-content>
              </td>
            </tr>
          } @else {
            @for (r of pagedRows(); track rowTrack(r, $index); let i = $index) {
              <tr class="border-t border-slate-100" (click)="rowClick.emit(r)">
                @for (c of columns; track c.key) {
                  <td class="px-3 py-2">{{ r[c.key] }}</td>
                }
              </tr>
              @if (expandedRowIndex === i) {
                <tr class="border-t border-slate-50">
                  <td class="px-3 py-3 text-xs text-slate-600" [attr.colspan]="columns.length">
                    <ng-content select="[expanded-row]"></ng-content>
                  </td>
                </tr>
              }
            }
          }
        </tbody>
      </table>
    </div>
    <div class="mt-2 flex items-center justify-end gap-2 text-xs">
      <button type="button" class="rounded border px-2 py-1" (click)="prevPage()" [disabled]="page <= 1">Prev</button>
      <span>Page {{ page }} / {{ totalPages() }}</span>
      <button type="button" class="rounded border px-2 py-1" (click)="nextPage()" [disabled]="page >= totalPages()">Next</button>
    </div>
  `,
})
export class DataTableComponent<T extends Record<string, unknown>> {
  @Input() columns: DataTableColumn<T>[] = [];
  @Input() rows: T[] = [];
  @Input() loading = false;
  @Input() pageSize = 10;
  @Input() rowTrackBy?: (row: T, index: number) => string | number;
  @Input() expandedRowIndex: number | null = null;

  @Output() rowClick = new EventEmitter<T>();
  @Output() sortChange = new EventEmitter<{ key: string; direction: 'asc' | 'desc' }>();

  page = 1;
  private sortKey: string | null = null;
  private sortDirection: 'asc' | 'desc' = 'asc';

  rowTrack(row: T, index: number): string | number {
    return this.rowTrackBy ? this.rowTrackBy(row, index) : index;
  }

  onSort(c: DataTableColumn<T>): void {
    if (!c.sortable) return;
    if (this.sortKey === c.key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = c.key;
      this.sortDirection = 'asc';
    }
    this.sortChange.emit({ key: c.key, direction: this.sortDirection });
  }

  pagedRows(): T[] {
    const start = (this.page - 1) * this.pageSize;
    return this.rows.slice(start, start + this.pageSize);
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.rows.length / this.pageSize));
  }

  prevPage(): void {
    this.page = Math.max(1, this.page - 1);
  }

  nextPage(): void {
    this.page = Math.min(this.totalPages(), this.page + 1);
  }

  skeletonRows(): number[] {
    return Array.from({ length: Math.max(1, Math.min(5, this.pageSize)) }, (_, i) => i);
  }
}
