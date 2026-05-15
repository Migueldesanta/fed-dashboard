// src/components/MacroRadar.jsx
import React, { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend
} from 'recharts';
import { useApp } from '../lib/AppContext';
import {
  B_SCARCE, B_RATCHET_SHIFT, PARAMETERS, STABILITY,
  QT_WEEKLY_REDUCTION, CLIFF_RISK
} from '../lib/constants';
import { qtProjection } from '../lib/policyCalc';

const B_SCARCE_B = B_SCARCE / 10; // convert 亿美元 to billion USD for WRESBAL

function StatCard({ label, value, unit, sub, color, src }) {
  const colorClass = {
    green: 'text-terminal-green border-terminal-green/30',
    red: 'text-terminal-red border-terminal-red/30',
    amber: 'text-terminal-amber border-terminal-amber/30',
    accent: 'text-terminal-accent border-terminal-accent/30',
    dim: 'text-terminal-dim border-terminal-border',
  }[color] || 'text-terminal-text border-terminal-border';

  return (
    <div className={`bg-terminal-surface border rounded p-3 ${colorClass}`}>
      <div className="text-xs text-terminal-dim font-mono mb-1">{label}</div>
      <div className={`text-xl font-mono font-semibold ${colorClass.split(' ')[0]}`}>
        {value ?? <span className="text-terminal-muted text-sm">加载中…</span>}
        {unit && <span className="text-sm ml-1 font-normal">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-terminal-muted mt-1 font-mono">{sub}</div>}
      {src && <div className="text-xs text-terminal-muted/50 mt-1 font-mono italic">{src}</div>}
    </div>
  );
}

function RegimeMeter({ reserves }) {
  const pct = reserves ? Math.min(Math.max(reserves / (B_SCARCE_B * 2) * 100, 0), 100) : 50;
  const scarcePct = (B_SCARCE_B / (B_SCARCE_B * 2)) * 100;
  const isScarce = reserves < B_SCARCE_B;

  return (
    <div className="bg-terminal-surface border border-terminal-border rounded p-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs text-terminal-dim font-mono">区制位置仪表盘</span>
        <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border ${
          isScarce ? 'text-terminal-red border-terminal-red/50 bg-terminal-red/10'
                   : 'text-terminal-green border-terminal-green/50 bg-terminal-green/10'
        }`}>
          {isScarce ? 'SCARCE 稀缺区' : 'AMPLE 充裕区'}
        </span>
      </div>
      <div className="relative h-6 bg-terminal-bg rounded overflow-hidden border border-terminal-border">
        <div className="absolute inset-0 flex">
          <div className="bg-terminal-red/20" style={{ width: `${scarcePct}%` }} />
          <div className="bg-terminal-green/20" style={{ width: `${100 - scarcePct}%` }} />
        </div>
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-terminal-amber"
          style={{ left: `${scarcePct}%` }}
        />
        {reserves && (
          <div
            className="absolute top-0 bottom-0 w-1 bg-terminal-accent rounded"
            style={{ left: `${pct}%`, transition: 'left 0.5s' }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-terminal-muted font-mono mt-1">
        <span>$0B</span>
        <span className="text-terminal-amber">稀缺门限 ${B_SCARCE_B.toFixed(0)}B</span>
        <span>${(B_SCARCE_B * 2).toFixed(0)}B</span>
      </div>
      <div className="text-xs text-terminal-muted/50 mt-1 font-mono italic">
        [YUN2026 §11.5] Hansen(1996)门限回归识别
      </div>
    </div>
  );
}

function RatchetChart({ reserves }) {
  const data = [
    { name: '当前准备金', value: reserves || 0, fill: '#00d4ff' },
    { name: '反事实（去棘轮）', value: Math.max(0, (reserves || 0) - B_RATCHET_SHIFT / 10), fill: '#718096' },
    { name: '稀缺门限', value: B_SCARCE_B, fill: '#ffaa00' },
  ];
  return (
    <div className="bg-terminal-surface border border-terminal-border rounded p-4">
      <div className="text-xs text-terminal-dim font-mono mb-3">
        棘轮效应可视化
        <span className="text-terminal-muted/50 ml-2 italic">[YUN2026 §11.2, µ̂∈[0.67,1.01]]</span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
          <XAxis dataKey="name" tick={{ fill: '#718096', fontSize: 10, fontFamily: 'monospace' }} />
          <YAxis tick={{ fill: '#718096', fontSize: 10, fontFamily: 'monospace' }} />
          <Tooltip
            contentStyle={{ background: '#0f1629', border: '1px solid #1e2d4a', fontFamily: 'monospace', fontSize: 11 }}
            labelStyle={{ color: '#e2e8f0' }}
            formatter={(v) => [`$${v.toFixed(1)}B`, '']}
          />
          <ReferenceLine y={B_SCARCE_B} stroke="#ffaa00" strokeDasharray="3 3" label={{ value: '稀缺门限', fill: '#ffaa00', fontSize: 10 }} />
          <Bar dataKey="value" radius={[2, 2, 0, 0]}>
            {data.map((entry, i) => (
              <rect key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ReservesChart({ history }) {
  const data = history.slice(-26).map(d => ({
    date: d.date?.slice(5),
    reserves: d.value,
    scarce: B_SCARCE_B,
  }));
  return (
    <div className="bg-terminal-surface border border-terminal-border rounded p-4">
      <div className="text-xs text-terminal-dim font-mono mb-3">
        准备金余额 — 26周历史
        <span className="text-terminal-muted/50 ml-2 italic">[FRED:WRESBAL, 十亿美元]</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
          <XAxis dataKey="date" tick={{ fill: '#718096', fontSize: 9, fontFamily: 'monospace' }} interval={3} />
          <YAxis tick={{ fill: '#718096', fontSize: 10, fontFamily: 'monospace' }} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: '#0f1629', border: '1px solid #1e2d4a', fontFamily: 'monospace', fontSize: 11 }}
            formatter={(v, n) => n === 'reserves' ? [`$${v.toFixed(1)}B`, '准备金'] : [`$${v.toFixed(1)}B`, '稀缺门限']}
          />
          <ReferenceLine y={B_SCARCE_B} stroke="#ffaa00" strokeDasharray="4 2" />
          <Line type="monotone" dataKey="reserves" stroke="#00d4ff" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function MacroRadar() {
  const { state } = useApp();
  const { fredData, indicators, loading, errors } = state;
  const reserves = fredData.reserves;

  // QT projections
  const qtProjections = useMemo(() => [1, 2, 4, 12].map(w => ({
    weeks: w,
    projected: qtProjection(reserves || B_SCARCE_B + 50, w),
    isScarce: qtProjection(reserves || B_SCARCE_B + 50, w) < B_SCARCE_B,
  })), [reserves]);

  const weeksUntilScarce = useMemo(() => {
    if (!reserves) return null;
    if (reserves <= B_SCARCE_B) return 0;
    return Math.floor((reserves - B_SCARCE_B) / QT_WEEKLY_REDUCTION);
  }, [reserves]);

  const stabilityMargin = STABILITY.MARGIN;

  return (
    <div className="space-y-4">
      {/* Cliff risk banner */}
      {indicators.cliffRisk && (
        <div className="bg-terminal-red/10 border border-terminal-red rounded p-3 flex items-center gap-3 animate-pulse">
          <span className="text-terminal-red text-lg">⚠</span>
          <div>
            <div className="text-terminal-red font-mono font-semibold text-sm">断崖风险激活</div>
            <div className="text-terminal-red/70 text-xs font-mono">
              可能发生 2019/9 式突变 — 单周准备金骤降或利差急升
              <span className="ml-2 italic">[YUN2026 §7.3, 命题3]</span>
            </div>
          </div>
        </div>
      )}

      {loading.fred && (
        <div className="text-terminal-dim text-xs font-mono py-2">⟳ 正在加载 FRED 数据…</div>
      )}
      {errors.fred && (
        <div className="text-terminal-red text-xs font-mono py-2">✗ FRED 加载失败：{errors.fred}</div>
      )}

      {/* Top stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="准备金余额"
          value={reserves ? `$${reserves.toFixed(1)}` : null}
          unit="B"
          sub={`FRED:WRESBAL 周频`}
          color={reserves > B_SCARCE_B ? 'green' : 'red'}
          src="[FRED WRESBAL]"
        />
        <StatCard
          label="安全裕度 (vs 稀缺门限)"
          value={indicators.margin ? `${parseFloat(indicators.margin) > 0 ? '+' : ''}${indicators.margin}` : null}
          unit="B"
          sub={`门限 $${B_SCARCE_B.toFixed(1)}B [YUN2026 §11.5]`}
          color={parseFloat(indicators.margin) > 100 ? 'green' : parseFloat(indicators.margin) > 0 ? 'amber' : 'red'}
          src="[YUN2026 表12] Hansen(1996)"
        />
        <StatCard
          label="EFFR − IORB"
          value={indicators.effrIorb !== null ? indicators.effrIorb : null}
          unit="bps"
          sub="正值=准备金偏紧 [FRED]"
          color={parseFloat(indicators.effrIorb) > 5 ? 'red' : parseFloat(indicators.effrIorb) > 0 ? 'amber' : 'green'}
        />
        <StatCard
          label="SOFR − IORB"
          value={indicators.sofrIorb !== null ? indicators.sofrIorb : null}
          unit="bps"
          sub={`>0 持续=预警 τ≈10bps ⚠️校准值`}
          color={parseFloat(indicators.sofrIorb) > 10 ? 'red' : parseFloat(indicators.sofrIorb) > 0 ? 'amber' : 'green'}
          src="[YUN2026 §4.2.6] ⚠️校准假设非回归值"
        />
      </div>

      {/* Regime meter */}
      <RegimeMeter reserves={reserves} />

      {/* Stability condition */}
      <div className="bg-terminal-surface border border-terminal-border rounded p-4">
        <div className="text-xs text-terminal-dim font-mono mb-3">
          流动性螺旋稳定条件
          <span className="text-terminal-muted/50 ml-2 italic">[YUN2026 §7.2, 条件1, 公式21]</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1 font-mono text-sm">
            <span className="text-terminal-green">δ = {STABILITY.LHS.toFixed(1)}</span>
            <span className="text-terminal-dim mx-2">{STABILITY.IS_STABLE ? '≫' : '<'}</span>
            <span className="text-terminal-amber">β₃·∂W/∂M·λ·λA = {STABILITY.RHS.toFixed(4)}</span>
          </div>
          <div className={`text-xs font-mono px-3 py-1 rounded border ${
            STABILITY.IS_STABLE
              ? 'text-terminal-green border-terminal-green/50 bg-terminal-green/10'
              : 'text-terminal-red border-terminal-red/50 bg-terminal-red/10 animate-pulse'
          }`}>
            {STABILITY.IS_STABLE ? '✓ 系统稳定' : '⚠ 螺旋风险'}
          </div>
          <div className="text-xs text-terminal-muted font-mono">
            稳定裕量：{stabilityMargin.toFixed(2)} (LHS/RHS ≈ {(STABILITY.LHS/STABILITY.RHS).toFixed(0)}x)
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs font-mono">
          {[
            { p: 'β₃=426.4', s: '2SLS IV估计', src: '[YUN2026 §13.5, 表18]', ok: true },
            { p: 'δ=1549.5', s: '事件研究均值', src: '[YUN2026 §13.6, 表19]', ok: true },
            { p: 'λ=0.05', s: '⚠️市场弹性—校准值', src: '[YUN2026 表20]', ok: false },
            { p: '∂W/∂M=0.10', s: '⚠️阈值—校准值', src: '[YUN2026 §4.2.6]', ok: false },
          ].map((item, i) => (
            <div key={i} className={`rounded border p-2 ${item.ok ? 'border-terminal-green/30 bg-terminal-green/5' : 'border-terminal-amber/30 bg-terminal-amber/5'}`}>
              <div className={item.ok ? 'text-terminal-green' : 'text-terminal-amber'}>{item.p}</div>
              <div className="text-terminal-muted">{item.s}</div>
              <div className="text-terminal-muted/50 italic text-xs">{item.src}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReservesChart history={fredData.reservesHistory} />
        <RatchetChart reserves={reserves} />
      </div>

      {/* QT Stress Test */}
      <div className="bg-terminal-surface border border-terminal-border rounded p-4">
        <div className="text-xs text-terminal-dim font-mono mb-3">
          QT 压力测试（每周缩表 {QT_WEEKLY_REDUCTION}B）
          <span className="text-terminal-muted/50 ml-2 italic">[FEDS2026 背景参数]</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {qtProjections.map(({ weeks, projected, isScarce }) => (
            <div key={weeks} className={`rounded border p-2 text-center font-mono ${
              isScarce ? 'border-terminal-red/50 bg-terminal-red/10' : 'border-terminal-border bg-terminal-bg'
            }`}>
              <div className="text-terminal-dim text-xs">{weeks}周后</div>
              <div className={`text-sm font-semibold ${isScarce ? 'text-terminal-red' : 'text-terminal-text'}`}>
                ${projected.toFixed(1)}B
              </div>
              {isScarce && <div className="text-terminal-red text-xs">⚠ 稀缺区</div>}
            </div>
          ))}
        </div>
        <div className={`text-sm font-mono font-semibold ${
          weeksUntilScarce !== null && weeksUntilScarce < 20
            ? 'text-terminal-red' : 'text-terminal-green'
        }`}>
          {weeksUntilScarce !== null
            ? `→ 按当前节奏，约 ${weeksUntilScarce} 周后触及稀缺门限`
            : '计算中…'
          }
        </div>
      </div>

      {/* Five-factor liquidity indicators */}
      <div className="bg-terminal-surface border border-terminal-border rounded p-4">
        <div className="text-xs text-terminal-dim font-mono mb-3">
          五因子充裕度指标 Lₜ
          <span className="text-terminal-muted/50 ml-2 italic">[YUN2026 §4.3, 表4, 公式13]</span>
        </div>
        <div className="space-y-2 text-xs font-mono">
          {[
            { idx: 1, name: 'EFFR−IORB弹性', value: indicators.effrIorb ? `${indicators.effrIorb}bps` : '—', triggered: parseFloat(indicators.effrIorb) > 2, src: 'FRED实时', note: '' },
            { idx: 2, name: '延迟支付占比', value: '代理：OFR FSI', triggered: false, src: 'OFR FSI代理', note: '⚠️年频公开数据，用压力指数近似' },
            { idx: 3, name: '日内透支', value: '代理：压力指数', triggered: false, src: 'Fed H.4.1代理', note: '⚠️ 数据源受限' },
            { idx: 4, name: '国内DI联邦基金占比', value: '数据源受限', triggered: false, src: '—', note: '⚠️ 无公开实时数据' },
            { idx: 5, name: 'SOFR75−SRP利差', value: indicators.sofrIorb ? `${indicators.sofrIorb}bps(近似)` : '—', triggered: parseFloat(indicators.sofrIorb) > 5, src: 'SOFR−IORB近似', note: '' },
          ].map(row => (
            <div key={row.idx} className={`flex items-center gap-3 p-2 rounded border ${
              row.triggered ? 'border-terminal-red/50 bg-terminal-red/5' : 'border-terminal-border'
            }`}>
              <div className={`w-4 h-4 rounded-full flex-shrink-0 ${row.triggered ? 'bg-terminal-red' : 'bg-terminal-muted/30'}`} />
              <div className="flex-1">
                <span className="text-terminal-dim">{row.idx}. {row.name}</span>
                {row.note && <span className="text-terminal-amber ml-2">{row.note}</span>}
              </div>
              <div className={row.triggered ? 'text-terminal-red font-semibold' : 'text-terminal-dim'}>{row.value}</div>
              <div className="text-terminal-muted/50 text-xs italic w-24 text-right">{row.src}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs font-mono">
          <span className="text-terminal-dim">综合 Lₜ = </span>
          <span className={`font-semibold ${indicators.lt >= 3 ? 'text-terminal-red' : indicators.lt >= 1 ? 'text-terminal-amber' : 'text-terminal-green'}`}>
            {indicators.lt}/5
          </span>
          {indicators.lt >= 3 && <span className="text-terminal-red ml-2">⚠ 充裕度边际收紧</span>}
        </div>
      </div>
    </div>
  );
}
