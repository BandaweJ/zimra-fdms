import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { deviceRegisteredGuard } from './device-registered.guard';
import { FdmsContextService } from '../services/fdms-context.service';
import { StorageService } from '../services/storage.service';

describe('deviceRegisteredGuard', () => {
  const urlTree = { redirected: true } as any;
  const routerMock = {
    createUrlTree: (..._args: unknown[]) => urlTree,
  };

  function setup(input: {
    deviceID: number | null;
    certByID?: unknown;
    anyCert?: unknown;
    configByID?: unknown;
    anyConfig?: unknown;
  }): void {
    const storageMock = {
      getDeviceCertificate: async (_deviceID: number) => input.certByID,
      getAnyDeviceCertificate: async () => input.anyCert,
      getDeviceConfig: async (_deviceID: number) => input.configByID,
      getAnyDeviceConfig: async () => input.anyConfig,
    };
    const fdmsContextMock = {
      getDeviceID: () => input.deviceID,
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: StorageService, useValue: storageMock },
        { provide: FdmsContextService, useValue: fdmsContextMock },
      ],
    });
  }

  it('returns true when certificate and config exist for active device', async () => {
    setup({
      deviceID: 10,
      certByID: { deviceID: 10 },
      configByID: { deviceOperatingMode: 0 },
    });

    const result = await TestBed.runInInjectionContext(() =>
      deviceRegisteredGuard({} as any, { url: '/dashboard' } as any)
    );

    expect(result).toBe(true);
  });

  it('returns true using fallback any-certificate and any-config', async () => {
    setup({
      deviceID: null,
      anyCert: { deviceID: 22 },
      anyConfig: { deviceOperatingMode: 1 },
    });

    const result = await TestBed.runInInjectionContext(() =>
      deviceRegisteredGuard({} as any, { url: '/reports' } as any)
    );

    expect(result).toBe(true);
  });

  it('redirects to setup when certificate is missing', async () => {
    setup({
      deviceID: 10,
      certByID: undefined,
      configByID: { deviceOperatingMode: 0 },
    });

    const result = await TestBed.runInInjectionContext(() =>
      deviceRegisteredGuard({} as any, { url: '/dashboard' } as any)
    );

    expect(result).toBe(urlTree);
  });

  it('redirects to setup when config is missing', async () => {
    setup({
      deviceID: 10,
      certByID: { deviceID: 10 },
      configByID: undefined,
    });

    const result = await TestBed.runInInjectionContext(() =>
      deviceRegisteredGuard({} as any, { url: '/offline' } as any)
    );

    expect(result).toBe(urlTree);
  });
});
