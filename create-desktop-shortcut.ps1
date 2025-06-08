# PowerShell script to create a desktop shortcut for Alexandria Platform

$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Alexandria Platform.lnk")

# Set the target to the batch file
$Shortcut.TargetPath = "$PSScriptRoot\Alexandria.bat"

# Set the working directory
$Shortcut.WorkingDirectory = $PSScriptRoot

# Set the icon (using Node.js icon or custom icon if available)
if (Test-Path "$PSScriptRoot\public\favicon.png") {
    # Note: .lnk files typically need .ico files, but we'll try with the PNG
    $Shortcut.IconLocation = "$PSScriptRoot\public\favicon.png"
} else {
    # Use default cmd icon
    $Shortcut.IconLocation = "%SystemRoot%\System32\cmd.exe"
}

# Set description
$Shortcut.Description = "Launch Alexandria Platform Development Server"

# Set window style (1 = Normal window)
$Shortcut.WindowStyle = 1

# Save the shortcut
$Shortcut.Save()

Write-Host "Desktop shortcut created successfully!" -ForegroundColor Green
Write-Host "You can now launch Alexandria Platform from your desktop." -ForegroundColor Green