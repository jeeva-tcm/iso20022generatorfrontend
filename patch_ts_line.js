const fs = require('fs');
const files = [
    'c:/Users/HP/Desktop/iso final/iso20022generatorfrontend/src/app/pages/manual-entry/pacs/pacs9/pacs9.component.ts',
    'c:/Users/HP/Desktop/iso final/iso20022generatorfrontend/src/app/pages/manual-entry/pacs/pacs9adv/pacs9adv.component.ts',
    'c:/Users/HP/Desktop/iso final/iso20022generatorfrontend/src/app/pages/manual-entry/pacs/pacs9cov/pacs9cov.component.ts'
];

for (const f of files) {
    if (fs.existsSync(f)) {
        let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
        let newLines = [];
        
        let skipUntil = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // XML generation
            if (line.includes('} else if (v.rmtInfType === \'strd\') {')) {
                skipUntil = 1; // Need to skip until we balance the braces
                let braces = 1;
                i++;
                while (i < lines.length && braces > 0) {
                    if (lines[i].includes('{')) braces += (lines[i].match(/\{/g) || []).length;
                    if (lines[i].includes('}')) braces -= (lines[i].match(/\}/g) || []).length;
                    i++;
                }
                i--; // Backtrack one because of loop increment
                continue;
            }
            
            // XML parsing block with Strd
            if (line.includes('} else {') && i + 1 < lines.length && lines[i+1].includes('const strd = getT(\'Strd\', rmtInf);')) {
                let braces = 1; // } else { is one open brace
                i++;
                while (i < lines.length && braces > 0) {
                    if (lines[i].includes('{')) braces += (lines[i].match(/\{/g) || []).length;
                    if (lines[i].includes('}')) braces -= (lines[i].match(/\}/g) || []).length;
                    i++;
                }
                i--;
                continue;
            }
            
            // Also conditionally parsing in pacs9 parsing block that got mangled
            if (line.includes('patch.rmtInfStrdAddtlRmtInf = tval(\'AddtlRmtInf\', strd);')) continue;
            if (line.includes('const rfrd = getT(\'RfrdDocInf\', strd);')) {
                // Skip the if(rfrd) block
                i += 4;
                continue;
            }
            
            // Form builder elements that got missed
            if (line.includes('rmtInfStrdCdtrRefType:')) continue;
            if (line.includes('rmtInfStrdCdtrRef:')) continue;
            if (line.includes('rmtInfStrdAddtlRmtInf:')) continue;
            if (line.includes('rmtInfStrdRfrdDocNb:')) continue;
            if (line.includes('rmtInfStrdRfrdDocCd:')) continue;
            if (line.includes('rmtInfStrdRfrdDocAmt:')) continue;
            
            newLines.push(line);
        }
        
        fs.writeFileSync(f, newLines.join('\r\n'), 'utf8');
    }
}
