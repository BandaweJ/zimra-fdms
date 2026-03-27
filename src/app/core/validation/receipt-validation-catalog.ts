import { ValidationColor } from '../models/api.models';

export type ReceiptValidationColor = 'white' | 'grey' | 'yellow' | 'red';

export interface ReceiptValidationErrorMeta {
  color: ReceiptValidationColor;
  text: string;
  requiresPrevious: boolean;
}

export const VALIDATION_ERRORS: Record<string, ReceiptValidationErrorMeta> = {
  RCPT010: { color: ValidationColor.Red, text: 'Wrong currency code is used', requiresPrevious: false },
  RCPT011: { color: ValidationColor.Red, text: 'Receipt counter is not sequential.', requiresPrevious: true },
  RCPT012: { color: ValidationColor.Red, text: 'Receipt global number is not sequential.', requiresPrevious: true },
  RCPT013: { color: ValidationColor.Red, text: 'Invoice number is not unique', requiresPrevious: false },
  RCPT014: {
    color: ValidationColor.Yellow,
    text: 'Receipt date is earlier than fiscal day opening date',
    requiresPrevious: false,
  },
  RCPT015: { color: ValidationColor.Red, text: 'Credited/debited invoice data is not provided', requiresPrevious: false },
  RCPT016: { color: ValidationColor.Red, text: 'No receipt lines provided', requiresPrevious: false },
  RCPT017: { color: ValidationColor.Red, text: 'Taxes information is not provided', requiresPrevious: false },
  RCPT018: { color: ValidationColor.Red, text: 'Payment information is not provided', requiresPrevious: false },
  RCPT019: {
    color: ValidationColor.Red,
    text: 'Invoice total amount is not equal to sum of all invoice lines',
    requiresPrevious: false,
  },
  RCPT020: { color: ValidationColor.Red, text: 'Invoice signature is not valid', requiresPrevious: false },
  RCPT021: {
    color: ValidationColor.Red,
    text: 'VAT tax is used in invoice while taxpayer is not VAT taxpayer',
    requiresPrevious: false,
  },
  RCPT022: {
    color: ValidationColor.Red,
    text: 'Invoice sales line price must be greater than 0 (less than 0 for Credit note), discount line price must be less than 0 for Invoice',
    requiresPrevious: false,
  },
  RCPT023: { color: ValidationColor.Red, text: 'Invoice line quantity, must be positive', requiresPrevious: false },
  RCPT024: {
    color: ValidationColor.Red,
    text: 'Invoice line total is not equal to unit price * quantity',
    requiresPrevious: false,
  },
  RCPT025: { color: ValidationColor.Red, text: 'Invalid tax is used', requiresPrevious: false },
  RCPT026: { color: ValidationColor.Red, text: 'Incorrectly calculated tax amount', requiresPrevious: false },
  RCPT027: {
    color: ValidationColor.Red,
    text: 'Incorrectly calculated total sales amount (including tax)',
    requiresPrevious: false,
  },
  RCPT028: {
    color: ValidationColor.Red,
    text: 'Payment amount must be greater than or equal 0 (less than or equal to 0 for Credit note)',
    requiresPrevious: false,
  },
  RCPT029: {
    color: ValidationColor.Red,
    text: 'Credited/debited invoice information provided for regular invoice',
    requiresPrevious: false,
  },
  RCPT030: {
    color: ValidationColor.Red,
    text: 'Invoice date is earlier than previously submitted receipt date',
    requiresPrevious: true,
  },
  RCPT031: { color: ValidationColor.Yellow, text: 'Invoice is submitted with the future date', requiresPrevious: false },
  RCPT032: { color: ValidationColor.Red, text: 'Credit / debit note refers to non-existing invoice', requiresPrevious: false },
  RCPT033: {
    color: ValidationColor.Red,
    text: 'Credited/debited invoice is issued more than 12 months ago',
    requiresPrevious: false,
  },
  RCPT034: { color: ValidationColor.Red, text: 'Note for credit/debit note is not provided', requiresPrevious: false },
  RCPT035: {
    color: ValidationColor.Red,
    text: 'Total credit note amount exceeds original invoice amount',
    requiresPrevious: false,
  },
  RCPT036: {
    color: ValidationColor.Red,
    text: 'Credit/debit note uses other taxes than are used in the original invoice',
    requiresPrevious: false,
  },
  RCPT037: {
    color: ValidationColor.Red,
    text: 'Invoice total amount is not equal to sum of all invoice lines and taxes applied',
    requiresPrevious: false,
  },
  RCPT038: {
    color: ValidationColor.Red,
    text: 'Invoice total amount is not equal to sum of sales amount including tax in tax table',
    requiresPrevious: false,
  },
  RCPT039: {
    color: ValidationColor.Red,
    text: 'Invoice total amount is not equal to sum of all payment amounts',
    requiresPrevious: false,
  },
  RCPT040: {
    color: ValidationColor.Red,
    text: 'Invoice total amount must be greater than or equal to 0 (less than or equal to 0 for Credit note)',
    requiresPrevious: false,
  },
  RCPT041: { color: ValidationColor.Yellow, text: 'Invoice is issued after fiscal day end', requiresPrevious: false },
  RCPT042: {
    color: ValidationColor.Red,
    text: 'Credit/debit note uses other currency than is used in the original invoice',
    requiresPrevious: false,
  },
  RCPT043: { color: ValidationColor.Red, text: 'Mandatory buyer data fields are not provided', requiresPrevious: false },
  RCPT044: { color: ValidationColor.Red, text: 'Reserved/undocumented validation code in current v7.2 table (RCPT044).', requiresPrevious: false },
  RCPT045: { color: ValidationColor.Red, text: 'Reserved/undocumented validation code in current v7.2 table (RCPT045).', requiresPrevious: false },
  RCPT046: { color: ValidationColor.Red, text: 'Reserved/undocumented validation code in current v7.2 table (RCPT046).', requiresPrevious: false },
  RCPT047: { color: ValidationColor.Red, text: 'HS code must be sent if taxpayer is a VAT payer', requiresPrevious: false },
  RCPT048: {
    color: ValidationColor.Red,
    text: 'HS code length must be 4 or 8 digits if taxpayer is not VAT payer, 4 or 8 digits if taxpayer is VAT payer and applied tax percent is bigger than 0, 8 digits if taxpayer is VAT payer and applied tax percent is equal to 0 or is empty',
    requiresPrevious: false,
  },
  RCPT049: { color: ValidationColor.Red, text: 'Reserved/undocumented validation code in current v7.2 table (RCPT049).', requiresPrevious: false },
  RCPT050: { color: ValidationColor.Red, text: 'Reserved/undocumented validation code in current v7.2 table (RCPT050).', requiresPrevious: false },
  RCPT051: { color: ValidationColor.Red, text: 'Reserved/undocumented validation code in current v7.2 table (RCPT051).', requiresPrevious: false },
  RCPT052: { color: ValidationColor.Red, text: 'Reserved/undocumented validation code in current v7.2 table (RCPT052).', requiresPrevious: false },
  RCPT053: { color: ValidationColor.Red, text: 'Reserved/undocumented validation code in current v7.2 table (RCPT053).', requiresPrevious: false },
  RCPT054: { color: ValidationColor.Red, text: 'Reserved/undocumented validation code in current v7.2 table (RCPT054).', requiresPrevious: false },
  RCPT055: { color: ValidationColor.Red, text: 'Reserved/undocumented validation code in current v7.2 table (RCPT055).', requiresPrevious: false },
  RCPT056: { color: ValidationColor.Red, text: 'Reserved/undocumented validation code in current v7.2 table (RCPT056).', requiresPrevious: false },
  RCPT057: { color: ValidationColor.Red, text: 'Reserved/undocumented validation code in current v7.2 table (RCPT057).', requiresPrevious: false },
};

export function getValidationErrorMeta(code: string): ReceiptValidationErrorMeta {
  const c = (code || '').trim().toUpperCase();
  return (
    VALIDATION_ERRORS[c] ?? {
      color: ValidationColor.Red,
      text: `Unknown receipt validation error (${c || 'N/A'}).`,
      requiresPrevious: false,
    }
  );
}

export function isFiscalDayCloseBlockedByColor(color: ReceiptValidationColor): boolean {
  // Yellow/white warnings are non-blocking. Grey/red are blocking.
  return color === 'red' || color === 'grey';
}

export function resolveValidationColorFromCodes(codes: string[]): ReceiptValidationColor {
  if (!codes.length) return 'white';
  let hasGrey = false;
  let hasYellow = false;
  for (const code of codes) {
    const c = getValidationErrorMeta(code).color;
    if (c === ValidationColor.Red) return ValidationColor.Red;
    if (c === ValidationColor.Grey) hasGrey = true;
    if (c === ValidationColor.Yellow) hasYellow = true;
  }
  if (hasGrey) return ValidationColor.Grey;
  if (hasYellow) return ValidationColor.Yellow;
  return 'white';
}

export function extractRcptValidationCodes(input: unknown): string[] {
  const root = input as any;
  const out = new Set<string>();
  const maybePush = (v: unknown): void => {
    if (typeof v !== 'string') return;
    const m = v.toUpperCase().match(/RCPT\d{3}/g);
    if (!m) return;
    for (const code of m) out.add(code);
  };

  // Direct candidates
  maybePush(root?.errorCode);
  maybePush(root?.receiptErrorCode);
  maybePush(root?.validationErrorCode);
  maybePush(root?.message);
  maybePush(root?.title);
  maybePush(root?.detail);

  // Array candidates
  const arrays = [root?.errors, root?.validationErrors, root?.receiptErrors, root?.issues];
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const e of arr) {
      maybePush(e);
      maybePush(e?.code);
      maybePush(e?.errorCode);
      maybePush(e?.message);
      maybePush(e?.detail);
    }
  }

  // Generic JSON scan fallback
  try {
    maybePush(JSON.stringify(root));
  } catch {
    // ignore
  }
  return [...out];
}

