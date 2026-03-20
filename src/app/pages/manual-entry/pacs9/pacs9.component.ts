import { CommonModule } from '@angular/common';
import { Component, OnInit, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ConfigService } from '../../../services/config.service';
import { UetrService } from '../../../services/uetr.service';

@Component({
    selector: 'app-pacs9',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule, MatIconModule, MatSnackBarModule, MatTooltipModule],
    templateUrl: './pacs9.component.html',
    styleUrl: './pacs9.component.css'
})
export class Pacs9Component implements OnInit {
    form!: FormGroup;
    generatedXml = '';
    currentTab: 'form' | 'preview' = 'form';
    editorLineCount: number[] = [];
    isParsingXml = false;

    /** UETR Refresh state */
    uetrError: string | null = null;
    uetrSuccess: string | null = null;
    private uetrSuccessTimer: any;
    warningTimeouts: { [key: string]: any } = {};
    showMaxLenWarning: { [key: string]: boolean } = {};

    // Undo/Redo History
    private xmlHistory: string[] = [];
    private xmlHistoryIdx = -1;
    private maxHistory = 50;
    private isInternalChange = false;

    currencies: string[] = [];
    countries: string[] = [];
    categoryPurposes: string[] = [];
    purposes: string[] = [];
    sttlmMethods = ['INDA', 'INGA'];

    agentPrefixes = ['instgAgt', 'instdAgt', 'dbtrFi', 'cdtrFi', 'dbtrAgt', 'cdtrAgt',
        'prvsInstgAgt1', 'prvsInstgAgt2', 'prvsInstgAgt3',
        'intrmyAgt1', 'intrmyAgt2', 'intrmyAgt3'];

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
        this.onEditorChange(this.generatedXml, true);
        // Auto-sync AppHdr Fr/To BICs with GrpHdr InstgAgt/InstdAgt
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

    @HostListener('input', ['$event'])
    onInput(event: any) {
        const target = event.target as HTMLInputElement;
        if (!target) return;
        const name = target.getAttribute('formControlName');
        if (!name) return;

        // Character limit warning logic (Immediate on-hit detection)
        const maxLen = target.maxLength;
        const val = target.value || '';
        if (maxLen > 0 && val.length >= maxLen) {
            this.showMaxLenWarning[name] = true;
            if (this.warningTimeouts[name]) clearTimeout(this.warningTimeouts[name]);
            this.warningTimeouts[name] = setTimeout(() => this.showMaxLenWarning[name] = false, 3000);
        } else {
            this.showMaxLenWarning[name] = false;
        }

        // BIC/IBAN Uppercasing
        if (name.toLowerCase().includes('bic') || name.toLowerCase().includes('iban')) {
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

    private updateClearingSystemValidation() {
        const systems = this.agentPrefixes.map(p => this.form.get(p + 'ClrSysCd')?.value?.trim()?.toUpperCase());
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
            next: (res) => {
                if (res && res.codes && res.codes.length > 0) {
                    this.categoryPurposes = res.codes;
                } else {
                    this.categoryPurposes = ['SALA', 'TAXS', 'SUPP', 'PENS', 'LOAN', 'DIVD', 'CASH', 'COLL', 'INTC', 'OTHR'];
                }
            },
            error: (err) => {
                console.error('Failed to load category purposes', err);
                this.categoryPurposes = ['SALA', 'TAXS', 'SUPP', 'PENS', 'LOAN', 'DIVD', 'CASH', 'COLL', 'INTC', 'OTHR'];
            }
        });
        this.http.get<any>(this.config.getApiUrl('/codelists/purp')).subscribe({
            next: (res) => { if (res && res.codes) this.purposes = res.codes; },
            error: (err) => console.error('Failed to load purposes', err)
        });

    }

    updateConditionalValidators() {
        const ADDR_PATTERN = Validators.pattern(/^[a-zA-Z0-9\/\-\?:\(\)\.,\+' ]+$/);
        this.agentPrefixes.forEach(p => {
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
        });
    }

    private buildForm() {
        const BIC = [Validators.required, Validators.pattern(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)];
        const BIC_OPT = [Validators.pattern(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)];
        // Safe character set: letters, digits, space, . , ( ) ' - only. No & @ ! # $ etc.
        const SAFE_NAME = Validators.pattern(/^[a-zA-Z0-9 .,()'\-]+$/);
        const ADDR_PATTERN = Validators.pattern(/^[a-zA-Z0-9\/\-\?:\(\)\.,\+' ]+$/);
        const c: any = {
            purpCd: [''],
            ctgyPurpCd: ['', [Validators.pattern(/^[A-Z]{4,4}$/)]],
            ctgyPurpPrtry: ['', [Validators.pattern(/^[A-Za-z0-9 .\-]{1,35}$/)]],
            instrPrty: ['', [Validators.pattern(/^(HIGH|NORM)$/)]],
            clrChanl: ['', [Validators.pattern(/^(BOOK|MPNS|RTGS|RTNS)$/)]],
            svcLvlCd: ['', [Validators.pattern(/^[A-Z0-9]{1,4}$/)]],
            svcLvlPrtry: ['', [Validators.pattern(/^[A-Za-z0-9 .\-]{1,35}$/)]],
            lclInstrmCd: ['', [Validators.pattern(/^[A-Z0-9]{1,4}$/)]],
            lclInstrmPrtry: ['', [Validators.pattern(/^[A-Za-z0-9 .\-]{1,35}$/)]],
            fromBic: ['BBBBUS33XXX', BIC], toBic: ['CCCCGB2LXXX', BIC], bizMsgId: ['MSG-2026-FI-001', Validators.required],
            msgId: ['MSG-2026-FI-001', Validators.required], creDtTm: [this.isoNow(), Validators.required],
            nbOfTxs: ['1', [Validators.required, Validators.pattern(/^[1-9]\d{0,14}$/)]], sttlmMtd: ['INDA', Validators.required],
            instgAgtBic: ['BBBBUS33XXX', BIC], instdAgtBic: ['CCCCGB2LXXX', BIC],
            instrId: ['INSTR-FI-001', Validators.required], endToEndId: ['E2E-FI-001', Validators.required],
            txId: ['TX-FI-001', Validators.required],
            uetr: ['550e8400-e29b-41d4-a716-446655440000', [Validators.required, Validators.pattern(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)]],
            appHdrPriority: [''],
            clrSysRef: ['', [Validators.pattern(/^[A-Za-z0-9]{1,35}$/)]],
            sttlmPrty: ['', [Validators.pattern(/^(HIGH|NORM)$/)]],
            amount: ['50000.00', [Validators.required, Validators.pattern(/^\d{1,13}(\.\d{1,5})?$/)]], currency: ['USD', Validators.required],
            sttlmDt: [new Date().toISOString().split('T')[0], [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
            // Debtor FI (required)
            dbtrFiBic: ['BBBBUS33XXX', BIC],
            // Debtor Agent (mandatory)
            dbtrAgtBic: ['BBBBUS33XXX', BIC],
            // Creditor Agent (mandatory)
            cdtrAgtBic: ['CCCCGB2LXXX', BIC],
            // Creditor FI (required)
            cdtrFiBic: ['CCCCGB2LXXX', BIC],
            // Optional agents
            prvsInstgAgt1Bic: ['', BIC_OPT], prvsInstgAgt2Bic: ['', BIC_OPT], prvsInstgAgt3Bic: ['', BIC_OPT],
            intrmyAgt1Bic: ['', BIC_OPT], intrmyAgt2Bic: ['', BIC_OPT], intrmyAgt3Bic: ['', BIC_OPT],
            // Debtor/Creditor FI Accounts
            dbtrFiAcct: [''],
            cdtrFiAcct: [''],
            dbtrAgtAcct: [''],
            cdtrAgtAcct: [''],
            // Instructions for Creditor Agent (0..2)
            instrForCdtrAgt1Cd: [''], instrForCdtrAgt1InfTxt: ['', [Validators.minLength(1), Validators.maxLength(140), ADDR_PATTERN]],
            instrForCdtrAgt2Cd: [''], instrForCdtrAgt2InfTxt: ['', [Validators.minLength(1), Validators.maxLength(140), ADDR_PATTERN]],
            // Instructions for Next Agent (0..6)
            instrForNxtAgt1InfTxt: ['', [Validators.minLength(1), Validators.maxLength(35), ADDR_PATTERN]],
            instrForNxtAgt2InfTxt: ['', [Validators.minLength(1), Validators.maxLength(35), ADDR_PATTERN]],
            instrForNxtAgt3InfTxt: ['', [Validators.minLength(1), Validators.maxLength(35), ADDR_PATTERN]],
            instrForNxtAgt4InfTxt: ['', [Validators.minLength(1), Validators.maxLength(35), ADDR_PATTERN]],
            instrForNxtAgt5InfTxt: ['', [Validators.minLength(1), Validators.maxLength(35), ADDR_PATTERN]],
            instrForNxtAgt6InfTxt: ['', [Validators.minLength(1), Validators.maxLength(35), ADDR_PATTERN]],
            // Remittance (Optional)
            rmtInfType: ['none'],
            rmtInfUstrd: ['', [Validators.maxLength(140), ADDR_PATTERN]],
            rmtInfStrdCdtrRefType: [''],
            rmtInfStrdCdtrRef: ['', Validators.maxLength(35)],
            rmtInfStrdAddtlRmtInf: ['', [Validators.maxLength(140), ADDR_PATTERN]]
        };
        // Address prefixes for agents
        this.agentPrefixes.forEach(p => {
            if (!c[p + 'AddrType']) c[p + 'AddrType'] = 'none';
            if (!c[p + 'AdrLine1']) c[p + 'AdrLine1'] = ['', [Validators.maxLength(70), ADDR_PATTERN]];
            if (!c[p + 'AdrLine2']) c[p + 'AdrLine2'] = ['', [Validators.maxLength(70), ADDR_PATTERN]];
            if (!c[p + 'Dept']) c[p + 'Dept'] = ['', [Validators.maxLength(70), ADDR_PATTERN]];
            if (!c[p + 'SubDept']) c[p + 'SubDept'] = ['', [Validators.maxLength(70), ADDR_PATTERN]];
            if (!c[p + 'StrtNm']) c[p + 'StrtNm'] = ['', [Validators.maxLength(70), ADDR_PATTERN]];
            if (!c[p + 'BldgNb']) c[p + 'BldgNb'] = ['', [Validators.maxLength(16), ADDR_PATTERN]];
            if (!c[p + 'BldgNm']) c[p + 'BldgNm'] = ['', [Validators.maxLength(35), ADDR_PATTERN]];
            if (!c[p + 'Flr']) c[p + 'Flr'] = ['', [Validators.maxLength(70), ADDR_PATTERN]];
            if (!c[p + 'PstBx']) c[p + 'PstBx'] = ['', [Validators.maxLength(16), ADDR_PATTERN]];
            if (!c[p + 'Room']) c[p + 'Room'] = ['', [Validators.maxLength(70), ADDR_PATTERN]];
            if (!c[p + 'PstCd']) c[p + 'PstCd'] = ['', [Validators.maxLength(16), ADDR_PATTERN]];
            if (!c[p + 'TwnNm']) c[p + 'TwnNm'] = ['', [Validators.maxLength(35), ADDR_PATTERN]];
            if (!c[p + 'CtrySubDvsn']) c[p + 'CtrySubDvsn'] = ['', [Validators.maxLength(35), ADDR_PATTERN]];
            if (!c[p + 'Ctry']) c[p + 'Ctry'] = ['', Validators.pattern(/^[A-Z]{2,2}$/)];
            if (!c[p + 'TwnLctnNm']) c[p + 'TwnLctnNm'] = ['', [Validators.maxLength(35), ADDR_PATTERN]];
            if (!c[p + 'DstrctNm']) c[p + 'DstrctNm'] = ['', [Validators.maxLength(35), ADDR_PATTERN]];
            if (!c[p + 'AdrTpCd']) c[p + 'AdrTpCd'] = [''];
            if (!c[p + 'AdrTpPrtry']) c[p + 'AdrTpPrtry'] = ['', Validators.maxLength(35)];
            if (!c[p + 'Name']) c[p + 'Name'] = ['', [Validators.maxLength(140), SAFE_NAME]];
            if (!c[p + 'Bic']) c[p + 'Bic'] = ['', [Validators.pattern(/^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)]];
            if (!c[p + 'Lei']) c[p + 'Lei'] = ['', [Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)]];
            if (!c[p + 'ClrSysCd']) c[p + 'ClrSysCd'] = ['', Validators.maxLength(5)];
            if (!c[p + 'ClrSysMmbId']) c[p + 'ClrSysMmbId'] = ['', Validators.maxLength(35)];
            if (!c[p + 'Acct']) c[p + 'Acct'] = ['', [Validators.pattern(/^[A-Z0-9]{5,34}$/)]];
        });
        // Set default names for mandatory parties
        c['dbtrFiName'] = ['Debtor', [Validators.required, Validators.maxLength(140), SAFE_NAME]];
        c['cdtrFiName'] = ['Creditor', [Validators.required, Validators.maxLength(140), SAFE_NAME]];
        c['dbtrAgtName'] = ['Debtor Agent', [Validators.required, Validators.maxLength(140), SAFE_NAME]];
        c['cdtrAgtName'] = ['Creditor Agent', [Validators.required, Validators.maxLength(140), SAFE_NAME]];

        this.form = this.fb.group(c);
    }

    err(f: string): string | null {
        const c = this.form.get(f);
        // Remove touched/dirty requirement to show errors immediately
        if (!c || c.valid) return null;

        if (c.errors?.['required']) return 'Required field.';
        if (c.errors?.['maxlength']) return `Max ${c.errors['maxlength'].requiredLength} chars.`;
        if (c.errors?.['pattern']) {
            // Precedence: If we're at the limit and pattern is invalid, let the limit hint take precedence
            if (this.showMaxLenWarning[f]) {
              const val = c.value?.toString() || '';
              const limitError = c.errors?.['maxlength']?.requiredLength;
              if (limitError && val.length >= limitError) return null;
              if (f.toLowerCase().includes('bic') && val.length >= 11) return null;
              if (f === 'uetr' && val.length >= 36) return null;
            }
            if (f.toLowerCase().includes('bic')) return 'Valid 8 or 11-char BIC required.';
            if (f.toLowerCase().includes('iban')) return 'Valid 34-char IBAN required.';
            if (f.toLowerCase().includes('uetr')) return 'Invalid UETR format';
            if (f.toLowerCase().includes('amount') || f.toLowerCase().includes('amt')) return 'Amount must be > 0 (max 18 digits).';
            if (f === 'nbOfTxs') return 'Must be 1-15 digits.';
            if (f === 'bizMsgId' || f === 'msgId' || f === 'instrId' || f === 'endToEndId' || f === 'txId') return 'Invalid Pattern.';
            if (f === 'clrSysRef') return 'Alphanumeric only (1-35 characters, no special chars).';
            if (f === 'ctgyPurpCd') return 'Invalid Category Purpose Code. Must be a valid ISO 20022 code (4 uppercase letters).';
            if (f === 'instrPrty') return 'Invalid Priority. Must be HIGH or NORM.';
            if (f === 'sttlmPrty') return 'Invalid Settlement Priority. Must be HIGH or NORM.';
            if (f === 'clrChanl') return 'Invalid Clearing Channel. Must be BOOK, MPNS, RTGS, or RTNS.';
            if (f === 'svcLvlCd') return 'Invalid Service Level Code. Must be 1-4 alphanumeric characters.';
            if (f === 'svcLvlPrtry') return 'Invalid Proprietary Service Level. Up to 35 characters allowed.';
            if (f === 'lclInstrmCd') return 'Invalid Local Instrument Code. Must be 1-4 alphanumeric characters.';
            if (f === 'lclInstrmPrtry') return 'Invalid Proprietary Local Instrument. Up to 35 characters allowed.';
            if (f === 'ctgyPurpPrtry') return 'Invalid Proprietary Category Purpose. Up to 35 characters allowed.';
            if (f.toLowerCase().includes('bldgnb') || f.toLowerCase().includes('pstcd') || f.toLowerCase().includes('pstbx') || f.toLowerCase().includes('bldgnm') || f.toLowerCase().includes('twnnm') || f.toLowerCase().includes('twnlctn') || f.toLowerCase().includes('dstrctnm') || f.toLowerCase().includes('ctrysubdvsn') || f.toLowerCase().includes('strtnm') || f.toLowerCase().includes('dept') || f.toLowerCase().includes('subdept') || f.toLowerCase().includes('flr') || f.toLowerCase().includes('room') || f.toLowerCase().includes('adrline')) {
                return 'Invalid character. Only ISO 20022 MX allowed characters permitted.';
            }
            if (f.toLowerCase().includes('name') || f.toLowerCase().includes('nm')) return "Invalid characters. Only letters, numbers, spaces and . , ( ) ' - are allowed (no &, @, !, etc.)";
        }
        if (c.errors?.['target2']) return 'TARGET2 payments must use EUR as the settlement currency.';
        if (c.errors?.['chaps']) return 'Invalid Currency for CHAPS clearing system. When ClrSysId/Cd = CHAPS, the transaction currency must be GBP.';
        return 'Invalid value.';
    }

    /**
     * UETR Refresh — generates a new UUID v4, validates, updates form.
     */
    refreshUetr(): void {
        this.uetrError = null;
        this.uetrSuccess = null;
        clearTimeout(this.uetrSuccessTimer);

        const prevUetr = this.form.get('uetr')?.value || '';
        const newUetr = this.uetrService.generate();

        if (!UetrService.UUID_V4_PATTERN.test(newUetr)) {
            this.uetrError = 'Invalid UETR format';
            return;
        }
        if (newUetr === prevUetr) {
            this.uetrError = 'Duplicate UETR detected across messages';
            return;
        }

        if (prevUetr) this.uetrService.unregister(prevUetr);
        this.form.get('uetr')?.setValue(newUetr);
        this.form.get('uetr')?.markAsTouched();

        this.uetrSuccess = 'UETR refreshed successfully';
        this.uetrSuccessTimer = setTimeout(() => { this.uetrSuccess = null; }, 3000);
    }

    /**
     * Validate manually edited UETR on blur (Rule 8).
     */
    validateManualUetr(): void {
        const val = (this.form.get('uetr')?.value || '').trim();
        this.uetrError = null;
        if (!val) return;
        if (!UetrService.UUID_V4_PATTERN.test(val)) {
            this.uetrError = 'Invalid UETR format';
            return;
        }
        const result = this.uetrService.validate(val);
        if (result === 'duplicate') {
            this.uetrError = 'Duplicate UETR detected across messages';
        }
    }

    /**
     * Handle paste event on UETR field.
     */
    onUetrPaste(_event: ClipboardEvent): void {
        setTimeout(() => {
            const ctrl = this.form.get('uetr');
            if (!ctrl) return;
            const raw = (ctrl.value || '').trim().toLowerCase();
            ctrl.setValue(raw, { emitEvent: true });
            ctrl.markAsTouched();
            this.validateManualUetr();
        }, 0);
    }


    @HostListener('keydown', ['$event'])
    onKeydown(event: KeyboardEvent) {
        // ... Shortcuts check ...
        if (event.ctrlKey || event.metaKey) {
            if (document.activeElement?.classList.contains('code-editor')) {
                switch (event.key.toLowerCase()) {
                    case 'z': event.preventDefault(); this.undoXml(); return;
                    case 'y': event.preventDefault(); this.redoXml(); return;
                    case 's': event.preventDefault(); this.formatXml(); return;
                    case '/': event.preventDefault(); this.toggleCommentXml(); return;
                }
            }
        }

        const target = event.target as HTMLInputElement;
        if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;
        const maxLen = target.maxLength;
        if (maxLen && maxLen > 0 && target.value && target.value.toString().length >= maxLen) {
            // Still show warning on keydown if trying to type past limit
            if (target.selectionStart !== null && target.selectionStart !== target.selectionEnd) return;
            if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
                const controlName = target.getAttribute('formControlName') || target.getAttribute('name');
                if (controlName) {
                    this.showMaxLenWarning[controlName] = true;
                    if (this.warningTimeouts[controlName]) clearTimeout(this.warningTimeouts[controlName]);
                    this.warningTimeouts[controlName] = setTimeout(() => this.showMaxLenWarning[controlName] = false, 3000);
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

        // Stop generation if CHIPS rule is violated
        if (this.form.get('currency')?.hasError('chips')) {
            this.generatedXml = '<!-- CHIPS VALIDATION ERROR: CHIPS allows only USD currency. -->';
            this.onEditorChange(this.generatedXml, true);
            return;
        }

        // Stop generation if FED rule is violated
        if (this.form.get('currency')?.hasError('fed')) {
            this.generatedXml = '<!-- FED VALIDATION ERROR: FED allows only USD currency. -->';
            this.onEditorChange(this.generatedXml, true);
            return;
        }

        // Stop generation if target2 rule is violated
        if (this.form.get('currency')?.hasError('target2')) {
            this.generatedXml = '<!-- TARGET2 VALIDATION ERROR: T2 allows only EUR currency. -->';
            this.onEditorChange(this.generatedXml, true);
            return;
        }

        // Stop generation if CHAPS rule is violated
        if (this.form.get('currency')?.hasError('chaps')) {
            this.generatedXml = '<!-- CHAPS VALIDATION ERROR: Invalid Currency for CHAPS clearing system. When ClrSysId/Cd = CHAPS, the transaction currency must be GBP. -->';
            this.onEditorChange(this.generatedXml, true);
            return;
        }

        // Stop generation if ClrSysRef is forbidden
        if (this.form.get('clrSysRef')?.hasError('forbidden')) {
            this.generatedXml = '<!-- CLEARING SYSTEM REFERENCE VALIDATION ERROR: Clearing System Reference must NOT be sent if no active standard clearing system is used. -->';
            this.onEditorChange(this.generatedXml, true);
            return;
        }

        const v = this.form.value;
        let creDtTm = v.creDtTm || this.isoNow();
        if (creDtTm.endsWith('Z')) creDtTm = creDtTm.replace('Z', '+00:00');

        // CdtTrfTxInf — pacs.009.001.08 CBPR+ element order
        let tx = '';
        let pmtIdXml = this.el('InstrId', v.instrId) + this.el('EndToEndId', v.endToEndId) + this.el('TxId', v.txId) + this.el('UETR', v.uetr);
        if (v.clrSysRef?.trim()) pmtIdXml += this.el('ClrSysRef', v.clrSysRef);
        tx += this.tag('PmtId', pmtIdXml, 3);

        let pmtTpXml = '';
        if (v.instrPrty?.trim()) pmtTpXml += this.el('InstrPrty', v.instrPrty, 4);
        if (v.clrChanl?.trim()) pmtTpXml += this.el('ClrChanl', v.clrChanl, 4);
        if (v.svcLvlCd?.trim()) pmtTpXml += this.tag('SvcLvl', this.el('Cd', v.svcLvlCd, 5), 4);
        else if (v.svcLvlPrtry?.trim()) pmtTpXml += this.tag('SvcLvl', this.el('Prtry', v.svcLvlPrtry, 5), 4);
        if (v.lclInstrmCd?.trim()) pmtTpXml += this.tag('LclInstrm', this.el('Cd', v.lclInstrmCd, 5), 4);
        else if (v.lclInstrmPrtry?.trim()) pmtTpXml += this.tag('LclInstrm', this.el('Prtry', v.lclInstrmPrtry, 5), 4);
        if (v.ctgyPurpCd?.trim()) pmtTpXml += this.tag('CtgyPurp', this.el('Cd', v.ctgyPurpCd, 5), 4);
        else if (v.ctgyPurpPrtry?.trim()) pmtTpXml += this.tag('CtgyPurp', this.el('Prtry', v.ctgyPurpPrtry, 5), 4);
        if (pmtTpXml) tx += this.tag('PmtTpInf', pmtTpXml, 3);
        tx += `\t\t\t<IntrBkSttlmAmt Ccy="${this.e(v.currency)}">${v.amount}</IntrBkSttlmAmt>\n`;
        tx += this.el('IntrBkSttlmDt', v.sttlmDt, 3);
        if (v.sttlmPrty?.trim()) tx += this.el('SttlmPrty', v.sttlmPrty, 3);
        // PrvsInstgAgts
        tx += this.agtWithAcct('PrvsInstgAgt1', 'prvsInstgAgt1', v);
        tx += this.agtWithAcct('PrvsInstgAgt2', 'prvsInstgAgt2', v);
        tx += this.agtWithAcct('PrvsInstgAgt3', 'prvsInstgAgt3', v);
        // InstgAgt/InstdAgt
        tx += this.agtWithAcct('InstgAgt', 'instgAgt', v);
        tx += this.agtWithAcct('InstdAgt', 'instdAgt', v);
        // IntrmyAgts
        tx += this.agtWithAcct('IntrmyAgt1', 'intrmyAgt1', v);
        tx += this.agtWithAcct('IntrmyAgt2', 'intrmyAgt2', v);
        tx += this.agtWithAcct('IntrmyAgt3', 'intrmyAgt3', v);

        // Dbtr
        tx += this.agtWithAcct('Dbtr', 'dbtrFi', v);
        // DbtrAgt
        tx += this.agtWithAcct('DbtrAgt', 'dbtrAgt', v);
        // CdtrAgt
        tx += this.agtWithAcct('CdtrAgt', 'cdtrAgt', v);
        // Cdtr
        tx += this.agtWithAcct('Cdtr', 'cdtrFi', v);

        // Instructions for Creditor Agent (0..2)
        for (let i = 1; i <= 2; i++) {
            const cd = v[`instrForCdtrAgt${i}Cd`]?.trim();
            const txt = v[`instrForCdtrAgt${i}InfTxt`]?.trim();
            if (cd || txt) {
                let inner = '';
                if (cd) inner += this.el('Cd', cd, 4);
                if (txt) inner += this.el('InstrInf', txt, 4);
                tx += this.tag('InstrForCdtrAgt', inner, 3);
            }
        }
        // Instructions for Next Agent (0..6)
        for (let i = 1; i <= 6; i++) {
            const txt = v[`instrForNxtAgt${i}InfTxt`]?.trim();
            if (txt) {
                tx += this.tag('InstrForNxtAgt', this.el('InstrInf', txt, 4), 3);
            }
        }

        if (v.purpCd?.trim()) tx += this.tag('Purp', this.el('Cd', v.purpCd, 4), 3);

        // Remittance Information
        if (v.rmtInfType === 'ustrd' && v.rmtInfUstrd?.trim()) {
            tx += this.tag('RmtInf', this.el('Ustrd', v.rmtInfUstrd, 4), 3);
        } else if (v.rmtInfType === 'strd') {
            let inner = '';
            if (v.rmtInfStrdCdtrRefType || v.rmtInfStrdCdtrRef) {
                let ref = '';
                if (v.rmtInfStrdCdtrRefType) ref += this.tag('Tp', this.tag('CdOrPrtry', this.el('Cd', v.rmtInfStrdCdtrRefType, 7), 6), 5);
                if (v.rmtInfStrdCdtrRef) ref += this.el('Ref', v.rmtInfStrdCdtrRef, 5);
                inner += this.tag('CdtrRefInf', ref, 4);
            }
            if (v.rmtInfStrdAddtlRmtInf?.trim()) {
                inner += this.el('AddtlRmtInf', v.rmtInfStrdAddtlRmtInf, 4);
            }
            if (v.rmtInfStrdRfrdDocNb || v.rmtInfStrdRfrdDocCd) {
                let rdi = '';
                if (v.rmtInfStrdRfrdDocNb) rdi += this.el('Nb', v.rmtInfStrdRfrdDocNb, 5);
                if (v.rmtInfStrdRfrdDocCd) rdi += this.tag('Tp', this.tag('CdOrPrtry', this.el('Cd', v.rmtInfStrdRfrdDocCd, 7), 6), 5);
                inner += this.tag('RfrdDocInf', rdi, 4);
            }
            if (v.rmtInfStrdRfrdDocAmt) {
                inner += this.tag('RfrdDocAmt', this.tag('RmtAmt', this.el('DuePyblAmt Ccy="' + this.e(v.currency) + '"', v.rmtInfStrdRfrdDocAmt, 6), 5), 4);
            }
            if (inner) tx += this.tag('RmtInf', this.tag('Strd', inner, 4), 3);
        }


        const frBic = v.fromBic;
        const toBic = v.toBic;

        this.generatedXml =
            `<?xml version="1.0" encoding="UTF-8"?>
<BusMsgEnvlp xmlns="urn:swift:xsd:envelope">
\t<AppHdr xmlns="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
\t\t<Fr><FIId><FinInstnId><BICFI>${this.e(frBic)}</BICFI></FinInstnId></FIId></Fr>
\t\t<To><FIId><FinInstnId><BICFI>${this.e(toBic)}</BICFI></FinInstnId></FIId></To>
\t\t<BizMsgIdr>${this.e(v.bizMsgId)}</BizMsgIdr>
\t\t<MsgDefIdr>pacs.009.001.08</MsgDefIdr>
\t\t<BizSvc>swift.cbprplus.02</BizSvc>
\t\t<CreDt>${creDtTm}</CreDt>${v.appHdrPriority?.trim() ? `\n\t\t<Prty>${v.appHdrPriority}</Prty>` : ''}
\t</AppHdr>
\t<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08">
\t\t<FICdtTrf>
\t\t\t<GrpHdr>
\t\t\t\t<MsgId>${this.e(v.msgId)}</MsgId>
\t\t\t\t<CreDtTm>${creDtTm}</CreDtTm>
\t\t\t\t<NbOfTxs>${v.nbOfTxs}</NbOfTxs>
\t\t\t\t<SttlmInf>
\t\t\t\t\t<SttlmMtd>${this.e(v.sttlmMtd)}</SttlmMtd>
\t\t\t\t</SttlmInf>
\t\t\t</GrpHdr>
\t\t\t<CdtTrfTxInf>
${tx}\t\t\t</CdtTrfTxInf>
\t\t</FICdtTrf>
\t</Document>
</BusMsgEnvlp>`;
        this.onEditorChange(this.generatedXml, true);
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
    agtWithAcct(tag: string, prefix: string, v: any) {
        let res = this.agt(tag, prefix, v);
        if (v[prefix + 'Acct']?.trim()) {
            res += this.tag(tag + 'Acct', this.tag('Id', this.tag('Othr', this.el('Id', v[prefix + 'Acct'], 6), 5), 4), 3);
        }
        return res;
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
        if (lei) content += `\t\t\t\t\t<LEI>${this.e(lei)}</LEI>\n`;

        // Filter: Nm and PstlAdr are NOT allowed for InstgAgt and InstdAgt as per MyStandards requirements
        if (tag !== 'InstgAgt' && tag !== 'InstdAgt') {
            if (name) content += `\t\t\t\t\t<Nm>${this.e(name)}</Nm>\n`;
            content += this.addrXml(v, prefix, 5, tag.startsWith('PrvsInstgAgt'));
        }

        return `\t\t\t<${tag}>\n\t\t\t\t<FinInstnId>\n${content}\t\t\t\t</FinInstnId>\n\t\t\t</${tag}>\n`;
    }
    addrXml(v: any, p: string, indent = 4, isPrvs = false): string {
        const type = v[p + 'AddrType']; if (!type || type === 'none') return '';
        const lines: string[] = []; const t = this.tabs(indent + 1);
        if (type === 'structured' || type === 'hybrid') {
            // PostalAddress27 XSD element order
            if (!isPrvs) {
                if (v[p + 'AdrTpCd']) lines.push(`${t}<AdrTp>\n${t}\t<Cd>${this.e(v[p + 'AdrTpCd'])}</Cd>\n${t}</AdrTp>`);
                else if (v[p + 'AdrTpPrtry']) lines.push(`${t}<AdrTp>\n${t}\t<Prtry>${this.e(v[p + 'AdrTpPrtry'])}</Prtry>\n${t}</AdrTp>`);
            }
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
            if (v[p + 'TwnLctnNm']) lines.push(`${t}<TwnLctnNm>${this.e(v[p + 'TwnLctnNm'])}</TwnLctnNm>`);
            if (v[p + 'DstrctNm']) lines.push(`${t}<DstrctNm>${this.e(v[p + 'DstrctNm'])}</DstrctNm>`);
            if (v[p + 'CtrySubDvsn']) lines.push(`${t}<CtrySubDvsn>${this.e(v[p + 'CtrySubDvsn'])}</CtrySubDvsn>`);
            if (v[p + 'Ctry']) lines.push(`${t}<Ctry>${this.e(v[p + 'Ctry'])}</Ctry>`);
        }
        // AdrLine: allowed in unstructured/hybrid, FORBIDDEN in structured
        if (type === 'unstructured' || type === 'hybrid') {
            if (v[p + 'AdrLine1']) lines.push(`${t}<AdrLine>${this.e(v[p + 'AdrLine1'])}</AdrLine>`);
            if (v[p + 'AdrLine2']) lines.push(`${t}<AdrLine>${this.e(v[p + 'AdrLine2'])}</AdrLine>`);
        }
        if (!lines.length) return '';
        return `${this.tabs(indent)}<PstlAdr>\n${lines.join('\n')}\n${this.tabs(indent)}</PstlAdr>\n`;
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



    downloadXml() { this.generateXml(); const b = new Blob([this.generatedXml], { type: 'application/xml' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `pacs009-${Date.now()}.xml`; a.click(); URL.revokeObjectURL(a.href); }
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
            const tab = '    ';
            let formatted = '';
            let indent = '';
            // Normalize XML
            let xml = this.generatedXml.replace(/>\s+</g, '><').trim();
            
            // Intelligent regex to split Tags and Comments
            const reg = /(<[^>]+>[^<]*<\/([^>]+)>)|(<[^>]+\/>)|(<[^>]+>)|(<!--[\s\S]*?-->)|([^<]+)/g;
            const nodes = xml.match(reg) || [];

            nodes.forEach(node => {
                const trimmed = node.trim();
                if (!trimmed) return;

                if ((trimmed.startsWith('<') && trimmed.includes('</')) || trimmed.endsWith('/>')) {
                    formatted += indent + trimmed + '\r\n';
                } else if (trimmed.startsWith('</')) {
                    if (indent.length >= tab.length) indent = indent.substring(tab.length);
                    formatted += indent + trimmed + '\r\n';
                } else if (trimmed.startsWith('<') && !trimmed.startsWith('<?')) {
                    formatted += indent + trimmed + '\r\n';
                    if (!trimmed.endsWith('/>')) indent += tab;
                } else {
                    formatted += indent + trimmed + '\r\n';
                }
            });
            
            this.generatedXml = formatted.trim();
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
        if (!content?.trim()) {
            this.isParsingXml = true;
            // Clear all fields to empty strings instead of defaults
            const emptyPatch: any = {};
            Object.keys(this.form.controls).forEach(key => {
                emptyPatch[key] = '';
            });
            this.form.patchValue(emptyPatch, { emitEvent: false });
            this.isParsingXml = false;
            return;
        }
        try {
            const cleanXml = content.replace(/<(\/?)(?:[\w]+:)/g, '<$1');
            const doc = new DOMParser().parseFromString(cleanXml, 'text/xml');
            if (doc.querySelector('parsererror')) {
                this.snackBar.open('Invalid XML: Unable to parse content.', 'Close', { duration: 3000 });
                return;
            }

            const patch: any = {};
            const tval = (t: string) => doc.getElementsByTagName(t)[0]?.textContent || '';
            const setVal = (key: string, val: string) => { patch[key] = val; };

            setVal('bizMsgId', tval('BizMsgIdr'));
            setVal('msgId', tval('MsgId'));
            setVal('instrId', tval('InstrId'));
            setVal('endToEndId', tval('EndToEndId'));
            setVal('txId', tval('TxId'));
            setVal('uetr', tval('UETR'));
            setVal('nbOfTxs', tval('NbOfTxs'));
            setVal('sttlmMtd', tval('SttlmMtd'));
            setVal('sttlmDt', tval('IntrBkSttlmDt'));

            const amtEl = doc.getElementsByTagName('IntrBkSttlmAmt')[0] || doc.getElementsByTagName('EqvtAmt')[0];
            setVal('amount', amtEl ? (amtEl.textContent || '') : '');
            setVal('currency', amtEl ? (amtEl.getAttribute('Ccy') || '') : '');

            const creDtTm = doc.getElementsByTagName('CreDtTm')[0] || doc.getElementsByTagName('CreDt')[0];
            setVal('creDtTm', creDtTm ? (creDtTm.textContent || '') : '');

            const tryTag = (parentOrEl: string | Element, child: string) => {
                const p = typeof parentOrEl === 'string' ? doc.getElementsByTagName(parentOrEl)[0] : parentOrEl;
                return p ? (p.getElementsByTagName(child)[0]?.textContent || '') : '';
            };

            const tryAcct = (group: string) => {
                const groupEl = doc.getElementsByTagName(group)[0];
                if (!groupEl) return '';
                const idNode = groupEl.getElementsByTagName('Id')[0];
                if (!idNode) return '';
                const iban = idNode.getElementsByTagName('IBAN')[0]?.textContent;
                if (iban) return iban;
                const othr = idNode.getElementsByTagName('Othr')[0];
                return othr?.getElementsByTagName('Id')[0]?.textContent || '';
            };

            setVal('instrPrty', tval('InstrPrty'));
            setVal('clrChanl', tval('ClrChanl'));
            setVal('svcLvlCd', tryTag('SvcLvl', 'Cd'));
            setVal('svcLvlPrtry', tryTag('SvcLvl', 'Prtry'));
            setVal('lclInstrmCd', tryTag('LclInstrm', 'Cd'));
            setVal('lclInstrmPrtry', tryTag('LclInstrm', 'Prtry'));
            setVal('ctgyPurpPrtry', tryTag('CtgyPurp', 'Prtry'));


            setVal('fromBic', tryTag('Fr', 'BICFI'));
            setVal('toBic', tryTag('To', 'BICFI'));

            const instgBic = tryTag('InstgAgt', 'BICFI');
            setVal('instgAgtBic', instgBic || patch.fromBic);
            const instdBic = tryTag('InstdAgt', 'BICFI');
            setVal('instdAgtBic', instdBic || patch.toBic);

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

            // Fetch accounts for all agents/actors using the robust tryAcct helper
            this.agentPrefixes.forEach(p => {
                let tag = p.charAt(0).toUpperCase() + p.slice(1);
                if (p === 'dbtrFi') tag = 'Dbtr'; // Exception for actor/agent mapping
                if (p === 'cdtrFi') tag = 'Cdtr';
                const acctTag = tag + 'Acct';
                const val = tryAcct(acctTag);
                if (val) patch[p + 'Acct'] = val;
            });

            const mapAddr = (tag: string, prefix: string) => {
                ['Dept', 'SubDept', 'StrtNm', 'BldgNb', 'BldgNm', 'Flr', 'PstBx', 'Room', 'PstCd', 'TwnNm', 'TwnLctnNm', 'DstrctNm', 'CtrySubDvsn', 'Ctry', 'AdrLine1', 'AdrLine2', 'AdrTpCd', 'AdrTpPrtry'].forEach(f => patch[prefix + f] = '');
                patch[prefix + 'AddrType'] = 'none';

                const p = doc.getElementsByTagName(tag)[0];
                if (!p) return;
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

            this.agentPrefixes.forEach(p => {
                let tag = p.charAt(0).toUpperCase() + p.slice(1);
                if (p === 'dbtrFi') tag = 'Dbtr';
                if (p === 'cdtrFi') tag = 'Cdtr';
                mapAddr(tag, p);
            });


            setVal('purpCd', tryTag('Purp', 'Cd') || tval('Purp'));
            setVal('ctgyPurpCd', tryTag('CtgyPurp', 'Cd') || tval('CtgyPurp'));

            // Remittance
            const rmtInf = doc.getElementsByTagName('RmtInf')[0];
            if (rmtInf) {
                const ustrd = rmtInf.getElementsByTagName('Ustrd')[0];
                if (ustrd) {
                    setVal('rmtInfType', 'ustrd');
                    setVal('rmtInfUstrd', ustrd.textContent || '');
                } else {
                    const strd = rmtInf.getElementsByTagName('Strd')[0];
                    if (strd) {
                        setVal('rmtInfType', 'strd');
                        const ref = strd.getElementsByTagName('CdtrRefInf')[0];
                        if (ref) {
                            setVal('rmtInfStrdCdtrRefType', ref.getElementsByTagName('Cd')[0]?.textContent || '');
                            setVal('rmtInfStrdCdtrRef', ref.getElementsByTagName('Ref')[0]?.textContent || '');
                        }
                        setVal('rmtInfStrdAddtlRmtInf', strd.getElementsByTagName('AddtlRmtInf')[0]?.textContent || '');

                        const rfrdDoc = strd.getElementsByTagName('RfrdDocInf')[0];
                        if (rfrdDoc) {
                            setVal('rmtInfStrdRfrdDocNb', rfrdDoc.getElementsByTagName('Nb')[0]?.textContent || '');
                            setVal('rmtInfStrdRfrdDocCd', rfrdDoc.getElementsByTagName('Tp')[0]?.getElementsByTagName('CdOrPrtry')[0]?.getElementsByTagName('Cd')[0]?.textContent || '');
                        }
                        const rfrdAmt = strd.getElementsByTagName('RfrdDocAmt')[0];
                        if (rfrdAmt) {
                            setVal('rmtInfStrdRfrdDocAmt', rfrdAmt.getElementsByTagName('RmtAmt')[0]?.getElementsByTagName('DuePyblAmt')[0]?.textContent || '');
                        }
                    }
                }
            } else {
                setVal('rmtInfType', 'none');
            }
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
