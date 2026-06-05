const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Only in pacs3, pacs8, pacs9adv, pacs9cov
    if (filePath.includes('pacs3.component.ts') || 
        filePath.includes('pacs8.component.ts') || 
        filePath.includes('pacs9adv.component.ts') || 
        filePath.includes('pacs9cov.component.ts')) {
        
        content = content.replace(/if \(\!onlyBic && \!bic\) \{/g, 'if (!bic) {');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Removed onlyBic in ' + filePath);
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
