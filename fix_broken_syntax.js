const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    const brokenRegex = /^getLayerStatus\(k\) \|\| ''\)\.toUpperCase\(\);\s*if \(s\.includes\('WARN'\) \|\| s\.includes\('⚠'\)\) return true;\s*if \(s\.includes\('FAIL'\) \|\| s\.includes\('ERROR'\) \|\| s\.includes\('❌'\) \|\| s\.includes\('\?'\)\) return false;\s*if \(!s \|\| s\.trim\(\) === ''\) return false;\s*const layerNum = Number\(k\);\s*return \(this\.validationReport\?\.details \?\? \[\]\)\.some\(\s*\(d: any\) => Number\(d\?\.layer\) === layerNum && d\?\.severity === 'WARNING'\s*\);\s*\}/gm;

    if (brokenRegex.test(content)) {
        content = content.replace(brokenRegex, '');
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
