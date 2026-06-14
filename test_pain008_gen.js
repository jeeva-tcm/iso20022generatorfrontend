
const fs = require('fs');
let code = fs.readFileSync('src/app/pages/manual-entry/pain/pain008/pain008.component.ts', 'utf-8');

// We extract everything inside the class Pain008Component
let classBody = code.match(/export class Pain008Component[\s\S]*?constructor.*?\s*{([\s\S]*)/)[1];

let t = \
class Generator {
  constructor() {
    this.isSR2026 = true;
    this.form = {
      getRawValue: () => ({
        messageId: 'BMS-123',
        initgPtyName: 'InitPty',
        initgPtyId: '123',
        currency: 'GBP',
        
        cdtrSchmeIdNm: 'Creditor Scheme Name',
        cdtrSchmeIdOthrId: 'SCHEME-ID-001',
        cdtrSchmeIdOthrSchmeNmCd: '',
        cdtrSchmeIdOthrSchmeNmPrtry: 'SEPA',
        cdtrSchmeIdOthrIssr: 'ISSUER-X',

        dbtrName: 'Debtor Name',
        dbtrOrgIdAnyBic: '',
        dbtrOrgIdLei: '',
        dbtrOrgIdOthrId: 'ORG-ID-001',
        dbtrOrgIdOthrSchmeNmCd: 'VAT',
        dbtrOrgIdOthrIssr: 'ISSUER-Y',

        dbtrPrvtIdBirthDt: '',
        dbtrPrvtIdOthrId: 'PRVT-ID-001',
        dbtrPrvtIdOthrSchmeNmCd: 'NIDN',
        dbtrPrvtIdOthrIssr: 'ISSUER-Z',
      })
    };
  }
  
  isoNowDate() { return '2026-06-13'; }
  isoNow() { return '2026-06-13T12:00:00Z'; }
  e(val) { return val ? val.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''; }
  tabs(n) { return '  '.repeat(n); }
  el(name, value, t) {
    if (value === undefined || value === null || value === '') return '';
    return \\<\>\</\>\\n\;
  }
  tag(name, content, t) {
    if (!content || content.trim() === '') return '';
    return \\<\>\\n\\</\>\\n\;
  }
  buildAddr() { return ''; }

\ + classBody.replace(/ngOnInit[\s\S]*?generateXml/, 'generateXml').replace(/@ViewChild[\s\S]*?\}\)/g, '');

t = t.substring(0, t.lastIndexOf('}')); // remove trailing class brace from regex match? Actually just let it syntax error and I will fix it if it does.
// Wait, the regex match goes to the end of the file.

