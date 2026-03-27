import { Injectable } from '@angular/core';
import type { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Placeholder loading interceptor.
 * Later: integrate with a global loading indicator signal/service.
 */
@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req);
  }
}

