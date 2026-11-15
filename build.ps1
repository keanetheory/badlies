# Same output as build.mjs, for machines without Node:
#   dist/index.html        one self-contained page
#   dist/badlies-itch.zip  index.html at the zip root, ready for itch.io
# Run:  powershell -ExecutionPolicy Bypass -File build.ps1
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Read-Text($p) { [IO.File]::ReadAllText((Join-Path $root $p), $utf8) }

# Ordinal sort, same as build.mjs (Sort-Object ignores hyphens, which put 02b-* before 02-*).
[string[]]$names = Get-ChildItem (Join-Path $root 'src/js') -Filter *.js | ForEach-Object { $_.Name }
[Array]::Sort($names, [StringComparer]::Ordinal)
$js = ($names | ForEach-Object { Read-Text "src/js/$_" }) -join "`n"
$html = Read-Text 'src/index.html'
$i = $html.IndexOf('/*CSS*/'); $html = $html.Substring(0, $i) + (Read-Text 'src/styles.css') + $html.Substring($i + 7)
$i = $html.IndexOf('/*JS*/');  $html = $html.Substring(0, $i) + $js + $html.Substring($i + 6)

$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null
$index = Join-Path $dist 'index.html'
[IO.File]::WriteAllText($index, $html, $utf8)
'dist/index.html  {0:N1} kB' -f ($html.Length / 1024)

Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$zipPath = Join-Path $dist 'badlies-itch.zip'
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
$zip = [IO.Compression.ZipFile]::Open($zipPath, 'Create')
try { [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $index, 'index.html', 'Optimal') | Out-Null } finally { $zip.Dispose() }
'dist/badlies-itch.zip  {0:N1} kB  -> upload to itch.io as an HTML game' -f ((Get-Item $zipPath).Length / 1024)
