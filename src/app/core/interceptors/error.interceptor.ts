import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, mergeMap, retryWhen, scan, tap } from 'rxjs/operators';
import { ToastService } from '../services/toast.service';
import { mapApiErrorCode } from '../services/api-error-mapper';
import { FiscalDayProcessingError } from '../models/api.models';
import { FiscalDayStore } from '../store/fiscal-day.store';
import { Router } from '@angular/router';

/**
 * Global error interceptor:
 * - maps backend error codes to user-friendly messages (toast)
 * - retries HTTP 500/502 with exponential backoff (3 attempts total)
 * - updates/persists global fiscal-day state on successful mutations and close-day errors
 */
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  private readonly toast = inject(ToastService);
  private readonly fiscalDayStore = inject(FiscalDayStore);
  private readonly router = inject(Router);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      tap((evt) => {
        // Persist fiscal-day on successful mutations.
        if (!(evt instanceof HttpResponse)) return;
        const url = req.url ?? '';
        if (req.method !== 'POST') return;

        const body = evt.body as any;
        // Note: URL contains the full base URL + path.
        if (url.includes('/OpenDay')) {
          const fiscalDayNo = body?.fiscalDayNo;
          const deviceID = (req.body as any)?.deviceID;
          const fiscalDayOpened = (req.body as any)?.fiscalDayOpened;
          if (typeof deviceID === 'number' && typeof fiscalDayNo === 'number' && typeof fiscalDayOpened === 'string') {
            this.fiscalDayStore.applyOpenDaySuccess({ deviceID, fiscalDayNo, fiscalDayOpened });
          }
        } else if (url.includes('/CloseDay')) {
          const fiscalDayNo = (req.body as any)?.fiscalDayNo;
          if (typeof fiscalDayNo === 'number') this.fiscalDayStore.applyCloseDaySuccess({ fiscalDayNo });
        } else if (url.includes('/SubmitReceipt')) {
          const receipt = (req.body as any)?.receipt;
          if (receipt?.receiptDeviceSignature?.hash) {
            this.fiscalDayStore.submitReceiptSuccess({ receipt, response: body });
          }
        }
      }),

      retryWhen((errors) =>
        errors.pipe(
          scan(
            (acc, err: unknown) => ({ err, attempt: acc.attempt + 1 }),
            { err: null as unknown, attempt: 0 }
          ),
          mergeMap(({ err, attempt }) => {
            const http = err as HttpErrorResponse;
            const status = http?.status;
            const isRetryable = status === 500 || status === 502;
            const maxRetries = 2; // => 3 attempts total
            if (isRetryable && attempt <= maxRetries) {
              this.toast.push(`Connection issue, retrying... (${attempt}/${maxRetries})`, 'warning', 1600);
              // Exponential-ish backoff from retry count.
              const delayMs = Math.pow(2, attempt - 1) * 1000;
              return timer(delayMs);
            }
            return throwError(() => err);
          })
        )
      ),

      catchError((err: unknown) => {
        const http = err as HttpErrorResponse;
        const status = http?.status;
        const code = this.extractErrorCode(http);
        const parsedValidation = this.extractValidationDetails(http);
        const mapped = mapApiErrorCode(code, { httpStatus: http?.status });

        // Best-effort: map FISCxx to our FiscalDayProcessingError so the UI can show guidance.
        const reqUrl = req.url ?? '';
        if (reqUrl.includes('/CloseDay') && typeof code === 'string' && code.startsWith('FISC')) {
          const fiscalError = this.mapFiscalError(code);
          if (fiscalError != null) {
            this.fiscalDayStore.applyCloseDayError({ fiscalDayNo: (req.body as any)?.fiscalDayNo ?? null, error: fiscalError });
          }
        }

        if (reqUrl.includes('/OpenDay') && typeof code === 'string' && code.startsWith('FISC')) {
          const fiscalError = this.mapFiscalError(code);
          if (fiscalError != null) {
            this.fiscalDayStore.applyOpenDayError({
              deviceID: (req.body as any)?.deviceID ?? null,
              fiscalDayNo: (req.body as any)?.fiscalDayNo ?? null,
              error: fiscalError,
            });
          }
        }

        if (status === 401) {
          this.toast.push(
            'Authentication failed (401). Device certificate is required or expired. Redirecting to certificate management.',
            'error'
          );
          void this.router.navigate(['/certificates']);
          this.decorateError(http, {
            code,
            status,
            formError:
              'Authentication failed. Review current device certificate and re-issue/renew certificate if required.',
          });
          return throwError(() => http);
        }

        if (status === 422) {
          // Validation and business-rule errors are both 422; try to provide the most actionable message.
          const businessMessage = mapped.message;
          const formError = parsedValidation.formError || businessMessage;
          this.decorateError(http, {
            code,
            status,
            formError,
            fieldErrors: parsedValidation.fieldErrors,
          });
          this.toast.push(formError, mapped.variant);
          return throwError(() => http);
        }

        if (status === 500 || status === 502) {
          this.toast.push('Connection issue. Request failed after retries.', 'error');
          this.decorateError(http, { code, status, formError: 'Connection issue. Please retry.' });
          return throwError(() => http);
        }

        // Unknown error fallback.
        console.error('[HTTP][UnhandledError]', {
          method: req.method,
          url: req.url,
          status,
          code,
          error: http?.error,
        });
        this.toast.push('Unexpected error occurred. Please try again.', 'error');
        this.decorateError(http, { code, status, formError: 'Unexpected error occurred.' });
        return throwError(() => http);
      })
    );
  }

  private extractErrorCode(http: HttpErrorResponse): string | undefined {
    const e = http?.error as any;
    // ProblemDetails shapes can differ; try common locations.
    return (
      e?.errorCode ??
      e?.error?.errorCode ??
      e?.error?.error ??
      e?.code ??
      (http as any)?.errorCode ??
      undefined
    );
  }

  private mapFiscalError(code: string): FiscalDayProcessingError | null {
    // Spec codes are grouped (FISC01/03/04 in prompt). Current app guidance expects FiscalDayProcessingError enum values.
    switch (code) {
      case 'FISC01':
        return FiscalDayProcessingError.BadCertificateSignature;
      case 'FISC03':
        return FiscalDayProcessingError.MissingReceipts;
      case 'FISC04':
        return FiscalDayProcessingError.CountersMismatch;
      default:
        return null;
    }
  }

  private extractValidationDetails(http: HttpErrorResponse): {
    formError?: string;
    fieldErrors: Record<string, string>;
  } {
    const fieldErrors: Record<string, string> = {};
    const e = http?.error as any;

    // RFC7807 style with errors bag.
    const errorsObj = e?.errors ?? e?.error?.errors;
    if (errorsObj && typeof errorsObj === 'object' && !Array.isArray(errorsObj)) {
      for (const [field, msgs] of Object.entries(errorsObj as Record<string, unknown>)) {
        if (Array.isArray(msgs) && msgs.length) {
          fieldErrors[field] = String(msgs[0]);
        } else if (typeof msgs === 'string') {
          fieldErrors[field] = msgs;
        }
      }
    }

    // Issues array fallback.
    const issues = e?.issues ?? e?.error?.issues;
    if (Array.isArray(issues)) {
      for (const item of issues) {
        const key = String(item?.field ?? item?.path ?? '').trim();
        const msg = String(item?.message ?? item?.detail ?? '').trim();
        if (key && msg) fieldErrors[key] = msg;
      }
    }

    const formError =
      (typeof e?.detail === 'string' && e.detail) ||
      (typeof e?.title === 'string' && e.title) ||
      (typeof e?.error?.detail === 'string' && e.error.detail) ||
      undefined;

    return { formError, fieldErrors };
  }

  private decorateError(
    http: HttpErrorResponse,
    meta: { code?: string; status?: number; formError?: string; fieldErrors?: Record<string, string> }
  ): void {
    const existing = (http as any).error ?? {};
    (http as any).error = {
      ...existing,
      ui: {
        code: meta.code,
        status: meta.status,
        formError: meta.formError,
        fieldErrors: meta.fieldErrors ?? {},
      },
    };
  }
}

