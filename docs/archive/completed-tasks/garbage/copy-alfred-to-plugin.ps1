# PowerShell script to copy Alfred files to Alexandria plugin directory
# Run from PowerShell: .\copy-alfred-to-plugin.ps1

$source = "C:\Projects\alfred"
$destination = "C:\Projects\Alexandria\src\plugins\alfred\original-python"

Write-Host "Copying Alfred files to Alexandria plugin directory..." -ForegroundColor Green

# Create destination directory
New-Item -ItemType Directory -Path $destination -Force | Out-Null

# Files to copy (core Alfred functionality)
$filesToCopy = @(
    "alfred.py",
    "alfred_*.py",  # All Alfred-related Python files
    "config.py",
    "project_manager.py",
    "structure_manager.py",
    "templates/*.py",
    "*.md"  # Documentation
)

# Copy files
foreach ($pattern in $filesToCopy) {
    $files = Get-ChildItem -Path $source -Filter $pattern -Recurse -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($source.Length + 1)
        $destPath = Join-Path $destination $relativePath
        $destDir = Split-Path $destPath -Parent
        
        # Create directory if it doesn't exist
        if (!(Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        
        Copy-Item -Path $file.FullName -Destination $destPath -Force
        Write-Host "Copied: $relativePath" -ForegroundColor Gray
    }
}

Write-Host "`nAlfred files copied successfully!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Review the copied Python files in: $destination" -ForegroundColor White
Write-Host "2. Start converting Python code to TypeScript services" -ForegroundColor White
Write-Host "3. Create React UI components based on the tkinter interface" -ForegroundColor White
Write-Host "4. Integrate with Alexandria's AI and file services" -ForegroundColor White