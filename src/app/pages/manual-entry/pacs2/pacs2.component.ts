import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../../../services/config.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { UetrService } from '../../../services/uetr.service';

@Component({
  selector: 'app-pacs2',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatIconModule],
  templateUrl: './pacs2.component.html',
  styleUrls: ['./pacs2.component.css']
})
export class Pacs2Component implements OnInit {
  @ViewChild('xmlEditor') xmlEditor!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('lineNumbers') lineNumbersRef!: ElementRef<HTMLDivElement>;

  form!: FormGroup;
  generatedXml = '';
  isParsingXml = false;
  isInternalChange = false;
  validating = false;
  
  // Validation reporting
  showValidationModal = false;
  validationStatus: 'idle' | 'validating' | 'done' = 'idle';
  validationReport: any = null;
  validationExpandedIssue: any = null;
  
  editorLineCount: number[] = [1];
  xmlHistory: string[] = [];
  xmlHistoryIdx = -1;
  maxHistory = 50;

  countries: string[] = [];
  statusCodes = ['ACTC', 'ACCP', 'RJCT', 'PDNG'];
  reasonCodes: { [key: string]: string[] } = {
    'RJCT': [
      'AC01 – Incorrect Account Number',
      'AC04 – Closed Account',
      'AC06 – Blocked Account',
      'AG01 – Transaction Forbidden',
      'AG02 – Invalid Bank',
      'AM04 – Insufficient Funds',
      'BE01 – Invalid Beneficiary',
      'FF01 – Fraud Suspected',
      'RC01 – Invalid BIC'
    ],
    'PDNG': [
      'PD01 – Pending Processing',
      'PD02 – Awaiting Funds',
      'PD03 – Awaiting Authorization'
    ],
    'ACCP': ['NARR – No specific reason / informational'],
    'ACTC': ['NARR – No specific reason / informational']
  };

  get currentReasonCodes() {
    return this.reasonCodes[this.form.get('txSts')?.value] || [];
  }

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private config: ConfigService,
    private snackBar: MatSnackBar,
    private router: Router,
    private uetrService: UetrService
  ) {}

  ngOnInit() {
    this.fetchCountries();
    this.buildForm();
    this.generateXml();
    this.pushHistory();
  }

  fetchCountries() {
    this.http.get<any>(this.config.getApiUrl('/codelists/country')).subscribe({
      next: (res) => { if (res && res.codes) this.countries = res.codes; },
      error: (err) => console.error('Failed to load countries', err)
    });
  }

  buildForm() {
    const BIC = [Validators.required, Validators.maxLength(11), Validators.pattern(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)];
    const BIC_OPT = [Validators.maxLength(11), Validators.pattern(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)];
    const UETR_PATTERN = [Validators.required, Validators.maxLength(36), Validators.pattern(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)];

    this.form = this.fb.group({
      // AppHdr
      fromBic: ['BBBBUS33XXX', BIC],
      toBic: ['CCCCGB2LXXX', BIC],
      bizMsgId: ['MSG-2026-FI-S-001', [Validators.required, Validators.maxLength(35)]],
      msgDefIdr: ['pacs.002.001.10', Validators.required],
      bizSvc: ['swift.cbprplus.02', Validators.required],
      creDtTm: [this.isoNow(), Validators.required],

      // GrpHdr
      msgId: ['MSG-2026-FI-S-001-GH', [Validators.required, Validators.maxLength(35)]],

      // OrgnlGrpInf
      orgnlMsgId: ['MSG-' + Date.now() + '-ORG', [Validators.required, Validators.maxLength(35)]],
      orgnlMsgNmId: ['pacs.008.001.08', Validators.required],
      orgnlCreDtTm: [this.isoNow(), Validators.required],

      // TxRef
      orgnlInstrId: ['', [Validators.required, Validators.maxLength(35)]],
      orgnlEndToEndId: ['', Validators.maxLength(35)],
      orgnlTxId: ['', [Validators.required, Validators.maxLength(35)]],
      orgnlUETR: [this.uetrService.generate(), UETR_PATTERN],

      // TxSts
      txSts: ['ACTC', Validators.required],

      // StsRsnInf - Originator
      stsRsnOrgtrName: [''],
      stsRsnOrgtrStrtNm: ['', Validators.maxLength(70)],
      stsRsnOrgtrBldgNb: ['', Validators.maxLength(16)],
      stsRsnOrgtrBldgNm: ['', Validators.maxLength(35)],
      stsRsnOrgtrFlr: ['', Validators.maxLength(70)],
      stsRsnOrgtrPstBx: ['', Validators.maxLength(16)],
      stsRsnOrgtrRoom: ['', Validators.maxLength(70)],
      stsRsnOrgtrPstCd: ['', Validators.maxLength(16)],
      stsRsnOrgtrTwnNm: ['', Validators.maxLength(35)],
      stsRsnOrgtrTwnLctnNm: ['', Validators.maxLength(35)],
      stsRsnOrgtrDstrctNm: ['', Validators.maxLength(35)],
      stsRsnOrgtrCtrySubDvsn: ['', Validators.maxLength(35)],
      stsRsnOrgtrCtry: ['', Validators.pattern(/^[A-Z]{2,2}$/)],
      stsRsnOrgtrAdrLine1: ['', Validators.maxLength(70)],
      stsRsnOrgtrAdrLine2: ['', Validators.maxLength(70)],

      // Reason
      stsRsnCd: [''],
      stsRsnPrtry: [''],

      // AddtlInf
      stsRsnAddtlInf: [''],

      // EffDt
      effDt: [''],
      effDtTm: [''],

      // ClrSysRef
      clrSysRef: ['', Validators.maxLength(35)],

      // InstgAgt
      instgAgtBic: ['', BIC_OPT],
      instgAgtClrSysCd: ['', Validators.maxLength(5)],
      instgAgtMmbId: ['', Validators.maxLength(35)],
      instgAgtLei: ['', Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)],

      // InstdAgt
      instdAgtBic: ['', BIC_OPT],
      instdAgtClrSysCd: ['', Validators.maxLength(5)],
      instdAgtMmbId: ['', Validators.maxLength(35)],
      instdAgtLei: ['', Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)]
    });

    this.form.get('txSts')?.valueChanges.subscribe(() => {
      this.form.patchValue({ stsRsnCd: '' }, { emitEvent: false });
      this.updateReasonValidation();
    });

    this.form.valueChanges.subscribe(() => {
      if (!this.isParsingXml && !this.isInternalChange) {
        this.generateXml();
        this.pushHistory();
      }
    });

    // Initial validation check
    this.updateReasonValidation();
  }

  updateReasonValidation() {
    const sts = this.form.get('txSts')?.value;
    const rsnCd = this.form.get('stsRsnCd');
    if (sts === 'RJCT' || sts === 'PDNG') {
      rsnCd?.setValidators([Validators.required]);
    } else {
      rsnCd?.clearValidators();
    }
    rsnCd?.updateValueAndValidity({ emitEvent: false });
  }

  fdt(dt: string): string {
    if (!dt) return dt;
    let s = dt.trim().replace(/\.\d+/, '').replace('Z', '+00:00');
    if (s && !/([+-]\d{2}:\d{2})$/.test(s)) s += '+00:00';
    return s;
  }

  isoNow(): string {
    return this.fdt(new Date().toISOString());
  }

  generateXml() {
    const v = this.form.value;
    let txInf = '';
    
    // OrgnlGrpInf (Mandatory in CBPR+ if reporting on a msg)
    if (v.orgnlMsgId?.trim()) {
      txInf += this.branch('OrgnlGrpInf', 
        this.leaf('OrgnlMsgId', v.orgnlMsgId, 5) +
        this.leaf('OrgnlMsgNmId', v.orgnlMsgNmId, 5) +
        this.leaf('OrgnlCreDtTm', this.fdt(v.orgnlCreDtTm), 5)
      , 4);
    }

    // Refs
    txInf += this.leaf('OrgnlInstrId', v.orgnlInstrId, 4);
    txInf += this.leaf('OrgnlEndToEndId', v.orgnlEndToEndId, 4);
    txInf += this.leaf('OrgnlTxId', v.orgnlTxId, 4);
    txInf += this.leaf('OrgnlUETR', v.orgnlUETR, 4);

    // TxSts
    txInf += this.leaf('TxSts', v.txSts, 4);

    // StsRsnInf
    txInf += this.buildStsRsnInf(v);

    // FctvIntrBkSttlmDt
    txInf += this.buildFctvIntrBkSttlmDt(v);

    // ClrSysRef
    txInf += this.leaf('ClrSysRef', v.clrSysRef, 4);

    // Agts
    txInf += this.buildAgt('InstgAgt', v, 'instgAgt');
    txInf += this.buildAgt('InstdAgt', v, 'instdAgt');

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<BusMsgEnvlp xmlns="urn:swift:xsd:envelope">
\t<AppHdr xmlns="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
\t\t<Fr>
\t\t\t<FIId>
\t\t\t\t<FinInstnId>
\t\t\t\t\t<BICFI>${this.esc(v.fromBic)}</BICFI>
\t\t\t\t</FinInstnId>
\t\t\t</FIId>
\t\t</Fr>
\t\t<To>
\t\t\t<FIId>
\t\t\t\t<FinInstnId>
\t\t\t\t\t<BICFI>${this.esc(v.toBic)}</BICFI>
\t\t\t\t</FinInstnId>
\t\t\t</FIId>
\t\t</To>
\t\t<BizMsgIdr>${this.esc(v.bizMsgId)}</BizMsgIdr>
\t\t<MsgDefIdr>${this.esc(v.msgDefIdr)}</MsgDefIdr>
\t\t<BizSvc>${this.esc(v.bizSvc)}</BizSvc>
\t\t<CreDt>${this.fdt(v.creDtTm)}</CreDt>
\t</AppHdr>
\t<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.002.001.10">
\t\t<FIToFIPmtStsRpt>
\t\t\t<GrpHdr>
\t\t\t\t<MsgId>${this.esc(v.msgId)}</MsgId>
\t\t\t\t<CreDtTm>${this.fdt(v.creDtTm)}</CreDtTm>
\t\t\t</GrpHdr>
\t\t\t<TxInfAndSts>
${txInf.trimEnd()}
\t\t\t</TxInfAndSts>
\t\t</FIToFIPmtStsRpt>
\t</Document>
</BusMsgEnvlp>`;
    this.generatedXml = xml;
    this.refreshLineCount();
  }

  buildStsRsnInf(v: any): string {
    let inner = '';
    
    // Originator
    let orgtr = '';
    if (v.stsRsnOrgtrName?.trim() || v.stsRsnOrgtrTwnNm?.trim() || v.stsRsnOrgtrCtry?.trim()) {
      orgtr += this.leaf('Nm', v.stsRsnOrgtrName, 6);
      orgtr += this.addrXml(v, 'stsRsnOrgtr', 6);
    }
    if (orgtr) inner += this.branch('Orgtr', orgtr, 5);

    // Reason
    let rsn = '';
    if (v.stsRsnCd?.trim()) rsn += this.leaf('Cd', v.stsRsnCd, 7);
    else if (v.stsRsnPrtry?.trim()) rsn += this.leaf('Prtry', v.stsRsnPrtry, 7);
    if (rsn) inner += this.branch('Rsn', rsn, 6);

    // AddtlInf
    if (v.stsRsnAddtlInf?.trim()) inner += this.leaf('AddtlInf', v.stsRsnAddtlInf, 5);

    return inner ? this.branch('StsRsnInf', inner, 4) : '';
  }

  buildFctvIntrBkSttlmDt(v: any): string {
    if (v.effDt?.trim()) return this.branch('FctvIntrBkSttlmDt', this.leaf('Dt', v.effDt, 5), 4);
    if (v.effDtTm?.trim()) return this.branch('FctvIntrBkSttlmDt', this.leaf('DtTm', this.fdt(v.effDtTm), 5), 4);
    return '';
  }

  buildAgt(tag: string, v: any, prefix: string): string {
    let inner = '';
    if (v[prefix + 'Bic']?.trim()) inner += this.leaf('BICFI', v[prefix + 'Bic'], 6);
    if (v[prefix + 'MmbId']?.trim()) {
      let clr = '';
      if (v[prefix + 'ClrSysCd']?.trim()) clr += this.branch('ClrSysId', this.leaf('Cd', v[prefix + 'ClrSysCd'], 8), 7);
      clr += this.leaf('MmbId', v[prefix + 'MmbId'], 7);
      inner += this.branch('ClrSysMmbId', clr, 6);
    }
    if (v[prefix + 'Lei']?.trim()) inner += this.leaf('LEI', v[prefix + 'Lei'], 6);
    
    return inner ? this.branch(tag, this.branch('FinInstnId', inner, 5), 4) : '';
  }

  addrXml(v: any, p: string, indent = 4): string {
    const lines: string[] = []; const t = '\t'.repeat(indent + 1);
    const val = (f: string) => v[p + f]?.trim();

    ['Dept', 'SubDept', 'StrtNm', 'BldgNb', 'BldgNm', 'Flr', 'PstBx', 'Room', 'PstCd', 'TwnNm', 'TwnLctnNm', 'DstrctNm', 'CtrySubDvsn', 'Ctry'].forEach(f => {
      if (val(f)) lines.push(`${t}<${f}>${this.esc(val(f))}</${f}>`);
    });
    if (val('AdrLine1')) lines.push(`${t}<AdrLine>${this.esc(val('AdrLine1'))}</AdrLine>`);
    if (val('AdrLine2')) lines.push(`${t}<AdrLine>${this.esc(val('AdrLine2'))}</AdrLine>`);

    return lines.length ? `${'\t'.repeat(indent)}<PstlAdr>\n${lines.join('\n')}\n${'\t'.repeat(indent)}</PstlAdr>\n` : '';
  }

  private esc(v: any): string {
    if (v === null || v === undefined) return '';
    return v.toString().trim()
      .replace(/[\n\r\t]+/g, ' ')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private leaf(tag: string, val: any, indent = 3): string {
    const content = this.esc(val);
    if (!content) return '';
    return `${'\t'.repeat(indent)}<${tag}>${content}</${tag}>\n`;
  }

  private branch(tag: string, content: string, indent = 3): string {
    const c = content?.trim();
    if (!c) return '';
    return `${'\t'.repeat(indent)}<${tag}>\n${c}\n${'\t'.repeat(indent)}</${tag}>\n`;
  }

  // History & Editor Logic
  onEditorChange(content: string) {
    if (this.isInternalChange) return;
    this.generatedXml = content;
    this.refreshLineCount();
    this.parseXmlToForm(content);
  }

  pushHistory() {
    if (this.xmlHistory[this.xmlHistoryIdx] === this.generatedXml) return;
    this.xmlHistory = this.xmlHistory.slice(0, this.xmlHistoryIdx + 1);
    this.xmlHistory.push(this.generatedXml);
    if (this.xmlHistory.length > 50) this.xmlHistory.shift();
    else this.xmlHistoryIdx++;
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

  canUndoXml() { return this.xmlHistoryIdx > 0; }
  canRedoXml() { return this.xmlHistoryIdx < this.xmlHistory.length - 1; }

  refreshLineCount() {
    const lines = (this.generatedXml || '').split('\n').length;
    this.editorLineCount = Array.from({ length: Math.max(lines, 1) }, (_, i) => i + 1);
  }

  syncScroll(editor: HTMLTextAreaElement, gutter: HTMLDivElement) {
    gutter.scrollTop = editor.scrollTop;
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
      const reg = /(<[^/!?][^>]*>[^<]*<\/[^>]+>)|(<[^>]+\/>)|(<[^>]+>)|(<!--[\s\S]*?-->)|([^<]+)/g;
      const nodes = xml.match(reg) || [];

      nodes.forEach(node => {
        const trimmed = node.trim();
        if (!trimmed) return;

        if (trimmed.startsWith('</')) {
          if (indent.length >= tab.length) indent = indent.substring(tab.length);
          formatted += indent + trimmed + '\r\n';
        } else if ((trimmed.startsWith('<') && trimmed.includes('</')) || trimmed.endsWith('/>')) {
          formatted += indent + trimmed + '\r\n';
        } else if (trimmed.startsWith('<') && !trimmed.startsWith('<?')) {
          formatted += indent + trimmed + '\r\n';
          indent += tab;
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

  parseXmlToForm(xml: string) {
    if (!xml?.trim()) return;
    try {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      if (doc.getElementsByTagName('parsererror').length) return;
      
      const t = (tag: string) => doc.getElementsByTagName(tag)[0]?.textContent || '';
      const patch: any = {};
      
      // Top level / Header
      patch.fromBic = t('BICFI'); // First instance
      patch.bizMsgId = t('BizMsgIdr');
      patch.msgId = t('MsgId');
      patch.creDtTm = t('CreDt') || t('CreDtTm');
      patch.bizSvc = t('BizSvc');

      // OrgnlGrpInf
      patch.orgnlMsgId = t('OrgnlMsgId');
      patch.orgnlMsgNmId = t('OrgnlMsgNmId');
      patch.orgnlCreDtTm = t('OrgnlCreDtTm');

      // Refs
      patch.orgnlInstrId = t('OrgnlInstrId');
      patch.orgnlEndToEndId = t('OrgnlEndToEndId');
      patch.orgnlTxId = t('OrgnlTxId');
      patch.orgnlUETR = t('OrgnlUETR');

      // Status
      patch.txSts = t('TxSts');
      patch.clrSysRef = t('ClrSysRef');
      patch.stsRsnCd = t('Cd');
      patch.stsRsnPrtry = t('Prtry');
      patch.stsRsnAddtlInf = t('AddtlInf');

      // FctvIntrBkSttlmDt
      patch.effDt = t('Dt');
      patch.effDtTm = t('DtTm');

      this.isParsingXml = true;
      this.form.patchValue(patch, { emitEvent: false });
      this.isParsingXml = false;
    } catch (e) {}
  }

  validateMessage() {
    this.generateXml();
    this.form.markAllAsTouched();
    if (this.form.invalid) {
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
      message_type: 'pacs.002.001.10',
      store_in_history: true
    }).subscribe({
      next: (data: any) => {
        this.validationReport = data;
        this.validationStatus = 'done';
      },
      error: (err) => {
        this.validationReport = {
          status: 'FAIL', errors: 1, warnings: 0,
          message: 'pacs.002.001.10', total_time_ms: 0,
          layer_status: {},
          details: [{
            severity: 'ERROR', layer: 0, code: 'BACKEND_ERROR',
            path: '', message: 'Validation failed — ' + (err.error?.detail?.message || 'backend error.'),
            fix_suggestion: 'Verify your network or if the validation service is up.'
          }]
        };
        this.validationStatus = 'done';
      }
    });
  }

  getValidationStatusClass() {
    if (!this.validationReport) return '';
    return this.validationReport.status === 'OK' ? 'status-ok' : 'status-fail';
  }

  // UI Helpers
  err(f: string): string | null {
    const c = this.form.get(f);
    if (!c || c.valid) return null;
    
    // Always show maxlength errors immediately as they occur
    if (c.errors?.['maxlength']) return `Max length ${c.errors['maxlength'].requiredLength} characters.`;
    
    // For other errors (Required, Pattern), only show after the user has interacted with the field
    if (!c.touched && !c.dirty) return null;

    if (c.errors?.['required']) return 'Required field.';
    if (c.errors?.['pattern']) {
      if (f.toLowerCase().includes('bic')) return '8 or 11-char BIC required.';
      if (f.toLowerCase().includes('uetr')) return 'Valid RFC 4122 v4 UUID expected.';
      return 'Invalid format.';
    }
    return 'Invalid value.';
  }

  refreshUetr(): void {
    const newUetr = this.uetrService.generate();
    this.form.patchValue({ orgnlUETR: newUetr });
    this.snackBar.open('New UETR Generated', '', { duration: 1500 });
  }

  onUetrPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text') || '';
    const cleanUetr = pastedText.trim().toLowerCase();
    this.form.patchValue({ orgnlUETR: cleanUetr });
    this.validateManualUetr();
  }

  validateManualUetr(): void {
    const uetrValue = this.form.get('orgnlUETR')?.value;
    if (uetrValue && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uetrValue)) {
      this.snackBar.open('Manual UETR might not be valid RFC 4122 v4', 'OK', { duration: 3000 });
    }
  }

  downloadXml() {
    this.generateXml();
    const blob = new Blob([this.generatedXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pacs002-${Date.now()}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  copyXml() {
    navigator.clipboard.writeText(this.generatedXml);
    this.snackBar.open('XML Copied!', 'Close', { duration: 2000 });
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

  viewXmlModal() {
    this.closeValidationModal();
    // In pacs2, there's no tab system shown in the other files for preview, 
  }

  editXmlModal() {
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

  copyToClipboard() {
    this.copyXml();
  }

  hint(f: string, maxLen: number): string | null {
    const c = this.form.get(f);
    if (!c || !c.value) return null;
    const len = c.value.toString().length;
    return len > maxLen ? `Maximum ${maxLen} characters reached (${len}/${maxLen})` : null;
  }
}
