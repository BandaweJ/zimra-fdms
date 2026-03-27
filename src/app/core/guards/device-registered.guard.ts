import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { FdmsContextService } from '../services/fdms-context.service';
import { StorageService } from '../services/storage.service';

export const deviceRegisteredGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const fdmsContext = inject(FdmsContextService);
  const storage = inject(StorageService);

  const ctxDeviceID = fdmsContext.getDeviceID();
  const cert = ctxDeviceID != null ? await storage.getDeviceCertificate(ctxDeviceID) : await storage.getAnyDeviceCertificate();
  const config = ctxDeviceID != null ? await storage.getDeviceConfig(ctxDeviceID) : await storage.getAnyDeviceConfig();

  if (cert && config) {
    const expiresAt = new Date(cert.validTill).getTime();
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      return router.createUrlTree(['/certificates'], {
        queryParams: {
          certExpired: '1',
          returnUrl: state.url || '/dashboard',
        },
      });
    }
    return true;
  }

  const returnUrl = state.url || '/setup';
  return router.createUrlTree(['/setup'], { queryParams: { returnUrl } });
};

