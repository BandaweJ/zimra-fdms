import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { FdmsContextService } from './fdms-context.service';
import { StorageService } from './storage.service';
import {
  CloseDayRequest,
  CloseDayResponse,
  GetConfigRequest,
  GetConfigResponse,
  GetStatusRequest,
  GetStatusResponse,
  OpenDayRequest,
  OpenDayResponse,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class FiscalDayService {
  private readonly api = inject(ApiService);
  private readonly fdmsContext = inject(FdmsContextService);
  private readonly storage = inject(StorageService);

  getConfig(
    request: GetConfigRequest
  ): Observable<GetConfigResponse> {
    const { deviceID } = request;
    const headers = this.fdmsContext.getRequiredHeaders();
    return this.api.get<GetConfigResponse>(`/Device/v1/${deviceID}/GetConfig`, {
      headers: {
        DeviceModelName: headers.deviceModelName,
        DeviceModelVersion: headers.deviceModelVersion,
      },
    }).pipe(
      tap((cfg) => {
        void this.storage.saveDeviceConfig(deviceID, cfg);
      })
    );
  }

  getStatus(
    request: GetStatusRequest
  ): Observable<GetStatusResponse> {
    const { deviceID } = request;
    const headers = this.fdmsContext.getRequiredHeaders();
    return this.api.get<GetStatusResponse>(`/Device/v1/${deviceID}/GetStatus`, {
      headers: {
        DeviceModelName: headers.deviceModelName,
        DeviceModelVersion: headers.deviceModelVersion,
      },
    });
  }

  openDay(
    request: OpenDayRequest
  ): Observable<OpenDayResponse> {
    const { deviceID, fiscalDayOpened, fiscalDayNo } = request;
    const headers = this.fdmsContext.getRequiredHeaders();
    return this.api.post<OpenDayResponse>(
      `/Device/v1/${deviceID}/OpenDay`,
      { fiscalDayOpened, ...(fiscalDayNo !== undefined ? { fiscalDayNo } : {}) },
      {
        headers: {
          DeviceModelName: headers.deviceModelName,
          DeviceModelVersion: headers.deviceModelVersion,
        },
      }
    );
  }

  closeDay(
    request: CloseDayRequest
  ): Observable<CloseDayResponse> {
    const { deviceID, fiscalDayNo, fiscalDayCounters, fiscalDayDeviceSignature, receiptCounter } = request;
    const headers = this.fdmsContext.getRequiredHeaders();
    return this.api.post<CloseDayResponse>(
      `/Device/v1/${deviceID}/CloseDay`,
      { fiscalDayNo, fiscalDayCounters, fiscalDayDeviceSignature, receiptCounter },
      {
        headers: {
          DeviceModelName: headers.deviceModelName,
          DeviceModelVersion: headers.deviceModelVersion,
        },
      }
    );
  }
}

