// FDMS Fiscal Device Gateway API v7.2 models.
// Note: JSON transport format may represent enums as strings (e.g. "Cash") while
// the enum numeric values are defined by the spec "Enum value / Enum order" tables.
// These types model the spec-defined enum numeric order for compile-time safety.

// Enums (spec section 5.4)
export enum DeviceOperatingMode {
  Online = 0,
  Offline = 1,
}

export enum FiscalDayStatus {
  FiscalDayClosed = 0,
  FiscalDayOpened = 1,
  FiscalDayCloseInitiated = 2,
  FiscalDayCloseFailed = 3,
}

export enum FiscalDayReconciliationMode {
  Auto = 0,
  Manual = 1,
}

export enum FiscalCounterType {
  SaleByTax = 0,
  SaleTaxByTax = 1,
  CreditNoteByTax = 2,
  CreditNoteTaxByTax = 3,
  DebitNoteByTax = 4,
  DebitNoteTaxByTax = 5,
  BalanceByMoneyType = 6,
}

export enum MoneyType {
  Cash = 0,
  Card = 1,
  MobileWallet = 2,
  Coupon = 3,
  Credit = 4,
  BankTransfer = 5,
  Other = 6,
}

export enum ReceiptType {
  FiscalInvoice = 0,
  CreditNote = 1,
  DebitNote = 2,
}

export enum ReceiptLineType {
  Sale = 0,
  Discount = 1,
}

export enum ReceiptPrintForm {
  Receipt48 = 0,
  InvoiceA4 = 1,
}

export enum FiscalDayProcessingError {
  BadCertificateSignature = 0,
  MissingReceipts = 1,
  ReceiptsWithValidationErrors = 2,
  CountersMismatch = 3,
}

export enum FileProcessingStatus {
  FileProcessingInProgress = 0,
  FileProcessingIsSuccessful = 1,
  FileProcessingWithErrors = 2,
  WaitingForPreviousFile = 3,
}

export enum FileProcessingError {
  IncorrectFileFormat = 0,
  FileSentForClosedDay = 1,
  BadCertificateSignature = 2,
  MissingReceipts = 3,
  ReceiptsWithValidationErrors = 4,
  CountersMismatch = 5,
  FileExceededAllowedWaitingTime = 6,
}

export enum UserStatus {
  Active = 0,
  Blocked = 1,
  NotConfirmed = 2,
}

export enum SendSecurityCodeTo {
  Email = 0,
  PhoneNumber = 1,
}

export enum ValidationColor {
  Grey = 'grey',
  Yellow = 'yellow',
  Red = 'red',
}

// Shared objects
export interface Address {
  province: string;
  city: string;
  street: string;
  houseNo: string;
}

export interface Contacts {
  phoneNo?: string;
  email?: string;
}

export interface SignatureData {
  hash: string;
  signature: string;
}

export interface SignatureDataEx extends SignatureData {
  certificateThumbprint: string;
}

// Tax
export interface Tax {
  taxID: number;
  taxPercent?: number;
  taxName: string;
  taxValidFrom: string;
  taxValidTill?: string;
}

// Receipt objects
export interface Buyer {
  buyerRegisterName: string;
  buyerTradeName?: string;
  buyerTIN: string;
  VATNumber?: string;
  buyerContacts?: Contacts;
  buyerAddress?: Address;
}

export interface CreditDebitNote {
  receiptID?: number;
  deviceID?: number;
  receiptGlobalNo?: number;
  fiscalDayNo?: number;
}

export interface ReceiptLine {
  receiptLineType: ReceiptLineType;
  receiptLineNo: number;
  receiptLineHSCode?: string;
  receiptLineName: string;
  receiptLinePrice?: number;
  receiptLineQuantity: number;
  receiptLineTotal: number;
  taxCode?: string;
  taxPercent?: number;
  taxID: number;
}

export interface ReceiptTax {
  taxCode?: string;
  taxPercent?: number;
  taxID: number;
  taxAmount: number;
  salesAmountWithTax: number;
}

export interface Payment {
  moneyTypeCode: MoneyType;
  paymentAmount: number;
}

export interface Receipt {
  receiptType: ReceiptType;
  receiptCurrency: string;
  receiptCounter: number;
  receiptGlobalNo: number;
  invoiceNo: string;
  buyerData?: Buyer;
  receiptNotes?: string;
  receiptDate: string;
  creditDebitNote?: CreditDebitNote;
  receiptLinesTaxInclusive: boolean;
  receiptLines: ReceiptLine[];
  receiptTaxes: ReceiptTax[];
  receiptPayments: Payment[];
  receiptTotal: number;
  receiptPrintForm?: ReceiptPrintForm;
  receiptDeviceSignature: SignatureData;
  username?: string;
  userNameSurname?: string;
}

// Fiscal counters
export interface FiscalDayCounter {
  fiscalCounterType: FiscalCounterType;
  fiscalCounterCurrency: string;
  fiscalCounterTaxID?: number;
  fiscalCounterTaxPercent?: number;
  fiscalCounterMoneyType?: MoneyType;
  fiscalCounterValue: number;
}

export interface FiscalDayDocumentQuantity {
  receiptType: ReceiptType;
  receiptCurrency: string;
  receiptQuantity: number;
  receiptTotalAmount: number;
}

// File types (submitFile decoded payload)
export interface FileHeader {
  deviceID: number;
  fiscalDayNo: number;
  fiscalDayOpened: string;
  fileSequence: number;
}

export interface FileContent {
  receipts: Receipt[];
}

export interface FileFooter {
  fiscalDayCounters?: FiscalDayCounter[];
  fiscalDayDeviceSignature: SignatureData;
  receiptCounter: number;
  fiscalDayClosed: string;
}

export interface SubmitFile {
  header: FileHeader;
  content?: FileContent;
  footer?: FileFooter;
}

// Users
export interface User {
  userName: string;
  personName: string;
  personSurname: string;
  userRole: string;
  email: string;
  phoneNo: string;
}

export interface UserWithStatus extends User {
  userStatus: UserStatus;
}

// Errors (RFC7807 ProblemDetails, spec section 8)
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  errorCode?: string;
}

// Request/Response types for every endpoint (spec section 4)

export interface VerifyTaxpayerInformationRequest {
  deviceID: number;
  activationKey: string;
  deviceSerialNo: string;
}

export interface VerifyTaxpayerInformationResponse {
  operationID: string;
  taxPayerName: string;
  taxPayerTIN: string;
  vatNumber?: string;
  deviceBranchName: string;
  deviceBranchAddress: Address;
  deviceBranchContacts?: Contacts;
}

export interface RegisterDeviceRequest {
  deviceID: number;
  activationKey: string;
  certificateRequest: string;
}

export interface RegisterDeviceResponse {
  operationID: string;
  certificate: string;
}

export interface IssueCertificateRequest {
  deviceID: number;
  certificateRequest: string;
}

export interface IssueCertificateResponse {
  operationID: string;
  certificate: string;
}

export interface GetConfigRequest {
  deviceID: number;
}

export interface GetConfigResponse {
  operationID: string;
  taxPayerName: string;
  taxPayerTIN: string;
  vatNumber?: string;
  deviceSerialNo: string;
  deviceBranchName: string;
  deviceBranchAddress: Address;
  deviceBranchContacts?: Contacts;
  deviceOperatingMode: DeviceOperatingMode;
  taxPayerDayMaxHrs: number;
  taxpayerDayEndNotificationHrs: number;
  applicableTaxes: Tax[];
  certificateValidTill: string;
  qrUrl: string;
}

export interface GetStatusRequest {
  deviceID: number;
}

export interface GetStatusResponse {
  operationID: string;
  fiscalDayStatus: FiscalDayStatus;
  fiscalDayReconciliationMode?: FiscalDayReconciliationMode;
  fiscalDayServerSignature?: SignatureDataEx;
  fiscalDayClosed?: string;
  fiscalDayClosingErrorCode?: FiscalDayProcessingError;
  fiscalDayCounters?: FiscalDayCounter[];
  fiscalDayDocumentQuantities?: FiscalDayDocumentQuantity[];
  lastReceiptGlobalNo?: number;
  lastFiscalDayNo?: number;
}

export interface OpenDayRequest {
  deviceID: number;
  fiscalDayOpened: string;
  fiscalDayNo?: number;
}

export interface OpenDayResponse {
  operationID: string;
  fiscalDayNo: number;
}

export interface SubmitReceiptRequest {
  deviceID: number;
  receipt: Receipt;
}

export interface SubmitReceiptResponse {
  operationID: string;
  receiptID: number;
  serverDate: string;
  receiptServerSignature: SignatureDataEx;
}

export interface SubmitFileRequest {
  deviceID: number;
  // Base64 encoded file content (multipart/form-data "file" field).
  file: string;
}

export interface SubmitFileResponse {
  operationID: string;
  // Processing is asynchronous; status retrieved via getFileStatus.
}

// Submitted file header representation returned by `SubmittedFileList`.
// Swagger names mirror `SubmittedFileHeaderDto`.
export interface FileStatus {
  fileName?: string;
  fileUploadDate?: string;
  deviceId: number;
  dayNo: number;
  fiscalDayOpenedAt: string;
  fileSequence: number;
  fileProcessingDate?: string;
  fileProcessingStatus: FileProcessingStatus;
  fileProcessingError?: FileProcessingError[];
  operationId?: string;
  ipAddress?: string;
}

export interface GetFileStatusRequest {
  deviceID: number;
  operationID?: string;
  fileUploadedFrom: string;
  fileUploadedTill: string;
}

export interface GetFileStatusResponse {
  total: number;
  rows?: FileStatus[] | null;
}

export interface CloseDayRequest {
  deviceID: number;
  fiscalDayNo: number;
  fiscalDayCounters: FiscalDayCounter[];
  fiscalDayDeviceSignature: SignatureData;
  receiptCounter: number;
}

export interface CloseDayResponse {
  operationID: string;
}

export interface GetServerCertificateRequest {
  thumbprint?: string;
}

export interface GetServerCertificateResponse {
  certificate: string[];
  certificateValidTill: string;
}

export interface PingRequest {
  deviceID: number;
}

export interface PingResponse {
  operationID: string;
  reportingFrequency: number;
}

// 4.14 Users management
export interface GetUsersListRequest {
  deviceID: number;
}

export interface GetUsersListResponse {
  total: number;
  operationID: string;
  rows?: UserWithStatus[];
}

export interface LoginRequest {
  deviceID: number;
  userName: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  operationID: string;
}

export interface CreateUserBeginRequest {
  deviceID: number;
  userName: string;
  personName: string;
  personSurname: string;
  userRole: string;
}

export interface CreateUserBeginResponse {
  operationID: string;
}

export interface CreateUserConfirmRequest {
  deviceID: number;
  userName: string;
  securityCode: string;
  password: string;
}

export interface CreateUserConfirmResponse {
  user: User;
  jwtToken: string;
  operationID: string;
}

export interface SendSecurityCodeRequest {
  deviceID: number;
  userName: string;
}

export interface SendSecurityCodeResponse {
  operationID: string;
}

export interface SendSecurityCodeContactChangeRequest {
  deviceID: number;
  phoneNo?: string;
  userEmail?: string;
  token: string;
}

export interface SendSecurityCodeContactChangeResponse {
  operationID: string;
}

export interface ConfirmUserContactChangeRequest {
  deviceID: number;
  channel: SendSecurityCodeTo;
  securityCode: string;
  token: string;
}

export interface ConfirmUserContactChangeResponse {
  user: User;
  operationID: string;
}

export interface UpdateUserRequest {
  deviceID: number;
  userName: string;
  personName: string;
  personSurname: string;
  userRole: string;
  userStatus: UserStatus;
  token: string;
}

export interface UpdateUserResponse {
  operationID: string;
}

export interface ChangeUserPasswordRequest {
  deviceID: number;
  newPassword: string;
  oldPassword: string;
  token: string;
}

export interface ChangeUserPasswordResponse {
  user: User;
  token: string;
  operationID: string;
}

export interface ResetUserPasswordBeginRequest {
  deviceID: number;
  userName: string;
  channel: SendSecurityCodeTo;
}

export interface ResetUserPasswordBeginResponse {
  operationID: string;
}

export interface ResetUserPasswordConfirmRequest {
  deviceID: number;
  userName: string;
  newPassword: string;
  securityCode: string;
}

export interface ResetUserPasswordConfirmResponse {
  operationID: string;
  user: User;
  token: string;
}

// 4.15 getStockList
export interface GetStockListRequest {
  deviceID: number;
  hsCode?: string;
  goodName?: string;
  sort?: string;
  order?: string;
  offset: number;
  limit: number;
  operator?: string;
}

export interface Good {
  hsCode: string;
  goodName: string;
  quantity: number;
  taxPayerId: number;
  taxPayerName: string;
  branchId?: number;
  branchName?: string;
}

export interface GetStockListResponse {
  total: number;
  rows: Good[];
}

