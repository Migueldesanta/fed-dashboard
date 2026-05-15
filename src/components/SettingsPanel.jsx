// src/components/SettingsPanel.jsx
import React, { useState } from 'react';
import { useApp } from '../lib/AppContext';

export default function SettingsPanel({ onClose }) {
  const { state, dispatch } = useApp();
  const [fred, setFred] = useState(state.fredKey || '');
  const [ds, setDs] = useState(state.deepseekKey || '');
  const [saved, setSaved] = useState(false);

  function save() {
    localStorage.setItem('fred_key', fred);
    localStorage.setItem('deepseek_key', ds);
    dispatch({ type: 'SET_KEYS', fredKey: fred, deepseekKey: ds });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-terminal-surface border border-terminal-border rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-terminal-accent font-mono text-base font-semibold">⚙ API 配置</h2>
          <button onClick={onClose} className="text-terminal-dim hover:text-terminal-text text-xl leading-none">×</button>
        </div>

        <div className="space-y-4 text-sm font-mono">
          <div>
            <label className="text-terminal-dim block mb-1">
              FRED API Key
              <span className="text-terminal-muted ml-2 text-xs">（宏观数据，通过后端代理）</span>
            </label>
            <input
              type="password"
              value={fred}
              onChange={e => setFred(e.target.value)}
              placeholder="aec35073cfcd..."
              className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-terminal-text placeholder-terminal-muted focus:border-terminal-accent outline-none"
            />
            <p className="text-terminal-muted text-xs mt-1">
              前往 <a href="https://fred.stlouisfed.org/docs/api/api_key.html" target="_blank" rel="noreferrer" className="text-terminal-accent underline">fred.stlouisfed.org</a> 免费获取
            </p>
          </div>

          <div>
            <label className="text-terminal-dim block mb-1">
              DeepSeek API Key
              <span className="text-terminal-muted ml-2 text-xs">（仅存本地，不发送到服务器）</span>
            </label>
            <input
              type="password"
              value={ds}
              onChange={e => setDs(e.target.value)}
              placeholder="sk-ebb045dab..."
              className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-terminal-text placeholder-terminal-muted focus:border-terminal-accent outline-none"
            />
            <p className="text-terminal-muted text-xs mt-1">
              前往 <a href="https://platform.deepseek.com" target="_blank" rel="noreferrer" className="text-terminal-accent underline">platform.deepseek.com</a> 获取
            </p>
          </div>

          <div className="bg-terminal-bg/50 border border-terminal-border rounded p-3 text-xs text-terminal-muted">
            <div className="text-terminal-amber mb-1">🔒 安全说明</div>
            <div>• FRED Key 通过 Cloudflare Function 代理，前端不暴露</div>
            <div>• DeepSeek Key 仅存储在浏览器 localStorage</div>
            <div>• EmailJS Public Key 可公开，已内置</div>
          </div>

          <button
            onClick={save}
            className="w-full py-2 rounded border border-terminal-accent text-terminal-accent hover:bg-terminal-accent hover:text-terminal-bg transition-colors font-semibold"
          >
            {saved ? '✓ 已保存' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  );
}
