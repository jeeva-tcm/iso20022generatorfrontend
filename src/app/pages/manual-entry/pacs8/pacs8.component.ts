import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { ConfigService } from '../../../services/config.service';

@Component({
  selector: 'app-pacs8',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatIconModule],
  templateUrl: './pacs8.component.html',
  styleUrl: './pacs8.component.css'
})
export class Pacs8Component implements OnInit {
  form!: FormGroup;
  generatedXml = '';
  currentTab: 'form' | 'preview' = 'form';
  isValidating = false;
  validationReport: any = null;
  expandedLayers: Record<string, boolean> = {};

  currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'SGD', 'HKD', 'INR', 'CNY', 'AED', 'SAR'];
  sttlmMethods = ['INDA', 'INGA', 'CLRG'];
  chargeBearers = ['SHAR', 'DEBT', 'CRED', 'SLEV'];

  agentPrefixes = ['instgAgt', 'instdAgt', 'dbtrAgt', 'cdtrAgt',
    'prvsInstgAgt1', 'prvsInstgAgt2', 'prvsInstgAgt3',
    'intrmyAgt1', 'intrmyAgt2', 'intrmyAgt3'];

  constructor(private fb: FormBuilder, private http: HttpClient, private config: ConfigService) { }

  ngOnInit() {
    this.buildForm(); this.generateXml();
    // Auto-sync AppHdr Fr/To BICs with GrpHdr InstgAgt/InstdAgt
    this.form.get('instgAgtBic')?.valueChanges.subscribe(v => this.form.patchValue({ fromBic: v }, { emitEvent: false }));
    this.form.get('instdAgtBic')?.valueChanges.subscribe(v => this.form.patchValue({ toBic: v }, { emitEvent: false }));
  }

  private buildForm() {
    const BIC = [Validators.required, Validators.pattern(/^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)];
    const BIC_OPT = [Validators.pattern(/^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)];
    const c: any = {
      fromBic: ['BBBBUS33XXX', BIC], toBic: ['CCCCGB2LXXX', BIC], bizMsgId: ['MSG-2026-B-001', Validators.required],
      msgId: ['MSG-2026-B-001', Validators.required], creDtTm: [this.isoNow(), Validators.required],
      nbOfTxs: ['1', [Validators.required, Validators.pattern(/^[1-9]\d*$/)]], sttlmMtd: ['INDA', Validators.required],
      instgAgtBic: ['BBBBUS33XXX', BIC], instdAgtBic: ['CCCCGB2LXXX', BIC],
      instrId: ['INSTR-001', Validators.required], endToEndId: ['E2E-001', Validators.required],
      txId: ['TX-001', Validators.required],
      uetr: ['550e8400-e29b-41d4-a716-446655440000', [Validators.required, Validators.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)]],
      amount: ['1500.00', [Validators.required, Validators.pattern(/^\d+(\.\d{1,5})?$/)]], currency: ['USD', Validators.required],
      sttlmDt: [new Date().toISOString().split('T')[0], Validators.required], svcLvlCd: [''],
      chrgBr: ['SHAR', Validators.required],
      dbtrName: ['John Doe Corp', Validators.required], dbtrIban: ['US33XXX12345678901234', Validators.required],
      dbtrAgtBic: ['BBBBUS33XXX', BIC],
      cdtrName: ['Jane Smith Ltd', Validators.required], cdtrIban: ['GB29NWBK60161331926819', Validators.required],
      cdtrAgtBic: ['CCCCGB2LXXX', BIC],
      prvsInstgAgt1Bic: ['', BIC_OPT], prvsInstgAgt2Bic: ['', BIC_OPT], prvsInstgAgt3Bic: ['', BIC_OPT],
      intrmyAgt1Bic: ['', BIC_OPT], intrmyAgt2Bic: ['', BIC_OPT], intrmyAgt3Bic: ['', BIC_OPT],
      purpCd: [''],
    };
    [...this.agentPrefixes, 'dbtr', 'cdtr'].forEach(p => {
      c[p + 'AddrType'] = 'none'; c[p + 'AdrLine1'] = ''; c[p + 'AdrLine2'] = '';
      c[p + 'Dept'] = ''; c[p + 'SubDept'] = '';
      c[p + 'StrtNm'] = ''; c[p + 'BldgNb'] = ''; c[p + 'BldgNm'] = '';
      c[p + 'Flr'] = ''; c[p + 'PstBx'] = ''; c[p + 'Room'] = '';
      c[p + 'PstCd'] = ''; c[p + 'TwnNm'] = ''; c[p + 'CtrySubDvsn'] = ''; c[p + 'Ctry'] = '';
    });
    this.form = this.fb.group(c);
  }

  isoNow(): string {
    const d = new Date(), p = (n: number) => n.toString().padStart(2, '0');
    const off = -d.getTimezoneOffset(), s = off >= 0 ? '+' : '-';
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${s}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
  }

  generateXml() {
    const v = this.form.value;
    let creDtTm = v.creDtTm || this.isoNow();
    if (creDtTm.endsWith('Z')) creDtTm = creDtTm.replace('Z', '+00:00');

    // CdtTrfTxInf — strict XSD element order
    let tx = '';
    tx += this.tag('PmtId', this.el('InstrId', v.instrId) + this.el('EndToEndId', v.endToEndId) + this.el('TxId', v.txId) + this.el('UETR', v.uetr), 3);
    if (v.svcLvlCd?.trim()) tx += this.tag('PmtTpInf', this.tag('SvcLvl', this.el('Cd', v.svcLvlCd, 4), 4), 3);
    tx += `\t\t\t<IntrBkSttlmAmt Ccy="${this.e(v.currency)}">${v.amount}</IntrBkSttlmAmt>\n`;
    tx += this.el('IntrBkSttlmDt', v.sttlmDt, 3);
    tx += this.el('ChrgBr', v.chrgBr, 3);
    // PrvsInstgAgts
    tx += this.agt('PrvsInstgAgt1', 'prvsInstgAgt1', v);
    tx += this.agt('PrvsInstgAgt2', 'prvsInstgAgt2', v);
    tx += this.agt('PrvsInstgAgt3', 'prvsInstgAgt3', v);
    // InstgAgt/InstdAgt in CdtTrfTxInf (CBPR+ requires these at txn level, NOT GrpHdr)
    tx += this.agt('InstgAgt', 'instgAgt', v);
    tx += this.agt('InstdAgt', 'instdAgt', v);
    // IntrmyAgts
    tx += this.agt('IntrmyAgt1', 'intrmyAgt1', v);
    tx += this.agt('IntrmyAgt2', 'intrmyAgt2', v);
    tx += this.agt('IntrmyAgt3', 'intrmyAgt3', v);
    // Dbtr, DbtrAcct, DbtrAgt
    tx += this.tag('Dbtr', this.el('Nm', v.dbtrName, 4) + this.addrXml(v, 'dbtr', 4), 3);
    tx += this.tag('DbtrAcct', this.tag('Id', this.el('IBAN', v.dbtrIban, 5), 4), 3);
    tx += this.agt('DbtrAgt', 'dbtrAgt', v);
    // CdtrAgt, Cdtr, CdtrAcct
    tx += this.agt('CdtrAgt', 'cdtrAgt', v);
    tx += this.tag('Cdtr', this.el('Nm', v.cdtrName, 4) + this.addrXml(v, 'cdtr', 4), 3);
    tx += this.tag('CdtrAcct', this.tag('Id', this.el('IBAN', v.cdtrIban, 5), 4), 3);
    if (v.purpCd?.trim()) tx += this.tag('Purp', this.el('Cd', v.purpCd, 4), 3);

    // Use instgAgtBic/instdAgtBic for AppHdr Fr/To to guarantee match
    const frBic = v.instgAgtBic || v.fromBic;
    const toBic = v.instdAgtBic || v.toBic;

    this.generatedXml =
      `<?xml version="1.0" encoding="UTF-8"?>
<BusMsgEnvlp xmlns="urn:swift:xsd:envelope">
\t<AppHdr xmlns="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
\t\t<Fr><FIId><FinInstnId><BICFI>${this.e(frBic)}</BICFI></FinInstnId></FIId></Fr>
\t\t<To><FIId><FinInstnId><BICFI>${this.e(toBic)}</BICFI></FinInstnId></FIId></To>
\t\t<BizMsgIdr>${this.e(v.bizMsgId)}</BizMsgIdr>
\t\t<MsgDefIdr>pacs.008.001.08</MsgDefIdr>
\t\t<BizSvc>swift.cbprplus.01</BizSvc>
\t\t<CreDt>${creDtTm}</CreDt>
\t</AppHdr>
\t<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
\t\t<FIToFICstmrCdtTrf>
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
\t\t</FIToFICstmrCdtTrf>
\t</Document>
</BusMsgEnvlp>`;
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
    const bic = v[prefix + 'Bic']; if (!bic) return '';
    return `\t\t\t<${tag}>\n\t\t\t\t<FinInstnId>\n\t\t\t\t\t<BICFI>${this.e(bic)}</BICFI>\n${this.addrXml(v, prefix, 5)}\t\t\t\t</FinInstnId>\n\t\t\t</${tag}>\n`;
  }
  addrXml(v: any, p: string, indent = 4): string {
    const type = v[p + 'AddrType']; if (!type || type === 'none') return '';
    const lines: string[] = []; const t = this.tabs(indent + 1);
    if (type === 'structured' || type === 'hybrid') {
      // PostalAddress27 XSD element order
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
    this.generateXml(); if (!this.generatedXml?.trim()) return;
    this.isValidating = true; this.validationReport = null; this.expandedLayers = {};
    this.http.post(this.config.getApiUrl('/validate'), {
      xml_content: this.generatedXml, mode: 'Full 1-3', message_type: 'pacs.008.001.08', store_in_history: true
    }).subscribe({
      next: (d: any) => {
        this.validationReport = d; this.isValidating = false;
        if (d?.details) [...new Set(d.details.map((x: any) => x.layer))].forEach(l => this.expandedLayers[this.layerName(String(l))] = true);
      },
      error: () => {
        this.isValidating = false;
        this.validationReport = {
          status: 'FAIL', errors: 1, warnings: 0, message: 'pacs.008.001.08', total_time_ms: 0,
          layer_status: { '1': { status: '❌', time: 0 } },
          details: [{ severity: 'ERROR', layer: 1, code: 'BACKEND_ERROR', path: '', message: 'Could not reach backend.', fix_suggestion: 'Check server.' }]
        };
      }
    });
  }

  reportLayers(r: any): string[] { return r?.layer_status ? Object.keys(r.layer_status).sort() : []; }
  layerName(k: string) { return ({ '1': 'Syntax & Format', '2': 'Schema Validation', '3': 'Business Rules' } as any)[k] ?? `Layer ${k}`; }
  isLayerFail(r: any, k: string) { return (r?.layer_status?.[k]?.status ?? '').includes('❌'); }
  groupedIssues(r: any) {
    if (!r?.details) return [];
    return [...new Set(r.details.map((x: any) => x.layer))].sort().map(l => {
      const issues = r.details.filter((x: any) => x.layer === l);
      return { layer: l, name: this.layerName(String(l)), issues, errors: issues.filter((x: any) => x.severity === 'ERROR').length, warnings: issues.filter((x: any) => x.severity === 'WARNING').length };
    });
  }
  toggleLayer(n: string) { this.expandedLayers[n] = !this.expandedLayers[n]; }
  isLayerExpanded(n: string) { return !!this.expandedLayers[n]; }

  downloadXml() { this.generateXml(); const b = new Blob([this.generatedXml], { type: 'application/xml' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `pacs008-${Date.now()}.xml`; a.click(); URL.revokeObjectURL(a.href); }
  copyToClipboard() { this.generateXml(); navigator.clipboard.writeText(this.generatedXml).then(() => alert('Copied!')); }
  switchToPreview() { this.generateXml(); this.currentTab = 'preview'; }
}
