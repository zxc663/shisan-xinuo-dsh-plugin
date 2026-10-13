param([string]$Process = 'DeepSeek Harness', [string]$Out = 'gui-cap.png', [switch]$Screen)
# 桌面 GUI 验证·窗口截屏（本机兜底：GDI/PrintWindow；DPI 感知；句柄瞬失自动重试）
# 用法：powershell -File capture-window.ps1 -Out D:\tmp\b3b\shot.png [-Screen]
Add-Type @"
using System; using System.Runtime.InteropServices;
public class GuiCap {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L; public int T; public int R; public int B; }
}
"@
[GuiCap]::SetProcessDPIAware() | Out-Null
$p = Get-Process $Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) { Write-Output 'NO-WINDOW'; exit 1 }
$h = $p.MainWindowHandle
if ([GuiCap]::IsIconic($h)) { [GuiCap]::ShowWindow($h, 9) | Out-Null; Start-Sleep -Milliseconds 500 }
$fg = [GuiCap]::SetForegroundWindow($h)
$r = New-Object GuiCap+RECT
$w = 0; $ht = 0
for ($i = 0; $i -lt 6; $i++) {
  Start-Sleep -Milliseconds 350
  [GuiCap]::GetWindowRect($h, [ref]$r) | Out-Null
  $w = $r.R - $r.L; $ht = $r.B - $r.T
  if ($w -gt 0 -and $ht -gt 0) { break }
  $p = Get-Process $Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if ($p) { $h = $p.MainWindowHandle }
}
if ($w -le 0 -or $ht -le 0) { Write-Output 'RECT-FAIL（窗口句柄失效，稍后重试）'; exit 1 }
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap($w, $ht)
$g = [System.Drawing.Graphics]::FromImage($bmp)
if ($Screen) {
  $g.CopyFromScreen($r.L, $r.T, 0, 0, $bmp.Size)
} else {
  $hdc = $g.GetHdc()
  [GuiCap]::PrintWindow($h, $hdc, 2) | Out-Null
  $g.ReleaseHdc($hdc)
}
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output ('pid={0} rect={1},{2} size={3}x{4} foregrounded={5} mode={6}' -f $p.Id, $r.L, $r.T, $w, $ht, $fg, ($(if ($Screen) { 'screen' } else { 'printwindow' })))
