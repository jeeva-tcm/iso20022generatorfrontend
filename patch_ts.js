const fs = require('fs');
const files = ['pacs9/pacs9.component', 'pacs9adv/pacs9adv.component', 'pacs9cov/pacs9cov.component'];
const base = 'c:/Users/HP/Desktop/iso final/iso20022generatorfrontend/src/app/pages/manual-entry/pacs';

for (const f of files) {
    const tsPath = base + '/' + f + '.ts';
    if (fs.existsSync(tsPath)) {
        let ts = fs.readFileSync(tsPath, 'utf8');
        
        // Remove buildForm properties
        ts = ts.replace(/\s*rmtInfStrdCdtrRefType: \['', \[\S*\]\],/g, '');
        ts = ts.replace(/\s*rmtInfStrdCdtrRefType: \[''\],/g, '');
        ts = ts.replace(/\s*rmtInfStrdCdtrRef: \['', \[\S+, \S+\]\],/g, '');
        ts = ts.replace(/\s*rmtInfStrdCdtrRef: \['', \S+\],/g, '');
        ts = ts.replace(/\s*rmtInfStrdAddtlRmtInf: \['', \[\S+, \S+\]\],/g, '');
        ts = ts.replace(/\s*rmtInfStrdAddtlRmtInf: \['', \S+\],/g, '');
        ts = ts.replace(/\s*rmtInfStrdRfrdDocNb: \['', \S+\],/g, '');
        ts = ts.replace(/\s*rmtInfStrdRfrdDocCd: \[''\],/g, '');
        ts = ts.replace(/\s*rmtInfStrdRfrdDocAmt: \['', \[\S+\]\]/g, '');

        // Remove conditional logic
        ts = ts.replace(/\} else if \(rmtInfType\?\.value === 'strd'\) \{[\s\S]*?\}\s*const ctry/g, '} const ctry');
        
        // Remove XML generation
        ts = ts.replace(/\} else if \(v\.rmtInfType === 'strd'\) \{[\s\S]*?(?=\}\s*\}\s*\/\/)/, '}');

        // Remove XML parsing
        const parseRegex = /\} else \{\s*const strd = getT\('Strd', rmtInf\);[\s\S]*?\}/g;
        ts = ts.replace(parseRegex, '}');

        fs.writeFileSync(tsPath, ts, 'utf8');
    }
}
