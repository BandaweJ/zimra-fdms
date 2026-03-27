import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { FdmsContextService } from '../services/fdms-context.service';

export const setupContextGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const fdmsContext = inject(FdmsContextService);

  try {
    fdmsContext.getRequiredHeaders();
    return true;
  } catch {
    const returnUrl = state.url ?? '/setup/verify';
    return router.createUrlTree(['/setup/context'], { queryParams: { returnUrl } });
  }
};

