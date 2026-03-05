import { Injectable } from '@angular/core';

export interface AddressIssue {
    ruleId: string;
    severity: 'FAIL' | 'WARN';
    field: string;
    message: string;
    valueSnippet?: string;
}

export interface AddressValidationResult {
    path: string; // XPath-like pointer
    status: 'PASS' | 'WARN' | 'FAIL';
    issues: AddressIssue[];
}

/**
 * Service implementing ISO 20022 address validation rules (ADR-01 .. ADR-10).
 * It can be used in any component or business layer to validate address objects
 * that follow the typical MX structure (e.g. { AdrLine1, AdrLine2, StrtNm, BldgNb, ... }).
 */
@Injectable({
    providedIn: 'root'
})
export class AddressValidatorService {
    // ----- Helper utilities -------------------------------------------------
    private isControlChar(str: string): boolean {
        // Allow CR (\r), LF (\n) and TAB (\t) – everything else in 0x00-0x1F is forbidden
        return /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(str);
    }

    private trim(value: any): string {
        return typeof value === 'string' ? value.trim() : '';
    }

    private maxLength(field: string): number {
        // Define max lengths per field according to the spec / XSD
        const map: { [key: string]: number } = {
            // Structured fields
            StrtNm: 70,
            BldgNb: 16,
            BldgNm: 70,
            PstCd: 16,
            TwnNm: 70,
            CtrySubDvsn: 35,
            DstrctNm: 35,
            Dept: 70,
            SubDept: 70,
            Flr: 70,
            PstBx: 16,
            Room: 70,
            Ctry: 2,
            // Unstructured lines
            AdrLine: 70
        };
        return map[field] || 0;
    }

    private getStructuredFields(address: any): { [key: string]: any } {
        const fields = ['StrtNm', 'BldgNb', 'BldgNm', 'PstCd', 'TwnNm', 'CtrySubDvsn', 'DstrctNm', 'Dept', 'SubDept', 'Flr', 'PstBx', 'Room', 'Ctry'];
        const result: { [key: string]: any } = {};
        fields.forEach(f => {
            if (address && address[f] !== undefined) {
                result[f] = address[f];
            }
        });
        return result;
    }

    private getAdrLines(address: any): string[] {
        const lines: string[] = [];
        if (!address) return lines;
        for (let i = 1; i <= 7; i++) {
            const key = `AdrLine${i}`;
            if (address[key] !== undefined && address[key] !== null) {
                lines.push(address[key]);
            }
        }
        return lines;
    }

    // ---------------------------------------------------------------------
    /**
     * Validate a single address instance.
     * @param address The address object (plain JS object) following the MX schema.
     * @param path    XPath‑like pointer to the address (e.g. '/CdtTrfTxInf/Dbtr/PstlAdr').
     */
    validateAddress(address: any, path: string = ''): AddressValidationResult {
        const issues: AddressIssue[] = [];
        const structured = this.getStructuredFields(address);
        const adrLines = this.getAdrLines(address);

        // ---------- ADR-01: At least one representation ----------
        const hasStructured = Object.values(structured).some(v => this.trim(v).length > 0);
        const hasAdrLine = adrLines.some(l => this.trim(l).length > 0);
        if (!hasStructured && !hasAdrLine) {
            issues.push({
                ruleId: 'ADR-01',
                severity: 'FAIL',
                field: '',
                message: 'Address must contain either an AdrLine or at least one structured component.',
            });
        }

        // ---------- ADR-02: Country code format ----------
        if (address && address['Ctry'] !== undefined) {
            const ctry = this.trim(address['Ctry']);
            if (ctry && !/^[A-Z]{2}$/.test(ctry)) {
                issues.push({
                    ruleId: 'ADR-02',
                    severity: 'FAIL',
                    field: 'Ctry',
                    message: 'Country must be ISO 3166‑1 alpha‑2 (2 uppercase letters).',
                    valueSnippet: ctry
                });
            }
        }

        // ---------- ADR-03: Mixing structured + unstructured ----------
        if (hasStructured && hasAdrLine) {
            issues.push({
                ruleId: 'ADR-03',
                severity: 'WARN',
                field: '',
                message: 'Both structured address fields and AdrLine elements are present; prefer one style.',
            });
        }

        // ---------- ADR-04: Control characters ----------
        const checkControl = (field: string, value: any) => {
            if (value && typeof value === 'string' && this.isControlChar(value)) {
                issues.push({
                    ruleId: 'ADR-04',
                    severity: 'FAIL',
                    field,
                    message: 'Address field contains prohibited control characters.',
                    valueSnippet: value
                });
            }
        };
        // Check structured fields
        Object.entries(structured).forEach(([field, val]) => checkControl(field, val));
        // Check AdrLine fields
        adrLines.forEach((line, idx) => checkControl(`AdrLine${idx + 1}`, line));

        // ---------- ADR-05: Trim + no empty strings ----------
        const checkEmpty = (field: string, value: any) => {
            if (value !== undefined && value !== null) {
                const trimmed = this.trim(value);
                if (trimmed.length === 0) {
                    issues.push({
                        ruleId: 'ADR-05',
                        severity: 'FAIL',
                        field,
                        message: 'Address field must not be empty after trimming.',
                        valueSnippet: String(value)
                    });
                }
            }
        };
        Object.entries(structured).forEach(([field, val]) => checkEmpty(field, val));
        adrLines.forEach((line, idx) => checkEmpty(`AdrLine${idx + 1}`, line));

        // ---------- ADR-06: Length constraints ----------
        const checkLength = (field: string, value: any) => {
            if (value !== undefined && value !== null) {
                const trimmed = this.trim(value);
                const max = this.maxLength(field);
                if (max && trimmed.length > max) {
                    issues.push({
                        ruleId: 'ADR-06',
                        severity: 'FAIL',
                        field,
                        message: `Field exceeds maximum length of ${max} characters.`,
                        valueSnippet: trimmed.substring(0, 30)
                    });
                }
            }
        };
        Object.entries(structured).forEach(([field, val]) => checkLength(field, val));
        adrLines.forEach((line, idx) => checkLength('AdrLine', line));
        // Limit number of AdrLine elements to 7 (already limited by extraction)
        if (adrLines.length > 7) {
            issues.push({
                ruleId: 'ADR-06',
                severity: 'FAIL',
                field: 'AdrLine',
                message: 'Too many AdrLine elements (maximum 7 allowed).',
            });
        }

        // ---------- ADR-07: Recommended fields (Ctry and TwnNm/AdrLine) ----------
        if (hasStructured || hasAdrLine) {
            if (!address['Ctry'] || this.trim(address['Ctry']).length === 0) {
                issues.push({
                    ruleId: 'ADR-07',
                    severity: 'WARN',
                    field: 'Ctry',
                    message: 'Country is recommended when an address is provided.',
                });
            }
            const hasTwnOrAdr = (address['TwnNm'] && this.trim(address['TwnNm']).length > 0) || hasAdrLine;
            if (!hasTwnOrAdr) {
                issues.push({
                    ruleId: 'ADR-07',
                    severity: 'WARN',
                    field: 'TwnNm/AdrLine',
                    message: 'Provide either a town name or an AdrLine for better STP.',
                });
            }
        }

        // ---------- ADR-08: Postal code format (optional, simple example) ----------
        if (address && address['PstCd']) {
            const pstCd = this.trim(address['PstCd']);
            const ctry = address['Ctry'] ? this.trim(address['Ctry']) : '';
            // Very simple country‑specific regexes for demo purposes
            const patterns: { [key: string]: RegExp } = {
                US: /^[0-9]{5}(-[0-9]{4})?$/,
                GB: /^[A-Z]{1,2}[0-9R][0-9A-Z]? ?[0-9][A-Z]{2}$/i,
                DE: /^[0-9]{5}$/,
                FR: /^[0-9]{5}$/,
                IN: /^[0-9]{6}$/
            };
            const regex = patterns[ctry];
            if (regex && !regex.test(pstCd)) {
                issues.push({
                    ruleId: 'ADR-08',
                    severity: 'WARN',
                    field: 'PstCd',
                    message: `Postal code does not match expected format for country ${ctry}.`,
                    valueSnippet: pstCd
                });
            }
        }

        // ---------- ADR-09: Country vs subdivision ----------
        if (address && address['CtrySubDvsn'] && (!address['Ctry'] || this.trim(address['Ctry']).length === 0)) {
            issues.push({
                ruleId: 'ADR-09',
                severity: 'WARN',
                field: 'CtrySubDvsn',
                message: 'Subdivision provided without a country code.',
                valueSnippet: this.trim(address['CtrySubDvsn'])
            });
        }

        // ---------- ADR-10: Duplicate AdrLine values ----------
        const normalizedLines = adrLines.map(l => this.trim(l).toLowerCase()).filter(l => l.length > 0);
        const duplicates = normalizedLines.filter((item, idx) => normalizedLines.indexOf(item) !== idx);
        if (duplicates.length > 0) {
            issues.push({
                ruleId: 'ADR-10',
                severity: 'WARN',
                field: 'AdrLine',
                message: 'Duplicate address lines detected.',
                valueSnippet: duplicates.join(', ')
            });
        }

        // Determine overall status
        let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
        if (issues.some(i => i.severity === 'FAIL')) {
            status = 'FAIL';
        } else if (issues.some(i => i.severity === 'WARN')) {
            status = 'WARN';
        }

        return {
            path,
            status,
            issues
        };
    }
}
