import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  GetFileStatusRequest,
  GetFileStatusResponse,
  SubmitFileRequest,
  SubmitFileResponse,
} from '../models/api.models';
import { FdmsContextService } from './fdms-context.service';

@Injectable({ providedIn: 'root' })
export class FileService {
  private readonly api = inject(ApiService);
  private readonly fdmsContext = inject(FdmsContextService);

  submitFile(
    request: SubmitFileRequest
  ): Observable<SubmitFileResponse> {
    const { deviceID, file } = request;
    const headers = this.fdmsContext.getRequiredHeaders();
    return this.api.post<SubmitFileResponse>(`/Device/v1/${deviceID}/SubmitFile`, file, {
      contentType: 'text/plain',
      headers: {
        DeviceModelName: headers.deviceModelName,
        DeviceModelVersion: headers.deviceModelVersion,
      },
    });
  }

  getFileStatus(
    request: GetFileStatusRequest
  ): Observable<GetFileStatusResponse> {
    const { deviceID, operationID, fileUploadedFrom, fileUploadedTill } = request;
    const headers = this.fdmsContext.getRequiredHeaders();
    return this.api.get<GetFileStatusResponse>(`/Device/v1/${deviceID}/SubmittedFileList`, {
      headers: {
        DeviceModelName: headers.deviceModelName,
        DeviceModelVersion: headers.deviceModelVersion,
      },
      params: {
        ...(operationID !== undefined ? { OperationID: operationID } : {}),
        FileUploadedFrom: fileUploadedFrom,
        FileUploadedTill: fileUploadedTill,
      },
    });
  }
}

