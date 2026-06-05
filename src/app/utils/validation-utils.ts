import { AbstractControl } from '@angular/forms';

/**
 * Standardized validation error message handler.
 * Returns a single prioritized error message for a given control.
 */
export function getValidationErrorMessage(control: AbstractControl | null, fieldName: string): string | null {
  if (!control || control.valid) return null;
  
  // Only show errors if touched or dirty (standard Angular behavior)
  if (control.pristine && !control.touched) return null;

  const errors = control.errors;
  if (!errors) return null;

  // 1. Prioritize 'required'
  if (errors['required']) {
    return 'Field is required';
  }

  // 2. Max length
  if (errors['maxlength']) {
    return `Maximum length exceeded`;
  }

  // 3. Pattern / Format errors
  if (errors['pattern']) {
    const fl = fieldName.toLowerCase();
    if (fl.includes('bic')) return 'Valid 8 or 11-character BIC required';
    if (fl.includes('iban')) return 'Valid IBAN required';
    if (fl.includes('uetr')) return 'Invalid UETR format';
    if (fl.includes('amount') || fl.includes('amt')) return 'Invalid amount format';
    if (fl.includes('lei')) return 'Must be 20-character LEI';
    if (fl.includes('id') && !fl.includes('uetr')) return 'Invalid format (Alpha-numeric only)';
    if (fl.includes('name') || fl.includes('nm')) return 'Invalid characters in name';
    
    return 'Invalid format';
  }

  // 4. Custom errors
  if (errors['iban']) {
    return errors['iban'].message || 'Valid IBAN required';
  }
  if (errors['future_date']) {
    return 'Date cannot be in future';
  }

  return 'Invalid value';
}

/**
 * Country-specific IBAN lengths (SWIFT Registry Edition 2024).
 */
export const IBAN_LENGTHS: { [key: string]: number } = {
  'AD': 24, 'AE': 23, 'AL': 28, 'AT': 20, 'AZ': 28,
  'BA': 20, 'BE': 16, 'BF': 28, 'BG': 22, 'BH': 22, 'BI': 27, 'BJ': 28, 'BR': 29, 'BY': 28,
  'CF': 27, 'CG': 27, 'CH': 21, 'CI': 28, 'CM': 27, 'CR': 22, 'CV': 25, 'CY': 28, 'CZ': 24,
  'DE': 22, 'DJ': 27, 'DK': 18, 'DO': 28, 'DZ': 26,
  'EE': 20, 'EG': 29, 'ES': 24,
  'FI': 18, 'FK': 18, 'FO': 18, 'FR': 27,
  'GA': 27, 'GB': 22, 'GE': 22, 'GI': 23, 'GL': 18, 'GN': 26, 'GQ': 27, 'GR': 27, 'GT': 28, 'GW': 25,
  'HN': 28, 'HR': 21, 'HU': 28,
  'IE': 22, 'IL': 23, 'IQ': 23, 'IR': 26, 'IS': 26, 'IT': 27,
  'JO': 30,
  'KM': 27, 'KW': 30, 'KZ': 20,
  'LB': 28, 'LC': 32, 'LI': 21, 'LT': 20, 'LU': 20, 'LV': 21, 'LY': 25,
  'MA': 28, 'MC': 27, 'MD': 24, 'ME': 22, 'MG': 27, 'MK': 19, 'ML': 28, 'MN': 20, 'MR': 27, 'MT': 31, 'MU': 30, 'MZ': 25,
  'NE': 28, 'NI': 32, 'NL': 18, 'NO': 15, 'NZ': 16,
  'OM': 23,
  'PK': 24, 'PL': 28, 'PS': 29, 'PT': 25,
  'QA': 29,
  'RO': 24, 'RS': 22, 'RU': 33,
  'SA': 24, 'SC': 31, 'SD': 18, 'SE': 24, 'SI': 19, 'SK': 24, 'SM': 27, 'SN': 28, 'SO': 23, 'ST': 25, 'SV': 28,
  'TD': 27, 'TG': 28, 'TL': 23, 'TN': 24, 'TR': 26,
  'UA': 29,
  'VA': 22, 'VG': 24,
  'XK': 20,
  'YE': 30,
};

/**
 * Robust IBAN validator for Angular Forms.
 */
export function ibanValidator(control: AbstractControl): { [key: string]: any } | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') return null;

  const cleanVal = String(value).trim().replace(/\s/g, '');
  if (!cleanVal) return null;

  const uppercaseVal = cleanVal.toUpperCase();
  if (cleanVal !== uppercaseVal) {
    return { iban: { message: 'IBAN must be in uppercase' } };
  }

  if (cleanVal.length < 15 || cleanVal.length > 34) {
    return { iban: { message: `IBAN length must be between 15 and 34 (current: ${cleanVal.length})` } };
  }

  const IBAN_PATTERN = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;
  if (!IBAN_PATTERN.test(cleanVal)) {
    if (!/^[A-Z]{2}/.test(cleanVal)) {
      return { iban: { message: 'IBAN must start with a 2-letter country code' } };
    }
    if (!/^[A-Z]{2}[0-9]{2}/.test(cleanVal)) {
      return { iban: { message: 'IBAN must have 2 check digits after the country code' } };
    }
    return { iban: { message: 'IBAN contains invalid characters (alphanumeric only)' } };
  }

  const country = cleanVal.substring(0, 2);
  const expectedLen = IBAN_LENGTHS[country];
  if (!expectedLen) {
    return { iban: { message: `Country code '${country}' does not participate in the IBAN scheme` } };
  }

  if (cleanVal.length !== expectedLen) {
    return { iban: { message: `${country} IBAN must be exactly ${expectedLen} characters` } };
  }

  // Modulo 97 calculation
  const rearranged = cleanVal.substring(4) + cleanVal.substring(0, 4);
  let numericStr = '';
  for (let i = 0; i < rearranged.length; i++) {
    const c = rearranged[i];
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      numericStr += (code - 55).toString();
    } else {
      numericStr += c;
    }
  }

  let remainder = 0;
  for (let i = 0; i < numericStr.length; i++) {
    remainder = (remainder * 10 + parseInt(numericStr[i], 10)) % 97;
  }

  if (remainder !== 1) {
    return { iban: { message: 'Invalid IBAN checksum (MOD-97 check failed)' } };
  }

  return null;
}

