// src/App.jsx
import React, { useState, useEffect } from 'react';
import { useApp } from './lib/AppContext';
import { useDataLoader } from './hooks/useDataLoader';
import { buildSnapshotURL } from './lib/snapshot';
import MacroRadar from './components/MacroRadar';
import PolicySimulator from './components/PolicySimulator';
import MicroTracker from './components/MicroTracker';
import AIBriefing from './components/AIBriefing';
import AuditPanel from './components/AuditPanel';
import SettingsPanel from './components/SettingsPanel';
import { STABILITY } from './lib/constants';

const TABS = [
  { id: 'macro',  label: '◈ 宏观雷达',    sub: 'Macro Radar' },
  { id: 'micro',  label: '◉ 微观监测',    sub: 'G-SIB Tracker' },
  { id: 'policy', label: '⊕ 政策模拟',    sub: 'Policy Simulator' },
  { id: 'ai',     label: '⚡ AI 简报',     sub: 'AI Briefing' },
  { id: 'audit',  label: '◎ 参数 / 日志', sub: 'Params & Audit' },
];

function Header({ onSettings, onRefresh, loading }) {
  const { state } = useApp();
  const { indicators, fredData } = state;
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const etTime = now.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const etDate = now.toLocaleDateString('zh-CN', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });

  return (
    <header className="bg-terminal-surface border-b border-terminal-border px-4 py-3">
      <div className="max-w-screen-2xl mx-auto flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-terminal-accent font-mono font-bold text-base tracking-tight">
            美联储流动性液压监测终端
          </div>
          <div className="text-terminal-muted text-xs font-mono">
            Federal Reserve Liquidity Hydraulic Monitor v7.0 &nbsp;|&nbsp;
            <span className="text-terminal-dim">[YUN2026] + [FEDS2026-019]</span>
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono text-xs">
          {/* Live regime badge */}
          <div className={`px-3 py-1 rounded border font-semibold ${
            indicators.regime === 'Scarce'
              ? 'border-terminal-red text-terminal-red bg-terminal-red/10 animate-pulse'
              : indicators.regime === 'Ample'
              ? 'border-terminal-green text-terminal-green bg-terminal-green/10'
              : 'border-terminal-border text-terminal-dim'
          }`}>
            {indicators.regime === 'Ample' ? 'AMPLE ✓' :
             indicators.regime === 'Scarce' ? 'SCARCE ⚠' :
             indicators.regime === 'Excess' ? 'EXCESS' : '…'}
          </div>

          {/* Stability badge */}
          <div className={`px-3 py-1 rounded border text-xs ${
            STABILITY.IS_STABLE
              ? 'border-terminal-green/40 text-terminal-green'
              : 'border-terminal-red text-terminal-red animate-pulse'
          }`}>
            {STABILITY.IS_STABLE ? 'δ≫RHS ✓' : 'δ<RHS ⚠'}
          </div>

          <div className="text-terminal-dim">
            <span className="text-terminal-muted">NY </span>
            <span className="text-terminal-text">{etDate} {etTime}</span>
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            title="刷新数据"
            className="px-2 py-1 rounded border border-terminal-border text-terminal-dim hover:text-terminal-accent hover:border-terminal-accent transition-colors disabled:opacity-50"
          >
            {loading ? '⟳' : '↺'} 刷新
          </button>

          <button
            onClick={onSettings}
            className="px-2 py-1 rounded border border-terminal-border text-terminal-dim hover:text-terminal-accent hover:border-terminal-accent transition-colors"
          >
            ⚙ 设置
          </button>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const { state, dispatch } = useApp();
  const { reload } = useDataLoader();
  const [showSettings, setShowSettings] = useState(false);

  // Auto-show settings if no keys
  useEffect(() => {
    const fredKey = localStorage.getItem('fred_key');
    const dsKey = localStorage.getItem('deepseek_key');
    if (!fredKey && !dsKey) setShowSettings(true);
  }, []);

  const activeTab = state.activeTab;

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-mono">
      <Header
        onSettings={() => setShowSettings(true)}
        onRefresh={reload}
        loading={state.loading.fred}
      />

      {/* Tab bar */}
      <div className="bg-terminal-surface border-b border-terminal-border sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto flex overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => dispatch({ type: 'SET_TAB', payload: tab.id })}
              className={`flex-shrink-0 px-4 py-3 text-xs font-mono border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-terminal-accent text-terminal-accent'
                  : 'border-transparent text-terminal-dim hover:text-terminal-text hover:border-terminal-border'
              }`}
            >
              <div className="font-semibold">{tab.label}</div>
              <div className="text-terminal-muted/70 text-xs">{tab.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-screen-2xl mx-auto p-4">
        {activeTab === 'macro'  && <MacroRadar />}
        {activeTab === 'micro'  && <MicroTracker />}
        {activeTab === 'policy' && <PolicySimulator />}
        {activeTab === 'ai'     && <AIBriefing />}
        {activeTab === 'audit'  && <AuditPanel />}
      </main>

      {/* Footer */}
      <footer className="border-t border-terminal-border mt-8 px-4 py-4 text-xs font-mono text-terminal-muted/50 max-w-screen-2xl mx-auto">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>[YUN2026] Michael Yun (2026) "美联储缩表政策的结构性因果分析框架" — 内部研究文档</span>
          <span>[FEDS2026] Anderson, Barbarino, Diercks & Miran (2026) FEDS 2026-019</span>
          <span>[LVJ2025] Lopez-Salido & Vissing-Jorgensen (2025)</span>
          <span className="ml-auto">⚠️ 校准参数（λ=0.05, ∂W/∂M=0.10）非实证估计，β₂=+0.57未收敛至LVJ基准</span>
        </div>
      </footer>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
