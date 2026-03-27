import { Component, OnInit, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfigService } from '../../../services/config.service';
import { FormattingService } from '../../../services/formatting.service';

@Component({
  selector: 'app-pain001',
  templateUrl: './pain001.component.html',
  styleUrls: ['./pain001.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatIconModule, MatSnackBarModule, MatTooltipModule]
})
export class Pain001Component implements OnInit {
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
  currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'HKD', 'NZD'];
  chargeBearers = ['CRED', 'SHAR', 'SLEV'];
  priorities = ['HIGH', 'NORM'];
  paymentMethods = ['TRF'];

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
    private snackBar: MatSnackBar,
    private formatting: FormattingService
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
      // BAH (head.001.001.02)
      fromBic: ['BANCGB2LXXX', [Validators.required, Validators.pattern(/^[A-Z0-9]{8,11}$/)]],
      toBic: ['BANCGB2LXXX', [Validators.required, Validators.pattern(/^[A-Z0-9]{8,11}$/)]],
      bizMsgId: ['BMS-' + Date.now(), [Validators.required, Validators.maxLength(35)]],
      creDt: [this.isoNowDate(), Validators.required],
      
      // Group Header (pain.001.001.09)
      msgId: ['PAIN001-MSG-' + Date.now(), [Validators.required, Validators.maxLength(35)]],
      creDtTm: [this.isoNow(), Validators.required],
      nbOfTxs: ['1', [Validators.required]],
      ctrlSum: ['0.00', [Validators.pattern(/^\d{1,18}(\.\d{1,5})?$/)]],
      initgPtyName: ['Initiating Party Name', [Validators.required, Validators.maxLength(140)]],
      initgPtyId: ['', [Validators.maxLength(35)]],

      // Payment Information
      pmtInfId: ['PMT-INF-' + Date.now(), [Validators.required, Validators.maxLength(35)]],
      pmtMtd: ['TRF', Validators.required],
      btchBookg: [false],
      pmtNbOfTxs: ['1', [Validators.required]],
      pmtCtrlSum: ['0.00', [Validators.pattern(/^\d{1,18}(\.\d{1,5})?$/)]],
      instrPrty: ['NORM', Validators.required],
      ctgyPurp: ['', [Validators.maxLength(4)]],
      reqdExctnDt: [this.isoNowDate(), Validators.required],
      dbtrName: ['Debtor Name', [Validators.required, Validators.maxLength(140)]],
      dbtrIban: ['GB29NWBK60161331926819', [Validators.required, Validators.maxLength(34)]],
      dbtrAgtBic: ['BANCGB2LXXX', [Validators.required, Validators.maxLength(11)]],
      chrgBr: ['SHAR', Validators.required],
      ultmtDbtrName: ['', [Validators.maxLength(140)]],

      // Transactions
      transactions: this.fb.array([this.createTransactionGroup()])
    });
  }

  private createTransactionGroup(): FormGroup {
    return this.fb.group({
      instrId: ['INSTR-' + Date.now(), [Validators.required, Validators.maxLength(35)]],
      endToEndId: ['E2E-' + Date.now(), [Validators.required, Validators.maxLength(35)]],
      uetr: [crypto.randomUUID ? crypto.randomUUID() : '550e8400-e29b-41d4-a716-446655440000', [Validators.required, Validators.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)]],
      amount: ['100.00', [Validators.required, Validators.pattern(/^\d{1,18}(\.\d{1,5})?$/)]],
      currency: ['GBP', Validators.required],
      cdtrAgtBic: ['BANCGB2LXXX', [Validators.required, Validators.maxLength(11)]],
      cdtrName: ['Creditor Name', [Validators.required, Validators.maxLength(140)]],
      cdtrIban: ['GB29NWBK60161331926819', [Validators.required, Validators.maxLength(34)]],
      rmtInf: ['Invoice Ref 12345', [Validators.maxLength(140)]]
    });
  }

  get transactions(): FormArray {
    return this.form.get('transactions') as FormArray;
  }

  addTransaction() {
    this.transactions.push(this.createTransactionGroup());
    this.updateTotals();
  }

  removeTransaction(index: number) {
    if (this.transactions.length > 1) {
      this.transactions.removeAt(index);
      this.updateTotals();
    }
  }

  private updateTotals() {
    const count = this.transactions.length;
    let sum = 0;
    this.transactions.controls.forEach(c => sum += (parseFloat(c.get('amount')?.value) || 0));
    
    this.form.patchValue({
      nbOfTxs: count.toString(),
      pmtNbOfTxs: count.toString(),
      ctrlSum: sum.toFixed(2),
      pmtCtrlSum: sum.toFixed(2)
    }, { emitEvent: false });
  }

  isoNow(): string { return new Date().toISOString().split('.')[0] + '+00:00'; }
  isoNowDate(): string { return new Date().toISOString().split('T')[0]; }

  generateXml() {
    if (this.isParsingXml) return;
    const v = this.form.value;
    
    // Header (BAH)
    const fr = this.tag('Fr', this.tag('FIId', this.tag('FinInstnId', this.el('BICFI', v.fromBic, 5), 4), 3), 2);
    const to = this.tag('To', this.tag('FIId', this.tag('FinInstnId', this.el('BICFI', v.toBic, 5), 4), 3), 2);
    const bah = fr + to + this.el('BizMsgIdr', v.bizMsgId, 2) + this.el('MsgDefIdr', 'pain.001.001.09', 2) + this.el('BizSvc', 'swift.cbprplus.03', 2) + this.el('CreDt', v.creDtTm, 2);

    // Group Header
    const initgPtyId = v.initgPtyId ? this.tag('Id', this.tag('OrgId', this.tag('Othr', this.el('Id', v.initgPtyId, 7), 6), 5), 4) : '';
    const grpHdr = this.tag('GrpHdr',
      this.el('MsgId', v.msgId, 4) +
      this.el('CreDtTm', v.creDtTm, 4) +
      this.el('NbOfTxs', v.nbOfTxs, 4) + // Restored NbOfTxs as per new validator feedback
      // CtrlSum omitted as per previous feedback (expects InitgPty after NbOfTxs)
      this.tag('InitgPty', this.el('Nm', v.initgPtyName, 5) + initgPtyId, 4),
      3
    );

    // Payment Information
    let txsXml = '';
    v.transactions.forEach((tx: any) => {
      const amt = this.formatting.formatAmount(tx.amount || 0, tx.currency);
      
      const pmtId = this.tag('PmtId', 
        this.el('InstrId', tx.instrId, 6) + 
        this.el('EndToEndId', tx.endToEndId, 6) +
        this.el('UETR', tx.uetr, 6), 
        5
      );
      const amtTag = this.tabs(5) + `<Amt>\n${this.tabs(6)}<InstdAmt Ccy="${this.e(tx.currency)}">${amt}</InstdAmt>\n${this.tabs(5)}</Amt>\n`;
      const cdtrAgt = tx.cdtrAgtBic ? this.tag('CdtrAgt', this.tag('FinInstnId', this.el('BICFI', tx.cdtrAgtBic, 7), 6), 5) : '';
      const cdtr = this.tag('Cdtr', this.el('Nm', tx.cdtrName, 6), 5);
      const cdtrAcct = tx.cdtrIban ? this.tag('CdtrAcct', this.tag('Id', this.el('IBAN', tx.cdtrIban, 7), 6), 5) : '';
      const rmtInf = tx.rmtInf ? this.tag('RmtInf', this.el('Ustrd', tx.rmtInf, 6), 5) : '';

      txsXml += this.tag('CdtTrfTxInf', pmtId + amtTag + cdtrAgt + cdtr + cdtrAcct + rmtInf, 4);
    });

    const pmtTpInf = this.tag('PmtTpInf', 
      this.el('InstrPrty', v.instrPrty, 5) + 
      (v.ctgyPurp ? this.tag('CtgyPurp', this.el('Cd', v.ctgyPurp, 6), 5) : ''),
      4
    );
    const dbtrAcct = v.dbtrIban ? this.tag('DbtrAcct', this.tag('Id', this.el('IBAN', v.dbtrIban, 6), 5), 4) : '';
    const dbtrAgt = v.dbtrAgtBic ? this.tag('DbtrAgt', this.tag('FinInstnId', this.el('BICFI', v.dbtrAgtBic, 6), 5), 4) : '';
    const ultmtDbtr = v.ultmtDbtrName ? this.tag('UltmtDbtr', this.el('Nm', v.ultmtDbtrName, 5), 4) : '';

    const pmtInf = this.tag('PmtInf',
      this.el('PmtInfId', v.pmtInfId, 4) +
      this.el('PmtMtd', v.pmtMtd, 4) +
      // BtchBookg, NbOfTxs, and CtrlSum omitted from PmtInf to satisfy current validator expectations
      pmtTpInf +
      this.tag('ReqdExctnDt', this.el('Dt', v.reqdExctnDt, 5), 4) +
      this.tag('Dbtr', this.el('Nm', v.dbtrName, 5), 4) +
      dbtrAcct +
      dbtrAgt +
      this.el('ChrgBr', v.chrgBr, 4) +
      ultmtDbtr +
      txsXml,
      3
    );

    this.generatedXml = `<?xml version="1.0" encoding="UTF-8"?>
<BusMsgEnvlp xmlns="urn:swift:xsd:envelope">
\t<AppHdr xmlns="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
${bah}\t</AppHdr>
\t<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">
\t\t<CstmrCdtTrfInitn>
${grpHdr}${pmtInf}\t\t</CstmrCdtTrfInitn>
\t</Document>
</BusMsgEnvlp>`;

    this.onEditorChange(this.generatedXml, true);
  }

  // XML Helpers
  private e(v: any): string { 
    if (v === null || v === undefined || v === '') return '';
    return v.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
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
      const root = findTag('CstmrCdtTrfInitn');
      if (root) {
        const grpHdr = findTag('GrpHdr', root);
        if (grpHdr) {
          patch.msgId = tval('MsgId', grpHdr);
          patch.creDtTm = tval('CreDtTm', grpHdr);
          patch.nbOfTxs = tval('NbOfTxs', grpHdr);
          patch.ctrlSum = tval('CtrlSum', grpHdr);
          const initgPty = findTag('InitgPty', grpHdr);
          if (initgPty) {
            patch.initgPtyName = tval('Nm', initgPty);
            const othr = findTag('Othr', initgPty);
            if (othr) patch.initgPtyId = tval('Id', othr);
          }
        }

        const pmtInf = findTag('PmtInf', root);
        if (pmtInf) {
          patch.pmtInfId = tval('PmtInfId', pmtInf);
          patch.pmtMtd = tval('PmtMtd', pmtInf);
          patch.btchBookg = tval('BtchBookg', pmtInf).toLowerCase() === 'true';
          patch.pmtNbOfTxs = tval('NbOfTxs', pmtInf);
          patch.pmtCtrlSum = tval('CtrlSum', pmtInf);
          
          const pmtTpInf = findTag('PmtTpInf', pmtInf);
          if (pmtTpInf) {
            patch.instrPrty = tval('InstrPrty', pmtTpInf);
            const ctgyPurp = findTag('CtgyPurp', pmtTpInf);
            if (ctgyPurp) patch.ctgyPurp = tval('Cd', ctgyPurp);
          }

          const reqdDt = findTag('ReqdExctnDt', pmtInf);
          if (reqdDt) {
            const dtRaw = tval('Dt', reqdDt);
            patch.reqdExctnDt = dtRaw.includes('T') ? dtRaw.split('T')[0] : dtRaw;
          }
          
          const dbtr = findTag('Dbtr', pmtInf);
          if (dbtr) patch.dbtrName = tval('Nm', dbtr);
          
          const dbtrAcct = findTag('DbtrAcct', pmtInf);
          if (dbtrAcct) patch.dbtrIban = tval('IBAN', dbtrAcct);
          
          const dbtrAgt = findTag('DbtrAgt', pmtInf);
          if (dbtrAgt) patch.dbtrAgtBic = tval('BICFI', dbtrAgt);
          
          patch.chrgBr = tval('ChrgBr', pmtInf);
          
          const ultmtDbtr = findTag('UltmtDbtr', pmtInf);
          if (ultmtDbtr) patch.ultmtDbtrName = tval('Nm', ultmtDbtr);

          // Transactions
          const txsArr = pmtInf.getElementsByTagName('*');
          const txs: Element[] = [];
          for (let i = 0; i < txsArr.length; i++) {
            if (txsArr[i].localName?.toLowerCase() === 'cdttrftxinf') txs.push(txsArr[i]);
          }

          if (txs.length > 0) {
            this.transactions.clear();
            for (let i = 0; i < txs.length; i++) {
              const tx = txs[i];
              const txGroup = this.createTransactionGroup();
              const txPatch: any = {};

              const pmtId = findTag('PmtId', tx);
              if (pmtId) {
                txPatch.instrId = tval('InstrId', pmtId);
                txPatch.endToEndId = tval('EndToEndId', pmtId);
                txPatch.uetr = tval('UETR', pmtId);
              }

              const amt = findTag('Amt', tx) || findTag('InstdAmt', tx);
              if (amt) {
                const instdAmt = amt.localName?.toLowerCase() === 'instdamt' ? amt : findTag('InstdAmt', amt);
                if (instdAmt) {
                  txPatch.amount = instdAmt.textContent;
                  txPatch.currency = instdAmt.getAttribute('Ccy') || '';
                }
              }

              const cdtrAgt = findTag('CdtrAgt', tx);
              if (cdtrAgt) txPatch.cdtrAgtBic = tval('BICFI', cdtrAgt);
              
              const cdtr = findTag('Cdtr', tx);
              if (cdtr) txPatch.cdtrName = tval('Nm', cdtr);

              const cdtrAcct = findTag('CdtrAcct', tx);
              if (cdtrAcct) txPatch.cdtrIban = tval('IBAN', cdtrAcct);

              const rmtInf = findTag('RmtInf', tx);
              if (rmtInf) txPatch.rmtInf = tval('Ustrd', rmtInf);

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
  downloadXml() { const b = new Blob([this.generatedXml], { type: 'application/xml' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `pain001-${Date.now()}.xml`; a.click(); }

  validateMessage() {
    this.showValidationModal = true;
    this.validationStatus = 'validating';
    this.validationReport = null;
    this.validationExpandedIssue = null;

    this.http.post(this.config.getApiUrl('/validate'), {
      xml_content: this.generatedXml,
      message_type: 'pain.001.001.09', // Kept as pain.001.001.09 for this component
      mode: 'Full 1-3'
    }).subscribe({
      next: (res: any) => { 
        this.validationReport = res; 
        this.validationStatus = 'done'; 
      },
      error: (err) => { 
        this.validationReport = {
          status: 'FAIL', errors: 1, warnings: 0,
          message: 'pain.001.001.09', // Kept as pain.001.001.09 for this component
          total_time_ms: 0,
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
        if (f === 'uetr' && val.length >= 36) return null;
      }

      const fl = f.toLowerCase();
      if (fl.includes('bic')) return 'Valid 8 or 11-char BIC required.';
      if (fl.includes('iban')) return 'Valid MOD-97 IBAN required.';
      if (fl.includes('uetr')) return 'Invalid UETR format (UUID v4).';
      if (fl.includes('amount') || fl.includes('amt')) return 'Numbers only, up to 5 decimals.';
      if (fl.includes('lei')) return 'Must be 20-char LEI.';
      if (fl.includes('id') && !fl.includes('uetr')) return 'Invalid format (Alpha-numeric, max 35 chars).';
      if (fl.includes('name') || fl.includes('nm')) return "Invalid characters. Only letters, numbers, spaces and . , ( ) ' - are allowed.";
      
      return 'Invalid format.';
    }
    return 'Invalid value.';
  }

  syncScroll(editor: HTMLTextAreaElement, gutter: HTMLDivElement) {
    gutter.scrollTop = editor.scrollTop;
  }
}
