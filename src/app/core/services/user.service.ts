import { Injectable, inject } from '@angular/core';
import { signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { FdmsContextService } from './fdms-context.service';
import {
  ChangeUserPasswordRequest,
  ChangeUserPasswordResponse,
  ConfirmUserContactChangeRequest,
  ConfirmUserContactChangeResponse,
  CreateUserBeginRequest,
  CreateUserBeginResponse,
  CreateUserConfirmRequest,
  CreateUserConfirmResponse,
  GetUsersListRequest,
  GetUsersListResponse,
  LoginRequest,
  LoginResponse,
  ResetUserPasswordBeginRequest,
  ResetUserPasswordBeginResponse,
  ResetUserPasswordConfirmRequest,
  ResetUserPasswordConfirmResponse,
  SendSecurityCodeContactChangeRequest,
  SendSecurityCodeContactChangeResponse,
  SendSecurityCodeRequest,
  SendSecurityCodeResponse,
  UpdateUserRequest,
  UpdateUserResponse,
  User,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiService);
  private readonly fdmsContext = inject(FdmsContextService);

  readonly token = signal<string>('');
  readonly currentUser = signal<User | null>(null);

  private headers(): Record<string, string> {
    const h = this.fdmsContext.getRequiredHeaders();
    return {
      DeviceModelName: h.deviceModelName,
      DeviceModelVersion: h.deviceModelVersion,
    };
  }

  getUsersList(request: GetUsersListRequest): Observable<GetUsersListResponse> {
    return this.api.get<GetUsersListResponse>(`/Device/v1/${request.deviceID}/GetUsersList`, { headers: this.headers() });
  }

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.api.post<LoginResponse>(
      `/Device/v1/${request.deviceID}/Login`,
      { userName: request.userName, password: request.password },
      { headers: this.headers() }
    );
  }

  createUserBegin(request: CreateUserBeginRequest): Observable<CreateUserBeginResponse> {
    return this.api.post<CreateUserBeginResponse>(
      `/Device/v1/${request.deviceID}/CreateUserBegin`,
      {
        userName: request.userName,
        personName: request.personName,
        personSurname: request.personSurname,
        userRole: request.userRole,
      },
      { headers: this.headers() }
    );
  }

  createUserConfirm(request: CreateUserConfirmRequest): Observable<CreateUserConfirmResponse> {
    return this.api.post<CreateUserConfirmResponse>(
      `/Device/v1/${request.deviceID}/CreateUserConfirm`,
      {
        userName: request.userName,
        securityCode: request.securityCode,
        password: request.password,
      },
      { headers: this.headers() }
    );
  }

  sendSecurityCode(request: SendSecurityCodeRequest): Observable<SendSecurityCodeResponse> {
    return this.api.post<SendSecurityCodeResponse>(
      `/Device/v1/${request.deviceID}/SendSecurityCode`,
      { userName: request.userName },
      { headers: this.headers() }
    );
  }

  sendSecurityCodeContactChange(
    request: SendSecurityCodeContactChangeRequest
  ): Observable<SendSecurityCodeContactChangeResponse> {
    return this.api.post<SendSecurityCodeContactChangeResponse>(
      `/Device/v1/${request.deviceID}/SendSecurityCodeContactChange`,
      {
        ...(request.phoneNo ? { phoneNo: request.phoneNo } : {}),
        ...(request.userEmail ? { userEmail: request.userEmail } : {}),
        token: request.token,
      },
      { headers: this.headers() }
    );
  }

  confirmUserContactChange(request: ConfirmUserContactChangeRequest): Observable<ConfirmUserContactChangeResponse> {
    return this.api.post<ConfirmUserContactChangeResponse>(
      `/Device/v1/${request.deviceID}/ConfirmUserContactChange`,
      {
        channel: request.channel,
        securityCode: request.securityCode,
        token: request.token,
      },
      { headers: this.headers() }
    );
  }

  updateUser(request: UpdateUserRequest): Observable<UpdateUserResponse> {
    return this.api.post<UpdateUserResponse>(
      `/Device/v1/${request.deviceID}/UpdateUser`,
      {
        userName: request.userName,
        personName: request.personName,
        personSurname: request.personSurname,
        userRole: request.userRole,
        userStatus: request.userStatus,
        token: request.token,
      },
      { headers: this.headers() }
    );
  }

  changeUserPassword(request: ChangeUserPasswordRequest): Observable<ChangeUserPasswordResponse> {
    return this.api.post<ChangeUserPasswordResponse>(
      `/Device/v1/${request.deviceID}/ChangeUserPassword`,
      {
        oldPassword: request.oldPassword,
        newPassword: request.newPassword,
        token: request.token,
      },
      { headers: this.headers() }
    );
  }

  resetUserPasswordBegin(request: ResetUserPasswordBeginRequest): Observable<ResetUserPasswordBeginResponse> {
    return this.api.post<ResetUserPasswordBeginResponse>(
      `/Device/v1/${request.deviceID}/ResetUserPasswordBegin`,
      {
        userName: request.userName,
        channel: request.channel,
      },
      { headers: this.headers() }
    );
  }

  resetUserPasswordConfirm(request: ResetUserPasswordConfirmRequest): Observable<ResetUserPasswordConfirmResponse> {
    return this.api.post<ResetUserPasswordConfirmResponse>(
      `/Device/v1/${request.deviceID}/ResetUserPasswordConfirm`,
      {
        userName: request.userName,
        securityCode: request.securityCode,
        newPassword: request.newPassword,
      },
      { headers: this.headers() }
    );
  }
}

