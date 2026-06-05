import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Base typed HTTP service. All endpoint-specific services should use this.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // Placeholder base URL; replace with environment config.
  private readonly baseUrl = signal<string>('');

  setBaseUrl(url: string): void {
    this.baseUrl.set(url);
  }

  private buildHeaders(headers?: Record<string, string>): HttpHeaders | undefined {
    if (!headers) return undefined;
    const updated = { ...headers };
    if (updated['DeviceModelVersion'] && !updated['DeviceModelVersionNo']) {
      updated['DeviceModelVersionNo'] = updated['DeviceModelVersion'];
    }
    return new HttpHeaders(updated);
  }

  private buildParams(params?: Record<string, string | number | boolean>): HttpParams | undefined {
    if (!params) return undefined;
    const entries: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      entries[k] = String(v);
    }
    return new HttpParams({ fromObject: entries });
  }

  private getTargetUrl(path: string): string {
    const base = this.baseUrl();
    if (base.startsWith('https://fdmsapitest.zimra.co.zw')) {
      return `/api-test${path}`;
    }
    if (base.startsWith('https://fdmsapi.zimra.co.zw')) {
      return `/api-prod${path}`;
    }
    return `${base}${path}`;
  }

  get<T>(
    path: string,
    options?: { params?: Record<string, string | number | boolean>; headers?: Record<string, string>; context?: HttpContext }
  ): Observable<T> {
    const url = this.getTargetUrl(path);
    const params = this.buildParams(options?.params);
    const headers = this.buildHeaders(options?.headers);
    return this.http.get<T>(url, { params, headers, context: options?.context });
  }

  post<T>(
    path: string,
    body: unknown,
    options?: {
      headers?: Record<string, string>;
      params?: Record<string, string | number | boolean>;
      contentType?: string;
      context?: HttpContext;
    }
  ): Observable<T> {
    const url = this.getTargetUrl(path);
    const params = this.buildParams(options?.params);
    const headers = {
      'Content-Type': options?.contentType ?? 'application/json',
      ...(options?.headers ?? {}),
    };

    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      console.debug('[ApiService POST]', url, { headers, body });
    }

    return this.http.post<T>(url, body, { params, headers: this.buildHeaders(headers), context: options?.context });
  }
}

