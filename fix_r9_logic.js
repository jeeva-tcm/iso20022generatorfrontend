const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // Pattern 1: pacs10 and pacs10v3
    // const strictR9 = tag === 'InstgAgt' || tag === 'InstdAgt';
    // if (!onlyBic && (!strictR9 || !bic)) {
    const p1 = /\s*\/\/\s*CBPR_COM_R9 \(strict\):[\s\S]*?const strictR9 = tag === 'InstgAgt' \|\| tag === 'InstdAgt';\s*if \(\!onlyBic && \(\!strictR9 \|\| \!bic\)\) \{/g;
    
    // Pattern 2: pacs3, pacs8, pacs9, pacs9adv, pacs9cov
    // const strictR9 = tag === 'InstgAgt' || tag === 'InstdAgt';
    // if (!strictR9 || !bic) {
    const p2 = /\s*\/\/\s*CBPR_COM_R9 \(strict\):[\s\S]*?const strictR9 = tag === 'InstgAgt' \|\| tag === 'InstdAgt';\s*if \(\!strictR9 \|\| \!bic\) \{/g;

    const replacement = `
        // CBPR_COM_R9: If BICFI is present, Nm + PstlAdr are NOT allowed.
        // This applies to ALL Financial Institutions in CBPR+.
        if (!bic) {`;

    if (p1.test(content) || p2.test(content)) {
        content = content.replace(p1, replacement);
        content = content.replace(p2, replacement);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed agt() CBPR_COM_R9 logic in ' + filePath);
    }
}

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.ts') && fullPath.includes('component')) {
            processFile(fullPath);
        }
    }
}

walk('C:\\\\Users\\\\HP\\\\Desktop\\\\iso final\\\\iso20022generatorfrontend\\\\src\\\\app\\\\pages\\\\manual-entry');
