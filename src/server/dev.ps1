# Forward to scripts/dev.ps1
$rootDir = (Resolve-Path "$PSScriptRoot\..\..").Path
& "$rootDir\scripts\dev.ps1"
