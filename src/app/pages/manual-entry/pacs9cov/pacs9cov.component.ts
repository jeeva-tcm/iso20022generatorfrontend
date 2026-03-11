import { CommonModule } from '@angular/common';
import { Component, OnInit, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ConfigService } from '../../../services/config.service';

@Component({
    selector: 'app-pacs9cov',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule, MatIconModule, MatSnackBarModule, MatTooltipModule],
    templateUrl: './pacs9cov.component.html',
    styleUrl: './pacs9cov.component.css'
})
export class Pacs9CovComponent implements OnInit {
    form!: FormGroup;
    generatedXml = '';
    currentTab: 'form' | 'preview' = 'form';
    editorLineCount: number[] = [];
    isParsingXml = false;

    // Undo/Redo History
    private xmlHistory: string[] = [];
    private xmlHistoryIdx = -1;
    private maxHistory = 50;
    private isInternalChange = false;

    currencies: string[] = [];
    countries: string[] = [];
    categoryPurposes: string[] = [];
    purposes: string[] = [];
    sttlmMethods = ['COVE'];

    agentPrefixes = ['instgAgt', 'instdAgt', 'dbtrFi', 'cdtrFi', 'dbtrAgt', 'cdtrAgt',
        'prvsInstgAgt1', 'prvsInstgAgt2', 'prvsInstgAgt3',
        'intrmyAgt1', 'intrmyAgt2', 'intrmyAgt3'];

    // COV address prefixes for UndrlygCstmrCdtTrf parties
    covPartyPrefixes = ['covDbtr', 'covCdtr', 'covUltmtDbtr', 'covUltmtCdtr'];

    instrForCdtrAgtCodes = ['', 'CHQB', 'HOLD', 'PHOB', 'TELB'];

    constructor(
        private fb: FormBuilder,
        private http: HttpClient,
        private config: ConfigService,
        private snackBar: MatSnackBar,
        private router: Router
    ) { }

    ngOnInit() {
        this.fetchCodelists();
        this.buildForm();
        this.generateXml();
        this.onEditorChange(this.generatedXml, true);
        // Auto-sync AppHdr Fr/To BICs with InstgAgt/InstdAgt
        this.form.get('fromBic')?.valueChanges.subscribe(v => {
            this.form.patchValue({ instgAgtBic: v }, { emitEvent: false });
        });
        this.form.get('toBic')?.valueChanges.subscribe(v => {
            this.form.patchValue({ instdAgtBic: v }, { emitEvent: false });
        });
        this.form.get('instgAgtBic')?.valueChanges.subscribe(v => {
            this.form.patchValue({ fromBic: v }, { emitEvent: false });
        });
        this.form.get('instdAgtBic')?.valueChanges.subscribe(v => {
            this.form.patchValue({ toBic: v }, { emitEvent: false });
        });
        // Track form changes for live XML update
        this.form.valueChanges.subscribe(() => {
            this.updateConditionalValidators();
            this.updateClearingSystemValidation();
            this.generateXml();
        });

        // Init history
        this.pushHistory();
    }

    private updateClearingSystemValidation() {
        const allPrefixes = [...this.agentPrefixes, ...this.covPartyPrefixes];
        const systems = allPrefixes.map(p => {
            const val = this.form.get(p + 'ClrSysCd')?.value || this.form.get(p + 'OrgClrSysCd')?.value;
            return val?.trim()?.toUpperCase();
        });

        const anyT2 = systems.includes('T2');
        const anyCHAPS = systems.includes('CHAPS');
        const currencyCtrl = this.form.get('currency');
        const ccy = currencyCtrl?.value;

        // T2 Validation
        if (anyT2 && ccy !== 'EUR' && ccy !== '') {
            if (!currencyCtrl?.hasError('target2')) {
                currencyCtrl?.setErrors({ ...currencyCtrl.errors, target2: true });
            }
        } else if (currencyCtrl?.hasError('target2')) {
            const errors = { ...currencyCtrl.errors };
            delete errors['target2'];
            currencyCtrl.setErrors(Object.keys(errors).length ? errors : null);
        }

        // CHAPS Validation
        if (anyCHAPS && ccy !== 'GBP' && ccy !== '') {
            if (!currencyCtrl?.hasError('chaps')) {
                currencyCtrl?.setErrors({ ...currencyCtrl.errors, chaps: true });
            }
        } else if (currencyCtrl?.hasError('chaps')) {
            const errors = { ...currencyCtrl.errors };
            delete errors['chaps'];
            currencyCtrl.setErrors(Object.keys(errors).length ? errors : null);
        }
    }

    fetchCodelists() {
        this.http.get<any>(this.config.getApiUrl('/codelists/currency')).subscribe({
            next: (res) => {
                if (res && res.codes) {
                    this.currencies = res.codes;
                }
            },
            error: (err) => console.error('Failed to load currencies', err)
        });
        this.http.get<any>(this.config.getApiUrl('/codelists/country')).subscribe({
            next: (res) => {
                if (res && res.codes) {
                    this.countries = res.codes;
                }
            },
            error: (err) => console.error('Failed to load countries', err)
        });

        this.http.get<any>(this.config.getApiUrl('/codelists/ctgyPurp')).subscribe({
            next: (res) => { if (res && res.codes) this.categoryPurposes = res.codes; },
            error: (err) => console.error('Failed to load category purposes', err)
        });
        this.http.get<any>(this.config.getApiUrl('/codelists/purp')).subscribe({
            next: (res) => { if (res && res.codes) this.purposes = res.codes; },
            error: (err) => console.error('Failed to load purposes', err)
        });

    }

    updateConditionalValidators() {
        const allPrefixes = [...this.agentPrefixes, ...this.covPartyPrefixes];
        allPrefixes.forEach(p => {
            const addrType = this.form.get(p + 'AddrType')?.value;
            const ctryCtrl = this.form.get(p + 'Ctry');
            const twnNmCtrl = this.form.get(p + 'TwnNm');

            if (addrType && addrType !== 'none') {
                if (!ctryCtrl?.hasValidator(Validators.required)) {
                    ctryCtrl?.setValidators([Validators.required, Validators.pattern(/^[A-Z]{2,2}$/)]);
                    ctryCtrl?.updateValueAndValidity({ emitEvent: false });
                }
            } else {
                if (ctryCtrl?.hasValidator(Validators.required)) {
                    ctryCtrl?.clearValidators();
                    ctryCtrl?.setValidators([Validators.pattern(/^[A-Z]{2,2}$/)]);
                    ctryCtrl?.updateValueAndValidity({ emitEvent: false });
                }
            }

            if (addrType === 'structured' || addrType === 'hybrid') {
                if (!twnNmCtrl?.hasValidator(Validators.required)) {
                    twnNmCtrl?.setValidators([Validators.required, Validators.maxLength(140)]);
                    twnNmCtrl?.updateValueAndValidity({ emitEvent: false });
                }
            } else {
                if (twnNmCtrl?.hasValidator(Validators.required)) {
                    twnNmCtrl?.clearValidators();
                    twnNmCtrl?.setValidators([Validators.maxLength(140)]);
                    twnNmCtrl?.updateValueAndValidity({ emitEvent: false });
                }
            }
        });
    }

    private buildForm() {
        const BIC = [Validators.required, Validators.pattern(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)];
        const BIC_OPT = [Validators.pattern(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)];
        // Safe character set: letters, digits, space, . , ( ) ' - only. No & @ ! # $ etc.
        const SAFE_NAME = Validators.pattern(/^[a-zA-Z0-9 .,()'\-]+$/);
        const c: any = {
            purpCd: [''], ctgyPurpCd: [''],

            rmtInfType: ['none'],
            rmtInfUstrd: ['', [Validators.maxLength(140), Validators.pattern(/^[0-9a-zA-Z\/\-\?:\(\)\.,\'\+ !#$%&\*=\^_`\{\|\}~";<>@\[\\\]]+$/)]],
            rmtInfStrdCdtrRefType: [''],
            rmtInfStrdCdtrRef: ['', Validators.maxLength(35)],
            rmtInfStrdAddtlRmtInf: ['', [Validators.maxLength(140), Validators.pattern(/^[0-9a-zA-Z\/\-\?:\(\)\.,\'\+ !#$%&\*=\^_`\{\|\}~";<>@\[\\\]]+$/)]],

            fromBic: ['RBOSGB2L', BIC], toBic: ['NDEAFIHH', BIC], bizMsgId: ['pacs9bizmsgidr01', Validators.required],
            msgId: ['pacs9bizmsgidr01', Validators.required], creDtTm: [this.isoNow(), Validators.required],
            nbOfTxs: ['1', [Validators.required, Validators.pattern(/^[1-9]\d{0,14}$/)]], sttlmMtd: ['COVE', Validators.required],
            instgAgtBic: ['RBOSGB2L', BIC], instdAgtBic: ['NDEAFIHH', BIC],
            instrId: ['pacs9bizmsgidr01', Validators.required], endToEndId: ['pacs8bizmsgidr01', Validators.required],
            uetr: ['8a562c67-ca16-48ba-b074-65581be6f001', [Validators.required, Validators.pattern(/^[0-9a-fA-F\-]{36}$/)]],
            amount: ['1500000', [Validators.required, Validators.pattern(/^\d{1,13}(\.\d{1,5})?$/)]], currency: ['EUR', Validators.required],
            sttlmDt: [new Date().toISOString().split('T')[0], Validators.required],
            // Debtor FI (required)
            dbtrFiBic: ['RBOSGB2L', BIC],
            // Debtor Agent (optional)
            dbtrAgtBic: ['NDEAFIHH', BIC_OPT],
            // Creditor Agent (optional)
            cdtrAgtBic: ['HELSFIHH', BIC_OPT],
            // Creditor FI (required)
            cdtrFiBic: ['OKOYFIHH', BIC],
            // Optional agents
            prvsInstgAgt1Bic: ['', BIC_OPT], prvsInstgAgt2Bic: ['', BIC_OPT], prvsInstgAgt3Bic: ['', BIC_OPT],
            intrmyAgt1Bic: ['', BIC_OPT], intrmyAgt2Bic: ['', BIC_OPT], intrmyAgt3Bic: ['', BIC_OPT],
            // COV — UndrlygCstmrCdtTrf fields
            covUltmtDbtrName: [''],
            covDbtrName: ['A Debiter', [Validators.maxLength(140), SAFE_NAME]],
            covDbtrAcct: ['R85236974'],
            covDbtrAgtBic: ['RBOSGB2L', BIC_OPT],
            covCdtrAgtBic: ['OKOYFIHH', BIC_OPT],
            covCdtrName: ['Z Krediter', [Validators.maxLength(140), SAFE_NAME]],
            covCdtrAcct: ['O96325478'],
            covUltmtCdtrName: [''],
            // InstrForCdtrAgt
            covInstrForCdtrAgtCd: [''],
            covInstrForCdtrAgtInstrInf: [''],
            // InstrForNxtAgt
            covInstrForNxtAgtInstrInf: [''],
            // RmtInf (Ustrd)
            covRmtInfUstrd: [''],
            // InstdAmt
            covInstdAmtCcy: ['EUR'],
            covInstdAmt: [''],
        };
        // Address prefixes for main agents
        this.agentPrefixes.forEach(p => {
            c[p + 'AddrType'] = 'none'; c[p + 'AdrLine1'] = ['', Validators.maxLength(70)]; c[p + 'AdrLine2'] = ['', Validators.maxLength(70)];
            c[p + 'Dept'] = ['', Validators.maxLength(70)]; c[p + 'SubDept'] = ['', Validators.maxLength(70)];
            c[p + 'StrtNm'] = ['', Validators.maxLength(140)]; c[p + 'BldgNb'] = ['', Validators.maxLength(16)]; c[p + 'BldgNm'] = ['', Validators.maxLength(140)];
            c[p + 'Flr'] = ['', Validators.maxLength(70)]; c[p + 'PstBx'] = ['', Validators.maxLength(16)]; c[p + 'Room'] = ['', Validators.maxLength(70)];
            c[p + 'PstCd'] = ['', Validators.maxLength(16)]; c[p + 'TwnNm'] = ['', Validators.maxLength(140)]; c[p + 'CtrySubDvsn'] = ['', Validators.maxLength(35)]; c[p + 'Ctry'] = ['', Validators.pattern(/^[A-Z]{2,2}$/)];
            c[p + 'TwnLctnNm'] = ['', Validators.maxLength(140)]; c[p + 'DstrctNm'] = ['', Validators.maxLength(140)]; c[p + 'AdrTpCd'] = ['']; c[p + 'AdrTpPrtry'] = ['', Validators.maxLength(35)];
            c[p + 'Name'] = ['', [Validators.maxLength(140), SAFE_NAME]];
            c[p + 'Lei'] = ['', [Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)]];
            c[p + 'ClrSysCd'] = ['', Validators.maxLength(4)];
            c[p + 'ClrSysMmbId'] = ['', Validators.maxLength(35)];
            c[p + 'Acct'] = ['', [Validators.pattern(/^[A-Z0-9]{5,34}$/)]];
        });
        // Address prefixes for COV parties (Debtor / Creditor in UndrlygCstmrCdtTrf)
        this.covPartyPrefixes.forEach(p => {
            c[p + 'AddrType'] = 'none'; c[p + 'AdrLine1'] = ['', Validators.maxLength(70)]; c[p + 'AdrLine2'] = ['', Validators.maxLength(70)];
            c[p + 'Dept'] = ['', Validators.maxLength(70)]; c[p + 'SubDept'] = ['', Validators.maxLength(70)];
            c[p + 'StrtNm'] = ['', Validators.maxLength(140)]; c[p + 'BldgNb'] = ['', Validators.maxLength(16)]; c[p + 'BldgNm'] = ['', Validators.maxLength(140)];
            c[p + 'Flr'] = ['', Validators.maxLength(70)]; c[p + 'PstBx'] = ['', Validators.maxLength(16)]; c[p + 'Room'] = ['', Validators.maxLength(70)];
            c[p + 'PstCd'] = ['', Validators.maxLength(16)]; c[p + 'TwnNm'] = ['', Validators.maxLength(140)]; c[p + 'CtrySubDvsn'] = ['', Validators.maxLength(35)]; c[p + 'Ctry'] = ['', Validators.pattern(/^[A-Z]{2,2}$/)];
            c[p + 'TwnLctnNm'] = ['', Validators.maxLength(140)]; c[p + 'DstrctNm'] = ['', Validators.maxLength(140)]; c[p + 'AdrTpCd'] = ['']; c[p + 'AdrTpPrtry'] = ['', Validators.maxLength(35)];

            c[p + 'TwnLctnNm'] = ['', Validators.maxLength(140)]; c[p + 'DstrctNm'] = ['', Validators.maxLength(140)]; c[p + 'AdrTpCd'] = ['']; c[p + 'AdrTpPrtry'] = ['', Validators.maxLength(35)];

            if (p === 'covUltmtDbtr' || p === 'covUltmtCdtr') {
                c[p + 'IdType'] = 'none';
                c[p + 'OrgAnyBIC'] = ['', [Validators.pattern(/^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)]];
                c[p + 'OrgLEI'] = ['', [Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)]];
                c[p + 'OrgOthrId'] = ['', Validators.maxLength(35)];
                c[p + 'OrgOthrSchmeNmCd'] = ['', Validators.maxLength(4)]; c[p + 'OrgOthrSchmeNmPrtry'] = ['', Validators.maxLength(35)]; c[p + 'OrgOthrIssr'] = ['', Validators.maxLength(35)];
                c[p + 'PrvtDtAndPlcOfBirthDt'] = [''];
                c[p + 'PrvtDtAndPlcOfBirthPrvc'] = ['', Validators.maxLength(35)];
                c[p + 'PrvtDtAndPlcOfBirthCity'] = ['', Validators.maxLength(35)];
                c[p + 'PrvtDtAndPlcOfBirthCtry'] = ['', Validators.pattern(/^[A-Z]{2,2}$/)];
                c[p + 'PrvtOthrId'] = ['', Validators.maxLength(35)];
                c[p + 'PrvtOthrSchmeNmCd'] = ['', Validators.maxLength(4)]; c[p + 'PrvtOthrSchmeNmPrtry'] = ['', Validators.maxLength(35)]; c[p + 'PrvtOthrIssr'] = ['', Validators.maxLength(35)];
            } else {
                c[p + 'Bic'] = ['', [Validators.pattern(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)]];
                c[p + 'Lei'] = ['', [Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)]];
                c[p + 'ClrSysCd'] = ['', Validators.maxLength(4)];
                c[p + 'ClrSysMmbId'] = ['', Validators.maxLength(35)];
            }
        });
        this.form = this.fb.group(c);
    }

    err(f: string): string | null {
        const c = this.form.get(f);
        if (!c || (!c.dirty && !c.touched) || !c.invalid) return null;
        if (c.errors?.['required']) return 'Required field.';
        if (c.errors?.['maxlength']) return `Max ${c.errors['maxlength'].requiredLength} chars.`;
        if (c.errors?.['pattern']) {
            if (f.toLowerCase().includes('bic')) return 'Valid 8 or 11-char BIC required.';
            if (f.toLowerCase().includes('iban')) return 'Valid 34-char IBAN required.';
            if (f.toLowerCase().includes('uetr')) return 'Valid UUID required.';
            if (f.toLowerCase().includes('amount') || f.toLowerCase().includes('amt')) return 'Amount must be > 0 (max 18 digits).';
            if (f === 'nbOfTxs') return 'Must be 1-15 digits.';
            if (f === 'bizMsgId' || f === 'msgId' || f === 'instrId' || f === 'endToEndId' || f === 'txId') return 'Invalid Pattern.';
            if (f.toLowerCase().includes('name') || f.toLowerCase().includes('nm')) return "Invalid characters. Only letters, numbers, spaces and . , ( ) ' - are allowed (no &, @, !, etc.)";
            if (f.toLowerCase().includes('ustrd') || f.toLowerCase().includes('adtlrmtinf')) return "Invalid character in remittance field. Only ISO 20022 MX allowed chars permitted.";

        }
        if (c.errors?.['target2']) return 'TARGET2 payments must use EUR as the settlement currency.';
        if (c.errors?.['chaps']) return 'Invalid Currency for CHAPS clearing system. When ClrSysId/Cd = CHAPS, the transaction currency must be GBP.';
        return 'Invalid value.';
    }
    warningTimeouts: { [key: string]: any } = {};
    showMaxLenWarning: { [key: string]: boolean } = {};

    @HostListener('keydown', ['$event'])
    onKeydown(event: KeyboardEvent) {
        // 1. History & Formatting Shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+S)
        if (event.ctrlKey || event.metaKey) {
            if (document.activeElement?.classList.contains('code-editor')) {
                switch (event.key.toLowerCase()) {
                    case 'z':
                        event.preventDefault();
                        this.undoXml();
                        return;
                    case 'y':
                        event.preventDefault();
                        this.redoXml();
                        return;
                    case 's':
                        event.preventDefault();
                        this.formatXml();
                        return;
                    case '/':
                        event.preventDefault();
                        this.toggleCommentXml();
                        return;
                }
            }
        }

        // 2. Existing MaxLength Warning logic
        const target = event.target as HTMLInputElement;
        if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;
        const maxLen = target.maxLength;
        if (maxLen && maxLen > 0 && target.value && target.value.toString().length >= maxLen) {
            if (target.selectionStart !== null && target.selectionStart !== target.selectionEnd) return;
            if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
                const controlName = target.getAttribute('formControlName') || target.getAttribute('name');
                if (controlName) {
                    this.showMaxLenWarning[controlName] = true;
                    if (this.warningTimeouts[controlName]) {
                        clearTimeout(this.warningTimeouts[controlName]);
                    }
                    this.warningTimeouts[controlName] = setTimeout(() => {
                        this.showMaxLenWarning[controlName] = false;
                    }, 3000);
                }
            }
        }
    }

    hint(f: string, maxLen: number): string | null {
        if (!this.showMaxLenWarning[f]) return null;
        const c = this.form.get(f);
        if (!c || !c.value) return null;
        const len = c.value.toString().length;
        if (len >= maxLen) {
            return `Maximum ${maxLen} characters reached (${len}/${maxLen})`;
        }
        return null;
    }


    isoNow(): string {
        const d = new Date(), p = (n: number) => n.toString().padStart(2, '0');
        const off = -d.getTimezoneOffset(), s = off >= 0 ? '+' : '-';
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${s}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
    }

    generateXml() {
        if (this.isParsingXml) return;

        // Stop generation if TARGET2 rule is violated
        if (this.form.get('currency')?.hasError('target2')) {
            this.generatedXml = '<!-- TARGET2 VALIDATION ERROR: TARGET2 payments must use EUR as the settlement currency. -->';
            this.onEditorChange(this.generatedXml, true);
            return;
        }

        // Stop generation if CHAPS rule is violated
        if (this.form.get('currency')?.hasError('chaps')) {
            this.generatedXml = '<!-- CHAPS VALIDATION ERROR: Invalid Currency for CHAPS clearing system. When ClrSysId/Cd = CHAPS, the transaction currency must be GBP. -->';
            this.onEditorChange(this.generatedXml, true);
            return;
        }

        const v = this.form.value;
        let creDtTm = v.creDtTm || this.isoNow();
        if (creDtTm.endsWith('Z')) creDtTm = creDtTm.replace('Z', '+00:00');

        // CdtTrfTxInf — pacs.009.001.08 COV element order
        let tx = '';
        tx += this.tag('PmtId', this.el('InstrId', v.instrId) + this.el('EndToEndId', v.endToEndId) + this.el('UETR', v.uetr), 3);

        let pmtTpXml = '';
        if (v.ctgyPurpCd?.trim()) pmtTpXml += this.tag('CtgyPurp', this.el('Cd', v.ctgyPurpCd, 5), 4);
        if (pmtTpXml) tx += this.tag('PmtTpInf', pmtTpXml, 3);
        tx += `\t\t\t<IntrBkSttlmAmt Ccy="${this.e(v.currency)}">${v.amount}</IntrBkSttlmAmt>\n`;
        tx += this.el('IntrBkSttlmDt', v.sttlmDt, 3);
        // PrvsInstgAgts
        tx += this.agt('PrvsInstgAgt1', 'prvsInstgAgt1', v);
        tx += this.agt('PrvsInstgAgt2', 'prvsInstgAgt2', v);
        tx += this.agt('PrvsInstgAgt3', 'prvsInstgAgt3', v);
        // InstgAgt/InstdAgt in CdtTrfTxInf
        tx += this.agt('InstgAgt', 'instgAgt', v);
        tx += this.agt('InstdAgt', 'instdAgt', v);
        // IntrmyAgts
        tx += this.agt('IntrmyAgt1', 'intrmyAgt1', v);
        tx += this.agt('IntrmyAgt2', 'intrmyAgt2', v);
        tx += this.agt('IntrmyAgt3', 'intrmyAgt3', v);
        // Dbtr (FI — BranchAndFinancialInstitutionIdentification8)

        if (v.purpCd?.trim()) tx += this.tag('Purp', this.el('Cd', v.purpCd, 4), 3);
        tx += `\t\t\t<Dbtr>\n\t\t\t\t<FinInstnId>\n\t\t\t\t\t<BICFI>${this.e(v.dbtrFiBic)}</BICFI>\n\t\t\t\t</FinInstnId>\n\t\t\t</Dbtr>\n`;
        if (v.dbtrFiAcct?.trim()) tx += `\t\t\t<DbtrAcct>\n\t\t\t\t<Id>\n\t\t\t\t\t<Othr>\n\t\t\t\t\t\t<Id>${this.e(v.dbtrFiAcct)}</Id>\n\t\t\t\t\t</Othr>\n\t\t\t\t</DbtrAcct>\n`;
        // DbtrAgt (optional)
        tx += this.agt('DbtrAgt', 'dbtrAgt', v);
        // CdtrAgt (optional)
        tx += this.agt('CdtrAgt', 'cdtrAgt', v);
        // Cdtr (FI)
        tx += this.agt('Cdtr', 'cdtrFi', v);
        if (v.cdtrFiAcct?.trim()) tx += `\t\t\t<CdtrAcct>\n\t\t\t\t<Id>\n\t\t\t\t\t<Othr>\n\t\t\t\t\t\t<Id>${this.e(v.cdtrFiAcct)}</Id>\n\t\t\t\t\t</Othr>\n\t\t\t\t</Id>\n\t\t\t</CdtrAcct>\n`;

        // COV: UndrlygCstmrCdtTrf
        tx += this.buildCov(v);


        let rmtInf = '';
        if (v.rmtInfType === 'ustrd' && v.rmtInfUstrd) {
            rmtInf = `\n\t\t\t\t<RmtInf>\n\t\t\t\t\t<Ustrd>${this.e(v.rmtInfUstrd)}</Ustrd>\n\t\t\t\t</RmtInf>`;
        } else if (v.rmtInfType === 'strd') {
            let cdtrRef = '';
            if (v.rmtInfStrdCdtrRefType && v.rmtInfStrdCdtrRef) {
                cdtrRef = `\n\t\t\t\t\t\t<CdtrRefInf>\n\t\t\t\t\t\t\t<Tp>\n\t\t\t\t\t\t\t\t<CdOrPrtry>\n\t\t\t\t\t\t\t\t\t<Cd>${this.e(v.rmtInfStrdCdtrRefType)}</Cd>\n\t\t\t\t\t\t\t\t</CdOrPrtry>\n\t\t\t\t\t\t\t</Tp>\n\t\t\t\t\t\t\t<Ref>${this.e(v.rmtInfStrdCdtrRef)}</Ref>\n\t\t\t\t\t\t</CdtrRefInf>`;
            }
            let addtl = v.rmtInfStrdAddtlRmtInf ? `\n\t\t\t\t\t\t<AddtlRmtInf>${this.e(v.rmtInfStrdAddtlRmtInf)}</AddtlRmtInf>` : '';
            if (cdtrRef || addtl) {
                rmtInf = `\n\t\t\t\t<RmtInf>\n\t\t\t\t\t<Strd>${cdtrRef}${addtl}\n\t\t\t\t\t</Strd>\n\t\t\t\t</RmtInf>`;
            }
        }
        tx += rmtInf;


        const frBic = v.fromBic;
        const toBic = v.toBic;

        this.generatedXml =
            `<?xml version="1.0" encoding="UTF-8"?>
<Envelope xmlns="urn:swift:xsd:envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
\t<head:AppHdr xmlns:head="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
\t\t<head:Fr>
\t\t\t<head:FIId>
\t\t\t\t<head:FinInstnId>
\t\t\t\t\t<head:BICFI>${this.e(frBic)}</head:BICFI>
\t\t\t\t</head:FinInstnId>
\t\t\t</head:FIId>
\t\t</head:Fr>
\t\t<head:To>
\t\t\t<head:FIId>
\t\t\t\t<head:FinInstnId>
\t\t\t\t\t<head:BICFI>${this.e(toBic)}</head:BICFI>
\t\t\t\t</head:FinInstnId>
\t\t\t</head:FIId>
\t\t</head:To>
\t\t<head:BizMsgIdr>${this.e(v.bizMsgId)}</head:BizMsgIdr>
\t\t<head:MsgDefIdr>pacs.009.001.08</head:MsgDefIdr>
\t\t<head:BizSvc>swift.cbprplus.cov.04</head:BizSvc>
\t\t<head:CreDt>${creDtTm}</head:CreDt>
\t</head:AppHdr>
\t<pacs:Document xmlns:pacs="urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08">
\t\t<pacs:FICdtTrf>
\t\t\t<pacs:GrpHdr>
\t\t\t\t<pacs:MsgId>${this.e(v.msgId)}</pacs:MsgId>
\t\t\t\t<pacs:CreDtTm>${creDtTm}</pacs:CreDtTm>
\t\t\t\t<pacs:NbOfTxs>${v.nbOfTxs}</pacs:NbOfTxs>
\t\t\t\t<pacs:SttlmInf>
\t\t\t\t\t<pacs:SttlmMtd>${this.e(v.sttlmMtd)}</pacs:SttlmMtd>
\t\t\t\t</pacs:SttlmInf>
\t\t\t</pacs:GrpHdr>
\t\t\t<pacs:CdtTrfTxInf>
${this.prefixLines(tx, 'pacs:')}\t\t\t</pacs:CdtTrfTxInf>
\t\t</pacs:FICdtTrf>
\t</pacs:Document>
</Envelope>`;
        this.onEditorChange(this.generatedXml, true);
    }

    // Prefix all XML element tags with pacs: namespace
    private prefixLines(xml: string, ns: string): string {
        return xml.replace(/<(\/?)([\w]+)([ >])/g, `<$1${ns}$2$3`);
    }

    // XML helpers
    private e(v: string) { return (v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    private tabs(n: number) { return '\t'.repeat(n); }
    private el(tag: string, val: string, indent = 3) { return val?.trim() ? `${this.tabs(indent)}<${tag}>${this.e(val)}</${tag}>\n` : ''; }
    private tag(tag: string, content: string, indent = 3) { return content?.trim() ? `${this.tabs(indent)}<${tag}>\n${content}${this.tabs(indent)}</${tag}>\n` : ''; }

    grpAgt(tag: string, prefix: string, v: any) {
        const bic = v[prefix + 'Bic']; if (!bic) return '';
        return `\t\t\t\t<${tag}>\n\t\t\t\t\t<FinInstnId>\n\t\t\t\t\t\t<BICFI>${this.e(bic)}</BICFI>\n${this.addrXml(v, prefix, 6)}\t\t\t\t\t</FinInstnId>\n\t\t\t\t</${tag}>\n`;
    }
    agt(tag: string, prefix: string, v: any) {
        const bic = v[prefix + 'Bic'];
        const name = v[prefix + 'Name'];
        const lei = v[prefix + 'Lei'];
        const clrCd = v[prefix + 'ClrSysCd'];
        const clrMmb = v[prefix + 'ClrSysMmbId'];

        if (!bic && !name && !lei && !clrMmb) return '';

        let content = '';
        if (bic) content += `\t\t\t\t\t<BICFI>${this.e(bic)}</BICFI>\n`;
        if (clrMmb) {
            content += `\t\t\t\t\t<ClrSysMmbId>\n`;
            if (clrCd) content += `\t\t\t\t\t\t<ClrSysId>\n\t\t\t\t\t\t\t<Cd>${this.e(clrCd)}</Cd>\n\t\t\t\t\t\t</ClrSysId>\n`;
            content += `\t\t\t\t\t\t<MmbId>${this.e(clrMmb)}</MmbId>\n`;
            content += `\t\t\t\t\t</ClrSysMmbId>\n`;
        }
        if (name) content += `\t\t\t\t\t<Nm>${this.e(name)}</Nm>\n`;
        content += this.addrXml(v, prefix, 5);
        if (lei) content += `\t\t\t\t\t<LEI>${this.e(lei)}</LEI>\n`;

        return `\t\t\t<${tag}>\n\t\t\t\t<FinInstnId>\n${content}\t\t\t\t</FinInstnId>\n\t\t\t</${tag}>\n`;
    }

    partyAgentXml(tag: string, prefix: string, v: any, indent = 4) {
        const bic = v[prefix + 'Bic'];
        const name = v[prefix + 'Name'];
        const lei = v[prefix + 'Lei'];
        const clrCd = v[prefix + 'ClrSysCd'];
        const clrMmb = v[prefix + 'ClrSysMmbId'];

        if (!bic && !name && !lei && !clrMmb && v[prefix + 'AddrType'] === 'none') return '';

        let content = '';
        if (name) content += `${this.tabs(indent + 1)}<Nm>${this.e(name)}</Nm>\n`;
        content += this.addrXml(v, prefix, indent + 1);

        let org = '';
        if (bic) org += `${this.tabs(indent + 3)}<AnyBIC>${this.e(bic)}</AnyBIC>\n`;
        if (lei) org += `${this.tabs(indent + 3)}<LEI>${this.e(lei)}</LEI>\n`;
        if (clrMmb) {
            org += `${this.tabs(indent + 3)}<Othr>\n${this.tabs(indent + 4)}<Id>${this.e(clrMmb)}</Id>\n`;
            if (clrCd) {
                org += `${this.tabs(indent + 4)}<SchmeNm>\n${this.tabs(indent + 5)}<Cd>${this.e(clrCd)}</Cd>\n${this.tabs(indent + 4)}</SchmeNm>\n`;
            }
            org += `${this.tabs(indent + 3)}</Othr>\n`;
        }

        if (org) {
            content += `${this.tabs(indent + 1)}<Id>\n${this.tabs(indent + 2)}<OrgId>\n${org}${this.tabs(indent + 2)}</OrgId>\n${this.tabs(indent + 1)}</Id>\n`;
        }

        return `${this.tabs(indent)}<${tag}>\n${content}${this.tabs(indent)}</${tag}>\n`;
    }

    addrXml(v: any, p: string, indent = 4): string {
        const type = v[p + 'AddrType']; if (!type || type === 'none') return '';
        const lines: string[] = []; const t = this.tabs(indent + 1);
        if (type === 'structured' || type === 'hybrid') {
            if (v[p + 'Dept']) lines.push(`${t}<Dept>${this.e(v[p + 'Dept'])}</Dept>`);
            if (v[p + 'SubDept']) lines.push(`${t}<SubDept>${this.e(v[p + 'SubDept'])}</SubDept>`);
            if (v[p + 'StrtNm']) lines.push(`${t}<StrtNm>${this.e(v[p + 'StrtNm'])}</StrtNm>`);
            if (v[p + 'BldgNb']) lines.push(`${t}<BldgNb>${this.e(v[p + 'BldgNb'])}</BldgNb>`);
            if (v[p + 'BldgNm']) lines.push(`${t}<BldgNm>${this.e(v[p + 'BldgNm'])}</BldgNm>`);
            if (v[p + 'Flr']) lines.push(`${t}<Flr>${this.e(v[p + 'Flr'])}</Flr>`);
            if (v[p + 'PstBx']) lines.push(`${t}<PstBx>${this.e(v[p + 'PstBx'])}</PstBx>`);
            if (v[p + 'Room']) lines.push(`${t}<Room>${this.e(v[p + 'Room'])}</Room>`);
            if (v[p + 'PstCd']) lines.push(`${t}<PstCd>${this.e(v[p + 'PstCd'])}</PstCd>`);
            if (v[p + 'TwnNm']) lines.push(`${t}<TwnNm>${this.e(v[p + 'TwnNm'])}</TwnNm>`);
            if (v[p + 'CtrySubDvsn']) lines.push(`${t}<CtrySubDvsn>${this.e(v[p + 'CtrySubDvsn'])}</CtrySubDvsn>`);
            if (v[p + 'Ctry']) lines.push(`${t}<Ctry>${this.e(v[p + 'Ctry'])}</Ctry>`);
        }
        if (type === 'unstructured' || type === 'hybrid') {
            if (v[p + 'AdrLine1']) lines.push(`${t}<AdrLine>${this.e(v[p + 'AdrLine1'])}</AdrLine>`);
            if (v[p + 'AdrLine2']) lines.push(`${t}<AdrLine>${this.e(v[p + 'AdrLine2'])}</AdrLine>`);
        }
        if (!lines.length) return '';
        return `${this.tabs(indent)}<PstlAdr>\n${lines.join('\n')}\n${this.tabs(indent)}</PstlAdr>\n`;
    }

    partyIdXml(v: any, p: string, indent = 4): string {
        const type = v[p + 'IdType']; if (!type || type === 'none') return '';
        const t = this.tabs(indent + 1);
        if (type === 'org') {
            let org = '';
            if (v[p + 'OrgAnyBIC']) org += `${t}\t<AnyBIC>${this.e(v[p + 'OrgAnyBIC'])}</AnyBIC>\n`;
            if (v[p + 'OrgLEI']) org += `${t}\t<LEI>${this.e(v[p + 'OrgLEI'])}</LEI>\n`;
            if (v[p + 'OrgOthrId']) {
                org += `${t}\t<Othr>\n${t}\t\t<Id>${this.e(v[p + 'OrgOthrId'])}</Id>\n`;
                if (v[p + 'OrgOthrSchmeNmCd'] || v[p + 'OrgOthrSchmeNmPrtry']) {
                    org += `${t}\t\t<SchmeNm>\n`;
                    if (v[p + 'OrgOthrSchmeNmCd']) org += `${t}\t\t\t<Cd>${this.e(v[p + 'OrgOthrSchmeNmCd'])}</Cd>\n`;
                    else org += `${t}\t\t\t<Prtry>${this.e(v[p + 'OrgOthrSchmeNmPrtry'])}</Prtry>\n`;
                    org += `${t}\t\t</SchmeNm>\n`;
                }
                if (v[p + 'OrgOthrIssr']) org += `${t}\t\t<Issr>${this.e(v[p + 'OrgOthrIssr'])}</Issr>\n`;
                org += `${t}\t</Othr>\n`;
            }
            return `${this.tabs(indent)}<Id>\n${t}<OrgId>\n${org}${t}</OrgId>\n${this.tabs(indent)}</Id>\n`;
        } else if (type === 'prvt') {
            let prvt = '';
            if (v[p + 'PrvtDtAndPlcOfBirthDt'] || v[p + 'PrvtDtAndPlcOfBirthCity'] || v[p + 'PrvtDtAndPlcOfBirthCtry']) {
                prvt += `${t}\t<DtAndPlcOfBirth>\n`;
                if (v[p + 'PrvtDtAndPlcOfBirthDt']) prvt += `${t}\t\t<BirthDt>${this.e(v[p + 'PrvtDtAndPlcOfBirthDt'])}</BirthDt>\n`;
                if (v[p + 'PrvtDtAndPlcOfBirthPrvc']) prvt += `${t}\t\t<PrvcOfBirth>${this.e(v[p + 'PrvtDtAndPlcOfBirthPrvc'])}</PrvcOfBirth>\n`;
                if (v[p + 'PrvtDtAndPlcOfBirthCity']) prvt += `${t}\t\t<CityOfBirth>${this.e(v[p + 'PrvtDtAndPlcOfBirthCity'])}</CityOfBirth>\n`;
                if (v[p + 'PrvtDtAndPlcOfBirthCtry']) prvt += `${t}\t\t<CtryOfBirth>${this.e(v[p + 'PrvtDtAndPlcOfBirthCtry'])}</CtryOfBirth>\n`;
                prvt += `${t}\t</DtAndPlcOfBirth>\n`;
            }
            if (v[p + 'PrvtOthrId']) {
                prvt += `${t}\t<Othr>\n${t}\t\t<Id>${this.e(v[p + 'PrvtOthrId'])}</Id>\n`;
                if (v[p + 'PrvtOthrSchmeNmCd'] || v[p + 'PrvtOthrSchmeNmPrtry']) {
                    prvt += `${t}\t\t<SchmeNm>\n`;
                    if (v[p + 'PrvtOthrSchmeNmCd']) prvt += `${t}\t\t\t<Cd>${this.e(v[p + 'PrvtOthrSchmeNmCd'])}</Cd>\n`;
                    else prvt += `${t}\t\t\t<Prtry>${this.e(v[p + 'PrvtOthrSchmeNmPrtry'])}</Prtry>\n`;
                    prvt += `${t}\t\t</SchmeNm>\n`;
                }
                if (v[p + 'PrvtOthrIssr']) prvt += `${t}\t\t<Issr>${this.e(v[p + 'PrvtOthrIssr'])}</Issr>\n`;
                prvt += `${t}\t</Othr>\n`;
            }
            return `${this.tabs(indent)}<Id>\n${t}<PrvtId>\n${prvt}${t}</PrvtId>\n${this.tabs(indent)}</Id>\n`;
        }
        return '';
    }

    // COV: UndrlygCstmrCdtTrf (CreditTransferTransaction62)
    // XSD element order: UltmtDbtr?, InitgPty?, Dbtr, DbtrAcct?, DbtrAgt, DbtrAgtAcct?,
    //   PrvsInstgAgt1..3?, IntrmyAgt1..3?, CdtrAgt, CdtrAgtAcct?, Cdtr, CdtrAcct?,
    //   UltmtCdtr?, InstrForCdtrAgt*, InstrForNxtAgt*, RmtInf?, InstdAmt?
    private buildCov(v: any): string {
        let b = `\t\t\t<UndrlygCstmrCdtTrf>\n`;
        // UltmtDbtr (optional)
        if (v.covUltmtDbtrName?.trim()) {
            let ud = `\t\t\t\t\t<Nm>${this.e(v.covUltmtDbtrName)}</Nm>\n`;
            const udAddr = this.addrXml(v, 'covUltmtDbtr', 5);
            if (udAddr) ud += udAddr;
            ud += this.partyIdXml(v, 'covUltmtDbtr', 5);
            b += `\t\t\t\t<UltmtDbtr>\n${ud}\t\t\t\t</UltmtDbtr>\n`;
        }
        const formatAcct = (val: string, tabs: number) => {
            if (!val) return '';
            const ibanCountries = ['AD', 'AE', 'AL', 'AT', 'AZ', 'BA', 'BE', 'BG', 'BH', 'BR', 'BY', 'CH', 'CR', 'CY', 'CZ', 'DE', 'DK', 'DO', 'EE', 'EG', 'ES', 'FI', 'FO', 'FR', 'GB', 'GE', 'GI', 'GL', 'GR', 'GT', 'HR', 'HU', 'IE', 'IL', 'IQ', 'IS', 'IT', 'JO', 'KW', 'KZ', 'LB', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK', 'MR', 'MT', 'MU', 'NL', 'NO', 'PK', 'PL', 'PS', 'PT', 'QA', 'RO', 'RS', 'RU', 'SA', 'SC', 'SE', 'SI', 'SK', 'SM', 'ST', 'SV', 'TL', 'TN', 'TR', 'UA', 'VA', 'VG', 'XK'];
            if (val.length >= 14 && ibanCountries.includes(val.substring(0, 2).toUpperCase()) && /^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/i.test(val)) {
                return this.el('IBAN', val, tabs + 1);
            } else {
                return `\n${'\t'.repeat(tabs + 1)}<Othr>\n${'\t'.repeat(tabs + 2)}<Id>${this.e(val)}</Id>\n${'\t'.repeat(tabs + 1)}</Othr>\n${'\t'.repeat(tabs)}`;
            }
        };

        // Dbtr (PartyIdentification272)
        if (v.covDbtrName || v.covDbtrBic || v.covDbtrLei || v.covDbtrClrSysMmbId || v.covDbtrAddrType !== 'none') {
            b += this.partyAgentXml('Dbtr', 'covDbtr', v, 4);
        }
        // DbtrAcct
        if (v.covDbtrAcct?.trim()) {
            b += `\t\t\t\t<DbtrAcct>\n\t\t\t\t\t<Id>${formatAcct(v.covDbtrAcct, 5)}\t\t\t\t\t</Id>\n\t\t\t\t</DbtrAcct>\n`;
        }
        // DbtrAgt
        if (v.covDbtrAgtBic?.trim()) b += `\t\t\t\t<DbtrAgt>\n\t\t\t\t\t<FinInstnId>\n\t\t\t\t\t\t<BICFI>${this.e(v.covDbtrAgtBic)}</BICFI>\n\t\t\t\t\t</FinInstnId>\n\t\t\t\t</DbtrAgt>\n`;
        // CdtrAgt
        if (v.covCdtrAgtBic?.trim()) b += `\t\t\t\t<CdtrAgt>\n\t\t\t\t\t<FinInstnId>\n\t\t\t\t\t\t<BICFI>${this.e(v.covCdtrAgtBic)}</BICFI>\n\t\t\t\t\t</FinInstnId>\n\t\t\t\t</CdtrAgt>\n`;
        // Cdtr (PartyIdentification272)
        if (v.covCdtrName || v.covCdtrBic || v.covCdtrLei || v.covCdtrClrSysMmbId || v.covCdtrAddrType !== 'none') {
            b += this.partyAgentXml('Cdtr', 'covCdtr', v, 4);
        }
        // CdtrAcct
        if (v.covCdtrAcct?.trim()) {
            b += `\t\t\t\t<CdtrAcct>\n\t\t\t\t\t<Id>${formatAcct(v.covCdtrAcct, 5)}\t\t\t\t\t</Id>\n\t\t\t\t</CdtrAcct>\n`;
        }
        // UltmtCdtr (optional)
        if (v.covUltmtCdtrName?.trim()) {
            let uc = `\t\t\t\t\t<Nm>${this.e(v.covUltmtCdtrName)}</Nm>\n`;
            const ucAddr = this.addrXml(v, 'covUltmtCdtr', 5);
            if (ucAddr) uc += ucAddr;
            uc += this.partyIdXml(v, 'covUltmtCdtr', 5);
            b += `\t\t\t\t<UltmtCdtr>\n${uc}\t\t\t\t</UltmtCdtr>\n`;
        }
        // InstrForCdtrAgt (optional)
        if (v.covInstrForCdtrAgtCd?.trim() || v.covInstrForCdtrAgtInstrInf?.trim()) {
            let instr = '';
            if (v.covInstrForCdtrAgtCd?.trim()) instr += `\t\t\t\t\t<Cd>${this.e(v.covInstrForCdtrAgtCd)}</Cd>\n`;
            if (v.covInstrForCdtrAgtInstrInf?.trim()) instr += `\t\t\t\t\t<InstrInf>${this.e(v.covInstrForCdtrAgtInstrInf)}</InstrInf>\n`;
            b += `\t\t\t\t<InstrForCdtrAgt>\n${instr}\t\t\t\t</InstrForCdtrAgt>\n`;
        }
        // InstrForNxtAgt (optional)
        if (v.covInstrForNxtAgtInstrInf?.trim()) {
            b += `\t\t\t\t<InstrForNxtAgt>\n\t\t\t\t\t<InstrInf>${this.e(v.covInstrForNxtAgtInstrInf)}</InstrInf>\n\t\t\t\t</InstrForNxtAgt>\n`;
        }
        // RmtInf (optional — Ustrd)
        if (v.covRmtInfUstrd?.trim()) {
            b += `\t\t\t\t<RmtInf>\n\t\t\t\t\t<Ustrd>${this.e(v.covRmtInfUstrd)}</Ustrd>\n\t\t\t\t</RmtInf>\n`;
        }
        // InstdAmt (optional)
        if (v.covInstdAmt?.trim() && v.covInstdAmtCcy?.trim()) {
            b += `\t\t\t\t<InstdAmt Ccy="${this.e(v.covInstdAmtCcy)}">${v.covInstdAmt}</InstdAmt>\n`;
        }
        b += `\t\t\t</UndrlygCstmrCdtTrf>\n`;
        return b;
    }

    // Validation
    validateMessage() {
        this.generateXml();
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            this.snackBar.open('Please fix the errors in the form before validating.', 'Close', { duration: 3000 });
            return;
        }
        if (!this.generatedXml?.trim()) return;

        this.showValidationModal = true;
        this.validationStatus = 'validating';
        this.validationReport = null;
        this.validationExpandedIssue = null;

        this.http.post(this.config.getApiUrl('/validate'), {
            xml_content: this.generatedXml,
            mode: 'Full 1-3',
            message_type: 'pacs.009.001.08',
            store_in_history: true
        }).subscribe({
            next: (data: any) => {
                this.validationReport = data;
                this.validationStatus = 'done';
            },
            error: (err) => {
                this.validationReport = {
                    status: 'FAIL', errors: 1, warnings: 0,
                    message: 'pacs.009.001.08', total_time_ms: 0,
                    layer_status: {},
                    details: [{
                        severity: 'ERROR', layer: 0, code: 'BACKEND_ERROR',
                        path: '', message: 'Validation failed — ' + (err.error?.detail?.message || 'backend not reachable.'),
                        fix_suggestion: 'Ensure the validation server is running.'
                    }]
                };
                this.validationStatus = 'done';
            }
        });
    }



    downloadXml() { this.generateXml(); const b = new Blob([this.generatedXml], { type: 'application/xml' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `pacs009cov-${Date.now()}.xml`; a.click(); URL.revokeObjectURL(a.href); }
    copyToClipboard() {
        this.generateXml();
        navigator.clipboard.writeText(this.generatedXml).then(() => {
            this.snackBar.open('Copied!', 'Close', { duration: 3000, horizontalPosition: 'center', verticalPosition: 'bottom' });
        });
    }
    switchToPreview() { this.generateXml(); this.currentTab = 'preview'; }

    onEditorChange(content: string, fromForm = false) {
        if (!this.isInternalChange && !fromForm) {
            this.pushHistory();
        }
        
        this.generatedXml = content;
        const lines = content.split('\n').length;
        this.editorLineCount = Array.from({ length: lines }, (_, i) => i + 1);

        if (fromForm || this.isParsingXml) return;
        this.parseXmlToForm(content);
    }

    // --- History & Formatting ---
    private pushHistory() {
        const val = this.generatedXml;
        if (this.xmlHistoryIdx >= 0 && this.xmlHistory[this.xmlHistoryIdx] === val) return;

        if (this.xmlHistoryIdx < this.xmlHistory.length - 1) {
            this.xmlHistory.splice(this.xmlHistoryIdx + 1);
        }

        this.xmlHistory.push(val);
        if (this.xmlHistory.length > this.maxHistory) {
            this.xmlHistory.shift();
        } else {
            this.xmlHistoryIdx++;
        }
    }

    undoXml() {
        if (this.xmlHistoryIdx > 0) {
            this.xmlHistoryIdx--;
            this.isInternalChange = true;
            this.generatedXml = this.xmlHistory[this.xmlHistoryIdx];
            this.refreshLineCount();
            setTimeout(() => this.isInternalChange = false, 10);
            this.parseXmlToForm(this.generatedXml);
        }
    }

    redoXml() {
        if (this.xmlHistoryIdx < this.xmlHistory.length - 1) {
            this.xmlHistoryIdx++;
            this.isInternalChange = true;
            this.generatedXml = this.xmlHistory[this.xmlHistoryIdx];
            this.refreshLineCount();
            setTimeout(() => this.isInternalChange = false, 10);
            this.parseXmlToForm(this.generatedXml);
        }
    }

    canUndoXml(): boolean { return this.xmlHistoryIdx > 0; }
    canRedoXml(): boolean { return this.xmlHistoryIdx < this.xmlHistory.length - 1; }

    private refreshLineCount() {
        const lines = (this.generatedXml || '').split('\n').length;
        this.editorLineCount = Array.from({ length: lines }, (_, i) => i + 1);
    }

    formatXml() {
        if (!this.generatedXml?.trim()) return;
        this.pushHistory();
        
        try {
            let xml = this.generatedXml.trim();
            let formatted = '';
            let indent = '';
            const tab = '    ';
            
            xml.split(/>\s*</).forEach(node => {
                if (node.match(/^\/\w/)) indent = indent.substring(tab.length);
                formatted += indent + '<' + node + '>\r\n';
                if (node.match(/^<?\w[^>]*[^\/]$/) && !node.startsWith('?')) indent += tab;
            });
            
            this.generatedXml = formatted.substring(1, formatted.length - 3);
            this.refreshLineCount();
            this.snackBar.open('XML Formatted', '', { duration: 1500 });
        } catch (e) {
            this.snackBar.open('Unable to format XML', '', { duration: 3000 });
        }
    }

    toggleCommentXml() {
        if (!this.generatedXml) return;

        const textarea = document.querySelector('.code-editor') as HTMLTextAreaElement;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;

        this.isInternalChange = true;
        this.pushHistory();

        // Identify start/end of lines
        let lineStart = value.lastIndexOf('\n', start - 1) + 1;
        let lineEnd = value.indexOf('\n', end);
        if (lineEnd === -1) lineEnd = value.length;

        const selection = value.substring(lineStart, lineEnd);
        const before = value.substring(0, lineStart);
        const after = value.substring(lineEnd);

        let newResult = '';
        const trimmed = selection.trim();

        if (trimmed.startsWith('<!--') && trimmed.endsWith('-->')) {
            // Uncomment
            newResult = selection.replace('<!--', '').replace('-->', '');
        } else {
            // Comment
            newResult = `<!-- ${selection} -->`;
        }

        this.generatedXml = before + newResult + after;
        this.refreshLineCount();

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(lineStart, lineStart + newResult.length);
            this.isInternalChange = false;
        }, 0);
    }

    parseXmlToForm(content: string) {
        try {
            const cleanXml = content.replace(/<(\/?)(?:[\w]+:)/g, '<$1');
            const doc = new DOMParser().parseFromString(cleanXml, 'text/xml');
            if (doc.querySelector('parsererror')) return;

            const patch: any = {};
            const tval = (t: string) => doc.getElementsByTagName(t)[0]?.textContent || '';
            const setVal = (key: string, val: string) => { patch[key] = val; };

            setVal('bizMsgId', tval('BizMsgIdr'));
            setVal('msgId', tval('MsgId'));
            setVal('nbOfTxs', tval('NbOfTxs'));
            setVal('sttlmMtd', tval('SttlmMtd'));
            setVal('sttlmDt', tval('IntrBkSttlmDt'));

            // TX fields
            setVal('instrId', tval('InstrId'));
            setVal('endToEndId', tval('EndToEndId'));
            setVal('txId', tval('TxId'));
            setVal('uetr', tval('UETR'));

            const amtEl = doc.getElementsByTagName('IntrBkSttlmAmt')[0];
            setVal('amount', amtEl ? (amtEl.textContent || '') : '');
            setVal('currency', amtEl ? (amtEl.getAttribute('Ccy') || '') : '');

            const creDtTm = doc.getElementsByTagName('CreDtTm')[0] || doc.getElementsByTagName('CreDt')[0];
            setVal('creDtTm', creDtTm ? (creDtTm.textContent || '') : '');

            const tryTag = (parentOrEl: string | Element, child: string) => {
                const p = typeof parentOrEl === 'string' ? doc.getElementsByTagName(parentOrEl)[0] : parentOrEl;
                return p ? (p.getElementsByTagName(child)[0]?.textContent || '') : '';
            };

            this.agentPrefixes.forEach(p => {
                let tag = p.charAt(0).toUpperCase() + p.slice(1);
                if (p === 'dbtrFi') tag = 'Dbtr';
                if (p === 'cdtrFi') tag = 'Cdtr';

                const el = doc.getElementsByTagName(tag)[0];
                if (el) {
                    const fi = el.getElementsByTagName('FinInstnId')[0];
                    if (fi) {
                        patch[p + 'Bic'] = fi.getElementsByTagName('BICFI')[0]?.textContent || '';
                        patch[p + 'Name'] = fi.getElementsByTagName('Nm')[0]?.textContent || '';
                        patch[p + 'Lei'] = fi.getElementsByTagName('LEI')[0]?.textContent || '';
                        const clr = fi.getElementsByTagName('ClrSysMmbId')[0];
                        if (clr) {
                            patch[p + 'ClrSysMmbId'] = clr.getElementsByTagName('MmbId')[0]?.textContent || '';
                            patch[p + 'ClrSysCd'] = clr.getElementsByTagName('ClrSysId')[0]?.getElementsByTagName('Cd')[0]?.textContent || '';
                        }
                    }
                }
            });

            // Re-fetch Acct since it's mapped to a different tag structure in pacs9
            setVal('dbtrFiAcct', tryTag('DbtrAcct', 'Id'));
            setVal('cdtrFiAcct', tryTag('CdtrAcct', 'Id'));

            const instgBic = tryTag('InstgAgt', 'BICFI');
            setVal('instgAgtBic', instgBic || patch.fromBic);
            const instdBic = tryTag('InstdAgt', 'BICFI');
            setVal('instdAgtBic', instdBic || patch.toBic);

            // agents
            const mapAgt = (tag: string, prefix: string) => {
                const n = doc.getElementsByTagName('UndrlygCstmrCdtTrf')[0];
                let found = false;
                if (n) {
                    const t = n.getElementsByTagName(tag)[0];
                    if (t) {
                        setVal(prefix + 'Bic', t.getElementsByTagName('BICFI')[0]?.textContent || '');
                        found = true;
                    }
                }
                if (!found) setVal(prefix + 'Bic', tryTag(tag, 'BICFI'));
            };

            mapAgt('PrvsInstgAgt1', 'prvsInstgAgt1');
            mapAgt('PrvsInstgAgt2', 'prvsInstgAgt2');
            mapAgt('PrvsInstgAgt3', 'prvsInstgAgt3');
            mapAgt('IntrmyAgt1', 'intrmyAgt1');
            mapAgt('IntrmyAgt2', 'intrmyAgt2');
            mapAgt('IntrmyAgt3', 'intrmyAgt3');
            mapAgt('DbtrAgt', 'dbtrAgt');
            mapAgt('CdtrAgt', 'cdtrAgt');

            const mapAddr = (tag: string, prefix: string) => {
                ['Dept', 'SubDept', 'StrtNm', 'BldgNb', 'BldgNm', 'Flr', 'PstBx', 'Room', 'PstCd', 'TwnNm', 'TwnLctnNm', 'DstrctNm', 'CtrySubDvsn', 'Ctry', 'AdrLine1', 'AdrLine2', 'AdrTpCd', 'AdrTpPrtry'].forEach(f => patch[prefix + f] = '');
                patch[prefix + 'AddrType'] = 'none';

                const p = doc.getElementsByTagName(tag)[0];
                if (!p) return;

                // --- Added ID Parsing since we generate PartyId ---
                const idNode = p.getElementsByTagName('Id')[0];
                patch[prefix + 'IdType'] = 'none';
                ['OrgAnyBIC', 'OrgLEI', 'OrgOthrId', 'OrgOthrSchmeNmCd', 'OrgOthrSchmeNmPrtry', 'OrgOthrIssr', 'PrvtDtAndPlcOfBirthDt', 'PrvtDtAndPlcOfBirthPrvc', 'PrvtDtAndPlcOfBirthCity', 'PrvtDtAndPlcOfBirthCtry', 'PrvtOthrId', 'PrvtOthrSchmeNmCd', 'PrvtOthrSchmeNmPrtry', 'PrvtOthrIssr', 'Bic', 'Lei', 'ClrSysCd', 'ClrSysMmbId', 'Acct'].forEach(f => patch[prefix + f] = '');
                if (idNode) {
                    const orgId = idNode.getElementsByTagName('OrgId')[0];
                    if (orgId) {
                        patch[prefix + 'IdType'] = 'org';
                        patch[prefix + 'OrgAnyBIC'] = orgId.getElementsByTagName('AnyBIC')[0]?.textContent || '';
                        patch[prefix + 'Bic'] = orgId.getElementsByTagName('AnyBIC')[0]?.textContent || '';
                        patch[prefix + 'OrgLEI'] = orgId.getElementsByTagName('LEI')[0]?.textContent || '';
                        patch[prefix + 'Lei'] = orgId.getElementsByTagName('LEI')[0]?.textContent || '';
                        const othr = orgId.getElementsByTagName('Othr')[0];
                        if (othr) {
                            patch[prefix + 'OrgOthrId'] = othr.getElementsByTagName('Id')[0]?.textContent || '';
                            patch[prefix + 'ClrSysMmbId'] = othr.getElementsByTagName('Id')[0]?.textContent || '';
                            patch[prefix + 'OrgOthrIssr'] = othr.getElementsByTagName('Issr')[0]?.textContent || '';
                            const schmeNm = othr.getElementsByTagName('SchmeNm')[0];
                            if (schmeNm) {
                                patch[prefix + 'OrgOthrSchmeNmCd'] = schmeNm.getElementsByTagName('Cd')[0]?.textContent || '';
                                patch[prefix + 'ClrSysCd'] = schmeNm.getElementsByTagName('Cd')[0]?.textContent || '';
                                patch[prefix + 'OrgOthrSchmeNmPrtry'] = schmeNm.getElementsByTagName('Prtry')[0]?.textContent || '';
                            }
                        }
                    }
                    const prvtId = idNode.getElementsByTagName('PrvtId')[0];
                    if (prvtId) {
                        patch[prefix + 'IdType'] = 'prvt';
                        const dob = prvtId.getElementsByTagName('DtAndPlcOfBirth')[0];
                        if (dob) {
                            patch[prefix + 'PrvtDtAndPlcOfBirthDt'] = dob.getElementsByTagName('BirthDt')[0]?.textContent || '';
                            patch[prefix + 'PrvtDtAndPlcOfBirthPrvc'] = dob.getElementsByTagName('PrvcOfBirth')[0]?.textContent || '';
                            patch[prefix + 'PrvtDtAndPlcOfBirthCity'] = dob.getElementsByTagName('CityOfBirth')[0]?.textContent || '';
                            patch[prefix + 'PrvtDtAndPlcOfBirthCtry'] = dob.getElementsByTagName('CtryOfBirth')[0]?.textContent || '';
                        }
                        const othr = prvtId.getElementsByTagName('Othr')[0];
                        if (othr) {
                            patch[prefix + 'PrvtOthrId'] = othr.getElementsByTagName('Id')[0]?.textContent || '';
                            patch[prefix + 'PrvtOthrIssr'] = othr.getElementsByTagName('Issr')[0]?.textContent || '';
                            const schmeNm = othr.getElementsByTagName('SchmeNm')[0];
                            if (schmeNm) {
                                patch[prefix + 'PrvtOthrSchmeNmCd'] = schmeNm.getElementsByTagName('Cd')[0]?.textContent || '';
                                patch[prefix + 'PrvtOthrSchmeNmPrtry'] = schmeNm.getElementsByTagName('Prtry')[0]?.textContent || '';
                            }
                        }
                    }
                }
                // ------------------------------------------------

                const addr = p.getElementsByTagName('PstlAdr')[0];
                if (!addr) return;
                const aV = (t: string) => addr.getElementsByTagName(t)[0]?.textContent || '';
                if (aV('Ctry') || aV('TwnNm') || aV('StrtNm') || aV('BldgNb') || aV('TwnLctnNm') || aV('DstrctNm')) {
                    patch[prefix + 'AddrType'] = 'structured';
                    ['Dept', 'SubDept', 'StrtNm', 'BldgNb', 'BldgNm', 'Flr', 'PstBx', 'Room', 'PstCd', 'TwnNm', 'TwnLctnNm', 'DstrctNm', 'CtrySubDvsn', 'Ctry'].forEach(f => patch[prefix + f] = aV(f));
                    const adrTp = addr.getElementsByTagName('AdrTp')[0];
                    if (adrTp) {
                        patch[prefix + 'AdrTpCd'] = adrTp.getElementsByTagName('Cd')[0]?.textContent || '';
                        patch[prefix + 'AdrTpPrtry'] = adrTp.getElementsByTagName('Prtry')[0]?.textContent || '';
                    }
                } else if (addr.getElementsByTagName('AdrLine').length > 0) {
                    patch[prefix + 'AddrType'] = 'unstructured';
                    const lines = addr.getElementsByTagName('AdrLine');
                    patch[prefix + 'AdrLine1'] = lines[0]?.textContent || '';
                    patch[prefix + 'AdrLine2'] = lines[1]?.textContent || '';
                }
            };
            this.agentPrefixes.forEach(p => mapAddr(p.charAt(0).toUpperCase() + p.slice(1), p));

            // CLEAR COV fields FIRST before replacing if found
            ['covUltmtDbtrName', 'covDbtrName', 'covDbtrAcct', 'covDbtrAgtBic', 'covCdtrAgtBic', 'covCdtrName',
                'covCdtrAcct', 'covUltmtCdtrName', 'covInstrForCdtrAgtCd', 'covInstrForCdtrAgtInstrInf',
                'covInstrForNxtAgtInstrInf', 'covRmtInfUstrd', 'covInstdAmt', 'covInstdAmtCcy'].forEach(f => patch[f] = '');

            // COV fields
            const cov = doc.getElementsByTagName('UndrlygCstmrCdtTrf')[0];
            if (cov) {
                setVal('covUltmtDbtrName', tryTag(cov, 'UltmtDbtr Nm'));
                setVal('covDbtrName', tryTag(cov, 'Dbtr Nm'));
                const covDbtrAcct = cov.getElementsByTagName('DbtrAcct')[0];
                if (covDbtrAcct) {
                    setVal('covDbtrAcct', covDbtrAcct.getElementsByTagName('IBAN')[0]?.textContent || covDbtrAcct.getElementsByTagName('Othr')[0]?.getElementsByTagName('Id')[0]?.textContent || '');
                }
                setVal('covDbtrAgtBic', tryTag(cov, 'DbtrAgt BICFI'));
                setVal('covCdtrAgtBic', tryTag(cov, 'CdtrAgt BICFI'));
                setVal('covCdtrName', tryTag(cov, 'Cdtr Nm'));
                const covCdtrAcct = cov.getElementsByTagName('CdtrAcct')[0];
                if (covCdtrAcct) {
                    setVal('covCdtrAcct', covCdtrAcct.getElementsByTagName('IBAN')[0]?.textContent || covCdtrAcct.getElementsByTagName('Othr')[0]?.getElementsByTagName('Id')[0]?.textContent || '');
                }
                setVal('covUltmtCdtrName', tryTag(cov, 'UltmtCdtr Nm'));
                setVal('covInstrForCdtrAgtCd', tryTag(cov, 'InstrForCdtrAgt Cd'));
                setVal('covInstrForCdtrAgtInstrInf', tryTag(cov, 'InstrForCdtrAgt InstrInf'));
                setVal('covInstrForNxtAgtInstrInf', tryTag(cov, 'InstrForNxtAgt InstrInf'));
                setVal('covRmtInfUstrd', tryTag(cov, 'RmtInf Ustrd'));

                const covAmt = cov.getElementsByTagName('InstdAmt')[0];
                setVal('covInstdAmt', covAmt ? (covAmt.textContent || '') : '');
                setVal('covInstdAmtCcy', covAmt ? (covAmt.getAttribute('Ccy') || '') : '');

                mapAddr('UltmtDbtr', 'covUltmtDbtr');
                mapAddr('Dbtr', 'covDbtr');
                mapAddr('Cdtr', 'covCdtr');
                mapAddr('UltmtCdtr', 'covUltmtCdtr');
            } else {
                mapAddr('UltmtDbtr', 'covUltmtDbtr');
                mapAddr('Dbtr', 'covDbtr');
                mapAddr('Cdtr', 'covCdtr');
                mapAddr('UltmtCdtr', 'covUltmtCdtr');
            }


            setVal('purpCd', tryTag('Purp', 'Cd') || tval('Purp'));
            setVal('ctgyPurpCd', tryTag('CtgyPurp', 'Cd') || tval('CtgyPurp'));
            this.isParsingXml = true;
            this.form.patchValue(patch, { emitEvent: false });
            this.isParsingXml = false;
        } catch (e) {
            this.isParsingXml = false;
        }
    }

    syncScroll(editor: HTMLTextAreaElement, gutter: HTMLDivElement) {
        gutter.scrollTop = editor.scrollTop;
    }

    // Validation Modal State
    showValidationModal = false;
    validationStatus: 'idle' | 'validating' | 'done' = 'idle';
    validationReport: any = null;
    validationExpandedIssue: any = null;

    closeValidationModal() {
        this.showValidationModal = false;
        this.validationReport = null;
        this.validationStatus = 'idle';
        this.validationExpandedIssue = null;
    }

    getValidationLayers(): string[] {
        if (!this.validationReport?.layer_status) return [];
        return Object.keys(this.validationReport.layer_status).sort();
    }

    getLayerName(k: string): string {
        const names: Record<string, string> = { '1': 'Syntax & Format', '2': 'Schema Validation', '3': 'Business Rules' };
        return names[k] ?? `Layer ${k}`;
    }

    getLayerStatus(k: string): string { return this.validationReport?.layer_status?.[k]?.status ?? ''; }
    getLayerTime(k: string): number { return this.validationReport?.layer_status?.[k]?.time ?? 0; }
    isLayerPass(k: string) { return this.getLayerStatus(k).includes('✅'); }
    isLayerFail(k: string) { return this.getLayerStatus(k).includes('❌'); }
    isLayerWarn(k: string) {
        const s = this.getLayerStatus(k);
        return s.includes('⚠') || s.includes('WARNING') || s.includes('WARN');
    }

    getValidationIssues(): any[] { return this.validationReport?.details ?? []; }

    toggleValidationIssue(issue: any) {
        this.validationExpandedIssue = this.validationExpandedIssue === issue ? null : issue;
    }

    copyFix(text: string, e: MouseEvent) {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
            this.snackBar.open('Copied!', '', { duration: 1500 });
        });
    }


    viewXmlModal() {
        this.closeValidationModal();
        this.switchToPreview();
    }

    editXmlModal() {
        this.closeValidationModal();
        this.currentTab = 'form';
    }

    runValidationModal() {
        this.validateMessage();
    }
}
