const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    if (filePath.includes('validate.component.ts')) {
        const validatePass = `  isLayerPass(report: any, k: string) {
    const s = (this.getLayerStatus(report, k) || '').toUpperCase();
    if (!s || s.trim() === '') return false;
    if (s.includes('FAIL') || s.includes('ERROR')) return false;
    if (s.includes('WARN') || s.includes('WARNING')) return false;
    return s.includes('PASS') || s.includes('SUCCESS') || s.includes('VALID');
  }`;
        const validateFail = `  isLayerFail(report: any, k: string) {
    const s = (this.getLayerStatus(report, k) || '').toUpperCase();
    return s.includes('FAIL') || s.includes('ERROR');
  }`;
        const validateWarn = `  isLayerWarn(report: any, k: string) {
    const s = (this.getLayerStatus(report, k) || '').toUpperCase();
    if (s.includes('WARN') || s.includes('WARNING')) return true;
    if (s.includes('FAIL') || s.includes('ERROR')) return false;
    return false;
  }`;

        content = content.replace(/[\s]*isLayerPass\(report: any, k: string\) \{[\s\S]*?\}\n/, '\n' + validatePass + '\n');
        content = content.replace(/[\s]*isLayerFail\(report: any, k: string\) \{[\s\S]*?\}\n/, '\n' + validateFail + '\n');
        content = content.replace(/[\s]*isLayerWarn\(report: any, k: string\) \{[\s\S]*?\}\n/, '\n' + validateWarn + '\n');
    } else {
        const manualPass = `    isLayerPass(k: string) {
        const s = (this.getLayerStatus(k) || '').toUpperCase();
        if (!s || s.trim() === '') return false;
        if (s.includes('FAIL') || s.includes('ERROR')) return false;
        if (s.includes('WARN') || s.includes('WARNING')) return false;
        const layerNum = Number(k);
        const hasLayerWarnings = (this.validationReport?.details ?? []).some(
            (d: any) => Number(d?.layer) === layerNum && d?.severity === 'WARNING'
        );
        if (hasLayerWarnings) return false;
        return s.includes('PASS') || s.includes('SUCCESS') || s.includes('VALID');
    }`;
        const manualFail = `    isLayerFail(k: string) {
        const s = (this.getLayerStatus(k) || '').toUpperCase();
        return s.includes('FAIL') || s.includes('ERROR');
    }`;
        const manualWarn = `    isLayerWarn(k: string) {
        const s = (this.getLayerStatus(k) || '').toUpperCase();
        if (s.includes('WARN') || s.includes('WARNING')) return true;
        if (s.includes('FAIL') || s.includes('ERROR')) return false;
        if (!s || s.trim() === '') return false;
        const layerNum = Number(k);
        return (this.validationReport?.details ?? []).some(
            (d: any) => Number(d?.layer) === layerNum && d?.severity === 'WARNING'
        );
    }`;

        content = content.replace(/[\s]*isLayerPass\(k: string\) \{[\s\S]*?(?=\s*isLayerFail\(k: string\))/, '\n' + manualPass + '\n');
        content = content.replace(/[\s]*isLayerFail\(k: string\) \{[\s\S]*?(?=\s*isLayerWarn\(k: string\))/, '\n' + manualFail + '\n');
        content = content.replace(/[\s]*isLayerWarn\(k: string\) \{[\s\S]*?(?=\s*[a-zA-Z0-9_]+\()/m, '\n' + manualWarn + '\n');
    }

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed ' + filePath);
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

processFile('C:\\\\Users\\\\HP\\\\Desktop\\\\iso final\\\\iso20022generatorfrontend\\\\src\\\\app\\\\pages\\\\validate\\\\validate.component.ts');
walk('C:\\\\Users\\\\HP\\\\Desktop\\\\iso final\\\\iso20022generatorfrontend\\\\src\\\\app\\\\pages\\\\manual-entry');
