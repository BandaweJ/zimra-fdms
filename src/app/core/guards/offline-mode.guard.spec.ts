import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { DeviceOperatingMode } from '../models/api.models';
import { StorageService } from '../services/storage.service';
import { offlineModeGuard } from './offline-mode.guard';

describe('offlineModeGuard', () => {
  const urlTree = { redirected: true } as any;
  const routerMock = {
    createUrlTree: (..._args: unknown[]) => urlTree,
  };

  function setup(deviceOperatingMode?: DeviceOperatingMode): void {
    const storageMock = {
      getAnyDeviceConfig: async () =>
        deviceOperatingMode == null
          ? undefined
          : ({ deviceOperatingMode } as any),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: StorageService, useValue: storageMock },
      ],
    });
  }

  it('returns true when no stored config exists', async () => {
    setup(undefined);

    const result = await TestBed.runInInjectionContext(() =>
      offlineModeGuard({} as any, { url: '/dashboard' } as any)
    );

    expect(result).toBe(true);
  });

  it('returns true when mode is Online', async () => {
    setup(DeviceOperatingMode.Online);

    const result = await TestBed.runInInjectionContext(() =>
      offlineModeGuard({} as any, { url: '/dashboard' } as any)
    );

    expect(result).toBe(true);
  });

  it('redirects to offline status when mode is Offline', async () => {
    setup(DeviceOperatingMode.Offline);

    const result = await TestBed.runInInjectionContext(() =>
      offlineModeGuard({} as any, { url: '/receipts/new' } as any)
    );

    expect(result).toBe(urlTree);
  });
});

