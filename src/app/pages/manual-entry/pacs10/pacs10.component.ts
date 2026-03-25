import { CommonModule } from '@angular/common';
import { Component, OnInit, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterModule } from '@angular/router';
import { ConfigService } from '../../../services/config.service';
import { UetrService } from '../../../services/uetr.service';
import { ISO_PURPOSE_CODES } from '../../../constants/purpose-codes';

@Component({
    selector: 'app-pacs10',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule, MatIconModule, MatSnackBarModule, MatTooltipModule, RouterModule],
    templateUrl: './pacs10.component.html',
    styleUrl: './pacs10.component.css'
})
export class Pacs10Component implements OnInit {
    form!: FormGroup;
    generatedXml = '';
    currentTab: 'form' | 'preview' = 'form';
    editorLineCount: number[] = [];
    isParsingXml = false;

    /** UETR Refresh state */
    uetrError: string | null = null;
    uetrSuccess: string | null = null;
    private uetrSuccessTimer: any;
    
    // Undo/Redo History
    public xmlHistory: string[] = [];
    public xmlHistoryIdx = -1;
    public maxHistory = 50;
    private isInternalChange = false;

    get canUndoXml() { return this.xmlHistoryIdx > 0; }
    get canRedoXml() { return this.xmlHistoryIdx < this.xmlHistory.length - 1; }

    warningTimeouts: { [key: string]: any } = {};
    showMaxLenWarning: { [key: string]: boolean } = {};

    currencies: string[] = [];
    countries: string[] = [];
    categoryPurposes: string[] = [];
    purposes: string[] = [];
    chargeBearers = ['SHAR', 'DEBT', 'CRED', 'SLEV'];
    copyDuplicateEnums = ['COPY', 'CODU', 'DUPL'];
    priorityEnums = ['HIGH', 'NORM', 'LOW'];

    agentPrefixes = ['instgAgt', 'instdAgt', 'dbtrAgt', 'cdtrAgt'];
    partyPrefixes = ['dbtr', 'cdtr', 'ultmtDbtr', 'ultmtCdtr'];

    constructor(
        private fb: FormBuilder,
        private http: HttpClient,
        private config: ConfigService,
        private snackBar: MatSnackBar,
        private router: Router,
        private uetrService: UetrService
    ) { }

    ngOnInit() {
        this.fetchCodelists();
        this.buildForm();
        this.generateXml();
        
        // Auto-sync AppHdr Fr/To BICs with GrpHdr InstgAgt/InstdAgt
        // Auto-sync AppHdr Fr/To BICs with GrpHdr InstgAgt/InstdAgt
        this.form.get('fromBic')?.valueChanges.subscribe(v => this.form.patchValue({ instgAgtBic: v }, { emitEvent: false }));
        this.form.get('toBic')?.valueChanges.subscribe(v => this.form.patchValue({ instdAgtBic: v }, { emitEvent: false }));
        this.form.get('instgAgtBic')?.valueChanges.subscribe(v => this.form.patchValue({ fromBic: v }, { emitEvent: false }));
        this.form.get('instdAgtBic')?.valueChanges.subscribe(v => this.form.patchValue({ toBic: v }, { emitEvent: false }));

        this.form.valueChanges.subscribe(() => {
            this.updateConditionalValidators();
            this.updateClearingSystemValidation();
            this.generateXml();
        });
        
        // Init history
        this.pushHistory();
    }

    private updateClearingSystemValidation() {
        const systems = [...this.agentPrefixes, ...this.partyPrefixes].map(p => {
            return this.form.get(p + 'ClrSysCd')?.value?.trim()?.toUpperCase();
        });

        const anyT2 = systems.includes('T2');
        const anyCHAPS = systems.includes('CHAPS');
        const anyCHIPS = systems.includes('CHIPS');
        const anyFED = systems.includes('FED');

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

        // CHIPS Validation
        if (anyCHIPS && ccy !== 'USD' && ccy !== '') {
            if (!currencyCtrl?.hasError('chips')) {
                currencyCtrl?.setErrors({ ...currencyCtrl.errors, chips: true });
            }
        } else if (currencyCtrl?.hasError('chips')) {
            const errors = { ...currencyCtrl.errors };
            delete errors['chips'];
            currencyCtrl.setErrors(Object.keys(errors).length ? errors : null);
        }

        // FED Validation
        if (anyFED && ccy !== 'USD' && ccy !== '') {
            if (!currencyCtrl?.hasError('fed')) {
                currencyCtrl?.setErrors({ ...currencyCtrl.errors, fed: true });
            }
        } else if (currencyCtrl?.hasError('fed')) {
            const errors = { ...currencyCtrl.errors };
            delete errors['fed'];
            currencyCtrl.setErrors(Object.keys(errors).length ? errors : null);
        }

        // ClrSysRef Validation (Forbidden if no standard clearing system)
        const standardSystems = ['T2', 'CHAPS', 'CHIPS', 'FED', 'RTGS'];
        const hasStandardClearing = systems.some(s => standardSystems.includes(s));
        const clrRefCtrl = this.form.get('clrSysRef');
        if (clrRefCtrl?.value?.trim() && !hasStandardClearing) {
            if (!clrRefCtrl.hasError('forbidden')) {
                clrRefCtrl.setErrors({ ...clrRefCtrl.errors, forbidden: true });
            }
        } else if (clrRefCtrl?.hasError('forbidden')) {
            const errors = { ...clrRefCtrl.errors };
            delete errors['forbidden'];
            clrRefCtrl.setErrors(Object.keys(errors).length ? errors : null);
        }
    }

    private updateConditionalValidators() {
        const ADDR_PATTERN = Validators.pattern(/^[a-zA-Z0-9\/\-\?:\(\)\.,\+' ]+$/);
        [...this.agentPrefixes, ...this.partyPrefixes].forEach(p => {
            const addrType = this.form.get(p + 'AddrType')?.value;
            const ctryCtrl = this.form.get(p + 'Ctry');
            const twnNmCtrl = this.form.get(p + 'TwnNm');

            const nameCtrl = this.form.get(p + 'Name');
            const addrTypeCtrl = this.form.get(p + 'AddrType');
            const name = nameCtrl?.value?.trim();

            if (name) {
                if (addrType === 'none') {
                    addrTypeCtrl?.setErrors({ ...addrTypeCtrl.errors, linked: true });
                } else {
                    const errors = { ...addrTypeCtrl?.errors };
                    delete errors['linked'];
                    addrTypeCtrl?.setErrors(Object.keys(errors).length ? errors : null);
                }
            } else if (addrType !== 'none') {
                nameCtrl?.setErrors({ ...nameCtrl?.errors, linked: true });
            } else {
                // Clear linked errors
                [nameCtrl, addrTypeCtrl].forEach(ctrl => {
                    const errors = { ...ctrl?.errors };
                    delete errors['linked'];
                    ctrl?.setErrors(Object.keys(errors).length ? errors : null);
                });
            }

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
                    twnNmCtrl?.setValidators([Validators.required, Validators.maxLength(35), ADDR_PATTERN]);
                    twnNmCtrl?.updateValueAndValidity({ emitEvent: false });
                }
            } else {
                if (twnNmCtrl?.hasValidator(Validators.required)) {
                    twnNmCtrl?.clearValidators();
                    twnNmCtrl?.setValidators([Validators.maxLength(35), ADDR_PATTERN]);
                    twnNmCtrl?.updateValueAndValidity({ emitEvent: false });
                }
            }

            // Mixed Address Rule: If any structured field exists + any AdrLine exists => Town and Country are mandatory.
            const hasStructured = ['Dept', 'SubDept', 'StrtNm', 'BldgNb', 'BldgNm', 'Flr', 'PstBx', 'Room', 'PstCd', 'TwnNm', 'TwnLctnNm', 'DstrctNm', 'CtrySubDvsn', 'Ctry'].some(f => !!this.form.get(p + f)?.value);
            const hasAdrLine = !!(this.form.get(p + 'AdrLine1')?.value || this.form.get(p + 'AdrLine2')?.value || this.form.get(p + 'AdrLine3')?.value);
            
            if (hasStructured && hasAdrLine) {
                if (!ctryCtrl?.hasValidator(Validators.required)) {
                    ctryCtrl?.addValidators(Validators.required);
                    ctryCtrl?.updateValueAndValidity({ emitEvent: false });
                }
                if (!twnNmCtrl?.hasValidator(Validators.required)) {
                    twnNmCtrl?.addValidators(Validators.required);
                    twnNmCtrl?.updateValueAndValidity({ emitEvent: false });
                }
            }
        });

        // Party Identification Validators
        this.partyPrefixes.forEach(p => {
            const idType = this.form.get(p + 'IdType')?.value;

            // Org Id Validators
            const orgOthrIdCtrl = this.form.get(p + 'OrgOthrId');
            const orgOthrSchme = this.form.get(p + 'OrgOthrSchmeNmCd');
            if (idType === 'org' && orgOthrIdCtrl?.value?.trim()) {
                orgOthrSchme?.setValidators([Validators.required, Validators.maxLength(4)]);
            } else {
                orgOthrSchme?.clearValidators();
                orgOthrSchme?.setValidators([Validators.maxLength(4)]);
            }
            orgOthrSchme?.updateValueAndValidity({ emitEvent: false });

            // AnyBIC Validator
            const anyBic = this.form.get(p + 'OrgAnyBIC');
            if (idType === 'org') {
                anyBic?.setValidators([Validators.pattern(/^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)]);
            } else {
                anyBic?.clearValidators();
            }
            anyBic?.updateValueAndValidity({ emitEvent: false });

            // LEI Validator
            const lei = this.form.get(p + 'OrgLEI');
            if (idType === 'org') {
                lei?.setValidators([Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)]);
            } else {
                lei?.clearValidators();
            }
            lei?.updateValueAndValidity({ emitEvent: false });
        });

        // Account / Scheme Linkage
        [...this.agentPrefixes, ...this.partyPrefixes].forEach(p => {
            const acctCtrl = this.form.get(p + 'Acct');
            const schemeCtrl = this.form.get(p + 'AcctSchemeNm');
            const prtryCtrl = this.form.get(p + 'AcctPrtry');
            const val = acctCtrl?.value?.trim() || '';

            if (val && !/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/i.test(val)) {
                // Not IBAN => Othr => SchmeNm or Prtry required
                if (!schemeCtrl?.value && !prtryCtrl?.value) {
                    schemeCtrl?.setErrors({ ...schemeCtrl.errors, required: true });
                } else {
                    const errors = { ...schemeCtrl?.errors };
                    delete errors['required'];
                    schemeCtrl?.setErrors(Object.keys(errors).length ? errors : null);
                }
            } else {
                const errors = { ...schemeCtrl?.errors };
                delete errors['required'];
                schemeCtrl?.setErrors(Object.keys(errors).length ? errors : null);
            }
        });
    }

    @HostListener('input', ['$event'])
    onInput(event: any) {
        const target = event.target as HTMLInputElement;
        if (!target) return;
        const name = target.getAttribute('formControlName');
        if (name && (name.toLowerCase().includes('bic') || name.toLowerCase().includes('iban'))) {
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const upperValue = target.value.toUpperCase();
            if (target.value !== upperValue) {
                target.value = upperValue;
                if (start !== null && end !== null) {
                    target.setSelectionRange(start, end);
                }
                this.form.get(name)?.patchValue(upperValue, { emitEvent: false });
            }
        }
    }

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

        // 2. MaxLength Warning logic
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

    private fetchCodelists() {
        this.http.get<any>(this.config.getApiUrl('/codelists/currency')).subscribe({
            next: (res) => { if (res && res.codes) this.currencies = res.codes; },
            error: (err) => console.error('Failed to load currencies', err)
        });
        this.http.get<any>(this.config.getApiUrl('/codelists/country')).subscribe({
            next: (res) => { if (res && res.codes) this.countries = res.codes; },
            error: (err) => console.error('Failed to load countries', err)
        });
        this.http.get<any>(this.config.getApiUrl('/codelists/ctgyPurp')).subscribe({
            next: (res) => {
                if (res && res.codes && res.codes.length > 0) this.categoryPurposes = res.codes;
                else this.categoryPurposes = ['ADVA', 'AGRT', 'CASH', 'COLL', 'DIVD', 'GOVT', 'HEDG', 'INTC', 'LOAN', 'OTHR', 'PENS', 'SALA', 'SUPP', 'TAXS', 'TREA', 'VATX'];
            },
            error: (err) => console.error('Failed to load category purposes', err)
        });
        this.http.get<any>(this.config.getApiUrl('/codelists/purp')).subscribe({
            next: (res) => { if (res && res.codes) this.purposes = [...new Set([...res.codes, ...ISO_PURPOSE_CODES])].sort(); },
            error: (err) => { this.purposes = [...ISO_PURPOSE_CODES].sort(); }
        });
    }

    isoNow(): string {
        const d = new Date(), p = (n: number) => n.toString().padStart(2, '0');
        const off = -d.getTimezoneOffset(), s = off >= 0 ? '+' : '-';
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${s}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
    }

    formatCbprDateTime(dt: string): string {
        if (!dt) return this.isoNow();
        let res = dt.trim();
        if (res.endsWith('Z')) res = res.replace('Z', '+00:00');
        res = res.replace(/\.\d{1,}/, '');
        if (!/[+-]\d{2}:\d{2}$/.test(res)) res += '+00:00';
        return res;
    }

    private buildForm() {
        const BIC = [Validators.required, Validators.pattern(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)];
        const BIC_OPT = [Validators.pattern(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)];
        const SAFE_NAME = Validators.pattern(/^[a-zA-Z0-9 .,()'\-]+$/);
        const ADDR_PATTERN = Validators.pattern(/^[a-zA-Z0-9\/\-\?:\(\)\.,\+' ]+$/);

        const c: any = {
            fromBic: ['BBBBUS33XXX', BIC], 
            toBic: ['CCCCGB2LXXX', BIC], 
            bizMsgId: ['MSG-2026-FI-001', [Validators.required, Validators.maxLength(35), ADDR_PATTERN]],
            msgId: ['M-2026-FI-001', [Validators.required, Validators.maxLength(35), ADDR_PATTERN]], 
            creDtTm: [this.isoNow(), Validators.required],
            nbOfTxs: ['1', [Validators.required, Validators.pattern(/^[1-9]\d{0,14}$/)]],
            cdtId: ['CDT-FI-999-01', [Validators.required, Validators.maxLength(35), ADDR_PATTERN]],
            cdtrAgtBic: ['BBBBUS33XXX', BIC_OPT],
            cdtrBic: ['CCCCGB2LXXX', BIC],
            instrId: ['I-2026-FI-010', [Validators.required, Validators.maxLength(35), ADDR_PATTERN]],
            endToEndId: ['E2E-2026-FI-010', [Validators.required, Validators.maxLength(35), ADDR_PATTERN]],
            txId: ['', [Validators.maxLength(35), ADDR_PATTERN]],
            uetr: ['550e8400-e29b-41d4-a716-446655440020', [Validators.required, Validators.pattern(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)]],
            clrSysRef: ['', [Validators.pattern(/^[A-Za-z0-9]{1,35}$/)]],
            
            // AppHdr extensions
            copyDplct: [''], pssblDplct: [''], prty: [''],
            
            // Payment Type Info
            instrPrty: [''],
            svcLvlCd: ['', [Validators.maxLength(4), Validators.pattern(/^[A-Z0-9]{4}$/)]], 
            svcLvlPrtry: ['', [Validators.maxLength(35), ADDR_PATTERN]],
            lclInstrmCd: ['', [Validators.maxLength(4)]], 
            lclInstrmPrtry: ['', [Validators.maxLength(35), ADDR_PATTERN]],
            ctgyPurpCd: ['', [Validators.pattern(/^[A-Z]{4}$/)]], 
            ctgyPurpPrtry: ['', [Validators.maxLength(35), ADDR_PATTERN]],
            
            amount: ['25000.00', [Validators.required, Validators.pattern(/^\d{1,18}(\.\d{1,5})?$/)]], 
            currency: ['EUR', [Validators.required, Validators.pattern(/^[A-Z]{3}$/)]],
            intrBkSttlmDt: [new Date().toISOString().split('T')[0], Validators.required],
            purposeCd: ['', [Validators.pattern(/^[A-Z]{4}$/)]], 
            purposePrtry: ['', [Validators.maxLength(35), ADDR_PATTERN]],
            remittanceInfo: ['', [Validators.maxLength(140), ADDR_PATTERN]],
            instrForDbtrAgt: ['', [Validators.maxLength(140), ADDR_PATTERN]],
            
            sttlmTmReqCLSTm: ['', [Validators.pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)]],
            sttlmTmReqTillTm: ['', [Validators.pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)]],
            sttlmTmReqFrTm: ['', [Validators.pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)]],
            sttlmTmReqRjctTm: ['', [Validators.pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)]],
            
            dbtrBic: ['BBBBUS33XXX', BIC],
            dbtrAgtBic: ['', BIC_OPT],
            instgAgtBic: ['BBBBUS33XXX', BIC],
            instdAgtBic: ['CCCCGB2LXXX', BIC],
            dbtrAcct: ['471932901234', [Validators.required, Validators.pattern(/^[A-Z0-9]{5,34}$/)]],
            cdtrAcct: ['471932905678', [Validators.required, Validators.pattern(/^[A-Z0-9]{5,34}$/)]]
        };

        [...this.agentPrefixes, ...this.partyPrefixes].forEach(p => {
            if (!c[p + 'AddrType']) c[p + 'AddrType'] = ['none'];
            ['Dept', 'SubDept', 'StrtNm', 'BldgNb', 'BldgNm', 'Flr', 'PstBx', 'Room', 'PstCd', 'TwnNm', 'TwnLctnNm', 'DstrctNm', 'CtrySubDvsn', 'Ctry', 'AdrLine1', 'AdrLine2', 'AdrLine3', 'AdrTpCd', 'AdrTpPrtry'].forEach(f => {
                if (!c[p + f]) c[p + f] = ['', [Validators.maxLength(f === 'Ctry' ? 2 : 70), ADDR_PATTERN]];
            });
            if (!c[p + 'Name']) c[p + 'Name'] = ['', [Validators.maxLength(140), SAFE_NAME]];
            if (!c[p + 'Lei']) c[p + 'Lei'] = ['', [Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)]];
            if (!c[p + 'ClrSysCd']) c[p + 'ClrSysCd'] = ['', Validators.maxLength(4)];
            if (!c[p + 'ClrSysMmbId']) c[p + 'ClrSysMmbId'] = ['', Validators.maxLength(35)];
            if (!c[p + 'Acct']) c[p + 'Acct'] = ['', [Validators.pattern(/^[A-Z0-9]{5,34}$/)]];
            // Detailed Account fields
            ['AcctSchemeNm', 'AcctPrtry', 'AcctIssr', 'AcctTypeCd', 'AcctTypePrtry', 'AcctCcy', 'AcctNm', 'AcctProxyId', 'AcctProxyTypeCd', 'AcctProxyTypePrtry'].forEach(f => {
                c[p + f] = [''];
            });
            if (!this.agentPrefixes.includes(p)) {
                if (!c[p + 'IdType']) c[p + 'IdType'] = ['none'];
                if (!c[p + 'OrgAnyBIC']) c[p + 'OrgAnyBIC'] = ['', BIC_OPT];
                if (!c[p + 'OrgLEI']) c[p + 'OrgLEI'] = ['', [Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)]];
                if (!c[p + 'OrgClrSysCd']) c[p + 'OrgClrSysCd'] = ['', Validators.maxLength(4)];
                if (!c[p + 'OrgClrSysMmbId']) c[p + 'OrgClrSysMmbId'] = ['', Validators.maxLength(35)];
                if (!c[p + 'OrgOthrId']) c[p + 'OrgOthrId'] = ['', [Validators.maxLength(35), ADDR_PATTERN]];
                if (!c[p + 'OrgOthrSchmeNmCd']) c[p + 'OrgOthrSchmeNmCd'] = ['', [Validators.maxLength(4), Validators.pattern(/^[A-Z0-9]{1,4}$/)]];
            }
        });

        this.form = this.fb.group(c);
    }

    generateXml() {
        if (this.isParsingXml) return;

        const v = this.form.value;
        const creDtTm = this.formatCbprDateTime(v.creDtTm);

        let appHdr = `\t\t<Fr><FIId><FinInstnId><BICFI>${this.e(v.fromBic)}</BICFI></FinInstnId></FIId></Fr>\n`;
        appHdr += `\t\t<To><FIId><FinInstnId><BICFI>${this.e(v.toBic)}</BICFI></FinInstnId></FIId></To>\n`;
        appHdr += `\t\t<BizMsgIdr>${this.e(v.bizMsgId)}</BizMsgIdr>\n\t\t<MsgDefIdr>pacs.010.001.03</MsgDefIdr>\n\t\t<BizSvc>swift.cbprplus.02</BizSvc>\n`;
        
        appHdr += `\t\t<CreDt>${creDtTm}</CreDt>\n`;
        if (v.copyDplct) appHdr += this.el('CpyDplct', v.copyDplct, 2);
        if (v.pssblDplct) appHdr += this.el('PssblDplct', v.pssblDplct, 2);
        if (v.prty) appHdr += this.el('Prty', v.prty, 2);

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<BusMsgEnvlp xmlns="urn:swift:xsd:envelope">
\t<AppHdr xmlns="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
${appHdr}\t</AppHdr>
\t<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.010.001.03">
\t\t<FIDrctDbt>
\t\t\t<GrpHdr>
\t\t\t\t<MsgId>${this.e(v.msgId)}</MsgId>
\t\t\t\t<CreDtTm>${creDtTm}</CreDtTm>
\t\t\t\t<NbOfTxs>${this.e(v.nbOfTxs)}</NbOfTxs>
\t\t\t</GrpHdr>
\t\t\t<CdtInstr>
\t\t\t\t<CdtId>${this.e(v.cdtId)}</CdtId>
${this.agt('InstgAgt', 'instgAgt', v, 4, true)}
${this.agt('InstdAgt', 'instdAgt', v, 4, true)}
${this.agt('CdtrAgt', 'cdtrAgt', v, 4)}
${this.fullAcct('CdtrAgtAcct', 'cdtrAgt', v, 4)}
${this.agt('Cdtr', 'cdtr', v, 4)}
${this.fullAcct('CdtrAcct', 'cdtr', v, 4)}
				<DrctDbtTxInf>
					<PmtId>
${this.el('InstrId', v.instrId, 6)}${this.el('EndToEndId', v.endToEndId, 6)}${this.el('TxId', v.txId, 6)}${this.el('UETR', v.uetr, 6)}${this.el('ClrSysRef', v.clrSysRef, 6)}
					</PmtId>
${this.pmtTpInf(v)}
					<IntrBkSttlmAmt Ccy="${this.e(v.currency)}">${this.e(v.amount)}</IntrBkSttlmAmt>
					<IntrBkSttlmDt>${this.e(v.intrBkSttlmDt)}</IntrBkSttlmDt>
${this.sttlmTmReq(v)}
${this.party('UltmtDbtr', 'ultmtDbtr', v, 5)}
${this.agt('Dbtr', 'dbtr', v, 5)}
${this.fullAcct('DbtrAcct', 'dbtr', v, 5)}
${this.agt('DbtrAgt', 'dbtrAgt', v, 5)}
${this.fullAcct('DbtrAgtAcct', 'dbtrAgt', v, 5)}
${this.party('UltmtCdtr', 'ultmtCdtr', v, 5)}
${this.el('InstrForDbtrAgt', v.instrForDbtrAgt, 5)}
${this.purp(v)}
${this.rmtInf(v)}
				</DrctDbtTxInf>
\t\t\t</CdtInstr>
\t\t</FIDrctDbt>
\t</Document>
</BusMsgEnvlp>`;
        this.onEditorChange(xml, true);
    }

    private pmtTpInf(v: any) {
        let res = '';
        if (v.instrPrty) res += this.el('InstrPrty', v.instrPrty, 6);
        if (v.svcLvlCd || v.svcLvlPrtry) {
            let sv = v.svcLvlCd ? this.el('Cd', v.svcLvlCd, 7) : this.el('Prtry', v.svcLvlPrtry, 7);
            res += this.tag('SvcLvl', sv, 6);
        }
        if (v.lclInstrmCd || v.lclInstrmPrtry) {
            let lc = v.lclInstrmCd ? this.el('Cd', v.lclInstrmCd, 7) : this.el('Prtry', v.lclInstrmPrtry, 7);
            res += this.tag('LclInstrm', lc, 6);
        }
        if (v.ctgyPurpCd || v.ctgyPurpPrtry) {
            let cp = v.ctgyPurpCd ? this.el('Cd', v.ctgyPurpCd, 7) : this.el('Prtry', v.ctgyPurpPrtry, 7);
            res += this.tag('CtgyPurp', cp, 6);
        }
        return res ? this.tag('PmtTpInf', res, 5) : '';
    }

    private sttlmTmReq(v: any) {
        let res = '';
        if (v.sttlmTmReqCLSTm) res += this.el('CLSTm', v.sttlmTmReqCLSTm, 6);
        if (v.sttlmTmReqTillTm) res += this.el('TillTm', v.sttlmTmReqTillTm, 6);
        if (v.sttlmTmReqFrTm) res += this.el('FrTm', v.sttlmTmReqFrTm, 6);
        if (v.sttlmTmReqRjctTm) res += this.el('RjctTm', v.sttlmTmReqRjctTm, 6);
        return res ? this.tag('SttlmTmReq', res, 5) : '';
    }

    private purp(v: any) {
        if (v.purposeCd) return this.tag('Purp', this.el('Cd', v.purposeCd, 6), 5);
        if (v.purposePrtry) return this.tag('Purp', this.el('Prtry', v.purposePrtry, 6), 5);
        return '';
    }

    private rmtInf(v: any) {
        if (!v.remittanceInfo) return '';
        return this.tag('RmtInf', this.el('Ustrd', v.remittanceInfo, 6), 5);
    }

    private fullAcct(tag: string, p: string, v: any, indent = 4) {
        let id = this.formatAcctDetails(v, p, indent + 2);
        if (!id) return '';
        let res = this.tag('Id', id, indent + 1);
        if (v[p + 'AcctTypeCd'] || v[p + 'AcctTypePrtry']) {
            let tpVal = v[p + 'AcctTypePrtry'] || v[p + 'AcctTypeCd'];
            res += this.tag('Tp', this.el('Prtry', tpVal, indent + 3), indent + 1);
        }
        if (v[p + 'AcctCcy']) res += this.el('Ccy', v[p + 'AcctCcy'], indent + 1);
        if (v[p + 'AcctNm']) res += this.el('Nm', v[p + 'AcctNm'], indent + 1);
        if (v[p + 'AcctProxyId']) {
            let pr = this.el('Id', v[p + 'AcctProxyId'], indent + 3);
            if (v[p + 'AcctProxyTypeCd'] || v[p + 'AcctProxyTypePrtry']) {
                let pxtp = v[p + 'AcctProxyTypeCd'] ? this.el('Cd', v[p + 'AcctProxyTypeCd'], indent + 5) : this.el('Prtry', v[p + 'AcctProxyTypePrtry'], indent + 5);
                pr += this.tag('Tp', pxtp, indent + 4);
            }
            res += this.tag('Prxy', pr, indent + 1);
        }
        return this.tag(tag, res, indent);
    }

    private formatAcctDetails(v: any, p: string, tabs: number) {
        let val = v[p + 'Acct'];
        if (!val) return '';
        if (/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/i.test(val) && val.length >= 10) {
            return this.el('IBAN', val, tabs);
        }
        let othr = this.el('Id', val, tabs + 2);
        if (v[p + 'AcctSchemeNm'] || v[p + 'AcctPrtry']) {
            let sch = v[p + 'AcctSchemeNm'] ? this.el('Cd', v[p + 'AcctSchemeNm'], tabs + 4) : this.el('Prtry', v[p + 'AcctPrtry'], tabs + 4);
            othr += this.tag('SchmeNm', sch, tabs + 3);
        }
        if (v[p + 'AcctIssr']) othr += this.el('Issr', v[p + 'AcctIssr'], tabs + 2);
        return this.tag('Othr', othr, tabs + 1);
    }

    private e(v: string) { return (v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    private tabs(n: number) { return '\t'.repeat(n); }
    private el(tag: string, val: string, indent = 3) { return val?.trim() ? `${this.tabs(indent)}<${tag}>${this.e(val)}</${tag}>\n` : ''; }
    private tag(tag: string, content: string, indent = 3) { return content?.trim() ? `${this.tabs(indent)}<${tag}>\n${content}${this.tabs(indent)}</${tag}>\n` : ''; }

    agt(tag: string, prefix: string, v: any, indent = 3, onlyBic = false) {
        const bic = v[prefix + 'Bic'];
        const name = v[prefix + 'Name'];
        const lei = v[prefix + 'Lei'];
        const clrCd = v[prefix + 'ClrSysCd'];
        const clrMmb = v[prefix + 'ClrSysMmbId'];
        
        if (!bic && !name && !lei && !clrMmb && v[prefix + 'AddrType'] === 'none') return '';

        let content = '';
        if (bic) content += this.el('BICFI', bic, indent + 2);
        if (clrMmb) {
            let clr = this.el('MmbId', clrMmb, indent + 3);
            if (clrCd) clr = this.tag('ClrSysId', this.el('Cd', clrCd, indent + 4), indent + 3) + clr;
            content += this.tag('ClrSysMmbId', clr, indent + 2);
        }
        if (lei) content += this.el('LEI', lei, indent + 2);
        
        if (!onlyBic) {
            const addr = this.addrXml(v, prefix, indent + 2);
            if (name) content += this.el('Nm', name, indent + 2);
            if (addr) content += addr;
        }

        return this.tag(tag, this.tag('FinInstnId', content, indent + 1), indent);
    }

    party(tag: string, prefix: string, v: any, indent = 4) {
        const bic = v[prefix + 'Bic'];
        const name = v[prefix + 'Name'];
        const lei = v[prefix + 'Lei'];
        const clrMmb = v[prefix + 'ClrSysMmbId'];
        if (!bic && !name && !lei && !clrMmb && v[prefix + 'AddrType'] === 'none') return '';

        let res = '';
        if (name) res += this.el('Nm', name, indent + 1);
        res += this.addrXml(v, prefix, indent + 1);

        let id = '';
        if (bic || lei || clrMmb) {
            let org = '';
            if (bic) org += this.el('AnyBIC', bic, indent + 3);
            if (lei) org += this.el('LEI', lei, indent + 3);
            if (clrMmb) {
                let othr = this.el('Id', clrMmb, indent + 5) + this.tag('SchmeNm', this.el('Prtry', 'ClrSysMmbId', indent + 6), indent + 5);
                org += this.tag('Othr', othr, indent + 4);
            }
            id = this.tag('OrgId', org, indent + 2);
        }
        if (id) res += this.tag('Id', id, indent + 1);

        return this.tag(tag, res, indent);
    }

    addrXml(v: any, p: string, indent = 4): string {
        const type = v[p + 'AddrType']; if (!type || type === 'none') return '';
        let lines = '';
        const t = this.tabs(indent + 1);
        
        // Address Type Code
        if (v[p + 'AdrTpCd']) {
            lines += this.tag('AdrTp', this.el('Cd', v[p + 'AdrTpCd'], indent + 2), indent + 1);
        } else if (v[p + 'AdrTpPrtry']) {
            lines += this.tag('AdrTp', this.el('Prtry', v[p + 'AdrTpPrtry'], indent + 2), indent + 1);
        }

        const hasStructured = ['Dept', 'SubDept', 'StrtNm', 'BldgNb', 'BldgNm', 'Flr', 'PstBx', 'Room', 'PstCd', 'TwnNm', 'TwnLctnNm', 'DstrctNm', 'CtrySubDvsn', 'Ctry'].some(f => v[p + f]);

        if (type === 'structured' || type === 'hybrid') {
            ['Dept', 'SubDept', 'StrtNm', 'BldgNb', 'BldgNm', 'Flr', 'PstBx', 'Room', 'PstCd', 'TwnNm', 'TwnLctnNm', 'DstrctNm', 'CtrySubDvsn', 'Ctry'].forEach(f => {
                if (v[p + f]) lines += `${t}<${f}>${this.e(v[p + f])}</${f}>\n`;
            });
        }
        if (type === 'unstructured' || type === 'hybrid') {
            const maxLines = hasStructured ? 2 : 7;
            [1, 2, 3].forEach(i => {
                if (i <= maxLines && v[p + 'AdrLine' + i]) lines += `${t}<AdrLine>${this.e(v[p + 'AdrLine' + i])}</AdrLine>\n`;
            });
        }
        return lines ? this.tag('PstlAdr', lines, indent) : '';
    }

    partyIdXml(v: any, p: string, indent = 4): string {
        const type = v[p + 'IdType']; if (!type || type === 'none') return '';
        let res = '';
        if (type === 'org') {
            let org = '';
            if (v[p + 'OrgAnyBIC']) org += this.el('AnyBIC', v[p + 'OrgAnyBIC'], indent + 2);
            if (v[p + 'OrgLEI']) org += this.el('LEI', v[p + 'OrgLEI'], indent + 2);
            if (v[p + 'OrgOthrId']) {
                let othr = this.el('Id', v[p + 'OrgOthrId'], indent + 3);
                if (v[p + 'OrgOthrSchmeNmCd']) othr += this.tag('SchmeNm', this.el('Cd', v[p + 'OrgOthrSchmeNmCd'], indent + 5), indent + 4);
                org += this.tag('Othr', othr, indent + 2);
            }
            res = this.tag('OrgId', org, indent + 1);
        }
        return res ? this.tag('Id', res, indent) : '';
    }

    refreshUetr(): void {
        this.uetrError = null;
        this.uetrSuccess = null;
        if (this.uetrSuccessTimer) clearTimeout(this.uetrSuccessTimer);
        const prevUetr = this.form.get('uetr')?.value || '';
        const newUetr = this.uetrService.generate();
        if (newUetr === prevUetr) return;
        this.form.get('uetr')?.setValue(newUetr);
        this.uetrSuccess = 'UETR refreshed successfully';
        this.uetrSuccessTimer = setTimeout(() => { this.uetrSuccess = null; }, 3000);
    }

    validateManualUetr(): void {
        const val = this.form.get('uetr')?.value;
        this.uetrError = UetrService.UUID_V4_PATTERN.test(val) ? null : 'Invalid UETR format';
    }

    onUetrPaste(_event: ClipboardEvent): void {
        setTimeout(() => {
            const ctrl = this.form.get('uetr');
            if (ctrl) { ctrl.setValue(ctrl.value.toLowerCase()); this.validateManualUetr(); }
        }, 0);
    }

    syncScroll(editor: any, gutter: any) {
        if (gutter) gutter.scrollTop = editor.scrollTop;
    }

    onEditorChange(content: string, fromForm = false) {
        if (!this.isInternalChange && !fromForm) this.pushHistory();
        this.generatedXml = content;
        const lines = content.split('\n').length;
        this.editorLineCount = Array.from({ length: lines }, (_, i) => i + 1);
        if (!fromForm) this.parseXmlToForm(content);
    }

    undoXml() {
        if (this.xmlHistoryIdx > 0) {
            this.xmlHistoryIdx--;
            this.isInternalChange = true;
            this.generatedXml = this.xmlHistory[this.xmlHistoryIdx];
            this.refreshLineCount();
            this.parseXmlToForm(this.generatedXml);
            setTimeout(() => this.isInternalChange = false, 10);
        }
    }

    redoXml() {
        if (this.xmlHistoryIdx < this.xmlHistory.length - 1) {
            this.xmlHistoryIdx++;
            this.isInternalChange = true;
            this.generatedXml = this.xmlHistory[this.xmlHistoryIdx];
            this.refreshLineCount();
            this.parseXmlToForm(this.generatedXml);
            setTimeout(() => this.isInternalChange = false, 10);
        }
    }

    private pushHistory() {
        if (this.xmlHistoryIdx >= 0 && this.xmlHistory[this.xmlHistoryIdx] === this.generatedXml) return;
        if (this.xmlHistoryIdx < this.xmlHistory.length - 1) this.xmlHistory.splice(this.xmlHistoryIdx + 1);
        this.xmlHistory.push(this.generatedXml);
        if (this.xmlHistory.length > this.maxHistory) this.xmlHistory.shift();
        else this.xmlHistoryIdx++;
    }

    private refreshLineCount() {
        const lines = (this.generatedXml || '').split('\n').length;
        this.editorLineCount = Array.from({ length: lines }, (_, i) => i + 1);
    }

    formatXml() {
        try {
            const P = (n: any) => n.trim();
            const nodes = this.generatedXml.split(/>\s*</);
            let fmt = '', ind = '', tab = '    ';
            nodes.forEach(n => {
                if (n.startsWith('/')) ind = ind.substring(tab.length);
                fmt += ind + (n.startsWith('<') ? '' : '<') + n + (n.endsWith('>') ? '' : '>') + '\r\n';
                if (!n.startsWith('/') && !n.endsWith('/') && !n.startsWith('?')) ind += tab;
            });
            this.generatedXml = fmt.trim();
            this.refreshLineCount();
        } catch (e) { }
    }

    toggleCommentXml() { }

    parseXmlToForm(xml: string) { }

    validateXml() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            this.snackBar.open('Please fix form errors.', 'Close', { duration: 3000 });
            return;
        }
        this.http.post(this.config.getApiUrl('/validate'), {
            xml_content: this.generatedXml,
            message_type: 'pacs.010.001.03'
        }).subscribe((res: any) => {
            sessionStorage.setItem('validationResult', JSON.stringify(res));
            this.router.navigate(['/validate']);
        });
    }

    downloadXml() {
        const b = new Blob([this.generatedXml], { type: 'application/xml' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(b);
        a.download = `pacs010-${Date.now()}.xml`; a.click();
    }

    copyXml() {
        navigator.clipboard.writeText(this.generatedXml).then(() => {
            this.snackBar.open('Copied to clipboard!', 'Close', { duration: 2000 });
        });
    }

    err(c: string): string | null {
        const ctrl = this.form.get(c);
        if (ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched)) {
            if (ctrl.errors?.['required']) return 'Required field.';
            if (ctrl.errors?.['pattern']) return 'Invalid format.';
            if (ctrl.errors?.['maxlength']) return `Max ${ctrl.errors['maxlength'].requiredLength} chars.`;
            if (ctrl.errors?.['target2']) return 'T2 requires EUR.';
            if (ctrl.errors?.['linked']) return 'Name and Address must be present together.';
        }
        return null;
    }
}
