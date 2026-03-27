import { Injectable, signal } from '@angular/core';

const LAST_ONLINE_KEY = 'zimra-fdms:last-online:v1';
const REPORTING_FREQ_KEY = 'zimra-fdms:reporting-frequency-min:v1';

@Injectable({ providedIn: 'root' })
export class ConnectionStore {
  readonly lastOnlineAtMs = signal<number | null>(this.readLastOnlineMs());
  readonly reportingFrequencyMinutes = signal<number>(this.readReportingFrequencyMinutes());

  setLastOnlineAtMs(ms: number): void {
    this.lastOnlineAtMs.set(ms);
    try {
      localStorage.setItem(LAST_ONLINE_KEY, String(ms));
    } catch {
      // ignore
    }
  }

  setReportingFrequencyMinutes(minutes: number): void {
    this.reportingFrequencyMinutes.set(minutes);
    try {
      localStorage.setItem(REPORTING_FREQ_KEY, String(minutes));
    } catch {
      // ignore
    }
  }

  private readLastOnlineMs(): number | null {
    try {
      const raw = localStorage.getItem(LAST_ONLINE_KEY);
      if (!raw) return null;
      const ms = Number(raw);
      return Number.isFinite(ms) ? ms : null;
    } catch {
      return null;
    }
  }

  private readReportingFrequencyMinutes(): number {
    try {
      const raw = localStorage.getItem(REPORTING_FREQ_KEY);
      if (!raw) return 0;
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  }
}

