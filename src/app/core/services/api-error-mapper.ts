import type { ToastVariant } from '../../shared/components/ui/toast.component';

export type MappedApiError = {
  code?: string;
  message: string;
  variant: ToastVariant;
};

function normalizeCode(code?: string): string | undefined {
  if (!code) return undefined;
  const c = String(code).trim();
  return c || undefined;
}

export function mapApiErrorCode(code: string | undefined, opts?: { httpStatus?: number }): MappedApiError {
  const c = normalizeCode(code);
  if (!c) {
    return {
      message: opts?.httpStatus ? `Request failed (HTTP ${opts.httpStatus}).` : 'Request failed. Please try again.',
      variant: 'error',
    };
  }

  // ---- DEV01–DEV15 ----
  if (c.startsWith('DEV')) {
    switch (c) {
      case 'DEV01':
        return { code: c, message: 'DEV01: Device error. Verify device registration and try again.', variant: 'error' };
      case 'DEV03':
        return { code: c, message: 'DEV03: Device configuration problem. Re-check setup/config and retry.', variant: 'error' };
      case 'DEV04':
        return { code: c, message: 'DEV04: Device/user authentication issue. Log in again (if required) and retry.', variant: 'error' };
      case 'DEV05':
        return { code: c, message: 'DEV05: Device not authorized. Verify device model headers and credentials.', variant: 'error' };
      case 'DEV06':
        return { code: c, message: 'DEV06: Activation/verification failed. Re-verify your setup in Setup and retry.', variant: 'error' };
      case 'DEV07':
        return { code: c, message: 'DEV07: Resource not found. Refresh device/user context and retry.', variant: 'error' };
      case 'DEV02':
        return { code: c, message: 'DEV02: Activation Key is incorrect. Verify and try again.', variant: 'error' };
      case 'DEV08':
        return { code: c, message: 'DEV08: User not found or inactive.', variant: 'error' };
      case 'DEV09':
        return { code: c, message: 'DEV09: Invalid security code.', variant: 'error' };
      case 'DEV10':
        return { code: c, message: 'DEV10: Password complexity requirements not met.', variant: 'error' };
      case 'DEV11':
        return { code: c, message: 'DEV11: Wrong username/password.', variant: 'error' };
      case 'DEV12':
        return { code: c, message: 'DEV12: Bad token / authentication required.', variant: 'error' };
      case 'DEV13':
        return { code: c, message: 'DEV13: User not confirmed. Complete the create/confirm flow.', variant: 'warning' };
      case 'DEV14':
        return { code: c, message: 'DEV14: Invalid contact value.', variant: 'error' };
      case 'DEV15':
        return { code: c, message: 'DEV15: Already confirmed.', variant: 'info' };
      default:
        return { code: c, message: `${c}: Device/User error. Please review input and retry.`, variant: 'error' };
    }
  }

  // ---- RCPT01–RCPT02 (spec range) + known UI codes ----
  if (c.startsWith('RCPT')) {
    switch (c) {
      case 'RCPT01':
        return { code: c, message: 'RCPT01: Receipt submission failed. Verify receipt type/currency and required fields.', variant: 'error' };
      case 'RCPT02':
        return { code: c, message: 'RCPT02: Receipt validation failed. Check taxes, totals, and payment sum.', variant: 'error' };
      case 'RCPT039':
        return { code: c, message: 'RCPT039: Sum of payments must equal receipt total.', variant: 'error' };
      case 'RCPT043':
        return { code: c, message: 'RCPT043: Buyer register name and buyer TIN must be provided together.', variant: 'error' };
      default:
        return { code: c, message: `${c}: Receipt submission failed. Review receipt data and retry.`, variant: 'error' };
    }
  }

  // ---- FISC01 / FISC03 / FISC04 ----
  if (c.startsWith('FISC')) {
    switch (c) {
      case 'FISC01':
        return { code: c, message: 'FISC01: Fiscal day close failed (certificate signature). Renew device certificate and retry.', variant: 'error' };
      case 'FISC03':
        return { code: c, message: 'FISC03: Fiscal day close failed (missing receipts). Ensure all receipts are submitted/processed and retry.', variant: 'error' };
      case 'FISC04':
        return { code: c, message: 'FISC04: Fiscal day close failed (counters mismatch). Re-check counters/totals and retry.', variant: 'error' };
      default:
        return { code: c, message: `${c}: Fiscal day operation failed. Check day data and retry.`, variant: 'error' };
    }
  }

  // ---- FILE01–FILE05 ----
  if (c.startsWith('FILE')) {
    switch (c) {
      case 'FILE01':
        return { code: c, message: 'FILE01: File format incorrect. Verify header/content/footer and encoding.', variant: 'error' };
      case 'FILE02':
        return { code: c, message: 'FILE02: File rejected (day not in correct state). Ensure fiscal day is closed/open as required and retry.', variant: 'error' };
      case 'FILE03':
        return { code: c, message: 'FILE03: File close failed (certificate signature). Renew device certificate and retry.', variant: 'error' };
      case 'FILE04':
        return { code: c, message: 'FILE04: File processing failed (missing receipts). Ensure receipts are queued/submitted and retry.', variant: 'error' };
      case 'FILE05':
        return { code: c, message: 'FILE05: File processing failed (receipt validation/counters). Fix validation errors, then retry file submission.', variant: 'error' };
      default:
        return { code: c, message: `${c}: Offline file submission failed. Review file parts/sequence and retry.`, variant: 'error' };
    }
  }

  return { code: c, message: `${c}: Request failed. Please retry.`, variant: 'error' };
}

