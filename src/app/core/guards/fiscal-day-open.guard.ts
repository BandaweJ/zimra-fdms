import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FiscalDayStatus } from '../models/api.models';
import { FdmsContextService } from '../services/fdms-context.service';
import { StorageService } from '../services/storage.service';
import { FiscalDayStore } from '../store/fiscal-day.store';

export const fiscalDayOpenGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const fdmsContext = inject(FdmsContextService);
  const storage = inject(StorageService);
  const store = inject(FiscalDayStore);

  let status = store.view().status;
  if (status == null) {
    const deviceID = fdmsContext.getDeviceID() ?? (await storage.getAnyDeviceCertificate())?.deviceID ?? null;
    if (deviceID != null) {
      try {
        await store.loadStatus(deviceID);
      } catch {
        // ignore and use the currently available local state
      }
      status = store.view().status;
    }
  }

  if (status === FiscalDayStatus.FiscalDayOpened) return true;

  return router.createUrlTree(['/fiscal-day/open'], {
    queryParams: { requireOpenDay: '1' },
  });
};

