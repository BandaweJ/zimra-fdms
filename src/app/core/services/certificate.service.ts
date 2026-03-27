import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { FdmsContextService } from './fdms-context.service';
import {
  GetServerCertificateRequest,
  GetServerCertificateResponse,
  IssueCertificateRequest,
  IssueCertificateResponse,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class CertificateService {
  private readonly api = inject(ApiService);
  private readonly fdmsContext = inject(FdmsContextService);
  private readonly verificationCertKey = 'zimra:verification-cert-pem:v1';

  issueCertificate(
    request: IssueCertificateRequest
  ): Observable<IssueCertificateResponse> {
    const { deviceID, certificateRequest } = request;
    const headers = this.fdmsContext.getRequiredHeaders();
    return this.api.post<IssueCertificateResponse>(`/Device/v1/${deviceID}/IssueCertificate`, { certificateRequest }, {
      headers: {
        DeviceModelName: headers.deviceModelName,
        DeviceModelVersion: headers.deviceModelVersion,
      },
    });
  }

  getServerCertificate(
    request: GetServerCertificateRequest = {}
  ): Observable<GetServerCertificateResponse> {
    const params = request.thumbprint ? { thumbprint: request.thumbprint } : undefined;
    return this.api.get<GetServerCertificateResponse>(`/Public/v1/GetServerCertificate`, { params });
  }

  saveVerificationCertificatePem(pem: string): void {
    localStorage.setItem(this.verificationCertKey, pem);
  }

  getVerificationCertificatePem(): string {
    return localStorage.getItem(this.verificationCertKey) ?? '';
  }
}

