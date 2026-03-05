const fs = require('fs');
const path = require('path');

const components = ['pacs8', 'pacs9', 'pacs9cov', 'camt057'];
const srcPath = 'c:\\Users\\HP\\Desktop\\iso20022 Validator - Copy\\frontend\\src\\app\\pages\\manual-entry';

components.forEach(comp => {
    const htmlFile = path.join(srcPath, comp, `${comp}.component.html`);

    if (fs.existsSync(htmlFile)) {
        let htmlContent = fs.readFileSync(htmlFile, 'utf8');

        // Remove maxlength
        htmlContent = htmlContent.replace(/\smaxlength="\d+"/g, '');
        // Remove pattern
        htmlContent = htmlContent.replace(/\spattern="[^"]+"/g, '');
        // Remove required
        htmlContent = htmlContent.replace(/\srequired\b/g, '');
        // Remove step
        htmlContent = htmlContent.replace(/\sstep="[^"]+"/g, '');

        fs.writeFileSync(htmlFile, htmlContent);
        console.log(`Cleaned HTML for ${comp}`);
    }
});
