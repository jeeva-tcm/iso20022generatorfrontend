$results = @()
Get-ChildItem -Path "src\app\pages\manual-entry" -Recurse -Filter "*.component.ts" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $hasMethod = $content -match "openBicSearch"
    $is800px = $content -match "800px"
    $usesBicProp = $content -match "result\.bic"
    $results += [PSCustomObject]@{
        Name = $_.Name
        HasMethod = $hasMethod
        Is800px = $is800px
        UsesBicProp = $usesBicProp
    }
}
$results | Format-Table -AutoSize
