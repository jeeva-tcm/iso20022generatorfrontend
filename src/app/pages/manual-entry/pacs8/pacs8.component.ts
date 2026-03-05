import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ConfigService } from '../../../services/config.service';
import { AddressValidatorService, AddressValidationResult } from '../../../services/address-validator.service';

@Component({
  selector: 'app-pacs8',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatIconModule, MatSnackBarModule],
  templateUrl: './pacs8.component.html',
  styleUrl: './pacs8.component.css'
})
export class Pacs8Component implements OnInit {
  form!: FormGroup;
  generatedXml = '';
  currentTab: 'form' | 'preview' = 'form';
  editorLineCount: number[] = [];
  isParsingXml = false;

  currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'SGD', 'HKD', 'INR', 'CNY', 'AED', 'SAR'];
  sttlmMethods = ['INDA', 'INGA', 'CLRG'];
  chargeBearers = ['SHAR', 'DEBT', 'CRED', 'SLEV'];
  // Duplicate import and component definition removed – kept earlier import and @Component

  isAddressValid = true;

  agentPrefixes = ['instgAgt', 'instdAgt', 'dbtrAgt', 'cdtrAgt',
    'prvsInstgAgt1', 'prvsInstgAgt2', 'prvsInstgAgt3',
    'intrmyAgt1', 'intrmyAgt2', 'intrmyAgt3'];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private config: ConfigService,
    private snackBar: MatSnackBar,
    private router: Router,
    private addressValidator: AddressValidatorService
  ) { }

  ngOnInit() {
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
      this.validateAddresses();
      this.generateXml();
    });
  }

  private buildForm() {
    const BIC = [Validators.required, Validators.pattern(/^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)];
    const BIC_OPT = [Validators.pattern(/^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)];
    const c: any = {
      fromBic: ['BBBBUS33XXX', BIC], toBic: ['CCCCGB2LXXX', BIC], bizMsgId: ['MSG-2026-B-001', [Validators.required, Validators.maxLength(35)]],
      msgId: ['MSG-2026-B-001', Validators.required], creDtTm: [this.isoNow(), Validators.required],
      nbOfTxs: ['1', [Validators.required, Validators.pattern(/^[1-9]\d{0,14}$/)]], sttlmMtd: ['INDA', Validators.required],
      instgAgtBic: ['BBBBUS33XXX', BIC], instdAgtBic: ['CCCCGB2LXXX', BIC],
      instrId: ['INSTR-001', [Validators.required, Validators.maxLength(35)]], endToEndId: ['E2E-001', [Validators.required, Validators.maxLength(35)]],
      txId: ['TX-001', [Validators.required, Validators.maxLength(35)]],
      uetr: ['550e8400-e29b-41d4-a716-446655440000', [Validators.required, Validators.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)]],
      amount: ['1500.00', [Validators.required, Validators.pattern(/^\d{1,18}(\.\d{1,5})?$/)]], currency: ['USD', Validators.required],
      sttlmDt: [new Date().toISOString().split('T')[0], Validators.required], svcLvlCd: [''],
      chrgBr: ['SHAR', Validators.required],
      dbtrName: ['John Doe Corp', [Validators.required, Validators.maxLength(140)]], dbtrIban: ['US33XXX12345678901234', [Validators.required, Validators.pattern(/^[A-Z]{2,2}[0-9]{2,2}[a-zA-Z0-9]{1,30}$/)]],
      dbtrAgtBic: ['BBBBUS33XXX', BIC],
      cdtrName: ['Jane Smith Ltd', [Validators.required, Validators.maxLength(140)]], cdtrIban: ['GB29NWBK60161331926819', [Validators.required, Validators.pattern(/^[A-Z]{2,2}[0-9]{2,2}[a-zA-Z0-9]{1,30}$/)]],
      cdtrAgtBic: ['CCCCGB2LXXX', BIC],
      prvsInstgAgt1Bic: ['', BIC_OPT], prvsInstgAgt2Bic: ['', BIC_OPT], prvsInstgAgt3Bic: ['', BIC_OPT],
      intrmyAgt1Bic: ['', BIC_OPT], intrmyAgt2Bic: ['', BIC_OPT], intrmyAgt3Bic: ['', BIC_OPT],
      purpCd: [''],
    };
    [...this.agentPrefixes, 'dbtr', 'cdtr'].forEach(p => {
      c[p + 'AddrType'] = 'none'; c[p + 'AdrLine1'] = ['', Validators.maxLength(70)]; c[p + 'AdrLine2'] = ['', Validators.maxLength(70)];
      c[p + 'Dept'] = ['', Validators.maxLength(70)]; c[p + 'SubDept'] = ['', Validators.maxLength(70)];
      c[p + 'StrtNm'] = ['', Validators.maxLength(140)]; c[p + 'BldgNb'] = ['', Validators.maxLength(16)]; c[p + 'BldgNm'] = ['', Validators.maxLength(140)];
      c[p + 'Flr'] = ['', Validators.maxLength(70)]; c[p + 'PstBx'] = ['', Validators.maxLength(16)]; c[p + 'Room'] = ['', Validators.maxLength(70)];
      c[p + 'PstCd'] = ['', Validators.maxLength(16)]; c[p + 'TwnNm'] = ['', Validators.maxLength(140)]; c[p + 'CtrySubDvsn'] = ['', Validators.maxLength(35)]; c[p + 'Ctry'] = ['', Validators.pattern(/^[A-Z]{2,2}$/)];
    });
    this.form = this.fb.group(c);
  }

  err(f: string): string | null {
    const c = this.form.get(f);
    if (!c || !c.touched || !c.invalid) return null;
    if (c.errors?.['required']) return 'Required field.';
    if (c.errors?.['maxlength']) return `Max ${c.errors['maxlength'].requiredLength} chars.`;
    if (c.errors?.['pattern']) {
      if (f.toLowerCase().includes('bic')) return 'Valid 8 or 11-char BIC required.';
      if (f.toLowerCase().includes('iban')) return 'Valid 34-char IBAN required.';
      if (f.toLowerCase().includes('uetr')) return 'Valid UUID required.';
      if (f.toLowerCase().includes('amount') || f.toLowerCase().includes('amt')) return 'Max 18 digits, up to 5 decimals.';
      if (f === 'nbOfTxs') return 'Must be 1-15 digits.';
      if (f === 'bizMsgId' || f === 'msgId' || f === 'instrId' || f === 'endToEndId' || f === 'txId') return 'Invalid Pattern.';
    }
    return 'Invalid value.';
  }

  isoNow(): string {
    const d = new Date(), p = (n: number) => n.toString().padStart(2, '0');
    const off = -d.getTimezoneOffset(), s = off >= 0 ? '+' : '-';
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${s}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
  }

  // Validate all address blocks before generating XML
  validateAddresses(): void {
    const prefixes = ['instgAgt', 'instdAgt', 'dbtr', 'cdtr', 'dbtrAgt', 'cdtrAgt'];
    const results: AddressValidationResult[] = [];
    prefixes.forEach(p => {
      const address = {} as any;
      // collect fields for this prefix
      Object.keys(this.form.controls).forEach(key => {
        if (key.startsWith(p)) {
          address[key] = this.form.get(key)?.value;
        }
      });
      if (Object.keys(address).length) {
        const path = `/${p}`;
        const res = this.addressValidator.validateAddress(address, path);
        results.push(res);
      }
    });
    const fail = results.find(r => r.status === 'FAIL');
    if (fail) {
      this.snackBar.open('Address validation failed: ' + fail.issues.map(i => i.message).join('; '), 'Close', { duration: 8000 });
      // Prevent XML generation by setting a flag
      this.isAddressValid = false;
    } else {
      this.isAddressValid = true;
    }
  }

  generateXml() {
    if (this.isParsingXml) return;
    const v = this.form.value;
    const creDtTm = v.creDtTm || this.isoNow();

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

    const frBic = v.fromBic;
    const toBic = v.toBic;

    this.generatedXml =
      `<?xml version="1.0" encoding="UTF-8"?>
<BusMsgEnvlp xmlns="urn:swift:xsd:envelope">
\t<AppHdr xmlns="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
\t\t<Fr><FIId><FinInstnId><BICFI>${this.e(frBic)}</BICFI></FinInstnId></FIId></Fr>
\t\t<To><FIId><FinInstnId><BICFI>${this.e(toBic)}</BICFI></FinInstnId></FIId></To>
\t\t<BizMsgIdr>${this.e(v.bizMsgId)}</BizMsgIdr>
\t\t<MsgDefIdr>pacs.008.001.08</MsgDefIdr>
\t\t<BizSvc>swift.cbprplus.02</BizSvc>
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
    this.generateXml();
    if (!this.generatedXml?.trim()) return;

    // Redirect to validate page with the XML payload
    this.router.navigate(['/validate'], {
      state: {
        autoValidateXml: this.generatedXml,
        fileName: `pacs008-${Date.now()}.xml`,
        messageType: 'pacs.008.001.08'
      }
    });
  }



  downloadXml() { this.generateXml(); const b = new Blob([this.generatedXml], { type: 'application/xml' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `pacs008-${Date.now()}.xml`; a.click(); URL.revokeObjectURL(a.href); }
  copyToClipboard() {
    this.generateXml();
    navigator.clipboard.writeText(this.generatedXml).then(() => {
      this.snackBar.open('Copied!', 'Close', { duration: 3000, horizontalPosition: 'center', verticalPosition: 'bottom' });
    });
  }
  switchToPreview() { this.generateXml(); this.currentTab = 'preview'; }

  onEditorChange(content: string, fromForm = false) {
    this.generatedXml = content;
    const lines = content.split('\n').length;
    this.editorLineCount = Array.from({ length: lines }, (_, i) => i + 1);

    if (fromForm || this.isParsingXml) return;
    this.parseXmlToForm(content);
  }

  parseXmlToForm(content: string) {
    try {
      const doc = new DOMParser().parseFromString(content, 'text/xml');
      if (doc.querySelector('parsererror')) return;

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
      setVal('chrgBr', tval('ChrgBr'));
      setVal('purpCd', tval('Purp'));

      const amtEl = doc.getElementsByTagName('IntrBkSttlmAmt')[0] || doc.getElementsByTagName('EqvtAmt')[0];
      setVal('amount', amtEl ? (amtEl.textContent || '') : '');
      setVal('currency', amtEl ? (amtEl.getAttribute('Ccy') || '') : '');

      const creDtTm = doc.getElementsByTagName('CreDtTm')[0] || doc.getElementsByTagName('CreDt')[0];
      setVal('creDtTm', creDtTm ? (creDtTm.textContent || '') : '');

      const tryTag = (parentOrEl: string | Element, child: string) => {
        const p = typeof parentOrEl === 'string' ? doc.getElementsByTagName(parentOrEl)[0] : parentOrEl;
        return p ? (p.getElementsByTagName(child)[0]?.textContent || '') : '';
      };

      setVal('svcLvlCd', tryTag('SvcLvl', 'Cd'));
      setVal('dbtrName', tryTag('Dbtr', 'Nm'));
      setVal('dbtrIban', tryTag('DbtrAcct', 'IBAN'));
      setVal('dbtrAgtBic', tryTag('DbtrAgt', 'BICFI'));
      setVal('cdtrName', tryTag('Cdtr', 'Nm'));
      setVal('cdtrIban', tryTag('CdtrAcct', 'IBAN'));
      setVal('cdtrAgtBic', tryTag('CdtrAgt', 'BICFI'));
      setVal('fromBic', tryTag('Fr', 'BICFI'));
      setVal('toBic', tryTag('To', 'BICFI'));

      const instgBic = tryTag('InstgAgt', 'BICFI');
      setVal('instgAgtBic', instgBic || patch.fromBic);
      const instdBic = tryTag('InstdAgt', 'BICFI');
      setVal('instdAgtBic', instdBic || patch.toBic);

      const mapAgt = (tag: string, prefix: string) => setVal(prefix + 'Bic', tryTag(tag, 'BICFI'));
      mapAgt('PrvsInstgAgt1', 'prvsInstgAgt1');
      mapAgt('PrvsInstgAgt2', 'prvsInstgAgt2');
      mapAgt('PrvsInstgAgt3', 'prvsInstgAgt3');
      mapAgt('IntrmyAgt1', 'intrmyAgt1');
      mapAgt('IntrmyAgt2', 'intrmyAgt2');
      mapAgt('IntrmyAgt3', 'intrmyAgt3');

      const mapAddr = (tag: string, prefix: string) => {
        ['Dept', 'SubDept', 'StrtNm', 'BldgNb', 'BldgNm', 'Flr', 'PstBx', 'Room', 'PstCd', 'TwnNm', 'CtrySubDvsn', 'Ctry', 'AdrLine1', 'AdrLine2'].forEach(f => patch[prefix + f] = '');
        patch[prefix + 'AddrType'] = 'none';

        const p = doc.getElementsByTagName(tag)[0];
        if (!p) return;
        const addr = p.getElementsByTagName('PstlAdr')[0];
        if (!addr) return;

        const aV = (t: string) => addr.getElementsByTagName(t)[0]?.textContent || '';
        if (aV('Ctry') || aV('TwnNm') || aV('StrtNm') || aV('BldgNb')) {
          patch[prefix + 'AddrType'] = 'structured';
          ['Dept', 'SubDept', 'StrtNm', 'BldgNb', 'BldgNm', 'Flr', 'PstBx', 'Room', 'PstCd', 'TwnNm', 'CtrySubDvsn', 'Ctry'].forEach(f => patch[prefix + f] = aV(f));
        } else if (addr.getElementsByTagName('AdrLine').length > 0) {
          patch[prefix + 'AddrType'] = 'unstructured';
          const lines = addr.getElementsByTagName('AdrLine');
          patch[prefix + 'AdrLine1'] = lines[0]?.textContent || '';
          patch[prefix + 'AdrLine2'] = lines[1]?.textContent || '';
        }
      };

      this.agentPrefixes.forEach(p => mapAddr(p.charAt(0).toUpperCase() + p.slice(1), p));
      mapAddr('Dbtr', 'dbtr');
      mapAddr('Cdtr', 'cdtr');

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
}
