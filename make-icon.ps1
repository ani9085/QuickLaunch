Add-Type -AssemblyName System.Drawing

function New-QLIcon([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  # 둥근 사각형 배경 (그라데이션)
  $r = [int]($size * 0.19)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0, 0, $r, $r, 180, 90)
  $path.AddArc($size - $r, 0, $r, $r, 270, 90)
  $path.AddArc($size - $r, $size - $r, $r, $r, 0, 90)
  $path.AddArc(0, $size - $r, $r, $r, 90, 90)
  $path.CloseFigure()
  $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $c1 = [System.Drawing.Color]::FromArgb(91, 140, 255)
  $c2 = [System.Drawing.Color]::FromArgb(47, 95, 224)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45)
  $g.FillPath($brush, $path)

  # 번개 모양 (흰색)
  $norm = @(0.55,0.10, 0.30,0.55, 0.47,0.55, 0.40,0.90, 0.72,0.42, 0.54,0.42, 0.62,0.10)
  $pts = @()
  for ($i = 0; $i -lt $norm.Length; $i += 2) {
    $pts += New-Object System.Drawing.PointF([single]($norm[$i] * $size), [single]($norm[$i + 1] * $size))
  }
  $g.FillPolygon([System.Drawing.Brushes]::White, $pts)
  $g.Dispose()
  return $bmp
}

$dir = Join-Path $PSScriptRoot 'src\assets'
$big = New-QLIcon 256
$big.Save((Join-Path $dir 'icon256.png'), [System.Drawing.Imaging.ImageFormat]::Png)

# 트레이 아이콘 (32px)
$tray = New-Object System.Drawing.Bitmap(32, 32)
$tg = [System.Drawing.Graphics]::FromImage($tray)
$tg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$tg.DrawImage($big, 0, 0, 32, 32)
$tray.Save((Join-Path $dir 'tray.png'), [System.Drawing.Imaging.ImageFormat]::Png)

Write-Output 'PNGs created'
