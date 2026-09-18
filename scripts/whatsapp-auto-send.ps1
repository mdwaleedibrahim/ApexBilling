param(
    [string]$Phone = "",
    [string]$Text = ""
)

if (-not $Phone -or -not $Text) {
    exit 0
}

$digits = $Phone -replace '\D', ''
if ($digits.Length -eq 10) {
    $digits = "91" + $digits
}

$encoded = [System.Uri]::EscapeDataString($Text)
$uri = "whatsapp://send?phone=$digits&text=$encoded"

# 1. Launch WhatsApp protocol URI to open chat and prefill message
Start-Process $uri

# 2. Wait for WhatsApp Desktop window to open and populate the chat input box
Start-Sleep -Milliseconds 1700

# 3. Bring WhatsApp to the foreground and press ENTER automatically
Add-Type -AssemblyName System.Windows.Forms
$wshell = New-Object -ComObject WScript.Shell

# Attempt activation by title/process
$null = $wshell.AppActivate('WhatsApp')
Start-Sleep -Milliseconds 200

# Send ENTER to automatically dispatch message without user intervention
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')

# Soft follow-up retry in case of slight delay
Start-Sleep -Milliseconds 800
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
