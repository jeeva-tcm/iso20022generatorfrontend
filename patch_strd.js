const fs = require('fs');
const files = ['pacs9/pacs9.component', 'pacs9adv/pacs9adv.component', 'pacs9cov/pacs9cov.component'];
const base = 'c:/Users/HP/Desktop/iso final/iso20022generatorfrontend/src/app/pages/manual-entry/pacs';

for (const f of files) {
    const htmlPath = base + '/' + f + '.html';
    if (fs.existsSync(htmlPath)) {
        let html = fs.readFileSync(htmlPath, 'utf8');
        html = html.replace(/<option value="strd">Structured Remittance<\/option>/g, '');
        
        const startStr = '<ng-container *ngIf="form.get(\'rmtInfType\')?.value === \'strd\'">';
        const startIndex = html.indexOf(startStr);
        if (startIndex >= 0) {
            const endIndex = html.indexOf('</ng-container>', startIndex);
            if (endIndex >= 0) {
                html = html.substring(0, startIndex) + html.substring(endIndex + '</ng-container>'.length);
            }
        }
        fs.writeFileSync(htmlPath, html, 'utf8');
    }

    const tsPath = base + '/' + f + '.ts';
    if (fs.existsSync(tsPath)) {
        let ts = fs.readFileSync(tsPath, 'utf8');
        
        ts = ts.replace(/^\s*rmtInfStrdCdtrRefType:.*$/gm, '');
        ts = ts.replace(/^\s*rmtInfStrdCdtrRef:.*$/gm, '');
        ts = ts.replace(/^\s*rmtInfStrdAddtlRmtInf:.*$/gm, '');
        
        ts = ts.replace(/\} else if \(rmtInfType\?\.value === 'strd'\) \{[^\}]+?\}/g, '}');
        
        ts = ts.replace(/\} else if \(this\.form\.get\('rmtInfType'\)\?\.value === 'strd'\) \{[\s\S]*?\}(?=\s*(?:\} else|if|return|\}))/, '}');
        
        fs.writeFileSync(tsPath, ts, 'utf8');
    }
}
