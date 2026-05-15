// src/components/AuditPanel.jsx
import React, { useState } from 'react';
import { useApp } from '../lib/AppContext';
import { getAuditLogs, exportAuditCSV } from '../lib/api';
import { buildSnapshotURL } from '../lib/snapshot';
import { PARAMETERS, STABILITY, B_SCARCE } from '../lib/constants';

export default function AuditPanel() {
  const { state } = useApp();
  const logs = getAuditLogs();
  const [snapUrl, setSnapUrl] = useState('');
  const [copied, setCopied] = useState(false);

  function generateSnapshot() {
    const snap = {
      fredData: state.fredData,
      indicators: state.indicators,
      gsibData: state.gsibData,
      selectedPolicies: Array.from(state.selectedPolicies),
      policyScenario: state.policyScenario,
      syncNsfr: state.syncNsfr,
      policyResult: state.policyResult,
    };
    const url = buildSnapshotURL(snap);
    setSnapUrl(url);
  }

  function copySnap() {
    navigator.clipboard.writeText(snapUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Parameter reference card */}
      <div className="bg-terminal-surface border border-terminal-border rounded p-4">
        <div className="text-xs text-terminal-dim font-mono mb-3">论文参数完整参考表</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-terminal-border text-terminal-dim">
                <th className="text-left py-1 pr-4">参数</th>
                <th className="text-right py-1 pr-4">值</th>
                <th className="text-left py-1 pr-4">经济含义</th>
                <th className="text-left py-1 pr-4">识别方法</th>
                <th className="text-left py-1">来源</th>
              </tr>
            </thead>
            <tbody>
              {[
                { p: 'B*scarce', v: `$${(B_SCARCE/10).toFixed(1)}B`, m: '稀缺区入口门限', id: 'Hansen门限回归', src: '[YUN2026 §11.5, 表12]', ok: true },
                { p: 'µ̂', v: '[0.67, 1.01]', m: '棘轮效应强度', id: '两锚点识别', src: '[YUN2026 §11.5, 表12]', ok: true },
                { p: 'β₃', v: PARAMETERS.BETA_3, m: '恐慌反馈强度', id: 'IV(TGA冲击)', src: '[YUN2026 §13.5, 表18]', ok: true },
                { p: 'δ', v: PARAMETERS.DELTA, m: '政策响应速度(B/pp)', id: '事件研究', src: '[YUN2026 §13.6, 表19]', ok: true },
                { p: 'α₁', v: PARAMETERS.ALPHA_1, m: 'LCR弹性', id: 'DiD-RDD', src: '[YUN2026 §12.4, 表15]', ok: true },
                { p: 'G-SIB占比', v: '71.9%', m: '代表性假设验证', id: '数据计算', src: '[YUN2026 §12.4, 表15]', ok: true },
                { p: 'λA', v: PARAMETERS.LAMBDA_A, m: '充裕区压力弹性', id: 'Hansen门限', src: '[YUN2026 §11.5]', ok: true },
                { p: 'λ', v: PARAMETERS.LAMBDA, m: '市场弹性', id: '⚠️校准值非估计值', src: '[YUN2026 表20]', ok: false },
                { p: '∂W/∂M', v: PARAMETERS.DW_DM, m: '预警敏感性', id: '⚠️校准值非估计值', src: '[YUN2026 §4.2.6]', ok: false },
                { p: 'β₂(本文)', v: '+0.57', m: '套利弹性(FE控制后)', id: 'OLS+季度FE', src: '[YUN2026 §13.4, 表17]', ok: false },
                { p: 'β₂(LVJ)', v: '-0.80', m: '套利弹性(文献基准)', id: '银行级panel', src: '[LVJ2025] [FEDS2026参考]', ok: true },
              ].map(row => (
                <tr key={row.p} className={`border-b border-terminal-border/30 ${row.ok ? '' : 'bg-terminal-amber/5'}`}>
                  <td className="py-1.5 pr-4 font-semibold text-terminal-accent">{row.p}</td>
                  <td className={`text-right py-1.5 pr-4 font-semibold ${row.ok ? 'text-terminal-green' : 'text-terminal-amber'}`}>{row.v}</td>
                  <td className="py-1.5 pr-4 text-terminal-dim">{row.m}</td>
                  <td className={`py-1.5 pr-4 ${row.ok ? 'text-terminal-dim' : 'text-terminal-amber'}`}>{row.id}</td>
                  <td className="py-1.5 text-terminal-muted/60 italic">{row.src}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs font-mono flex gap-4">
          <span className="text-terminal-green">■ 实证估计值（可信）</span>
          <span className="text-terminal-amber">■ 校准假设值（需注意不确定性）</span>
        </div>
      </div>

      {/* Snapshot sharing */}
      <div className="bg-terminal-surface border border-terminal-border rounded p-4">
        <div className="text-xs text-terminal-dim font-mono mb-3">只读快照分享</div>
        <div className="text-xs text-terminal-muted font-mono mb-3">
          将当前 Dashboard 状态（FRED数据、政策选择、银行数据）压缩为 URL，任何人打开可查看相同状态（无需API Key）。
        </div>
        <button
          onClick={generateSnapshot}
          className="px-4 py-2 rounded border border-terminal-accent text-terminal-accent hover:bg-terminal-accent/10 text-sm font-mono transition-colors"
        >
          生成快照链接
        </button>
        {snapUrl && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2 items-center">
              <input
                readOnly
                value={snapUrl}
                className="flex-1 bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-xs font-mono text-terminal-dim"
              />
              <button
                onClick={copySnap}
                className="px-3 py-1 rounded border border-terminal-border text-terminal-dim hover:text-terminal-text text-xs font-mono"
              >
                {copied ? '✓ 已复制' : '复制'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Audit log */}
      <div className="bg-terminal-surface border border-terminal-border rounded p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="text-xs text-terminal-dim font-mono">本地审计日志（最近50条）</div>
          <button
            onClick={exportAuditCSV}
            className="text-xs font-mono px-3 py-1 rounded border border-terminal-border text-terminal-dim hover:text-terminal-text transition-colors"
          >
            导出 CSV
          </button>
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {logs.length === 0 && (
            <div className="text-terminal-muted text-xs font-mono">暂无记录</div>
          )}
          {[...logs].reverse().map((log, i) => (
            <div key={i} className="flex gap-3 text-xs font-mono py-1 border-b border-terminal-border/20">
              <span className="text-terminal-muted/50 flex-shrink-0">{log.ts.slice(0, 19).replace('T', ' ')}</span>
              <span className="text-terminal-amber flex-shrink-0">{log.action}</span>
              <span className="text-terminal-dim">{log.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
