// src/components/PolicySimulator.jsx
import React, { useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell, Legend } from 'recharts';
import { useApp } from '../lib/AppContext';
import { POLICIES, B_SCARCE, INTERACTION_RULES } from '../lib/constants';
import { calcPolicyEffect, weeksToScarce, qtProjection } from '../lib/policyCalc';
import { logAudit } from '../lib/api';

const B_SCARCE_B = B_SCARCE / 10;
const CHANNEL_COLORS = {
  'I': '#00d4ff', 'II': '#00ff88', 'III': '#ffaa00',
  'IV': '#a78bfa', 'V': '#f472b6', 'VI': '#fb923c'
};

const SCENARIO_LABELS = { min: '悲观', mid: '中性', max: '乐观' };

export default function PolicySimulator() {
  const { state, dispatch } = useApp();
  const { selectedPolicies, policyScenario, syncNsfr, fredData } = state;
  const reserves = fredData.reserves;

  // Recalculate on any change
  const result = useMemo(() =>
    calcPolicyEffect(selectedPolicies, { syncNsfr }, policyScenario),
    [selectedPolicies, syncNsfr, policyScenario]
  );

  useEffect(() => {
    dispatch({ type: 'SET_POLICY_RESULT', payload: result });
  }, [result, dispatch]);

  function togglePolicy(id) {
    dispatch({ type: 'TOGGLE_POLICY', id });
    logAudit('政策切换', `选项${id} ${selectedPolicies.has(id) ? '取消' : '激活'}`);
  }

  // QT comparison
  const weeksNone = useMemo(() =>
    reserves ? weeksToScarce(reserves, B_SCARCE_B) : null,
    [reserves]
  );
  const weeksWithPolicy = useMemo(() =>
    reserves ? weeksToScarce(reserves, B_SCARCE_B, 8.75, result.adjusted / 10) : null,
    [reserves, result.adjusted]
  );

  // Build bar chart for policy effects
  const barData = POLICIES
    .filter(p => selectedPolicies.has(p.id))
    .map(p => ({
      name: `选项${p.id}`,
      raw: result.rawByPolicy[p.id] || 0,
      adjusted: result.byPolicy[p.id] || 0,
    }));

  // Effective safety margin
  const effectiveMargin = reserves !== null
    ? ((reserves + result.adjusted / 10) - B_SCARCE_B).toFixed(1)
    : null;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 bg-terminal-surface border border-terminal-border rounded p-3">
        <div className="text-xs text-terminal-dim font-mono">情景：</div>
        {['min', 'mid', 'max'].map(s => (
          <button
            key={s}
            onClick={() => dispatch({ type: 'SET_POLICY_SCENARIO', payload: s })}
            className={`text-xs font-mono px-3 py-1 rounded border transition-colors ${
              policyScenario === s
                ? 'border-terminal-accent text-terminal-accent bg-terminal-accent/10'
                : 'border-terminal-border text-terminal-dim hover:border-terminal-accent/50'
            }`}
          >
            {SCENARIO_LABELS[s]}
          </button>
        ))}
        <label className="flex items-center gap-2 text-xs font-mono text-terminal-dim cursor-pointer">
          <input
            type="checkbox"
            checked={syncNsfr}
            onChange={() => dispatch({ type: 'TOGGLE_NSFR' })}
            className="accent-terminal-accent"
          />
          同步改革 NSFR
          <span className="text-terminal-amber">(关闭则选项1/2 ×0.6)</span>
          <span className="text-terminal-muted/50 italic text-xs">[FEDS2026 §5.6]</span>
        </label>
        <button
          onClick={() => { dispatch({ type: 'RESET_POLICIES' }); logAudit('重置政策组合', ''); }}
          className="ml-auto text-xs font-mono px-3 py-1 rounded border border-terminal-red/50 text-terminal-red hover:bg-terminal-red/10 transition-colors"
        >
          重置全部
        </button>
      </div>

      {/* Results summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-terminal-surface border border-terminal-border rounded p-3">
          <div className="text-xs text-terminal-dim font-mono mb-1">已选政策数</div>
          <div className="text-2xl font-mono font-semibold text-terminal-accent">{selectedPolicies.size}</div>
        </div>
        <div className="bg-terminal-surface border border-terminal-border rounded p-3">
          <div className="text-xs text-terminal-dim font-mono mb-1">简单加总</div>
          <div className="text-2xl font-mono font-semibold text-terminal-dim">${result.simple}B</div>
          <div className="text-xs text-terminal-muted font-mono">未考虑交互效应</div>
        </div>
        <div className="bg-terminal-surface border border-terminal-border rounded p-3">
          <div className="text-xs text-terminal-dim font-mono mb-1">调整后效应</div>
          <div className="text-2xl font-mono font-semibold text-terminal-green">${result.adjusted}B</div>
          <div className="text-xs text-terminal-muted font-mono italic">[FEDS2026 §5.6 交互效应]</div>
        </div>
        <div className={`bg-terminal-surface border rounded p-3 ${
          effectiveMargin > 100 ? 'border-terminal-green/50' : effectiveMargin > 0 ? 'border-terminal-amber/50' : 'border-terminal-border'
        }`}>
          <div className="text-xs text-terminal-dim font-mono mb-1">有效安全裕度（政策后）</div>
          <div className={`text-2xl font-mono font-semibold ${effectiveMargin > 100 ? 'text-terminal-green' : effectiveMargin > 0 ? 'text-terminal-amber' : 'text-terminal-text'}`}>
            {effectiveMargin !== null ? `${effectiveMargin > 0 ? '+' : ''}${effectiveMargin}B` : '—'}
          </div>
        </div>
      </div>

      {/* MC validation range */}
      <div className="bg-terminal-surface border border-terminal-amber/30 rounded p-3 text-xs font-mono">
        <span className="text-terminal-amber">蒙特卡洛验证区间</span>
        <span className="text-terminal-dim ml-2">
          本文估计 [$1,791B, $2,181B] 95%CI &nbsp;|&nbsp; 原论文 [$1,150B, $2,125B] 95%CI &nbsp;|&nbsp; 联合通过率 91.25%
        </span>
        <span className="text-terminal-muted/50 ml-2 italic">[YUN2026 §15.4, 表23] [FEDS2026 §5]</span>
      </div>

      {/* Interaction effects log */}
      {result.interactions.length > 0 && (
        <div className="bg-terminal-surface border border-terminal-amber/30 rounded p-3">
          <div className="text-xs text-terminal-amber font-mono mb-2">⚡ 交互效应调整（不可简单加总）</div>
          {result.interactions.map((int, i) => (
            <div key={i} className="text-xs font-mono text-terminal-dim mb-1 flex gap-2">
              <span className="text-terminal-amber">→</span>
              <span>{int.rule}：{int.effect}</span>
              <span className="text-terminal-muted/50 italic ml-auto">{int.src}</span>
            </div>
          ))}
        </div>
      )}

      {/* Policy checklist */}
      <div className="bg-terminal-surface border border-terminal-border rounded p-4">
        <div className="text-xs text-terminal-dim font-mono mb-3">
          15项政策选项
          <span className="text-terminal-muted/50 ml-2 italic">[FEDS2026 表3, 附录Table 32] [YUN2026 §5]</span>
        </div>
        <div className="space-y-1">
          {POLICIES.map(p => {
            const checked = selectedPolicies.has(p.id);
            const val = p[policyScenario];
            const adjVal = result.byPolicy[p.id];
            const hasInteraction = adjVal !== undefined && adjVal !== val;
            return (
              <label key={p.id}
                className={`flex items-start gap-3 p-2 rounded cursor-pointer transition-colors border ${
                  checked
                    ? 'border-terminal-accent/40 bg-terminal-accent/5'
                    : 'border-transparent hover:border-terminal-border'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => togglePolicy(p.id)}
                  className="mt-0.5 accent-terminal-accent flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-semibold text-terminal-text">
                      {p.id}. {p.name}
                    </span>
                    <span
                      className="text-xs font-mono px-1.5 py-0.5 rounded border"
                      style={{ borderColor: CHANNEL_COLORS[p.channel] + '60', color: CHANNEL_COLORS[p.channel] }}
                    >
                      渠道{p.channel}·{p.dscm}
                    </span>
                    <span className="text-xs font-mono text-terminal-muted">
                      ${p.min}–${p.max}B
                    </span>
                    {checked && (
                      <span className={`text-xs font-mono font-semibold ${hasInteraction ? 'text-terminal-amber' : 'text-terminal-green'}`}>
                        → ${adjVal?.toFixed(0)}B{hasInteraction ? ' (交互调整)' : ''}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-terminal-muted/50 font-mono italic mt-0.5">
                    {p.src} — {p.note}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Effect bar chart */}
      {barData.length > 0 && (
        <div className="bg-terminal-surface border border-terminal-border rounded p-4">
          <div className="text-xs text-terminal-dim font-mono mb-3">已选政策效应对比（原始 vs 交互调整）</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
              <XAxis dataKey="name" tick={{ fill: '#718096', fontSize: 10, fontFamily: 'monospace' }} />
              <YAxis tick={{ fill: '#718096', fontSize: 10, fontFamily: 'monospace' }} />
              <Tooltip
                contentStyle={{ background: '#0f1629', border: '1px solid #1e2d4a', fontFamily: 'monospace', fontSize: 11 }}
                formatter={(v) => `$${v.toFixed(0)}B`}
              />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'monospace' }} />
              <Bar dataKey="raw" name="原始估算" fill="#718096" radius={[2, 2, 0, 0]} />
              <Bar dataKey="adjusted" name="交互调整后" fill="#00d4ff" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Counterfactual QT comparison */}
      <div className="bg-terminal-surface border border-terminal-border rounded p-4">
        <div className="text-xs text-terminal-dim font-mono mb-3">
          政策反事实对比 — QT 倒计时
          <span className="text-terminal-muted/50 ml-2 italic">[YUN2026 §5.6, 每周缩表8.75B]</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-terminal-red/40 bg-terminal-red/5 rounded p-3 text-center">
            <div className="text-xs text-terminal-dim font-mono mb-1">路径1：只缩表（无政策）</div>
            <div className="text-3xl font-mono font-semibold text-terminal-red">
              {weeksNone !== null ? `${weeksNone}周` : '—'}
            </div>
            <div className="text-xs text-terminal-muted font-mono">触及稀缺门限</div>
          </div>
          <div className="border border-terminal-green/40 bg-terminal-green/5 rounded p-3 text-center">
            <div className="text-xs text-terminal-dim font-mono mb-1">路径2：政策改革后缩表</div>
            <div className="text-3xl font-mono font-semibold text-terminal-green">
              {weeksWithPolicy !== null && result.adjusted > 0 ? `${weeksWithPolicy}周` : '—'}
            </div>
            <div className="text-xs text-terminal-muted font-mono">
              多出 {weeksWithPolicy && weeksNone ? weeksWithPolicy - weeksNone : '—'} 周缓冲
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
