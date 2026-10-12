# scripts/sign-binary.ps1 — Sign executable with Authenticode certificate
param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,
    [string]$ExportCertPath = ""
)

if (-not (Test-Path $FilePath)) {
    Write-Warning "File not found for signing: $FilePath"
    return
}

$cert = $null

# 1. Custom thumbprint from environment variable
if ($env:APEXBILL_SIGN_CERT_THUMBPRINT) {
    $cert = Get-Item "Cert:\CurrentUser\My\$($env:APEXBILL_SIGN_CERT_THUMBPRINT)" -ErrorAction SilentlyContinue
    if (-not $cert) {
        $cert = Get-Item "Cert:\LocalMachine\My\$($env:APEXBILL_SIGN_CERT_THUMBPRINT)" -ErrorAction SilentlyContinue
    }
}

# 2. Existing certificate with "ApexBill" in subject
if (-not $cert) {
    $cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert -ErrorAction SilentlyContinue |
        Where-Object { $_.Subject -like "*ApexBill*" -and $_.NotAfter -gt (Get-Date) } |
        Select-Object -First 1
}

# 3. Create self-signed code-signing certificate if none exists
if (-not $cert) {
    try {
        Write-Host "   Generating ApexBill code signing certificate..." -ForegroundColor Cyan
        $cert = New-SelfSignedCertificate -Type CodeSigningCert `
            -Subject "CN=ApexBill Open Source, O=ApexBill, OU=Development" `
            -CertStoreLocation "Cert:\CurrentUser\My" `
            -NotAfter (Get-Date).AddYears(5) `
            -HashAlgorithm SHA256 `
            -FriendlyName "ApexBill Code Signing Certificate" `
            -ErrorAction Stop
    } catch {
        Write-Warning "Failed to generate self-signed code signing certificate: $_"
    }
}

# 4. Sign the executable
if ($cert) {
    try {
        $sig = Set-AuthenticodeSignature -FilePath $FilePath -Certificate $cert -HashAlgorithm SHA256 -TimestampServer "http://timestamp.digicert.com" -ErrorAction SilentlyContinue
        if (-not $sig -or ($sig.Status -ne "Valid" -and $sig.Status -ne "UnknownError")) {
            $sig = Set-AuthenticodeSignature -FilePath $FilePath -Certificate $cert -HashAlgorithm SHA256 -ErrorAction SilentlyContinue
        }
        $fileName = Split-Path $FilePath -Leaf
        Write-Host "   Authenticode Signed: $fileName [Status: $($sig.Status)]" -ForegroundColor Green
    } catch {
        Write-Warning "Authenticode signing failed for ${FilePath}: $_"
    }

    # 5. Export public .cer certificate if requested
    if ($ExportCertPath) {
        try {
            $exportDir = Split-Path $ExportCertPath
            if ($exportDir -and -not (Test-Path $exportDir)) {
                New-Item -ItemType Directory -Path $exportDir -Force | Out-Null
            }
            Export-Certificate -Cert $cert -FilePath $ExportCertPath -Force | Out-Null
            Write-Host "   Exported Certificate: $(Split-Path $ExportCertPath -Leaf)" -ForegroundColor Green
        } catch {
            Write-Warning "Failed to export certificate: $_"
        }
    }
}
