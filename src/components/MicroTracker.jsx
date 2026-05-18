// src/components/MicroTracker.jsx
import React, { useState } from 'react';
import { useApp } from '../lib/AppContext';
import { PARAMETERS } from '../lib/constants';
import { fetchLatest10Q } from '../lib/api';

const FIELDS = [
  { key: 'reserves',       label: '准备金($B)',   step: '1'   },
  { key: 'lcr',            label: 'LCR(%)',        step: '0.1' },
  { key: 'slr',            label: 'SLR(%)',        step: '0.1' },
  { key: 'dw_preposition', label: 'DW预抵押($B)',  step: '1'   },
];

export default function MicroTracker() {
  const { state, dispatch } = useApp();
  const { gsibData, deepseekKey } = state;
  const [editing, setEditing]     = useState({});
  const [tempVals, setTempVals]   = useState({});
  const [aiPasting, setAiPasting] = useState(null);
  const [pasteText, setPasteText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMsg, setAiMsg]         = useState('');
  const [secLinks, setSecLinks]   = useState({});
  const [secLoading, setSecLoading] = useState({});

  const totalReserves    = gsibData.reduce((a, b) => a + (b.reserves || 0), 0);
  const systemReservesEst = (totalReserves / PARAMETERS.GSIB_SHARE).toFixed(0);
  const avgLcr = (gsibData.reduce((a,b)=>a+(b.lcr||0),0)/gsibData.length).toFixed(1);
  const avgSlr = (gsibData.reduce((a,b)=>a+(b.slr||0),0)/gsibData.length).toFixed(1);
  const totalDw = gsibData.reduce((a,b)=>a+(b.dw_preposition||0),0);

  function startEdit(i, key) {
    const k = `${i}_${key}`;
    setTempVals(p => ({ ...p, [k]: String(gsibData[i][key] ?? '') }));
    setEditing(p => ({ ...p, [k]: true }));
  }
  function commitEdit(i, key) {
    const k = `${i}_${key}`;
    const num = parseFloat(tempVals[k]);
    if (!isNaN(num)) dispatch({ type: 'UPDATE_GSIB_ROW', index: i, data: { [key]: num, src: '[手动更新]' } });
    setEditing(p => { const n={...p}; delete n[k]; return n; });
  }
  function handleKey(e, i, key) {
    if (e.key === 'Enter')  commitEdit(i, key);
    if (e.key === 'Escape') setEditing(p => { const n={...p}; delete n[`${i}_${key}`]; return n; });
  }

  async function getSECLink(bank) {
    setSecLoading(p => ({ ...p, [bank.code]: true }));
    try {
      const res = await fetchLatest10Q(bank.cik);
      setSecLinks(p => ({ ...p, [bank.code]: res }));
    } catch { setSecLinks(p => ({ ...p, [bank.code]: null })); }
    setSecLoading(p => ({ ...p, [bank.code]: false }));
  }

  async function aiExtract(idx) {
    if (!pasteText.trim()) return;
    if (!deepseekKey) { setAiMsg('请先在设置中配置 DeepSeek API Key'); return; }
    setAiLoading(true); setAiMsg('');
    try {
      const bank = gsibData[idx];
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${deepseekKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat', max_tokens: 300, temperature: 0,
          messages: [{ role: 'user', content:
            `从${bank.bank}财报文本提取数据，仅返回JSON（无其他文字）：
{"reserves":数字(十亿美元),"lcr":数字(百分比如115),"slr":数字(如5.8),"dw_preposition":数字或null}
文本：\n${pasteText.slice(0,4000)}` }]
        }),
        signal: AbortSignal.timeout(20000)
      });
      const data = await res.json();
      const parsed = JSON.parse((data.choices?.[0]?.message?.content||'').replace(/```json|```/g,'').trim());
      if (parsed && typeof parsed.reserves === 'number') {
        dispatch({ type: 'UPDATE_GSIB_ROW', index: idx, data: { ...parsed, src: '[AI解析，请验证]' } });
        setAiPasting(null); setPasteText(''); setAiMsg('');
      } else { setAiMsg('AI返回格式异常，请手动填写'); }
    } catch(e) { setAiMsg('解析失败：' + e.message.slice(0,60)); }
    finally { setAiLoading(false); }
  }

  return (
    <div className="space-y-4">

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:'G-SIB 准备金合计', val:`$${totalReserves}B`, sub:'[YUN2026 表14, 2025Q4]', color:'text-terminal-accent' },
          { label:'占系统比例', val:`${(totalReserves/parseFloat(systemReservesEst)*100).toFixed(1)}%`, sub:'基准71.9% [YUN2026 §12.4]', color:'text-terminal-green' },
          { label:'系统准备金推算', val:`$${systemReservesEst}B`, sub:'G-SIB ÷ 71.9%', color:'text-terminal-text' },
          { label:'代表性假设', val:'✓ 成立', sub:'[YUN2026 §12.4, 发现2]', color:'text-terminal-green' },
        ].map(c => (
          <div key={c.label} className="bg-terminal-surface border border-terminal-border rounded p-3">
            <div className="text-xs text-terminal-dim font-mono mb-1">{c.label}</div>
            <div className={`text-xl font-mono font-semibold ${c.color}`}>{c.val}</div>
            <div className="text-xs text-terminal-muted font-mono italic">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* How to update */}
      <div className="bg-terminal-surface border border-terminal-accent/20 rounded p-4">
        <div className="text-sm font-mono font-semibold text-terminal-accent mb-2">📋 数据更新流程</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono text-terminal-dim">
          <div className="border border-terminal-border/50 rounded p-2">
            <div className="text-terminal-text font-semibold mb-1">① 获取季报链接</div>
            <div>点击表格"SEC 10-Q"按钮获取最新季报链接，打开财报HTM或下载PDF</div>
          </div>
          <div className="border border-terminal-border/50 rounded p-2">
            <div className="text-terminal-text font-semibold mb-1">② 找到关键数字</div>
            <div>
              Ctrl+F 搜索：<br/>
              <code className="text-terminal-accent">cash and due</code> → 准备金<br/>
              <code className="text-terminal-accent">LCR</code> → 流动性覆盖率<br/>
              <code className="text-terminal-accent">supplementary leverage</code> → SLR
            </div>
          </div>
          <div className="border border-terminal-border/50 rounded p-2">
            <div className="text-terminal-text font-semibold mb-1">③ 录入数据</div>
            <div>
              <span className="text-terminal-accent">方式A</span>：点击表格数字直接编辑<br/>
              <span className="text-terminal-accent">方式B</span>：复制相关段落 → 点"粘贴" → AI自动提取
            </div>
          </div>
        </div>
      </div>

      {/* Main table */}
      <div className="bg-terminal-surface border border-terminal-border rounded p-4 overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-terminal-dim font-mono">
            G-SIB 资产负债表监测
            <span className="text-terminal-muted/50 ml-2 italic">[YUN2026 §12, 表13-14] 初始：2025Q4</span>
          </div>
          <div className="text-xs text-terminal-muted font-mono">点击数字编辑 · Enter确认 · Esc取消</div>
        </div>
        <table className="w-full text-xs font-mono border-collapse min-w-[750px]">
          <thead>
            <tr className="border-b border-terminal-border text-terminal-dim text-right">
              <th className="text-left py-2 pr-3">银行</th>
              {FIELDS.map(f => <th key={f.key} className="py-2 px-3">{f.label}</th>)}
              <th className="py-2 px-2">准备金/HQLA</th>
              <th className="py-2 px-2">来源</th>
              <th className="py-2 px-2 text-center">SEC 10-Q</th>
              <th className="py-2 px-2 text-center">AI解析</th>
            </tr>
          </thead>
          <tbody>
            {gsibData.map((bank, i) => {
              const ratio    = bank.hqla ? (bank.reserves/bank.hqla*100).toFixed(1)+'%' : '—';
              const lcrAlert = bank.lcr  && bank.lcr < 110;
              const slrAlert = bank.slr  && bank.slr < 5.0;
              return (
                <tr key={bank.code} className="border-b border-terminal-border/30 hover:bg-terminal-bg/40">
                  <td className="py-2 pr-3">
                    <span className="text-terminal-accent font-semibold">{bank.code}</span>
                    <span className="text-terminal-dim ml-1 hidden md:inline text-xs">{bank.bank}</span>
                    {bank.src?.includes('AI')    && <span className="ml-1 text-terminal-green text-xs">✓AI</span>}
                    {bank.src?.includes('手动')  && <span className="ml-1 text-terminal-amber text-xs">✎</span>}
                  </td>
                  {FIELDS.map(f => {
                    const k    = `${i}_${f.key}`;
                    const val  = bank[f.key];
                    const alrt = (f.key==='lcr'&&lcrAlert)||(f.key==='slr'&&slrAlert);
                    return (
                      <td key={f.key} className={`text-right py-2 px-3 ${alrt?'text-terminal-red font-semibold':'text-terminal-text'}`}>
                        {editing[k] ? (
                          <input type="number" step={f.step} value={tempVals[k]??''}
                            onChange={e=>setTempVals(p=>({...p,[k]:e.target.value}))}
                            onBlur={()=>commitEdit(i,f.key)}
                            onKeyDown={e=>handleKey(e,i,f.key)}
                            className="w-20 bg-terminal-bg border border-terminal-accent rounded px-1 py-0.5 text-right outline-none"
                            autoFocus />
                        ) : (
                          <span className="cursor-pointer hover:text-terminal-accent hover:underline decoration-dotted" onClick={()=>startEdit(i,f.key)}>
                            {val??<span className="text-terminal-muted">—</span>}{alrt?' ⚠':''}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-right py-2 px-2 text-terminal-dim">{ratio}</td>
                  <td className="text-right py-2 px-2 text-terminal-muted/60 text-xs max-w-[80px] truncate">{bank.src||'初始值'}</td>
                  <td className="text-center py-2 px-2">
                    {secLinks[bank.code] ? (
                      <a href={secLinks[bank.code].url} target="_blank" rel="noreferrer"
                        className="text-terminal-accent underline">{secLinks[bank.code].date}</a>
                    ) : (
                      <button onClick={()=>getSECLink(bank)} disabled={secLoading[bank.code]}
                        className="px-2 py-0.5 rounded border border-terminal-border text-terminal-dim hover:border-terminal-accent hover:text-terminal-accent transition-colors">
                        {secLoading[bank.code]?'…':'获取'}
                      </button>
                    )}
                  </td>
                  <td className="text-center py-2 px-2">
                    <button onClick={()=>{setAiPasting(i);setAiMsg('');}}
                      className="px-2 py-0.5 rounded border border-terminal-border text-terminal-dim hover:border-terminal-green hover:text-terminal-green transition-colors">
                      粘贴
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-terminal-accent/30 text-terminal-accent font-semibold text-right">
              <td className="text-left py-2 pr-3">合计 / G-SIB</td>
              <td className="py-2 px-3">{totalReserves}</td>
              <td className="py-2 px-3 text-terminal-dim font-normal">均{avgLcr}%</td>
              <td className="py-2 px-3 text-terminal-dim font-normal">均{avgSlr}%</td>
              <td className="py-2 px-3">{totalDw}</td>
              <td colSpan={4}/>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Alert legend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-terminal-surface border border-terminal-amber/30 rounded p-3 text-xs font-mono">
          <div className="text-terminal-amber font-semibold mb-1">⚠ LCR 预警（&lt;110%）</div>
          <div className="text-terminal-dim">LCR趋近100%时LCLOR↑，准备金需求上升。选项1-3降低此约束。[FEDS2026 选项1-3] [YUN2026 §5.2]</div>
        </div>
        <div className="bg-terminal-surface border border-terminal-amber/30 rounded p-3 text-xs font-mono">
          <div className="text-terminal-amber font-semibold mb-1">⚠ SLR 预警（&lt;5.0%）</div>
          <div className="text-terminal-dim">SLR趋紧→交易商中介能力受限（Kt↓）→QT传导阻塞。选项5（SLR减免）专项解决。[FEDS2026 选项5] [YUN2026 §3.2]</div>
        </div>
      </div>

      {/* AI modal */}
      {aiPasting !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-terminal-surface border border-terminal-border rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-terminal-accent font-mono font-semibold">AI解析 — {gsibData[aiPasting]?.bank}</h3>
              <button onClick={()=>{setAiPasting(null);setPasteText('');setAiMsg('');}} className="text-terminal-dim text-xl">×</button>
            </div>
            <div className="text-xs text-terminal-dim font-mono mb-2">
              复制财报中含有准备金/LCR/SLR的段落粘贴在此，AI自动提取数值
            </div>
            <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)}
              placeholder="粘贴财报文本片段…"
              className="w-full h-44 bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-terminal-text text-xs font-mono placeholder-terminal-muted outline-none focus:border-terminal-accent resize-none"/>
            {aiMsg && <div className="text-terminal-red text-xs font-mono mt-1">{aiMsg}</div>}
            <div className="flex gap-3 mt-3">
              <button onClick={()=>aiExtract(aiPasting)} disabled={aiLoading||!pasteText.trim()}
                className="px-4 py-2 rounded border border-terminal-green text-terminal-green hover:bg-terminal-green/10 font-mono font-semibold disabled:opacity-50 transition-colors">
                {aiLoading?'解析中…':'⚡ AI 提取'}
              </button>
              <button onClick={()=>{setAiPasting(null);setPasteText('');setAiMsg('');}}
                className="px-4 py-2 rounded border border-terminal-border text-terminal-dim font-mono">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
