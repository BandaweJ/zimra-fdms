import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { FiscalDayStatus } from '../models/api.models';
import { FdmsContextService } from '../services/fdms-context.service';
import { StorageService } from '../services/storage.service';
import { FiscalDayStore } from '../store/fiscal-day.store';
import { fiscalDayOpenGuard } from './fiscal-day-open.guard';

describe('fiscalDayOpenGuard', () => {
  const urlTree = { redirected: true } as any;
  const routerMock = {
    createUrlTree: (..._args: unknown[]) => urlTree,
  };

  function setup(input: {
    initialStatus: FiscalDayStatus | null;
    statusAfterLoad?: FiscalDayStatus | null;
    deviceID: number | null;
    certDeviceID?: number | null;
    loadStatusThrows?: boolean;
  }): { loadStatusCalls: number } {
    const state = { status: input.initialStatus };
    const stats = { loadStatusCalls: 0 };

    const storeMock = {
      view: () => state,
      loadStatus: async (_deviceID: number) => {
        stats.loadStatusCalls += 1;
        if (input.loadStatusThrows) throw new Error('load failed');
        state.status = input.statusAfterLoad ?? state.status;
      },
    };
    const fdmsContextMock = {
      getDeviceID: () => input.deviceID,
    };
    const storageMock = {
      getAnyDeviceCertificate: async () =>
        input.certDeviceID != null ? { deviceID: input.certDeviceID } : undefined,
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: FiscalDayStore, useValue: storeMock },
        { provide: FdmsContextService, useValue: fdmsContextMock },
        { provide: StorageService, useValue: storageMock },
      ],
    });

    return stats;
  }

  it('returns true when fiscal day is already open in store', async () => {
    const stats = setup({
      initialStatus: FiscalDayStatus.FiscalDayOpened,
      deviceID: 7,
    });

    const result = await TestBed.runInInjectionContext(() => fiscalDayOpenGuard({} as any, {} as any));

    expect(result).toBe(true);
    expect(stats.loadStatusCalls).toBe(0);
  });

  it('loads status and returns true if status becomes FiscalDayOpened', async () => {
    const stats = setup({
      initialStatus: null,
      statusAfterLoad: FiscalDayStatus.FiscalDayOpened,
      deviceID: 7,
    });

    const result = await TestBed.runInInjectionContext(() => fiscalDayOpenGuard({} as any, {} as any));

    expect(result).toBe(true);
    expect(stats.loadStatusCalls).toBe(1);
  });

  it('redirects when status is not FiscalDayOpened after load', async () => {
    const stats = setup({
      initialStatus: null,
      statusAfterLoad: FiscalDayStatus.FiscalDayClosed,
      deviceID: 7,
    });

    const result = await TestBed.runInInjectionContext(() => fiscalDayOpenGuard({} as any, {} as any));

    expect(result).toBe(urlTree);
    expect(stats.loadStatusCalls).toBe(1);
  });

  it('uses certificate deviceID fallback when context deviceID is missing', async () => {
    const stats = setup({
      initialStatus: null,
      statusAfterLoad: FiscalDayStatus.FiscalDayOpened,
      deviceID: null,
      certDeviceID: 99,
    });

    const result = await TestBed.runInInjectionContext(() => fiscalDayOpenGuard({} as any, {} as any));

    expect(result).toBe(true);
    expect(stats.loadStatusCalls).toBe(1);
  });
});
