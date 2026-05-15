// src/components/SettingsPanel.jsx
import React, { useState } from 'react';
import { useApp } from '../lib/AppContext';

export default function SettingsPanel({ onClose }) {
  const { state, dispatch } = useApp();
  const [ds, setDs] = useState(state.deepseekKey || '');
  const [saved, setSaved] = useState(false);

  function save() {
    localStorage.setItem('deepseek_key', ds);
    dispatch({ type: 'SET_KEYS', fredKey: 'aec35073cfcd24002343239c7cf60522', deepseekKey: ds });
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-terminal-surface border border-terminal-border rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-terminal-accent font-mono text-base font-semibold">⚙ API 配置</h2>
          <button onClick={onClose} className="text-terminal-dim hover:text-terminal-text text-xl leading-none">×</button>
        </div>

        <div className="space-y-4 text-sm font-mono">
          <div className="bg-terminal-bg/50 border border-terminal-green/30 rounded p-3 text-xs text-terminal-muted">
            <div className="text-terminal-green mb-1">✓ FRED API 已内置</div>
            <div>宏观数据（准备金、利率、TGA）自动获取，无需配置</div>
          </div>

          <div>
            <label className="text-terminal-dim block mb-1">
              DeepSeek API Key
              <span className="text-terminal-muted ml-2 text-xs">（AI简报 + 银行数据解析）</span>
            </label>
            <input
              type="password"
              value={ds}
              onChange={e => setDs(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-terminal-text placeholder-terminal-muted focus:border-terminal-accent outline-none"
            />
            <p className="text-terminal-muted text-xs mt-1">
              前往 <a href="https://platform.deepseek.com" target="_blank" rel="noreferrer" className="text-terminal-accent underline">platform.deepseek.com</a> 免费获取
            </p>
          </div>

          <div className="bg-terminal-bg/50 border border-terminal-border rounded p-3 text-xs text-terminal-muted">
            <div className="text-terminal-amber mb-1">🔒 安全说明</div>
            <div>• DeepSeek Key 仅存储在浏览器 localStorage，不发送至任何服务器</div>
            <div>• EmailJS Public Key 已内置</div>
          </div>

          <button
            onClick={save}
            disabled={!ds.trim()}
            className="w-full py-2 rounded border border-terminal-accent text-terminal-accent hover:bg-terminal-accent hover:text-terminal-bg transition-colors font-semibold disabled:opacity-40"
          >
            {saved ? '✓ 已保存' : '保存并关闭'}
          </button>
        </div>
      </div>
    </div>
  );
}
