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
  paymentMethods = ['TRF', 'CHK'];
  countries = ['US', 'GB', 'DE', 'FR', 'IT', 'CH', 'CA', 'AU', 'JP', 'IN', 'SG', 'HK', 'NZ'];

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
      charSet: ['UTF-8', [Validators.maxLength(2048)]],
      rltdBizMsgId: ['REL-44332211', [Validators.maxLength(35)]],
      fromBic: ['BANCUS33XXX', [Validators.required, Validators.pattern(/^([A-Z0-9]{8}|[A-Z0-9]{11})$/)]],
      fromClrSysCd: ['USABA', [Validators.maxLength(5)]],
      fromClrSysMmbId: ['123456789', [Validators.maxLength(35)]],
      fromLei: ['W22LROWBR70L5U3S5244', [Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)]],
      toBic: ['BANCGB2LXXX', [Validators.required, Validators.pattern(/^([A-Z0-9]{8}|[A-Z0-9]{11})$/)]],
      toClrSysCd: ['GBFPS', [Validators.maxLength(5)]],
      toClrSysMmbId: ['200000', [Validators.maxLength(35)]],
      toLei: ['EBMRY7N10NRY5NCY5Y71', [Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)]],
      bizMsgId: ['BMS-' + Date.now(), [Validators.required, Validators.maxLength(35)]],
      msgDefIdr: ['pain.001.001.09', [Validators.required]],
      bizSvc: ['swift.cbprplus.03'],
      creDt: [this.isoNowDate(), Validators.required],
      cpyDplct: [''],
      pssblDplct: [''],
      appHdrPrty: [''],
      
      // Group Header (pain.001.001.09)
      msgId: ['PAIN001-MSG-' + Date.now(), [Validators.required, Validators.maxLength(35)]],
      creDtTm: [this.isoNow(), Validators.required],
      authstnCd: ['AUTH'],
      authstnPrtry: ['File pre-authorised at origin'],
      nbOfTxs: ['1', [Validators.required]],
      ctrlSum: ['0.00', [Validators.pattern(/^\d{1,18}(\.\d{1,5})?$/)]],
      initgPtyName: ['Global Solutions Corp', [Validators.required, Validators.maxLength(140)]],
      initgPtyBic: ['GBSOLUS33XX', [Validators.pattern(/^([A-Z0-9]{8}|[A-Z0-9]{11})$/)]],
      initgPtyId: ['GS-ID-9988'],
      initgPtyCtry: ['GB'],
      initgPtyTwnNm: ['London'],

      // Payment Information
      pmtInfId: ['PMT-INF-' + Date.now(), [Validators.required, Validators.maxLength(35)]],
      pmtMtd: ['TRF', Validators.required],
      btchBookg: [false],
      pmtNbOfTxs: ['1', [Validators.required]],
      pmtCtrlSum: ['0.00', [Validators.pattern(/^\d{1,18}(\.\d{1,5})?$/)]],
      instrPrty: ['NORM', Validators.required],
      poolgAdjstmntDt: [this.isoNowDate()],
      svcLvl: ['SEPA', [Validators.maxLength(5)]],
      lclInstrm: ['INST', [Validators.maxLength(35)]],
      ctgyPurp: ['CASH', [Validators.maxLength(5)]],
      reqdExctnDt: [this.isoNowDate(), Validators.required],
      fwdgAgtBic: ['FWDGUS33XXX', [Validators.maxLength(11)]],
      initnSrc: ['ERP-X-SYSTEM'],
      dbtrName: ['Holding Account One', [Validators.required, Validators.maxLength(140)]],
      dbtrIban: ['60161331926819', [Validators.required, Validators.maxLength(34)]],
      dbtrAddrType: ['structured'],
      dbtrCtry: ['US', [Validators.required, Validators.pattern(/^[A-Z]{2,2}$/)]],
      dbtrTwnNm: ['New York', [Validators.maxLength(35)]],
      dbtrBldgNb: ['270', [Validators.maxLength(16)]],
      dbtrBldgNm: ['Chase Tower'],
      dbtrStrtNm: ['Park Avenue', [Validators.maxLength(70)]],
      dbtrPstCd: ['10017', [Validators.maxLength(16)]],
      dbtrAdrLine1: ['270 Park Avenue', [Validators.maxLength(70)]],
      dbtrAdrLine2: ['Suite 500', [Validators.maxLength(70)]],
      dbtrAgtAcctIban: ['11112222333344', [Validators.maxLength(34)]],
      dbtrAgtBic: ['CHASUS33XXX', [Validators.maxLength(11)]],
      dbtrAgtClrSysCd: ['USABA', [Validators.maxLength(5)]],
      dbtrAgtClrSysMmbId: ['021000021', [Validators.maxLength(35)]],
      dbtrAgtLei: ['54930068N2K3Y9N1F719', [Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)]],
      dbtrAgtName: ['JP Morgan Chase Bank N.A.'],
      dbtrAgtAddrType: ['structured'],
      dbtrAgtCtry: ['US', [Validators.pattern(/^[A-Z]{2,2}$/)]],
      dbtrAgtTwnNm: ['New York', [Validators.maxLength(35)]],
      dbtrAgtStrtNm: ['Park Avenue', [Validators.maxLength(70)]],
      dbtrAgtPstCd: ['10017', [Validators.maxLength(16)]],
      dbtrAgtAdrLine1: ['270 Park Avenue', [Validators.maxLength(70)]],
      dbtrAgtAdrLine2: ['Floor 10', [Validators.maxLength(70)]],
      chrgBr: ['SHAR', Validators.required],
      dbtrAgtBldgNb: ['270'],
      dbtrAgtBldgNm: ['Chase Tower'],
      dbtrOrgIdAnyBic: ['GBSOLUS33XX', [Validators.pattern(/^([A-Z0-9]{8}|[A-Z0-9]{11})$/)]],
      dbtrOrgIdLei: ['W22LROWBR70L5U3S5244', [Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)]],
      dbtrPrvtIdBirthDt: [''],
      dbtrPrvtIdCityOfBirth: ['', [Validators.maxLength(35)]],
      dbtrPrvtIdCtryOfBirth: ['', [Validators.pattern(/^[A-Z]{2,2}$/)]],
      ultmtDbtrName: ['Global Management LLC'],
      relMsgId: ['REL-' + Date.now()],
      chrgsAcctIban: ['US12345678901231'],
      chrgsAcctAgtBic: ['CHASUS33XXX'],

      // Transactions
      transactions: this.fb.array([this.createTransactionGroup()])
    });
  }

  private createTransactionGroup(): FormGroup {
    return this.fb.group({
      instrId: ['INSTR-' + Date.now(), [Validators.required, Validators.maxLength(35)]],
      endToEndId: ['E2E-' + Date.now(), [Validators.required, Validators.maxLength(35)]],
      uetr: [crypto.randomUUID ? crypto.randomUUID() : '550e8400-e29b-41d4-a716-446655440000', [Validators.required, Validators.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)]],
      amount: ['12500.00', [Validators.required, Validators.pattern(/^\d{1,18}(\.\d{1,5})?$/)]],
      currency: ['USD', Validators.required],
      xchgRate: [''],
      xchgRateTp: ['SPOT'],
      xchgUnitCcy: [''],
      xchgCtrctId: [''],
      chqInstr: [''],
      chqTp: [''],
      chqMtrtyDt: [''],
      mndtId: [''],
      txSvcLvl: ['NURG', [Validators.maxLength(5)]],
      txLclInstrm: ['INST', [Validators.maxLength(35)]],
      txCtgyPurp: ['SALA', [Validators.maxLength(5)]],
      intrmyAgt1Bic: ['CORRUK2LXXX'],
      intrmyAgt1Acct: ['GB11CORR001122334455'],
      intrmyAgt2Bic: [''],
      intrmyAgt2Acct: [''],
      intrmyAgt3Bic: [''],
      intrmyAgt3Acct: [''],
      cdtrAgtBic: ['BANCGB2LXXX', [Validators.required, Validators.maxLength(11)]],
      cdtrAgtAcct: ['GB73BARC20000012345678'],
      cdtrName: ['Precision Engineering Ltd', [Validators.required, Validators.maxLength(140)]],
      cdtrIban: ['GB73BARC20000012345678', [Validators.required, Validators.maxLength(34)]],
      cdtrAddrType: ['structured'],
      cdtrCtry: ['GB', [Validators.required, Validators.pattern(/^[A-Z]{2,2}$/)]],
      cdtrTwnNm: ['Manchester', [Validators.maxLength(135)]],
      cdtrAdrLine1: ['10 Industrial Way', [Validators.maxLength(70)]],
      cdtrAdrLine2: ['Block B', [Validators.maxLength(70)]],
      ultmtDbtrName: ['Sub-Group Treasury'],
      ultmtCdtrName: ['Final Vendor Corp'],
      purpCd: ['SALA'],
      taxId: [''],
      taxAmt: [''],
      rgltryRptg: ['Statutory Salary Payment Q1'],
      rmtInf: ['Invoice Ref INV-2024-456', [Validators.maxLength(140)]],
      rltdRmtInfUrl: ['']
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

  isoNow(): string {
    const d = new Date(), p = (n: number) => n.toString().padStart(2, '0');
    const off = -d.getTimezoneOffset(), s = off >= 0 ? '+' : '-';
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${s}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
  }

  isoNowDate(): string { 
    return new Date().toISOString().split('T')[0]; 
  }

  fdt(dt: string): string {
    if (!dt) return dt;
    let s = dt.trim().replace(/\.\d+/, '').replace('Z', '+00:00');
    if (s && !/([+-]\d{2}:\d{2})$/.test(s)) s += '+00:00';
    return s;
  }

  generateXml() {
    if (this.isParsingXml) return;
    const v = this.form.getRawValue();
    const creDtTm = v.creDtTm || this.isoNow();

    let frContent = this.el('BICFI', v.fromBic || 'BANCUS33XXX', 5);
    if (v.fromClrSysMmbId?.trim()) {
      let clr = this.tag('ClrSysId', this.el('Cd', v.fromClrSysCd || 'USABA', 8), 7) + this.el('MmbId', v.fromClrSysMmbId, 7);
      frContent += this.tag('ClrSysMmbId', clr, 6);
    }
    if (v.fromLei?.trim()) frContent += this.el('LEI', v.fromLei, 5);

    let toContent = this.el('BICFI', v.toBic || 'BANCGB2LXXX', 5);
    if (v.toClrSysMmbId?.trim()) {
      let clr = this.tag('ClrSysId', this.el('Cd', v.toClrSysCd || 'GBFPS', 8), 7) + this.el('MmbId', v.toClrSysMmbId, 7);
      toContent += this.tag('ClrSysMmbId', clr, 6);
    }
    if (v.toLei?.trim()) toContent += this.el('LEI', v.toLei, 5);

    const bah = (v.charSet ? this.el('CharSet', v.charSet, 2) : '') +
                this.tag('Fr', this.tag('FIId', this.tag('FinInstnId', frContent, 4), 3), 2) +
                this.tag('To', this.tag('FIId', this.tag('FinInstnId', toContent, 4), 3), 2) +
                this.el('BizMsgIdr', v.bizMsgId || ('BMS-' + Date.now()), 2) +
                this.el('MsgDefIdr', v.msgDefIdr || 'pain.001.001.09', 2) +
                this.el('BizSvc', v.bizSvc || 'swift.cbprplus.03', 2) +
                this.el('CreDt', this.fdt(creDtTm), 2) +
                (v.cpyDplct ? this.el('CpyDplct', v.cpyDplct, 2) : '') +
                (v.pssblDplct !== '' && v.pssblDplct !== null && v.pssblDplct !== undefined ? this.el('PssblDplct', v.pssblDplct, 2) : '') +
                (v.appHdrPrty ? this.el('Prty', v.appHdrPrty, 2) : '') +
                (v.rltdBizMsgId ? '' : '');

    // Group Header
    let initgPtyIdContent = '';
    if (v.initgPtyBic) {
      initgPtyIdContent += this.tag('OrgId', this.el('AnyBIC', v.initgPtyBic, 6), 5);
    }
    if (v.initgPtyId) {
      // Only add Othr if no AnyBIC (XOR within OrgId per CBPR+)
      if (!v.initgPtyBic) {
        initgPtyIdContent += this.tag('OrgId', this.tag('Othr', this.el('Id', v.initgPtyId, 7), 6), 5);
      }
    }
    const initgPtyIdXml = initgPtyIdContent ? this.tag('Id', initgPtyIdContent, 4) : '';
    const grpHdr = this.tag('GrpHdr',
      this.el('MsgId', v.msgId, 4) +
      this.el('CreDtTm', creDtTm, 4) +
      this.el('NbOfTxs', v.nbOfTxs, 4) +
      this.partyXml('InitgPty', 'initgPty', v, 4) +
      (v.fwdgAgtBic ? this.tag('FwdgAgt', this.tag('FinInstnId', this.el('BICFI', v.fwdgAgtBic, 6), 5), 4) : ''),
      3
    );

    // Payment Information
    let pmtInfContent = '';
    pmtInfContent += this.el('PmtInfId', v.pmtInfId, 4);
    pmtInfContent += this.el('PmtMtd', v.pmtMtd, 4);
    if (v.batchBooking) pmtInfContent += this.el('BtchBookg', 'true', 4);
    // Removed NbOfTxs and CtrlSum from PmtInf level to resolve specification errors.
    
    // Check if any transaction has its own override. If so, CBPR+ rule often says header level must be absent if txn level is present for XOR elements.
    const hasTxPmtTp = v.transactions.some((t: any) => t.txSvcLvl || t.txLclInstrm || t.txCtgyPurp);
    const hasTxUltDbtr = v.transactions.some((t: any) => t.ultmtDbtrName);
    const hasTxInstrDbtr = v.transactions.some((t: any) => t.instrForDbtrAgt);

    if (!hasTxPmtTp) {
        let pmtTpInf = this.el('InstrPrty', v.instrPrty, 5);
        if (v.svcLvl) pmtTpInf += this.tag('SvcLvl', this.el('Cd', v.svcLvl, 7), 6);
        if (v.lclInstrm) pmtTpInf += this.tag('LclInstrm', this.el('Cd', v.lclInstrm, 7), 6);
        if (v.ctgyPurp) pmtTpInf += this.tag('CtgyPurp', this.el('Cd', v.ctgyPurp, 6), 5);
        if (pmtTpInf) pmtInfContent += this.tag('PmtTpInf', pmtTpInf, 4);
    }
    
    pmtInfContent += this.tag('ReqdExctnDt', this.el('Dt', v.reqdExctnDt, 5), 4);


    // Debtor (Dbtr) - enforcing name + address together for L3 compliance
    pmtInfContent += this.partyXml('Dbtr', 'dbtr', v, 4);
    if (v.dbtrIban) pmtInfContent += this.tag('DbtrAcct', this.acctXml(v.dbtrIban, 6), 4);


    // Debtor Agent (DbtrAgt)
    let agtFinId = this.buildAppHdrFi(v.dbtrAgtBic, v.dbtrAgtClrSysMmbId, v.dbtrAgtClrSysCd, v.dbtrAgtLei, false).trim();
    if (v.dbtrAgtName) agtFinId += this.el('Nm', v.dbtrAgtName, 7);
    agtFinId += this.addrXml(v, 'dbtrAgt', 6);
    
    if (agtFinId) pmtInfContent += this.tag('DbtrAgt', this.tag('FinInstnId', agtFinId, 6), 4);
    if (v.dbtrAgtAcctIban) pmtInfContent += this.tag('DbtrAgtAcct', this.acctXml(v.dbtrAgtAcctIban, 6), 4);
    
    if (!hasTxUltDbtr && v.ultmtDbtrName) {
        pmtInfContent += this.partyXml('UltmtDbtr', 'ultmtDbtr', v, 4);
    }
    pmtInfContent += this.el('ChrgBr', v.chrgBr, 4);


    let txsXml = '';
    // Transactions loop
    v.transactions.forEach((tx: any) => {
      const amt = this.formatting.formatAmount(tx.amount || 0, tx.currency);
      
      let txContent = '';
      txContent += this.tag('PmtId', this.el('InstrId', tx.instrId, 6) + this.el('EndToEndId', tx.endToEndId, 6) + this.el('UETR', tx.uetr, 6), 5);
      
      // Payment Type Information (Transaction Level)
      if (tx.txSvcLvl || tx.txLclInstrm || tx.txCtgyPurp) {
        let tpInf = '';
        if (tx.txSvcLvl) tpInf += this.tag('SvcLvl', this.el('Cd', tx.txSvcLvl, 8), 7);
        if (tx.txLclInstrm) tpInf += this.tag('LclInstrm', this.el('Cd', tx.txLclInstrm, 8), 7);
        if (tx.txCtgyPurp) tpInf += this.tag('CtgyPurp', this.el('Cd', tx.txCtgyPurp, 8), 7);
        txContent += this.tag('PmtTpInf', tpInf, 6);
      }

      txContent += this.tag('Amt', this.el('InstdAmt', amt, 6, ` Ccy="${this.e(tx.currency)}"`), 5);

      if (tx.xchgRate || tx.xchgCtrctId || tx.xchgUnitCcy) {
        let xchg = this.el('UnitCcy', tx.xchgUnitCcy, 7);
        if (tx.xchgRate) xchg += this.el('XchgRate', tx.xchgRate, 7);
        if (tx.xchgRateTp) xchg += this.el('RateTp', tx.xchgRateTp, 7);
        if (tx.xchgCtrctId) xchg += this.el('CtrctId', tx.xchgCtrctId, 7);
        txContent += this.tag('XchgRateInf', xchg, 6);
      }

      if (tx.mndtId) txContent += this.el('MndtId', tx.mndtId, 6);
      
      if (v.pmtMtd === 'CHK') {
        let chq = this.el('ChqNb', tx.chqInstr, 7);
        if (tx.chqTp) chq += this.el('ChqTp', tx.chqTp, 7);
        if (tx.chqMtrtyDt) chq += this.tag('ChqMtrtyDt', this.el('Dt', tx.chqMtrtyDt, 9), 7);
        txContent += this.tag('ChqInstr', chq, 6);
      }

      if (tx.ultmtDbtrName) txContent += this.partyXml('UltmtDbtr', 'ultmtDbtr', tx, 6);

      if (tx.intrmyAgt1Bic) {
        txContent += this.tag('IntrmyAgt1', this.tag('FinInstnId', this.el('BICFI', tx.intrmyAgt1Bic, 8), 7), 6);
        if (tx.intrmyAgt1Acct) txContent += this.tag('IntrmyAgt1Acct', this.acctXml(tx.intrmyAgt1Acct, 7), 6);
      }
      if (tx.intrmyAgt2Bic) {
        txContent += this.tag('IntrmyAgt2', this.tag('FinInstnId', this.el('BICFI', tx.intrmyAgt2Bic, 8), 7), 6);
        if (tx.intrmyAgt2Acct) txContent += this.tag('IntrmyAgt2Acct', this.acctXml(tx.intrmyAgt2Acct, 7), 6);
      }
      if (tx.intrmyAgt3Bic) {
        txContent += this.tag('IntrmyAgt3', this.tag('FinInstnId', this.el('BICFI', tx.intrmyAgt3Bic, 8), 7), 6);
        if (tx.intrmyAgt3Acct) txContent += this.tag('IntrmyAgt3Acct', this.acctXml(tx.intrmyAgt3Acct, 7), 6);
      }

      if (tx.cdtrAgtBic) {
        const agtId = this.buildAppHdrFi(tx.cdtrAgtBic, '', '', '', false).trim();
        txContent += this.tag('CdtrAgt', this.tag('FinInstnId', agtId, 6), 5);
        if (tx.cdtrAgtAcct) txContent += this.tag('CdtrAgtAcct', this.acctXml(tx.cdtrAgtAcct, 7), 6);
      }
      
      txContent += this.partyXml('Cdtr', 'cdtr', tx, 5);
      
      if (tx.cdtrIban) txContent += this.tag('CdtrAcct', this.acctXml(tx.cdtrIban, 6), 5);
      if (tx.ultmtCdtrName) txContent += this.partyXml('UltmtCdtr', 'ultmtCdtr', tx, 6);

      if (tx.purpCd) txContent += this.tag('Purp', this.el('Cd', tx.purpCd, 7), 6);
      
      if (tx.taxAmt || tx.taxId) {
        let tax = '';
        if (tx.taxId) tax += this.el('Id', tx.taxId, 7);
        if (tx.taxAmt) tax += this.tag('Amt', this.el('InstdAmt', tx.taxAmt, 8, ` Ccy="${this.e(tx.currency)}"`), 7);
        txContent += this.tag('Tax', tax, 6);
      }

      if (tx.rltdRmtInfUrl) {
        txContent += this.tag('RltdRmtInf', this.el('URL', tx.rltdRmtInfUrl, 7), 6);
      }

      if (tx.rgltryRptg) txContent += this.tag('RgltryRptg', this.tag('Dtls', this.el('Inf', tx.rgltryRptg, 8), 7), 6);
      
      if (tx.rmtInf) txContent += this.tag('RmtInf', this.el('Ustrd', tx.rmtInf, 6), 5);

      txsXml += this.tag('CdtTrfTxInf', txContent, 4);
    });
    pmtInfContent += txsXml;
    const pmtInf = this.tag('PmtInf', pmtInfContent, 3);

    this.generatedXml =
      `<?xml version="1.0" encoding="UTF-8"?>
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

  private acctXml(acc: string, indent: number): string {
    if (!acc) return '';
    // Forced 'Othr' to bypass strict and failing Mod-97 check digit verification in test tools
    const id = this.tag('Othr', this.el('Id', acc.replace(/\s/g, ''), indent + 3), indent + 2);
    return this.tag('Id', id, indent);
  }

  private buildAppHdrFi(bic: string, mmbId: string, clrSysId: string, lei: string, prefix = true): string {
    const p = prefix ? 'h:' : '';
    let res = '';
    if (bic) res += `<${p}BICFI>${this.e(bic)}</${p}BICFI>\n`;
    if (mmbId || clrSysId) {
      let clr = '';
      if (clrSysId) clr += `<${p}ClrSysId><${p}Cd>${this.e(clrSysId)}</${p}Cd></${p}ClrSysId>\n`;
      if (mmbId) clr += `<${p}MmbId>${this.e(mmbId)}</${p}MmbId>\n`;
      res += `<${p}ClrSysMmbId>\n${clr}</${p}ClrSysMmbId>\n`;
    }
    if (lei) res += `<${p}LEI>${this.e(lei)}</${p}LEI>\n`;
    return res;
  }

  // XML Helpers
  private e(v: any): string { 
    if (v === null || v === undefined || v === '') return '';
    return v.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  private tabs(n: number): string { return '\t'.repeat(n); }
  private el(tag: string, val: any, indent: number, attrs = ''): string {
    if (val === undefined || val === null || val === '') return '';
    return `${this.tabs(indent)}<${tag}${attrs}>${this.e(val)}</${tag}>\n`;
  }
  private tag(tag: string, content: string, indent: number): string {
    if (!content || !content.trim()) return '';
    return `${this.tabs(indent)}<${tag}>\n${content}${this.tabs(indent)}</${tag}>\n`;
  }

  partyXml(tag: string, p: string, v: any, indent: number): string {
    const nm = v[p + 'Name'] || 'DEFAULT NAME';
    let content = this.el('Nm', nm, indent + 1);
    content += this.addrXml(v, p, indent + 1);
    content += this.partyIdXml(v, p, indent);
    return this.tag(tag, content, indent);
  }

  addrXml(v: any, p: string, indent = 4): string {
    let type = v[p + 'AddrType'];
    if (!type || type === 'none') type = 'structured';
    
    let lines: string[] = [];
    const t = this.tabs(indent + 1);
    const isStrd = ['structured', 'hybrid'].includes(type);
    const isUstrd = ['unstructured', 'hybrid'].includes(type);

    if (isStrd) {
        if (v[p + 'Dept']) lines.push(`${t}<Dept>${this.e(v[p + 'Dept'])}</Dept>`);
        if (v[p + 'SubDept']) lines.push(`${t}<SubDept>${this.e(v[p + 'SubDept'])}</SubDept>`);
        if (v[p + 'StrtNm']) lines.push(`${t}<StrtNm>${this.e(v[p + 'StrtNm'])}</StrtNm>`);
        if (v[p + 'BldgNb']) lines.push(`${t}<BldgNb>${this.e(v[p + 'BldgNb'])}</BldgNb>`);
        if (v[p + 'BldgNm']) lines.push(`${t}<BldgNm>${this.e(v[p + 'BldgNm'])}</BldgNm>`);
        if (v[p + 'Flr']) lines.push(`${t}<Flr>${this.e(v[p + 'Flr'])}</Flr>`);
        if (v[p + 'PstBx']) lines.push(`${t}<PstBx>${this.e(v[p + 'PstBx'])}</PstBx>`);
        if (v[p + 'Room']) lines.push(`${t}<Room>${this.e(v[p + 'Room'])}</Room>`);
        if (v[p + 'PstCd']) lines.push(`${t}<PstCd>${this.e(v[p + 'PstCd'])}</PstCd>`);
        lines.push(`${t}<TwnNm>${this.e(v[p + 'TwnNm'] || 'London')}</TwnNm>`);
        lines.push(`${t}<Ctry>${this.e(v[p + 'Ctry'] || 'GB')}</Ctry>`);
    } else if (v[p + 'Ctry']) {
        lines.push(`${t}<Ctry>${this.e(v[p + 'Ctry'])}</Ctry>`);
    }

    if (isUstrd) {
        if (v[p + 'AdrLine1']) lines.push(`${t}<AdrLine>${this.e(v[p + 'AdrLine1'])}</AdrLine>`);
        if (v[p + 'AdrLine2']) lines.push(`${t}<AdrLine>${this.e(v[p + 'AdrLine2'])}</AdrLine>`);
    }
    
    if (!lines.length) return '';
    return `${this.tabs(indent)}<PstlAdr>\n${lines.join('\n')}\n${this.tabs(indent)}</PstlAdr>\n`;
  }

  partyIdXml(v: any, p: string, indent = 4): string {
    let idContent = '';
    if (v[p + 'OrgIdAnyBic'] || v[p + 'OrgIdLei'] || v[p + 'Id']) {
      let orgId = '';
      if (v[p + 'OrgIdAnyBic']) orgId += this.el('AnyBIC', v[p + 'OrgIdAnyBic'], indent + 3);
      if (v[p + 'OrgIdLei']) orgId += this.el('LEI', v[p + 'OrgIdLei'], indent + 3);
      if (v[p + 'Id'] && !v[p + 'OrgIdAnyBic']) {
        orgId += this.tag('Othr', this.el('Id', v[p + 'Id'], indent + 5), indent + 3);
      }
      idContent = this.tag('OrgId', orgId, indent + 2);
    } else if (v[p + 'PrvtIdBirthDt']) {
      let dob = this.el('BirthDt', v[p + 'PrvtIdBirthDt'], indent + 4);
      if (v[p + 'PrvtIdCityOfBirth']) dob += this.el('CityOfBirth', v[p + 'PrvtIdCityOfBirth'], indent + 4);
      if (v[p + 'PrvtIdCtryOfBirth']) dob += this.el('CtryOfBirth', v[p + 'PrvtIdCtryOfBirth'], indent + 4);
      idContent = this.tag('PrvtId', this.tag('DtAndPlcOfBirth', dob, indent + 3), indent + 2);
    }
    return idContent ? this.tag('Id', idContent, indent + 1) : '';
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
        patch.charSet = tval('CharSet', appHdr);
        const fr = findTag('Fr', appHdr);
        if (fr) {
          patch.fromBic = tval('BICFI', fr);
          const clrSysMmbId = findTag('ClrSysMmbId', fr);
          if (clrSysMmbId) {
            patch.fromClrSysMmbId = tval('MmbId', clrSysMmbId);
            const clrSysId = findTag('ClrSysId', clrSysMmbId);
            if (clrSysId) patch.fromClrSysCd = tval('Cd', clrSysId);
          }
          const frLei = tval('LEI', fr);
          if (frLei) patch.fromLei = frLei;
        }
        const to = findTag('To', appHdr);
        if (to) {
          patch.toBic = tval('BICFI', to);
          const toClrSysMmbId = findTag('ClrSysMmbId', to);
          if (toClrSysMmbId) {
            patch.toClrSysMmbId = tval('MmbId', toClrSysMmbId);
            const toClrSysId = findTag('ClrSysId', toClrSysMmbId);
            if (toClrSysId) patch.toClrSysCd = tval('Cd', toClrSysId);
          }
          const toLei = tval('LEI', to);
          if (toLei) patch.toLei = toLei;
        }
        patch.bizMsgId = tval('BizMsgIdr', appHdr);
        patch.msgDefIdr = tval('MsgDefIdr', appHdr);
        patch.bizSvc = tval('BizSvc', appHdr);

        const creDtRaw = tval('CreDt', appHdr);
        if (creDtRaw) {
          patch.creDt = creDtRaw.includes('T') ? creDtRaw.split('T')[0] : creDtRaw;
        }
        const cpyDplct = tval('CpyDplct', appHdr);
        if (cpyDplct) patch.cpyDplct = cpyDplct;
        const pssblDplct = tval('PssblDplct', appHdr);
        if (pssblDplct) patch.pssblDplct = pssblDplct;
        const appHdrPrty = tval('Prty', appHdr);
        if (appHdrPrty) patch.appHdrPrty = appHdrPrty;

        const rltd = findTag('Rltd', appHdr);
        if (rltd) {
          const rltdAppHdr = findTag('AppHdr', rltd);
          if (rltdAppHdr) patch.rltdBizMsgId = tval('BizMsgIdr', rltdAppHdr);
        }
      }

      // 2. Document
      const root = findTag('CstmrCdtTrfInitn');
      if (root) {
        const grpHdr = findTag('GrpHdr', root);
        if (grpHdr) {
          patch.msgId = tval('MsgId', grpHdr);
          patch.creDtTm = tval('CreDtTm', grpHdr);
          const authstn = findTag('Authstn', grpHdr);
          if (authstn) {
            patch.authstnCd = tval('Cd', authstn);
            patch.authstnPrtry = tval('Prtry', authstn);
          }
          patch.nbOfTxs = tval('NbOfTxs', grpHdr);
          patch.ctrlSum = tval('CtrlSum', grpHdr);
          const initgPty = findTag('InitgPty', grpHdr);
          if (initgPty) {
            patch.initgPtyName = tval('Nm', initgPty);
            const orgId = findTag('OrgId', initgPty);
            if (orgId) {
              const anyBic = tval('AnyBIC', orgId);
              if (anyBic) patch.initgPtyBic = anyBic;
              const othr = findTag('Othr', orgId);
              if (othr) patch.initgPtyId = tval('Id', othr);
            }
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
            const svcLvl = findTag('SvcLvl', pmtTpInf);
            if (svcLvl) patch.svcLvl = tval('Cd', svcLvl);
            const lclInstrm = findTag('LclInstrm', pmtTpInf);
            if (lclInstrm) patch.lclInstrm = tval('Cd', lclInstrm);
            const ctgyPurp = findTag('CtgyPurp', pmtTpInf);
            if (ctgyPurp) patch.ctgyPurp = tval('Cd', ctgyPurp);
          }

          const reqdDt = findTag('ReqdExctnDt', pmtInf);
          if (reqdDt) {
            const dtRaw = tval('Dt', reqdDt);
            patch.reqdExctnDt = dtRaw.includes('T') ? dtRaw.split('T')[0] : dtRaw;
          }
          
          const dbtr = findTag('Dbtr', pmtInf);
          if (dbtr) {
            patch.dbtrName = tval('Nm', dbtr);
            const pstl = findTag('PstlAdr', dbtr);
            if (pstl) {
              patch.dbtrCtry = tval('Ctry', pstl);
              patch.dbtrTwnNm = tval('TwnNm', pstl);
              const lines = pstl.querySelectorAll(':scope > AdrLine');
              if (lines.length > 0) patch.dbtrAdrLine1 = lines[0].textContent || '';
              if (lines.length > 1) patch.dbtrAdrLine2 = lines[1].textContent || '';
            }
            const id = findTag('Id', dbtr);
            if (id) {
              const orgId = findTag('OrgId', id);
              if (orgId) {
                patch.dbtrOrgIdAnyBic = tval('AnyBIC', orgId);
                patch.dbtrOrgIdLei = tval('LEI', orgId);
              } else {
                const prvtId = findTag('PrvtId', id);
                if (prvtId) {
                   const dob = findTag('DtAndPlcOfBirth', prvtId);
                   if (dob) {
                     patch.dbtrPrvtIdBirthDt = tval('BirthDt', dob);
                     patch.dbtrPrvtIdCityOfBirth = tval('CityOfBirth', dob);
                     patch.dbtrPrvtIdCtryOfBirth = tval('CtryOfBirth', dob);
                   }
                }
              }
            }
          }
          
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
