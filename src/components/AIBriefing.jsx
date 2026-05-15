// src/components/AIBriefing.jsx
import React, { useState, useRef } from 'react';
import emailjs from '@emailjs/browser';
import { useApp } from '../lib/AppContext';
import { generateBriefing, logAudit } from '../lib/api';
import { PARAMETERS, STABILITY, B_SCARCE } from '../lib/constants';

const EMAILJS_SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID  || 'service_e3b9bxd';
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_nms785y';
const EMAILJS_PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  || 'bJKwdNi_PlenolKHA';

const B_SCARCE_B = B_SCARCE / 10;

export default function AIBriefing() {
  const { state, dispatch } = useApp();
  const {
    fredData, indicators, deepseekKey, briefing, briefingLoading, briefingError,
    policyResult, gsibData, selectedPolicies
  } = state;

  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailStatus, setEmailStatus] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [editableBriefing, setEditableBriefing] = useState('');
  const textRef = useRef(null);

  const reserves = fredData.reserves;
  const weeksUntilScarce = reserves
    ? Math.floor((reserves - B_SCARCE_B) / 8.75)
    : null;

  async function handleGenerate() {
    if (!deepseekKey) {
      dispatch({ type: 'SET_BRIEFING_ERROR', payload: '请先在设置中填写 DeepSeek API Key' });
      return;
    }
    dispatch({ type: 'SET_BRIEFING_LOADING', payload: true });
    dispatch({ type: 'SET_BRIEFING_ERROR', payload: '' });

    try {
      const promptData = {
        reserves: reserves?.toFixed(1) || 'N/A',
        margin: indicators.margin || 'N/A',
        effrIorb: indicators.effrIorb || 'N/A',
        sofrIorb: indicators.sofrIorb || 'N/A',
        regime: indicators.regime,
        delta: PARAMETERS.DELTA,
        rhs: STABILITY.RHS,
        beta3: PARAMETERS.BETA_3,
        isStable: STABILITY.IS_STABLE,
        ratchet: (B_SCARCE / 10).toFixed(0),
        weeksToScarce: weeksUntilScarce ?? 'N/A',
        activePolicies: selectedPolicies.size > 0
          ? Array.from(selectedPolicies).join(', ')
          : '无',
        policyEffect: policyResult.adjusted || 0,
        cliffRisk: indicators.cliffRisk,
        gsibTotal: gsibData.reduce((a, b) => a + (b.reserves || 0), 0),
        gsibShare: PARAMETERS.GSIB_SHARE,
      };

      const text = await generateBriefing(deepseekKey, promptData);
      dispatch({ type: 'SET_BRIEFING', payload: text });
      setEditableBriefing(text);
      logAudit('生成简报', `reserves=${reserves?.toFixed(1)}B, regime=${indicators.regime}`);
    } catch (err) {
      dispatch({ type: 'SET_BRIEFING_ERROR', payload: err.message });
    }
  }

  async function handleSendEmail() {
    const recipients = emailRecipients
      .split(/[,;，；]/)
      .map(e => e.trim())
      .filter(e => e.includes('@'));

    if (recipients.length === 0) {
      setEmailStatus('error:请输入有效的收件人邮箱');
      return;
    }
    if (!editableBriefing && !briefing) {
      setEmailStatus('error:请先生成简报');
      return;
    }

    setEmailLoading(true);
    setEmailStatus('');

    const content = editableBriefing || briefing;
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'America/New_York' });
    const subject = `美联储流动性监测简报 — ${now} ET`;
    const htmlContent = content.replace(/\n/g, '<br>');

    let successCount = 0;
    let failCount = 0;

    for (const to of recipients) {
      try {
        await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          {
            to_email: to,
            subject,
            message_html: htmlContent,
          },
          EMAILJS_PUBLIC_KEY
        );
        successCount++;
      } catch (err) {
        console.error(`Failed to send to ${to}:`, err);
        failCount++;
      }
    }

    const statusMsg = failCount === 0
      ? `success:已成功发送至 ${successCount} 个收件人`
      : `error:${successCount}个成功，${failCount}个失败`;

    setEmailStatus(statusMsg);
    setEmailLoading(false);
    logAudit('发送邮件', `收件人：${recipients.join(', ')}，状态：${statusMsg}`);
  }

  function copyToClipboard() {
    const text = editableBriefing || briefing;
    navigator.clipboard.writeText(text).catch(() => {});
    const btn = textRef.current;
  }

  const displayText = editableBriefing || briefing;
  const [emailState, emailMsg] = (emailStatus || ':').split(/:(.+)/);

  return (
    <div className="space-y-4">
      {/* Context snapshot */}
      <div className="bg-terminal-surface border border-terminal-border rounded p-4">
        <div className="text-xs text-terminal-dim font-mono mb-3">当前数据快照（将发送给 DeepSeek）</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
          {[
            { k: '准备金余额', v: reserves ? `$${reserves.toFixed(1)}B` : '…', s: '[FRED]' },
            { k: '安全裕度', v: indicators.margin ? `${indicators.margin}B` : '…', s: '[YUN2026 §11.5]' },
            { k: '当前区制', v: indicators.regime, s: '[YUN2026 §4.2.5]' },
            { k: 'QT倒计时', v: weeksUntilScarce !== null ? `${weeksUntilScarce}周` : '…', s: '' },
            { k: 'EFFR−IORB', v: indicators.effrIorb ? `${indicators.effrIorb}bps` : '…', s: '[FRED]' },
            { k: '政策释放量', v: `$${policyResult.adjusted}B`, s: '[YUN2026 §15.4]' },
            { k: '断崖风险', v: indicators.cliffRisk ? '⚠ 激活' : '正常', s: '[YUN2026 §7.3]' },
            { k: '稳定条件', v: STABILITY.IS_STABLE ? '✓ 稳定' : '⚠ 警示', s: '[YUN2026 §7.2]' },
          ].map(({ k, v, s }) => (
            <div key={k} className="rounded border border-terminal-border p-2">
              <div className="text-terminal-muted">{k}</div>
              <div className="text-terminal-text font-semibold mt-0.5">{v}</div>
              {s && <div className="text-terminal-muted/50 italic text-xs">{s}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <div className="flex gap-3 items-center flex-wrap">
        <button
          onClick={handleGenerate}
          disabled={briefingLoading}
          className="px-6 py-2.5 rounded border border-terminal-accent text-terminal-accent hover:bg-terminal-accent hover:text-terminal-bg transition-colors font-mono font-semibold text-sm disabled:opacity-50"
        >
          {briefingLoading ? '⟳ DeepSeek 生成中…' : '⚡ 生成今日简报'}
        </button>
        {!deepseekKey && (
          <span className="text-terminal-amber text-xs font-mono">⚠ 请先在设置中填写 DeepSeek API Key</span>
        )}
        <span className="text-terminal-muted/50 text-xs font-mono italic ml-auto">
          角色：顶级对冲基金首席宏观策略师 | 模型：deepseek-chat
        </span>
      </div>

      {briefingError && (
        <div className="bg-terminal-red/10 border border-terminal-red/50 rounded p-3 text-terminal-red text-xs font-mono">
          ✗ {briefingError}
        </div>
      )}

      {/* Briefing output */}
      {displayText && (
        <div className="bg-terminal-surface border border-terminal-green/30 rounded p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="text-xs text-terminal-green font-mono font-semibold">
              ◆ 今日简报
              <span className="text-terminal-muted/50 ml-2 italic font-normal">
                基于 [YUN2026] DAG框架 + [FEDS2026] 政策菜单
              </span>
            </div>
            <button
              onClick={copyToClipboard}
              className="text-xs font-mono px-2 py-0.5 rounded border border-terminal-border text-terminal-dim hover:text-terminal-text"
            >
              复制
            </button>
          </div>
          <textarea
            value={displayText}
            onChange={e => setEditableBriefing(e.target.value)}
            className="w-full h-64 bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-terminal-text text-sm font-mono leading-relaxed outline-none focus:border-terminal-accent/50 resize-none"
          />
          <div className="text-xs text-terminal-muted font-mono mt-1">简报可编辑后发送</div>
        </div>
      )}

      {/* Email section */}
      <div className="bg-terminal-surface border border-terminal-border rounded p-4">
        <div className="text-xs text-terminal-dim font-mono mb-3">
          邮件推送
          <span className="text-terminal-muted/50 ml-2 italic">via EmailJS | Service: {EMAILJS_SERVICE_ID}</span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-terminal-dim font-mono block mb-1">
              收件人（逗号或分号分隔，支持多个邮箱）
            </label>
            <input
              type="text"
              value={emailRecipients}
              onChange={e => setEmailRecipients(e.target.value)}
              placeholder="analyst@fund.com, strategy@firm.com; research@bank.com"
              className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-terminal-text text-sm font-mono placeholder-terminal-muted outline-none focus:border-terminal-accent"
            />
          </div>

          <div className="text-xs text-terminal-muted font-mono">
            邮件主题：<span className="text-terminal-text">美联储流动性监测简报 — [当前时间] ET</span>
          </div>

          <button
            onClick={handleSendEmail}
            disabled={emailLoading || !displayText}
            className="px-6 py-2 rounded border border-terminal-amber text-terminal-amber hover:bg-terminal-amber/10 transition-colors font-mono font-semibold text-sm disabled:opacity-50"
          >
            {emailLoading ? '⟳ 发送中…' : '✉ 发送简报'}
          </button>

          {emailStatus && (
            <div className={`text-xs font-mono p-2 rounded border ${
              emailState === 'success'
                ? 'border-terminal-green/50 text-terminal-green bg-terminal-green/5'
                : 'border-terminal-red/50 text-terminal-red bg-terminal-red/5'
            }`}>
              {emailState === 'success' ? '✓' : '✗'} {emailMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
