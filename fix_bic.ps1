
$ending = @"

  runValidationModal() {
    this.validateMessage();
  }

  openBicSearch(f: string): void {
    const dialogRef = this.dialog.open(BicSearchDialogComponent, {
      width: '800px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.bic) {
        this.form.patchValue({ [f]: result.bic });
        this.form.get(f)?.markAsDirty();
      }
    });
  }
}
"@

$endingWithEdit = @"

  editXmlModal() {
    this.closeValidationModal();
    this.currentTab = 'form';
  }

  runValidationModal() {
    this.validateMessage();
  }

  openBicSearch(f: string): void {
    const dialogRef = this.dialog.open(BicSearchDialogComponent, {
      width: '800px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.bic) {
        this.form.patchValue({ [f]: result.bic });
        this.form.get(f)?.markAsDirty();
      }
    });
  }
}
"@

function Fix-Component {
    param([string]$FilePath, [string]$Marker, [string]$NewEnding)
    
    $content = Get-Content $FilePath -Raw -Encoding UTF8
    $idx = $content.LastIndexOf($Marker)
    if ($idx -ge 0) {
        $fixed = $content.Substring(0, $idx) + $NewEnding
        Set-Content $FilePath $fixed -Encoding UTF8 -NoNewline
        Write-Host "Fixed: $FilePath"
    } else {
        Write-Host "Marker not found in: $FilePath"
    }
}

# Fix pacs3
Fix-Component `
    -FilePath "src\app\pages\manual-entry\pacs3\pacs3.component.ts" `
    -Marker "  editXmlModal() {" `
    -NewEnding $endingWithEdit

# Fix pacs8
Fix-Component `
    -FilePath "src\app\pages\manual-entry\pacs8\pacs8.component.ts" `
    -Marker "  editXmlModal() {" `
    -NewEnding $endingWithEdit

Write-Host "Done."
