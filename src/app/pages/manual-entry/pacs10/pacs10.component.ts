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
    
    // Validation Modal State
    showValidationModal = false;
    validationStatus: 'idle' | 'validating' | 'done' = 'idle';
    validationReport: any = null;
    validationExpandedIssue: any = null;

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
    partyPrefixes = ['dbtr', 'cdtr'];

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
        [...this.agentPrefixes, ...this.partyPrefixes].forEach(p => {
            const cd = this.form.get(p + 'ClrSysCd');
            const mmb = this.form.get(p + 'ClrSysMmbId');
            
            if (cd?.value?.trim() && !mmb?.value?.trim()) {
                mmb?.setErrors({ ...mmb.errors, required: true });
            } else if (mmb?.value?.trim() && !cd?.value?.trim()) {
                cd?.setErrors({ ...cd.errors, required: true });
            } else {
                [cd, mmb].forEach(ctrl => {
                    if (ctrl?.hasError('required')) {
                        const errors = { ...ctrl.errors };
                        delete errors['required'];
                        ctrl.setErrors(Object.keys(errors).length ? errors : null);
                    }
                });
            }
        });

        // Also for Org party parts 
        this.partyPrefixes.forEach(p => {
            const cd = this.form.get(p + 'OrgClrSysCd');
            const mmb = this.form.get(p + 'OrgClrSysMmbId');
            if (cd && mmb) {
                if (cd.value?.trim() && !mmb.value?.trim()) {
                    mmb.setErrors({ ...mmb.errors, required: true });
                } else if (mmb.value?.trim() && !cd.value?.trim()) {
                    cd.setErrors({ ...cd.errors, required: true });
                } else {
                    [cd, mmb].forEach(ctrl => {
                        if (ctrl?.hasError('required')) {
                            const errors = { ...ctrl.errors };
                            delete errors['required'];
                            ctrl.setErrors(Object.keys(errors).length ? errors : null);
                        }
                    });
                }
            }
        });

        const systems = [...this.agentPrefixes, ...this.partyPrefixes].map(p => {
            return this.form.get(p + 'ClrSysCd')?.value?.trim()?.toUpperCase();
        });

        const anyT2 = systems.includes('T2');
        const anyCHAPS = systems.includes('CHAPS');
        const anyCHIPS = systems.includes('CHIPS');
        const anyFED = systems.includes('FED');

        const currencyCtrl = this.form.get('currency');
        // Target2/CHAPS/CHIPS/FED Validation (Moving to on-demand to prevent flow interruption)
        if (currencyCtrl?.hasError('target2') || currencyCtrl?.hasError('chaps') || 
            currencyCtrl?.hasError('chips') || currencyCtrl?.hasError('fed')) {
            const errors = { ...currencyCtrl.errors };
            delete errors['target2'];
            delete errors['chaps'];
            delete errors['chips'];
            delete errors['fed'];
            currencyCtrl.setErrors(Object.keys(errors).length ? errors : null);
        }

        // ClrSysRef Validation (Moving to on-demand to prevent flow interruption)
        const clrRefCtrl = this.form.get('clrSysRef');
        if (clrRefCtrl?.hasError('forbidden')) {
            const errors = { ...clrRefCtrl.errors };
            delete errors['forbidden'];
            clrRefCtrl.setErrors(Object.keys(errors).length ? errors : null);
        }
    }

    private validateFullMessageErrors() {
        const systems = [...this.agentPrefixes, ...this.partyPrefixes].map(p => {
            return this.form.get(p + 'ClrSysCd')?.value?.trim()?.toUpperCase();
        });
        const standardSystems = ['T2', 'CHAPS', 'CHIPS', 'FED', 'RTGS'];
        const hasStandardClearing = systems.some(s => standardSystems.includes(s));
        
        const anyT2 = systems.includes('T2');
        const anyCHAPS = systems.includes('CHAPS');
        const anyCHIPS = systems.includes('CHIPS');
        const anyFED = systems.includes('FED');

        const currencyCtrl = this.form.get('currency');
        const ccy = currencyCtrl?.value;

        // T2 Validation
        if (anyT2 && ccy !== 'EUR' && ccy !== '') {
            currencyCtrl?.setErrors({ ...currencyCtrl.errors, target2: true });
        }
        // CHAPS Validation
        if (anyCHAPS && ccy !== 'GBP' && ccy !== '') {
            currencyCtrl?.setErrors({ ...currencyCtrl.errors, chaps: true });
        }
        // CHIPS Validation
        if (anyCHIPS && ccy !== 'USD' && ccy !== '') {
            currencyCtrl?.setErrors({ ...currencyCtrl.errors, chips: true });
        }
        // FED Validation
        if (anyFED && ccy !== 'USD' && ccy !== '') {
            currencyCtrl?.setErrors({ ...currencyCtrl.errors, fed: true });
        }

        const clrRefCtrl = this.form.get('clrSysRef');
        if (clrRefCtrl?.value?.trim() && !hasStandardClearing) {
            clrRefCtrl.setErrors({ ...clrRefCtrl.errors, forbidden: true });
        }

        // Co-presence rule for FIs: Name and Address must always be together or both absent.
        // Applies to Cdtr, Dbtr, CdtrAgt, DbtrAgt as per ISO 20022/CBPR+ standards.
        ['cdtr', 'dbtr', 'cdtrAgt', 'dbtrAgt'].forEach(p => {
            const name = this.form.get(p + 'Name')?.value?.trim();
            const addrType = this.form.get(p + 'AddrType')?.value;
            const addrTypeCtrl = this.form.get(p + 'AddrType');
            const nameCtrl = this.form.get(p + 'Name');

            if (name && addrType === 'none') {
                addrTypeCtrl?.setErrors({ ...addrTypeCtrl?.errors, linked: true });
            } else if (!name && addrType && addrType !== 'none') {
                nameCtrl?.setErrors({ ...nameCtrl?.errors, linked: true });
            }
        });

        // Cdtr-specific rule: Nm must NEVER be generated without PstlAdr.
        // If cdtrName is filled but addrType is 'none', block with a dedicated error.
        const cdtrName = this.form.get('cdtrName')?.value?.trim();
        const cdtrAddrType = this.form.get('cdtrAddrType')?.value;
        const cdtrAddrCtrl = this.form.get('cdtrAddrType');
        if (cdtrName && cdtrAddrType === 'none') {
            cdtrAddrCtrl?.setErrors({ ...cdtrAddrCtrl?.errors, nmWithoutAddr: true });
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

            // Real-time: Only clear cross-field errors to allow "accept any data" until validation
            [nameCtrl, addrTypeCtrl].forEach(ctrl => {
                const errors = { ...ctrl?.errors };
                delete errors['linked'];
                ctrl?.setErrors(Object.keys(errors).length ? errors : null);
            });

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

            // Hybrid/Mixed Address Logic
            const addrLinesModel = [1, 2, 3, 4, 5, 6, 7].map(i => this.form.get(p + 'AdrLine' + i)?.value);
            const hasAnyAdrLine = addrLinesModel.some(v => !!v);

            if (addrType === 'hybrid') {
                // RULE: In Hybrid/Mixed mode, Town and Country are mandatory
                if (!ctryCtrl?.hasValidator(Validators.required)) {
                    ctryCtrl?.addValidators(Validators.required);
                    ctryCtrl?.updateValueAndValidity({ emitEvent: false });
                }
                if (!twnNmCtrl?.hasValidator(Validators.required)) {
                    twnNmCtrl?.addValidators(Validators.required);
                    twnNmCtrl?.updateValueAndValidity({ emitEvent: false });
                }
                
                // RULE: In Hybrid/Mixed mode, only max 2 AdrLines allowed (3rd line cleared)
                [3].forEach(i => {
                    const ctrl = this.form.get(p + 'AdrLine' + i);
                    if (ctrl?.value) ctrl.setValue('', { emitEvent: false });
                });
            }
            
            // Re-eval mandated fields based on any manual data entry patterns (detecting mixed records)
            const hasStructuredFields = ['Dept', 'SubDept', 'StrtNm', 'BldgNb', 'BldgNm', 'Flr', 'PstBx', 'Room', 'PstCd', 'TwnLctnNm'].some(f => !!this.form.get(p + f)?.value);
            if (hasStructuredFields && hasAnyAdrLine) {
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
                const existing = res && res.codes ? res.codes : [];
                this.categoryPurposes = [...new Set([...existing, 'ADVA', 'AGRT', 'CASH', 'COLL', 'DIVD', 'GOVT', 'HEDG', 'INTC', 'LOAN', 'OTHR', 'PENS', 'SALA', 'SUPP', 'TAXS', 'TREA', 'VATX'])].sort();
            },
            error: () => {
                this.categoryPurposes = ['ADVA', 'AGRT', 'CASH', 'COLL', 'DIVD', 'GOVT', 'HEDG', 'INTC', 'LOAN', 'OTHR', 'PENS', 'SALA', 'SUPP', 'TAXS', 'TREA', 'VATX'].sort();
            }
        });
        this.http.get<any>(this.config.getApiUrl('/codelists/purp')).subscribe({
            next: (res) => {
                const existingCodes = res && res.codes ? res.codes : [];
                this.purposes = [...new Set([...existingCodes, ...ISO_PURPOSE_CODES])].sort();
            },
            error: (err) => {
                console.error('Failed to load purposes', err);
                this.purposes = [...ISO_PURPOSE_CODES].sort();
            }
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
            fromBic: ['BOFAUS3NXXX', BIC], 
            toBic: ['CITIUS33XXX', BIC], 
            bizMsgId: ['BMID-2026-PAC010-001', [Validators.required, Validators.maxLength(35), ADDR_PATTERN]],
            msgId: ['MSGID-2026-PAC010-001', [Validators.required, Validators.maxLength(35), ADDR_PATTERN]], 
            creDtTm: [this.isoNow(), Validators.required],
            nbOfTxs: ['1', [Validators.required, Validators.pattern(/^[1-9]\d{0,14}$/)]],
            cdtId: ['CDT-FI-2026-001', [Validators.required, Validators.maxLength(35), ADDR_PATTERN]],
            
            // Creditor Agent
            cdtrAgtBic: ['CHASUS33XXX', BIC_OPT],
            cdtrAgtName: ['JP MORGAN CHASE BANK', [Validators.maxLength(140), SAFE_NAME]],
            cdtrAgtLei: ['7H6GLXDRUGQFU57RNE97', [Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)]],
            cdtrAgtClrSysCd: ['USFW', Validators.maxLength(4)],
            cdtrAgtClrSysMmbId: ['MEM-CAGT-01', Validators.maxLength(35)],
            cdtrAgtAddrType: ['structured'],
            
            // Creditor
            cdtrBic: ['CITIUS33XXX', BIC],
            cdtrName: ['CITIBANK NA', [Validators.maxLength(140), SAFE_NAME]],
            cdtrLei: ['E57ODZWZ7FF32TWEFS77', [Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)]],
            cdtrClrSysCd: ['USFW', Validators.maxLength(4)],
            cdtrClrSysMmbId: ['MEM-CDTR-01', Validators.maxLength(35)],
            cdtrAddrType: ['structured'],
            
            // Payment IDs
            instrId: ['INSTR-2026-PAC010-001', [Validators.required, Validators.maxLength(35), ADDR_PATTERN]],
            endToEndId: ['E2E-2026-PAC010-001', [Validators.required, Validators.maxLength(35), ADDR_PATTERN]],
            txId: ['TXID-2026-PAC010-001', [Validators.maxLength(35), ADDR_PATTERN]],
            uetr: [this.uetrService.generate(), [Validators.required, Validators.pattern(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)]],
            clrSysRef: ['CLRREF-2026-001', [Validators.pattern(/^[a-zA-Z0-9\/\-\?:\(\)\.,\+' ]+$/), Validators.maxLength(35)]],
            
            // AppHdr extensions
            copyDplct: ['COPY'], pssblDplct: ['true'], prty: ['HIGH'],
            
            // Payment Type Info
            instrPrty: ['HIGH'],
            svcLvlCd: ['G001', [Validators.maxLength(4), Validators.pattern(/^[A-Z0-9]{4}$/)]], 
            svcLvlPrtry: ['', [Validators.maxLength(35), ADDR_PATTERN]],
            lclInstrmCd: ['ONCL', [Validators.maxLength(4)]], 
            lclInstrmPrtry: ['', [Validators.maxLength(35), ADDR_PATTERN]],
            ctgyPurpCd: ['INTC', [Validators.pattern(/^[A-Z]{4}$/)]], 
            ctgyPurpPrtry: ['', [Validators.maxLength(35), ADDR_PATTERN]],
            
            amount: ['250000.00', [Validators.required, Validators.pattern(/^\d{1,18}(\.\d{1,5})?$/)]],
            currency: ['USD', [Validators.required, Validators.pattern(/^[A-Z]{3}$/)]],
            intrBkSttlmDt: [new Date().toISOString().split('T')[0], Validators.required],
            clstTm: ['09:00:00+00:00', [Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d([+-][01]\d:[0-5]\d|Z)$/)]],
            tillTm: ['17:00:00+00:00', [Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d([+-][01]\d:[0-5]\d|Z)$/)]],
            frTm: ['08:00:00+00:00', [Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d([+-][01]\d:[0-5]\d|Z)$/)]],
            rjctTm: ['16:00:00+00:00', [Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d([+-][01]\d:[0-5]\d|Z)$/)]],
            purposeCd: ['INTC', [Validators.pattern(/^[A-Z]{4}$/)]], 
            purposePrtry: ['', [Validators.maxLength(35), ADDR_PATTERN]],
            remittanceInfo: ['Interbank Direct Debit Settlement March 2026', [Validators.maxLength(140), ADDR_PATTERN]],
            instrForDbtrAgt: ['Settle via RTGS system immediately', [Validators.maxLength(140), ADDR_PATTERN]],
            
            // Debtor
            dbtrBic: ['BOFAUS3NXXX', BIC],
            dbtrName: ['BANK OF AMERICA NA', [Validators.maxLength(140), SAFE_NAME]],
            dbtrLei: ['9DI4HL4JZ54KOAHE3750', [Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)]],
            dbtrClrSysCd: ['USFW', Validators.maxLength(4)],
            dbtrClrSysMmbId: ['MEM-DBTR-01', Validators.maxLength(35)],
            dbtrAddrType: ['structured'],
            
            // Debtor Agent
            dbtrAgtBic: ['WFBIUS6SXXX', BIC_OPT],
            dbtrAgtName: ['WELLS FARGO BANK NA', [Validators.maxLength(140), SAFE_NAME]],
            dbtrAgtLei: ['KB1H1DSPRFMYMCUFXT09', [Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)]],
            dbtrAgtClrSysCd: ['USFW', Validators.maxLength(4)],
            dbtrAgtClrSysMmbId: ['MEM-DAGT-01', Validators.maxLength(35)],
            dbtrAgtAddrType: ['structured'],
            
            // Instructing / Instructed Agents
            instgAgtBic: ['BOFAUS3NXXX', BIC],
            instdAgtBic: ['CITIUS33XXX', BIC],
            
            // Accounts
            dbtrAcct: ['DE89370400440532013000', [Validators.required, Validators.pattern(/^[A-Z0-9]{5,34}$/)]],
            cdtrAcct: ['GB29NWBK60161331926819', [Validators.required, Validators.pattern(/^[A-Z0-9]{5,34}$/)]]
        };

        const prefixes = [...this.agentPrefixes, ...this.partyPrefixes];

        prefixes.forEach(p => {
            const isAgent = this.agentPrefixes.includes(p);
            
            if (!c[p + 'AddrType']) c[p + 'AddrType'] = ['none'];
            
            // Address field mapping per party
            const addrMap: any = {
                dbtr:    { StrtNm: '100 North Tryon Street', BldgNb: '100', BldgNm: 'Bank of America Tower', Flr: '30th Floor', PstBx: 'PO Box 15220', Room: 'Suite 3000', PstCd: '28255', TwnNm: 'Charlotte', TwnLctnNm: 'Uptown', Dept: 'Treasury Operations', SubDept: 'Direct Debit Unit', Ctry: 'US' },
                cdtr:    { StrtNm: '388 Greenwich Street', BldgNb: '388', BldgNm: 'Citigroup Center', Flr: '25th Floor', PstBx: 'PO Box 3290', Room: 'Room 2500', PstCd: '10013', TwnNm: 'New York', TwnLctnNm: 'Tribeca', Dept: 'Global Payments', SubDept: 'Interbank Settlement', Ctry: 'US' },
                dbtrAgt: { StrtNm: '420 Montgomery Street', BldgNb: '420', BldgNm: 'Wells Fargo Building', Flr: '15th Floor', PstBx: 'PO Box 44000', Room: 'Room 1501', PstCd: '94104', TwnNm: 'San Francisco', TwnLctnNm: 'Financial District', Dept: 'Correspondent Banking', SubDept: 'FI Payments', Ctry: 'US' },
                cdtrAgt: { StrtNm: '383 Madison Avenue', BldgNb: '383', BldgNm: 'JPMorgan Chase Tower', Flr: '20th Floor', PstBx: 'PO Box 2222', Room: 'Room 2001', PstCd: '10179', TwnNm: 'New York', TwnLctnNm: 'Midtown East', Dept: 'Payment Services', SubDept: 'Cash Management', Ctry: 'US' }
            };
            const defaults = addrMap[p] || {};

            ['Dept', 'SubDept', 'StrtNm', 'BldgNb', 'BldgNm', 'Flr', 'PstBx', 'Room', 'PstCd', 'TwnNm', 'TwnLctnNm', 'Ctry', 'AdrLine1', 'AdrLine2', 'AdrLine3'].forEach(f => {
                let val = defaults[f] || '';
                
                // Per-field ISO 20022 validators
                let validators: any[];
                if (f === 'Ctry') {
                    validators = [Validators.pattern(/^[A-Z]{2,2}$/)];
                } else if (f.startsWith('AdrLine')) {
                    validators = [Validators.maxLength(70), ADDR_PATTERN];
                } else {
                    validators = [Validators.maxLength(70), ADDR_PATTERN];
                }
                if (!c[p + f]) c[p + f] = [val, validators];
            });
            
            const pName = p.replace(/([A-Z])/g, ' $1').toUpperCase();
            if (!c[p + 'Name']) c[p + 'Name'] = [pName + ' INSTITUTION', [Validators.maxLength(140), SAFE_NAME]];
            if (!c[p + 'Lei']) c[p + 'Lei'] = ['54930084UKLVMY22DS16', [Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)]];
            if (!c[p + 'ClrSysCd']) c[p + 'ClrSysCd'] = ['USAB', Validators.maxLength(4)];
            if (!c[p + 'ClrSysMmbId']) c[p + 'ClrSysMmbId'] = ['MEM-' + p.toUpperCase().substring(0, 5) + '-01', Validators.maxLength(35)];
            
            if (!c[p + 'AcctIBAN']) {
                c[p + 'AcctIBAN'] = ['', [Validators.pattern(/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/), Validators.minLength(10), Validators.maxLength(34)]];
            }
            if (!c[p + 'AcctOthrId']) {
                let acctVal = '4719' + Math.floor(Math.random() * 9000000000 + 1000000000);
                c[p + 'AcctOthrId'] = [acctVal, [Validators.pattern(/^[A-Z0-9]{1,34}$/)]];
            }

            // Detailed Account fields per party
            const acctMap: any = {
                dbtr:    { AcctIBAN: '', AcctOthrId: '4719329012340001', AcctSchemeNm: 'BANK', AcctPrtry: '', AcctIssr: 'BOFAUS3NXXX', AcctTypeCd: 'CACC', AcctTypePrtry: '', AcctCcy: 'USD', AcctNm: 'BOFA DIRECT DEBIT OPERATING', AcctProxyId: 'dbtr@proxy.bofa.com', AcctProxyCd: 'EMAL', AcctProxyPrtry: '' },
                cdtr:    { AcctIBAN: '', AcctOthrId: 'GB29NWBK60161331926819', AcctSchemeNm: 'BANK', AcctPrtry: '', AcctIssr: 'CITIUS33XXX', AcctTypeCd: 'CACC', AcctTypePrtry: '', AcctCcy: 'USD', AcctNm: 'CITI CREDITOR SETTLEMENT', AcctProxyId: 'cdtr@proxy.citi.com', AcctProxyCd: 'EMAL', AcctProxyPrtry: '' },
                dbtrAgt: { AcctIBAN: '', AcctOthrId: '9283746501928374', AcctSchemeNm: 'BANK', AcctPrtry: '', AcctIssr: 'WFBIUS6SXXX', AcctTypeCd: 'CACC', AcctTypePrtry: '', AcctCcy: 'USD', AcctNm: 'WELLS FARGO AGENT ACCOUNT', AcctProxyId: '', AcctProxyCd: '', AcctProxyPrtry: '' },
                cdtrAgt: { AcctIBAN: '', AcctOthrId: '1827364509182736', AcctSchemeNm: 'BANK', AcctPrtry: '', AcctIssr: 'CHASUS33XXX', AcctTypeCd: 'CACC', AcctTypePrtry: '', AcctCcy: 'USD', AcctNm: 'JPM AGENT SETTLEMENT ACCT', AcctProxyId: '', AcctProxyCd: '', AcctProxyPrtry: '' }
            };
            const acctDefaults = acctMap[p] || {};

            ['AcctSchemeNm', 'AcctPrtry', 'AcctIssr', 'AcctTypeCd', 'AcctTypePrtry', 'AcctCcy', 'AcctNm', 'AcctProxyId', 'AcctProxyCd', 'AcctProxyPrtry'].forEach(f => {
                let val: any = acctDefaults[f] || '';
                let v: any[] = [val];
                if (f === 'AcctCcy') v = [val, [Validators.pattern(/^[A-Z]{3}$/)]];
                c[p + f] = v;
            });

            // Set IBAN or OthrId per party
            if (acctDefaults.AcctIBAN) {
                if (!c[p + 'AcctIBAN']) c[p + 'AcctIBAN'] = [acctDefaults.AcctIBAN, [Validators.pattern(/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/), Validators.minLength(10), Validators.maxLength(34)]];
            } else {
                if (!c[p + 'AcctIBAN']) c[p + 'AcctIBAN'] = ['', [Validators.pattern(/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/), Validators.minLength(10), Validators.maxLength(34)]];
            }
            if (!c[p + 'AcctOthrId']) {
                c[p + 'AcctOthrId'] = [acctDefaults.AcctOthrId || '', [Validators.pattern(/^[A-Z0-9]{1,34}$/)]];
            }

            if (!isAgent) {
                if (!c[p + 'IdType']) c[p + 'IdType'] = ['org'];
                if (!c[p + 'OrgAnyBIC']) c[p + 'OrgAnyBIC'] = [c[p + 'Bic'] ? c[p + 'Bic'][0] : 'BOFAUS3NXXX', BIC_OPT];
                if (!c[p + 'OrgLEI']) c[p + 'OrgLEI'] = [c[p + 'Lei'] ? c[p + 'Lei'][0] : '54930084UKLVMY22DS16', [Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)]];
                if (!c[p + 'OrgClrSysCd']) c[p + 'OrgClrSysCd'] = ['USFW', Validators.maxLength(4)];
                if (!c[p + 'OrgClrSysMmbId']) c[p + 'OrgClrSysMmbId'] = ['ORG-' + p.toUpperCase().substring(0, 5), Validators.maxLength(35)];
                if (!c[p + 'OrgOthrId']) c[p + 'OrgOthrId'] = ['OTH-' + p.toUpperCase().substring(0, 5), [Validators.maxLength(35), ADDR_PATTERN]];
                if (!c[p + 'OrgOthrSchmeNmCd']) c[p + 'OrgOthrSchmeNmCd'] = ['BANK', [Validators.maxLength(4), Validators.pattern(/^[A-Z0-9]{1,4}$/)]];
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
\t\t\t\t<DrctDbtTxInf>
\t\t\t\t\t<PmtId>
${this.el('InstrId', v.instrId, 6)}${this.el('EndToEndId', v.endToEndId, 6)}${this.el('TxId', v.txId, 6)}${this.el('UETR', v.uetr, 6)}${this.el('ClrSysRef', v.clrSysRef, 6)}
\t\t\t\t\t</PmtId>
${this.pmtTpInf(v)}
\t\t\t\t\t<IntrBkSttlmAmt Ccy="${this.e(v.currency)}">${this.e(v.amount)}</IntrBkSttlmAmt>
\t\t\t\t\t<IntrBkSttlmDt>${this.e(v.intrBkSttlmDt)}</IntrBkSttlmDt>
${this.sttlmTmReq(v)}${this.agt('Dbtr', 'dbtr', v, 5)}
${this.fullAcct('DbtrAcct', 'dbtr', v, 5)}
${this.agt('DbtrAgt', 'dbtrAgt', v, 5)}
${this.fullAcct('DbtrAgtAcct', 'dbtrAgt', v, 5)}
${this.el('InstrForDbtrAgt', v.instrForDbtrAgt, 5)}
${this.purp(v)}
${this.rmtInf(v)}
\t\t\t\t</DrctDbtTxInf>
\t\t\t</CdtInstr>
\t\t</FIDrctDbt>
\t</Document>
</BusMsgEnvlp>`;
        this.onEditorChange(xml, true);
    }

    private sttlmTmReq(v: any) {
        let res = '';
        if (v.clstTm) res += this.el('CLSTm', v.clstTm, 6);
        if (v.tillTm) res += this.el('TillTm', v.tillTm, 6);
        if (v.frTm) res += this.el('FrTm', v.frTm, 6);
        if (v.rjctTm) res += this.el('RjctTm', v.rjctTm, 6);
        return res ? this.tag('SttlmTmReq', res, 5) : '';
    }

    private pmtTpInf(v: any) {
        let res = '';
        if (v.instrPrty) res += this.el('InstrPrty', v.instrPrty, 6);
        if (v.svcLvlCd || v.svcLvlPrtry) {
            // Prioritize Cd; only fall back to Prtry if Cd is absent
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


    private purp(v: any) {
        if (!v.purposeCd && !v.purposePrtry) return '';
        // Prioritize Cd; only fall back to Prtry if Cd is absent
        const p = v.purposeCd ? this.el('Cd', v.purposeCd, 6) : this.el('Prtry', v.purposePrtry, 6);
        return this.tag('Purp', p, 5);
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
            let tpVal = v[p + 'AcctTypePrtry'] ? this.el('Prtry', v[p + 'AcctTypePrtry'], indent + 3) : this.el('Cd', v[p + 'AcctTypeCd'], indent + 3);
            res += this.tag('Tp', tpVal, indent + 1);
        }
        if (v[p + 'AcctCcy'] && /^[A-Z]{3}$/.test(v[p + 'AcctCcy'])) {
            res += this.el('Ccy', v[p + 'AcctCcy'], indent + 1);
        }
        if (v[p + 'AcctNm']) res += this.el('Nm', v[p + 'AcctNm'], indent + 1);
        if (v[p + 'AcctProxyId']) {
            let pr = '';
            if (v[p + 'AcctProxyCd'] || v[p + 'AcctProxyPrtry']) {
                let tp = v[p + 'AcctProxyPrtry'] ? this.el('Prtry', v[p + 'AcctProxyPrtry'], indent + 4) : this.el('Cd', v[p + 'AcctProxyCd'], indent + 4);
                pr += this.tag('Tp', tp, indent + 3);
            }
            pr += this.el('Id', v[p + 'AcctProxyId'], indent + 3);
            res += this.tag('Prxy', pr, indent + 1);
        }
        return this.tag(tag, res, indent);
    }

    private formatAcctDetails(v: any, p: string, tabs: number) {
        if (v[p + 'AcctIBAN']) {
            return this.el('IBAN', v[p + 'AcctIBAN'], tabs);
        }
        if (v[p + 'AcctOthrId']) {
            let othr = this.el('Id', v[p + 'AcctOthrId'], tabs + 2);
            if (v[p + 'AcctSchemeNm'] || v[p + 'AcctPrtry']) {
                let sn = v[p + 'AcctPrtry'] ? this.el('Prtry', v[p + 'AcctPrtry'], tabs + 4) : this.el('Cd', v[p + 'AcctSchemeNm'], tabs + 4);
                othr += this.tag('SchmeNm', sn, tabs + 2);
            }
            if (v[p + 'AcctIssr']) othr += this.el('Issr', v[p + 'AcctIssr'], tabs + 2);
            return this.tag('Othr', othr, tabs + 1);
        }
        return '';
    }

    private e(v: string) { return (v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    private tabs(n: number) { return '\t'.repeat(n); }
    private el(tag: string, val: string, indent = 3) { return val?.trim() ? `${this.tabs(indent)}<${tag}>${this.e(val)}</${tag}>\n` : ''; }
    private tag(tag: string, content: string, indent = 3) { return content?.trim() ? `${this.tabs(indent)}<${tag}>\n${content}${this.tabs(indent)}</${tag}>\n` : ''; }

    agt(tag: string, prefix: string, v: any, indent = 3, onlyBic = false) {
        const bic = v[prefix + 'Bic'];
        const name = (v[prefix + 'Name'] || '').trim();
        const lei = v[prefix + 'Lei'];
        const clrCd = v[prefix + 'ClrSysCd'];
        const clrMmb = v[prefix + 'ClrSysMmbId'];
        
        if (!bic && !name && !lei && !clrMmb && v[prefix + 'AddrType'] === 'none') return '';

        let finInstnId = '';
        if (bic) finInstnId += this.el('BICFI', bic, indent + 2);
        
        if (clrMmb) {
            let clr = '';
            // Sequence: ClrSysId -> MmbId
            const sysId = clrCd ? this.el('Cd', clrCd, indent + 4) : `${this.tabs(indent + 4)}<Cd></Cd>\n`;
            clr += `${this.tabs(indent + 3)}<ClrSysId>\n${sysId}${this.tabs(indent + 3)}</ClrSysId>\n`;
            clr += this.el('MmbId', clrMmb, indent + 3);
            finInstnId += this.tag('ClrSysMmbId', clr, indent + 2);
        }

        if (lei) finInstnId += this.el('LEI', lei, indent + 2);
        
        if (!onlyBic) {
            const addr = this.addrXml(v, prefix, indent + 2);
            // ISO 20022 rule: Name and Address must always be together or both absent for Financial Institutions
            if (name && addr) {
                finInstnId += this.el('Nm', name, indent + 2);
                finInstnId += addr;
            }
        }

        return this.tag(tag, this.tag('FinInstnId', finInstnId, indent + 1), indent);
    }

    party(tag: string, prefix: string, v: any, indent = 4) {
        const bic = v[prefix + 'OrgAnyBIC'] || v[prefix + 'Bic'];
        const name = (v[prefix + 'Name'] || '').trim();
        const lei = v[prefix + 'OrgLEI'] || v[prefix + 'Lei'];
        const clrMmb = v[prefix + 'OrgClrSysMmbId'] || v[prefix + 'ClrSysMmbId'];
        if (!bic && !name && !lei && !clrMmb && v[prefix + 'AddrType'] === 'none') return '';

        let partyContent = '';
        const addr = this.addrXml(v, prefix, indent + 1);
        // Rule: Nm and PstlAdr together or none
        if (name && addr) {
            partyContent += this.el('Nm', name, indent + 1);
            partyContent += addr;
        }

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
        if (id) partyContent += this.el('Id', id, indent + 1);

        return this.tag(tag, partyContent, indent);
    }

    addrXml(v: any, p: string, indent = 4): string {
        const type = v[p + 'AddrType']; 
        if (!type || type === 'none') return '';
        
        let lines: string[] = []; 
        const t = this.tabs(indent + 1);
        
        if (type === 'structured' || type === 'hybrid') {
            const structuredFields = ['Dept', 'SubDept', 'StrtNm', 'BldgNb', 'BldgNm', 'Flr', 'PstBx', 'Room', 'PstCd', 'TwnNm', 'TwnLctnNm'];
            structuredFields.forEach(f => {
                if (v[p + f]) lines.push(`${t}<${f}>${this.e(v[p + f])}</${f}>`);
            });
            // Ctry is only emitted for structured/hybrid, not for unstructured
            if (v[p + 'Ctry']) {
                lines.push(`${t}<Ctry>${this.e(v[p + 'Ctry'])}</Ctry>`);
            }
        }

        if (type === 'unstructured' || type === 'hybrid') {
            // Hybrid allows only 2 lines, Unstructured allows max 3 (restricted per user request)
            const limit = type === 'hybrid' ? 2 : 3;
            [1, 2, 3].slice(0, limit).forEach(i => {
                const val = v[p + 'AdrLine' + i];
                if (val) lines.push(`${t}<AdrLine>${this.e(val)}</AdrLine>`);
            });
        }
        
        if (!lines.length) return '';
        return `${this.tabs(indent)}<PstlAdr>\n${lines.join('\n')}\n${this.tabs(indent)}</PstlAdr>\n`;
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

    syncScroll(editor: HTMLTextAreaElement, gutter: HTMLDivElement) {
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

    switchToPreview() {
        this.generateXml();
        this.currentTab = 'preview';
    }

    validateMessage() {
        this.validateFullMessageErrors();
        this.generateXml();
        if (this.form.invalid) {
            this.form.markAllAsTouched();
        }
        if (!this.generatedXml?.trim()) return;

        this.showValidationModal = true;
        this.validationStatus = 'validating';
        this.validationReport = null;
        this.validationExpandedIssue = null;

        this.http.post(this.config.getApiUrl('/validate'), {
            xml_content: this.generatedXml,
            mode: 'Full 1-3',
            message_type: 'pacs.010.001.03',
            store_in_history: true
        }).subscribe({
            next: (data: any) => {
                this.validationReport = data;
                this.validationStatus = 'done';
            },
            error: (err) => {
                this.validationReport = {
                    status: 'FAIL', errors: 1, warnings: 0,
                    message: 'pacs.010.001.03', total_time_ms: 0,
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

    viewXmlModal() {
        this.closeValidationModal();
        this.switchToPreview();
    }

    editXmlModal() {
        this.closeValidationModal();
        this.currentTab = 'form';
    }

    toggleValidationIssue(issue: any) {
        this.validationExpandedIssue = this.validationExpandedIssue === issue ? null : issue;
    }

    copyFix(text: string, e: MouseEvent) {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
            this.snackBar.open('Copied!', '', { duration: 1500 });
        });
    }

    runValidationModal() {
        this.validateMessage();
    }

    downloadXml() {
        const b = new Blob([this.generatedXml], { type: 'application/xml' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(b);
        a.download = `pacs010-${Date.now()}.xml`; a.click();
    }

    copyToClipboard() {
        navigator.clipboard.writeText(this.generatedXml).then(() => {
            this.snackBar.open('Copied to clipboard!', 'Close', { duration: 2000 });
        });
    }

    err(c: string): string | null {
        const ctrl = this.form.get(c);
        if (!ctrl || ctrl.valid || (!ctrl.touched && !ctrl.dirty)) return null;
        
        // Hide pattern/format errors if we are showing a maxlen "at limit" hint
        if (this.showMaxLenWarning[c]) {
            const val = ctrl.value?.toString() || '';
            const limit = ctrl.errors?.['maxlength']?.requiredLength;
            if (limit && val.length >= limit) return null;
            if (c.toLowerCase().includes('bic') && val.length >= 11) return null;
        }

        const tFields = ['clstTm', 'tillTm', 'frTm', 'rjctTm'];
        if (tFields.includes(c) && ctrl.errors?.['pattern']) return 'Invalid time format. Must include timezone offset (e.g., 09:00:00+05:30).';
        
        if (ctrl.errors?.['required']) return 'Required field.';
        if (c === 'purposeCd' && ctrl.errors?.['pattern']) return 'Invalid Purpose Code. Please select from the list or enter a valid ISO 20022 Purpose Code.';
        if (c === 'clrSysRef' && ctrl.errors?.['pattern']) return 'Invalid Pattern (Alphanumeric and standard special characters only, max 35 chars).';
        if (ctrl.errors?.['pattern']) return 'Invalid format.';
        if (ctrl.errors?.['maxlength']) return `Max ${ctrl.errors['maxlength'].requiredLength} chars.`;
        if (ctrl.errors?.['target2']) return 'T2 requires EUR.';
        if (ctrl.errors?.['chaps']) return 'CHAPS requires GBP.';
        if (ctrl.errors?.['chips']) return 'CHIPS requires USD.';
        if (ctrl.errors?.['fed']) return 'FED requires USD.';
        if (ctrl.errors?.['forbidden']) return 'Clearing System Reference must NOT be sent if no active clearing system is used.';
        if (ctrl.errors?.['linked']) return 'Name and Address must always be present together.';
        return 'Invalid value.';
    }

    hint(f: string, maxLen: number): string | null {
        if (!this.showMaxLenWarning[f]) return null;
        const c = this.form.get(f);
        if (!c || !c.value) return null;
        const len = c.value.toString().length;
        if (len >= maxLen) return `Maximum ${maxLen} characters reached (${len}/${maxLen})`;
        return null;
    }

    @HostListener('keydown', ['$event'])
    onKeyDown(event: KeyboardEvent) {
        const target = event.target as HTMLInputElement;
        if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;
        
        const name = target.getAttribute('formControlName') || target.getAttribute('name');
        if (!name) return;

        // Allow system/control keys (Backspace, Delete, Arrow keys, Tab, etc.)
        const controlKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Enter', 'Home', 'End', 'Escape'];
        if (controlKeys.includes(event.key) || event.ctrlKey || event.metaKey || event.altKey) return;

        const val = target.value || '';
        const key = event.key;

        // 1. Max length restriction (Hard block at key level)
        const maxLen = target.maxLength;
        if (maxLen > 0 && val.length >= maxLen && target.selectionStart === target.selectionEnd) {
            event.preventDefault();
            return;
        }

        const n = name.toLowerCase();

        // 2. Character-level restrictions
        // Numeric only (Amount, nbOfTxs)
        if (n.includes('amount') || n === 'nboftxs') {
            if (!/^[0-9.]$/.test(key)) {
                event.preventDefault();
                return;
            }
            if (key === '.' && val.includes('.')) {
                event.preventDefault(); // Only one dot allowed
                return;
            }
        }
        
        // BIC/IBAN (Alphanumeric only)
        if (n.includes('bic') || n.includes('iban')) {
            if (!/^[A-Za-z0-9]$/.test(key)) {
                event.preventDefault();
                return;
            }
        }

        // LEI (Alphanumeric only)
        if (n.includes('lei')) {
            if (!/^[A-Za-z0-9]$/.test(key)) {
                event.preventDefault();
                return;
            }
        }

        // UETR (Hex + dashes)
        if (n === 'uetr') {
            if (!/^[a-fA-F0-9\-]$/.test(key)) {
                event.preventDefault();
                return;
            }
        }

        // ISO 20022 MX character set restriction for all other text fields
        const mxSetRegex = /^[a-zA-Z0-9\/\-\?:\(\)\.,\+' ]*$/;
        if (target.type === 'text' || target.type === 'textarea') {
            if (!mxSetRegex.test(key)) {
                event.preventDefault();
            }
        }
    }

    @HostListener('input', ['$event'])
    onInput(event: any) {
        const target = event.target as HTMLInputElement;
        if (!target) return;
        const name = target.getAttribute('formControlName') || target.getAttribute('name');
        if (!name) return;

        const maxLen = target.maxLength;
        let val = target.value || '';

        // Sanitize input (especially after paste)
        const n = name.toLowerCase();
        if (n.includes('amount') || n === 'nboftxs') {
            val = val.replace(/[^0-9.]/g, '');
            const parts = val.split('.');
            if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
        }
        if (n.includes('bic') || n.includes('iban') || n.includes('lei')) {
            val = val.replace(/[^A-Za-z0-9]/g, '');
        }

        // Enforce casing
        if (n.includes('bic') || n.includes('iban') || n.includes('ctry') || n === 'purposecd' || n === 'ctgypurpcd') {
            val = val.toUpperCase();
        }

        // Hard trim for maxlength (Paste protection)
        if (maxLen > 0 && val.length > maxLen) {
            val = val.substring(0, maxLen);
        }

        if (target.value !== val) {
            const start = target.selectionStart;
            const end = target.selectionEnd;
            target.value = val;
            if (start !== null && end !== null) target.setSelectionRange(start, end);
            this.form.get(name)?.setValue(val, { emitEvent: false });
        }

        // Max length warning hints
        if (maxLen > 0 && val.length >= maxLen) {
            this.showMaxLenWarning[name] = true;
            if (this.warningTimeouts[name]) clearTimeout(this.warningTimeouts[name]);
            this.warningTimeouts[name] = setTimeout(() => this.showMaxLenWarning[name] = false, 3000);
        } else {
            this.showMaxLenWarning[name] = false;
        }
    }

    private scrollToFirstError() {
        setTimeout(() => {
            const firstInvalid = document.querySelector('.ng-invalid.ng-touched, .ng-invalid.ng-dirty');
            if (firstInvalid) {
                firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
                (firstInvalid as HTMLElement).focus();
            }
        }, 100);
    }

    hasSectionError(prefixes: string[]): boolean {
        return prefixes.some(p => {
            return Object.keys(this.form.controls).some(key => 
                key.startsWith(p) && 
                this.form.get(key)?.invalid && 
                (this.form.get(key)?.touched || this.form.get(key)?.dirty)
            );
        });
    }

}
