import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../../../services/config.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { UetrService } from '../../../services/uetr.service';

@Component({
  selector: 'app-pain002',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatIconModule],
  templateUrl: './pain002.component.html',
  styleUrls: ['./pain002.component.css']
})
export class Pain002Component implements OnInit {
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

  // Form submission validation
  formSubmissionErrors: string[] = [];
  showSubmissionErrors = false;

  // Collapsible sections
  sections: Record<string, boolean> = {
    'bah': true,
    'bahFrom': false,
    'bahTo': false,
    'bahMktPrctc': false,
    'bahRltd': false,
    'grpHdr': true,
    'orgnlGrpInf': true,
    'orgnlPmtInf': true,
    'txInf': true
  };

  countries: string[] = [];

  // Codelists
  charSetOptions = ['UTF-8', 'US-ASCII', 'ISO-8859-1'];
  groupStatuses = ['ACCP', 'ACSP', 'ACTC', 'PART', 'RCVD', 'RJCT'];
  transactionStatuses = [
    { code: 'ACCP', label: 'Accepted Customer Profile' },
    { code: 'ACSC', label: 'Accepted Settlement Completed' },
    { code: 'ACSP', label: 'Accepted Settlement In Process' },
    { code: 'ACTC', label: 'Accepted Technical Validation' },
    { code: 'ACWC', label: 'Accepted With Change' },
    { code: 'ACWP', label: 'Accepted Without Posting' },
    { code: 'BLCK', label: 'Blocked' },
    { code: 'CANC', label: 'Cancelled' },
    { code: 'PATC', label: 'Partially Accepted' },
    { code: 'PDNG', label: 'Pending' },
    { code: 'RCVD', label: 'Received' },
    { code: 'RJCT', label: 'Rejected' }
  ];
  statusReasonCodes = [
    { code: 'AC01', label: 'Incorrect Account Number' },
    { code: 'AC04', label: 'Closed Account Number' },
    { code: 'AC06', label: 'Blocked Account' },
    { code: 'AG01', label: 'Transaction Forbidden' },
    { code: 'AM04', label: 'Insufficient Funds' },
    { code: 'AM05', label: 'Duplication' },
    { code: 'BE05', label: 'Unrecognised Initiating Party' },
    { code: 'CUST', label: 'Requested By Customer' },
    { code: 'DUPL', label: 'Duplicate Payment' },
    { code: 'MS03', label: 'Not Specified Reason Agent' },
    { code: 'NARR', label: 'Narrative' },
    { code: 'TECH', label: 'Technical Problem' }
  ];

  clrSysCodes = ['USABA', 'USPID', 'GBDSC', 'INFSC', 'NZNCC', 'AUBSB', 'CACPA', 'DEBLZ'];
  copyDplctCodes = ['COPY', 'CODU', 'DUPL'];
  priorityCodes = ['HIGH', 'NORM'];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private config: ConfigService,
    private snackBar: MatSnackBar,
    private router: Router,
    public uetrService: UetrService
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

  toggleSection(key: string) {
    this.sections[key] = !this.sections[key];
  }

  buildForm() {
    const BIC_OPT = [Validators.pattern(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)];
    const LEI_PATTERN = [Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)];

    this.form = this.fb.group({
      // ═══ BAH ═══
      head_charSet: ['UTF-8'],
      head_fromBic: ['HDFCINBBXXX', BIC_OPT],
      head_fromClrSysCd: [''],
      head_fromMmbId: ['', [Validators.maxLength(35)]],
      head_fromLei: ['', LEI_PATTERN],
      head_toBic: ['CHASUS33XXX', BIC_OPT],
      head_toClrSysCd: [''],
      head_toMmbId: ['', [Validators.maxLength(35)]],
      head_toLei: ['', LEI_PATTERN],
      head_bizMsgIdr: ['MSGID-' + this.dateStamp() + '-' + this.randomId(), [Validators.required, Validators.maxLength(35)]],
      head_msgDefIdr: [{ value: 'pain.002.001.10', disabled: true }],
      head_bizSvc: ['swift.cbprplus.02', [Validators.maxLength(35)]],
      head_mktPrctcRegy: ['', [Validators.maxLength(35)]],
      head_mktPrctcId: ['', [Validators.maxLength(35)]],
      head_creDt: [this.isoNow(), Validators.required],
      head_cpyDplct: [''],
      head_pssblDplct: [false],
      head_prty: [''],

      // Related Header
      head_rltd_enabled: [false],
      head_rltd_charSet: ['UTF-8'],
      head_rltd_fromBic: ['', BIC_OPT],
      head_rltd_fromClrSysCd: [''],
      head_rltd_fromMmbId: ['', [Validators.maxLength(35)]],
      head_rltd_fromLei: ['', LEI_PATTERN],
      head_rltd_toBic: ['', BIC_OPT],
      head_rltd_toClrSysCd: [''],
      head_rltd_toMmbId: ['', [Validators.maxLength(35)]],
      head_rltd_toLei: ['', LEI_PATTERN],
      head_rltd_bizMsgIdr: ['', [Validators.maxLength(35)]],
      head_rltd_msgDefIdr: [''],
      head_rltd_bizSvc: [''],
      head_rltd_creDt: [''],
      head_rltd_cpyDplct: [''],
      head_rltd_prty: [''],

      // ═══ Group Header ═══
      grpHdr_msgId: ['PAIN002-' + this.dateStamp() + '-' + this.randomId(), [Validators.required, Validators.maxLength(35)]],
      grpHdr_creDtTm: [this.isoNow(), Validators.required],
      
      initgPty: this.initPartyGroup(),
      fwdgAgt: this.initAgentGroup(),

      // ═══ Original Group Info ═══
      orgnlMsgId: ['MSGID-' + this.dateStamp() + '-' + this.randomId(), [Validators.required, Validators.maxLength(35)]],
      orgnlMsgNmId: ['pain.001.001.09', [Validators.required, Validators.maxLength(35)]],
      orgnlCreDtTm: ['', [Validators.pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/)]],
      grpSts: [''],

      // ═══ Original Payment Info ═══
      orgnlPmtInfId: ['PMTINF-' + this.dateStamp() + '-001', [Validators.required, Validators.maxLength(35)]],
      
      // Transactions Array
      transactions: this.fb.array([this.initTransaction()])
    });

    this.form.valueChanges.subscribe(() => {
      if (!this.isParsingXml && !this.isInternalChange) {
        this.generateXml();
        this.pushHistory();
      }
    });

    // Auto-uppercase BIC/LEI
    ['head_fromBic', 'head_toBic', 'head_rltd_fromBic', 'head_rltd_toBic'].forEach(f => {
       this.form.get(f)?.valueChanges.subscribe(v => {
         if (v && v !== v.toUpperCase()) this.form.get(f)?.setValue(v.toUpperCase(), {emitEvent: false});
       });
    });
  }

  initPartyGroup() {
    return this.fb.group({
      name: ['', [Validators.maxLength(140)]],
      postal: this.initPostalGroup(),
      idType: ['org'],
      orgAnyBic: ['', [Validators.pattern(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)]],
      orgLei: ['', [Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)]],
      orgId: ['', [Validators.maxLength(35)]],
      orgScheme: [''],
      orgPrtry: ['', [Validators.maxLength(35)]],
      orgIssr: ['', [Validators.maxLength(35)]],
      prvtBirthDt: [''],
      prvtCity: ['', [Validators.maxLength(35)]],
      prvtCtry: [''],
      prvtId: ['', [Validators.maxLength(35)]],
      prvtScheme: [''],
      prvtPrtry: ['', [Validators.maxLength(35)]],
      prvtIssr: ['', [Validators.maxLength(35)]],
      ctryOfRes: ['']
    });
  }

  initAgentGroup() {
    return this.fb.group({
      bic: ['', [Validators.pattern(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)]],
      clrSys: [''],
      mmbId: ['', [Validators.maxLength(35)]],
      name: ['', [Validators.maxLength(140)]],
      postal: this.initPostalGroup()
    });
  }

  initPostalGroup() {
    return this.fb.group({
      dept: ['', [Validators.maxLength(70)]],
      subDept: ['', [Validators.maxLength(70)]],
      street: ['', [Validators.maxLength(70)]],
      bldgNb: ['', [Validators.maxLength(16)]],
      bldgNm: ['', [Validators.maxLength(35)]],
      floor: ['', [Validators.maxLength(70)]],
      pstBx: ['', [Validators.maxLength(16)]],
      room: ['', [Validators.maxLength(70)]],
      pstCd: ['', [Validators.maxLength(16)]],
      town: ['', [Validators.maxLength(35)]],
      townLctn: ['', [Validators.maxLength(35)]],
      district: ['', [Validators.maxLength(35)]],
      ctrySub: ['', [Validators.maxLength(35)]],
      ctry: [''],
      addrLines: this.fb.array([this.fb.control('', [Validators.maxLength(70)])])
    });
  }

  initTransaction() {
    return this.fb.group({
      orgnlInstrId: ['', [Validators.maxLength(35)]],
      orgnlEndToEndId: ['E2E-' + this.dateStamp() + '-' + this.randomId(), [Validators.required, Validators.maxLength(35)]],
      orgnlUetr: [this.uetrService.generate(), [Validators.required, Validators.pattern(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)]],
      txSts: ['ACSC'],
      stsRsnCd: [''],
      addtlInf: this.fb.array([this.fb.control('', [Validators.maxLength(105)])])
    });
  }

  get transactions() { return this.form.get('transactions') as FormArray; }
  addTransaction() { this.transactions.push(this.initTransaction()); this.generateXml(); }
  removeTransaction(i: number) { if (this.transactions.length > 1) { this.transactions.removeAt(i); this.generateXml(); } }

  addAddrLine(group: any) { (group.get('postal.addrLines') as FormArray).push(this.fb.control('', [Validators.maxLength(70)])); }
  removeAddrLine(group: any, i: number) { const arr = group.get('postal.addrLines') as FormArray; if (arr.length > 1) arr.removeAt(i); }
  getAddrLines(group: any) { return (group.get('postal.addrLines') as FormArray).controls; }

  addAddtlInf(tx: any) { (tx.get('addtlInf') as FormArray).push(this.fb.control('', [Validators.maxLength(105)])); }
  removeAddtlInf(tx: any, i: number) { const arr = tx.get('addtlInf') as FormArray; if (arr.length > 1) arr.removeAt(i); }
  getAddtlInf(tx: any) { return (tx.get('addtlInf') as FormArray).controls; }

  refreshUetr(tx: any) { tx.patchValue({ orgnlUetr: this.uetrService.generate() }); }

  dateStamp(): string { return new Date().toISOString().slice(0, 10).replace(/-/g, ''); }
  randomId(): string { return Math.random().toString(36).substring(2, 8).toUpperCase(); }
  isoNow(): string { return new Date().toISOString().split('.')[0] + 'Z'; }
  fdt(d: string) { return d ? d.replace('Z', '+00:00') : d; }

  // ═══ XML Rendering ═══
  generateXml() {
    const v = this.form.getRawValue();
    let bah = '';
    bah += this.leaf('CharSet', v.head_charSet, 2);
    bah += this.renderFIId('Fr', v.head_fromBic, v.head_fromClrSysCd, v.head_fromMmbId, v.head_fromLei, 2);
    bah += this.renderFIId('To', v.head_toBic, v.head_toClrSysCd, v.head_toMmbId, v.head_toLei, 2);
    bah += this.leaf('BizMsgIdr', v.head_bizMsgIdr, 2);
    bah += this.leaf('MsgDefIdr', 'pain.002.001.10', 2);
    bah += this.leaf('BizSvc', v.head_bizSvc, 2);
    bah += this.leaf('CreDt', this.fdt(v.head_creDt), 2);

    let doc = '';
    doc += this.branch('GrpHdr', 
      this.leaf('MsgId', v.grpHdr_msgId, 4) +
      this.leaf('CreDtTm', this.fdt(v.grpHdr_creDtTm), 4) +
      this.renderParty('InitgPty', v.initgPty, 4), 3);

    let orgnlGrp = '';
    orgnlGrp += this.leaf('OrgnlMsgId', v.orgnlMsgId, 4);
    orgnlGrp += this.leaf('OrgnlMsgNmId', v.orgnlMsgNmId, 4);
    if (v.orgnlCreDtTm) orgnlGrp += this.leaf('OrgnlCreDtTm', this.fdt(v.orgnlCreDtTm), 4);
    if (v.grpSts) orgnlGrp += this.leaf('GrpSts', v.grpSts, 4);
    doc += this.branch('OrgnlGrpInfAndSts', orgnlGrp, 3);

    let orgnlPmt = '';
    orgnlPmt += this.leaf('OrgnlPmtInfId', v.orgnlPmtInfId, 4);
    v.transactions.forEach((tx: any) => {
      let txInf = '';
      if (tx.orgnlInstrId) txInf += this.leaf('OrgnlInstrId', tx.orgnlInstrId, 5);
      txInf += this.leaf('OrgnlEndToEndId', tx.orgnlEndToEndId, 5);
      txInf += this.leaf('OrgnlUETR', tx.orgnlUetr, 5);
      if (tx.txSts) txInf += this.leaf('TxSts', tx.txSts, 5);
      
      let rsn = '';
      if (tx.stsRsnCd) rsn += this.branch('Rsn', this.leaf('Cd', tx.stsRsnCd, 7), 6);
      tx.addtlInf.forEach((info: string) => { if (info) rsn += this.leaf('AddtlInf', info, 6); });
      if (rsn) txInf += this.branch('StsRsnInf', rsn, 5);

      orgnlPmt += this.branch('TxInfAndSts', txInf, 4);
    });
    doc += this.branch('OrgnlPmtInfAndSts', orgnlPmt, 3);

    this.generatedXml = `<?xml version="1.0" encoding="UTF-8"?>
<BusMsgEnvlp xmlns="urn:swift:xsd:envelope">
\t<AppHdr xmlns="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
${bah.trimEnd()}
\t</AppHdr>
\t<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.002.001.10">
\t\t<CstmrPmtStsRpt>
${doc.trimEnd()}
\t\t</CstmrPmtStsRpt>
\t</Document>
</BusMsgEnvlp>`;
    this.refreshLineCount();
  }

  renderFIId(tag: string, bic: string, clr: string, mmb: string, lei: string, ind: number) {
    let fi = '';
    if (bic) fi += this.leaf('BICFI', bic, ind + 3);
    if (clr || mmb) {
      let cid = '';
      if (clr) cid += this.branch('ClrSysId', this.leaf('Cd', clr, ind + 5), ind + 4);
      if (mmb) cid += this.leaf('MmbId', mmb, ind + 4);
      fi += this.branch('ClrSysMmbId', cid, ind + 3);
    }
    if (lei) fi += this.leaf('LEI', lei, ind + 3);
    if (!fi) return '';
    return this.branch(tag, this.branch('FIId', this.branch('FinInstnId', fi, ind + 2), ind + 1), ind);
  }

  renderParty(tag: string, p: any, ind: number) {
    let inner = '';
    if (p.name) inner += this.leaf('Nm', p.name, ind + 1);
    // Identify
    let id = '';
    if (p.idType === 'org') {
      let org = '';
      if (p.orgAnyBic) org += this.leaf('AnyBIC', p.orgAnyBic, ind + 4);
      if (p.orgLei) org += this.leaf('LEI', p.orgLei, ind + 4);
      if (p.orgId) {
        let o = this.leaf('Id', p.orgId, ind + 5);
        if (p.orgScheme) o += this.branch('SchmeNm', this.leaf('Cd', p.orgScheme, ind + 7), ind + 6);
        else if (p.orgPrtry) o += this.branch('SchmeNm', this.leaf('Prtry', p.orgPrtry, ind + 7), ind + 6);
        org += this.branch('Othr', o, ind + 4);
      }
      if (org) id = this.branch('OrgId', org, ind + 3);
    }
    if (id) inner += this.branch('Id', id, ind + 2);
    if (!inner) return '';
    return this.branch(tag, inner, ind);
  }

  leaf(t: string, v: any, i: number) { return v ? `${'\t'.repeat(i)}<${t}>${v}</${t}>\n` : ''; }
  branch(t: string, c: string, i: number) { return c.trim() ? `${'\t'.repeat(i)}<${t}>\n${c.trimEnd()}\n${'\t'.repeat(i)}</${t}>\n` : ''; }

  // Utils
  refreshLineCount() { this.editorLineCount = Array.from({ length: (this.generatedXml || '').split('\n').length }, (_, i) => i + 1); }
  syncScroll(e: any, g: any) { g.scrollTop = e.scrollTop; }
  pushHistory() { this.xmlHistoryIdx++; this.xmlHistory[this.xmlHistoryIdx] = this.generatedXml; }
  undoXml() { if (this.xmlHistoryIdx > 0) { this.xmlHistoryIdx--; this.generatedXml = this.xmlHistory[this.xmlHistoryIdx]; this.refreshLineCount(); } }
  redoXml() { if (this.xmlHistoryIdx < this.xmlHistory.length - 1) { this.xmlHistoryIdx++; this.generatedXml = this.xmlHistory[this.xmlHistoryIdx]; this.refreshLineCount(); } }
  canUndoXml() { return this.xmlHistoryIdx > 0; }
  canRedoXml() { return this.xmlHistoryIdx < this.xmlHistory.length - 1; }
  copyToClipboard() { navigator.clipboard.writeText(this.generatedXml); this.snackBar.open('XML Copied!', 'Close', { duration: 2000 }); }
  downloadXml() { const blob = new Blob([this.generatedXml], { type: 'application/xml' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `pain002-${Date.now()}.xml`; a.click(); }
  formatXml() { /* Basic indentation already handled by generator */ }
  onEditorChange(e: string) { this.generatedXml = e; this.refreshLineCount(); }

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
      message_type: 'pain.002.001.10',
      store_in_history: true
    }).subscribe({
      next: (data: any) => {
        this.validationReport = data;
        this.validationStatus = 'done';
      },
      error: (err) => {
        this.validationReport = {
          status: 'FAIL', errors: 1, warnings: 0,
          message: 'pain.002.001.10', total_time_ms: 0,
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

  err(path: string) {
    const c = this.form.get(path);
    if (c && c.invalid && (c.touched || c.dirty)) {
      if (c.errors?.['required']) return 'Required';
      if (c.errors?.['pattern']) return 'Invalid Format';
      if (c.errors?.['maxlength']) return 'Too long';
    }
    return null;
  }
  charCount(path: string, max: number) { const v = this.form.get(path)?.value || ''; return `${v.length}/${max}`; }
  isNearLimit(path: string, max: number) { return (this.form.get(path)?.value || '').length > max * 0.8; }
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

  closeValidationModal() {
    this.showValidationModal = false;
    this.validationReport = null;
    this.validationStatus = 'idle';
    this.validationExpandedIssue = null;
  }

  viewXmlModal() {
    this.closeValidationModal();
    // Assuming there is a switchToPreview or similar
    // For pain002 we can just scroll to the right panel or ensure it is visible
  }

  editXmlModal() {
    this.closeValidationModal();
  }

  runValidationModal() {
    this.validateMessage();
  }
}
