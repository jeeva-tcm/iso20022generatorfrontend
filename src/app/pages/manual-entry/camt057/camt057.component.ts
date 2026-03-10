import { CommonModule } from '@angular/common';
import { Component, OnInit, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ConfigService } from '../../../services/config.service';

@Component({
    selector: 'app-camt057',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule, MatIconModule, MatSnackBarModule, MatTooltipModule],
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
    categoryPurposes: string[] = [];
    purposes: string[] = [];

    agentPrefixes = ['dbtr', 'dbtrAgt', 'cdtr', 'cdtrAgt'];

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
            this.updateClearingSystemValidation();
            this.generateXml();
        });
    }

    private updateClearingSystemValidation() {
        const systems = this.agentPrefixes.map(p => this.form.get(p + 'ClrSysCd')?.value?.trim()?.toUpperCase());
        const anyT2 = systems.includes('T2');
        const anyCHAPS = systems.includes('CHAPS');
        const currencyCtrl = this.form.get('currency');
        const ccy = currencyCtrl?.value;

        // T2 Validation
        if (anyT2 && ccy !== 'EUR' && ccy !== '') {
            if (!currencyCtrl?.hasError('target2')) {
                currencyCtrl?.setErrors({ ...currencyCtrl.errors, target2: true });
            }
        } else if (currencyCtrl?.hasError('target2')) {
            const errors = { ...currencyCtrl.errors };
            delete errors['target2'];
            currencyCtrl.setErrors(Object.keys(errors).length ? errors : null);
        }

        // CHAPS Validation
        if (anyCHAPS && ccy !== 'GBP' && ccy !== '') {
            if (!currencyCtrl?.hasError('chaps')) {
                currencyCtrl?.setErrors({ ...currencyCtrl.errors, chaps: true });
            }
        } else if (currencyCtrl?.hasError('chaps')) {
            const errors = { ...currencyCtrl.errors };
            delete errors['chaps'];
            currencyCtrl.setErrors(Object.keys(errors).length ? errors : null);
        }
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

        this.http.get<any>(this.config.getApiUrl('/codelists/ctgyPurp')).subscribe({
            next: (res) => { if (res && res.codes) this.categoryPurposes = res.codes; },
            error: (err) => console.error('Failed to load category purposes', err)
        });
        this.http.get<any>(this.config.getApiUrl('/codelists/purp')).subscribe({
            next: (res) => { if (res && res.codes) this.purposes = res.codes; },
            error: (err) => console.error('Failed to load purposes', err)
        });

    }

    private buildForm() {
        const BIC = [Validators.pattern(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)];
        const BIC_REQ = [Validators.required, ...BIC];

        this.form = this.fb.group({
            purpCd: [''], ctgyPurpCd: [''],

            rmtInfType: ['none'],
            rmtInfUstrd: ['', Validators.maxLength(140)],
            rmtInfStrdCdtrRefType: [''],
            rmtInfStrdCdtrRef: ['', Validators.maxLength(35)],
            rmtInfStrdAddtlRmtInf: ['', Validators.maxLength(140)],

            fromBic: ['RECVUS33XXX', BIC_REQ],
            toBic: ['SENDGB2LXXX', BIC_REQ],
            bizMsgId: ['B-2026-N-001', [Validators.required, Validators.maxLength(35)]],
            msgId: ['NTF-2026-001', [Validators.required, Validators.maxLength(35)]],
            bizSvc: ['swift.cbprplus.01', [Validators.required, Validators.maxLength(35)]],
            creDtTm: [this.isoNow(), Validators.required],

            ntfctnId: ['ID-057-001', [Validators.required, Validators.maxLength(35)]],
            acctIban: ['GB33RECV1234567890', [Validators.required, Validators.pattern(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/)]],
            acctOwnrName: ['Global Receiver Corp', Validators.maxLength(140)], // Optional in CBPR+

            itmId: ['ITEM-001', [Validators.required, Validators.maxLength(35)]],
            amount: ['5000.00', [Validators.required, Validators.pattern(/^\d{1,13}(\.\d{1,5})?$/)]],
            currency: ['USD', Validators.required],
            valDt: [new Date().toISOString().split('T')[0], Validators.required],

            // Optional but commonly used
            endToEndId: ['E2E-057-001', Validators.maxLength(35)],
            uetr: ['550e8400-e29b-41d4-a716-446655440001', [Validators.pattern(/^[0-9a-fA-F\-]{36}$/)]],
        });

        // Add agents
        const BIC_OPT = [Validators.pattern(/^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/)];
        // Safe character set: letters, digits, space, . , ( ) ' - only. No & @ ! # $ etc.
        const SAFE_NAME = Validators.pattern(/^[a-zA-Z0-9 .,()'\-]+$/);
        this.agentPrefixes.forEach(p => {
            this.form.addControl(p + 'Name', this.fb.control('', [Validators.maxLength(140), SAFE_NAME]));
            this.form.addControl(p + 'Bic', this.fb.control('', BIC_OPT));
            this.form.addControl(p + 'Lei', this.fb.control('', Validators.pattern(/^[A-Z0-9]{18}[0-9]{2}$/)));
            this.form.addControl(p + 'ClrSysCd', this.fb.control('', Validators.maxLength(4)));
            this.form.addControl(p + 'ClrSysMmbId', this.fb.control('', Validators.maxLength(35)));
            this.form.addControl(p + 'Acct', this.fb.control('', Validators.maxLength(34)));

            // Address fields
            this.form.addControl(p + 'AddrType', this.fb.control('none'));
            this.form.addControl(p + 'Dept', this.fb.control(''));
            this.form.addControl(p + 'SubDept', this.fb.control(''));
            this.form.addControl(p + 'StrtNm', this.fb.control(''));
            this.form.addControl(p + 'BldgNb', this.fb.control(''));
            this.form.addControl(p + 'BldgNm', this.fb.control(''));
            this.form.addControl(p + 'Flr', this.fb.control(''));
            this.form.addControl(p + 'PstBx', this.fb.control(''));
            this.form.addControl(p + 'Room', this.fb.control(''));
            this.form.addControl(p + 'PstCd', this.fb.control(''));
            this.form.addControl(p + 'TwnNm', this.fb.control(''));
            this.form.addControl(p + 'CtrySubDvsn', this.fb.control(''));
            this.form.addControl(p + 'Ctry', this.fb.control('', Validators.pattern(/^[A-Z]{2}$/)));
            this.form.addControl(p + 'AdrLine1', this.fb.control(''));
            this.form.addControl(p + 'AdrLine2', this.fb.control(''));
        });

        // Set Default Dbtr
        this.form.patchValue({ dbtrName: 'Sender Bank Ltd', dbtrBic: 'SENDBK55XXX' });
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
            if (f.toLowerCase().includes('name') || f.toLowerCase().includes('nm')) return "Invalid characters. Only letters, numbers, spaces and . , ( ) ' - are allowed (no &, @, !, etc.)";
        }
        if (c.errors?.['target2']) return 'TARGET2 payments must use EUR as the settlement currency.';
        if (c.errors?.['chaps']) return 'Invalid Currency for CHAPS clearing system. When ClrSysId/Cd = CHAPS, the transaction currency must be GBP.';
        return 'Invalid value.';
    }
    warningTimeouts: { [key: string]: any } = {};
    showMaxLenWarning: { [key: string]: boolean } = {};

    @HostListener('keydown', ['$event'])
    onKeydown(event: KeyboardEvent) {
        const target = event.target as HTMLInputElement;
        if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;
        const maxLen = target.maxLength;
        if (maxLen && maxLen > 0 && target.value && target.value.toString().length >= maxLen) {
            if (target.selectionStart !== null && target.selectionStart !== target.selectionEnd) return;
            if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
                const controlName = target.getAttribute('formControlName') || target.getAttribute('name');
                if (controlName) {
                    this.showMaxLenWarning[controlName] = true;
                    if (this.warningTimeouts[controlName]) {
                        clearTimeout(this.warningTimeouts[controlName]);
                    }
                    this.warningTimeouts[controlName] = setTimeout(() => {
                        this.showMaxLenWarning[controlName] = false;
                    }, 3000);
                }
            }
        }
    }

    hint(f: string, maxLen: number): string | null {
        if (!this.showMaxLenWarning[f]) return null;
        const c = this.form.get(f);
        if (!c || !c.value) return null;
        const len = c.value.toString().length;
        if (len >= maxLen) {
            return `Maximum ${maxLen} characters reached (${len}/${maxLen})`;
        }
        return null;
    }


    isoNow(): string {
        const d = new Date(), p = (n: number) => n.toString().padStart(2, '0');
        const off = -d.getTimezoneOffset(), s = off >= 0 ? '+' : '-';
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${s}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
    }

    generateXml() {
        if (this.isParsingXml) return;

        // Stop generation if TARGET2 rule is violated
        if (this.form.get('currency')?.hasError('target2')) {

            this.generatedXml = '<!-- TARGET2 VALIDATION ERROR: TARGET2 payments must use EUR as the settlement currency. -->';
            this.onEditorChange(this.generatedXml, true);
            return;
        }

        // Stop generation if CHAPS rule is violated
        if (this.form.get('currency')?.hasError('chaps')) {

            this.generatedXml = '<!-- CHAPS VALIDATION ERROR: Invalid Currency for CHAPS clearing system. When ClrSysId/Cd = CHAPS, the transaction currency must be GBP. -->';
            this.onEditorChange(this.generatedXml, true);
            return;
        }

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

        // Parties & Agents correctly formatted
        itmXml += this.partyAgentXml('Dbtr', 'dbtr', v, 5);
        itmXml += this.agt('DbtrAgt', 'dbtrAgt', v, 5);
        itmXml += this.agt('CdtrAgt', 'cdtrAgt', v, 5);
        itmXml += this.partyAgentXml('Cdtr', 'cdtr', v, 5);

        if (v.purpCd?.trim()) itmXml += `					<Purp>
						<Cd>${this.e(v.purpCd)}</Cd>
					</Purp>
`;
        itmXml += `\t\t\t\t</Itm>`;


        this.generatedXml = `<?xml version="1.0" encoding="UTF-8"?>
<BusMsgEnvlp xmlns="urn:swift:xsd:envelope">
	<AppHdr xmlns="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
		<Fr><FIId><FinInstnId><BICFI>${this.e(v.fromBic)}</BICFI></FinInstnId></FIId></Fr>
		<To><FIId><FinInstnId><BICFI>${this.e(v.toBic)}</BICFI></FinInstnId></FIId></To>
		<BizMsgIdr>${this.e(v.bizMsgId)}</BizMsgIdr>
		<MsgDefIdr>camt.057.001.06</MsgDefIdr>
		<BizSvc>${this.e(v.bizSvc)}</BizSvc>
		<CreDt>${creDtTm}</CreDt>
	</AppHdr>
	<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.057.001.06">
		<NtfctnToRcv>
			<GrpHdr>
				<MsgId>${this.e(v.msgId)}</MsgId>
				<CreDtTm>${creDtTm}</CreDtTm>
			</GrpHdr>
			<Ntfctn>
				<Id>${this.e(v.ntfctnId)}</Id>
${acctXml}
${itmXml}
			</Ntfctn>
		</NtfctnToRcv>
	</Document>
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

                const parseAgent = (tag: string, prefix: string) => {
                    const node = itm.getElementsByTagName(tag)[0];
                    if (!node) return;
                    if (tag === 'Dbtr' || tag === 'Cdtr') {
                        const pty = node.getElementsByTagName('Pty')[0];
                        if (pty) {
                            setVal(prefix + 'Name', pty.getElementsByTagName('Nm')[0]?.textContent || '');
                            const id = pty.getElementsByTagName('Id')[0];
                            if (id) {
                                setVal(prefix + 'Bic', id.getElementsByTagName('AnyBIC')[0]?.textContent || '');
                                setVal(prefix + 'Lei', id.getElementsByTagName('LEI')[0]?.textContent || '');
                                const othr = id.getElementsByTagName('Othr')[0];
                                if (othr) {
                                    setVal(prefix + 'ClrSysMmbId', othr.getElementsByTagName('Id')[0]?.textContent || '');
                                    setVal(prefix + 'ClrSysCd', othr.getElementsByTagName('Cd')[0]?.textContent || '');
                                }
                            }
                        }
                    } else {
                        const finId = node.getElementsByTagName('FinInstnId')[0];
                        if (finId) {
                            setVal(prefix + 'Bic', finId.getElementsByTagName('BICFI')[0]?.textContent || '');
                            setVal(prefix + 'Name', finId.getElementsByTagName('Nm')[0]?.textContent || '');
                            setVal(prefix + 'Lei', finId.getElementsByTagName('LEI')[0]?.textContent || '');
                            const clr = finId.getElementsByTagName('ClrSysMmbId')[0];
                            if (clr) {
                                setVal(prefix + 'ClrSysMmbId', clr.getElementsByTagName('MmbId')[0]?.textContent || '');
                                setVal(prefix + 'ClrSysCd', clr.getElementsByTagName('Cd')[0]?.textContent || '');
                            }
                        }
                    }
                };
                parseAgent('Dbtr', 'dbtr');
                parseAgent('DbtrAgt', 'dbtrAgt');
                parseAgent('Cdtr', 'cdtr');
                parseAgent('CdtrAgt', 'cdtrAgt');
            } else {
                ['itmId', 'endToEndId', 'uetr', 'amount', 'currency', 'valDt'].forEach(f => setVal(f, ''));
                this.agentPrefixes.forEach(p => {
                    setVal(p + 'Bic', '');
                    setVal(p + 'Name', '');
                    setVal(p + 'Lei', '');
                    setVal(p + 'ClrSysCd', '');
                    setVal(p + 'ClrSysMmbId', '');
                    setVal(p + 'Acct', '');
                });
            }

            const tryTag = (parent: string, child: string) => {
                const p = doc.getElementsByTagName(parent)[0];
                return p ? (p.getElementsByTagName(child)[0]?.textContent || '') : '';
            };
            setVal('fromBic', tryTag('Fr', 'BICFI'));
            setVal('toBic', tryTag('To', 'BICFI'));

            const creDtTm = doc.getElementsByTagName('CreDtTm')[0] || doc.getElementsByTagName('CreDt')[0];
            setVal('creDtTm', creDtTm ? (creDtTm.textContent || '') : '');


            setVal('purpCd', tryTag('Purp', 'Cd') || tval('Purp'));
            setVal('ctgyPurpCd', tryTag('CtgyPurp', 'Cd') || tval('CtgyPurp'));
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
    private tabs(n: number) { return '\t'.repeat(n); }

    agt(tag: string, prefix: string, v: any, indent = 3) {
        const bic = v[prefix + 'Bic'];
        const name = v[prefix + 'Name'];
        const lei = v[prefix + 'Lei'];
        const clrCd = v[prefix + 'ClrSysCd'];
        const clrMmb = v[prefix + 'ClrSysMmbId'];

        if (!bic && !name && !lei && !clrMmb) return '';

        let content = '';
        if (bic) content += `${this.tabs(indent + 2)}<BICFI>${this.e(bic)}</BICFI>\n`;
        if (clrMmb) {
            content += `${this.tabs(indent + 2)}<ClrSysMmbId>\n`;
            if (clrCd) content += `${this.tabs(indent + 3)}<ClrSysId>\n${this.tabs(indent + 4)}<Cd>${this.e(clrCd)}</Cd>\n${this.tabs(indent + 3)}</ClrSysId>\n`;
            content += `${this.tabs(indent + 3)}<MmbId>${this.e(clrMmb)}</MmbId>\n`;
            content += `${this.tabs(indent + 2)}</ClrSysMmbId>\n`;
        }
        if (name) content += `${this.tabs(indent + 2)}<Nm>${this.e(name)}</Nm>\n`;
        content += this.addrXml(v, prefix, indent + 2);
        if (lei) content += `${this.tabs(indent + 2)}<LEI>${this.e(lei)}</LEI>\n`;

        return `${this.tabs(indent)}<${tag}>\n${this.tabs(indent + 1)}<FinInstnId>\n${content}${this.tabs(indent + 1)}</FinInstnId>\n${this.tabs(indent)}</${tag}>\n`;
    }

    partyAgentXml(tag: string, prefix: string, v: any, indent = 4) {
        const bic = v[prefix + 'Bic'];
        const name = v[prefix + 'Name'];
        const lei = v[prefix + 'Lei'];
        const clrCd = v[prefix + 'ClrSysCd'];
        const clrMmb = v[prefix + 'ClrSysMmbId'];

        if (!bic && !name && !lei && !clrMmb && v[prefix + 'AddrType'] === 'none') return '';

        let content = '';
        if (name) content += `${this.tabs(indent + 1)}<Nm>${this.e(name)}</Nm>\n`;
        content += this.addrXml(v, prefix, indent + 1);

        let org = '';
        if (bic) org += `${this.tabs(indent + 3)}<AnyBIC>${this.e(bic)}</AnyBIC>\n`;
        if (lei) org += `${this.tabs(indent + 3)}<LEI>${this.e(lei)}</LEI>\n`;
        if (clrMmb) {
            org += `${this.tabs(indent + 3)}<Othr>\n${this.tabs(indent + 4)}<Id>${this.e(clrMmb)}</Id>\n`;
            if (clrCd) {
                org += `${this.tabs(indent + 4)}<SchmeNm>\n${this.tabs(indent + 5)}<Cd>${this.e(clrCd)}</Cd>\n${this.tabs(indent + 4)}</SchmeNm>\n`;
            }
            org += `${this.tabs(indent + 3)}</Othr>\n`;
        }

        if (org) {
            content += `${this.tabs(indent + 1)}<Id>\n${this.tabs(indent + 2)}<OrgId>\n${org}${this.tabs(indent + 2)}</OrgId>\n${this.tabs(indent + 1)}</Id>\n`;
        }

        return `${this.tabs(indent)}<${tag}>\n${content}${this.tabs(indent)}</${tag}>\n`;
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
            message_type: 'camt.057.001.06',
            store_in_history: true
        }).subscribe({
            next: (data: any) => {
                this.validationReport = data;
                this.validationStatus = 'done';
            },
            error: (err) => {
                this.validationReport = {
                    status: 'FAIL', errors: 1, warnings: 0,
                    message: 'camt.057.001.06', total_time_ms: 0,
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

    // Validation Modal State
    showValidationModal = false;
    validationStatus: 'idle' | 'validating' | 'done' = 'idle';
    validationReport: any = null;
    validationExpandedIssue: any = null;

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


    viewXmlModal() {
        this.closeValidationModal();
        this.switchToPreview();
    }

    editXmlModal() {
        this.closeValidationModal();
        this.currentTab = 'form';
    }

    runValidationModal() {
        this.validateMessage();
    }
}
