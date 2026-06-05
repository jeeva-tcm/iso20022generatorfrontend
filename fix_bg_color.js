const fs = require('fs');
const path = require('path');

function processTsFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace isLayerPass
    const isLayerPassRegex = /isLayerPass\(k: string\) \{[\s\S]*?\}\n    isLayerFail/g;
    const isLayerPassReplacement = `isLayerPass(k: string) {
        const s = (this.getLayerStatus(k) || '').toUpperCase();
        if (!s || s.trim() === '') return false;
        if (s.includes('FAIL') || s.includes('ERROR')) return false;
        return s.includes('PASS') || s.includes('SUCCESS') || s.includes('VALID');
    }
    isLayerFail`;

    // Replace isLayerWarn
    const isLayerWarnRegex = /isLayerWarn\(k: string\) \{[\s\S]*?\}\n/g;
    const isLayerWarnReplacement = `isLayerWarn(k: string) {
        const s = (this.getLayerStatus(k) || '').toUpperCase();
        if (s.includes('WARN') || s.includes('WARNING')) return true;
        if (s.includes('FAIL') || s.includes('ERROR')) return false;
        return false;
    }
`;

    if (isLayerPassRegex.test(content)) {
        content = content.replace(isLayerPassRegex, isLayerPassReplacement);
    }
    
    // Also remove the old isLayerWarn
    if (content.includes('isLayerWarn(k: string) {')) {
        content = content.replace(/isLayerWarn\(k: string\) \{[\s\S]*?(?=\n\s*(getValidationIssues|viewXmlModal|\/\*|public|private|closeValidationModal|getLayerName|getValidationLayers|}))/, isLayerWarnReplacement);
    }

    fs.writeFileSync(filePath, content, 'utf8');
}

function processHtmlFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Change banner logic: 
    // [class.pass]="(validationReport.errors || 0) === 0 && (validationReport.warnings || 0) === 0"
    // to
    // [class.pass]="(validationReport.errors || 0) === 0"
    const passRegex = /\[class\.pass\]="\(!?validationReport\.errors \|\| 0\) === 0 && \(!?validationReport\.warnings \|\| 0\) === 0"/g;
    content = content.replace(passRegex, '[class.pass]="(validationReport.errors || 0) === 0"');

    // Change warn logic to false or remove it
    const warnRegex = /\[class\.warn\]="\(!?validationReport\.errors \|\| 0\) === 0 && \(!?validationReport\.warnings \|\| 0\) > 0"/g;
    content = content.replace(warnRegex, '[class.warn]="false"');

    // Also fix the banner icon:
    // (validationReport.errors || 0) > 0 ? 'cancel' : ((validationReport.warnings || 0) > 0 ? 'warning' : 'check_circle')
    const iconRegex = /\(validationReport\.errors \|\| 0\) > 0 \? 'cancel' : \(\(validationReport\.warnings \|\| 0\) > 0 \? 'warning' : 'check_circle'\)/g;
    content = content.replace(iconRegex, "(validationReport.errors || 0) > 0 ? 'cancel' : 'check_circle'");

    fs.writeFileSync(filePath, content, 'utf8');
}

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.ts') && fullPath.includes('component')) {
            processTsFile(fullPath);
        } else if (fullPath.endsWith('.html') && fullPath.includes('component')) {
            processHtmlFile(fullPath);
        }
    }
}

walk('C:\\\\Users\\\\HP\\\\Desktop\\\\iso final\\\\iso20022generatorfrontend\\\\src\\\\app\\\\pages\\\\manual-entry');
console.log('Done modifying TS and HTML files.');
