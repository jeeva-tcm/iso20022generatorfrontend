const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    const brokenRegex = /\/\/ CBPR_COM_R9: If BICFI is present, Nm \+ PstlAdr are NOT allowed\.\n\s*\/\/ This applies to ALL Financial Institutions in CBPR\+\.\n\s*if \(\!bic\) \{/g;
    
    if (brokenRegex.test(content)) {
        content = content.replace(brokenRegex, `// CBPR_COM_R9: If BICFI is present, Nm + PstlAdr are NOT allowed.\n        // This applies to ALL Financial Institutions in CBPR+.\n        if (!onlyBic && !bic) {`);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed onlyBic in ' + filePath);
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
