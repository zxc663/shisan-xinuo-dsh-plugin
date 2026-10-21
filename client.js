// dsh-custom 浏览器半（管理后台重构版）：设置区「DSH自定义」
// ① 会话管理 ② 系统提示词管理 ③ 快照与恢复 ④ 统计数据
// 形态：__ModuleLoader__.load 内联 factory；仅依赖宿主 externals（react）；数据来自同源 /api/dsh-custom/*。
// 视觉：只使用宿主已暴露主题 token（--dsw-alias-*），不引用不存在的 layer-3/tertiary/business 等。
window.__ModuleLoader__.load({
  id: 'dsh-custom',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useCallback, useRef } = React;

    const PLUGIN_ID = 'dsh-custom';

    const CSS = [
      '.dshc{width:100%;max-width:1280px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:12px;font-size:14px;line-height:21px}',
      '.dshc_top{display:flex;align-items:center;gap:16px;padding-bottom:10px;border-bottom:1px solid var(--dsw-alias-border-l2)}',
      '.dshc_brand{font-size:16px;font-weight:700}',
      '.dshc_brand span{font-size:12px;font-weight:400;color:var(--dsw-alias-label-secondary);margin-left:8px}',
      '.dshc_nav{display:flex;gap:4px;flex-wrap:wrap;padding:2px 0 4px}',
      '.dshc_nav button{border:1px solid transparent;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;padding:6px 12px;border-radius:7px;cursor:pointer}',
      '.dshc_nav button:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.dshc_nav button[data-active=true]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:600}',
      '.dshc_split{display:grid;grid-template-columns:280px minmax(0,1fr);gap:14px;align-items:start}',
      '.dshc_panel{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:9px;min-width:0}',
      '.dshc_ph{display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid var(--dsw-alias-border-l2)}',
      '.dshc_ph h3{margin:0;font-size:15px;white-space:nowrap;flex:none}',
      '.dshc_spacer{flex:1}',
      '.dshc_btn{border:1px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:6px 12px;cursor:pointer;white-space:nowrap}',
      '.dshc_btn:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.dshc_btn:disabled{opacity:.55;cursor:default}',
      '.dshc_btn[data-primary=true]{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:#fff;font-weight:600}',
      '.dshc_btn[data-danger=true]{background:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary);color:#fff;font-weight:600}',
      '.dshc_btn[data-softdanger=true]{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary) 45%, var(--dsw-alias-border-l2))}',
      '.dshc_btn[data-softdanger=true]:hover{background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent)}',
      '.dshc_search{margin:10px 12px;width:calc(100% - 24px);padding:6px 9px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit}',
      '.dshc_list{list-style:none;margin:0;padding:0 10px 10px;display:flex;flex-direction:column;gap:8px}',
      '.dshc_srow{padding:9px 11px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;cursor:pointer}',
      '.dshc_srow:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.dshc_srow[data-sel=true]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}',
      '.dshc_srow .l1{display:flex;justify-content:space-between;color:var(--dsw-alias-label-secondary);font-size:12px}',
      '.dshc_srow .l2{color:var(--dsw-alias-label-secondary);font-size:12px;margin-top:2px}',
      '.dshc_srow .l3{font-weight:600;margin-top:4px}',
      '.dshc_pill{font-size:12px;border-radius:5px;padding:1px 6px}',
      '.dshc_pill[data-t=ok]{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent)}',
      '.dshc_pill[data-t=warn]{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent)}',
      '.dshc_pill[data-t=err]{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent)}',
      '.dshc_dh{padding:12px 14px}',
      '.dshc_dh .t{font-size:15px;font-weight:700}',
      '.dshc_dh .m{color:var(--dsw-alias-label-secondary);font-size:12px;margin-top:4px}',
      '.dshc_segs{display:flex;gap:4px 3px;padding:0 14px 6px;flex-wrap:wrap;align-items:center}',
      '.dshc_segs button{border:1px solid transparent;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;padding:4px 6px;border-radius:6px;cursor:pointer}',
      '.dshc_segs button[data-active=true]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:600}',
      '.dshc_dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-brand-primary);margin-right:5px;vertical-align:1px}',
      '.dshc_body{padding:0 14px 14px}',
      '.dshc_ta{width:100%;box-sizing:border-box;min-height:220px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);padding:10px;font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px;line-height:18px;resize:vertical}',
      '.dshc_row{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap}',
      '.dshc_actions{position:sticky;bottom:0;z-index:2;background:var(--dsw-alias-bg-base);padding:8px 0;margin-top:8px;border-top:1px solid var(--dsw-alias-border-l2)}',
      '.dshc_hint{color:var(--dsw-alias-label-secondary);font-size:12px}',
      '.dshc_err{border:1px solid var(--dsw-alias-state-error-primary);border-radius:8px;padding:10px 12px;color:var(--dsw-alias-state-error-primary);margin:0 14px 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}',
      '.dshc_cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:14px}',
      '.dshc_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:9px;padding:12px}',
      '.dshc_card .k{color:var(--dsw-alias-label-secondary);font-size:12px}',
      '.dshc_card .v{font-size:22px;font-weight:700;margin-top:6px}',
      '.dshc_card .s{color:var(--dsw-alias-label-secondary);font-size:12px;margin-top:4px}',
      '.dshc_grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}',
      '.dshc_barrow{display:grid;grid-template-columns:150px 1fr 64px;gap:10px;align-items:center;margin:9px 0}',
      '.dshc_bar{height:16px;border-radius:4px;background:var(--dsw-alias-brand-primary)}',
      '.dshc_audit{list-style:none;margin:0;padding:0 14px 14px}',
      '.dshc_audit li{display:grid;grid-template-columns:110px 1fr 110px;gap:10px;padding:7px 0;border-bottom:1px solid var(--dsw-alias-border-l2);font-size:12px}',
      '.dshc_ok{color:var(--dsw-alias-state-success-primary)}.dshc_er{color:var(--dsw-alias-state-error-primary)}.dshc_wa{color:var(--dsw-alias-state-warn-primary)}',
      '.dshc_modalw{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:60}',
      '.dshc_modal{background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:18px;width:520px;max-width:92vw;max-height:80vh;overflow:auto}',
      '.dshc_modal h4{margin:0 0 10px;font-size:15px}',
      '.dshc_modal p{color:var(--dsw-alias-label-secondary);margin:7px 0;font-size:13px}',
      '.dshc_modal .acts{display:flex;gap:10px;margin-top:16px}',
      '.dshc_toast{position:fixed;right:22px;bottom:22px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:11px 15px;max-width:340px;z-index:70;box-shadow:0 8px 24px rgba(0,0,0,.35)}',
      '.dshc_toast .t{font-weight:600;font-size:13px;margin-bottom:2px}',
      '.dshc_toast .m{color:var(--dsw-alias-label-secondary);font-size:12px}',
      '.dshc_empty{color:var(--dsw-alias-label-secondary);padding:20px;text-align:center}',
      '.dshc_conv{max-height:360px;overflow:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 10px;margin-top:8px;display:flex;flex-direction:column;gap:10px}',
      '.dshc_convmsg .h{font-size:12px;color:var(--dsw-alias-label-secondary);margin-bottom:3px}',
      '.dshc_convmsg .h .t{margin-left:8px}',
      '.dshc_convmsg .b{white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:19px}',
      '.dshc_convmsg[data-role=assistant] .b{color:var(--dsw-alias-label-secondary)}',
      '.dshc_prevlist{margin:6px 0 0;padding-left:18px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px}',
      // 治理开关页（P46）
      '.dshc_trow{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2)}',
      '.dshc_tlabel{font-size:13px;font-weight:600}',
      '.dshc_tag{margin-left:8px;font-size:11px;color:var(--dsw-alias-state-warn-primary);border:1px solid currentColor;border-radius:4px;padding:0 5px;white-space:nowrap}',
      '.dshc_banner{margin:0 14px 10px;padding:10px 12px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:8px;color:var(--dsw-alias-state-error-primary);font-size:12px}',
      '.dshc_allow{padding:4px 14px 10px}',
      '.dshc_barrow2{display:grid;grid-template-columns:1fr 1fr 64px;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--dsw-alias-border-l2);font-size:12px}',
      '.dshc_barrow2 code{font-size:12px}',
      '.dshc_input{flex:1;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:7px 10px;color:inherit;font-size:12px}',
      '.dshc_switch{position:relative;width:44px;height:24px;border-radius:12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-label-secondary);cursor:pointer;padding:0;transition:background .15s;flex:none}',
      '.dshc_switch[aria-checked="true"]{background:var(--dsw-alias-brand-primary)}',
      '.dshc_switch:disabled{opacity:.45;cursor:not-allowed}',
      '.dshc_knob{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .15s;box-shadow:0 1px 3px rgba(0,0,0,.25)}',
      '.dshc_switch[aria-checked="true"] .dshc_knob{left:22px}',
      '.dshc_switch[data-locked="true"]{opacity:1;cursor:not-allowed;background:var(--dsw-alias-brand-primary)}',
      '.dshc_switch[data-locked="true"] .dshc_knob{left:22px}',
      '.dshc_lock{font-size:11px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l2);border-radius:4px;padding:0 5px;white-space:nowrap}',
      '.dshc_grid2c{display:grid;grid-template-columns:1fr 1fr;gap:0 22px}',
    ].join('\n');
    const CSS_TAG_ID = PLUGIN_ID + '/tab.css';
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_TAG_ID) + ']') === null) {
      const tag = document.createElement('style');
      tag.dataset.plugin = PLUGIN_ID;
      tag.dataset.pluginCss = CSS_TAG_ID;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    const base = (() => {
      try { return new URL('api/dsh-custom/', document.baseURI).pathname; } catch { return '/api/dsh-custom/'; }
    })();

    async function api(path, options) {
      const opts = options || {};
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs || 10000);
      try {
        const init = { headers: { accept: 'application/json' }, redirect: 'error', signal: ctrl.signal, method: opts.method || 'GET' };
        if (opts.body !== undefined) {
          init.headers['content-type'] = 'application/json';
          init.body = JSON.stringify(opts.body);
        }
        const r = await fetch(base + path, init);
        const text = await r.text();
        let j = null;
        try { j = JSON.parse(text); } catch { throw new Error('响应不是 JSON（HTTP ' + r.status + '）'); }
        if (!j || j.ok !== true) {
          const e = new Error((j && j.error) || ('HTTP ' + r.status));
          e.status = r.status; // P1-6：409=乐观锁冲突（调用方据此弹「重新加载/覆盖」）
          e.conflict = j && j.conflict ? j.conflict : null;
          throw e;
        }
        return j.value;
      } finally {
        clearTimeout(timer);
      }
    }

    function fmtTime(iso) {
      if (!iso) return '—';
      try { return new Date(iso).toLocaleString(); } catch { return iso; }
    }

    // ── 弹窗 / toast / 未实现 ──
    // P1-8 焦点陷阱：打开时记住触发点并聚焦弹窗内首个可聚焦元素；Tab/Shift+Tab 在弹窗内循环；
    // 关闭后焦点还原触发点。effect 只在 open 切换时跑（closeRef 保持监听读到最新 onClose），
    // 避免弹窗内输入引起重渲染时被重新聚焦（否则输入框会丢焦点）。
    function Modal(props) {
      const boxRef = useRef(null);
      const restoreRef = useRef(null);
      const closeRef = useRef(props.onClose);
      closeRef.current = props.onClose;
      useEffect(() => {
        if (!props.open) return;
        restoreRef.current = document.activeElement;
        const box = boxRef.current;
        const focusables = () => {
          if (!box) return [];
          return Array.prototype.slice.call(box.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
            .filter((el) => !el.disabled);
        };
        const first = focusables()[0];
        try { (first || box).focus({ preventScroll: true }); } catch { /* 聚焦失败不阻塞弹窗 */ }
        const onKey = (e) => {
          if (e.key === 'Escape') { closeRef.current(); return; }
          if (e.key !== 'Tab') return;
          const list = focusables();
          if (list.length === 0) return;
          const idx = list.indexOf(document.activeElement);
          if (e.shiftKey) {
            if (idx <= 0) { e.preventDefault(); list[list.length - 1].focus(); }
          } else if (idx === -1 || idx === list.length - 1) {
            e.preventDefault(); list[0].focus();
          }
        };
        window.addEventListener('keydown', onKey, true);
        return () => {
          window.removeEventListener('keydown', onKey, true);
          const target = restoreRef.current;
          if (target && typeof target.focus === 'function' && document.contains(target)) {
            try { target.focus({ preventScroll: true }); } catch { /* 还原失败不阻塞关闭 */ }
          }
        };
      }, [props.open]); // eslint-disable-line react-hooks/exhaustive-deps
      if (!props.open) return null;
      return h('div', { className: 'dshc_modalw', role: 'presentation', onClick: (e) => { if (e.target === e.currentTarget) props.onClose(); } },
        h('div', { className: 'dshc_modal', ref: boxRef, tabIndex: -1, role: 'dialog', 'aria-modal': 'true', 'aria-label': props.title || '对话框' },
          h('h4', null, props.title),
          props.children,
          h('div', { className: 'acts' },
            props.actions || h('button', { className: 'dshc_btn', onClick: props.onClose }, '关闭'))));
    }
    function Toast(props) {
      if (!props.msg) return null;
      return h('div', { className: 'dshc_toast' },
        h('div', { className: 't' }, props.msg.title),
        props.msg.detail ? h('div', { className: 'm' }, props.msg.detail) : null);
    }

    // ── 导入/导出弹窗（P1-3，#决策 12：JSON＋剪贴板＋边输入边预览）──
    // 会话域与全局域共用：props={ scope, sessionId, title, hint, buildExport, apply, onApplied, onClose }
    const IO_SEG_LABELS = { discipline: '前置纪律', user: '我的提示词', system: '整段接管', layered: '渐进加载层' };
    function parseImportJson(txt, scope, sessionId) {
      if (!txt || !txt.trim()) return { error: null, plan: null };
      let j;
      try { j = JSON.parse(txt); } catch (e) { return { error: 'JSON 解析失败：' + String((e && e.message) || e), plan: null }; }
      if (!j || typeof j !== 'object' || Array.isArray(j)) return { error: '顶层必须是 JSON 对象', plan: null };
      if (j.format !== 'dsh-custom/export') return { error: '不是本插件的导出格式（format 应为 "dsh-custom/export"）', plan: null };
      if (j.version !== 1) return { error: '版本不支持：' + String(j.version) + '（本窗口支持 version 1）', plan: null };
      if (j.scope !== scope) return { error: '作用域不匹配：这份 JSON 是 ' + String(j.scope) + ' 导出，本窗口只接受 ' + (scope === 'session' ? '会话（session）' : '全局（global）') + ' 导出', plan: null };
      if (scope === 'session' && typeof j.sessionId === 'string' && j.sessionId.length > 0 && j.sessionId !== sessionId) {
        return { error: '会话不匹配：导出的是 ' + j.sessionId.replace(/^session-/, '').slice(0, 8) + '，当前选中的是 ' + String(sessionId || '').replace(/^session-/, '').slice(0, 8) + '（防串档，已在会话页选中目标会话再导入）', plan: null };
      }
      const segs = j.segments;
      if (!segs || typeof segs !== 'object' || Array.isArray(segs)) return { error: 'segments 缺失或不是对象', plan: null };
      const plan = {};
      for (const k of ['discipline', 'user', 'system', 'layered']) {
        if (!(k in segs)) continue;
        const v = segs[k];
        if (v === null) { plan[k] = { action: 'clear', chars: 0 }; continue; }
        if (typeof v !== 'string') return { error: '段「' + IO_SEG_LABELS[k] + '」必须是字符串或 null', plan: null };
        plan[k] = v.trim().length === 0 ? { action: 'clear', chars: 0 } : { action: 'write', chars: v.length, text: v };
      }
      if (Object.keys(plan).length === 0) return { error: '没有任何可应用的段（segments 全为空对象）', plan: null };
      return { error: null, plan };
    }
    function ExportImportModal(props) {
      const [text, setText] = useState('');
      const [applying, setApplying] = useState(false);
      const [applyErr, setApplyErr] = useState(null);
      const [copied, setCopied] = useState(false);
      const parsed = parseImportJson(text, props.scope, props.sessionId);
      const plan = parsed.plan;
      const systemWrite = !!(plan && plan.system && plan.system.action === 'write');
      const fill = () => {
        try { setText(JSON.stringify(props.buildExport(), null, 2)); setApplyErr(null); } catch (e) { setApplyErr(String((e && e.message) || e)); }
      };
      const copy = async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }
        catch { setApplyErr('复制失败——请手动全选文本框内容复制（Ctrl+A / Ctrl+C）'); }
      };
      return h(Modal, { open: true, title: props.title, onClose: props.onClose,
        actions: h('div', { className: 'dshc_row' }, h('button', { className: 'dshc_btn', onClick: props.onClose }, '关闭')) },
        h('div', null,
          h('p', null, props.hint),
          h('div', { className: 'dshc_row' },
            h('button', { className: 'dshc_btn', onClick: fill }, '导出到下方文本框'),
            h('button', { className: 'dshc_btn', disabled: !text, onClick: () => void copy() }, copied ? '已复制' : '复制'),
            h('button', { className: 'dshc_btn', disabled: !text, onClick: () => { setText(''); setApplyErr(null); } }, '清空')),
          h('textarea', { className: 'dshc_ta', style: { minHeight: 170, marginTop: 8 }, value: text, onChange: (e) => { setText(e.target.value); setApplyErr(null); }, placeholder: '把导出的 JSON 粘贴到这里（Ctrl+V）→ 下方实时预览；或点上方「导出到下方文本框」把当前内容生成为 JSON' }),
          parsed.error ? h('div', { className: 'dshc_err', style: { margin: '10px 0 0' } }, h('span', null, parsed.error)) : null,
          plan ? h('div', { style: { marginTop: 10 } },
            h('div', { className: 'dshc_hint' }, '预览（点应用后按此写入）：'),
            h('ul', { className: 'dshc_prevlist' },
              ['discipline', 'user', 'system', 'layered'].map((k) => {
                const p = plan[k];
                const desc = p ? (p.action === 'write' ? '写入 ' + p.chars + ' 字' : '清除该段覆盖（留空＝关闭）') : '不包含（保持现状）';
                return h('li', { key: k }, IO_SEG_LABELS[k] + '：' + desc);
              })),
            systemWrite ? h('div', { className: 'dshc_banner', style: { margin: '8px 0 0' } }, '⚠ 导入包含整段接管：保存后会替换该作用域的全部系统提示词段（含运行时核心与官方段），请确认文本来源可信。') : null,
            h('div', { className: 'dshc_row', style: { marginTop: 10 } },
              h('button', { className: 'dshc_btn', 'data-primary': true, disabled: applying, onClick: async () => {
                setApplying(true); setApplyErr(null);
                try { await props.apply(plan); props.onApplied(); }
                catch (e) { setApplyErr(String((e && e.message) || e)); }
                finally { setApplying(false); }
              } }, applying ? '应用中…' : (systemWrite ? '确认导入（含整段接管）' : '应用导入'))))
          : null,
          applyErr ? h('div', { className: 'dshc_err', style: { margin: '10px 0 0' } }, h('span', null, '应用失败：' + applyErr)) : null));
    }

    // ── ① 会话管理 ──
    function SessionsPage(props) {
      const [sessions, setSessions] = useState([]);
      const [activeId, setActiveId] = useState('');
      const [search, setSearch] = useState('');
      const [detail, setDetail] = useState(null);
      const [segs, setSegs] = useState(null);
      const [segsMeta, setSegsMeta] = useState({});
      const [seg, setSeg] = useState('current');
      const [editing, setEditing] = useState(false);
      const [draft, setDraft] = useState('');
      const [baseline, setBaseline] = useState('');
      const [dirty, setDirty] = useState(false);
      const [busy, setBusy] = useState(false);
      const [msg, setMsg] = useState(null);
      const [err, setErr] = useState(null);
      const [modal, setModal] = useState(null);
      const [ioOpen, setIoOpen] = useState(false);
      const detailSeq = useRef(0);

      // 跨页防丢：把「正在编辑且未保存」上报给外壳（切页统一确认）
      useEffect(() => { if (props.onDirty) props.onDirty(editing && dirty); }, [editing, dirty]); // eslint-disable-line react-hooks/exhaustive-deps
      useEffect(() => () => { if (props.onDirty) props.onDirty(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

      const loadSessions = useCallback(async () => {
        try {
          const v = await api('sessions');
          setSessions(v.sessions || []);
          if (!activeId && (v.sessions || []).length > 0) setActiveId(v.sessions[0].id);
        } catch (e) { setErr('会话列表读取失败：' + String((e && e.message) || e)); }
      }, [activeId]);
      useEffect(() => { void loadSessions(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

      // 10s 轮询：只更新列表，不动编辑器
      useEffect(() => {
        const t = setInterval(() => { void loadSessions(); }, 10000);
        return () => clearInterval(t);
      }, [loadSessions]);

      const loadDetail = useCallback(async (id) => {
        if (!id) return;
        const seq = ++detailSeq.current;
        setErr(null);
        setMsg(null);
        try {
          const asmPath = 'assembly?session=' + encodeURIComponent(id);
          const r = await Promise.all([api(asmPath), api('sessions/' + encodeURIComponent(id) + '/override')]);
          if (seq !== detailSeq.current) return; // 快速切会话：晚到响应不得覆盖当前详情
          setDetail(r[0]);
          setSegs(r[1].segments || {});
          setSegsMeta(r[1].mtimes || {});
          setEditing(false);
          setDirty(false);
        } catch (e) {
          if (seq === detailSeq.current) setErr('会话详情读取失败：' + String((e && e.message) || e));
        }
      }, []);
      useEffect(() => { void loadDetail(activeId); }, [activeId, loadDetail]);

      const requestSwitch = (fn) => {
        if (!dirty) { fn(); return; }
        setModal({
          title: '放弃未保存的修改？',
          body: h('div', null,
            h('p', null, '切换后本次编辑会丢失。'),
            h('p', null, '先保存再切换可保留改动。')),
          actions: h('div', { className: 'dshc_row' },
            h('button', { className: 'dshc_btn', 'data-danger': true, onClick: () => { setModal(null); setDirty(false); fn(); } }, '放弃并切换'),
            h('button', { className: 'dshc_btn', onClick: () => setModal(null) }, '继续编辑')),
        });
      };
      const selectSession = (id) => {
        if (id === activeId) return;
        requestSwitch(() => { setActiveId(id); setSeg('current'); setEditing(false); });
      };
      const switchSeg = (k) => {
        if (k === seg) return;
        requestSwitch(() => { setSeg(k); setEditing(false); });
      };

      const segDefs = [
        ['current', '当前全文'],
        ['discipline', '前置纪律'],
        ['user', '我的提示词'],
        ['system', '整段接管'],
        ['scope', '本会话覆盖'],
      ];
      const segLabelOf = (k) => (segDefs.find(([sk]) => sk === k) || [])[1] || k;
      const effectiveSection = (name) => {
        const list = (detail && Array.isArray(detail.sections)) ? detail.sections : [];
        const hit = list.find((s) => s.name === name);
        return hit && typeof hit.text === 'string' ? hit.text : '';
      };
      const segValue = () => {
        if (seg === 'current') return (detail && detail.rendered) || '（暂无渲染内容）';
        if (seg === 'discipline') return (segs && segs.discipline) || effectiveSection('dsh-custom:discipline') || '（本会话未设置前置纪律；全局/工作区当前也为空）';
        if (seg === 'user') return (segs && segs.user) || effectiveSection('dsh-custom:user-prompt') || '（本会话未设置我的提示词；全局当前也为空）';
        if (seg === 'system') return (segs && segs.system) || (detail && detail.rendered) || '（暂无）';
        if (seg === 'scope') {
          const parts = segs ? Object.keys(segs).filter((k) => segs[k] !== null && segs[k] !== undefined) : [];
          return parts.length ? '本会话覆盖段：' + parts.join('、') + '\n\n优先级：会话级 > 全局（全局改动不覆盖本会话）' : '本会话未设置覆盖（跟随全局）';
        }
        return '';
      };
      const segNote = () => {
        if (seg === 'discipline' && !(segs && segs.discipline)) return '本会话未设置前置纪律；下面显示当前实际生效内容（来自全局或工作区）。编辑并保存会创建会话级覆盖。';
        if (seg === 'user' && !(segs && segs.user)) return '本会话未设置我的提示词；下面显示当前实际生效内容（来自全局）。编辑并保存会创建会话级覆盖。';
        if (seg === 'system') return '整段接管：保存后用下面文本替换该会话的全部系统提示词段（含运行时核心、官方与其它外部段）。未接管时这里是当前完整提示词。';
        return '';
      };
      const editSeed = () => {
        if (seg === 'system') return (segs && segs.system) || (detail && detail.rendered) || '';
        if (seg === 'discipline') return (segs && segs.discipline) || effectiveSection('dsh-custom:discipline') || '';
        if (seg === 'user') return (segs && segs.user) || effectiveSection('dsh-custom:user-prompt') || '';
        return (segs && segs[seg]) || segValue();
      };
      const beginEdit = () => {
        const seed = editSeed();
        setDraft(seed);
        setBaseline(seed);
        setDirty(false);
        setEditing(true);
      };
      const cancelEdit = () => { setEditing(false); setDirty(false); };

      // P1-6 乐观锁：保存带基线 mtime；409 → 「重新加载 / 仍要覆盖」由用户决定
      const showConflict = (e) => {
        setModal({
          title: '内容已在别处被修改',
          body: h('div', null,
            h('p', null, String((e && e.message) || '当前版本与你的编辑基线不一致。')),
            h('p', null, '「重新加载」查看最新内容（放弃你的本次修改）；「仍要覆盖」用你编辑的内容覆盖对方改动。')),
          actions: h('div', { className: 'dshc_row' },
            h('button', { className: 'dshc_btn', onClick: () => { setModal(null); cancelEdit(); void loadDetail(activeId); setMsg({ title: '已重新加载', detail: '未保存的修改已丢弃；可再次点「修改」基于最新内容编辑。' }); } }, '重新加载（放弃我的修改）'),
            h('button', { className: 'dshc_btn', 'data-danger': true, onClick: () => { setModal(null); void save(true); } }, '仍要覆盖（用我的版本）')),
        });
      };
      const save = async (force) => {
        if (!activeId || busy) return;
        setBusy(true);
        try {
          const expectedFor = (keys) => {
            const m = {};
            for (const k of keys) m[k] = Object.prototype.hasOwnProperty.call(segsMeta, k) ? segsMeta[k] : null;
            return m;
          };
          if (seg === 'system' && draft.trim().length === 0) {
            const body = { segments: { system: '' } };
            if (!force) body.expectedMtimes = expectedFor(['system']);
            await api('sessions/' + encodeURIComponent(activeId) + '/override', { method: 'PUT', body });
            await loadDetail(activeId);
            setMsg({ title: '已清除整段接管', detail: '该会话回到全局/官方系统提示词；没有创建空提示词。' });
            return;
          }
          const segments = {};
          if (seg === 'discipline' || seg === 'user' || seg === 'system') segments[seg] = draft;
          if (Object.keys(segments).length === 0) return;
          const body = { segments };
          if (!force) body.expectedMtimes = expectedFor(Object.keys(segments));
          await api('sessions/' + encodeURIComponent(activeId) + '/override', { method: 'PUT', body });
          setDirty(false);
          await loadDetail(activeId);
          setMsg({ title: '已保存', detail: '会话级覆盖已落盘＋快照；下一条消息生效。全局改动不会覆盖本会话。' });
        } catch (e) {
          if (e && e.status === 409 && !force) { setBusy(false); showConflict(e); return; }
          setErr('保存失败：' + String((e && e.message) || e));
        }
        finally { setBusy(false); }
      };
      const requestSave = () => {
        if (seg !== 'system' || draft.trim().length === 0) { void save(); return; }
        setModal({
          title: '整段接管本会话系统提示词？',
          body: h('div', null,
            h('p', null, '保存后，该会话的官方提示词、运行时核心与其它外部段都会被下面文本替换。'),
            h('p', null, '只影响本会话；可回滚到上一版或官方。')),
          actions: h('div', { className: 'dshc_row' },
            h('button', { className: 'dshc_btn', 'data-danger': true, onClick: () => { setModal(null); void save(); } }, '确认整段接管'),
            h('button', { className: 'dshc_btn', onClick: () => setModal(null) }, '取消')),
        });
      };

      // ── P1-3：对话弹窗（只读）＋导入/导出 ──
      const openConversation = async () => {
        if (!activeId || busy) return;
        setBusy(true);
        try {
          const v = await api('sessions/' + encodeURIComponent(activeId) + '/conversation');
          const hiddenNote = v.hidden > 0
            ? '已隐藏 ' + v.hidden + ' 条非对话条目（纪律/状态行/审批应答/系统快照等注入件）。'
            : '没有需要隐藏的注入条目。';
          setModal({
            title: '会话对话（只读）',
            body: h('div', null,
              h('p', null, '仅显示对话文本（不含思考/工具调用）；' + hiddenNote + (v.omitted > 0 ? ' 更早的 ' + v.omitted + ' 条已省略。' : '')),
              (v.messages || []).length === 0
                ? h('div', { className: 'dshc_empty' }, '该会话还没有对话文本')
                : h('div', { className: 'dshc_conv' },
                  v.messages.map((m, i) => h('div', { key: i, className: 'dshc_convmsg', 'data-role': m.role },
                    h('div', { className: 'h' }, m.role === 'user' ? '你' : '助手', h('span', { className: 't' }, m.time ? new Date(m.time).toLocaleString() : '')),
                    h('div', { className: 'b' }, m.text + (m.truncated ? '\n…（过长已截断）' : '')))))),
            actions: h('div', { className: 'dshc_row' }, h('button', { className: 'dshc_btn', onClick: () => setModal(null) }, '关闭')),
          });
        } catch (e) { setErr('对话读取失败：' + String((e && e.message) || e)); }
        finally { setBusy(false); }
      };
      const buildSessionExport = () => ({
        format: 'dsh-custom/export',
        version: 1,
        scope: 'session',
        sessionId: activeId,
        exportedAt: new Date().toISOString(),
        segments: {
          discipline: segs && segs.discipline !== undefined ? segs.discipline : null,
          user: segs && segs.user !== undefined ? segs.user : null,
          system: segs && segs.system !== undefined ? segs.system : null,
          layered: segs && segs.layered !== undefined ? segs.layered : null,
        },
      });
      const applySessionImport = async (plan) => {
        const segments = {};
        const expectedMtimes = {};
        for (const k of Object.keys(plan)) {
          segments[k] = plan[k].action === 'clear' ? '' : plan[k].text;
          expectedMtimes[k] = Object.prototype.hasOwnProperty.call(segsMeta, k) ? segsMeta[k] : null;
        }
        await api('sessions/' + encodeURIComponent(activeId) + '/override', { method: 'PUT', body: { segments, expectedMtimes } });
        await loadDetail(activeId);
      };

      const doRollback = async (target) => {
        setModal(null);
        if (busy) return;
        setBusy(true);
        try {
          const r = await api('sessions/' + encodeURIComponent(activeId) + '/rollback', { method: 'POST', body: { target } });
          await loadDetail(activeId);
          setMsg({ title: '已回滚', detail: target === 'previous' ? '已恢复上一版（' + (r.restored || []).join('、') + '）' : '已清除本会话覆盖（回到官方/全局）' });
        } catch (e) { setErr('回滚失败：' + String((e && e.message) || e)); }
        finally { setBusy(false); }
      };

      const q = search.toLowerCase();
      const filtered = sessions.filter((s) => !q || ((s.cwd || '') + ' ' + (s.model || '') + ' ' + (s.title || '') + ' ' + s.id).toLowerCase().includes(q));
      const activeRow = sessions.find((x) => x.id === activeId) || null;

      return h('div', null,
        props.toast && props.toast.msg ? h(Toast, { msg: props.toast.msg }) : null,
        h(Modal, { open: modal !== null, title: modal ? modal.title : '', onClose: () => setModal(null), actions: modal ? modal.actions : null },
          modal ? modal.body : null),
        ioOpen ? h(ExportImportModal, {
          scope: 'session',
          sessionId: activeId,
          title: '导入/导出（本会话）',
          hint: '导出＝把当前选中会话的覆盖段生成为 JSON（可复制留档/迁移）；导入＝粘贴 JSON，预览后应用到本会话。会话不匹配的导出会被拒绝（防串档）。',
          buildExport: buildSessionExport,
          apply: applySessionImport,
          onApplied: () => { setIoOpen(false); setMsg({ title: '导入完成', detail: '已按预览写入本会话；下一条消息生效。' }); },
          onClose: () => setIoOpen(false),
        }) : null,
        err ? h('div', { className: 'dshc_err' }, h('span', null, err)) : null,
        h('div', { className: 'dshc_split' },
          h('aside', { className: 'dshc_panel' },
            h('div', { className: 'dshc_ph' }, h('h3', null, '会话列表'), h('span', { className: 'dshc_spacer' }),
              h('button', { className: 'dshc_btn', disabled: busy, onClick: () => void loadSessions() }, '刷新')),
            h('input', { className: 'dshc_search', placeholder: '搜索工作区 / 会话名 / 会话 id', value: search, onChange: (e) => setSearch(e.target.value) }),
            h('ul', { className: 'dshc_list' },
              filtered.length === 0
                ? h('li', { className: 'dshc_empty' }, '无匹配会话')
                : filtered.map((s) => h('li', {
                    key: s.id,
                    className: 'dshc_srow',
                    'data-sel': s.id === activeId,
                    onClick: () => selectSession(s.id),
                  },
                    h('div', { className: 'l1' }, h('span', null, s.cwd || '—'), s.id === activeId ? h('span', { className: 'dshc_pill', 'data-t': 'ok' }, '已选') : null),
                    h('div', { className: 'l2' }, s.id.replace(/^session-/, '').slice(0, 8) + ' ｜ ' + (s.model || '模型未上报')),
                    h('div', { className: 'l3' }, s.title || ('未命名会话 · ' + s.id.replace(/^session-/, '').slice(0, 8)))
                  )))
          ),
          h('div', { className: 'dshc_panel' },
            detail ? h('div', null,
              h('div', { className: 'dshc_dh' },
                h('div', { className: 't' }, (detail.scopeLabel || '会话')),
                h('div', { className: 'm' }, '模型 ' + ((activeRow && activeRow.model) || '模型未上报') + ' · 生成于 ' + fmtTime(detail.generatedAt) + ' · 渲染器' + (detail.rendererAvailable ? '在线' : '不可用（已降级原文）'))),
              h('div', { className: 'dshc_segs', role: 'tablist' },
                segDefs.map(([k, label]) => {
                  const overridden = (k === 'discipline' || k === 'user' || k === 'system') && !!(segs && segs[k]);
                  return h('button', {
                    key: k,
                    role: 'tab',
                    'aria-selected': seg === k,
                    'data-active': seg === k,
                    title: overridden ? '本会话已设置覆盖（优先于全局）；无圆点=跟随全局/工作区' : undefined,
                    onClick: () => switchSeg(k),
                  },
                    overridden ? h('span', { className: 'dshc_dot', 'aria-hidden': 'true' }) : null,
                    label);
                })),
              h('div', { className: 'dshc_body' },
                segNote() ? h('div', { className: 'dshc_hint', style: { marginBottom: 6 } }, segNote()) : null,
                editing
                  ? h('textarea', { className: 'dshc_ta', value: draft, onChange: (e) => { const v = e.target.value; setDraft(v); setDirty(v !== baseline); } })
                  : h('textarea', { className: 'dshc_ta', readOnly: true, value: segValue() }),
                h('div', { className: 'dshc_row dshc_actions' },
                  editing ? h('button', { className: 'dshc_btn', 'data-primary': true, disabled: busy || !dirty, onClick: requestSave }, busy ? '保存中…' : '保存') : null,
                  editing ? h('button', { className: 'dshc_btn', disabled: busy, onClick: cancelEdit }, '取消修改') : null,
                  !editing && (seg === 'discipline' || seg === 'user' || seg === 'system') ? h('button', { className: 'dshc_btn', disabled: busy, onClick: beginEdit }, '修改「' + segLabelOf(seg) + '」') : null,
                  !editing ? h('button', { className: 'dshc_btn', disabled: busy, 'data-softdanger': true, style: { marginLeft: 'auto' }, onClick: () => setModal({
                    title: '回滚本会话提示词？',
                    body: h('div', null,
                      h('p', null, '回滚前会自动再快照，可反悔。'),
                      h('p', null, '「回到上一版」只恢复上一次保存前的内容；「回到官方」清除本会话全部覆盖。'),
                      h('div', { className: 'dshc_row' },
                        h('button', { className: 'dshc_btn', onClick: () => void doRollback('previous') }, '回到上一版'),
                        h('button', { className: 'dshc_btn', 'data-danger': true, onClick: () => void doRollback('official') }, '回到官方（清除本会话覆盖）'))),
                    actions: h('button', { className: 'dshc_btn', onClick: () => setModal(null) }, '取消'),
                  }) }, '回滚') : null,
                  !editing ? h('button', { className: 'dshc_btn', disabled: busy, onClick: () => setIoOpen(true) }, '导入/导出') : null,
                  !editing ? h('button', { className: 'dshc_btn', disabled: busy, onClick: () => void openConversation() }, '对话') : null),
                msg ? h('div', { className: 'dshc_hint', style: { marginTop: 8 } }, msg.title + '：' + (msg.detail || '')) : null))
              : h('div', { className: 'dshc_empty' }, '选择左侧会话查看详情')
          )));
    }

    // ── ② 系统提示词管理 ──
    function PromptsPage(props) {
      const factorySet = new Set(['00-加载清单.md', 'clarify-protocol.md', 'compression-reload.md', 'docking-truth-list.md', 'environment-inventory.md', 'goal-mode.md', 'l2f-full-workflow.md', 'l2s-short-workflow.md', 'requirements-challenge.md', 'resume-protocol.md', 'tool-triggers.md']); // 与出厂 content/layered 清单同步
      const [seg, setSeg] = useState('discipline');
      const [data, setData] = useState({ discipline: null, user: null, layered: null, override: null, asm: null });
      const [draft, setDraft] = useState('');
      const [baseline, setBaseline] = useState('');
      const [dirty, setDirty] = useState(false);
      const [busy, setBusy] = useState(false);
      const [msg, setMsg] = useState(null);
      const [err, setErr] = useState(null);
      const [modal, setModal] = useState(null);
      const [ioOpen, setIoOpen] = useState(false);
      const [newSec, setNewSec] = useState({ name: '', text: '' });
      const loadSeq = useRef(0);

      // 跨页防丢：把「正在编辑且未保存」上报给外壳（切页统一确认）
      useEffect(() => { if (props.onDirty) props.onDirty(dirty); }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
      useEffect(() => () => { if (props.onDirty) props.onDirty(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

      const load = useCallback(async () => {
        const seq = ++loadSeq.current;
        setMsg(null);
        try {
          const [d, u, l, o, a] = await Promise.all([api('discipline'), api('user-prompt'), api('layered'), api('override'), api('assembly')]);
          if (seq !== loadSeq.current) return;
          setData({ discipline: d, user: u, layered: l, override: o, asm: a });
          const next = (seg === 'discipline' ? d.sourceText : seg === 'user' ? u.text : seg === 'system' ? o.text : '') || '';
          setDraft(next);
          setBaseline(next);
          setDirty(false);
        } catch (e) {
          if (seq === loadSeq.current) setErr('读取失败：' + String((e && e.message) || e));
        }
      }, [seg]);
      useEffect(() => { void load(); }, [load]);

      // 实际生效内容（来自真实装配，只读）：运行时插件的纪律段＋宿主官方面
      const asmSections = (data.asm && data.asm.sections) || [];
      const effDiscipline = asmSections.find((s) => s.name === 'shisanxinuo:core-discipline');
      const officialSecs = asmSections.filter((s) => s.origin === 'official');
      const officialText = officialSecs.map((s) => s.text).join('\n\n');
      const officialNames = officialSecs.map((s) => s.name).join('、');
      const replaceNames = asmSections.map((s) => s.name).filter(Boolean);

      const segDefs = [['discipline', '前置纪律'], ['user', '我的提示词'], ['layered', '渐进加载层'], ['system', '整段接管']];
      const switchSeg = (k) => {
        if (k === seg) return;
        if (!dirty) { setSeg(k); return; }
        setModal({
          title: '放弃未保存的修改？',
          body: h('div', null, h('p', null, '切换后本次编辑会丢失。'), h('p', null, '先保存再切换可保留改动。')),
          actions: h('div', { className: 'dshc_row' },
            h('button', { className: 'dshc_btn', 'data-danger': true, onClick: () => { setModal(null); setDirty(false); setSeg(k); } }, '放弃并切换'),
            h('button', { className: 'dshc_btn', onClick: () => setModal(null) }, '继续编辑')),
        });
      };
      // P1-6 乐观锁：全局保存带基线 mtime；409 → 「重新加载 / 仍要覆盖」
      const showConflict = (e) => {
        setModal({
          title: '内容已在别处被修改',
          body: h('div', null,
            h('p', null, String((e && e.message) || '当前版本与你的编辑基线不一致。')),
            h('p', null, '「重新加载」查看最新内容（放弃你的本次修改）；「仍要覆盖」用你编辑的内容覆盖对方改动。')),
          actions: h('div', { className: 'dshc_row' },
            h('button', { className: 'dshc_btn', onClick: () => { setModal(null); void load(); setMsg({ title: '已重新加载', detail: '未保存的修改已丢弃；可基于最新内容重新编辑。' }); } }, '重新加载（放弃我的修改）'),
            h('button', { className: 'dshc_btn', 'data-danger': true, onClick: () => { setModal(null); void save(true); } }, '仍要覆盖（用我的版本）')),
        });
      };
      const save = async (force) => {
        if (busy) return;
        if (seg === 'system' && draft.trim().length === 0) {
          setBusy(true);
          try {
            await api('override/enable', { method: 'PUT', body: { enabled: false } });
            await load();
            setMsg({ title: '已恢复默认系统原版', detail: '没有创建空接管；模型重新使用官方提示词原文。' });
          } catch (e) { setErr('恢复失败：' + String((e && e.message) || e)); }
          finally { setBusy(false); }
          return;
        }
        if ((seg === 'discipline' || seg === 'user') && !dirty) {
          setMsg({ title: '没有改动', detail: '当前内容与已保存内容一致，未创建快照。' });
          return;
        }
        setBusy(true);
        try {
          const expDisc = data.discipline ? data.discipline.mtime : null;
          const expUser = data.user ? data.user.mtime : null;
          const expOver = data.override ? data.override.mtime : null;
          if (seg === 'discipline') {
            const body = { text: draft };
            if (!force) body.expectedMtime = expDisc;
            await api('discipline', { method: 'PUT', body });
          } else if (seg === 'user') {
            const body = { text: draft, enabled: data.user ? data.user.enabled : true };
            if (!force) body.expectedMtime = expUser;
            await api('user-prompt', { method: 'PUT', body });
          } else if (seg === 'system') {
            const body = { text: draft };
            if (!force) body.expectedMtime = expOver;
            await api('override', { method: 'PUT', body });
            await api('override/enable', { method: 'PUT', body: { enabled: true } });
          } else { return; }
          await load();
          setMsg({ title: '已保存', detail: '全局提示词已保存（快照＋落盘）；有会话级覆盖的会话不受影响。' });
        } catch (e) {
          if (e && e.status === 409 && !force) { setBusy(false); showConflict(e); return; }
          setErr('保存失败：' + String((e && e.message) || e));
        }
        finally { setBusy(false); }
      };
      const requestSaveSystem = () => {
        if (draft.trim().length === 0) { void save(); return; }
        setModal({
          title: '整段接管全局系统提示词？',
          body: h('div', null,
            h('p', null, '保存后，当前全部系统提示词段都会被下面文本替换——包括官方段、运行时核心（shisanxinuo:core-discipline）与其它外部段。'),
            h('p', null, '将替换 ' + replaceNames.length + ' 段：' + (replaceNames.slice(0, 6).join('、') || '（当前装配无段）') + (replaceNames.length > 6 ? ' 等' : '')),
            h('p', null, '保存前自动快照；可回滚。')),
          actions: h('div', { className: 'dshc_row' },
            h('button', { className: 'dshc_btn', 'data-danger': true, onClick: () => { setModal(null); void save(); } }, '确认整段接管'),
            h('button', { className: 'dshc_btn', onClick: () => setModal(null) }, '取消')),
        });
      };

      const editable = seg === 'discipline' || seg === 'user';
      const overrideOn = !!(data.override && data.override.enabled);
      // ── P1-3：全局导入/导出 ──
      const buildGlobalExport = () => ({
        format: 'dsh-custom/export',
        version: 1,
        scope: 'global',
        exportedAt: new Date().toISOString(),
        segments: {
          discipline: data.discipline ? (data.discipline.sourceText || null) : null,
          user: data.user && data.user.text ? data.user.text : null,
          system: data.override && data.override.text ? data.override.text : null,
        },
      });
      const applyGlobalImport = async (plan) => {
        const steps = [];
        if (plan.discipline) steps.push(() => api('discipline', { method: 'PUT', body: { text: plan.discipline.action === 'clear' ? '' : plan.discipline.text, expectedMtime: data.discipline ? data.discipline.mtime : null } }));
        if (plan.user) steps.push(() => api('user-prompt', { method: 'PUT', body: { text: plan.user.action === 'clear' ? '' : plan.user.text, enabled: true, expectedMtime: data.user ? data.user.mtime : null } }));
        if (plan.system) {
          steps.push(() => api('override', { method: 'PUT', body: { text: plan.system.action === 'clear' ? '' : plan.system.text, expectedMtime: data.override ? data.override.mtime : null } }));
          steps.push(() => api('override/enable', { method: 'PUT', body: { enabled: plan.system.action !== 'clear' } }));
        }
        for (let i = 0; i < steps.length; i++) {
          try {
            await steps[i]();
          } catch (e) {
            throw new Error('第 ' + String(i + 1) + ' / ' + String(steps.length) + ' 步失败（前 ' + String(i) + ' 步已写入）：' + String((e && e.message) || e));
          }
        }
        await load();
      };
      const restoreDefault = async () => {
        if (busy) return;
        setBusy(true);
        try {
          await api('override/enable', { method: 'PUT', body: { enabled: false } });
          await load();
          setMsg({ title: '已恢复默认系统原版', detail: '模型重新使用官方提示词原文；②里的草稿仍保留，随时可再保存接管' });
        } catch (e) { setErr('恢复失败：' + String((e && e.message) || e)); }
        finally { setBusy(false); }
      };

      return h('div', null,
        h(Modal, { open: modal !== null, title: modal ? modal.title : '', onClose: () => setModal(null), actions: modal ? modal.actions : null }, modal ? modal.body : null),
        ioOpen ? h(ExportImportModal, {
          scope: 'global',
          sessionId: null,
          title: '导入/导出（全局）',
          hint: '导出＝把全局前置纪律/我的提示词/整段接管生成为 JSON；导入＝粘贴 JSON，预览后写入全局。不含渐进加载层各分节（请在渐进层页逐节导出/编辑）。',
          buildExport: buildGlobalExport,
          apply: applyGlobalImport,
          onApplied: () => { setIoOpen(false); setMsg({ title: '导入完成', detail: '已按预览写入全局；有会话级覆盖的会话不受影响。' }); },
          onClose: () => setIoOpen(false),
        }) : null,
        h('div', { className: 'dshc_panel' },
          h('div', { className: 'dshc_ph' }, h('h3', null, '系统提示词管理（全局）'), h('span', { className: 'dshc_spacer' }),
            h('button', { className: 'dshc_btn', disabled: busy, onClick: () => setIoOpen(true) }, '导入/导出'),
            editable ? h('button', { className: 'dshc_btn', 'data-primary': true, disabled: busy || !dirty, onClick: () => void save() }, busy ? '保存中…' : '保存') : null),
          h('div', { className: 'dshc_segs', role: 'tablist' },
            segDefs.map(([k, label]) => h('button', { key: k, role: 'tab', title: { discipline: '追加在系统提示词最前面的补充要求（不替换纪律核心）', user: '你的个性化指令段（空＝不注入）', layered: '按需注入的流程分节——任务触发时才注入，用完即走', system: '高级：整段替换系统提示词（慎用）' }[k], 'aria-selected': seg === k, 'data-active': seg === k, onClick: () => switchSeg(k) }, label))),
          h('div', { className: 'dshc_body' },
            seg === 'system'
              ? h('div', null,
                h('div', { className: 'dshc_hint', style: { marginBottom: 6 } }, '当前状态：' + (overrideOn ? '已接管——模型看到的是②保存的文本；点「恢复默认系统原版」可改回官方原文。' : '未接管——模型看到的是当前完整系统提示词。')),
                h('div', { className: 'dshc_hint', style: { marginBottom: 6 } }, '① 已识别的官方提示词段（来自实际装配，只读' + (officialSecs.length ? '；' + officialSecs.length + ' 段：' + officialNames : '；装配暂无已识别官方面') + '）'),
                h('textarea', { className: 'dshc_ta', readOnly: true, value: officialText || (overrideOn ? '（已接管：官方面被整段替换，装配里不再包含它）' : '（装配暂无已识别官方面内容）'), style: { minHeight: 120, marginBottom: 10 } }),
                h('div', { className: 'dshc_banner', style: { margin: '0 0 10px' } }, '⚠ 整段接管会替换当前全部系统提示词段——包括官方段、运行时核心（shisanxinuo:core-discipline）与其它外部段，不只是上面这段官方原文。'),
                h('div', { className: 'dshc_hint', style: { marginBottom: 6 } }, '② 接管草稿（高级功能：保存后用这里的文本整段替换系统提示词；留空保存＝恢复官方原文），建议：除非确有需要，优先用「前置纪律」或「我的提示词」，不要整段接管。'),
                h('textarea', { className: 'dshc_ta', value: draft, onChange: (e) => { const v = e.target.value; setDraft(v); setDirty(v !== baseline); }, placeholder: '未接管——此处为空时当前系统提示词生效；写内容保存即整段接管' }),
                h('div', { className: 'dshc_row dshc_actions' },
                  h('button', { className: 'dshc_btn', 'data-primary': true, disabled: busy || !dirty, onClick: requestSaveSystem }, busy ? '保存中…' : '保存修改'),
                  h('button', { className: 'dshc_btn', disabled: busy, onClick: () => { const v = officialText; setDraft(v); setDirty(v !== baseline); } }, '取材于当前官方段'),
                  h('button', { className: 'dshc_btn', disabled: busy || !overrideOn, title: overrideOn ? '让模型改回使用官方原文' : '当前未接管，无需恢复', onClick: () => void restoreDefault() }, '恢复默认系统原版')))
              : seg === 'layered'
                  ? h('div', null,
                    h('div', { className: 'dshc_hint', style: { marginBottom: 6 } }, '按需加载的流程细则：平时不占提示词，任务触发对应场景时才临时注入、用完即走（省上下文）。可停用、恢复出厂、编辑内容，或新增自己的分节。'),
                    h('div', { className: 'dshc_row', style: { marginBottom: 8 } },
                      h('button', { className: 'dshc_btn', 'data-primary': true, onClick: () => setModal({
                        title: '新增自定义分节',
                        body: h('div', null,
                          h('p', null, '分节名（中英文/数字/连字符，自动补 .md；例如 my-workflow 或 我的流程）：'),
                          h('input', { className: 'dshc_input', value: newSec.name, onChange: (e) => setNewSec({ ...newSec, name: e.target.value }) }),
                          h('p', null, '内容（该场景被触发时注入给模型的细则）：'),
                          h('textarea', { className: 'dshc_ta', value: newSec.text, onChange: (e) => setNewSec({ ...newSec, text: e.target.value }) })),
                        actions: h('div', { className: 'dshc_row' },
                          h('button', { className: 'dshc_btn', 'data-primary': true, disabled: busy, onClick: async () => {
                            if (busy) return;
                            setBusy(true);
                            try { await api('layered/' + encodeURIComponent(newSec.name.trim().replace(/\.md$/, '') + '.md'), { method: 'PUT', body: { text: newSec.text } }); setModal(null); setNewSec({ name: '', text: '' }); await load(); setMsg({ title: '分节已新增', detail: '保存后按场景触发注入' }); } catch (e) { setMsg({ title: '新增失败', detail: String((e && e.message) || e) }); } finally { setBusy(false); }
                          } }, '创建'),
                          h('button', { className: 'dshc_btn', onClick: () => setModal(null) }, '取消')),
                      }) }, '＋ 新增分节')),
                    (data.layered && data.layered.sections ? data.layered.sections : []).map((s) => h('div', { key: s.name, className: 'dshc_trow' },
                      h('div', { className: 'dshc_tlabel' },
                        h('div', null,
                          (SECTION_LABELS[s.name] || s.name.replace(/\.md$/, '')),
                          s.name.startsWith('00-') ? h('span', { className: 'dshc_tag' }, '路由清单') : null,
                          !factorySet.has(s.name) ? h('span', { className: 'dshc_tag' }, '自建') : null,
                          s.modified && factorySet.has(s.name) ? h('span', { className: 'dshc_tag' }, '已改') : null,
                          s.enabled === false ? h('span', { className: 'dshc_er' }, ' 已停用') : null),
                        h('div', { className: 'dshc_hint' }, SECTION_LABELS[s.name] ? '' : '自定义分节（' + s.chars + ' 字）')),
                      h('span', { className: 'dshc_row' },
                        h('button', { className: 'dshc_btn', disabled: busy, onClick: async () => {
                          if (busy) return; // P1-10 防连点
                          setBusy(true);
                          try { const sec = await api('layered/' + encodeURIComponent(s.name)); setModal({
                            title: '编辑分节 · ' + (SECTION_LABELS[s.name] || s.name),
                            body: h('div', null,
                              h('p', null, (s.name.startsWith('00-') ? '分节路由清单：' : '该场景被触发时注入给模型的内容：') + '（' + s.chars + ' 字）'),
                              h('textarea', { className: 'dshc_ta', value: sec.text, onChange: (e) => { sec.text = e.target.value; } })),
                            actions: h('div', { className: 'dshc_row' },
                              h('button', { className: 'dshc_btn', 'data-primary': true, disabled: busy, onClick: async () => {
                                if (busy) return;
                                setBusy(true);
                                try { await api('layered/' + encodeURIComponent(s.name), { method: 'PUT', body: { text: sec.text } }); setModal(null); await load(); setMsg({ title: '分节已保存', detail: s.name }); } catch (e) { setMsg({ title: '保存失败', detail: String((e && e.message) || e) }); } finally { setBusy(false); }
                              } }, '保存'),
                              h('button', { className: 'dshc_btn', onClick: () => setModal(null) }, '取消')),
                          }); } catch (e) { setMsg({ title: '读取失败', detail: String((e && e.message) || e) }); } finally { setBusy(false); }
                        } }, '内容'),
                        s.modified && factorySet.has(s.name) ? h('button', { className: 'dshc_btn', disabled: busy, onClick: async () => {
                          if (busy) return;
                          setBusy(true);
                          try { await api('layered/' + encodeURIComponent(s.name) + '/reset', { method: 'POST' }); await load(); setMsg({ title: '已恢复出厂原文', detail: s.name }); } catch (e) { setMsg({ title: '恢复失败', detail: String((e && e.message) || e) }); } finally { setBusy(false); }
                        } }, '恢复出厂') : null,
                        h('button', { className: 'dshc_btn', disabled: busy, onClick: async () => {
                          if (busy) return;
                          setBusy(true);
                          try { await api('layered/' + encodeURIComponent(s.name) + '/toggle', { method: 'POST', body: { enabled: s.enabled === false } }); await load(); setMsg({ title: s.enabled === false ? '已启用' : '已停用', detail: s.name + (s.enabled === false ? ' 将重新按场景注入' : ' 停用后模型收不到该场景细则') }); } catch (e) { setMsg({ title: '操作失败', detail: String((e && e.message) || e) }); } finally { setBusy(false); }
                        } }, s.enabled === false ? '启用' : '停用'),
                        !factorySet.has(s.name) ? h('button', { className: 'dshc_btn', 'data-danger': true, onClick: () => setModal({
                          title: '删除分节 · ' + s.name + '？',
                          body: h('div', null, h('p', null, '删除后该自定义分节不再出现（模型侧无感知）。')), 
                          actions: h('div', { className: 'dshc_row' },
                            h('button', { className: 'dshc_btn', 'data-danger': true, disabled: busy, onClick: async () => {
                              if (busy) return;
                              setBusy(true);
                              try { await api('layered/' + encodeURIComponent(s.name), { method: 'DELETE' }); setModal(null); await load(); setMsg({ title: '分节已删除', detail: s.name }); } catch (e) { setMsg({ title: '删除失败', detail: String((e && e.message) || e) }); } finally { setBusy(false); }
                            } }, '确认删除'),
                            h('button', { className: 'dshc_btn', onClick: () => setModal(null) }, '取消')),
                        }) }, '删除') : null)),
                    (data.layered && data.layered.sections && data.layered.sections.length === 0) ? h('div', { className: 'dshc_empty' }, '无分节') : null))
                  : h('div', null,
                    seg === 'discipline' ? h('div', null,
                      h('div', { className: 'dshc_hint', style: { marginBottom: 6 } }, '① 模型每回合都会看到的「纪律核心」正文（只读；来自运行时治理插件' + (effDiscipline ? '；' + String(effDiscipline.text || '').length + ' 字' : '；装配暂未含该段') + '）：'),
                      h('textarea', { className: 'dshc_ta', readOnly: true, value: (effDiscipline && effDiscipline.text) || '（装配暂未含运行时纪律段）', style: { minHeight: 140, marginBottom: 10 } }),
                      h('div', { className: 'dshc_hint', style: { marginBottom: 6 } }, '② 前置纪律附加（可选；默认空＝不附加）。写什么：你希望模型永远先看到的补充要求（个人偏好、团队规范）。保存后：追加在系统提示词最前面。注意：它不替换①的纪律核心，两段会同时生效。'))
                      : h('div', { className: 'dshc_hint', style: { marginBottom: 6 } }, '我的提示词（可选；空＝不注入）。写什么：你的个性化指令（语气、格式、习惯约定）。保存后：作为独立段注入，排在纪律核心之后。'),
                    h('textarea', { className: 'dshc_ta', value: draft, onChange: (e) => { const v = e.target.value; setDraft(v); setDirty(v !== baseline); }, placeholder: seg === 'discipline' ? '空＝不附加；此处不会替换运行时核心' : '空＝不注入该段' })),
            err ? h('div', { className: 'dshc_err' }, h('span', null, err)) : null,
            msg ? h('div', { className: 'dshc_hint', style: { marginTop: 8 } }, msg.title + '：' + (msg.detail || '')) : null)));
    }

    // ── ③ 快照与恢复 ──
    function SnapshotsPage() {
      const [entries, setEntries] = useState(null);
      const [titles, setTitles] = useState({}); // sessionId(净化) → 标题（尽力而为，拿不到只影响显示）
      const [msg, setMsg] = useState(null);
      const [modal, setModal] = useState(null);
      const [busy, setBusy] = useState(false);
      const load = useCallback(async () => {
        try {
          const v = await api('backups');
          setEntries(v.entries || []);
          try {
            const s = await api('sessions');
            const map = {};
            (s.sessions || []).forEach((x) => { map[String(x.id).replace(/[^A-Za-z0-9_-]/g, '')] = x.title || null; });
            setTitles(map);
          } catch { /* 标题只是装饰 */ }
        } catch (e) { setMsg({ title: '读取失败', detail: String((e && e.message) || e) }); }
      }, []);
      useEffect(() => { void load(); }, [load]);
      const manualBackup = async () => {
        setBusy(true);
        try {
          await api('backups', { method: 'POST', body: {} });
          await load();
          setMsg({ title: '已创建备份', detail: '当前状态已备份并列入下方列表。' });
        } catch (e) { setMsg({ title: '备份失败', detail: String((e && e.message) || e) }); }
        finally { setBusy(false); }
      };
      const fmtSnapDate = (name) => {
        const m = String(name).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})/);
        return m ? `${m[2]}月${m[3]}日 ${m[4]}:${m[5]}` : name;
      };
      const sessionLabel = (b) => {
        const short = String(b.sessionId || '').replace(/^session-/, '').slice(0, 8);
        const title = titles[b.sessionId];
        return short + (title ? ' · ' + title : '');
      };
      const scopeBody = (b) => (b.scope === 'session' && b.sessionId ? '&sessionId=' + encodeURIComponent(b.sessionId) : '');
      const restore = async (b) => {
        setModal(null);
        try {
          await api('backups/restore', { method: 'PUT', body: { name: b.name, scope: b.scope === 'session' ? 'session' : 'global', sessionId: b.sessionId || undefined } });
          await load();
          setMsg({ title: '已回滚', detail: '已回滚到 ' + fmtSnapDate(b.name) + '（回滚前已再快照，可反悔）' });
        } catch (e) { setMsg({ title: '回滚失败', detail: String((e && e.message) || e) }); }
      };
      const delBackup = async (b) => {
        try {
          const scopeQ = b.scope === 'session' && b.sessionId ? '&scope=session&sessionId=' + encodeURIComponent(b.sessionId) : '';
          await api('backups?name=' + encodeURIComponent(b.name) + scopeQ, { method: 'DELETE' });
          await load();
          setMsg({ title: '已删除', detail: '快照「' + fmtSnapDate(b.name) + '」已删除（不可恢复）' });
        } catch (e) { setMsg({ title: '删除失败', detail: String((e && e.message) || e) }); }
      };
      const showExport = async (b) => {
        try {
          const v = await api('backups/export?name=' + encodeURIComponent(b.name) + scopeBody(b));
          const json = JSON.stringify(v, null, 2);
          setModal({
            title: '导出快照 · ' + fmtSnapDate(b.name),
            body: h('div', null,
              h('p', null, '这份快照的完整文件内容（JSON）。复制留档后可随时查阅；超过 2MB 的快照会提示先用详情比对。'),
              h('textarea', { className: 'dshc_ta', readOnly: true, value: json, style: { minHeight: 200 } }),
              h('div', { className: 'dshc_row' },
                h('button', { className: 'dshc_btn', onClick: async () => { try { await navigator.clipboard.writeText(json); setMsg({ title: '已复制', detail: '快照 JSON 已复制到剪贴板' }); } catch { setMsg({ title: '复制失败', detail: '请手动全选文本框复制（Ctrl+A / Ctrl+C）' }); } } }, '复制到剪贴板'))),
            actions: h('div', { className: 'dshc_row' }, h('button', { className: 'dshc_btn', onClick: () => setModal(null) }, '关闭')),
          });
        } catch (e) { setMsg({ title: '导出失败', detail: String((e && e.message) || e) }); }
      };
      const showDetail = async (b, idx) => {
        try {
          const v = await api('backups/detail?name=' + encodeURIComponent(b.name) + scopeBody(b));
          const byFile = {};
          (v.files || []).forEach((f) => { byFile[f.file] = f; });
          const row = (title, desc) => h('li', { key: title, style: { fontSize: 12, margin: '4px 0' } }, h('b', null, title), ' —— ' + desc);
          const segRow = (file, label) => byFile[file] ? row(label, byFile[file].lines > 0 ? byFile[file].lines + ' 行：' + byFile[file].head : '空（当时未设置该段）') : null;
          const isSession = b.scope === 'session';
          setModal({
            title: '快照 #' + idx + ' · ' + fmtSnapDate(b.name) + (isSession ? '（会话）' : ''),
            body: h('div', null,
              h('p', null, isSession ? '这份会话快照记录了该会话当时的覆盖段（回滚＝恢复到这份状态）：' : '这份快照记录了当时的全局提示词状态（回滚＝恢复到这份状态）：'),
              h('ul', null,
                isSession
                  ? [segRow('discipline.md', '前置纪律'), segRow('user.md', '我的提示词'), segRow('layered.md', '渐进加载层'), segRow('system.md', '整段接管')]
                  : [byFile['discipline.md'] ? row('纪律核心', byFile['discipline.md'].lines > 0 ? byFile['discipline.md'].lines + ' 行：' + byFile['discipline.md'].head : '空（当时使用运行时默认纪律）') : null,
                     byFile['user-prompt.md'] ? row('我的提示词', byFile['user-prompt.md'].lines > 0 ? byFile['user-prompt.md'].head : '空') : null,
                     byFile['override.md'] ? row('接管官方', byFile['override.md'].lines > 0 ? '已接管：' + byFile['override.md'].head : '空（未接管）') : null,
                     v.scope ? row('作用域规则', v.scope.count + ' 条' + (v.scope.paths.length ? '（针对 ' + v.scope.paths.join('、') + ' 等工作区）' : '')) : null,
                     v.settings ? row('注入与开关', Object.entries(v.settings).filter(([k]) => k !== 'version').map(([k, val]) => k + '=' + JSON.stringify(val)).join('，')) : null]),
              h('p', null, '提示：快照是「改提示词前」的自动备份——不确定回哪个时，先比对上面几条再决定。')),
            actions: h('div', { className: 'dshc_row' },
              h('button', { className: 'dshc_btn', onClick: () => void showExport(b) }, '导出 JSON'),
              h('button', { className: 'dshc_btn', 'data-danger': true, onClick: () => void restore(b) }, '回滚到此版本'),
              h('button', { className: 'dshc_btn', onClick: () => setModal(null) }, '关闭')),
          });
        } catch (e) { setMsg({ title: '详情读取失败', detail: String((e && e.message) || e) }); }
      };
      return h('div', null,
        h(Modal, { open: modal !== null, title: modal ? modal.title : '', onClose: () => setModal(null), actions: modal ? modal.actions : null }, modal ? modal.body : null),
        h('div', { className: 'dshc_panel' },
          h('div', { className: 'dshc_ph' }, h('h3', null, '快照与恢复'), h('span', { className: 'dshc_spacer' }),
            h('span', { className: 'dshc_hint' }, '全局＋各会话；每次改提示词前自动备份，保留最近 20 个（超出自动清理，重要状态可先导出 JSON）'),
            h('button', { className: 'dshc_btn', disabled: busy, onClick: () => void manualBackup() }, busy ? '备份中…' : '立即备份')),
          h('ul', { className: 'dshc_audit' },
            entries === null ? h('li', { className: 'dshc_empty' }, '读取中…')
              : entries.length === 0 ? h('li', { className: 'dshc_empty' }, '暂无快照——第一次在上方修改提示词时会自动生成')
              : entries.map((b, i) => h('li', { key: (b.scope || 'global') + ':' + (b.sessionId || '') + ':' + b.name, style: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--dsw-alias-border-l2)' } },
                h('div', { style: { flex: 1 } },
                  h('div', { style: { fontWeight: 600, fontSize: 13 } },
                    (b.scope === 'session' ? '会话快照 · ' + sessionLabel(b) : '全局备份') + ' · ' + fmtSnapDate(b.name)),
                  h('div', { className: 'dshc_hint', style: { marginTop: 3 } }, '包含 ' + (b.files || []).length + ' 个文件' + (b.scope === 'session' ? '（该会话的覆盖段）' : '（纪律核心、开关状态等）'))),
                h('span', null,
                  h('button', { className: 'dshc_btn', onClick: () => void showDetail(b, entries.length - i) }, '详情'),
                  ' ',
                  h('button', { className: 'dshc_btn', 'data-softdanger': true, onClick: () => setModal({
                    title: '删除这份快照？',
                    body: h('div', null,
                      h('p', null, '「' + ((b.scope === 'session' ? '会话快照 · ' + sessionLabel(b) : '全局备份') + ' · ' + fmtSnapDate(b.name)) + '」将被删除，删除后不可恢复。'),
                      h('p', null, '如果只是想回到旧状态，请用「回滚」——回滚前会自动再快照，可反悔。')),
                    actions: h('div', { className: 'dshc_row' },
                      h('button', { className: 'dshc_btn', 'data-danger': true, onClick: () => { setModal(null); void delBackup(b); } }, '确认删除'),
                      h('button', { className: 'dshc_btn', onClick: () => setModal(null) }, '取消')),
                  }) }, '删除'),
                  ' ',
                  h('button', { className: 'dshc_btn', onClick: () => setModal({
                    title: '回滚到 ' + fmtSnapDate(b.name) + '？',
                    body: h('div', null,
                      h('p', null, b.scope === 'session' ? '把该会话的覆盖段恢复到 ' + fmtSnapDate(b.name) + ' 那一刻的样子。' : '把纪律核心、开关状态等恢复到 ' + fmtSnapDate(b.name) + ' 那一刻的样子。'),
                      h('p', null, '回滚前会自动再快照当前状态，可反悔。')),
                    actions: h('div', { className: 'dshc_row' },
                      h('button', { className: 'dshc_btn', 'data-danger': true, onClick: () => void restore(b) }, '确认回滚'),
                      h('button', { className: 'dshc_btn', onClick: () => setModal(null) }, '取消')),
                  }) }, '回滚')))),
            msg ? h('li', { className: 'dshc_hint' }, msg.title + '：' + (msg.detail || '')) : null)));
    }

    // ── ④ 统计数据 ──
    function StatsPage() {
      const [stats, setStats] = useState(null);
      const [err, setErr] = useState(null);
      const [range, setRange] = useState('all');
      const [showAll, setShowAll] = useState(false);
      const load = useCallback(async () => {
        try { setStats(await api('stats')); setErr(null); } catch (e) { setErr('统计读取失败：' + String((e && e.message) || e)); }
      }, []);
      useEffect(() => { void load(); }, [load]);
      const s = stats || { guardDeny: 0, snapshots: 0, sessions: 0, audit: [] };
      // 时间范围真实过滤（today/week 按本地零点/7 天计）
      const now = Date.now();
      const todayStart = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
      const minTs = range === 'today' ? todayStart : range === 'week' ? now - 7 * 86400000 : 0;
      const rows = (s.audit || [])
        .filter((a) => { const meta = AUDIT_META[String(a.kind)]; if (meta && meta.internal) return false; return true; })
        .filter((a) => { const t = Date.parse(a.ts); return isNaN(t) ? true : t >= minTs; })
        .slice().reverse();
      const visible = showAll ? rows : rows.slice(0, 8);
      return h('div', null,
        err ? h('div', { className: 'dshc_err' }, h('span', null, err)) : null,
        h('div', { className: 'dshc_panel', style: { marginBottom: 14 } },
          h('div', { className: 'dshc_ph' }, h('h3', null, '统计数据'), h('span', { className: 'dshc_spacer' }),
            h('span', { className: 'dshc_hint' }, '流水范围'),
            h('div', { className: 'dshc_segs' },
              [['all', '全部'], ['week', '最近 7 天'], ['today', '今天']].map(([k, l]) => h('button', { key: k, 'data-active': range === k, onClick: () => setRange(k) }, l)))),
        h('div', { className: 'dshc_cards' },
          h('div', { className: 'dshc_card' }, h('div', { className: 'k' }, '护栏拦截'), h('div', { className: 'v' }, String(s.guardDeny)), h('div', { className: 's' }, '次对提示词存储的写入被挡')),
          h('div', { className: 'dshc_card' }, h('div', { className: 'k' }, '快照'), h('div', { className: 'v' }, String(s.snapshots)), h('div', { className: 's' }, '个可回滚的提示词备份')),
          h('div', { className: 'dshc_card' }, h('div', { className: 'k' }, '活跃会话'), h('div', { className: 'v' }, String(s.sessions)), h('div', { className: 's' }, '个可被定制提示词的会话')),
          h('div', { className: 'dshc_card' }, h('div', { className: 'k' }, '页面外改动'), h('div', { className: 'v' }, String(s.externalChange || 0)), h('div', { className: 's' }, '次检测到；建议先核对下方审计'))),
        h('div', { className: 'dshc_hint', style: { margin: '-4px 0 12px' } }, '以上为累计值；下方「动作流水」按所选范围筛选。'),
        h('div', { className: 'dshc_panel' },
          h('div', { className: 'dshc_ph' }, h('h3', null, '动作流水'), h('span', { className: 'dshc_spacer' }),
            h('span', { className: 'dshc_hint' }, rows.length + ' 条记录' + (rows.length > 8 && !showAll ? '，仅显示最近 8 条' : '') + '（最多显示最近 20 条）')),
          h('ul', { className: 'dshc_audit' },
            visible.map((a, i) => {
              const meta = AUDIT_META[String(a.kind)] || {};
              return h('li', { key: i, style: { gridTemplateColumns: '110px 1fr', rowGap: 2 } },
                h('span', null, fmtTime(a.ts)),
                h('span', null,
                  h('div', null, meta.l || String(a.kind || '?')),
                  meta.e ? h('div', { className: 'dshc_hint' }, meta.e) : null));
            }),
            rows.length === 0 ? h('li', { className: 'dshc_empty' }, '该时间范围内暂无动作') : null,
            rows.length > 8 ? h('li', { className: 'dshc_empty' },
              h('button', { className: 'dshc_btn', onClick: () => setShowAll(!showAll) }, showAll ? '收起，只看最近 8 条' : '展开全部 ' + rows.length + ' 条')) : null))));
    }

    // 动作流水人话对照（kind → 用户语言）；未登记的 kind 原样显示（不隐瞒）
    const AUDIT_LABELS = {
      boot: '插件启动', rules: '规则包装载', discipline: '纪律文本装载',
      'sysprompt-attached': '提示词段已挂载', 'api-mounted': '管理后台数据面就绪',
      'renderer-resolve': '渲染器解析', 'render-tolerate': '容错渲染（变量未解析）',
      'session-override-saved': '会话覆盖已保存', 'session-system-applied': '会话系统段已生效',
      'session-system-cleared': '会话系统段已清除', 'session-rollback': '会话已回滚',
      'guard-deny': '护栏拦截了一次写入', 'external-change': '检测到配置被外部改动',
      'settings-saved': '设置已保存', 'discipline-saved': '常驻核心已保存',
      'governance-changed': '治理开关已变更', 'governance-allowlist': '白名单已变更',
      'governance': '治理开关装载', 'compaction-signal': '压缩重载信号已送达',
      'layered-inject': '按需注入流程分节', 'save-noop': '保存被跳过（内容没变）',
    };

    // 动作流水语义表：kind → { l: 一句话动作, e: 对你的影响 }；internal=true 的纯内部事件不上 UI
    const AUDIT_META = {
      boot: { l: '插件启动', e: '治理功能就绪' },
      'sysprompt-attached': { l: '纪律提示词已注入', e: '每个会话自动带上纪律提示词' },
      'api-mounted': { l: '管理后台就绪', e: '本页面的数据通道已可用' },
      'session-override-saved': { l: '会话覆盖已保存', e: '你为单个会话写的提示词已生效' },
      'session-system-applied': { l: '会话定制已生效', e: '该会话正在使用你设置的提示词' },
      'session-system-cleared': { l: '会话定制已清除', e: '该会话恢复为跟随全局' },
      'session-system-shadows-global': { l: '会话定制覆盖了全局接管', e: '该会话优先用自己的整段接管' },
      'session-system-empty-at-assemble': { l: '会话接管为空，已回落', e: '该会话当前没有有效接管文本' },
      'session-rollback': { l: '会话已回滚', e: '恢复到之前的版本' },
      'guard-deny': { l: '拦截了一次绕过写入', e: '有程序试图绕过页面改提示词，被挡下' },
      'external-change': { l: '检测到页面外改动', e: '提示词文件在管理页之外被修改过，请核对' },
      'settings-saved': { l: '设置已保存', e: '注入等开关已更新' },
      'discipline-saved': { l: '前置纪律已保存', e: '自定义纪律文本已更新' },
      'user-prompt-saved': { l: '我的提示词已保存', e: '用户自定义段已更新' },
      'scope-saved': { l: '作用域规则已保存', e: '工作区匹配规则已更新' },
      'override-saved': { l: '整段接管草稿已保存', e: '下一次请求按新文本整段替换' },
      'override-enabled': { l: '整段接管已启用', e: '该作用域模型看到的就是你的文本' },
      'override-disabled': { l: '整段接管已关闭', e: '恢复使用官方系统提示词' },
      'override-conflict': { l: '整段接管冲突', e: '同作用域存在其它 complete 段，已自动回退' },
      'backup-restored': { l: '快照已回滚', e: '提示词状态已恢复到所选备份' },
      'layered-saved': { l: '渐进分节已保存', e: '该分节内容已更新' },
      'layered-toggle': { l: '渐进分节启停已变更', e: '该分节是否注入已切换' },
      'layered-reset': { l: '渐进分节已恢复出厂', e: '该分节回到出厂文本' },
      'layered-deleted': { l: '自建分节已删除', e: '该分节不再参与注入' },
      'governance-changed': { l: '治理开关已变更', e: '拦截等能力按你的设置调整' },
      'governance-allowlist': { l: '白名单已变更', e: '命中该形态的命令不再弹审批卡' },
      governance: { l: '治理开关已装载', e: '按你上次保存的开关状态启动' },
      'layered-inject': { l: '按需注入了流程分节', e: '任务触发对应场景，临时注入细则' },
      'save-noop': { l: '保存被跳过（内容没变）', e: '没有重复创建快照与写入' },
      'renderer-resolve': { l: null, internal: true },
      'render-tolerate': { l: null, internal: true },
      'compaction-signal': { l: null, internal: true },
    };

    // 渐进分节中文名（出厂 9 节；未登记的显示文件名）
    const SECTION_LABELS = {
      '00-加载清单.md': '分节路由清单',
      'clarify-protocol.md': '澄清协议',
      'compression-reload.md': '压缩后重载',
      'docking-truth-list.md': '对接真相清单',
      'environment-inventory.md': '环境盘点',
      'goal-mode.md': '目标模式',
      'l2f-full-workflow.md': 'L2-F 完整流程',
      'l2s-short-workflow.md': 'L2-S 短流程',
      'requirements-challenge.md': '需求质疑审查',
      'tool-triggers.md': '工具触发矩阵',
    };

    // ── ⑤ 治理开关（P46；UI 迭代：switch 心智＋busy 防连点＋错误态不再被早退吞掉）──
    function Switch(props) {
      return h('button', {
        className: 'dshc_switch', role: 'switch', 'aria-checked': props.checked ? 'true' : 'false',
        'aria-label': props.label || undefined,
        'data-locked': props.locked ? 'true' : 'false',
        disabled: props.disabled || props.busy,
        title: props.locked ? '固定开启（不可关闭）' : props.disabled ? '不可豁免' : (props.checked ? '点击关闭' : '点击开启'),
        onClick: () => props.onToggle(!props.checked),
      }, h('span', { className: 'dshc_knob' }));
    }
    function GovernancePage() {
      const [gov, setGov] = useState(null);
      const [loadErr, setLoadErr] = useState(null);
      const [busy, setBusy] = useState(false);
      const [msg, setMsg] = useState(null);
      const [newRule, setNewRule] = useState({ pattern: '', note: '' });
      const [modal, setModal] = useState(null);
      const load = useCallback(async () => {
        try { setGov(await api('governance')); setLoadErr(null); } catch (e) { setLoadErr(String((e && e.message) || e)); }
      }, []);
      useEffect(() => { void load(); }, [load]);
      useEffect(() => { // toast 自动消失（避免常驻遮挡）
        if (!msg) return;
        const t = setTimeout(() => setMsg(null), 3500);
        return () => clearTimeout(t);
      }, [msg]);
      const put = async (patch, okTitle) => {
        if (busy) return; // 防连点竞态：后写覆盖前写
        setBusy(true);
        try { await api('governance', { method: 'PUT', body: patch }); await load(); setMsg({ title: okTitle, detail: '已热生效（运行时插件按文件 mtime 自动重读）' }); }
        catch (e) { setMsg({ title: '保存失败', detail: String((e && e.message) || e) }); }
        finally { setBusy(false); }
      };
      const addAllow = async () => {
        if (busy) return;
        setBusy(true);
        try { await api('governance/allowlist', { method: 'POST', body: newRule }); setNewRule({ pattern: '', note: '' }); setModal(null); await load(); setMsg({ title: '白名单已添加', detail: '命中该形态的命令将直接放行，不再弹审批卡' }); }
        catch (e) { setMsg({ title: '添加失败', detail: String((e && e.message) || e) }); }
        finally { setBusy(false); }
      };
      const delAllow = async (pattern) => {
        if (busy) return;
        setBusy(true);
        try { await api('governance/allowlist?pattern=' + encodeURIComponent(pattern), { method: 'DELETE' }); await load(); setMsg({ title: '白名单已移除', detail: pattern }); }
        catch (e) { setMsg({ title: '移除失败', detail: String((e && e.message) || e) }); }
        finally { setBusy(false); }
      };
      const header = h('div', { className: 'dshc_ph' }, h('h3', null, '治理开关'), h('span', { className: 'dshc_spacer' }),
        h('span', { className: 'dshc_hint' }, busy ? '保存中…' : '开关点按即保存（热生效）'),
        h('button', { className: 'dshc_btn', disabled: busy, title: '重新读取当前配置（修改在点开关时就已保存）', onClick: () => void load() }, '重新读取'));
      if (gov === null) {
        return h('div', { className: 'dshc_panel' }, header,
          loadErr ? h('div', { className: 'dshc_banner' }, '读取失败：' + loadErr + '（可点「重新读取」重试）') : h('div', { className: 'dshc_empty' }, '读取中…'));
      }
      const toggleDomain = (d) => {
        const next = new Set(gov.domainsOff);
        if (d.off) next.delete(d.domain); else next.add(d.domain);
        void put({ l3: { domainsOff: [...next] } }, d.off ? '域已启用：' + d.domain : '域已关闭：' + d.domain);
      };
      return h('div', null,
        h(Modal, { open: modal !== null, title: modal ? modal.title : '', onClose: () => setModal(null), actions: modal ? modal.actions : null }, modal ? modal.body : null),
        h('div', { className: 'dshc_panel' },
          header,
          h('div', { className: 'dshc_hint', style: { padding: '6px 14px 0' } },
            gov.catalogSource === 'engine'
              ? '域目录：来自运行时引擎上报（单一真源，引擎启动时更新）'
              : '域目录：内置镜像副本（引擎未上报目录；可能滞后于规则变更）'),
          gov.l3Enabled === false ? h('div', { className: 'dshc_banner' }, '⚠ L3 拦截已关闭：命中仅记录不弹卡，防线只剩宿主沙箱与提示词文本。') : null,
          h('div', { className: 'dshc_trow', title: '总开关：一次关闭全部 10 个危险域的拦截（编码执行/解码执行固定开启，不受影响）。关闭后命中危险命令只记录、不弹审批卡。' },
            h('div', null,
              h('div', { className: 'dshc_tlabel' }, '总开关'),
              h('div', { className: 'dshc_hint' }, '10 个危险域词面判定（宿主沙箱之上的加严层），命中弹审批卡'),
              !gov.l3Enabled ? h('div', { className: 'dshc_er' }, '拦截退位仅记录——危险操作将不再询问') : null),
            h(Switch, { checked: gov.l3Enabled, busy, label: 'L3 拦截总开关', onToggle: (v) => {
              if (v) { void put({ l3: { enabled: true } }, '拦截已开启'); return; }
              setModal({
                title: '关闭 L3 拦截？',
                body: h('div', null,
                  h('p', null, '关闭后，命中危险域的命令将只记录、不弹审批卡；防线只剩宿主沙箱与提示词文本。'),
                  h('p', null, '编码执行/解码执行仍固定拦截，不受总开关影响。')),
                actions: h('div', { className: 'dshc_row' },
                  h('button', { className: 'dshc_btn', 'data-danger': true, onClick: () => { setModal(null); void put({ l3: { enabled: false } }, '拦截已关闭'); } }, '确认关闭'),
                  h('button', { className: 'dshc_btn', onClick: () => setModal(null) }, '取消')),
              });
            } })),
          h('div', { className: 'dshc_grid2c' },
            gov.domains.map((d) => h('div', { key: d.domain, className: 'dshc_trow', title: d.noExempt ? d.domain + '：最高危入口，固定拦截、不可关闭' : d.domain + '：关闭后该域命令不再弹审批卡（仅记录）；再点开关恢复拦截' },
              h('div', { className: 'dshc_tlabel' }, d.domain, d.noExempt ? h('span', { className: 'dshc_tag' }, '固定开启') : null),
              h(Switch, { checked: !d.off, disabled: d.noExempt, locked: d.noExempt, busy, label: d.domain, onToggle: () => toggleDomain(d) })))),
          h('div', { className: 'dshc_hint', style: { padding: '4px 14px 10px' } }, '「不可豁免」的域（编码执行/解码执行）固定拦截——两个最高危入口，防误关双保险，不提供关闭开关；其余域可随时关。')),
        h('div', { className: 'dshc_panel' },
          h('div', { className: 'dshc_ph' }, h('h3', null, '误拦白名单'), h('span', { className: 'dshc_hint' }, '命中白名单形态的命令直接放行，不再弹审批卡'), h('span', { className: 'dshc_spacer' }),
            h('button', { className: 'dshc_btn', disabled: busy, onClick: () => setModal({
              title: '添加误拦白名单',
              body: h('div', null,
                h('p', null, '命令形态（子串＋词边界，最短 4 字符，如 docker ps）：'),
                h('input', { className: 'dshc_input', style: { width: '100%', boxSizing: 'border-box' }, value: newRule.pattern, onChange: (e) => setNewRule({ ...newRule, pattern: e.target.value }) }),
                h('p', null, '备注（为什么放行）：'),
                h('input', { className: 'dshc_input', style: { width: '100%', boxSizing: 'border-box' }, value: newRule.note, onChange: (e) => setNewRule({ ...newRule, note: e.target.value }) })),
              actions: h('div', { className: 'dshc_row' },
                h('button', { className: 'dshc_btn', 'data-primary': true, disabled: busy, onClick: () => void addAllow() }, '添加'),
                h('button', { className: 'dshc_btn', onClick: () => setModal(null) }, '取消')),
            }) }, '＋ 添加')),
          h('div', { className: 'dshc_allow' },
            gov.allowlist.length === 0 ? h('div', { className: 'dshc_empty' }, '暂无条目——审批卡误拦时，把该命令形态加到这里')
              : gov.allowlist.map((e) => h('div', { key: e.pattern, className: 'dshc_barrow2' },
                h('code', null, e.pattern),
                h('span', { className: 'dshc_hint' }, e.note || ''),
                h('button', { className: 'dshc_btn', disabled: busy, onClick: () => void delAllow(e.pattern) }, '移除'))),
            h('div', { className: 'dshc_hint' }, '提示：可先在「统计数据 → 审计时间线」核对误拦记录，再按命令形态加白名单。'))),
        h('div', { className: 'dshc_panel' },
          h('div', { className: 'dshc_ph' }, h('h3', null, '工作流能力开关')),
          h('div', { className: 'dshc_trow', title: '开启时：实质工作回合缺少状态行判级或验收登记会被自动打回纠正；关闭后不再打回（回到模型自觉）' },
            h('div', null,
              h('div', { className: 'dshc_tlabel' }, '判级与任务清单强制'),
              h('div', { className: 'dshc_hint' }, '实质工作回合缺状态行判级/验收登记时自动打回')),
            h(Switch, { checked: gov.levelChecklist, busy, label: '判级与任务清单强制', onToggle: (v) => void put({ levelChecklist: v }, v ? '判级强制已开启' : '判级强制已关闭') })),
          h('div', { className: 'dshc_trow', title: '开启时：上下文被压缩后自动注入「重载序」提示，帮助模型恢复精度、长会话不跑偏' },
            h('div', null,
              h('div', { className: 'dshc_tlabel' }, '压缩重载信号'),
              h('div', { className: 'dshc_hint' }, '上下文压缩后注入重载序提示（保持长会话精度）')),
            h(Switch, { checked: gov.compactionSignal, busy, label: '压缩重载信号', onToggle: (v) => void put({ compactionSignal: v }, v ? '压缩信号已开启' : '压缩信号已关闭') })),
          h('div', { className: 'dshc_trow', title: '排障专用：gate 通过后立即结束回合——可能吞掉交付文本、让最终回答到不了用户；改动需重启 DSH 生效' },
            h('div', null,
              h('div', { className: 'dshc_tlabel' }, '收口即终结（不推荐）',
                (gov.boot && gov.concludeOnPass !== gov.boot.concludeOnPass) ? h('span', { className: 'dshc_tag' }, '待重启') : null),
              h('div', { className: 'dshc_hint' }, 'gate 通过后立即结束回合——仅排障用；改动需重启 DSH 生效（引擎在启动时读取此开关）'),
              gov.concludeOnPass ? h('div', { className: 'dshc_er' }, '开启后交付文本可能被吞、到不了用户') : null),
            h(Switch, { checked: gov.concludeOnPass, busy, label: '收口即终结', onToggle: (v) => void put({ concludeOnPass: v }, '已保存（重启 DSH 后生效）') }))),
        h(Toast, { msg }));
    }

    // ── ⑥ 关于 ──
    function AboutPage() {
      const [st, setSt] = useState(null);
      const [msg, setMsg] = useState(null);
      const [modal, setModal] = useState(null);
      const [busy, setBusy] = useState(false);
      useEffect(() => { void (async () => { try { setSt(await api('status')); } catch { setSt(null); } })(); }, []);
      const repo = 'https://github.com/zxc663/shisan-xinuo-dsh-plugin';
      const kv = (k, v) => h('div', { className: 'dshc_trow', style: { padding: '10px 0' } }, h('div', { className: 'dshc_tlabel' }, k), v);
      // 版本：package 版本 0.1.0-mvp → 展示 "MVP0.1"
      const verLabel = (() => {
        const m = st && st.version ? String(st.version).match(/^(\d+)\.(\d+)/) : null;
        return m ? 'MVP' + m[1] + '.' + m[2] : '';
      })();
      // 出厂分节清单（与包内 content/layered 根文件同步；templates/ 子目录不在列）
      const factoryNames = ['00-加载清单.md', 'clarify-protocol.md', 'compression-reload.md', 'docking-truth-list.md', 'environment-inventory.md', 'goal-mode.md', 'l2f-full-workflow.md', 'l2s-short-workflow.md', 'requirements-challenge.md', 'resume-protocol.md', 'tool-triggers.md'];
      const uninstallCmd = 'dsh plugin --profile <你的档名> remove shisan-xinuo-dsh-plugin';
      const doStopTakeover = async () => {
        setModal(null); setBusy(true);
        try {
          await api('override/enable', { method: 'PUT', body: { enabled: false } });
          setMsg({ title: '已停止接管', detail: '模型已改回使用官方系统提示词原文；你保存的接管草稿仍在，随时可再开启。' });
        } catch (e) { setMsg({ title: '操作失败', detail: String((e && e.message) || e) }); } finally { setBusy(false); }
      };
      const doReset = async () => {
        setModal(null); setBusy(true);
        try {
          await api('discipline', { method: 'PUT', body: { text: '' } });
          await api('user-prompt', { method: 'PUT', body: { text: '', enabled: false } });
          const lv = await api('layered');
          for (const s of (lv && lv.sections ? lv.sections : [])) {
            if (factoryNames.indexOf(s.name) < 0) continue;
            try { await api('layered/' + encodeURIComponent(s.name) + '/reset', { method: 'POST' }); } catch { /* 单节失败不阻断其余 */ }
          }
          setMsg({ title: '已重置回默认提示词', detail: '「前置纪律」与「我的提示词」已清空，渐进分节恢复出厂；你自建的分节保留未动。' });
        } catch (e) { setMsg({ title: '重置失败', detail: String((e && e.message) || e) }); } finally { setBusy(false); }
      };
      return h('div', { className: 'dshc_panel' },
        h('div', { className: 'dshc_ph' }, h('h3', null, '关于'), h('span', { className: 'dshc_spacer' }),
          h('span', { className: 'dshc_hint' }, verLabel || '')),
        h('div', { className: 'dshc_body', style: { paddingTop: 12 } },
          h('p', { style: { marginTop: 0, lineHeight: '22px' } },
            '你好，我是 zxc663，欢迎使用我的插件。当前是 0.1 MVP：运行时治理 + 提示词管理后台是一个包。仍有不完善之处——有改进建议或想贡献，欢迎开 issue 或提 PR。'),
          kv('QQ 交流群', h('code', null, '1059212846')),
          kv('邮箱反馈', h('code', null, '938566908@qq.com')),
          kv('GitHub 仓库', h('a', { href: repo, target: '_blank', rel: 'noreferrer' }, repo)),
          h('div', { style: { marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--dsw-alias-border-l2)' } },
            h('div', { style: { fontWeight: 600, color: 'var(--dsw-alias-label-primary)', marginBottom: 4 } }, '维护'),
            h('div', { className: 'dshc_hint', style: { marginBottom: 10, lineHeight: '21px' } },
              '三个按钮依次是：停止接管（模型改回官方原文）／重置回默认提示词（清掉你的自定义，恢复插件自带）／卸载（从 DSH 移除本插件）。'),
            h('div', { className: 'dshc_row', style: { flexWrap: 'wrap', gap: 8 } },
              h('button', { className: 'dshc_btn', disabled: busy, onClick: () => setModal({
                title: '停止接管，恢复系统默认？',
                body: h('div', null,
                  h('p', null, '如果你开过「整段接管」，模型现在看到的是你保存的文本。停止接管后，模型改回使用官方系统提示词原文。'),
                  h('p', { className: 'dshc_hint' }, '你保存的接管草稿不会丢，随时可以再开启；「前置纪律」和「我的提示词」不受影响。')),
                actions: h('div', { className: 'dshc_row' },
                  h('button', { className: 'dshc_btn', onClick: () => void doStopTakeover() }, '确认停止接管'),
                  h('button', { className: 'dshc_btn', onClick: () => setModal(null) }, '取消')),
              }) }, '停止接管'),
              h('button', { className: 'dshc_btn', disabled: busy, onClick: () => setModal({
                title: '重置回默认提示词？',
                body: h('div', null,
                  h('p', null, '将把「前置纪律」和「我的提示词」清空，并把渐进分节恢复成插件自带版本。'),
                  h('p', { className: 'dshc_hint' }, '你自建的分节保留；此操作会先自动备份当前状态，可在「快照与恢复」回滚。')),
                actions: h('div', { className: 'dshc_row' },
                  h('button', { className: 'dshc_btn', 'data-danger': true, onClick: () => void doReset() }, '确认重置'),
                  h('button', { className: 'dshc_btn', onClick: () => setModal(null) }, '取消')),
              }) }, '重置回默认提示词'),
              h('button', { className: 'dshc_btn', 'data-danger': true, onClick: () => setModal({
                title: '卸载本插件？',
                body: h('div', null,
                  h('p', null, '卸载＝从 DSH 配置档移除本插件。请在终端执行下面这条命令（网页后台没有权限替你卸载）：'),
                  h('p', null, h('code', { style: { wordBreak: 'break-all' } }, uninstallCmd)),
                  h('p', { className: 'dshc_hint' }, '卸载不会删除你的配置数据（$DSH_HOME/dsh-custom），重装后自动回位；重启 DSH 后生效。')),
                actions: h('div', { className: 'dshc_row' },
                  h('button', { className: 'dshc_btn', onClick: async () => { try { await navigator.clipboard.writeText(uninstallCmd); setMsg({ title: '已复制卸载命令', detail: '粘贴到终端执行（记得把 <你的档名> 换成实际档名）' }); } catch { setMsg({ title: '复制失败', detail: '请手动选中命令复制' }); } } }, '复制命令'),
                  h('button', { className: 'dshc_btn', onClick: () => setModal(null) }, '关闭')),
              }) }, '卸载'))),
          st && st.root ? h('div', { className: 'dshc_hint', style: { marginTop: 12 } }, '当前数据目录：' + st.root) : null),
        h(Modal, { open: modal !== null, title: modal ? modal.title : '', onClose: () => setModal(null), actions: modal ? modal.actions : null }, modal ? modal.body : null),
        h(Toast, { msg }));
    }

    // ── 外壳 ──
    const PAGES = [
      ['sessions', '会话管理'],
      ['prompts', '系统提示词管理'],
      ['snapshots', '快照与恢复'],
      ['stats', '统计数据'],
      ['governance', '治理开关'],
      ['about', '关于'],
    ];
    function Tab() {
      const [page, setPage] = useState('sessions');
      const [toastMsg, setToastMsg] = useState(null);
      const [pending, setPending] = useState(null); // 跨页防丢：待切换的页 { key, label }
      const dirtyRef = useRef(false);
      const markDirty = useCallback((d) => { dirtyRef.current = d; }, []);
      const requestPage = (k) => {
        if (k === page) return;
        if (dirtyRef.current) {
          const hit = PAGES.find(([pk]) => pk === k);
          setPending({ key: k, label: hit ? hit[1] : k });
          return;
        }
        setPage(k);
      };
      return h('div', { className: 'dshc' },
        h(Modal, { open: pending !== null, title: '放弃未保存的修改？', onClose: () => setPending(null),
          actions: h('div', { className: 'dshc_row' },
            h('button', { className: 'dshc_btn', 'data-danger': true, onClick: () => { const target = pending; setPending(null); if (target) setPage(target.key); } }, '放弃并切页'),
            h('button', { className: 'dshc_btn', onClick: () => setPending(null) }, '继续编辑')) },
          pending
            ? h('div', null,
              h('p', null, '切换到「' + pending.label + '」后，本次未保存的编辑会丢失。'),
              h('p', null, '先保存再切页可保留改动。'))
            : null),
        h('div', { className: 'dshc_top' },
          h('div', { className: 'dshc_brand' }, 'DSH自定义'),
          h('span', { className: 'dshc_spacer' })),
        h('nav', { className: 'dshc_nav' },
          PAGES.map(([k, label]) => h('button', { key: k, 'data-active': page === k, 'aria-current': page === k ? 'page' : undefined, onClick: () => requestPage(k) }, label))),
        page === 'sessions' ? h(SessionsPage, { toast: { msg: toastMsg }, onDirty: markDirty })
          : page === 'prompts' ? h(PromptsPage, { onDirty: markDirty })
          : page === 'snapshots' ? h(SnapshotsPage)
          : page === 'stats' ? h(StatsPage)
          : page === 'about' ? h(AboutPage)
          : h(GovernancePage),
        h(Toast, { msg: toastMsg }));
    }

    const inject = ['slots'];

    // 页面错误边界：单页崩溃不再拖白整个管理后台（错误文本原样显示，便于反馈定位）
    class TabBoundary extends React.Component {
      constructor(props) { super(props); this.state = { err: null }; }
      static getDerivedStateFromError(e) { return { err: e }; }
      render() {
        if (!this.state.err) return this.props.children;
        return h('div', { className: 'dshc_panel' },
          h('div', { className: 'dshc_ph' }, h('h3', null, '页面出错了')),
          h('div', { className: 'dshc_banner' }, '渲染异常：' + String((this.state.err && this.state.err.message) || this.state.err || '未知错误')),
          h('div', { className: 'dshc_hint', style: { padding: '0 14px 14px' } }, '请把上面这段错误文字反馈给维护者；切换其他页签或点「刷新」可尝试恢复。'));
      }
    }

    function apply(ctx) {
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'dsh-custom',
        order: 30,
        label: () => 'DSH自定义',
      }, () => h(TabBoundary, null, h(Tab))));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
