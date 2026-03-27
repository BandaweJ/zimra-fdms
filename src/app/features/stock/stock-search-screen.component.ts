import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { StorageService } from '../../core/services/storage.service';
import { Good } from '../../core/models/api.models';
import { StockService } from '../../core/services/stock.service';

type SortField = 'hsCode' | 'goodName' | 'branchName';
type SortOrder = 'asc' | 'desc';
type SearchOperator = 'and' | 'or';

@Component({
  selector: 'zimra-stock-search-screen',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-6xl px-4 py-10">
        <h1 class="text-2xl font-semibold tracking-tight">Stock Search</h1>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Search by HS code (exact) and/or good name (word prefix), with sorting and pagination.
        </p>

        @if (error()) {
          <div class="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{{ error() }}</div>
        }

        <zimra-card class="mt-4">
          <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <input class="rounded border p-2" placeholder="HS code (exact)" [value]="hsCode()" (input)="onHsCodeInput($any($event.target).value)" />
            <input class="rounded border p-2" placeholder="Good name (prefix)" [value]="goodName()" (input)="onGoodNameInput($any($event.target).value)" />
            <select class="rounded border p-2" [value]="operator()" (change)="onOperatorChange($any($event.target).value)">
              <option value="and">AND</option>
              <option value="or">OR</option>
            </select>
            <div class="grid grid-cols-2 gap-2">
              <select class="rounded border p-2" [value]="sort()" (change)="onSortChange($any($event.target).value)">
                <option value="hsCode">hsCode</option>
                <option value="goodName">goodName</option>
                <option value="branchName">branchName</option>
              </select>
              <select class="rounded border p-2" [value]="order()" (change)="onOrderChange($any($event.target).value)">
                <option value="asc">ASC</option>
                <option value="desc">DESC</option>
              </select>
            </div>
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <label class="text-xs text-slate-600 dark:text-slate-300">Offset</label>
            <input class="w-24 rounded border p-2 text-sm" type="number" min="0" [value]="offset()" (input)="onOffsetInput($any($event.target).value)" />
            <label class="text-xs text-slate-600 dark:text-slate-300">Limit</label>
            <input class="w-24 rounded border p-2 text-sm" type="number" min="1" max="100" [value]="limit()" (input)="onLimitInput($any($event.target).value)" />
            <zimra-button variant="secondary" (click)="reset()">Reset</zimra-button>
          </div>
        </zimra-card>

        <zimra-card class="mt-4">
          @if (loading()) {
            <div class="text-sm text-slate-600 dark:text-slate-300">Searching...</div>
          } @else if (!rows().length) {
            <div class="text-sm text-slate-600 dark:text-slate-300">
              No stock items found. Try an exact HS code, a shorter good-name prefix, or switch operator between AND/OR.
            </div>
          } @else {
            <div class="mb-3 text-xs text-slate-500">Total rows: {{ total() }}</div>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead class="text-xs text-slate-500">
                  <tr>
                    <th class="px-3 py-2">HS code</th>
                    <th class="px-3 py-2">Good name</th>
                    <th class="px-3 py-2">Quantity</th>
                    <th class="px-3 py-2">Taxpayer name</th>
                    <th class="px-3 py-2">Branch name</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of rows(); track r.hsCode + '-' + r.goodName + '-' + ($index)) {
                    <tr class="border-t border-slate-200 dark:border-slate-800">
                      <td class="px-3 py-2 font-mono">{{ r.hsCode }}</td>
                      <td class="px-3 py-2">{{ r.goodName }}</td>
                      <td class="px-3 py-2 font-mono">{{ r.quantity }}</td>
                      <td class="px-3 py-2">{{ r.taxPayerName }}</td>
                      <td class="px-3 py-2">{{ r.branchName ?? '-' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          <div class="mt-4 flex justify-end gap-2">
            <zimra-button variant="secondary" [disabled]="offset() === 0" (click)="prevPage()">Prev</zimra-button>
            <zimra-button variant="secondary" [disabled]="offset() + limit() >= total()" (click)="nextPage()">Next</zimra-button>
          </div>
        </zimra-card>
      </div>
    </div>
  `,
})
export class StockSearchScreenComponent implements OnInit, OnDestroy {
  private readonly stockService = inject(StockService);
  private readonly fdmsContext = inject(FdmsContextService);
  private readonly storage = inject(StorageService);

  readonly deviceID = signal<number | null>(null);
  readonly error = signal<string>('');
  readonly loading = signal<boolean>(false);
  readonly total = signal<number>(0);
  readonly rows = signal<Good[]>([]);

  readonly hsCode = signal<string>('');
  readonly goodName = signal<string>('');
  readonly operator = signal<SearchOperator>('and');
  readonly sort = signal<SortField>('hsCode');
  readonly order = signal<SortOrder>('asc');
  readonly offset = signal<number>(0);
  readonly limit = signal<number>(20);

  private debounceTimer?: ReturnType<typeof setTimeout>;

  async ngOnInit(): Promise<void> {
    let id = this.fdmsContext.getDeviceID();
    if (id == null) id = (await this.storage.getAnyDeviceCertificate())?.deviceID ?? null;
    this.deviceID.set(id);
    if (!id) {
      this.error.set('Missing device ID. Complete setup first.');
      return;
    }
    this.search();
  }

  ngOnDestroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  private scheduleDebouncedSearch(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.search(), 300);
  }

  onHsCodeInput(v: string): void {
    this.hsCode.set(v.trim());
    this.offset.set(0);
    this.scheduleDebouncedSearch();
  }

  onGoodNameInput(v: string): void {
    this.goodName.set(v.trim());
    this.offset.set(0);
    this.scheduleDebouncedSearch();
  }

  onOperatorChange(v: string): void {
    this.operator.set((v === 'or' ? 'or' : 'and') as SearchOperator);
    this.offset.set(0);
    this.search();
  }

  onSortChange(v: string): void {
    const safe = v === 'goodName' || v === 'branchName' ? v : 'hsCode';
    this.sort.set(safe);
    this.search();
  }

  onOrderChange(v: string): void {
    this.order.set(v === 'desc' ? 'desc' : 'asc');
    this.search();
  }

  onOffsetInput(v: string): void {
    const n = Math.max(0, Number(v || 0));
    this.offset.set(Number.isFinite(n) ? n : 0);
    this.search();
  }

  onLimitInput(v: string): void {
    const n = Number(v || 20);
    const safe = Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 20;
    this.limit.set(safe);
    this.offset.set(0);
    this.search();
  }

  prevPage(): void {
    this.offset.set(Math.max(0, this.offset() - this.limit()));
    this.search();
  }

  nextPage(): void {
    this.offset.set(this.offset() + this.limit());
    this.search();
  }

  reset(): void {
    this.hsCode.set('');
    this.goodName.set('');
    this.operator.set('and');
    this.sort.set('hsCode');
    this.order.set('asc');
    this.offset.set(0);
    this.limit.set(20);
    this.search();
  }

  search(): void {
    const id = this.deviceID();
    if (!id) return;
    this.loading.set(true);
    this.error.set('');
    this.stockService
      .getStockList({
        deviceID: id,
        ...(this.hsCode() ? { hsCode: this.hsCode() } : {}),
        ...(this.goodName() ? { goodName: this.goodName() } : {}),
        sort: this.sort(),
        order: this.order(),
        operator: this.operator(),
        offset: this.offset(),
        limit: this.limit(),
      })
      .subscribe({
        next: (res) => {
          this.total.set(res.total ?? 0);
          this.rows.set(res.rows ?? []);
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(e instanceof Error ? e.message : String(e));
          this.loading.set(false);
        },
      });
  }
}

