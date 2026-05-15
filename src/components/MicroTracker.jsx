// src/components/MicroTracker.jsx
import React, { useState } from 'react';
import { useApp } from '../lib/AppContext';
import { PARAMETERS } from '../lib/constants';
import { fetchLatest10Q } from '../lib/api';

export default function MicroTracker() {
  const { state, dispatch } = useApp();
  const { gsibData, deepseekKey } = state;
  const [secLinks, setSecLinks] = useState({});
  const [secLoading, setSecLoading] = useState({});
  const [aiPasting, setAiPasting] = useState(null);
  const [pasteText, setPasteText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState('');

  const totals = {
    reserves: gsibData.reduce((a, b) => a + (b.reserves || 0), 0),
    assets: gsibData.reduce((a, b) => a + (b.assets || 0), 0),
  };
  const systemReservesEst = totals.reserves / PARAMETERS.GSIB_SHARE;

  // ── 一键更新全部 ──────────────────────────────────────────
  async function bulkUpdateAll() {
    if (!deepseekKey) { alert('请先在设置中填写 DeepSeek API Key'); return; }
    setBulkLoading(true);

    for (let i = 0; i < gsibData.length; i++) {
      const bank = gsibData[i];
      setBulkProgress(`正在获取 ${bank.code} 最新10-Q… (${i+1}/${gsibData.length})`);

      try {
        // Step 1: get SEC filing index
        const filing = await fetchLatest10Q(bank.cik);
        if (!filing) { setBulkProgress(`${bank.code}: SEC链接获取失败，跳过`); continue; }

        setSecLinks(p => ({ ...p, [bank.code]: filing }));

        // Step 2: fetch the index HTML to find main document
        setBulkProgress(`正在读取 ${bank.code} 财报文件… (${i+1}/${gsibData.length})`);
        const indexRes = await fetch(
          `https://www.sec.gov/Archives/edgar/data/${bank.cik.replace(/^0+/,'')
          }/${filing.accession.replace(/-/g,'')}/`,
          { headers: { 'User-Agent': 'FedLiquidityMonitor/7.0 (research@example.com)' },
            signal: AbortSignal.timeout(15000) }
        );
        const indexHtml = await indexRes.text();

        // Find main 10-Q htm file (largest .htm not index)
        const htmMatches = [...indexHtml.matchAll(/href="([^"]+\.htm)"/gi)]
          .map(m => m[1])
          .filter(f => !f.includes('index') && !f.includes('exhibit'));
        const mainFile = htmMatches[0];
        if (!mainFile) { setBulkProgress(`${bank.code}: 找不到主文档，跳过`); continue; }

        // Step 3: fetch first ~80KB of the main document (enough for key ratios)
        setBulkProgress(`正在解析 ${bank.code} 财务数据… (${i+1}/${gsibData.length})`);
        const docUrl = `https://www.sec.gov/Archives/edgar/data/${bank.cik.replace(/^0+/,'')
          }/${filing.accession.replace(/-/g,'')}/${mainFile}`;
        const docRes = await fetch(docUrl, {
          headers: { 'User-Agent': 'FedLiquidityMonitor/7.0 (research@example.com)' },
          signal: AbortSignal.timeout(20000)
        });
        const fullHtml = await docRes.text();
        // Extract plain text, take first 12000 chars for AI
        const plainText = fullHtml
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .slice(0, 12000);

        // Step 4: DeepSeek extract
        setBulkProgress(`DeepSeek 提取 ${bank.code} 关键指标… (${i+1}/${gsibData.length})`);
        const aiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${deepseekKey}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            max_tokens: 200,
            temperature: 0,
            messages: [{
              role: 'user',
              content: `从以下${bank.bank}银行10-Q财报文本中提取关键数据。
仅返回JSON，无其他文字：
{"reserves": 数字(十亿美元,cash+interest-bearing deposits合计), "lcr": 数字(百分比,如115), "slr": 数字(百分比,如5.8), "dw_preposition": 数字或null}

文本：${plainText}`
            }]
          }),
          signal: AbortSignal.timeout(30000)
        });

        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || '';
        const cleaned = content.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        if (parsed && typeof parsed.reserves === 'number') {
          dispatch({
            type: 'UPDATE_GSIB_ROW',
            index: i,
            data: { ...parsed, src: `[AI自动更新 ${filing.date}]` }
          });
        }

      } catch (e) {
        console.error(`Bulk update ${bank.code}:`, e);
        setBulkProgress(`${bank.code}: 解析失败 (${e.message.slice(0,40)})，继续下一家…`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    setBulkLoading(false);
    setBulkProgress('✓ 全部更新完成');
    setTimeout(() => setBulkProgress(''), 4000);
  }

  async function getSECLink(bank) {
    setSecLoading(p => ({ ...p, [bank.code]: true }));
    const res = await fetchLatest10Q(bank.cik);
    setSecLinks(p => ({ ...p, [bank.code]: res }));
    setSecLoading(p => ({ ...p, [bank.code]: false }));
  }

  async function aiExtract(idx) {
    if (!pasteText.trim()) return;
    if (!deepseekKey) { alert('请先配置 DeepSeek API Key'); return; }
    setAiLoading(true);
    try {
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          max_tokens: 300,
          temperature: 0,
          messages: [{
            role: 'user',
            content: `从以下银行财报文本中提取关键数据，仅返回JSON格式（无其他文字）：
{"reserves": 数字(十亿美元), "lcr": 数字(百分比), "slr": 数字(百分比), "dw_preposition": 数字(十亿美元,若无填null)}

文本：
${pasteText.slice(0, 3000)}`
          }]
        }),
        signal: AbortSignal.timeout(20000)
      });
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      const cleaned = content.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      dispatch({ type: 'UPDATE_GSIB_ROW', index: idx, data: { ...parsed, src: '[AI 解析，请验证]' } });
      setAiPasting(null);
      setPasteText('');
    } catch (e) {
      alert('AI解析失败：' + e.message);
    } finally {
      setAiLoading(false);
    }
  }

  function updateCell(idx, field, val) {
    dispatch({ type: 'UPDATE_GSIB_ROW', index: idx, data: { [field]: parseFloat(val) || val } });
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-terminal-surface border border-terminal-border rounded p-3">
          <div className="text-xs text-terminal-dim font-mono mb-1">G-SIB 准备金合计</div>
          <div className="text-xl font-mono font-semibold text-terminal-accent">${totals.reserves}B</div>
          <div className="text-xs text-terminal-muted font-mono italic">[YUN2026 表14, 2025Q4]</div>
        </div>
        <div className="bg-terminal-surface border border-terminal-border rounded p-3">
          <div className="text-xs text-terminal-dim font-mono mb-1">占系统比例</div>
          <div className="text-xl font-mono font-semibold text-terminal-green">
            {(totals.reserves / systemReservesEst * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-terminal-muted font-mono italic">[YUN2026 §12.4] 基准71.9%</div>
        </div>
        <div className="bg-terminal-surface border border-terminal-border rounded p-3">
          <div className="text-xs text-terminal-dim font-mono mb-1">系统准备金推算</div>
          <div className="text-xl font-mono font-semibold text-terminal-text">${systemReservesEst.toFixed(0)}B</div>
          <div className="text-xs text-terminal-muted font-mono">G-SIB ÷ 71.9%</div>
        </div>
        <div className="bg-terminal-surface border border-terminal-green/30 rounded p-3">
          <div className="text-xs text-terminal-dim font-mono mb-1">代表性假设</div>
          <div className="text-xl font-mono font-semibold text-terminal-green">✓ 成立</div>
          <div className="text-xs text-terminal-muted font-mono italic">[YUN2026 §12.4, 发现2]</div>
        </div>
      </div>

      {/* One-click update button */}
      <div className="bg-terminal-surface border border-terminal-accent/30 rounded p-4 flex flex-wrap items-center gap-4">
        <div className="flex-1">
          <div className="text-sm font-mono font-semibold text-terminal-accent mb-1">一键更新全部银行数据</div>
          <div className="text-xs text-terminal-muted font-mono">
            自动从 SEC EDGAR 获取6家G-SIB最新10-Q，调用 DeepSeek 提取准备金、LCR、SLR数据
          </div>
          {bulkProgress && (
            <div className={`text-xs font-mono mt-2 ${
              bulkProgress.startsWith('✓') ? 'text-terminal-green' :
              bulkProgress.includes('失败') ? 'text-terminal-red' : 'text-terminal-amber'
            }`}>
              {bulkLoading && <span className="animate-pulse mr-1">⟳</span>}
              {bulkProgress}
            </div>
          )}
        </div>
        <button
          onClick={bulkUpdateAll}
          disabled={bulkLoading || !deepseekKey}
          className="px-5 py-2.5 rounded border border-terminal-accent text-terminal-accent hover:bg-terminal-accent hover:text-terminal-bg transition-colors font-mono font-semibold text-sm disabled:opacity-40 flex-shrink-0"
        >
          {bulkLoading ? '⟳ 更新中…' : '⚡ 一键更新全部'}
        </button>
        {!deepseekKey && (
          <div className="text-xs text-terminal-amber font-mono w-full">⚠ 需要先配置 DeepSeek API Key（右上角设置）</div>
        )}
      </div>

      {/* Main table */}
      <div className="bg-terminal-surface border border-terminal-border rounded p-4 overflow-x-auto">
        <div className="text-xs text-terminal-dim font-mono mb-3">
          G-SIB 资产负债表监测
          <span className="text-terminal-muted/50 ml-2 italic">[YUN2026 §12, 表13-14] 初始数据：2025Q4</span>
        </div>
        <table className="w-full text-xs font-mono border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-terminal-border text-terminal-dim">
              <th className="text-left py-2 pr-3">银行</th>
              <th className="text-right py-2 px-2">准备金($B)</th>
              <th className="text-right py-2 px-2">LCR(%)</th>
              <th className="text-right py-2 px-2">SLR(%)</th>
              <th className="text-right py-2 px-2">DW预抵押($B)</th>
              <th className="text-right py-2 px-2">准备金/HQLA</th>
              <th className="text-center py-2 px-2">SEC 10-Q</th>
              <th className="text-center py-2 px-2">手动解析</th>
            </tr>
          </thead>
          <tbody>
            {gsibData.map((bank, i) => {
              const resHqlaRatio = bank.hqla ? (bank.reserves / bank.hqla * 100).toFixed(1) : '—';
              const lcrAlert = bank.lcr < 110;
              const slrAlert = bank.slr < 5.0;
              const isAiUpdated = bank.src?.includes('AI');
              return (
                <tr key={bank.code} className="border-b border-terminal-border/30 hover:bg-terminal-bg/50">
                  <td className="py-2 pr-3">
                    <span className="text-terminal-accent font-semibold">{bank.code}</span>
                    <span className="text-terminal-dim ml-1">{bank.bank}</span>
                    {isAiUpdated && (
                      <span className="ml-2 text-terminal-green text-xs">✓ AI更新</span>
                    )}
                  </td>
                  <td className="text-right py-2 px-2">
                    {editIdx === `${i}_reserves` ? (
                      <input type="number" defaultValue={bank.reserves}
                        className="w-16 bg-terminal-bg border border-terminal-accent rounded px-1 text-right text-terminal-text"
                        onBlur={e => { updateCell(i, 'reserves', e.target.value); setEditIdx(null); }}
                        autoFocus />
                    ) : (
                      <span className="cursor-pointer hover:text-terminal-accent" onClick={() => setEditIdx(`${i}_reserves`)}>
                        {bank.reserves}
                      </span>
                    )}
                  </td>
                  <td className={`text-right py-2 px-2 ${lcrAlert ? 'text-terminal-red font-semibold' : 'text-terminal-text'}`}>
                    {bank.lcr}{lcrAlert && ' ⚠'}
                  </td>
                  <td className={`text-right py-2 px-2 ${slrAlert ? 'text-terminal-red font-semibold' : 'text-terminal-text'}`}>
                    {bank.slr}{slrAlert && ' ⚠'}
                  </td>
                  <td className="text-right py-2 px-2 text-terminal-dim">{bank.dw_preposition || '—'}</td>
                  <td className="text-right py-2 px-2 text-terminal-dim">{resHqlaRatio}%</td>
                  <td className="text-center py-2 px-2">
                    {secLinks[bank.code] ? (
                      <a href={secLinks[bank.code].url} target="_blank" rel="noreferrer"
                        className="text-terminal-accent underline text-xs">
                        {secLinks[bank.code].date}
                      </a>
                    ) : (
                      <button
                        onClick={() => getSECLink(bank)}
                        disabled={secLoading[bank.code]}
                        className="text-xs px-2 py-0.5 rounded border border-terminal-border text-terminal-dim hover:border-terminal-accent hover:text-terminal-accent transition-colors"
                      >
                        {secLoading[bank.code] ? '…' : '获取'}
                      </button>
                    )}
                  </td>
                  <td className="text-center py-2 px-2">
                    <button
                      onClick={() => setAiPasting(i)}
                      className="text-xs px-2 py-0.5 rounded border border-terminal-border text-terminal-dim hover:border-terminal-green hover:text-terminal-green transition-colors"
                    >
                      粘贴解析
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-terminal-accent/30 text-terminal-accent font-semibold">
              <td className="py-2 pr-3">合计 / G-SIB</td>
              <td className="text-right py-2 px-2">{totals.reserves}</td>
              <td className="text-right py-2 px-2 text-terminal-dim">均值 {(gsibData.reduce((a,b)=>a+(b.lcr||0),0)/gsibData.length).toFixed(1)}%</td>
              <td className="text-right py-2 px-2 text-terminal-dim">均值 {(gsibData.reduce((a,b)=>a+(b.slr||0),0)/gsibData.length).toFixed(1)}%</td>
              <td className="text-right py-2 px-2">{gsibData.reduce((a,b)=>a+(b.dw_preposition||0),0)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
        <div className="text-xs text-terminal-muted/50 font-mono italic mt-2">
          点击准备金数字可手动编辑 · LCR&lt;110% 或 SLR&lt;5% 时标红预警
        </div>
      </div>

      {/* LCR/SLR alert zone */}
      <div className="bg-terminal-surface border border-terminal-border rounded p-4">
        <div className="text-xs text-terminal-dim font-mono mb-3">
          监管指标预警说明
          <span className="text-terminal-muted/50 ml-2 italic">[YUN2026 §12.5, 假设A] [FEDS2026 §LCR/SLR规则]</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="border border-terminal-amber/30 bg-terminal-amber/5 rounded p-3">
            <div className="text-terminal-amber font-semibold mb-1">LCR 预警 (&lt;110%)</div>
            <div className="text-terminal-dim">LCR 接近100%时，银行被监管要求维持更多准备金（LCLOR↑）。选项1-3（LCR改革）通过降低此阈值释放准备金。[FEDS2026 选项1-3]</div>
          </div>
          <div className="border border-terminal-amber/30 bg-terminal-amber/5 rounded p-3">
            <div className="text-terminal-amber font-semibold mb-1">SLR 预警 (&lt;5.0%)</div>
            <div className="text-terminal-dim">SLR接近底线时，交易商（Kt）减少回购头寸，QT传导受阻。选项5（SLR减免）专门解决这一中介瓶颈。[FEDS2026 选项5] [YUN2026 §3.2]</div>
          </div>
        </div>
      </div>

      {/* Manual paste modal */}
      {aiPasting !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-terminal-surface border border-terminal-border rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-terminal-accent font-mono text-sm font-semibold">
                手动解析 — {gsibData[aiPasting]?.bank}
              </h3>
              <button onClick={() => { setAiPasting(null); setPasteText(''); }} className="text-terminal-dim hover:text-terminal-text text-xl">×</button>
            </div>
            <div className="text-xs text-terminal-dim font-mono mb-2">
              粘贴10-Q/10-K相关文本，AI将提取：准备金余额、LCR、SLR、DW预抵押规模
            </div>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="粘贴银行财报文本…"
              className="w-full h-40 bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-terminal-text text-xs font-mono placeholder-terminal-muted outline-none focus:border-terminal-accent resize-none"
            />
            <div className="flex gap-3 mt-3">
              <button
                onClick={() => aiExtract(aiPasting)}
                disabled={aiLoading || !pasteText.trim()}
                className="px-4 py-2 rounded border border-terminal-green text-terminal-green hover:bg-terminal-green/10 text-sm font-mono font-semibold disabled:opacity-50 transition-colors"
              >
                {aiLoading ? '解析中…' : 'AI 提取数据'}
              </button>
              <button onClick={() => { setAiPasting(null); setPasteText(''); }}
                className="px-4 py-2 rounded border border-terminal-border text-terminal-dim text-sm font-mono">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
