const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove the extra } after isLayerWarn
    const brokenPattern = /isLayerWarn\(k: string\) \{\s*const s = \(this\.getLayerStatus\(k\) \|\| ''\)\.toUpperCase\(\);\s*if \(s\.includes\('WARN'\) \|\| s\.includes\('WARNING'\)\) return true;\s*if \(s\.includes\('FAIL'\) \|\| s\.includes\('ERROR'\)\) return false;\s*return false;\s*\}\s*\}/g;

    const fixedReplacement = `isLayerWarn(k: string) {
        const s = (this.getLayerStatus(k) || '').toUpperCase();
        if (s.includes('WARN') || s.includes('WARNING')) return true;
        if (s.includes('FAIL') || s.includes('ERROR')) return false;
        return false;
    }`;

    if (brokenPattern.test(content)) {
        content = content.replace(brokenPattern, fixedReplacement);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed double brace in ' + filePath);
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
