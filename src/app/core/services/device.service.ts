import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { FdmsContextService } from './fdms-context.service';
import {
  RegisterDeviceRequest,
  RegisterDeviceResponse,
  VerifyTaxpayerInformationRequest,
  VerifyTaxpayerInformationResponse,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class DeviceService {
  private readonly api = inject(ApiService);
  private readonly fdmsContext = inject(FdmsContextService);

  registerDevice(
    request: RegisterDeviceRequest
  ): Observable<RegisterDeviceResponse> {
    const { deviceID, activationKey, certificateRequest } = request;
    const headers = this.fdmsContext.getRequiredHeaders();
    return this.api.post<RegisterDeviceResponse>(`/Public/v1/${deviceID}/RegisterDevice`, { activationKey, certificateRequest }, {
      headers: {
        DeviceModelName: headers.deviceModelName,
        DeviceModelVersion: headers.deviceModelVersion,
      },
    });
  }

  verifyTaxpayerInformation(
    request: VerifyTaxpayerInformationRequest
  ): Observable<VerifyTaxpayerInformationResponse> {
    const { deviceID, activationKey, deviceSerialNo } = request;
    const headers = this.fdmsContext.getRequiredHeaders();
    return this.api.post<VerifyTaxpayerInformationResponse>(
      `/Public/v1/${deviceID}/VerifyTaxpayerInformation`,
      { activationKey, deviceSerialNo },
      {
        headers: {
          DeviceModelName: headers.deviceModelName,
          DeviceModelVersion: headers.deviceModelVersion,
        },
      }
    );
  }
}

