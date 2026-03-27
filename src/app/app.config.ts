import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { LoadingInterceptor } from './core/interceptors/loading.interceptor';
import { ErrorInterceptor } from './core/interceptors/error.interceptor';
import { MtlsInterceptor } from './core/interceptors/mtls.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: LoadingInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: MtlsInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
    provideAnimations(),
    provideRouter(routes)
  ]
};
