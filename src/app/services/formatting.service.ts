import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FormattingService {

  /**
   * Safe decimal precision mapping by ISO Currency Code.
   * Based on ISO 4217 minor unit definitions.
   */
  private readonly currencyDecimals: Record<string, number> = {
    'EUR': 2, 'USD': 2, 'GBP': 2, 'JPY': 0, 'CHF': 2, 'CAD': 2, 'AUD': 2, 
    'NZD': 2, 'HKD': 2, 'SGD': 2, 'CNY': 2, 'AED': 2, 'SAR': 2, 'KWD': 3, 
    'BHD': 3, 'OMR': 3, 'JOD': 3, 'TND': 3, 'LYD': 3, 'IQD': 3, 'CLF': 4,
    'BIF': 0, 'CLP': 0, 'DJF': 0, 'GNF': 0, 'ISK': 0, 'KMF': 0, 'KRW': 0,
    'PYG': 0, 'RWF': 0, 'UGX': 0, 'VUV': 0, 'XAF': 0, 'XOF': 0, 'XPF': 0
  };

  /**
   * Standardizes amount formatting across all XML messages.
   * Ensures consistent decimal precision based on currency minor units.
   * 
   * @param amount The numeric or string value of the amount
   * @param currency The ISO currency code (e.g., 'USD', 'EUR')
   * @returns Formatted string (e.g., "1500.00")
   */
  formatAmount(amount: any, currency: string): string {
    if (amount === null || amount === undefined || amount === '') return '';
    
    // Convert to number safely
    const num = typeof amount === 'number' ? amount : parseFloat(amount.toString().replace(/,/g, ''));
    if (isNaN(num)) return amount.toString();

    const decimals = this.getDecimalCount(currency);
    return num.toFixed(decimals);
  }

  /**
   * Returns the minor unit (decimal places) for a given currency.
   * Defaults to 2 if unknown.
   */
  getDecimalCount(currency: string): number {
    if (!currency) return 2;
    const ccy = currency.toUpperCase();
    return this.currencyDecimals[ccy] !== undefined ? this.currencyDecimals[ccy] : 2;
  }
}
