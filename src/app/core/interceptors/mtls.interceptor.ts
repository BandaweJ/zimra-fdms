import { Injectable, inject } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { from, Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { FdmsContextService } from '../services/fdms-context.service';
import { StorageService } from '../services/storage.service';

/**
 * mTLS interceptor (header-based):
 * - Retrieve device certificate PEM from IndexedDB and send as `X-Client-Certificate`
 * - Ensure device model headers exist
 * - Skip public endpoints and `Ping`
 */
@Injectable()
export class MtlsInterceptor implements HttpInterceptor {
  private readonly storage = inject(StorageService);
  private readonly fdmsContext = inject(FdmsContextService);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const url = req.url ?? '';
    // Skip public endpoints.
    if (url.includes('/Public/')) return next.handle(req);
    if (url.includes('/Ping')) return next.handle(req);

    return from(this.storage.getAnyDeviceCertificate()).pipe(
      mergeMap((cert) => {
        const certPem = cert?.certificatePem?.trim() ?? '';
        if (!certPem) return next.handle(req);

        const cloned = req.clone({
          setHeaders: {
            'X-Client-Certificate': certPem,
          },
        });

        return next.handle(cloned);
      })
    );
  }
}

