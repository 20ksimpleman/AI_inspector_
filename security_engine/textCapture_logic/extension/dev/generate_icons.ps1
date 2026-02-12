Add-Type -AssemblyName System.Drawing

$basePath = "c:\Users\kriti\OneDrive\Desktop\AI_inspector_\security_engine\textCapture_logic\extension\icons"

$sizes = @(16, 48, 128)

foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($s, $s)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    # Dark background
    $g.Clear([System.Drawing.Color]::FromArgb(26, 26, 46))

    # Shield gradient brush
    $p1 = New-Object System.Drawing.Point(0, 0)
    $p2 = New-Object System.Drawing.Point($s, $s)
    $c1 = [System.Drawing.Color]::FromArgb(255, 75, 75)
    $c2 = [System.Drawing.Color]::FromArgb(204, 41, 54)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($p1, $p2, $c1, $c2)

    # Shield polygon points
    $points = @(
        (New-Object System.Drawing.PointF(($s / 2),  ($s * 0.12))),
        (New-Object System.Drawing.PointF(($s * 0.82), ($s * 0.28))),
        (New-Object System.Drawing.PointF(($s * 0.82), ($s * 0.55))),
        (New-Object System.Drawing.PointF(($s / 2),  ($s * 0.88))),
        (New-Object System.Drawing.PointF(($s * 0.18), ($s * 0.55))),
        (New-Object System.Drawing.PointF(($s * 0.18), ($s * 0.28)))
    )

    $g.FillPolygon($brush, $points)

    # White border on shield
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 255, 255, 255), [Math]::Max(1, $s * 0.02))
    $g.DrawPolygon($pen, $points)

    $g.Dispose()
    $brush.Dispose()
    $pen.Dispose()

    $outPath = Join-Path $basePath "icon$s.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    Write-Host "Created icon$s.png at $outPath"
}

Write-Host "All icons generated successfully!"
