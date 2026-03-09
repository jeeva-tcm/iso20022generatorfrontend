import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfigService } from '../../services/config.service';

@Component({
    selector: 'app-mt-to-mx',
    standalone: true,
    imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule, MatTooltipModule],
    templateUrl: './mt-to-mx.component.html',
    styleUrl: './mt-to-mx.component.css'
})
export class MtToMxComponent implements OnInit {
    mtInput = '';
    mxOutput = '';
    editorLineCount: number[] = [1];
    outputLineCount: number[] = [1];
    detectedMtType = '';
    mappedMxType = '';
    conversionStatus: 'idle' | 'converting' | 'success' | 'error' = 'idle';
    errorMessage = '';
    showValidationSummary = false;
    missingFields: { tag: string, name: string, line?: number | string }[] = [];
    conversionLog: { severity: string; message: string }[] = [];
    conversionErrors: string[] = [];
    activeFieldGuide: any = null;

    // Field reference metadata for UI display
    private fieldGuides: Record<string, any[]> = {
        'MT103': [
            { tag: '20', name: 'Sender\'s Reference', mandatory: true, desc: 'Your unique identifier' },
            { tag: '23B', name: 'Bank Operation Code', mandatory: true, desc: 'Usually CRED' },
            { tag: '32A', name: 'Value Date/Currency/Amount', mandatory: true, desc: 'e.g. 250308USD10000,' },
            { tag: '50A/K', name: 'Ordering Customer', mandatory: true, desc: 'Sender details' },
            { tag: '59', name: 'Beneficiary Customer', mandatory: true, desc: 'Receiver details' },
            { tag: '71A', name: 'Details of Charges', mandatory: true, desc: 'SHA / OUR / BEN' }
        ],
        'MT103+': [
            { tag: '20', name: 'Sender\'s Reference', mandatory: true, desc: 'Unique identification' },
            { tag: '23B', name: 'Bank Operation Code', mandatory: true, desc: 'Must be CRED' },
            { tag: '32A', name: 'Value Date/Currency/Amount', mandatory: true, desc: 'Payment details' },
            { tag: '50A', name: 'Ordering Institution', mandatory: true, desc: 'Must be BIC identified' },
            { tag: '59A', name: 'Beneficiary Institution', mandatory: true, desc: 'Must be BIC identified' },
            { tag: '71A', name: 'Details of Charges', mandatory: true, desc: 'SHA / OUR / BEN' }
        ],
        'MT202': [
            { tag: '20', name: 'Transaction Reference', mandatory: true, desc: 'Sender ID' },
            { tag: '21', name: 'Related Reference', mandatory: true, desc: 'Original txn reference' },
            { tag: '32A', name: 'Value Date/Currency/Amount', mandatory: true, desc: 'Transfer details' },
            { tag: '58A', name: 'Beneficiary Institution', mandatory: true, desc: 'Final receiving bank' }
        ],
        'MT900': [
            { tag: '20', name: 'Transaction Reference', mandatory: true, desc: 'Debit reference' },
            { tag: '25', name: 'Account Identification', mandatory: true, desc: 'Account getting debited' },
            { tag: '32A', name: 'Value Date/Currency/Amount', mandatory: true, desc: 'Debit amount' }
        ],
        'MT910': [
            { tag: '20', name: 'Transaction Reference', mandatory: true, desc: 'Credit reference' },
            { tag: '25', name: 'Account Identification', mandatory: true, desc: 'Account getting credited' },
            { tag: '32A', name: 'Value Date/Currency/Amount', mandatory: true, desc: 'Credit amount' }
        ],
        'MT196': [
            { tag: '20', name: 'Transaction Reference', mandatory: true, desc: 'Your resolution ID' },
            { tag: '21', name: 'Related Reference', mandatory: true, desc: 'Original Request ID' },
            { tag: '79', name: 'Narrative (Resolution)', mandatory: true, desc: 'The actual answer' }
        ],
        'MT192': [
            { tag: '20', name: 'Transaction Reference', mandatory: true, desc: 'Cancellation ID' },
            { tag: '21', name: 'Related Reference', mandatory: true, desc: 'Message to cancel' },
            { tag: '11S', name: 'Original Message Header', mandatory: true, desc: 'Context of MT to cancel' }
        ],
        'MT940': [
            { tag: '20', name: 'Transaction Reference', mandatory: true, desc: 'Statement ID' },
            { tag: '25', name: 'Account Identification', mandatory: true, desc: 'Account for statement' },
            { tag: '28C', name: 'Statement/Sequence Number', mandatory: true, desc: 'e.g. 1/1' },
            { tag: '60F', name: 'Opening Balance', mandatory: true, desc: 'Starting funds' },
            { tag: '62F', name: 'Closing Balance', mandatory: true, desc: 'Ending funds' }
        ]
    };

    // Validation modal state
    showValidationModal = false;
    validationStatus: 'idle' | 'validating' | 'done' = 'idle';
    validationReport: any = null;
    validationExpandedIssue: any = null;

    // MT type to MX type mapping per SWIFT ISO 20022 migration
    private mtToMxMap: Record<string, { mx: string; desc: string }> = {
        'MT103': { mx: 'pacs.008.001.08', desc: 'FI to FI Customer Credit Transfer' },
        'MT103+': { mx: 'pacs.008.001.08', desc: 'FI to FI Customer Credit Transfer (STP)' },
        'MT103 REMIT': { mx: 'pacs.008.001.08', desc: 'FI to FI Customer Credit Transfer (Remit)' },
        'MT202': { mx: 'pacs.009.001.08', desc: 'FI to FI Institution Credit Transfer' },
        'MT202COV': { mx: 'pacs.009.001.08', desc: 'FI to FI Institution Credit Transfer (COV)' },
        'MT200': { mx: 'pacs.009.001.08', desc: 'Financial Institution Transfer' },
        'MT900': { mx: 'camt.054.001.08', desc: 'Debit Confirmation' },
        'MT910': { mx: 'camt.054.001.08', desc: 'Credit Confirmation' },
        'MT940': { mx: 'camt.053.001.08', desc: 'Customer Statement' },
        'MT950': { mx: 'camt.053.001.08', desc: 'Statement Message' },
        'MT942': { mx: 'camt.052.001.08', desc: 'Interim Transaction Report' },
        'MT199': { mx: 'pacs.002.001.10', desc: 'Free Format Message (FI)' },
        'MT299': { mx: 'pacs.002.001.10', desc: 'Free Format Message (FI)' },
        'MT192': { mx: 'camt.056.001.08', desc: 'Request for Cancellation' },
        'MT196': { mx: 'camt.029.001.09', desc: 'Resolution of Investigation' },
        'MT210': { mx: 'camt.057.001.06', desc: 'Notice to Receive' },
    };

    @ViewChild('mtEditor') mtEditorRef!: ElementRef<HTMLTextAreaElement>;
    @ViewChild('mtLineNumbers') mtLineNumbersRef!: ElementRef<HTMLDivElement>;
    @ViewChild('mxEditor') mxEditorRef!: ElementRef<HTMLTextAreaElement>;
    @ViewChild('mxLineNumbers') mxLineNumbersRef!: ElementRef<HTMLDivElement>;

    constructor(
        private snackBar: MatSnackBar,
        private http: HttpClient,
        private config: ConfigService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        // Start empty so XML is not shown by default
        this.mtInput = '';
        this.mxOutput = '';
        this.conversionStatus = 'idle';
        this.updateLineCount('mt');
        this.updateLineCount('mx');
    }

    onMtChange(value: string) {
        this.mtInput = value;
        this.errorMessage = '';
        const detected = this.detectMtType(value);
        if (detected) {
            this.detectedMtType = detected;
            const cleanType = detected.replace('MT', '');
            const mapping = this.mtToMxMap[detected] || this.mtToMxMap[cleanType];
            this.mappedMxType = mapping ? mapping.mx : 'Unknown';
        } else {
            this.detectedMtType = '';
            this.mappedMxType = '';
        }
        this.activeFieldGuide = null; // Don't show guide proactively
        this.updateLineCount('mt');
        // Reset output when input changes - XML should only show after explicit click
        this.mxOutput = '';
        this.conversionStatus = 'idle';
        this.conversionLog = [];
        this.conversionErrors = [];
        this.missingFields = [];
        this.errorMessage = '';
    }

    onMxChange(content: string) {
        this.mxOutput = content;
        this.updateLineCount('mx');
    }

    updateLineCount(which: 'mt' | 'mx') {
        const content = which === 'mt' ? this.mtInput : this.mxOutput;
        const lines = (content || '').split('\n').length;
        if (which === 'mt') {
            this.editorLineCount = Array.from({ length: lines }, (_, i) => i + 1);
        } else {
            this.outputLineCount = Array.from({ length: lines }, (_, i) => i + 1);
        }
    }

    syncScroll(editor: HTMLTextAreaElement, gutter: HTMLDivElement) {
        gutter.scrollTop = editor.scrollTop;
    }

    detectMtType(mt: string): string {
        if (!mt?.trim()) return '';

        // 1. Check for explicit SWIFT headers first (most reliable)
        const appMatch = mt.match(/\{2:[IO](\d{3})/);
        if (appMatch) {
            const type = 'MT' + appMatch[1];
            // Check for subtypes in Block 3 or Body
            if (type === 'MT202' && (mt.includes('{119:COV}') || mt.includes(':119:COV'))) return 'MT202COV';
            if (type === 'MT103' && (mt.includes('{119:STP}') || mt.includes(':119:STP'))) return 'MT103+';
            if (type === 'MT103' && (mt.includes('{119:REMIT}') || mt.includes(':119:REMIT') || mt.includes(':77T:'))) return 'MT103 REMIT';
            return type;
        }

        // 2. Fallback Heuristics for headerless messages (Block 4 only)
        if (mt.includes(':20:')) {
            if (mt.includes(':119:COV')) return 'MT202COV';
            if (mt.includes(':119:STP')) return 'MT103+';

            // Statement/Report types
            if (mt.includes(':25:')) {
                if (mt.includes(':13D:') || mt.includes(':34F:')) return 'MT942'; // Report
                if (mt.includes(':60F:') || mt.includes(':62F:')) {
                    if (mt.includes(':28C:')) return 'MT940';
                    return 'MT950';
                }
                if (mt.includes(':32A:')) return 'MT900'; // Debit
            }

            // Transaction types
            if (mt.includes(':23B:')) return 'MT103';
            if (mt.includes(':32B:') && mt.includes(':30:')) return 'MT210';
            if (mt.includes(':59:') || mt.includes(':50K:')) return 'MT103';
            if (mt.includes(':58A:') || mt.includes(':58D:')) return 'MT202';
            if (mt.includes(':21:') && mt.includes(':76:')) return 'MT196';
            if (mt.includes(':21:') && !mt.includes(':32A:')) return 'MT192'; // Cancel
        }
        return '';
    }

    convert() {
        this.conversionStatus = 'converting';
        this.conversionLog = [];
        this.conversionErrors = [];
        this.errorMessage = '';
        this.mxOutput = '';
        this.showValidationSummary = false;

        // Immediate UI refresh to hide old errors
        this.missingFields = [];
        this.cdr.detectChanges();

        const mtType = this.detectMtType(this.mtInput);
        this.detectedMtType = mtType;

        this.addLog('INFO', `Sending MT message to backend conversion engine...`);

        this.http.post<any>(this.config.getApiUrl('/convert-mt-to-mx'), {
            mt_message: this.mtInput,
            target_mt_type: mtType || null
        }).subscribe({
            next: (response) => {
                this.mxOutput = response.mx_message;
                this.updateLineCount('mx');

                // Set the mapped MX type based on the response if available, or fallback
                if (response.detected_type) {
                    const typeValue = String(response.detected_type);
                    this.detectedMtType = typeValue.toUpperCase().startsWith('MT') ? typeValue : ('MT' + typeValue);
                    const mapping = this.mtToMxMap[this.detectedMtType] || this.mtToMxMap[typeValue] || this.mtToMxMap['MT' + typeValue];
                    if (mapping) {
                        this.mappedMxType = mapping.mx;
                    }
                }

                this.conversionStatus = 'success';
                this.validationReport = response.validation_report || null;

                // Only show mandatory fields that are actually MISSING after conversion
                this.activeFieldGuide = this.calculateMissingFields(this.detectedMtType);

                if (response.logs && Array.isArray(response.logs)) {
                    response.logs.forEach((log: string) => this.addLog('INFO', log));
                }
                this.addLog('INFO', `Conversion completed successfully.`);

                // Force a clean slate on success
                this.missingFields = [];
                this.conversionErrors = [];
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.conversionStatus = 'error';
                this.missingFields = [];
                this.validationReport = (err.error?.detail?.validation_report) || null;

                // Show missing fields even on error so user knows what to fix
                this.activeFieldGuide = this.calculateMissingFields(this.detectedMtType);

                if (err.error && err.error.detail && err.error.detail.errors) {
                    const errors = err.error.detail.errors;
                    const logs = err.error.detail.logs;

                    if (logs && Array.isArray(logs)) {
                        logs.forEach(l => this.addLog('INFO', `Backend Log: ${l}`));
                    }

                    this.conversionErrors = errors;
                    this.errorMessage = errors[0];

                    const tagsSeen = new Set<string>();
                    errors.forEach((msg: string) => {
                        this.addLog('ERROR', msg);

                        const match = msg.match(/Missing mandatory field :([^:]+): \(([^)]+)\)/);
                        const emptyMatch = msg.match(/Mandatory field :([^:]+): \(([^)]+)\) is empty/);
                        const dataErrorMatch = msg.match(/Field :([^:]+): \(([^)]+)\) contains invalid data/);

                        if (match || emptyMatch || dataErrorMatch) {
                            const actualMatch = match || emptyMatch || dataErrorMatch;
                            if (actualMatch) {
                                const tag = actualMatch[1];
                                if (!tagsSeen.has(tag)) {
                                    const insertionInfo = this.getLineSuggestion(tag);
                                    this.missingFields.push({
                                        tag,
                                        name: actualMatch[2],
                                        line: insertionInfo.line
                                    });
                                    tagsSeen.add(tag);
                                }
                            }
                        }
                    });
                } else if (err.status === 0) {
                    this.errorMessage = 'Backend connection failed. Please ensure the local server (127.0.0.1:8001) is running.';
                    this.addLog('ERROR', 'Connection Refused: Target backend offline or CORS error.');
                } else {
                    this.errorMessage = err.error?.detail || err.message || 'Server returned an unknown error.';
                    this.addLog('ERROR', this.errorMessage);
                }
            }
        });
    }

    private parseMtFields(mt: string): Record<string, string> {
        const fields: Record<string, string> = {};

        // Parse SWIFT blocks
        const block1Match = mt.match(/\{1:([^}]+)\}/);
        const block2Match = mt.match(/\{2:([^}]+)\}/);
        if (block1Match) {
            fields['_block1'] = block1Match[1];
            const b1 = block1Match[1];
            if (b1.length >= 12) {
                fields['_senderBic'] = b1.substring(3, 11);
            }
        }
        if (block2Match) {
            fields['_block2'] = block2Match[1];
            const b2 = block2Match[1];
            if (b2.startsWith('O') && b2.length >= 18) {
                fields['_receiverBic'] = b2.substring(15, 23) || '';
            } else if (b2.startsWith('I') && b2.length >= 12) {
                fields['_receiverBic'] = b2.substring(4, 12);
            }
        }

        // Parse block 3 for UETR
        const block3Match = mt.match(/\{3:[^}]*\{121:([a-f0-9-]{36})\}/i);
        if (block3Match) fields['_uetr'] = block3Match[1];

        // Parse block 4 tags
        const block4Match = mt.match(/\{4:\s*\n?([\s\S]*?)(?:-\}|\{5:)/);
        const textBlock = block4Match ? block4Match[1] : mt;
        const tagRegex = /:(\d{2}[A-Z]?):([^:]*?)(?=\n:\d{2}[A-Z]?:|$)/gs;
        let m;
        while ((m = tagRegex.exec(textBlock)) !== null) {
            const tag = m[1].trim();
            const val = m[2].trim();
            if (fields[tag]) {
                fields[tag + '_2'] = val;
            } else {
                fields[tag] = val;
            }
        }
        return fields;
    }

    // === MT103 → pacs.008.001.08 ===
    private convertMT103ToPacs008(f: Record<string, string>): string {
        const now = this.isoNow();
        const date = now.split('T')[0];
        const senderBic = this.normalizeSwiftBic(f['_senderBic'] || 'BANKUS33XXX');
        const receiverBic = this.normalizeSwiftBic(f['_receiverBic'] || 'BANKGB2LXXX');
        const msgId = f['20'] || 'MSGID-' + Date.now();
        const instrId = f['20'] || msgId;
        const endToEndId = f['21'] || msgId;
        const uetr = f['_uetr'] || this.generateUUID();

        // Parse amount from :32A:
        const { date: valDate, ccy, amount } = this.parseField32A(f['32A'] || '');
        const sttlmDt = valDate || date;
        const chrgBr = this.mapChargeBearer(f['71A'] || 'SHA');

        // Parse parties
        const dbtr = this.parsePartyField(f['50A'] || f['50K'] || f['50F'] || '');
        const cdtr = this.parsePartyField(f['59'] || f['59A'] || f['59F'] || '');
        const dbtrAgt = this.parseBicField(f['52A'] || f['52D'] || '', senderBic);
        const cdtrAgt = this.parseBicField(f['57A'] || f['57D'] || '', receiverBic);
        const instgAgt = senderBic;
        const instdAgt = receiverBic;

        this.addLog('INFO', `Sender BIC: ${senderBic}, Receiver BIC: ${receiverBic}`);
        this.addLog('INFO', `Amount: ${amount} ${ccy}, Value Date: ${sttlmDt}`);

        return `<?xml version="1.0" encoding="UTF-8"?>
<BusMsgEnvlp xmlns="urn:swift:xsd:envelope">
\t<AppHdr xmlns="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
\t\t<Fr><FIId><FinInstnId><BICFI>${this.esc(instgAgt)}</BICFI></FinInstnId></FIId></Fr>
\t\t<To><FIId><FinInstnId><BICFI>${this.esc(instdAgt)}</BICFI></FinInstnId></FIId></To>
\t\t<BizMsgIdr>${this.esc(msgId)}</BizMsgIdr>
\t\t<MsgDefIdr>pacs.008.001.08</MsgDefIdr>
\t\t<BizSvc>swift.cbprplus.02</BizSvc>
\t\t<CreDt>${now}</CreDt>
\t</AppHdr>
\t<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
\t\t<FIToFICstmrCdtTrf>
\t\t\t<GrpHdr>
\t\t\t\t<MsgId>${this.esc(msgId)}</MsgId>
\t\t\t\t<CreDtTm>${now}</CreDtTm>
\t\t\t\t<NbOfTxs>1</NbOfTxs>
\t\t\t\t<SttlmInf>
\t\t\t\t\t<SttlmMtd>INDA</SttlmMtd>
\t\t\t\t</SttlmInf>
\t\t\t</GrpHdr>
\t\t\t<CdtTrfTxInf>
\t\t\t\t<PmtId>
\t\t\t\t\t<InstrId>${this.esc(instrId)}</InstrId>
\t\t\t\t\t<EndToEndId>${this.esc(endToEndId)}</EndToEndId>
\t\t\t\t\t<TxId>${this.esc(instrId)}</TxId>
\t\t\t\t\t<UETR>${uetr}</UETR>
\t\t\t\t</PmtId>
\t\t\t\t<IntrBkSttlmAmt Ccy="${this.esc(ccy)}">${amount}</IntrBkSttlmAmt>
\t\t\t\t<IntrBkSttlmDt>${sttlmDt}</IntrBkSttlmDt>
\t\t\t\t<ChrgBr>${chrgBr}</ChrgBr>
\t\t\t\t<InstgAgt>
\t\t\t\t\t<FinInstnId>
\t\t\t\t\t\t<BICFI>${this.esc(instgAgt)}</BICFI>
\t\t\t\t\t</FinInstnId>
\t\t\t\t</InstgAgt>
\t\t\t\t<InstdAgt>
\t\t\t\t\t<FinInstnId>
\t\t\t\t\t\t<BICFI>${this.esc(instdAgt)}</BICFI>
\t\t\t\t\t</FinInstnId>
\t\t\t\t</InstdAgt>
\t\t\t\t<Dbtr>
\t\t\t\t\t<Nm>${this.esc(dbtr.name)}</Nm>
\t\t\t\t</Dbtr>${dbtr.iban ? `
\t\t\t\t<DbtrAcct>
\t\t\t\t\t<Id>
\t\t\t\t\t\t<IBAN>${this.esc(dbtr.iban)}</IBAN>
\t\t\t\t\t</Id>
\t\t\t\t</DbtrAcct>` : (dbtr.acct ? `
\t\t\t\t<DbtrAcct>
\t\t\t\t\t<Id>
\t\t\t\t\t\t<Othr>
\t\t\t\t\t\t\t<Id>${this.esc(dbtr.acct)}</Id>
\t\t\t\t\t\t</Othr>
\t\t\t\t\t</Id>
\t\t\t\t</DbtrAcct>` : '')}
\t\t\t\t<DbtrAgt>
\t\t\t\t\t<FinInstnId>
\t\t\t\t\t\t<BICFI>${this.esc(dbtrAgt)}</BICFI>
\t\t\t\t\t</FinInstnId>
\t\t\t\t</DbtrAgt>
\t\t\t\t<CdtrAgt>
\t\t\t\t\t<FinInstnId>
\t\t\t\t\t\t<BICFI>${this.esc(cdtrAgt)}</BICFI>
\t\t\t\t\t</FinInstnId>
\t\t\t\t</CdtrAgt>
\t\t\t\t<Cdtr>
\t\t\t\t\t<Nm>${this.esc(cdtr.name)}</Nm>
\t\t\t\t</Cdtr>${cdtr.iban ? `
\t\t\t\t<CdtrAcct>
\t\t\t\t\t<Id>
\t\t\t\t\t\t<IBAN>${this.esc(cdtr.iban)}</IBAN>
\t\t\t\t\t</Id>
\t\t\t\t</CdtrAcct>` : (cdtr.acct ? `
\t\t\t\t<CdtrAcct>
\t\t\t\t\t<Id>
\t\t\t\t\t\t<Othr>
\t\t\t\t\t\t\t<Id>${this.esc(cdtr.acct)}</Id>
\t\t\t\t\t\t</Othr>
\t\t\t\t\t</Id>
\t\t\t\t</CdtrAcct>` : '')}${f['70'] ? `
\t\t\t\t<RmtInf>
\t\t\t\t\t<Ustrd>${this.esc(f['70'])}</Ustrd>
\t\t\t\t</RmtInf>` : ''}
\t\t\t</CdtTrfTxInf>
\t\t</FIToFICstmrCdtTrf>
\t</Document>
</BusMsgEnvlp>`;
    }

    // === MT202/MT200 → pacs.009.001.08 ===
    private convertMT202ToPacs009(f: Record<string, string>, isCov: boolean): string {
        const now = this.isoNow();
        const senderBic = this.normalizeSwiftBic(f['_senderBic'] || 'BANKUS33XXX');
        const receiverBic = this.normalizeSwiftBic(f['_receiverBic'] || 'BANKGB2LXXX');
        const msgId = f['20'] || 'MSGID-' + Date.now();
        const txRef = f['21'] || msgId;
        const uetr = f['_uetr'] || this.generateUUID();
        const { date: valDate, ccy, amount } = this.parseField32A(f['32A'] || '');
        const sttlmDt = valDate || now.split('T')[0];

        const dbtrBic = this.parseBicField(f['52A'] || f['52D'] || '', senderBic);
        const cdtrBic = this.parseBicField(f['58A'] || f['58D'] || '', receiverBic);
        const sttlmMtd = isCov ? 'COVE' : 'INDA';

        this.addLog('INFO', `Sender: ${senderBic}, Receiver: ${receiverBic}`);
        this.addLog('INFO', `Amount: ${amount} ${ccy}, COV: ${isCov}`);

        let covBlock = '';
        if (isCov) {
            // Parse underlying customer credit transfer fields from sequence B
            const covDbtrName = f['50A'] || f['50K'] || '';
            const covCdtrName = f['59'] || f['59A'] || '';
            const covDbtr = this.parsePartyField(covDbtrName);
            const covCdtr = this.parsePartyField(covCdtrName);
            const covDbtrAgt = this.parseBicField(f['52A_2'] || '', dbtrBic);
            const covCdtrAgt = this.parseBicField(f['57A_2'] || '', cdtrBic);

            covBlock = `
\t\t\t\t<UndrlygCstmrCdtTrf>
\t\t\t\t\t<Dbtr>
\t\t\t\t\t\t<Nm>${this.esc(covDbtr.name || 'Ordering Customer')}</Nm>
\t\t\t\t\t</Dbtr>${covDbtr.iban ? `
\t\t\t\t\t<DbtrAcct>
\t\t\t\t\t\t<Id>
\t\t\t\t\t\t\t<IBAN>${this.esc(covDbtr.iban)}</IBAN>
\t\t\t\t\t\t</Id>
\t\t\t\t\t</DbtrAcct>` : ''}
\t\t\t\t\t<DbtrAgt>
\t\t\t\t\t\t<FinInstnId>
\t\t\t\t\t\t\t<BICFI>${this.esc(covDbtrAgt)}</BICFI>
\t\t\t\t\t\t</FinInstnId>
\t\t\t\t\t</DbtrAgt>
\t\t\t\t\t<CdtrAgt>
\t\t\t\t\t\t<FinInstnId>
\t\t\t\t\t\t\t<BICFI>${this.esc(covCdtrAgt)}</BICFI>
\t\t\t\t\t\t</FinInstnId>
\t\t\t\t\t</CdtrAgt>
\t\t\t\t\t<Cdtr>
\t\t\t\t\t\t<Nm>${this.esc(covCdtr.name || 'Beneficiary Customer')}</Nm>
\t\t\t\t\t</Cdtr>${covCdtr.iban ? `
\t\t\t\t\t<CdtrAcct>
\t\t\t\t\t\t<Id>
\t\t\t\t\t\t\t<IBAN>${this.esc(covCdtr.iban)}</IBAN>
\t\t\t\t\t\t</Id>
\t\t\t\t\t</CdtrAcct>` : ''}
\t\t\t\t\t<InstdAmt Ccy="${this.esc(ccy)}">${amount}</InstdAmt>
\t\t\t\t</UndrlygCstmrCdtTrf>`;
        }

        return `<?xml version="1.0" encoding="UTF-8"?>
<BusMsgEnvlp xmlns="urn:swift:xsd:envelope">
\t<AppHdr xmlns="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
\t\t<Fr><FIId><FinInstnId><BICFI>${this.esc(senderBic)}</BICFI></FinInstnId></FIId></Fr>
\t\t<To><FIId><FinInstnId><BICFI>${this.esc(receiverBic)}</BICFI></FinInstnId></FIId></To>
\t\t<BizMsgIdr>${this.esc(msgId)}</BizMsgIdr>
\t\t<MsgDefIdr>pacs.009.001.08</MsgDefIdr>
\t\t<BizSvc>${isCov ? 'swift.cbprplus.cov.04' : 'swift.cbprplus.02'}</BizSvc>
\t\t<CreDt>${now}</CreDt>
\t</AppHdr>
\t<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08">
\t\t<FICdtTrf>
\t\t\t<GrpHdr>
\t\t\t\t<MsgId>${this.esc(msgId)}</MsgId>
\t\t\t\t<CreDtTm>${now}</CreDtTm>
\t\t\t\t<NbOfTxs>1</NbOfTxs>
\t\t\t\t<SttlmInf>
\t\t\t\t\t<SttlmMtd>${sttlmMtd}</SttlmMtd>
\t\t\t\t</SttlmInf>
\t\t\t</GrpHdr>
\t\t\t<CdtTrfTxInf>
\t\t\t\t<PmtId>
\t\t\t\t\t<InstrId>${this.esc(msgId)}</InstrId>
\t\t\t\t\t<EndToEndId>${this.esc(txRef)}</EndToEndId>
\t\t\t\t\t<UETR>${uetr}</UETR>
\t\t\t\t</PmtId>
\t\t\t\t<IntrBkSttlmAmt Ccy="${this.esc(ccy)}">${amount}</IntrBkSttlmAmt>
\t\t\t\t<IntrBkSttlmDt>${sttlmDt}</IntrBkSttlmDt>
\t\t\t\t<InstgAgt>
\t\t\t\t\t<FinInstnId>
\t\t\t\t\t\t<BICFI>${this.esc(senderBic)}</BICFI>
\t\t\t\t\t</FinInstnId>
\t\t\t\t</InstgAgt>
\t\t\t\t<InstdAgt>
\t\t\t\t\t<FinInstnId>
\t\t\t\t\t\t<BICFI>${this.esc(receiverBic)}</BICFI>
\t\t\t\t\t</FinInstnId>
\t\t\t\t</InstdAgt>
\t\t\t\t<Dbtr>
\t\t\t\t\t<FinInstnId>
\t\t\t\t\t\t<BICFI>${this.esc(dbtrBic)}</BICFI>
\t\t\t\t\t</FinInstnId>
\t\t\t\t</Dbtr>
\t\t\t\t<Cdtr>
\t\t\t\t\t<FinInstnId>
\t\t\t\t\t\t<BICFI>${this.esc(cdtrBic)}</BICFI>
\t\t\t\t\t</FinInstnId>
\t\t\t\t</Cdtr>${covBlock}
\t\t\t</CdtTrfTxInf>
\t\t</FICdtTrf>
\t</Document>
</BusMsgEnvlp>`;
    }

    // === MT210 → camt.057.001.06 ===
    private convertMT210ToCamt057(f: Record<string, string>): string {
        const now = this.isoNow();
        const senderBic = this.normalizeSwiftBic(f['_senderBic'] || 'BANKUS33XXX');
        const receiverBic = this.normalizeSwiftBic(f['_receiverBic'] || 'BANKGB2LXXX');
        const msgId = f['20'] || 'MSGID-' + Date.now();
        const { date: valDate, ccy, amount } = this.parseField32A(f['30'] ? '000000' + f['30'] : (f['32B'] || ''));

        return `<?xml version="1.0" encoding="UTF-8"?>
<BusMsgEnvlp xmlns="urn:swift:xsd:envelope">
\t<AppHdr xmlns="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
\t\t<Fr><FIId><FinInstnId><BICFI>${this.esc(senderBic)}</BICFI></FinInstnId></FIId></Fr>
\t\t<To><FIId><FinInstnId><BICFI>${this.esc(receiverBic)}</BICFI></FinInstnId></FIId></To>
\t\t<BizMsgIdr>${this.esc(msgId)}</BizMsgIdr>
\t\t<MsgDefIdr>camt.057.001.06</MsgDefIdr>
\t\t<BizSvc>swift.cbprplus.02</BizSvc>
\t\t<CreDt>${now}</CreDt>
\t</AppHdr>
\t<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.057.001.06">
\t\t<NtfctnToRcv>
\t\t\t<GrpHdr>
\t\t\t\t<MsgId>${this.esc(msgId)}</MsgId>
\t\t\t\t<CreDtTm>${now}</CreDtTm>
\t\t\t</GrpHdr>
\t\t\t<Ntfctn>
\t\t\t\t<Id>${this.esc(msgId)}</Id>
\t\t\t\t<Itm>
\t\t\t\t\t<Amt Ccy="${this.esc(ccy || 'USD')}">${amount || '0.00'}</Amt>
\t\t\t\t\t<XpctdValDt>${valDate || now.split('T')[0]}</XpctdValDt>
\t\t\t\t</Itm>
\t\t\t</Ntfctn>
\t\t</NtfctnToRcv>
\t</Document>
</BusMsgEnvlp>`;
    }

    // === Generic fallback ===
    private convertGeneric(f: Record<string, string>, mxType: string): string {
        const now = this.isoNow();
        const senderBic = this.normalizeSwiftBic(f['_senderBic'] || 'BANKUS33XXX');
        const receiverBic = this.normalizeSwiftBic(f['_receiverBic'] || 'BANKGB2LXXX');
        const msgId = f['20'] || 'MSGID-' + Date.now();

        this.addLog('WARNING', `Using generic conversion for ${mxType}. Output may need manual adjustment.`);

        return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generic conversion from ${this.detectedMtType} to ${mxType} -->
<!-- Manual review recommended for full compliance -->
<BusMsgEnvlp xmlns="urn:swift:xsd:envelope">
\t<AppHdr xmlns="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
\t\t<Fr><FIId><FinInstnId><BICFI>${this.esc(senderBic)}</BICFI></FinInstnId></FIId></Fr>
\t\t<To><FIId><FinInstnId><BICFI>${this.esc(receiverBic)}</BICFI></FinInstnId></FIId></To>
\t\t<BizMsgIdr>${this.esc(msgId)}</BizMsgIdr>
\t\t<MsgDefIdr>${mxType}</MsgDefIdr>
\t\t<BizSvc>swift.cbprplus.02</BizSvc>
\t\t<CreDt>${now}</CreDt>
\t</AppHdr>
\t<!-- Document body requires manual mapping for ${mxType} -->
</BusMsgEnvlp>`;
    }

    // ─── Helpers ───
    private esc(v: string) { return (v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    private isoNow(): string {
        const d = new Date(), p = (n: number) => n.toString().padStart(2, '0');
        const off = -d.getTimezoneOffset(), s = off >= 0 ? '+' : '-';
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${s}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
    }

    private generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    private normalizeSwiftBic(bic: string): string {
        bic = bic.trim().replace(/\s/g, '');
        if (bic.length === 8) bic += 'XXX';
        return bic.substring(0, 11).toUpperCase();
    }

    private parseField32A(val: string): { date: string; ccy: string; amount: string } {
        // Format: YYMMDDCCCAMOUNT  e.g. 260304USD1500,00
        val = val.trim().replace(/\n/g, '');
        const m = val.match(/^(\d{6})([A-Z]{3})([0-9,.]+)$/);
        if (m) {
            const yy = m[1].substring(0, 2);
            const mm = m[1].substring(2, 4);
            const dd = m[1].substring(4, 6);
            const year = parseInt(yy) > 50 ? '19' + yy : '20' + yy;
            return {
                date: `${year}-${mm}-${dd}`,
                ccy: m[2],
                amount: m[3].replace(',', '.')
            };
        }
        // Try 32B format: CCCAMOUNT
        const m2 = val.match(/^([A-Z]{3})([0-9,.]+)$/);
        if (m2) return { date: '', ccy: m2[1], amount: m2[2].replace(',', '.') };
        return { date: '', ccy: 'USD', amount: '0.00' };
    }

    private mapChargeBearer(mt: string): string {
        const map: Record<string, string> = { 'SHA': 'SHAR', 'BEN': 'CRED', 'OUR': 'DEBT', 'SLV': 'SLEV' };
        return map[mt.trim().toUpperCase()] || 'SHAR';
    }

    private parsePartyField(val: string): { name: string; iban: string; acct: string; bic: string } {
        const lines = val.split('\n').map(l => l.trim()).filter(l => l);
        let name = '', iban = '', acct = '', bic = '';

        for (const line of lines) {
            if (line.startsWith('/')) {
                const id = line.substring(1);
                if (/^[A-Z]{2}\d{2}/.test(id)) iban = id;
                else acct = id;
            } else if (/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}/.test(line) && line.length <= 11) {
                bic = line;
            } else {
                name = name ? name + ' ' + line : line;
            }
        }
        return { name: name || 'Unknown Party', iban, acct, bic };
    }

    private parseBicField(val: string, fallback: string): string {
        const lines = val.split('\n').map(l => l.trim()).filter(l => l);
        for (const line of lines) {
            const clean = line.replace(/^\/[A-Z]+\//, '');
            if (/^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2,5}$/.test(clean)) {
                return this.normalizeSwiftBic(clean);
            }
        }
        return fallback;
    }

    private addLog(severity: string, message: string) {
        this.conversionLog.push({ severity, message });
    }

    // Toolbar actions
    copyMxToClipboard() {
        if (!this.mxOutput?.trim()) return;
        navigator.clipboard.writeText(this.mxOutput).then(() => {
            this.snackBar.open('MX XML copied to clipboard!', 'Close', { duration: 3000, horizontalPosition: 'center', verticalPosition: 'bottom' });
        });
    }

    downloadMx() {
        if (!this.mxOutput?.trim()) return;
        const b = new Blob([this.mxOutput], { type: 'application/xml' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = `${this.mappedMxType || 'mx'}-${Date.now()}.xml`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    validateMx() {
        if (!this.mxOutput?.trim()) return;
        this.showValidationSummary = true;

        // Client-side well-formedness pre-check
        const parser = new DOMParser();
        const doc = parser.parseFromString(this.mxOutput, 'text/xml');
        if (doc.querySelector('parsererror')) {
            this.validationReport = {
                status: 'FAIL', errors: 1, warnings: 0,
                message: this.mappedMxType || 'Unknown',
                total_time_ms: 0,
                layer_status: { '1': { status: '❌', time: 0 } },
                details: [{
                    severity: 'ERROR', layer: 1, code: 'XML_SYNTAX', path: '1',
                    message: 'Malformed XML — invalid structure or unclosed tags.',
                    fix_suggestion: 'Check all tags are properly opened and closed.'
                }]
            };
            this.validationStatus = 'done';
            this.showValidationModal = true;
            return;
        }

        this.validationReport = null;
        this.validationStatus = 'validating';
        this.validationExpandedIssue = null;
        this.showValidationModal = true;

        this.http.post(this.config.getApiUrl('/validate'), {
            xml_content: this.mxOutput,
            mode: 'Full 1-3',
            message_type: this.mappedMxType || 'Auto-detect',
            store_in_history: true
        }).subscribe({
            next: (data: any) => {
                this.validationReport = data;
                this.validationStatus = 'done';
            },
            error: () => {
                this.validationReport = {
                    status: 'FAIL', errors: 1, warnings: 0,
                    message: 'Error', total_time_ms: 0,
                    layer_status: {},
                    details: [{
                        severity: 'ERROR', layer: 0, code: 'BACKEND_ERROR',
                        path: '', message: 'Validation failed — backend not reachable.',
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

    private calculateMissingFields(type: string): any[] {
        if (!type) return [];
        const cleanType = type.startsWith('MT') ? type : 'MT' + type;
        const fullGuide = this.fieldGuides[cleanType] || [];
        if (!fullGuide.length) return [];

        return fullGuide.filter(field => {
            // Support tags like '50A/K' or '52A/D'
            const rawParts = field.tag.split('/');
            const tagsToCheck: string[] = [];

            // Extract base tag (digits) from the first part
            const baseMatch = rawParts[0].match(/^\d+/);
            const base = baseMatch ? baseMatch[0] : '';

            rawParts.forEach((part: string, idx: number) => {
                if (idx === 0) {
                    tagsToCheck.push(part);
                } else if (part.length <= 1 && base) {
                    // Option letter like 'K' in '50A/K'
                    tagsToCheck.push(base + part);
                } else if (part.match(/^[A-Z]$/) && base) {
                    // Option letter
                    tagsToCheck.push(base + part);
                } else {
                    // Full tag
                    tagsToCheck.push(part);
                }
            });

            const found = tagsToCheck.some((t: string) => {
                const escapedTag = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`:${escapedTag}:`, 'i');
                return regex.test(this.mtInput);
            });
            return !found;
        });
    }

    getLayerStatus(k: string): string {
        return this.validationReport?.layer_status?.[k]?.status ?? '';
    }

    getLayerTime(k: string): number {
        return this.validationReport?.layer_status?.[k]?.time ?? 0;
    }

    isLayerPass(k: string) { return this.getLayerStatus(k).includes('✅'); }
    isLayerFail(k: string) { return this.getLayerStatus(k).includes('❌'); }
    isLayerWarn(k: string) {
        const s = this.getLayerStatus(k);
        return s.includes('⚠') || s.includes('WARNING') || s.includes('WARN');
    }

    getValidationIssues(): any[] { return this.validationReport?.details ?? []; }
    getValidationErrors(): any[] { return this.getValidationIssues().filter(i => i.severity === 'ERROR'); }
    getValidationWarnings(): any[] { return this.getValidationIssues().filter(i => i.severity === 'WARNING'); }

    toggleValidationIssue(issue: any) {
        this.validationExpandedIssue = this.validationExpandedIssue === issue ? null : issue;
    }

    copyFix(text: string, e: MouseEvent) {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
            this.snackBar.open('Copied!', '', { duration: 1500 });
        });
    }

    loadSample(eventOrType: any) {
        let type = eventOrType;
        if (eventOrType && eventOrType.target) {
            type = eventOrType.target.value;
        }

        if (type === '#' || !type) {
            this.clearAll();
            return;
        }

        switch (type) {
            case 'MT103': this.mtInput = this.getSampleMT103(); break;
            case 'MT103+': this.mtInput = this.getSampleMT103Plus(); break;
            case 'MT103 REMIT': this.mtInput = this.getSampleMT103Remit(); break;
            case 'MT202': this.mtInput = this.getSampleMT202(); break;
            case 'MT202COV': this.mtInput = this.getSampleMT202COV(); break;
            case 'MT200': this.mtInput = this.getSampleMT200(); break;
            case 'MT210': this.mtInput = this.getSampleMT210(); break;
            case 'MT900': this.mtInput = this.getSampleMT900(); break;
            case 'MT910': this.mtInput = this.getSampleMT910(); break;
            case 'MT940': this.mtInput = this.getSampleMT940(); break;
            case 'MT950': this.mtInput = this.getSampleMT950(); break;
            case 'MT942': this.mtInput = this.getSampleMT942(); break;
            case 'MT199': this.mtInput = this.getSampleMT199(); break;
            case 'MT299': this.mtInput = this.getSampleMT299(); break;
            case 'MT192': this.mtInput = this.getSampleMT192(); break;
            case 'MT196': this.mtInput = this.getSampleMT196(); break;
            default: this.mtInput = this.getGenericSample(type);
        }
        this.onMtChange(this.mtInput);
        this.syncScroll(this.mtEditorRef.nativeElement, this.mtLineNumbersRef.nativeElement);
    }

    clearAll() {
        this.mtInput = '';
        this.mxOutput = '';
        this.detectedMtType = '';
        this.mappedMxType = '';
        this.conversionStatus = 'idle';
        this.conversionLog = [];
        this.errorMessage = '';
        this.conversionErrors = [];
        this.missingFields = [];
        this.updateLineCount('mt');
        this.updateLineCount('mx');
    }

    // Sample messages
    private getGenericSample(type: string): string {
        const cleanType = type.replace('MT', '').replace('+', '').replace(' REMIT', '').replace('COV', '');
        return `{1:F01BBBBUS33AXXX0000000000}{2:I${cleanType}CCCCGB2LXXXXN}{3:{121:${this.generateUUID()}}}{4:
:20:REF${Date.now()}
:32A:261231USD1500,00
:50K:/US33XXX12345678901234
GENERIC SENDER INC
NEW YORK US
:59:/GB29NWBK60161331926819
GENERIC RECEIVER LTD
LONDON GB
:71A:SHA
-}`;
    }

    private getSampleMT103(): string {
        return `{1:F01BBBBUS33AXXX0000000000}{2:I103CCCCGB2LXXXXN}{3:{121:550e8400-e29b-41d4-a716-446655440000}}{4:
:20:REF20261231001
:23B:CRED
:32A:261231USD1500,00
:50K:/US33XXX12345678901234
JOHN DOE CORP
123 MAIN STREET
NEW YORK US
:52A:BBBBUS33XXX
:53A:BBBBUS33XXX
:57A:CCCCGB2LXXX
:59:/GB29NWBK60161331926819
JANE SMITH LTD
456 HIGH STREET
LONDON GB
:70:PAYMENT FOR INVOICE 12345
:71A:SHA
-}`;
    }

    private getSampleMT202(): string {
        return `{1:F01BBBBUS33AXXX0000000000}{2:I202CCCCGB2LXXXXN}{3:{121:660e8400-e29b-41d4-a716-446655440000}}{4:
:20:REF20261231002
:21:E2E-FI-001
:32A:261231EUR50000,00
:52A:BBBBUS33XXX
:58A:CCCCGB2LXXX
-}`;
    }

    private getSampleMT202COV(): string {
        return `{1:F01RBOSGB2LAXXX0000000000}{2:I202NDEAFIHHXXXXN}{3:{121:8a562c67-ca16-48ba-b074-65581be6f001}}{4:
:20:REF20261231003
:21:E2E-COV-001
:32A:261231EUR1500000,00
:52A:RBOSGB2LXXX
:58A:OKOYFIHH
:119:COV
:50K:/R85236974
A DEBITER
:59:/O96325478
Z KREDITER
-}`;
    }

    private getSampleMT103Plus(): string {
        return `{1:F01BBBBUS33AXXX0000000000}{2:I103CCCCGB2LXXXXN}{3:{121:550e8400-e29b-41d4-a716-446655447777}{119:STP}}{4:
:20:REF103STP001
:23B:CRED
:32A:261231USD2500,00
:50K:/US33XXX12345678901234
STP SENDER CORP
NEW YORK US
:59:/GB29NWBK60161331926819
STP RECEIVER LTD
LONDON GB
:71A:SHA
-}`;
    }

    private getSampleMT103Remit(): string {
        return `{1:F01BBBBUS33AXXX0000000000}{2:I103CCCCGB2LXXXXN}{3:{121:550e8400-e29b-41d4-a716-446655448888}}{4:
:20:REF103REMIT001
:32A:261231USD3500,00
:50K:/US33XXX12345678901234
REMIT SENDER CORP
NEW YORK US
:59:/GB29NWBK60161331926819
REMIT RECEIVER LTD
LONDON GB
:71A:SHA
:77T:REMITTANCE DATA
-}`;
    }

    private getSampleMT200(): string {
        return `{1:F01BBBBUS33AXXX0000000000}{2:I200CCCCGB2LXXXXN}{3:{121:200e8400-e29b-41d4-a716-446655440000}}{4:
:20:REF200001
:32A:261231USD10000,00
:53A:BBBBUS33XXX
-}`;
    }

    private getSampleMT210(): string {
        return `{1:F01BBBBUS33AXXX0000000000}{2:I210CCCCGB2LXXXXN}{3:{121:210e8400-e29b-41d4-a716-446655440000}}{4:
:20:REF210001
:25:ACCT123456
:30:261231
:32B:USD5000,00
-}`;
    }

    private getSampleMT900(): string {
        return `{1:F01BBBBUS33AXXX0000000000}{2:I900CCCCGB2LXXXXN}{3:{121:900e8400-e29b-41d4-a716-446655440000}}{4:
:20:REF900001
:25:ACCT123456
:32A:261231USD500,00
-}`;
    }

    private getSampleMT910(): string {
        return `{1:F01BBBBUS33AXXX0000000000}{2:I910CCCCGB2LXXXXN}{3:{121:910e8400-e29b-41d4-a716-446655440000}}{4:
:20:REF910001
:25:ACCT123456
:32A:261231USD750,00
-}`;
    }

    private getSampleMT940(): string {
        return `{1:F01BBBBUS33AXXX0000000000}{2:I940CCCCGB2LXXXXN}{3:{121:940e8400-e29b-41d4-a716-446655440000}}{4:
:20:REF940001
:25:ACCT123456
:28C:1/1
:60F:C261231USD1000,00
:62F:C261231USD1500,00
-}`;
    }

    private getSampleMT950(): string {
        return `{1:F01BBBBUS33AXXX0000000000}{2:I950CCCCGB2LXXXXN}{3:{121:950e8400-e29b-41d4-a716-446655440000}}{4:
:20:REF950001
:25:ACCT123456
:28C:2/1
:60F:C261231USD2000,00
:62F:C261231USD2500,00
-}`;
    }

    private getSampleMT942(): string {
        return `{1:F01BBBBUS33AXXX0000000000}{2:I942CCCCGB2LXXXXN}{3:{121:942e8400-e29b-41d4-a716-446655440000}}{4:
:20:REF942001
:25:ACCT123456
:13D:2309151200+0500
:34F:USD0,00
-}`;
    }

    private getSampleMT199(): string {
        return `{1:F01BBBBUS33AXXX0000000000}{2:I199CCCCGB2LXXXXN}{3:{121:199e8400-e29b-41d4-a716-446655440000}}{4:
:20:REF199001
:21:RELREF778899
:79:THIS IS A TEST NARRATIVE MESSAGE FOR MT199.
-}`;
    }

    private getSampleMT299(): string {
        return `{1:F01BBBBUS33AXXX0000000000}{2:I299CCCCGB2LXXXXN}{3:{121:299e8400-e29b-41d4-a716-446655440000}}{4:
:20:REF299001
:21:RELREF112233
:79:THIS IS A TEST NARRATIVE MESSAGE FOR MT299.
-}`;
    }

    private getSampleMT192(): string {
        return `{1:F01BBBBUS33AXXX0000000000}{2:I192CCCCGB2LXXXXN}{3:{121:192e8400-e29b-41d4-a716-446655440000}}{4:
:20:REF192CANX001
:21:RELREF778899
-}`;
    }

    private getSampleMT196(): string {
        return `{1:F01BBBBUS33AXXX0000000000}{2:I196CCCCGB2LXXXXN}{3:{121:196e8400-e29b-41d4-a716-446655440000}}{4:
:20:REF196RES001
:21:RELREF334455
:79:CANCELLATION ACCEPTED AS REQUESTED.
-}`;
    }

    private getLineSuggestion(tag: string): { line: number | string, isExists: boolean } {
        const lines = (this.mtInput || '').split('\n');

        // 1. Check if tag exists but is empty
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith(`:${tag}:`)) {
                return { line: i + 1, isExists: true };
            }
        }

        // 2. Suggest insertion point based on tag order (simple numeric sort)
        const targetTagNum = parseInt(tag.substring(0, 2));
        let lastTagLine = -1;
        let foundInsertionLine = -1;

        for (let i = 0; i < lines.length; i++) {
            const lineMatch = lines[i].match(/^:([0-9]{2}[A-Z]?):/);
            if (lineMatch) {
                const currentTagNum = parseInt(lineMatch[1].substring(0, 2));
                if (currentTagNum > targetTagNum && foundInsertionLine === -1) {
                    foundInsertionLine = i + 1;
                }
                lastTagLine = i + 1;
            }
        }

        if (foundInsertionLine !== -1) return { line: `Line ${foundInsertionLine}`, isExists: false };
        if (lastTagLine !== -1) return { line: `Line ${lastTagLine + 1}`, isExists: false };

        return { line: 'New Line', isExists: false };
    }

    // Validation Layer Helpers for Auto-Summary
    getLayerIcon(layer: number): string {
        const ls = this.validationReport?.layer_status;
        if (!ls || !ls[layer]) return 'radio_button_unchecked';
        const s = ls[layer].status;
        if (s === '✅' || s === 'PASS') return 'check_circle';
        if (s === '❌' || s === 'FAIL') return 'cancel';
        if (s === '⚠️' || s === 'WARN') return 'warning';
        return 'help_outline';
    }

    getLayerClass(layer: number): string {
        const ls = this.validationReport?.layer_status;
        if (!ls || !ls[layer]) return '';
        const s = ls[layer].status;
        if (s === '✅' || s === 'PASS') return 'pass';
        if (s === '❌' || s === 'FAIL') return 'fail';
        if (s === '⚠️' || s === 'WARN') return 'warn';
        return '';
    }

    getLayerNameForSummary(layer: number): string {
        return this.getLayerName(String(layer));
    }

    viewXmlModal() {
        this.closeValidationModal();
        setTimeout(() => {
            if (this.mxEditorRef) {
                this.mxEditorRef.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    }

    editXmlModal() {
        this.closeValidationModal();
        setTimeout(() => {
            if (this.mxEditorRef) {
                this.mxEditorRef.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                this.mxEditorRef.nativeElement.focus();
            }
        }, 100);
    }

    runValidationModal() {
        this.validateMx();
    }
}
