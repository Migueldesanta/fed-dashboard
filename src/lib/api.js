// src/lib/api.js
// 所有外部API调用的统一入口

const CACHE_TTL = 60 * 60 * 1000; // 1小时缓存
const cache = {};

function getCache(key) {
  const item = cache[key];
  if (!item) return null;
  if (Date.now() - item.ts > CACHE_TTL) return null;
  return item.data;
}

function setCache(key, data) {
  cache[key] = { data, ts: Date.now() };
}

// ── FRED API ─────────────────────────────────────────────────
// 生产环境（Cloudflare Pages）：走 /api/fred 代理，隐藏 Key
// 本地开发：直接调 FRED，Key 从 localStorage 读取
async function fredFetch(seriesId, limit) {
  const isProd = window.location.hostname !== 'localhost'
    && window.location.hostname !== '127.0.0.1';

  if (isProd) {
    // Cloudflare Function 代理
    const res = await fetch(
      `/api/fred?series=${seriesId}&limit=${limit}&sort_order=desc`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) throw new Error(`FRED proxy error: ${res.status}`);
    return res.json();
  } else {
    // 本地：直接调 FRED（Key 从 localStorage 或默认值）
    const apiKey = localStorage.getItem('fred_key') || 'aec35073cfcd24002343239c7cf60522';
    const url = new URL('https://api.stlouisfed.org/fred/series/observations');
    url.searchParams.set('series_id', seriesId);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('file_type', 'json');
    url.searchParams.set('sort_order', 'desc');  // 降序，最新数据在前
    url.searchParams.set('limit', String(limit));
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`FRED direct error: ${res.status}`);
    return res.json();
  }
}

export async function fetchFredSeries(seriesId, limit = 500) {
  const cacheKey = `fred_${seriesId}_${limit}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const data = await fredFetch(seriesId, limit);
    const observations = data.observations
      ?.filter(o => o.value !== '.')
      .map(o => ({
        date: o.date,
        value: parseFloat(o.value)
      }))
      .reverse() // reverse back to chronological (asc) order since API returns desc
      .slice(-52)  // Take only last 52 valid observations
      || [];
    setCache(cacheKey, observations);
    return observations;
  } catch (err) {
    console.error(`fetchFredSeries(${seriesId}) failed:`, err);
    return [];
  }
}

export async function fetchFredLatest(seriesId) {
  const data = await fetchFredSeries(seriesId, 5);
  return data.length > 0 ? data[data.length - 1] : null;
}

// ── OFR 金融压力指数 ──────────────────────────────────────────
export async function fetchOFRStress() {
  const cacheKey = 'ofr_fsi';
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      'https://data.financialresearch.gov/v1/series/export?series=FSI&format=json&start=2024-01-01',
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) throw new Error(`OFR API error: ${res.status}`);
    const data = await res.json();
    const result = Array.isArray(data) ? data : (data.data || data.observations || []);
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error('fetchOFRStress failed:', err);
    return [];
  }
}

// ── SEC EDGAR — 获取公司最新10-Q链接 ──────────────────────────
export async function fetchLatest10Q(cik) {
  try {
    const paddedCik = cik.replace(/^0+/, '').padStart(10, '0');
    const res = await fetch(
      `https://data.sec.gov/submissions/CIK${paddedCik}.json`,
      {
        headers: { 'User-Agent': 'FedLiquidityMonitor/7.0 (research@example.com)' },
        signal: AbortSignal.timeout(10000)
      }
    );
    if (!res.ok) throw new Error(`SEC API error: ${res.status}`);
    const data = await res.json();
    const filings = data.filings?.recent;
    if (!filings) return null;

    const idx = filings.form.findIndex(f => f === '10-Q');
    if (idx === -1) return null;

    const accession = filings.accessionNumber[idx].replace(/-/g, '');
    const url = `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${accession}/`;
    return {
      url,
      date: filings.filingDate[idx],
      accession: filings.accessionNumber[idx]
    };
  } catch (err) {
    console.error(`fetchLatest10Q(${cik}) failed:`, err);
    return null;
  }
}

// ── DeepSeek API — 生成简报 ────────────────────────────────────
export async function generateBriefing(apiKey, promptData) {
  if (!apiKey) throw new Error('请先在设置中填写 DeepSeek API Key');

  const systemPrompt = `你是一位顶级对冲基金的首席宏观策略师，专注于美联储流动性与货币政策。
你的分析基于以下学术框架：
- Michael Yun (2026) 14节点DAG与动态结构因果模型(DSCM)
- Anderson et al. (2026) FEDS 2026-019"美联储缩表政策用户指南"
用精炼、专业的中文输出，结论明确，不超过350字。`;

  const userPrompt = `请根据以下实时数据生成今日流动性简报（严格按四部分格式）：

【数据摘要】
- 准备金余额：${promptData.reserves}B（安全裕度：${promptData.margin}B）
- EFFR-IORB利差：${promptData.effrIorb}bps
- SOFR-IORB利差：${promptData.sofrIorb}bps  
- 当前区制：${promptData.regime}
- 稳定条件：δ(${promptData.delta}) ${promptData.isStable ? '>' : '<'} RHS(${promptData.rhs.toFixed(4)}) → ${promptData.isStable ? '✓ 稳定' : '⚠️ 警示'}
- 棘轮效应位移：${promptData.ratchet}B
- QT触及稀缺门限预计：${promptData.weeksToScarce}周后
- 政策组合已激活：${promptData.activePolicies}
- 政策释放量（调整后）：${promptData.policyEffect}B
- 断崖风险：${promptData.cliffRisk ? '⚠️ 激活' : '正常'}
- G-SIB总准备金：${promptData.gsibTotal}B（系统占比${(promptData.gsibShare*100).toFixed(1)}%）

请输出以下四部分（每部分50-80字）：
【核心指标定性】
【DAG风险演化路径】（请提及β₃恐慌反馈强度${promptData.beta3}和δ政策响应速度${promptData.delta}）
【QT倒计时】（基于每周缩表8.75B，当前准备金距稀缺门限的时间窗口）
【实战操作建议】`;

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 1000,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `DeepSeek API error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '生成失败';
}

// ── 审计日志 ──────────────────────────────────────────────────
export function logAudit(action, detail = '') {
  try {
    const logs = JSON.parse(localStorage.getItem('audit_log') || '[]');
    logs.push({ ts: new Date().toISOString(), action, detail });
    if (logs.length > 50) logs.splice(0, logs.length - 50);
    localStorage.setItem('audit_log', JSON.stringify(logs));
  } catch {}
}

export function getAuditLogs() {
  try {
    return JSON.parse(localStorage.getItem('audit_log') || '[]');
  } catch { return []; }
}

export function exportAuditCSV() {
  const logs = getAuditLogs();
  const csv = ['时间,操作,详情', ...logs.map(l => `${l.ts},${l.action},${l.detail}`)].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'audit_log.csv'; a.click();
}
