import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DeviceOperatingMode } from '../models/api.models';
import { StorageService } from '../services/storage.service';

export const offlineModeGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const storage = inject(StorageService);

  const cfg = await storage.getAnyDeviceConfig();
  const mode = cfg?.deviceOperatingMode;
  if (mode !== DeviceOperatingMode.Offline) return true;

  return router.createUrlTree(['/offline/status'], {
    queryParams: {
      offlineModeInfo: '1',
      returnUrl: state.url || '/offline/status',
    },
  });
};

