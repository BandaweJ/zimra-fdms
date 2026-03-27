import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { GetStockListRequest, GetStockListResponse } from '../models/api.models';
import { FdmsContextService } from './fdms-context.service';

@Injectable({ providedIn: 'root' })
export class StockService {
  private readonly api = inject(ApiService);
  private readonly fdmsContext = inject(FdmsContextService);

  getStockList(
    request: GetStockListRequest
  ): Observable<GetStockListResponse> {
    const { deviceID, hsCode, goodName, sort, order, offset, limit, operator } = request;
    const headers = this.fdmsContext.getRequiredHeaders();

    return this.api.get<GetStockListResponse>(`/ProductsStock/v1/${deviceID}/Search`, {
      headers: {
        DeviceModelName: headers.deviceModelName,
        DeviceModelVersion: headers.deviceModelVersion,
      },
      params: {
        ...(hsCode !== undefined ? { HsCode: hsCode } : {}),
        ...(goodName !== undefined ? { GoodName: goodName } : {}),
        ...(sort !== undefined ? { Sort: sort } : {}),
        ...(order !== undefined ? { Order: order } : {}),
        ...(operator !== undefined ? { Operator: operator } : {}),
        Offset: offset,
        Limit: limit,
      },
    });
  }
}

