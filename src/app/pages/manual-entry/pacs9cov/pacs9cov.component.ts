import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { ConfigService } from '../../../services/config.service';

@Component({
    selector: 'app-pacs9cov',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule, MatIconModule],
    templateUrl: './pacs9cov.component.html',
    styleUrl: './pacs9cov.component.css'
})
export class Pacs9CovComponent implements OnInit {
    form!: FormGroup;
    generatedXml = '';
    currentTab: 'form' | 'preview' = 'form';
    isValidating = false;
    validationReport: any = null;
    expandedLayers: Record<string, boolean> = {};

    currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'SGD', 'HKD', 'INR', 'CNY', 'AED', 'SAR'];
    sttlmMethods = ['COVE'];

    agentPrefixes = ['instgAgt', 'instdAgt', 'dbtrAgt', 'cdtrAgt',
        'prvsInstgAgt1', 'prvsInstgAgt2', 'prvsInstgAgt3',
        'intrmyAgt1', 'intrmyAgt2', 'intrmyAgt3'];

    // COV address prefixes for UndrlygCstmrCdtTrf parties
    covPartyPrefixes = ['covDbtr', 'covCdtr', 'covUltmtDbtr', 'covUltmtCdtr'];

    instrForCdtrAgtCodes = ['', 'CHQB', 'HOLD', 'PHOB', 'TELB'];

    constructor(private fb: FormBuilder, private http: HttpClient, private config: ConfigService) { }

    ngOnInit() {
        this.buildForm(); this.generateXml();
        // Auto-sync AppHdr Fr/To BICs with InstgAgt/InstdAgt
        this.form.get('instgAgtBic')?.valueChanges.subscribe(v => this.form.patchValue({ fromBic: v }, { emitEvent: false }));
        this.form.get('instdAgtBic')?.valueChanges.subscribe(v => this.form.patchValue({ toBic: v }, { emitEvent: false }));
    }

    private buildForm() {
        const BIC = [Validators.required, Validators.pattern(/^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)];
        const BIC_OPT = [Validators.pattern(/^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)];
        const c: any = {
            fromBic: ['RBOSGB2L', BIC], toBic: ['NDEAFIHH', BIC], bizMsgId: ['pacs9bizmsgidr01', Validators.required],
            msgId: ['pacs9bizmsgidr01', Validators.required], creDtTm: [this.isoNow(), Validators.required],
            nbOfTxs: ['1', [Validators.required, Validators.pattern(/^[1-9]\d*$/)]], sttlmMtd: ['COVE', Validators.required],
            instgAgtBic: ['RBOSGB2L', BIC], instdAgtBic: ['NDEAFIHH', BIC],
            instrId: ['pacs9bizmsgidr01', Validators.required], endToEndId: ['pacs8bizmsgidr01', Validators.required],
            uetr: ['8a562c67-ca16-48ba-b074-65581be6f001', [Validators.required, Validators.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)]],
            amount: ['1500000', [Validators.required, Validators.pattern(/^\d+(\.\d{1,5})?$/)]], currency: ['EUR', Validators.required],
            sttlmDt: [new Date().toISOString().split('T')[0], Validators.required],
            // Debtor FI (required)
            dbtrFiBic: ['RBOSGB2L', BIC], dbtrFiAcct: [''],
            // Debtor Agent (optional)
            dbtrAgtBic: ['NDEAFIHH', BIC_OPT],
            // Creditor Agent (optional)
            cdtrAgtBic: ['HELSFIHH', BIC_OPT],
            // Creditor FI (required)
            cdtrFiBic: ['OKOYFIHH', BIC], cdtrFiAcct: [''],
            // Optional agents
            prvsInstgAgt1Bic: ['', BIC_OPT], prvsInstgAgt2Bic: ['', BIC_OPT], prvsInstgAgt3Bic: ['', BIC_OPT],
            intrmyAgt1Bic: ['', BIC_OPT], intrmyAgt2Bic: ['', BIC_OPT], intrmyAgt3Bic: ['', BIC_OPT],
            // COV — UndrlygCstmrCdtTrf fields
            covUltmtDbtrName: [''],
            covDbtrName: ['A Debiter'],
            covDbtrAcctId: ['R85236974'],
            covDbtrIban: [''],
            covDbtrAgtBic: ['RBOSGB2L', BIC_OPT],
            covCdtrAgtBic: ['OKOYFIHH', BIC_OPT],
            covCdtrName: ['Z Krediter'],
            covCdtrAcctId: ['O96325478'],
            covCdtrIban: [''],
            covUltmtCdtrName: [''],
            // InstrForCdtrAgt
            covInstrForCdtrAgtCd: [''],
            covInstrForCdtrAgtInstrInf: [''],
            // InstrForNxtAgt
            covInstrForNxtAgtInstrInf: [''],
            // RmtInf (Ustrd)
            covRmtInfUstrd: [''],
            // InstdAmt
            covInstdAmtCcy: ['EUR'],
            covInstdAmt: [''],
        };
        // Address prefixes for main agents
        this.agentPrefixes.forEach(p => {
            c[p + 'AddrType'] = 'none'; c[p + 'AdrLine1'] = ''; c[p + 'AdrLine2'] = '';
            c[p + 'Dept'] = ''; c[p + 'SubDept'] = '';
            c[p + 'StrtNm'] = ''; c[p + 'BldgNb'] = ''; c[p + 'BldgNm'] = '';
            c[p + 'Flr'] = ''; c[p + 'PstBx'] = ''; c[p + 'Room'] = '';
            c[p + 'PstCd'] = ''; c[p + 'TwnNm'] = ''; c[p + 'CtrySubDvsn'] = ''; c[p + 'Ctry'] = '';
        });
        // Address prefixes for COV parties (Debtor / Creditor in UndrlygCstmrCdtTrf)
        this.covPartyPrefixes.forEach(p => {
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

        // CdtTrfTxInf — pacs.009.001.08 COV element order
        let tx = '';
        tx += this.tag('PmtId', this.el('InstrId', v.instrId) + this.el('EndToEndId', v.endToEndId) + this.el('UETR', v.uetr), 3);
        tx += `\t\t\t<IntrBkSttlmAmt Ccy="${this.e(v.currency)}">${v.amount}</IntrBkSttlmAmt>\n`;
        tx += this.el('IntrBkSttlmDt', v.sttlmDt, 3);
        // PrvsInstgAgts
        tx += this.agt('PrvsInstgAgt1', 'prvsInstgAgt1', v);
        tx += this.agt('PrvsInstgAgt2', 'prvsInstgAgt2', v);
        tx += this.agt('PrvsInstgAgt3', 'prvsInstgAgt3', v);
        // InstgAgt/InstdAgt in CdtTrfTxInf
        tx += this.agt('InstgAgt', 'instgAgt', v);
        tx += this.agt('InstdAgt', 'instdAgt', v);
        // IntrmyAgts
        tx += this.agt('IntrmyAgt1', 'intrmyAgt1', v);
        tx += this.agt('IntrmyAgt2', 'intrmyAgt2', v);
        tx += this.agt('IntrmyAgt3', 'intrmyAgt3', v);
        // Dbtr (FI — BranchAndFinancialInstitutionIdentification8)
        tx += `\t\t\t<Dbtr>\n\t\t\t\t<FinInstnId>\n\t\t\t\t\t<BICFI>${this.e(v.dbtrFiBic)}</BICFI>\n\t\t\t\t</FinInstnId>\n\t\t\t</Dbtr>\n`;
        if (v.dbtrFiAcct?.trim()) tx += `\t\t\t<DbtrAcct>\n\t\t\t\t<Id>\n\t\t\t\t\t<Othr>\n\t\t\t\t\t\t<Id>${this.e(v.dbtrFiAcct)}</Id>\n\t\t\t\t\t</Othr>\n\t\t\t\t</Id>\n\t\t\t</DbtrAcct>\n`;
        // DbtrAgt (optional)
        tx += this.agt('DbtrAgt', 'dbtrAgt', v);
        // CdtrAgt (optional)
        tx += this.agt('CdtrAgt', 'cdtrAgt', v);
        // Cdtr (FI)
        tx += `\t\t\t<Cdtr>\n\t\t\t\t<FinInstnId>\n\t\t\t\t\t<BICFI>${this.e(v.cdtrFiBic)}</BICFI>\n\t\t\t\t</FinInstnId>\n\t\t\t</Cdtr>\n`;
        if (v.cdtrFiAcct?.trim()) tx += `\t\t\t<CdtrAcct>\n\t\t\t\t<Id>\n\t\t\t\t\t<Othr>\n\t\t\t\t\t\t<Id>${this.e(v.cdtrFiAcct)}</Id>\n\t\t\t\t\t</Othr>\n\t\t\t\t</Id>\n\t\t\t</CdtrAcct>\n`;

        // COV: UndrlygCstmrCdtTrf
        tx += this.buildCov(v);

        // Use instgAgtBic/instdAgtBic for AppHdr Fr/To
        const frBic = v.instgAgtBic || v.fromBic;
        const toBic = v.instdAgtBic || v.toBic;

        this.generatedXml =
            `<?xml version="1.0" encoding="UTF-8"?>
<Envelope xmlns="urn:swift:xsd:envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
\t<head:AppHdr xmlns:head="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
\t\t<head:Fr>
\t\t\t<head:FIId>
\t\t\t\t<head:FinInstnId>
\t\t\t\t\t<head:BICFI>${this.e(frBic)}</head:BICFI>
\t\t\t\t</head:FinInstnId>
\t\t\t</head:FIId>
\t\t</head:Fr>
\t\t<head:To>
\t\t\t<head:FIId>
\t\t\t\t<head:FinInstnId>
\t\t\t\t\t<head:BICFI>${this.e(toBic)}</head:BICFI>
\t\t\t\t</head:FinInstnId>
\t\t\t</head:FIId>
\t\t</head:To>
\t\t<head:BizMsgIdr>${this.e(v.bizMsgId)}</head:BizMsgIdr>
\t\t<head:MsgDefIdr>pacs.009.001.08</head:MsgDefIdr>
\t\t<head:BizSvc>swift.cbprplus.cov.04</head:BizSvc>
\t\t<head:CreDt>${creDtTm}</head:CreDt>
\t</head:AppHdr>
\t<pacs:Document xmlns:pacs="urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08">
\t\t<pacs:FICdtTrf>
\t\t\t<pacs:GrpHdr>
\t\t\t\t<pacs:MsgId>${this.e(v.msgId)}</pacs:MsgId>
\t\t\t\t<pacs:CreDtTm>${creDtTm}</pacs:CreDtTm>
\t\t\t\t<pacs:NbOfTxs>${v.nbOfTxs}</pacs:NbOfTxs>
\t\t\t\t<pacs:SttlmInf>
\t\t\t\t\t<pacs:SttlmMtd>${this.e(v.sttlmMtd)}</pacs:SttlmMtd>
\t\t\t\t</pacs:SttlmInf>
\t\t\t</pacs:GrpHdr>
\t\t\t<pacs:CdtTrfTxInf>
${this.prefixLines(tx, 'pacs:')}\t\t\t</pacs:CdtTrfTxInf>
\t\t</pacs:FICdtTrf>
\t</pacs:Document>
</Envelope>`;
    }

    // Prefix all XML element tags with pacs: namespace
    private prefixLines(xml: string, ns: string): string {
        return xml.replace(/<(\/?)([\w]+)([ >])/g, `<$1${ns}$2$3`);
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
        if (type === 'unstructured' || type === 'hybrid') {
            if (v[p + 'AdrLine1']) lines.push(`${t}<AdrLine>${this.e(v[p + 'AdrLine1'])}</AdrLine>`);
            if (v[p + 'AdrLine2']) lines.push(`${t}<AdrLine>${this.e(v[p + 'AdrLine2'])}</AdrLine>`);
        }
        if (!lines.length) return '';
        return `${this.tabs(indent)}<PstlAdr>\n${lines.join('\n')}\n${this.tabs(indent)}</PstlAdr>\n`;
    }

    // COV: UndrlygCstmrCdtTrf (CreditTransferTransaction62)
    // XSD element order: UltmtDbtr?, InitgPty?, Dbtr, DbtrAcct?, DbtrAgt, DbtrAgtAcct?,
    //   PrvsInstgAgt1..3?, IntrmyAgt1..3?, CdtrAgt, CdtrAgtAcct?, Cdtr, CdtrAcct?,
    //   UltmtCdtr?, InstrForCdtrAgt*, InstrForNxtAgt*, RmtInf?, InstdAmt?
    private buildCov(v: any): string {
        let b = `\t\t\t<UndrlygCstmrCdtTrf>\n`;
        // UltmtDbtr (optional)
        if (v.covUltmtDbtrName?.trim()) {
            let ud = `\t\t\t\t\t<Nm>${this.e(v.covUltmtDbtrName)}</Nm>\n`;
            const udAddr = this.addrXml(v, 'covUltmtDbtr', 5);
            if (udAddr) ud += udAddr;
            b += `\t\t\t\t<UltmtDbtr>\n${ud}\t\t\t\t</UltmtDbtr>\n`;
        }
        // Dbtr (PartyIdentification272)
        if (v.covDbtrName) {
            let dbtr = `\t\t\t\t\t<Nm>${this.e(v.covDbtrName)}</Nm>\n`;
            const dbtrAddr = this.addrXml(v, 'covDbtr', 5);
            if (dbtrAddr) dbtr += dbtrAddr;
            b += `\t\t\t\t<Dbtr>\n${dbtr}\t\t\t\t</Dbtr>\n`;
        }
        // DbtrAcct
        if (v.covDbtrIban?.trim()) {
            b += `\t\t\t\t<DbtrAcct>\n\t\t\t\t\t<Id>\n\t\t\t\t\t\t<IBAN>${this.e(v.covDbtrIban)}</IBAN>\n\t\t\t\t\t</Id>\n\t\t\t\t</DbtrAcct>\n`;
        } else if (v.covDbtrAcctId?.trim()) {
            b += `\t\t\t\t<DbtrAcct>\n\t\t\t\t\t<Id>\n\t\t\t\t\t\t<Othr>\n\t\t\t\t\t\t\t<Id>${this.e(v.covDbtrAcctId)}</Id>\n\t\t\t\t\t\t</Othr>\n\t\t\t\t\t</Id>\n\t\t\t\t</DbtrAcct>\n`;
        }
        // DbtrAgt
        if (v.covDbtrAgtBic?.trim()) b += `\t\t\t\t<DbtrAgt>\n\t\t\t\t\t<FinInstnId>\n\t\t\t\t\t\t<BICFI>${this.e(v.covDbtrAgtBic)}</BICFI>\n\t\t\t\t\t</FinInstnId>\n\t\t\t\t</DbtrAgt>\n`;
        // CdtrAgt
        if (v.covCdtrAgtBic?.trim()) b += `\t\t\t\t<CdtrAgt>\n\t\t\t\t\t<FinInstnId>\n\t\t\t\t\t\t<BICFI>${this.e(v.covCdtrAgtBic)}</BICFI>\n\t\t\t\t\t</FinInstnId>\n\t\t\t\t</CdtrAgt>\n`;
        // Cdtr (PartyIdentification272)
        if (v.covCdtrName) {
            let cdtr = `\t\t\t\t\t<Nm>${this.e(v.covCdtrName)}</Nm>\n`;
            const cdtrAddr = this.addrXml(v, 'covCdtr', 5);
            if (cdtrAddr) cdtr += cdtrAddr;
            b += `\t\t\t\t<Cdtr>\n${cdtr}\t\t\t\t</Cdtr>\n`;
        }
        // CdtrAcct
        if (v.covCdtrIban?.trim()) {
            b += `\t\t\t\t<CdtrAcct>\n\t\t\t\t\t<Id>\n\t\t\t\t\t\t<IBAN>${this.e(v.covCdtrIban)}</IBAN>\n\t\t\t\t\t</Id>\n\t\t\t\t</CdtrAcct>\n`;
        } else if (v.covCdtrAcctId?.trim()) {
            b += `\t\t\t\t<CdtrAcct>\n\t\t\t\t\t<Id>\n\t\t\t\t\t\t<Othr>\n\t\t\t\t\t\t\t<Id>${this.e(v.covCdtrAcctId)}</Id>\n\t\t\t\t\t\t</Othr>\n\t\t\t\t\t</Id>\n\t\t\t\t</CdtrAcct>\n`;
        }
        // UltmtCdtr (optional)
        if (v.covUltmtCdtrName?.trim()) {
            let uc = `\t\t\t\t\t<Nm>${this.e(v.covUltmtCdtrName)}</Nm>\n`;
            const ucAddr = this.addrXml(v, 'covUltmtCdtr', 5);
            if (ucAddr) uc += ucAddr;
            b += `\t\t\t\t<UltmtCdtr>\n${uc}\t\t\t\t</UltmtCdtr>\n`;
        }
        // InstrForCdtrAgt (optional)
        if (v.covInstrForCdtrAgtCd?.trim() || v.covInstrForCdtrAgtInstrInf?.trim()) {
            let instr = '';
            if (v.covInstrForCdtrAgtCd?.trim()) instr += `\t\t\t\t\t<Cd>${this.e(v.covInstrForCdtrAgtCd)}</Cd>\n`;
            if (v.covInstrForCdtrAgtInstrInf?.trim()) instr += `\t\t\t\t\t<InstrInf>${this.e(v.covInstrForCdtrAgtInstrInf)}</InstrInf>\n`;
            b += `\t\t\t\t<InstrForCdtrAgt>\n${instr}\t\t\t\t</InstrForCdtrAgt>\n`;
        }
        // InstrForNxtAgt (optional)
        if (v.covInstrForNxtAgtInstrInf?.trim()) {
            b += `\t\t\t\t<InstrForNxtAgt>\n\t\t\t\t\t<InstrInf>${this.e(v.covInstrForNxtAgtInstrInf)}</InstrInf>\n\t\t\t\t</InstrForNxtAgt>\n`;
        }
        // RmtInf (optional — Ustrd)
        if (v.covRmtInfUstrd?.trim()) {
            b += `\t\t\t\t<RmtInf>\n\t\t\t\t\t<Ustrd>${this.e(v.covRmtInfUstrd)}</Ustrd>\n\t\t\t\t</RmtInf>\n`;
        }
        // InstdAmt (optional)
        if (v.covInstdAmt?.trim() && v.covInstdAmtCcy?.trim()) {
            b += `\t\t\t\t<InstdAmt Ccy="${this.e(v.covInstdAmtCcy)}">${v.covInstdAmt}</InstdAmt>\n`;
        }
        b += `\t\t\t</UndrlygCstmrCdtTrf>\n`;
        return b;
    }

    // Validation
    validateMessage() {
        this.generateXml(); if (!this.generatedXml?.trim()) return;
        this.isValidating = true; this.validationReport = null; this.expandedLayers = {};
        this.http.post(this.config.getApiUrl('/validate'), {
            xml_content: this.generatedXml, mode: 'Full 1-3', message_type: 'pacs.009.001.08', store_in_history: true
        }).subscribe({
            next: (d: any) => {
                this.validationReport = d; this.isValidating = false;
                if (d?.details) [...new Set(d.details.map((x: any) => x.layer))].forEach(l => this.expandedLayers[this.layerName(String(l))] = true);
            },
            error: () => {
                this.isValidating = false;
                this.validationReport = {
                    status: 'FAIL', errors: 1, warnings: 0, message: 'pacs.009.001.08 (COV)', total_time_ms: 0,
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

    downloadXml() { this.generateXml(); const b = new Blob([this.generatedXml], { type: 'application/xml' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `pacs009-cov-${Date.now()}.xml`; a.click(); URL.revokeObjectURL(a.href); }
    copyToClipboard() { this.generateXml(); navigator.clipboard.writeText(this.generatedXml).then(() => alert('Copied!')); }
    switchToPreview() { this.generateXml(); this.currentTab = 'preview'; }
}
