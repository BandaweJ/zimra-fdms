import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { ConnectionStore } from '../../../core/store/connection.store';

type ConnectionState = 'connected' | 'disconnected' | 'unknown';

@Component({
  selector: 'zimra-connection-indicator',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="flex items-center gap-2">
      <div
        class="h-2.5 w-2.5 rounded-full"
        [ngClass]="dotClass()"
        [title]="label()"
      ></div>
    </div>
  `,
})
export class ConnectionIndicatorComponent implements OnInit, OnDestroy {
  private readonly connection = inject(ConnectionStore);

  private readonly nowMs = signal<number>(Date.now());
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.timer = setInterval(() => this.nowMs.set(Date.now()), 10_000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private state(): ConnectionState {
    const lastOnline = this.connection.lastOnlineAtMs();
    const freqMin = this.connection.reportingFrequencyMinutes();
    const intervalMs = freqMin > 0 ? freqMin * 60_000 : 0;

    if (lastOnline == null || intervalMs <= 0) return 'unknown';
    const ageMs = this.nowMs() - lastOnline;
    return ageMs < intervalMs * 2 ? 'connected' : 'disconnected';
  }

  label(): string {
    const s = this.state();
    if (s === 'connected') return 'Connected';
    if (s === 'disconnected') return 'No response';
    return 'Checking';
  }

  dotClass(): string {
    const s = this.state();
    if (s === 'connected') return 'bg-status-green';
    if (s === 'disconnected') return 'bg-status-red';
    return 'bg-status-grey';
  }
}

