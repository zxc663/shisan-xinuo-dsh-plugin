// P3（roadmap F3/F5）单测——工作区边界守卫（对账面）＋完全权限记录模式。
// 执法主体=宿主原生 sandbox（三档+escalation 审批，见 docs/design-specs/p1-host-probes-20261017.md）；
// 插件净增量=边界判定（纯函数）＋写动作对账遥测＋完全权限记录。越区语料 ≥10 例（验收判据 b）。
import {
  isWriteTool,
  extractWriteTarget,
  normalizeWinPath,
  judgeWorkspaceBoundary,
  buildWriteAuditEntry,
} from '../src/shisan-xinuo-core.ts'

let pass = 0
let fail = 0
const cases = []
function t(name, expect, actual) {
  if (JSON.stringify(expect) === JSON.stringify(actual)) { pass++; cases.push(`PASS ${name}`) }
  else { fail++; cases.push(`FAIL ${name}\n  expect=${JSON.stringify(expect)}\n  actual=${JSON.stringify(actual)}`) }
}

// ── 写工具识别 ──
t('write-tool: write', true, isWriteTool('write'))
t('write-tool: edit', true, isWriteTool('edit'))
t('write-tool: str_replace_editor', true, isWriteTool('str_replace_editor'))
t('write-tool: notebook_edit', true, isWriteTool('notebook_edit'))
t('write-tool: read 不是写（反例）', false, isWriteTool('read'))
t('write-tool: bash 不是 fs 写工具（shell 走命令域）', false, isWriteTool('bash'))
t('write-tool: discipline_gate 不是（反例）', false, isWriteTool('discipline_gate'))
t('write-tool: 大小写不敏感', true, isWriteTool('Write'))

// ── 写目标提取 ──
t('target: write 工具取 file_path', 'D:/x/a.txt', extractWriteTarget('write', { file_path: 'D:/x/a.txt', content: 'x' }))
t('target: edit 工具取 file_path', 'D:/x/a.txt', extractWriteTarget('edit', { file_path: 'D:/x/a.txt', old_string: 'a', new_string: 'b' }))
t('target: str_replace_editor 取 path', 'D:/y/b.md', extractWriteTarget('str_replace_editor', { path: 'D:/y/b.md' }))
t('target: 缺路径=null', null, extractWriteTarget('write', { content: 'x' }))
t('target: 非字符串=null', null, extractWriteTarget('write', { file_path: 42 }))

// ── 路径归一（Windows：大小写折叠+反斜杠归一）──
t('norm: 反斜杠→正斜杠', 'd:/deepseek/x', normalizeWinPath('D:\\DeepSeek\\x'))
t('norm: 大小写折叠', 'd:/deepseek/x', normalizeWinPath('d:/DEEPSEEK/x'))
t('norm: 尾斜杠去除', 'd:/deepseek', normalizeWinPath('D:/DeepSeek/'))

// ── 边界判定（验收 b：≥10 例越区语料）──
const CWD = 'D:\\DeepSeek\\dsh-plugin-dev'
const B = (p, extra) => judgeWorkspaceBoundary(CWD, p, extra)
// 区内（正例，放行）
t('in: 区内绝对路径', true, B('D:\\DeepSeek\\dsh-plugin-dev\\src\\a.ts'))
t('in: 区内相对路径（按 cwd 解析）', true, B('src\\a.ts'))
t('in: 大小写变体仍区内', true, B('d:/deepseek/DSH-PLUGIN-DEV/src/a.ts'))
t('in: cwd 本身', true, B('D:\\DeepSeek\\dsh-plugin-dev'))
// 越区（反例，拦截判定）——10 例越区语料
t('out: 1 同盘他目录', false, B('D:\\Windows\\system32\\config'))
t('out: 2 用户目录', false, B('C:\\Users\\zxc66\\.ssh\\authorized_keys'))
t('out: 3 跨盘', false, B('E:\\other\\proj\\x.txt'))
t('out: 4 上级目录逃逸', false, B('..\\..\\Windows\\evil.dll'))
t('out: 5 上级一级', false, B('..\\dsh-custom\\x.md'))
t('out: 6 系统临时目录', false, B('C:\\Windows\\Temp\\t.bat'))
t('out: 7 Program Files', false, B('C:\\Program Files\\app\\cfg.ini'))
t('out: 8 启动项', false, B('C:\\Users\\zxc66\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\run.cmd'))
t('out: 9 家目录点文件', false, B('C:\\Users\\zxc66\\.gitconfig'))
t('out: 10 换行注入越区（防 \\n 前缀混淆）', false, B('\nD:\\DeepSeek\\dsh-plugin-dev-trap\\x'))
// 放行表（验收 d：合法跨区显式授权）
t('extra: 放行前缀命中', true, B('E:\\share\\assets\\logo.png', ['E:\\share\\assets']))
t('extra: 放行前缀大小写折叠', true, B('E:\\SHARE\\assets\\x', ['e:/share/assets']))
t('extra: 放行表不等于逃逸（无命中仍拦）', false, B('E:\\other\\x', ['E:\\share\\assets']))

// ── 对账遥测条目（F3/F5）──
t('audit: workspace-write 越区记录含完整对账字段', {
  kind: 'write-audit', tool: 'write', path: 'D:/Windows/system32/config', mode: 'workspace-write', inWorkspace: false, enforcement: 'host-sandbox(对账)',
}, buildWriteAuditEntry('write', 'D:/Windows/system32/config', 'workspace-write', false))
t('audit: 完全权限档记录不弹卡（F5：enforcement=record-only）', {
  kind: 'write-audit', tool: 'write', path: 'D:/x/a.txt', mode: 'danger-full-access', inWorkspace: false, enforcement: 'record-only',
}, buildWriteAuditEntry('write', 'D:/x/a.txt', 'danger-full-access', false))
t('audit: 只读档写尝试记录（宿主执法）', {
  kind: 'write-audit', tool: 'edit', path: 'D:/DeepSeek/dsh-plugin-dev/src/a.ts', mode: 'read-only', inWorkspace: true, enforcement: 'host-sandbox(对账)',
}, buildWriteAuditEntry('edit', 'D:/DeepSeek/dsh-plugin-dev/src/a.ts', 'read-only', true))

// ── 汇总 ──
console.log(cases.join('\n'))
console.log(`\n=== workspace-boundary: ${pass} pass / ${fail} fail ===`)
if (fail > 0) process.exit(1)
