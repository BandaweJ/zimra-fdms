import { Injectable, inject, signal } from '@angular/core';
import { interval, Subscription, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { PingRequest, PingResponse } from '../models/api.models';
import { FdmsContextService } from './fdms-context.service';
import { ConnectionStore } from '../store/connection.store';
import { catchError, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class PingService {
  private readonly api = inject(ApiService);
  private readonly fdmsContext = inject(FdmsContextService);
  private readonly connection = inject(ConnectionStore);
  private sub?: Subscription;

  readonly lastPingAt = signal<Date | null>(null);
  readonly lastPingErrorAt = signal<Date | null>(null);
  readonly pingIntervalMs = signal<number>(0);
  readonly reportingFrequencyMinutes = signal<number>(0);

  private lastDeviceID: number | null = null;

  ping(request: PingRequest) {
    const { deviceID } = request;
    const headers = this.fdmsContext.getRequiredHeaders();
    return this.api
      .post<PingResponse>(`/Device/v1/${deviceID}/Ping`, null, {
      headers: {
        DeviceModelName: headers.deviceModelName,
        DeviceModelVersion: headers.deviceModelVersion,
      },
      })
      .pipe(
        tap((res) => {
          const now = new Date();
          this.lastPingAt.set(now);
          this.lastPingErrorAt.set(null);
          this.reportingFrequencyMinutes.set(res.reportingFrequency);
          this.connection.setLastOnlineAtMs(Date.now());
          this.connection.setReportingFrequencyMinutes(res.reportingFrequency);
        }),
        catchError((err) => {
          this.lastPingErrorAt.set(new Date());
          return throwError(() => err);
        })
      );
  }

  start(request: PingRequest, onPingOk?: () => void): void {
    this.stop();
    this.lastDeviceID = request.deviceID;

    // First ping immediately to learn the reporting frequency.
    this.ping(request).subscribe({
      next: (res) => {
        this.applyReportingFrequency(res.reportingFrequency, onPingOk);
        onPingOk?.();
      },
      error: () => {
        // Fallback until a successful ping returns reportingFrequency.
        const fallbackMs = 5 * 60 * 1000;
        this.applyReportingIntervalMs(fallbackMs, onPingOk);
      },
    });
  }

  private applyReportingFrequency(reportingFrequencyMinutes: number, onPingOk?: () => void): void {
    const intervalMs = Math.max(15_000, reportingFrequencyMinutes * 60_000);
    this.applyReportingIntervalMs(intervalMs, onPingOk);
  }

  private applyReportingIntervalMs(intervalMs: number, onPingOk?: () => void): void {
    this.pingIntervalMs.set(intervalMs);
    if (this.sub) this.sub.unsubscribe();

    const id = this.lastDeviceID;
    if (id == null) return;

    this.sub = interval(intervalMs).subscribe(() => {
      this.ping({ deviceID: id }).subscribe({
        next: (res) => {
          // Adjust schedule if reporting frequency changes.
          if (typeof res.reportingFrequency === 'number' && res.reportingFrequency > 0 && res.reportingFrequency !== this.reportingFrequencyMinutes()) {
            this.applyReportingFrequency(res.reportingFrequency, onPingOk);
          }
          onPingOk?.();
        },
        error: () => {
          // ping() already sets lastPingErrorAt via catchError.
        },
      });
    });
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
  }
}

