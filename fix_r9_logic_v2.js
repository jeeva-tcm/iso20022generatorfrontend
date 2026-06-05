const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // We look for the strictR9 variable declaration and the if statement that follows it.
    // It can be `if (!strictR9 || !bic)` or `if (!onlyBic && (!strictR9 || !bic))`
    // We replace it with `if (!bic)` or `if (!onlyBic && !bic)`

    const p3 = /const strictR9 = tag === 'InstgAgt' \|\| tag === 'InstdAgt';\s*if \(\!strictR9 \|\| \!bic\) \{/g;
    const p4 = /const strictR9 = tag === 'InstgAgt' \|\| tag === 'InstdAgt';\s*if \(\!onlyBic && \(\!strictR9 \|\| \!bic\)\) \{/g;

    const replacement3 = `if (!bic) {`;
    const replacement4 = `if (!onlyBic && !bic) {`;

    if (p3.test(content) || p4.test(content)) {
        content = content.replace(p3, replacement3);
        content = content.replace(p4, replacement4);
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
