import os
import re

files = [
    r'c:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\manual-entry\pacs\pacs9\pacs9.component.ts',
    r'c:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\manual-entry\pacs\pacs9adv\pacs9adv.component.ts',
    r'c:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\manual-entry\pacs\pacs9cov\pacs9cov.component.ts'
]

for f in files:
    if os.path.exists(f):
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # Remove buildForm fields
        content = re.sub(r'\s*rmtInfStrdRfrdDocNb: \[''.*?\],', '', content)
        content = re.sub(r'\s*rmtInfStrdRfrdDocCd: \[''.*?\],', '', content)
        content = re.sub(r'\s*rmtInfStrdRfrdDocAmt: \[''.*?\].*?,', '', content)
        content = re.sub(r'\s*rmtInfStrdRfrdDocAmt: \[''.*?\]\]', '', content)
        content = re.sub(r'\s*rmtInfStrdCdtrRefType: \[''.*?\],', '', content)
        content = re.sub(r'\s*rmtInfStrdCdtrRef: \[''.*?\],', '', content)
        content = re.sub(r'\s*rmtInfStrdAddtlRmtInf: \[''.*?\],', '', content)
        
        # Remove conditional validation block
        content = re.sub(r'\} else if \(rmtInfType\?\.value === \'strd\'\) \{.*?\}\s*const ctry', '} const ctry', content, flags=re.DOTALL)
        content = re.sub(r'\} else if \(this\.form\.get\(\'rmtInfType\'\)\?\.value === \'strd\'\) \{.*?\}\s*const ctry', '} const ctry', content, flags=re.DOTALL)
        content = re.sub(r'\} else if \(rmtInfType\?\.value === \'strd\'\) \{.*?\}\s*const chrg', '} const chrg', content, flags=re.DOTALL)
        
        # Remove XML generator block
        content = re.sub(r'\} else if \(v\.rmtInfType === \'strd\'\) \{.*?\}\s*const tval', '} const tval', content, flags=re.DOTALL)
        
        # Remove XML parser block
        content = re.sub(r'\} else \{\s*const strd = getT\(\'Strd\', rmtInf\);.*?\}\s*\}\s*\} else \{', '} } else {', content, flags=re.DOTALL)
        
        with open(f, 'w', encoding='utf-8') as file:
            file.write(content)
