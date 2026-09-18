# scripts/generate-icon.ps1 — Generate multi-resolution Windows .ico for ApexBill
param(
    [string]$OutputPath = "$PSScriptRoot\ApexBill.ico"
)

Add-Type -AssemblyName System.Drawing

function Create-ApexBillBitmap([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $g.Clear([System.Drawing.Color]::Transparent)

    # 1. Background rounded rectangle
    $radius = [Math]::Max(2, [int]($size * 0.22))
    $rect = New-Object System.Drawing.Rectangle 1, 1, ($size - 3), ($size - 3)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
    $path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
    $path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
    $path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
    $path.CloseFigure()

    # Dark Slate Gradient Fill (#0f172a -> #1e293b)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 15, 23, 42),
        [System.Drawing.Color]::FromArgb(255, 30, 41, 59),
        [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
    )
    $g.FillPath($bgBrush, $path)

    # Vibrant Brand Border (#3b82f6 -> #06b6d4)
    $borderPen = New-Object System.Drawing.Pen(
        [System.Drawing.Color]::FromArgb(255, 59, 130, 246),
        [Math]::Max(1.0, ($size * 0.05))
    )
    $g.DrawPath($borderPen, $path)

    # 2. Draw Apex "A" Symbol
    $fontSize = [float]($size * 0.52)
    $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 255, 255, 255),
        [System.Drawing.Color]::FromArgb(255, 147, 197, 253),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
    )
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    # Slight vertical offset for optical centering
    $yOffset = -($size * 0.03)
    $textRect = New-Object System.Drawing.RectangleF 0, $yOffset, $size, $size
    $g.DrawString("A", $font, $textBrush, $textRect, $sf)

    # Clean up graphics objects
    $font.Dispose()
    $textBrush.Dispose()
    $borderPen.Dispose()
    $bgBrush.Dispose()
    $path.Dispose()
    $g.Dispose()

    return $bmp
}

# Icon dimensions
$sizes = @(16, 32, 48, 64, 128, 256)
$pngStreams = @()

foreach ($s in $sizes) {
    $bmp = Create-ApexBillBitmap $s
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngStreams += $ms
    $bmp.Dispose()
}

# Write multi-res .ico file format
$fs = [System.IO.File]::Create($OutputPath)
$bw = New-Object System.IO.BinaryWriter $fs

# ICONDIR header
$bw.Write([UInt16]0) # Reserved
$bw.Write([UInt16]1) # Type (1 = Icon)
$bw.Write([UInt16]$sizes.Count) # Number of images

# Calculate offset where image data begins
$headerSize = 6 + (16 * $sizes.Count)
$currentOffset = $headerSize

# ICONDIRENTRY for each size
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $s = $sizes[$i]
    $pngLen = [int]$pngStreams[$i].Length

    $bWidth = if ($s -ge 256) { [byte]0 } else { [byte]$s }
    $bHeight = if ($s -ge 256) { [byte]0 } else { [byte]$s }

    $bw.Write($bWidth)
    $bw.Write($bHeight)
    $bw.Write([byte]0)   # Color count
    $bw.Write([byte]0)   # Reserved
    $bw.Write([UInt16]1) # Color planes
    $bw.Write([UInt16]32)# Bits per pixel
    $bw.Write([UInt32]$pngLen)
    $bw.Write([UInt32]$currentOffset)

    $currentOffset += $pngLen
}

# Write PNG data for each icon
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $bytes = $pngStreams[$i].ToArray()
    $bw.Write($bytes)
    $pngStreams[$i].Dispose()
}

$bw.Flush()
$fs.Close()

Write-Host "[OK] Created ApexBill multi-resolution icon: $OutputPath" -ForegroundColor Green
