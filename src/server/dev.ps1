# Forward to root dev.ps1
$rootDir = (Resolve-Path "$PSScriptRoot\..").Path
& "$rootDir\dev.ps1"
