const fs = require('fs');
const path = require('path');

function processTsFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Regex to match the old isLayerPass, isLayerFail, isLayerWarn
    const methodsRegex = /isLayerPass\(k: string\) \{[\s\S]*?isLayerFail\(k: string\) \{[\s\S]*?isLayerWarn\(k: string\) \{[\s\S]*?\n\s*\}/g;

    const replacement = `isLayerPass(k: string) {
        const layerNum = Number(k);
        const hasErrors = (this.validationReport?.details ?? []).some(
            (d: any) => Number(d?.layer) === layerNum && d?.severity === 'ERROR'
        );
        if (hasErrors) return false;
        const s = (this.getLayerStatus(k) || '').toUpperCase();
        if (s.includes('FAIL') || s.includes('ERROR')) return false;
        return true;
    }
    isLayerFail(k: string) {
        const layerNum = Number(k);
        const hasErrors = (this.validationReport?.details ?? []).some(
            (d: any) => Number(d?.layer) === layerNum && d?.severity === 'ERROR'
        );
        if (hasErrors) return true;
        const s = (this.getLayerStatus(k) || '').toUpperCase();
        return s.includes('FAIL') || s.includes('ERROR');
    }
    isLayerWarn(k: string) {
        return false;
    }`;

    if (methodsRegex.test(content)) {
        content = content.replace(methodsRegex, replacement);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed layer logic in ' + filePath);
    }
}

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.ts') && fullPath.includes('component')) {
            processTsFile(fullPath);
        }
    }
}

walk('C:\\\\Users\\\\HP\\\\Desktop\\\\iso final\\\\iso20022generatorfrontend\\\\src\\\\app\\\\pages\\\\manual-entry');
