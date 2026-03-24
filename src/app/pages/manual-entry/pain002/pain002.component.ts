import { Component, OnInit, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfigService } from '../../../services/config.service';

@Component({
  selector: 'app-pain002',
  templateUrl: './pain002.component.html',
  styleUrls: ['./pain002.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatIconModule, MatSnackBarModule, MatTooltipModule]
})
export class Pain002Component implements OnInit {
  form!: FormGroup;
  generatedXml = '';
  currentTab: 'form' | 'preview' = 'form';
  isParsingXml = false;
  editorLineCount: number[] = [];

  // History for Undo/Redo
  private xmlHistory: string[] = [];
  private xmlHistoryIdx = -1;
  private maxHistory = 50;
  private isInternalChange = false;

  // Codelists
  groupStatuses = ['ACCP', 'RJCT', 'PART'];
  transactionStatuses = ['ACCP', 'RJCT', 'PDNG'];
  reasonCodes = ['AC01', 'AM04', 'MS03', 'DN01', 'DUPL', 'AG02'];

  // Validation state
  showValidationModal = false;
  validationStatus: 'idle' | 'validating' | 'done' = 'idle';
  validationReport: any = null;
  validationExpandedIssue: any = null;
  
  warningTimeouts: { [key: string]: any } = {};
  showMaxLenWarning: { [key: string]: boolean } = {};

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private config: ConfigService,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit() {
    this.buildForm();
    this.generateXml();
    this.pushHistory();

    this.form.valueChanges.subscribe(() => {
      this.generateXml();
    });
  }

  private buildForm() {
    this.form = this.fb.group({
      // BAH
      fromBic: ['BANCGB2LXXX', [Validators.required, Validators.pattern(/^[A-Z0-9]{8,11}$/)]],
      toBic: ['BANCUS33XXX', [Validators.required, Validators.pattern(/^[A-Z0-9]{8,11}$/)]],
      bizMsgId: ['BMS-PSR-' + Date.now(), [Validators.required, Validators.maxLength(35)]],
      creDt: [this.isoNowDate(), [Validators.required]],

      // Group Header
      msgId: ['PAIN002-MSG-' + Date.now(), [Validators.required, Validators.maxLength(35)]],
      creDtTm: [this.isoNow(), Validators.required],
      initgPtyName: ['Initiating Party Name', [Validators.required, Validators.maxLength(140)]],

      // Original Group Info
      orgnlMsgId: ['PAIN001-MSG-' + Date.now(), [Validators.required, Validators.maxLength(35)]],
      orgnlMsgNmId: ['pain.001.001.09', [Validators.required, Validators.maxLength(35)]],
      orgnlCreDtTm: [this.isoNow(), [Validators.required]],
      orgnlPmtInfId: ['PMT-INF-' + Date.now(), [Validators.required, Validators.maxLength(35)]],
      grpSts: ['ACCP', Validators.required],

      // Transaction Status List
      transactions: this.fb.array([this.createTransactionStatusGroup()])
    });
  }

  private createTransactionStatusGroup(): FormGroup {
    return this.fb.group({
      orgnlInstrId: ['INSTR-' + Date.now(), [Validators.required, Validators.maxLength(35)]],
      orgnlEndToEndId: ['E2E-' + Date.now(), [Validators.required, Validators.maxLength(35)]],
      orgnlUetr: [this.uuidv4(), [Validators.required, Validators.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)]],
      txSts: ['ACCP', Validators.required],
      stsRsnCd: ['', [Validators.maxLength(4)]],
      stsAddtlInf: ['Payment received and processed normally.', [Validators.maxLength(105)]]
    });
  }

  get transactions(): FormArray {
    return this.form.get('transactions') as FormArray;
  }

  addTransaction() {
    this.transactions.push(this.createTransactionStatusGroup());
  }

  removeTransaction(index: number) {
    if (this.transactions.length > 1) {
      this.transactions.removeAt(index);
    }
  }

  uuidv4(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  isoNow(): string { return new Date().toISOString().split('.')[0] + 'Z'; }
  isoNowDate(): string { return new Date().toISOString().split('T')[0]; }

  private dtm(v: string): string {
    if (!v) return '';
    if (v.includes('T')) {
      if (!v.includes('+') && !v.endsWith('Z')) return v + '+00:00';
      return v;
    }
    return v + 'T00:00:00+00:00';
  }

  generateXml() {
    if (this.isParsingXml) return;
    const v = this.form.value;
    const txLen = v.transactions?.length || 0;
    const ctrlSum = v.transactions?.reduce((acc: number, tx: any) => acc + (parseFloat(tx.amount) || 0), 0).toFixed(2);
    
    // Header (BAH)
    const fr = this.tag('Fr', this.tag('FIId', this.tag('FinInstnId', this.el('BICFI', v.fromBic, 5), 4), 3), 2);
    const to = this.tag('To', this.tag('FIId', this.tag('FinInstnId', this.el('BICFI', v.toBic, 5), 4), 3), 2);
    const bah = fr + to + this.el('BizMsgIdr', v.bizMsgId, 2) + this.el('MsgDefIdr', 'pain.002.001.10', 2) + this.el('BizSvc', 'swift.cbprplus.03', 2) + this.el('CreDt', this.dtm(v.creDt), 2);

    // Group Header
    const grpHdr = this.tag('GrpHdr',
      this.el('MsgId', v.msgId, 4) +
      this.el('CreDtTm', this.dtm(v.creDtTm), 4) +
      this.tag('InitgPty', this.tag('Id', this.tag('OrgId', this.el('AnyBIC', v.fromBic, 7), 6), 5), 4),
      3
    );

    // Original Information Group (Mandatory Header Only)
    const orgnlGrpInf = this.tag('OrgnlGrpInfAndSts',
       this.el('OrgnlMsgId', v.orgnlMsgId, 4) +
       this.el('OrgnlMsgNmId', v.orgnlMsgNmId, 4) +
       this.el('OrgnlCreDtTm', this.dtm(v.orgnlCreDtTm), 4),
       3
    );

    // Transaction Status List
    let txsXml = '';
    v.transactions.forEach((tx: any) => {
      let rsnInf = '';
      if (tx.stsRsnCd || tx.stsAddtlInf) {
        let rsn = (tx.stsRsnCd ? this.tag('Rsn', this.el('Cd', tx.stsRsnCd, 7), 6) : '');
        let addtl = (tx.stsAddtlInf ? this.el('AddtlInf', tx.stsAddtlInf, 6) : '');
        rsnInf = this.tag('StsRsnInf', rsn + addtl, 5);
      }


      txsXml += this.tag('TxInfAndSts',
        this.el('OrgnlInstrId', tx.orgnlInstrId, 5) +
        this.el('OrgnlEndToEndId', tx.orgnlEndToEndId, 5) +
        this.el('OrgnlUETR', tx.orgnlUetr, 5) +
        this.el('TxSts', tx.txSts, 5) +
        rsnInf,
        4
      );
    });

    const orgnlPmtInf = this.tag('OrgnlPmtInfAndSts',
       this.el('OrgnlPmtInfId', v.orgnlPmtInfId, 4) +
       txsXml,
       3
    );

    this.generatedXml = `<?xml version="1.0" encoding="UTF-8"?>
<BusMsgEnvlp xmlns="urn:swift:xsd:envelope">
\t<AppHdr xmlns="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
${bah}\t</AppHdr>
\t<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.002.001.10">
\t\t<CstmrPmtStsRpt>
${grpHdr}${orgnlGrpInf}${orgnlPmtInf}\t\t</CstmrPmtStsRpt>
\t</Document>
</BusMsgEnvlp>`;

    this.onEditorChange(this.generatedXml, true);
  }

  // XML Helpers
  private e(v: any): string { return (v || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  private tabs(n: number): string { return '\t'.repeat(n); }
  private el(tag: string, val: any, indent: number): string {
    if (val === undefined || val === null || val === '') return '';
    return `${this.tabs(indent)}<${tag}>${this.e(val)}</${tag}>\n`;
  }
  private tag(tag: string, content: string, indent: number): string {
    if (!content || !content.trim()) return '';
    return `${this.tabs(indent)}<${tag}>\n${content}${this.tabs(indent)}</${tag}>\n`;
  }

  onEditorChange(content: string, fromForm = false) {
    if (!this.isInternalChange && !fromForm) {
      this.pushHistory();
      this.parseXmlToForm(content);
    }

    this.generatedXml = content;
    this.refreshLineCount();
  }

  private parseXmlToForm(xml: string) {
    if (!xml || xml.length < 50) return;
    try {
      this.isParsingXml = true;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');

      const findTag = (tagName: string, parent: any = doc): Element | null => {
        if (!parent) return null;
        const target = tagName.toLowerCase();
        if (parent.localName?.toLowerCase() === target) return parent;
        const els = parent.getElementsByTagName('*');
        for (let i = 0; i < els.length; i++) {
          if (els[i].localName?.toLowerCase() === target) return els[i];
        }
        return null;
      };

      const tval = (tag: string, parent: any = doc) => {
        const el = findTag(tag, parent);
        return el ? el.textContent?.trim() || '' : '';
      };

      const patch: any = {};

      // 1. AppHdr (BAH)
      const appHdr = findTag('AppHdr');
      if (appHdr) {
        const fr = findTag('Fr', appHdr);
        if (fr) patch.fromBic = tval('BICFI', fr);
        const to = findTag('To', appHdr);
        if (to) patch.toBic = tval('BICFI', to);
        patch.bizMsgId = tval('BizMsgIdr', appHdr);
        
        const creDtRaw = tval('CreDt', appHdr);
        if (creDtRaw) {
          patch.creDt = creDtRaw.includes('T') ? creDtRaw.split('T')[0] : creDtRaw;
        }
      }

      // 2. Document
      const root = findTag('CstmrPmtStsRpt');
      if (root) {
        const grpHdr = findTag('GrpHdr', root);
        if (grpHdr) {
          patch.msgId = tval('MsgId', grpHdr) || 'PAIN002-MSG-' + Date.now();
          patch.creDtTm = tval('CreDtTm', grpHdr) || this.isoNow();
          const initgPty = findTag('InitgPty', grpHdr);
          if (initgPty) {
              patch.initgPtyName = tval('Nm', initgPty) || 'Initiating Party Name';
          }
        }

        const orgnlGrp = findTag('OrgnlGrpInfAndSts', root);
        if (orgnlGrp) {
          patch.orgnlMsgId = tval('OrgnlMsgId', orgnlGrp) || 'PAIN001-MSG-' + Date.now();
          patch.orgnlMsgNmId = tval('OrgnlMsgNmId', orgnlGrp) || 'pain.001.001.09';
          patch.orgnlCreDtTm = tval('OrgnlCreDtTm', orgnlGrp) || this.isoNow();
          patch.grpSts = tval('GrpSts', orgnlGrp) || 'ACCP';
        }

        const orgnlPmtInf = findTag('OrgnlPmtInfAndSts', root);
        if (orgnlPmtInf) {
          patch.orgnlPmtInfId = tval('OrgnlPmtInfId', orgnlPmtInf);
          
          const txsArr = orgnlPmtInf.getElementsByTagName('*');
          const txs: Element[] = [];
          for (let i = 0; i < txsArr.length; i++) {
            if (txsArr[i].localName?.toLowerCase() === 'txinfandsts') txs.push(txsArr[i]);
          }

          if (txs.length > 0) {
            this.transactions.clear();
            for (let i = 0; i < txs.length; i++) {
              const tx = txs[i];
              const txGroup = this.createTransactionStatusGroup();
              const txPatch: any = {
                orgnlInstrId: tval('OrgnlInstrId', tx),
                orgnlEndToEndId: tval('OrgnlEndToEndId', tx),
                orgnlUetr: tval('OrgnlUETR', tx),
                txSts: tval('TxSts', tx)
              };

              const rsnInf = findTag('StsRsnInf', tx);
              if (rsnInf) {
                const rsn = findTag('Rsn', rsnInf);
                if (rsn) txPatch.stsRsnCd = tval('Cd', rsn);
                txPatch.stsAddtlInf = tval('AddtlInf', rsnInf);
              }

              txGroup.patchValue(txPatch);
              this.transactions.push(txGroup);
            }
          }
        }
      }

      this.form.patchValue(patch, { emitEvent: false });
    } catch (e) {
      console.warn('XML Parse failed', e);
    } finally {
      setTimeout(() => this.isParsingXml = false, 50);
    }
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    // History & Formatting Shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+S)
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
  }

  @HostListener('input', ['$event'])
  onInput(event: any) {
    const target = event.target as HTMLInputElement;
    if (!target) return;
    const name = target.getAttribute('formControlName');
    if (!name) return;

    if (name.toLowerCase().includes('bic') || name.toLowerCase().includes('iban')) {
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const up = target.value.toUpperCase();
        if (target.value !== up) {
          target.value = up;
          if (start !== null) target.setSelectionRange(start, end);
          this.form.get(name)?.patchValue(up, { emitEvent: false });
        }
    }
    
    const max = target.maxLength;
    if (max > 0 && target.value.length >= max) {
      this.showMaxLenWarning[name] = true;
      if (this.warningTimeouts[name]) clearTimeout(this.warningTimeouts[name]);
      this.warningTimeouts[name] = setTimeout(() => this.showMaxLenWarning[name] = false, 3000);
    } else {
      this.showMaxLenWarning[name] = false;
    }
  }

  hint(f: string, max: number, group?: any): string | null {
    if (!this.showMaxLenWarning[f]) return null;
    const c = group ? group.get(f) : this.form.get(f);
    const len = c?.value?.length || 0;
    return `Maximum ${max} characters reached (${len}/${max})`;
  }

  copyToClipboard() { navigator.clipboard.writeText(this.generatedXml); this.snackBar.open('Copied!', 'Close', { duration: 3000 }); }
  downloadXml() { const b = new Blob([this.generatedXml], { type: 'application/xml' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `pain002-${Date.now()}.xml`; a.click(); }

  validateMessage() {
    this.showValidationModal = true;
    this.validationStatus = 'validating';
    this.validationReport = null;
    this.validationExpandedIssue = null;

    this.http.post(this.config.getApiUrl('/validate'), {
      xml_content: this.generatedXml,
      message_type: 'pain.002.001.10',
      mode: 'Full 1-3'
    }).subscribe({
      next: (res: any) => { 
        this.validationReport = res; 
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

  viewXmlModal() { this.showValidationModal = false; }
  runValidationModal() { this.validateMessage(); }

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
      this.parseXmlToForm(this.generatedXml);
      this.refreshLineCount();
      setTimeout(() => this.isInternalChange = false, 10);
    }
  }

  redoXml() {
    if (this.xmlHistoryIdx < this.xmlHistory.length - 1) {
      this.xmlHistoryIdx++;
      this.isInternalChange = true;
      this.generatedXml = this.xmlHistory[this.xmlHistoryIdx];
      this.parseXmlToForm(this.generatedXml);
      this.refreshLineCount();
      setTimeout(() => this.isInternalChange = false, 10);
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

    let lineStart = value.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = value.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = value.length;

    const selection = value.substring(lineStart, lineEnd);
    const before = value.substring(0, lineStart);
    const after = value.substring(lineEnd);

    let newResult = '';
    const trimmed = selection.trim();

    if (trimmed.startsWith('<!--') && trimmed.endsWith('-->')) {
      newResult = selection.replace('<!--', '').replace('-->', '');
    } else {
      newResult = `<!-- ${selection} -->`;
    }

    this.generatedXml = before + newResult + after;
    this.parseXmlToForm(this.generatedXml);
    this.refreshLineCount();

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart, lineStart + newResult.length);
      this.isInternalChange = false;
    }, 0);
  }

  syncScroll(editor: HTMLTextAreaElement, gutter: HTMLDivElement) {
    gutter.scrollTop = editor.scrollTop;
  }

  err(f: string, group?: any): string | null {
    const c = group ? group.get(f) : this.form.get(f);
    if (!c || c.valid) return null;

    if (c.errors?.['required']) return 'Required field.';
    if (c.errors?.['maxlength']) return `Max ${c.errors['maxlength'].requiredLength} chars.`;
    if (c.errors?.['pattern']) {
      if (this.showMaxLenWarning[f]) {
        const val = c.value?.toString() || '';
        const limitError = c.errors?.['maxlength']?.requiredLength;
        if (limitError && val.length >= limitError) return null;
        if (f.toLowerCase().includes('bic') && val.length >= 11) return null;
      }

      const fl = f.toLowerCase();
      if (fl.includes('bic')) return 'Valid 8 or 11-char BIC required.';
      if (fl.includes('iban')) return 'Valid MOD-97 IBAN required.';
      if (fl.includes('id')) return 'Invalid format (Alpha-numeric, max 35 chars).';
      if (fl.includes('name') || fl.includes('nm')) return "Invalid characters. Only letters, numbers, spaces and . , ( ) ' - are allowed.";
      
      return 'Invalid format.';
    }
    return 'Invalid value.';
  }
}
