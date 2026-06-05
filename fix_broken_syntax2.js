const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // This regex catches the leftover getLayerStatus up to the extra '}'
    const brokenRegex = /^getLayerStatus\(k\)(?: \|\| ''\)\.toUpperCase\(\))?;\s*(?:\/\/.*\s*)*if \(s\.includes\('⚠'\) \|\| s\.includes\('WARN'\) \|\| s\.includes\('WARNING'\) \|\| s\.includes\('⚠'\) \|\| s\.includes\('WARN'\)\) return true;\s*(?:\/\/.*\s*)*if \(s\.includes\('❌'\) \|\| s\.includes\('FAIL'\) \|\| s\.includes\('ERROR'\) \|\| s\.includes\('\?'\)\) return false;\s*if \(!s \|\| s\.trim\(\) === ''\) return false;\s*const layerNum = Number\(k\);\s*return \(this\.validationReport\?\.details \?\? \[\]\)\.some\(\s*\(d: any\) => Number\(d\?\.layer\) === layerNum && d\?\.severity === 'WARNING'\s*\);\s*\}/gm;

    // A simpler regex since the exact characters vary slightly:
    const simplerRegex = /^getLayerStatus\(k\)[\s\S]*?d\?\.severity === 'WARNING'[\s\S]*?\n\s*\}/gm;

    if (simplerRegex.test(content)) {
        content = content.replace(simplerRegex, '');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed broken syntax in ' + filePath);
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
