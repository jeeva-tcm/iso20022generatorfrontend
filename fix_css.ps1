$files = Get-ChildItem -Path "C:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\manual-entry" -Filter *.css -Recurse
foreach ($f in $files) {
    $c = Get-Content $f.FullName -Raw
    $c = $c -replace '\.vm-layer\.layer-pass\s*\{\s*border-color:\s*rgba\(34,\s*197,\s*94,\s*0\.3\);\s*background:\s*rgba\(34,\s*197,\s*94,\s*0\.05\);\s*\}', '.vm-layer.layer-pass { border-color: rgba(34, 197, 94, 0.4); background: rgba(34, 197, 94, 0.15); }'
    Set-Content -Path $f.FullName -Value $c
}
