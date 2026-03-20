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
    selector: 'app-pacs4',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule, MatIconModule, MatSnackBarModule, MatTooltipModule],
    templateUrl: './pacs4.component.html',
    styleUrl: './pacs4.component.css'
})
export class Pacs4Component implements OnInit {
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
    chargeBearers = ['CRED', 'SHAR', 'SLEV'];
    sttlmMethods = ['INDA', 'INGA', 'COVE', 'CLRG'];
    returnReasons = [
        'AC01', 'AC04', 'AC06', 'AG01', 'AG02', 'AM01', 'AM02', 'AM03', 'AM04', 'AM05', 
        'AM06', 'AM07', 'AM09', 'AM10', 'BE01', 'BE04', 'BE05', 'BE06', 'BE07', 'DNOR', 
        'ERIN', 'FF01', 'MD01', 'MD07', 'MS02', 'MS03', 'RC01', 'RR01', 'RR02', 'RR03', 'RR04'
    ];

    agentPrefixes = ['instgAgt', 'instdAgt', 'initgPty', 'dbtr', 'dbtrAgt', 'cdtrAgt', 'cdtr', 'ultmtDbtr', 'ultmtCdtr'];

    // Validation Modal State
    showValidationModal = false;
    validationStatus: 'idle' | 'validating' | 'done' = 'idle';
    validationReport: any = null;
    validationExpandedIssue: any = null;

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
        
        // Auto-sync AppHdr BICs
        this.form.get('fromBic')?.valueChanges.subscribe(v => this.form.patchValue({ instgAgtBic: v }, { emitEvent: false }));
        this.form.get('toBic')?.valueChanges.subscribe(v => this.form.patchValue({ instdAgtBic: v }, { emitEvent: false }));

        this.form.valueChanges.subscribe(() => {
            this.generateXml();
        });

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
            const upperValue = val.toUpperCase();
            if (val !== upperValue) {
                target.value = upperValue;
                if (start !== null && end !== null) target.setSelectionRange(start, end);
                this.form.get(name)?.patchValue(upperValue, { emitEvent: false });
            }
        }
    }

    fetchCodelists() {
        this.http.get<any>(this.config.getApiUrl('/codelists/currency')).subscribe({ next: (res) => { if (res?.codes) this.currencies = res.codes; } });
        this.http.get<any>(this.config.getApiUrl('/codelists/country')).subscribe({ next: (res) => { if (res?.codes) this.countries = res.codes; } });
    }

    private buildForm() {
        const BIC = [Validators.pattern(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)]; // BIC is optional for some agts
        const BIC_REQ = [Validators.required, Validators.pattern(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)];
        const SAFE_NAME = Validators.pattern(/^[a-zA-Z0-9 .,()'\-]+$/);
        const ADDR_PATTERN = Validators.pattern(/^[a-zA-Z0-9\/\-\?:\(\)\.,\+' ]+$/);

        const c: any = {
            fromBic: ['BBBBUS33XXX', BIC_REQ],
            toBic: ['CCCCGB2LXXX', BIC_REQ],
            bizMsgId: ['RTR-2026-FI-001', Validators.required],
            msgId: ['RTR-2026-FI-001', Validators.required],
            creDtTm: [this.isoNow(), Validators.required],
            nbOfTxs: ['1', [Validators.required, Validators.pattern(/^1$/)]],
            sttlmMtd: ['INDA', Validators.required],

            rtrId: ['RTR-TX-001', Validators.required],
            orgnlInstrId: ['INSTR-ORIG-001', Validators.required],
            orgnlEndToEndId: ['E2E-ORIG-001', Validators.required],
            orgnlTxId: ['TX-ORIG-001', Validators.required],
            orgnlUETR: ['550e8400-e29b-41d4-a716-446655440000', [Validators.required, Validators.pattern(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)]],

            amount: ['50000.00', [Validators.required, Validators.pattern(/^\d{1,13}(\.\d{1,5})?$/)]],
            currency: ['USD', Validators.required],
            sttlmDt: [new Date().toISOString().split('T')[0], [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
            chrgBr: ['SHAR', Validators.required],

            orgnlAmount: ['50000.00', [Validators.required, Validators.pattern(/^\d{1,13}(\.\d{1,5})?$/)]],
            orgnlCurrency: ['USD', Validators.required],
            orgnlSttlmDt: [new Date().toISOString().split('T')[0], [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],

            orgnlMsgId: ['ORIG-REF-001', Validators.required],
            orgnlMsgNmId: ['pacs.008.001.08', [Validators.required, Validators.pattern(/^pacs\.\d{3}\.\d{3}\.\d{2}$/)]],

            rtrRsnCd: ['MS03', Validators.required],
            rtrRsnAddtlInf: ['', [Validators.maxLength(105), ADDR_PATTERN]],
        };

        this.agentPrefixes.forEach(p => {
            const isMandatory = (p === 'dbtr' || p === 'cdtr');
            let defaultBic = (p === 'dbtr' || p === 'instgAgt' || p === 'dbtrAgt') ? 'BBBBUS33XXX' : 'CCCCGB2LXXX';
            if (p === 'initgPty' || p === 'ultmtDbtr' || p === 'ultmtCdtr') defaultBic = '';
            
            c[p + 'Bic'] = [isMandatory ? defaultBic : (defaultBic || ''), isMandatory ? BIC_REQ : BIC];
            c[p + 'Name'] = [isMandatory ? (p === 'dbtr' ? 'Original Debtor' : 'Original Creditor') : '', [Validators.maxLength(140), SAFE_NAME]];
            c[p + 'AddrType'] = ['none'];
            c[p + 'Ctry'] = ['', Validators.pattern(/^[A-Z]{2,2}$/)];
            c[p + 'TwnNm'] = ['', [Validators.maxLength(35), ADDR_PATTERN]];
            c[p + 'BldgNb'] = ['', [Validators.maxLength(16), ADDR_PATTERN]];
            c[p + 'StrtNm'] = ['', [Validators.maxLength(70), ADDR_PATTERN]];
            c[p + 'PstCd'] = ['', [Validators.maxLength(16), ADDR_PATTERN]];
            c[p + 'Acct'] = ['', [Validators.pattern(/^[A-Z0-9]{5,34}$/)]];
            
            // Financial Institution specific
            c[p + 'MmbId'] = ['', [Validators.maxLength(35), ADDR_PATTERN]];
            c[p + 'ClrSysCd'] = [''];
            c[p + 'Lei'] = ['', [Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)]];
        });

        this.form = this.fb.group(c);
    }

    err(f: string): string | null {
        const c = this.form.get(f);
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
            return 'Invalid format/pattern.';
        }
        return 'Invalid value.';
    }

    hint(f: string, maxLen: number): string | null {
        if (!this.showMaxLenWarning[f]) return null;
        const c = this.form.get(f);
        if (!c || !c.value) return null;
        const len = c.value.toString().length;
        return len >= maxLen ? `Maximum ${maxLen} characters reached (${len}/${maxLen})` : null;
    }

    isoNow(): string {
        const d = new Date(), p = (n: number) => n.toString().padStart(2, '0');
        const off = -d.getTimezoneOffset(), s = off >= 0 ? '+' : '-';
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${s}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
    }

    generateXml() {
        if (this.isParsingXml) return;
        const v = this.form.value;
        const creDtTm = v.creDtTm || this.isoNow();

        // Transaction Info
        let tx = '';
        
        // 1. RtrId (Return Identification - Mandatory in some profiles)
        tx += this.el('RtrId', v.rtrId, 4);

        // 2. OrgnlGrpInf (Mandatory and must be inside TxInf in this profile)
        let orgnlGrpInf = '';
        orgnlGrpInf += this.el('OrgnlMsgId', v.orgnlMsgId, 5);
        orgnlGrpInf += this.el('OrgnlMsgNmId', v.orgnlMsgNmId, 5);
        tx += this.tag('OrgnlGrpInf', orgnlGrpInf, 4);

        // 2. Original Identifiers
        tx += this.el('OrgnlInstrId', v.orgnlInstrId, 4);
        tx += this.el('OrgnlEndToEndId', v.orgnlEndToEndId, 4);
        tx += this.el('OrgnlTxId', v.orgnlTxId, 4);
        tx += this.el('OrgnlUETR', v.orgnlUETR, 4); // Mandatory in TxInf for this profile
        
        // 3. Original Settlement Details (in TxInf)
        if (v.orgnlAmount) {
            tx += `${this.tabs(4)}<OrgnlIntrBkSttlmAmt Ccy="${this.e(v.orgnlCurrency)}">${v.orgnlAmount}</OrgnlIntrBkSttlmAmt>\n`;
        }
        tx += this.el('OrgnlIntrBkSttlmDt', v.orgnlSttlmDt, 4);

        // 4. Return Details
        tx += `\t\t\t\t<RtrdIntrBkSttlmAmt Ccy="${this.e(v.currency)}">${v.amount}</RtrdIntrBkSttlmAmt>\n`;
        tx += this.el('IntrBkSttlmDt', v.sttlmDt, 4); // Return Interbank Settlement Date (Mandatory in this profile)
        tx += this.el('ChrgBr', v.chrgBr, 4);

        // 5. Agents (Moved from GrpHdr to TxInf)
        tx += this.agt('InstgAgt', 'instgAgt', v, 4);
        tx += this.agt('InstdAgt', 'instdAgt', v, 4);

        // 6. Return Chain
        let rtrChain = '';
        rtrChain += this.partyAgentXml('Dbtr', 'dbtr', v, 5);
        rtrChain += this.agt('DbtrAgt', 'dbtrAgt', v, 5);
        rtrChain += this.agt('CdtrAgt', 'cdtrAgt', v, 5);
        rtrChain += this.partyAgentXml('Cdtr', 'cdtr', v, 5);
        tx += this.tag('RtrChain', rtrChain, 4);

        // 7. Reason
        let rtrRsn = this.tag('Rsn', this.el('Cd', v.rtrRsnCd, 6), 5);
        if (v.rtrRsnAddtlInf) rtrRsn += this.el('AddtlInf', v.rtrRsnAddtlInf, 5);
        tx += this.tag('RtrRsnInf', rtrRsn, 4);

        // Final Document Assembly
        this.generatedXml = `<?xml version="1.0" encoding="UTF-8"?>
<BusMsgEnvlp xmlns="urn:swift:xsd:envelope">
\t<AppHdr xmlns="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
\t\t<Fr><FIId><FinInstnId><BICFI>${this.e(v.fromBic)}</BICFI></FinInstnId></FIId></Fr>
\t\t<To><FIId><FinInstnId><BICFI>${this.e(v.toBic)}</BICFI></FinInstnId></FIId></To>
\t\t<BizMsgIdr>${this.e(v.bizMsgId)}</BizMsgIdr>
\t\t<MsgDefIdr>pacs.004.001.09</MsgDefIdr>
\t\t<BizSvc>swift.cbprplus.02</BizSvc>
\t\t<CreDt>${creDtTm}</CreDt>
\t</AppHdr>
\t<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.004.001.09">
\t\t<PmtRtr>
\t\t\t<GrpHdr>
\t\t\t\t<MsgId>${this.e(v.msgId)}</MsgId>
\t\t\t\t<CreDtTm>${creDtTm}</CreDtTm>
\t\t\t\t<NbOfTxs>1</NbOfTxs>
\t\t\t\t<SttlmInf>
\t\t\t\t\t<SttlmMtd>${this.e(v.sttlmMtd)}</SttlmMtd>
\t\t\t\t</SttlmInf>
\t\t\t</GrpHdr>
\t\t\t<TxInf>
${tx}\t\t\t</TxInf>
\t\t</PmtRtr>
\t</Document>
</BusMsgEnvlp>`;

        this.onEditorChange(this.generatedXml, true);
    }

    // --- XML Helpers ---
    private e(v: string) { return (v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    private tabs(n: number) { return '\t'.repeat(n); }
    private el(tag: string, val: string, indent = 3) { return val?.trim() ? `${this.tabs(indent)}<${tag}>${this.e(val)}</${tag}>\n` : ''; }
    private tag(tag: string, content: string, indent = 3) { return content?.trim() ? `${this.tabs(indent)}<${tag}>\n${content}${this.tabs(indent)}</${tag}>\n` : ''; }

    agt(tag: string, prefix: string, v: any, indent = 4) {
        const bic = v[prefix + 'Bic'];
        const lei = v[prefix + 'Lei'];
        const mmbId = v[prefix + 'MmbId'];
        const clrCd = v[prefix + 'ClrSysCd'];

        if (!bic && !lei && !mmbId) return '';

        let fi = '';
        if (bic) fi += `${this.tabs(indent + 2)}<BICFI>${this.e(bic)}</BICFI>\n`;
        if (mmbId) {
            let clrId = '';
            if (clrCd) clrId += this.tag('ClrSysId', this.el('Cd', clrCd, indent + 5), indent + 4);
            clrId += this.el('MmbId', mmbId, indent + 4);
            fi += this.tag('ClrSysMmbId', clrId, indent + 3);
        }
        if (lei) fi += this.el('LEI', lei, indent + 2);

        return this.tag(tag, this.tag('FinInstnId', fi, indent + 1), indent);
    }

    partyAgentXml(tag: string, prefix: string, v: any, indent = 4) {
        const bic = v[prefix + 'Bic'];
        const name = v[prefix + 'Name'];
        const lei = v[prefix + 'Lei'];
        const mmbId = v[prefix + 'MmbId'];
        const clrCd = v[prefix + 'ClrSysCd'];

        if (!bic && !name && !lei && !mmbId && (v[prefix + 'AddrType'] === 'none' || !v[prefix + 'AddrType'])) return '';

        let content = '';
        if (name) content += this.el('Nm', name, indent + 1);
        content += this.addrXml(v, prefix, indent + 1);

        let id = '';
        if (bic || lei || mmbId) {
            let org = '';
            if (bic) org += this.el('AnyBIC', bic, indent + 4);
            if (lei) org += this.el('LEI', lei, indent + 4);
            if (mmbId) {
                let clrId = '';
                if (clrCd) clrId += this.tag('SchmeNm', this.el('Cd', clrCd, indent + 7), indent + 6);
                clrId += this.el('Id', mmbId, indent + 6);
                org += this.tag('Othr', clrId, indent + 5);
            }
            id = this.tag('Id', this.tag('OrgId', org, indent + 3), indent + 2);
        }
        content += id;

        // If it's a party, it might have a tag child wrapper depending on the parent
        return this.tag(tag, this.tag('Pty', content, indent + 1), indent);
    }

    addrXml(v: any, p: string, indent = 4): string {
        const type = v[p + 'AddrType'];
        if (!type || type === 'none') return '';
        let content = '';
        if (v[p + 'StrtNm']) content += this.el('StrtNm', v[p + 'StrtNm'], indent + 2);
        if (v[p + 'BldgNb']) content += this.el('BldgNb', v[p + 'BldgNb'], indent + 2);
        if (v[p + 'PstCd']) content += this.el('PstCd', v[p + 'PstCd'], indent + 2);
        if (v[p + 'TwnNm']) content += this.el('TwnNm', v[p + 'TwnNm'], indent + 2);
        if (v[p + 'Ctry']) content += this.el('Ctry', v[p + 'Ctry'], indent + 2);
        return this.tag('PstlAdr', content, indent + 1);
    }

    onEditorChange(content: string, fromForm = false) {
        if (!this.isInternalChange && !fromForm) this.pushHistory();
        this.generatedXml = content;
        this.refreshLineCount();
        if (fromForm || this.isParsingXml) return;
        this.parseXmlToForm(content);
    }
    
    private refreshLineCount() {
        const lines = this.generatedXml ? this.generatedXml.split('\n').length : 1;
        this.editorLineCount = Array.from({ length: lines }, (_, i) => i + 1);
    }

    syncScroll(editor: HTMLTextAreaElement, gutter: HTMLDivElement) {
        gutter.scrollTop = editor.scrollTop;
    }

    private parseXmlToForm(xml: string) {
        if (!xml || !xml.trim()) {
            this.isParsingXml = true;
            // Clear all form fields if XML is empty
            const emptyState: any = {};
            Object.keys(this.form.controls).forEach(key => {
                emptyState[key] = '';
            });
            this.form.patchValue(emptyState, { emitEvent: false });
            this.isParsingXml = false;
            return;
        }

        try {
            // Strip namespaces for easier selector matching
            const cleanXml = xml.replace(/<(\/?)(?:[\w]+:)/g, '<$1');
            const doc = new DOMParser().parseFromString(cleanXml, 'text/xml');
            
            if (doc.querySelector('parsererror')) {
                console.error('XML Parse Error');
                return;
            }

            const patch: any = {};
            const tval = (t: string, parent?: Element) => (parent || doc).getElementsByTagName(t)[0]?.textContent?.trim() || '';
            const getAttr = (tag: string, attr: string, parent?: Element) => (parent || doc).getElementsByTagName(tag)[0]?.getAttribute(attr) || '';

            // Header fields
            const fr = doc.getElementsByTagName('Fr')[0];
            patch.fromBic = tval('BICFI', fr);
            const to = doc.getElementsByTagName('To')[0];
            patch.toBic = tval('BICFI', to);
            patch.bizMsgId = tval('BizMsgIdr');
            patch.creDtTm = tval('CreDtTm') || tval('CreDt');

            // Document fields
            patch.msgId = tval('MsgId');
            patch.nbOfTxs = tval('NbOfTxs');
            patch.sttlmMtd = tval('SttlmMtd');

            // Transaction Info
            const txInf = doc.getElementsByTagName('TxInf')[0];
            const setTxVal = (key: string, tag: string) => { patch[key] = tval(tag, txInf); };
            
            setTxVal('rtrId', 'RtrId');
            setTxVal('orgnlMsgId', 'OrgnlMsgId');
            setTxVal('orgnlMsgNmId', 'OrgnlMsgNmId');
            setTxVal('orgnlInstrId', 'OrgnlInstrId');
            setTxVal('orgnlEndToEndId', 'OrgnlEndToEndId');
            setTxVal('orgnlTxId', 'OrgnlTxId');
            setTxVal('orgnlUETR', 'OrgnlUETR');
            
            const rtrAmt = doc.getElementsByTagName('RtrdIntrBkSttlmAmt')[0] || doc.getElementsByTagName('IntrBkSttlmAmt')[0];
            patch.amount = rtrAmt?.textContent?.trim() || '';
            patch.currency = rtrAmt?.getAttribute('Ccy') || '';
            
            setTxVal('sttlmDt', 'IntrBkSttlmDt');
            setTxVal('chrgBr', 'ChrgBr');

            const orgAmt = doc.getElementsByTagName('OrgnlIntrBkSttlmAmt')[0];
            if (orgAmt) {
                patch.orgnlAmount = orgAmt.textContent?.trim() || '';
                patch.orgnlCurrency = orgAmt.getAttribute('Ccy') || '';
            }
            setTxVal('orgnlSttlmDt', 'OrgnlIntrBkSttlmDt');

            const rtrRsn = doc.getElementsByTagName('RtrRsnInf')[0];
            if (rtrRsn) {
                patch.rtrRsnCd = tval('Cd', rtrRsn);
                patch.rtrRsnAddtlInf = tval('AddtlInf', rtrRsn);
            }

            // Agents and Parties
            this.agentPrefixes.forEach(p => {
                const tagMap: any = {
                    'instgAgt': 'InstgAgt', 'instdAgt': 'InstdAgt', 'dbtrAgt': 'DbtrAgt', 'cdtrAgt': 'CdtrAgt',
                    'dbtr': 'Dbtr', 'cdtr': 'Cdtr', 'initgPty': 'InitgPty', 'ultmtDbtr': 'UltmtDbtr', 'ultmtCdtr': 'UltmtCdtr'
                };
                const t = tagMap[p];
                const block = doc.getElementsByTagName(t)[0];
                if (!block) return;

                patch[p + 'Bic'] = tval('BICFI', block) || tval('AnyBIC', block);
                patch[p + 'Name'] = tval('Nm', block);
                patch[p + 'Lei'] = tval('LEI', block);
                
                const mmbIdNode = block.getElementsByTagName('MmbId')[0];
                if (mmbIdNode) {
                    patch[p + 'MmbId'] = mmbIdNode.textContent?.trim() || '';
                    patch[p + 'ClrSysCd'] = tval('Cd', block.getElementsByTagName('ClrSysId')[0]);
                }

                const acct = block.getElementsByTagName('Acct')[0] || block.getElementsByTagName(t + 'Acct')[0];
                if (acct) {
                    patch[p + 'Acct'] = tval('Id', acct.getElementsByTagName('Othr')[0]) || tval('IBAN', acct);
                }

                const adr = block.getElementsByTagName('PstlAdr')[0];
                if (adr) {
                    patch[p + 'AddrType'] = 'structured'; // Default if tag exists
                    patch[p + 'BldgNb'] = tval('BldgNb', adr);
                    patch[p + 'StrtNm'] = tval('StrtNm', adr);
                    patch[p + 'PstCd'] = tval('PstCd', adr);
                    patch[p + 'TwnNm'] = tval('TwnNm', adr);
                    patch[p + 'Ctry'] = tval('Ctry', adr);
                } else {
                    patch[p + 'AddrType'] = 'none';
                }
            });

            this.form.patchValue(patch, { emitEvent: false });
        } catch (e) {
            console.error('Error parsing XML to form:', e);
        }
    }

    private pushHistory() {
        if (this.xmlHistoryIdx < this.xmlHistory.length - 1) this.xmlHistory.splice(this.xmlHistoryIdx + 1);
        this.xmlHistory.push(this.generatedXml);
        if (this.xmlHistory.length > this.maxHistory) this.xmlHistory.shift();
        else this.xmlHistoryIdx++;
    }

    undoXml() { if (this.xmlHistoryIdx > 0) { this.isInternalChange = true; this.generatedXml = this.xmlHistory[--this.xmlHistoryIdx]; setTimeout(()=>this.isInternalChange=false,10); } }
    redoXml() { if (this.xmlHistoryIdx < this.xmlHistory.length - 1) { this.isInternalChange = true; this.generatedXml = this.xmlHistory[++this.xmlHistoryIdx]; setTimeout(()=>this.isInternalChange=false,10); } }
    canUndoXml() { return this.xmlHistoryIdx > 0; }
    canRedoXml() { return this.xmlHistoryIdx < this.xmlHistory.length - 1; }

    copyToClipboard() { navigator.clipboard.writeText(this.generatedXml).then(() => this.snackBar.open('Copied!', 'Close', { duration: 2000 })); }
    downloadXml() { const b = new Blob([this.generatedXml], { type: 'application/xml' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `pacs004-${Date.now()}.xml`; a.click(); }

    validateMessage() {
        this.showValidationModal = true;
        this.validationStatus = 'validating';
        this.http.post(this.config.getApiUrl('/validate'), {
            xml_content: this.generatedXml,
            mode: 'Full 1-3',
            message_type: 'pacs.004.001.09',
            store_in_history: true
        }).subscribe({
            next: (data: any) => { this.validationReport = data; this.validationStatus = 'done'; },
            error: (err) => { this.validationStatus = 'done'; this.snackBar.open('Backend Error', 'Close', { duration: 3000 }); }
        });
    }

    closeValidationModal() { this.showValidationModal = false; }
    getValidationLayers() { return this.validationReport?.layer_status ? Object.keys(this.validationReport.layer_status) : []; }
    isLayerPass(k: string) {
        const s = this.getLayerStatus(k);
        return s.includes('✅') || s === 'PASS' || s === 'SUCCESS';
    }
    isLayerFail(k: string) {
        const s = this.getLayerStatus(k);
        return s.includes('❌') || s === 'FAIL' || s === 'ERROR';
    }
    isLayerWarn(k: string) {
        const s = this.getLayerStatus(k);
        return s.includes('⚠') || s.includes('WARNING') || s.includes('WARN');
    }
    getLayerName(k: string) { const m: any = { '1': 'Syntax & Format', '2': 'Schema Validation', '3': 'Business Rules' }; return m[k] || `Layer ${k}`; }
    getLayerTime(k: string) { return this.validationReport.layer_status[k]?.time || 0; }
    getLayerStatus(k: string) { return this.validationReport?.layer_status[k]?.status || 'IDLE'; }
    getValidationIssues() { return this.validationReport?.details || []; }
    toggleValidationIssue(i: any) { this.validationExpandedIssue = this.validationExpandedIssue === i ? null : i; }

    refreshUetr() { this.form.patchValue({ orgnlUETR: this.uetrService.generate() }); this.uetrSuccess = 'New UETR generated'; setTimeout(()=>this.uetrSuccess=null,3000); }
    validateManualUetr() { /* Optional logic if service available */ }
    onUetrPaste(e: any) { /* Optional logic */ }

    formatXml() {
        if (!this.generatedXml?.trim()) return;
        try {
            this.pushHistory();
            const tab = '    ';
            let formatted = '';
            let indent = '';

            // Normalize XML by removing whitespace between tags but preserving it elsewhere
            let xml = this.generatedXml.replace(/>\s+</g, '><').trim();
            
            // Regex to identify: 
            // 1. Leaf nodes like <tag>value</tag> or <tag/>
            // 2. Opening tags like <tag>
            // 3. Closing tags like </tag>
            // 4. XML declarations
            const reg = /(<[^>]+>[^<]*<\/([^>]+)>)|(<[^>]+\/>)|(<[^>]+>)|([^<]+)/g;
            const nodes = xml.match(reg) || [];

            nodes.forEach(node => {
                const trimmed = node.trim();
                if (!trimmed) return;

                // Case 1: Leaf node (e.g., <MsgId>123</MsgId> or <PmtId/>)
                if ((trimmed.startsWith('<') && trimmed.includes('</')) || trimmed.endsWith('/>')) {
                    formatted += indent + trimmed + '\n';
                }
                // Case 2: Closing tag (e.g., </GrpHdr>)
                else if (trimmed.startsWith('</')) {
                    if (indent.length >= tab.length) indent = indent.substring(tab.length);
                    formatted += indent + trimmed + '\n';
                }
                // Case 3: Opening tag (e.g., <GrpHdr>)
                else if (trimmed.startsWith('<') && !trimmed.startsWith('<?')) {
                    formatted += indent + trimmed + '\n';
                    indent += tab;
                }
                // Case 4: XML Declaration or plain text (fallback)
                else {
                    formatted += indent + trimmed + '\n';
                }
            });

            this.isInternalChange = true;
            this.generatedXml = formatted.trim();
            setTimeout(() => this.isInternalChange = false, 10);
            this.snackBar.open('XML Formatted', 'Close', { duration: 2000 });
        } catch (e) {
            this.snackBar.open('Format Error', 'Close', { duration: 2000 });
        }
    }

    toggleCommentXml() {
        const textarea = document.querySelector('textarea.code-editor') as HTMLTextAreaElement;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = this.generatedXml;
        const selection = text.substring(start, end);
        let newText = '';
        if (selection.startsWith('<!--') && selection.endsWith('-->')) {
            newText = text.substring(0, start) + selection.substring(4, selection.length - 3) + text.substring(end);
        } else {
            newText = text.substring(0, start) + '<!--' + selection + '-->' + text.substring(end);
        }
        this.isInternalChange = true;
        this.generatedXml = newText;
        setTimeout(() => this.isInternalChange = false, 10);
        this.pushHistory();
        this.snackBar.open(selection.startsWith('<!--') ? 'Comment Removed' : 'Comment Added', 'Close', { duration: 2000 });
    }

    viewXmlModal() {
        this.currentTab = 'preview';
        this.closeValidationModal();
    }

    editXmlModal() {
        this.currentTab = 'form';
        this.closeValidationModal();
    }

    runValidationModal() {
        this.validateMessage();
    }

    copyFix(suggestion: string, event: Event) {
        event.stopPropagation();
        navigator.clipboard.writeText(suggestion).then(() => {
            this.snackBar.open('Fix suggestion copied!', 'Close', { duration: 2000 });
        });
    }
}
