param([Parameter(Mandatory)][string]$Op, [int]$X = 0, [int]$Y = 0, [string]$Value = '')
# 桌面 GUI 验证·输入（本机兜底：SetCursorPos+mouse_event；剪贴板粘贴中文；SendKeys 按 Enter 等）
# 用法：click -X -Y ｜ move -X -Y ｜ paste -Value '文本' ｜ key -Value '{ENTER}'
# 铁律：每个交互步先截屏核对再行动（见 capture-window.ps1 与 docs/gui-verification-protocol-20261013.md）
Add-Type @"
using System; using System.Runtime.InteropServices;
public class GuiIn {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint data, UIntPtr extra);
}
"@
[GuiIn]::SetProcessDPIAware() | Out-Null
switch ($Op) {
  'click' {
    [GuiIn]::SetCursorPos($X, $Y) | Out-Null
    Start-Sleep -Milliseconds 140
    [GuiIn]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 70
    [GuiIn]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
    Write-Output ("clicked {0},{1}" -f $X, $Y)
  }
  'move' {
    [GuiIn]::SetCursorPos($X, $Y) | Out-Null
    Write-Output ("moved {0},{1}" -f $X, $Y)
  }
  'paste' {
    Set-Clipboard -Value $Value
    Add-Type -AssemblyName System.Windows.Forms
    Start-Sleep -Milliseconds 200
    [System.Windows.Forms.SendKeys]::SendWait('^v')
    Write-Output 'pasted'
  }
  'key' {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.SendKeys]::SendWait($Value)
    Write-Output ("key {0}" -f $Value)
  }
  default { Write-Output ("unknown op {0}" -f $Op); exit 2 }
}
