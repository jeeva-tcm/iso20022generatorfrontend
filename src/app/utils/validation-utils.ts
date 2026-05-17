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
  if (errors['future_date']) {
    return 'Date cannot be in future';
  }

  return 'Invalid value';
}
