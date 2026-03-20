import shutil
import os

src = r"c:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\manual-entry\pacs9\pacs9.component.css"
dst = r"c:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\manual-entry\pacs4\pacs4.component.css"

try:
    shutil.copy2(src, dst)
    print(f"Successfully copied {src} to {dst}")
except Exception as e:
    print(f"Error: {e}")
