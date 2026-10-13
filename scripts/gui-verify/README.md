# gui-verify：桌面 GUI 验证工具（本机兜底）

配合 `docs/gui-verification-protocol-20261013.md` 使用（GUI=默认验证通道，常驻口径）。

- `capture-window.ps1 -Process 'DeepSeek Harness' -Out <png> [-Screen]`：DPI 感知窗口截屏（PrintWindow，遮挡可用；句柄瞬失自动重试）。
- `send-input.ps1 -Op click|move|paste|key [-X -Y] [-Value …]`：坐标点击/移动、剪贴板粘贴（中文安全）、按键（如 `{ENTER}`）。

注意：输入前必先截屏核对焦点/位置；`paste` 依赖目标窗口为前台。
