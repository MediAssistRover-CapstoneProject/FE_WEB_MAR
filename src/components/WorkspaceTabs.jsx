import { injectStyles } from '../styles/injectStyles.js';

injectStyles('workspace-tabs-shared', `
.workspace-tabs{display:flex;flex-wrap:wrap;gap:12px;margin:18px 0 0;min-width:0}
.workspace-tabs>button{box-sizing:border-box;flex:0 1 190px;min-width:0;min-height:36px;border:0;border-radius:6px;padding:9px 14px;background:#f1f5f9;color:#0f172a;font:500 12px/1.5 Inter,Arial,sans-serif;cursor:pointer;box-shadow:none;transform:none}
.workspace-tabs>button[aria-current]{background:#2f80ff;color:#fff;font-weight:600}
.workspace-tabs>button:disabled{opacity:.45;cursor:not-allowed}
.workspace-tabs>button:focus-visible{outline:3px solid #93c5fd;outline-offset:3px}
@media(max-width:600px){.workspace-tabs{gap:8px}.workspace-tabs>button{flex:1 1 0;padding:9px 6px}}
`);

export default function WorkspaceTabs({items, active, onSelect, label}) {
  return <nav className="workspace-tabs" aria-label={label}>{items.map(item =>
    <button key={item.id} type="button" disabled={item.disabled} title={item.hint}
      aria-current={active === item.id ? 'page' : undefined} onClick={() => onSelect(item.id)}>{item.label}</button>
  )}</nav>;
}
