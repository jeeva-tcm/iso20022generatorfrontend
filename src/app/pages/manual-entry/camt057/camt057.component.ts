import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ConfigService } from '../../../services/config.service';

@Component({
    selector: 'app-camt057',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule, MatIconModule, MatSnackBarModule],
    templateUrl: './camt057.component.html',
    styleUrl: './camt057.component.css'
})
export class Camt057Component implements OnInit {
    form!: FormGroup;
    generatedXml = '';
    currentTab: 'form' | 'preview' = 'form';
    editorLineCount: any[] = [];
    isParsingXml = false;

    currencies: string[] = [];
    countries: string[] = [];

    constructor(
        private fb: FormBuilder,
        private http: HttpClient,
        private config: ConfigService,
        private snackBar: MatSnackBar,
        private router: Router
    ) { }

    ngOnInit() {
        this.fetchCodelists();
        this.buildForm();
        this.generateXml();
        this.onEditorChange(this.generatedXml, true);
        this.form.valueChanges.subscribe(() => {
            this.generateXml();
        });
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
    }

    private buildForm() {
        const BIC = [Validators.pattern(/^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)];
        const BIC_REQ = [Validators.required, ...BIC];

        this.form = this.fb.group({
            fromBic: ['RECVUS33XXX', BIC_REQ],
            toBic: ['SENDGB2LXXX', BIC_REQ],
            bizMsgId: ['B-2026-N-001', [Validators.required, Validators.maxLength(35)]],
            msgId: ['NTF-2026-001', [Validators.required, Validators.maxLength(35)]],
            bizSvc: ['swift.cbprplus.01', [Validators.required, Validators.maxLength(35)]],
            creDtTm: [this.isoNow(), Validators.required],

            ntfctnId: ['ID-057-001', [Validators.required, Validators.maxLength(35)]],
            acctIban: ['GB33RECV1234567890', [Validators.required, Validators.pattern(/^[A-Z]{2}[0-9]{2}[a-zA-Z0-9]{1,30}$/)]],
            acctOwnrName: ['Global Receiver Corp', Validators.maxLength(140)], // Optional in CBPR+

            itmId: ['ITEM-001', [Validators.required, Validators.maxLength(35)]],
            amount: ['5000.00', [Validators.required, Validators.pattern(/^\d{1,18}(\.\d{1,5})?$/)]],
            currency: ['USD', Validators.required],
            valDt: [new Date().toISOString().split('T')[0], Validators.required],

            // Optional but commonly used
            endToEndId: ['E2E-057-001', Validators.maxLength(35)],
            uetr: ['550e8400-e29b-41d4-a716-446655440001', [Validators.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)]],
            dbtrName: ['Sender Bank Ltd', Validators.maxLength(140)],
            dbtrBic: ['SENDBK55XXX', BIC]
        });
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
            if (f === 'bizMsgId' || f === 'msgId' || f === 'ntfctnId' || f === 'itmId' || f === 'instrId' || f === 'endToEndId' || f === 'txId') return 'Invalid Pattern.';
        }
        return 'Invalid value.';
    }

    isoNow(): string {
        const d = new Date(), p = (n: number) => n.toString().padStart(2, '0');
        const off = -d.getTimezoneOffset(), s = off >= 0 ? '+' : '-';
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${s}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
    }

    generateXml() {
        if (this.isParsingXml) return;
        const v = this.form.value;
        let creDtTm = v.creDtTm || this.isoNow();
        if (creDtTm.endsWith('Z')) creDtTm = creDtTm.replace('Z', '+00:00');

        // Optional Account components
        let acctXml = `\t\t\t\t<Acct>\n\t\t\t\t\t<Id><IBAN>${this.e(v.acctIban)}</IBAN></Id>\n\t\t\t\t</Acct>\n`;
        if (v.acctOwnrName?.trim()) {
            acctXml += `\t\t\t\t<AcctOwnr>\n\t\t\t\t\t<Pty>\n\t\t\t\t\t\t<Nm>${this.e(v.acctOwnrName)}</Nm>\n\t\t\t\t\t</Pty>\n\t\t\t\t</AcctOwnr>\n`;
        }

        // Optional Item components
        let itmXml = `\t\t\t\t<Itm>\n\t\t\t\t\t<Id>${this.e(v.itmId)}</Id>\n`;
        if (v.endToEndId?.trim()) itmXml += `\t\t\t\t\t<EndToEndId>${this.e(v.endToEndId)}</EndToEndId>\n`;
        if (v.uetr?.trim()) itmXml += `\t\t\t\t\t<UETR>${this.e(v.uetr)}</UETR>\n`;
        itmXml += `\t\t\t\t\t<Amt Ccy="${this.e(v.currency)}">${v.amount}</Amt>\n`;
        itmXml += `\t\t\t\t\t<XpctdValDt>${v.valDt}</XpctdValDt>\n`;

        if (v.dbtrName?.trim()) {
            itmXml += `\t\t\t\t\t<Dbtr>\n\t\t\t\t\t\t<Pty>\n\t\t\t\t\t\t\t<Nm>${this.e(v.dbtrName)}</Nm>\n\t\t\t\t\t\t</Pty>\n\t\t\t\t\t</Dbtr>\n`;
        }
        if (v.dbtrBic?.trim()) {
            itmXml += `\t\t\t\t\t<DbtrAgt>\n\t\t\t\t\t\t<FinInstnId><BICFI>${this.e(v.dbtrBic)}</BICFI></FinInstnId>\n\t\t\t\t\t</DbtrAgt>\n`;
        }
        itmXml += `\t\t\t\t</Itm>`;

        this.generatedXml = `<?xml version="1.0" encoding="UTF-8"?>
<BusMsgEnvlp xmlns="urn:swift:xsd:envelope">
\t<AppHdr xmlns="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
\t\t<Fr><FIId><FinInstnId><BICFI>${this.e(v.fromBic)}</BICFI></FinInstnId></FIId></Fr>
\t\t<To><FIId><FinInstnId><BICFI>${this.e(v.toBic)}</BICFI></FinInstnId></FIId></To>
\t\t<BizMsgIdr>${this.e(v.bizMsgId)}</BizMsgIdr>
\t\t<MsgDefIdr>camt.057.001.06</MsgDefIdr>
\t\t<BizSvc>${this.e(v.bizSvc)}</BizSvc>
\t\t<CreDt>${creDtTm}</CreDt>
\t</AppHdr>
\t<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.057.001.06">
\t\t<NtfctnToRcv>
\t\t\t<GrpHdr>
\t\t\t\t<MsgId>${this.e(v.msgId)}</MsgId>
\t\t\t\t<CreDtTm>${creDtTm}</CreDtTm>
\t\t\t</GrpHdr>
\t\t\t<Ntfctn>
\t\t\t\t<Id>${this.e(v.ntfctnId)}</Id>
${acctXml}
${itmXml}
\t\t\t</Ntfctn>
\t\t</NtfctnToRcv>
\t</Document>
</BusMsgEnvlp>`;
        this.onEditorChange(this.generatedXml, true);
    }

    onEditorChange(content: string, fromForm = false) {
        this.generatedXml = content;
        const lines = content.split('\n').length;
        this.editorLineCount = Array.from({ length: lines }, (_, i) => i + 1);

        if (fromForm || this.isParsingXml) return;
        this.parseXmlToForm(content);
    }

    parseXmlToForm(content: string) {
        try {
            const cleanXml = content.replace(/<(\/?)(?:[\w]+:)/g, '<$1');
            const doc = new DOMParser().parseFromString(cleanXml, 'text/xml');
            if (doc.querySelector('parsererror')) return;

            const patch: any = {};
            const tval = (t: string) => doc.getElementsByTagName(t)[0]?.textContent || '';
            const setVal = (key: string, val: string) => { patch[key] = val; };

            setVal('bizMsgId', tval('BizMsgIdr'));
            setVal('bizSvc', tval('BizSvc'));
            setVal('msgId', tval('MsgId'));
            setVal('ntfctnId', doc.getElementsByTagName('Ntfctn')[0]?.getElementsByTagName('Id')[0]?.textContent || '');
            setVal('acctIban', tval('IBAN'));

            const acctOwnr = doc.getElementsByTagName('AcctOwnr')[0];
            setVal('acctOwnrName', acctOwnr ? (acctOwnr.getElementsByTagName('Nm')[0]?.textContent || '') : '');

            const itm = doc.getElementsByTagName('Itm')[0];
            if (itm) {
                setVal('itmId', itm.getElementsByTagName('Id')[0]?.textContent || '');
                setVal('endToEndId', itm.getElementsByTagName('EndToEndId')[0]?.textContent || '');
                setVal('uetr', itm.getElementsByTagName('UETR')[0]?.textContent || '');
                const amtEl = itm.getElementsByTagName('Amt')[0];
                setVal('amount', amtEl ? (amtEl.textContent || '') : '');
                setVal('currency', amtEl ? (amtEl.getAttribute('Ccy') || '') : '');
                setVal('valDt', itm.getElementsByTagName('XpctdValDt')[0]?.textContent || '');

                const dbtr = itm.getElementsByTagName('Dbtr')[0];
                setVal('dbtrName', dbtr ? (dbtr.getElementsByTagName('Nm')[0]?.textContent || '') : '');
                const dbtrAgt = itm.getElementsByTagName('DbtrAgt')[0];
                setVal('dbtrBic', dbtrAgt ? (dbtrAgt.getElementsByTagName('BICFI')[0]?.textContent || '') : '');
            } else {
                ['itmId', 'endToEndId', 'uetr', 'amount', 'currency', 'valDt', 'dbtrName', 'dbtrBic'].forEach(f => setVal(f, ''));
            }

            const tryTag = (parent: string, child: string) => {
                const p = doc.getElementsByTagName(parent)[0];
                return p ? (p.getElementsByTagName(child)[0]?.textContent || '') : '';
            };
            setVal('fromBic', tryTag('Fr', 'BICFI'));
            setVal('toBic', tryTag('To', 'BICFI'));

            const creDtTm = doc.getElementsByTagName('CreDtTm')[0] || doc.getElementsByTagName('CreDt')[0];
            setVal('creDtTm', creDtTm ? (creDtTm.textContent || '') : '');

            this.isParsingXml = true;
            this.form.patchValue(patch, { emitEvent: false });
            this.isParsingXml = false;
        } catch (e) {
            this.isParsingXml = false;
        }
    }

    syncScroll(editor: any, gutter: any) {
        gutter.scrollTop = editor.scrollTop;
    }

    private e(v: string) { return (v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    validateMessage() {
        this.generateXml();
        if (!this.generatedXml?.trim()) return;

        // Redirect to validate page with the XML payload
        this.router.navigate(['/validate'], {
            state: {
                autoValidateXml: this.generatedXml,
                fileName: `camt057-${Date.now()}.xml`,
                messageType: 'camt.057.001.06'
            }
        });
    }



    downloadXml() {
        this.generateXml();
        const b = new Blob([this.generatedXml], { type: 'application/xml' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = `camt057-${Date.now()}.xml`;
        a.click();
    }

    copyToClipboard() {
        this.generateXml();
        navigator.clipboard.writeText(this.generatedXml).then(() => {
            this.snackBar.open('Copied to clipboard!', 'Close', { duration: 3000, horizontalPosition: 'center', verticalPosition: 'bottom' });
        });
    }

    switchToPreview() {
        this.generateXml();
        this.currentTab = 'preview';
    }
}
