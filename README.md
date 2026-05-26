# Fed Dashboard · 美联储流动性液压监测终端

> A Bloomberg Terminal-style monitoring system for U.S. dollar liquidity conditions and Federal Reserve policy stability, built on a Dynamic Structural Causal Model (DSCM) of reserve demand. Surfaces the regime indicators most relevant for assessing whether QT is approaching the policy boundaries identified in FEDS 2026-019.
>
> 基于自有研究 **[YUN2026]** 与 **[FEDS2026-019]** 双理论框架构建的实时流动性监测终端。

<!-- [Live Demo](https://your-deploy-url.example) · [Methodology](#methodology) · [Companion Research](#related-research) -->

![preview](docs/preview.png) <!-- TODO: 添加截图至 docs/preview.png -->

---

## Why this exists

Federal Reserve quantitative tightening transitions from "abundant" to "ample" to "scarce" reserve regimes in a regime-dependent, non-linear fashion. Practitioners typically reconstruct these regime conditions manually from FRED pulls, H.4.1 releases, and bank 10-Q filings — a fragmented workflow that loses the structural relationships between reserve aggregates, G-SIB balance sheet capacity, and the cliff-risk indicators that flag the transition zones.

This dashboard ingests the relevant public series in real time, applies a Dynamic Structural Causal Model (DSCM) calibrated from threshold regression and IV estimation, and outputs:

- **Live regime classification** — abundant / ample / scarce, with the scarcity threshold derived from Hansen (1996) threshold regression on n=587 weekly observations.
- **Stability condition monitor** — a single-glance check of whether the panic-feedback loop δ > β₃ · ∂W/∂M · λ · λA is currently satisfied.
- **Policy simulator** — combinatorial selection across the 15-policy menu from FEDS 2026-019, with three documented interaction rules (stigma synergy, NSFR substitution, TGA-LSM cap).
- **AI briefing** — automated daily macro note generated against the current state, with optional email distribution.
- **Full parameter audit trail** — every constant in the model is traceable to a specific table or equation in either YUN2026 or FEDS 2026-019.

---

## Modules

The dashboard is organized into five tabs in a Bloomberg-terminal-style monospace UI.

| Tab | Function |
|---|---|
| **◈ Macro Radar** · 宏观雷达 | Live reserves, EFFR–IORB, SOFR–IORB, regime classification, cliff-risk triggers, QT countdown to scarcity threshold |
| **◉ G-SIB Tracker** · 微观监测 | Per-bank reserves, LCR, SLR, HQLA, DW prepositioning for the six U.S. G-SIBs (JPM, BAC, C, WFC, GS, MS), plus SEC EDGAR 10-Q deep-links |
| **⊕ Policy Simulator** · 政策模拟 | 15-policy menu selection with min/mid/max scenarios, interaction-rule engine, simple-sum vs adjusted-sum delivery comparison |
| **⚡ AI Briefing** · AI 简报 | LLM-generated daily briefing (DeepSeek) conditioned on current dashboard state, with EmailJS distribution to a recipient list |
| **◎ Audit Panel** · 参数 / 日志 | Full parameter audit trail with paper citations; user action log with CSV export |

---

## Methodology

The model's core parameters and their provenance:

| Parameter | Value | Method | Source |
|---|---:|---|---|
| Scarcity threshold (B_SCARCE) | $2,242.5B | Hansen (1996) threshold regression, n=587 weekly obs | [YUN2026 §11.5, Table 12] |
| Ratchet shift (B_RATCHET) | $1,118B | Two-anchor identification, GDP-adjusted | [YUN2026 §11.5, Table 12] |
| Panic feedback intensity (β₃) | 426.4 | 2SLS IV, TGA volatility instrument, F=20.2 | [YUN2026 §13.5, Table 18] |
| Policy response speed (δ) | 1549.5 ($B / pp) | Event study, mean of three historical injections | [YUN2026 §13.6, Table 19] |
| LCR elasticity (α₁) | 0.038 | DiD-RDD, treatment vs control +1.14pp | [YUN2026 §12.4, Table 15] |
| Ratchet effect (μ̂) | [0.67, 1.01] | Two-anchor identification | [YUN2026 §11.5, Table 12] |
| G-SIB share | 71.9% | $2,230B / $3,100B, 4Q25 reports | [YUN2026 §12.3, Table 14] |
| Monte Carlo pass rate | 91.25% | 10,000 simulations, joint validation | [FEDS2026, Table 3] |
| 95% CI on threshold | [$1,791B, $2,181B] | Monte Carlo bootstrap | [YUN2026 §15.4, Table 23] |

### Stability condition (YUN2026 §7.2)

The dashboard's headline indicator is whether the **liquidity spiral stability condition** holds:

```
δ  >  β₃ · ∂W/∂M · λ · λA
LHS = 1549.5    RHS = 0.0235    LHS/RHS ≈ 65,979  → Stable ✓
```

When LHS/RHS collapses toward unity, the panic-feedback channel is approaching destabilization. This is the single most important number on the screen.

### What's calibrated vs estimated

The model is **honest about its identification limits**. Three parameters are calibrated, not estimated:

- **λ = 0.05** (market elasticity) — calibrated assumption, [YUN2026 §13.7, Table 20]
- **∂W/∂M = 0.10** (warning sensitivity) — calibrated assumption, [YUN2026 §13.7, Table 20]
- **β₂ = +0.57** (own arbitrage elasticity) — estimated, but **fails to converge to the LVJ(2025) benchmark of −0.80**; for policy quantification the dashboard uses the LVJ benchmark, not the local estimate

These are surfaced explicitly in the footer of the live app and in the Audit Panel. The point of building this transparency in is not aesthetic — it is to make the model usable by someone who needs to understand which numbers are load-bearing under what assumptions.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Public data sources                                            │
│    • FRED API           (WRESBAL, EFFR, IORB, SOFR, WTREGEN)    │
│    • FRBNY / OFR        (financial stress index)                │
│    • SEC EDGAR          (G-SIB 10-Q filings)                    │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare Pages Functions  (functions/api/fred.js)            │
│    • FRED proxy (hides API key, server-side env var)            │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Browser  (React 18 + Vite + Tailwind + Recharts)               │
│    • 1-hour in-memory cache                                     │
│    • localStorage for user-provided keys (DeepSeek)             │
│    • Direct calls to public APIs (OFR, SEC)                     │
│    • Direct calls to DeepSeek (user's own key, not server-side) │
│    • Direct calls to EmailJS (public-key architecture)          │
└─────────────────────────────────────────────────────────────────┘
```

### Stack

- **Frontend** — React 18, Vite 5, Tailwind CSS 3, Recharts 2
- **Edge functions** — Cloudflare Pages Functions (FRED proxy)
- **LLM** — DeepSeek chat completion (`deepseek-chat`, temperature 0.3)
- **Mail** — EmailJS browser SDK
- **State** — React Context + reducer pattern, localStorage persistence
- **Compression** — `lz-string` for shareable URL snapshots

---

## Setup

```bash
git clone https://github.com/Migueldesanta/fed-dashboard
cd fed-dashboard
npm install

cp .env.example .env
# Edit .env with your own EmailJS credentials (see below)

npm run dev
# → http://localhost:5173
```

On first launch, click **⚙ Settings** (top right) and paste:

- **FRED API key** — free at https://fred.stlouisfed.org/docs/api/api_key.html
- **DeepSeek API key** — https://platform.deepseek.com

Keys are stored in `localStorage`, never sent to any server other than the API they target.

### Environment variables

The repository ships with `.env.example`. EmailJS public keys are designed by EmailJS to be safely committed (the security model is domain whitelisting on the EmailJS side), but you should still substitute your own values:

```env
VITE_EMAILJS_SERVICE_ID=your_service_id
VITE_EMAILJS_TEMPLATE_ID=your_template_id
VITE_EMAILJS_PUBLIC_KEY=your_public_key
```

The FRED API key is set on the **Cloudflare Pages** side (Settings → Environment variables → `FRED_API_KEY`) and is never bundled into the client.

---

## Deployment

### Cloudflare Pages (recommended)

1. Push to GitHub.
2. Cloudflare Dashboard → Pages → Create a project → Connect to Git.
3. Build settings: framework preset **Vite**, build command `npm run build`, output directory `dist`.
4. Environment variables: set `FRED_API_KEY` (server-side, used by `functions/api/fred.js`).
5. Deploy.

### Wrangler CLI

```bash
npm install -g wrangler
wrangler login
npm run build
npx wrangler pages deploy dist --project-name=fed-dashboard
npx wrangler pages secret put FRED_API_KEY
```

---

## Related Research

This dashboard is the operational companion to an internal research note applying the FEDS 2026-019 framework to live conditions.

- **[YUN2026]** Yun, X. (2026). *美联储缩表政策的结构性因果分析框架 — A Structural Causal Framework for Federal Reserve Balance-Sheet Reduction*. Internal research document, May 2026.
- **[FEDS2026]** Anderson, A., Barbarino, A., Diercks, A. M., & Miran, S. (2026). *A User's Guide to Reducing the Federal Reserve's Balance Sheet*. FEDS Working Paper 2026-019, Board of Governors of the Federal Reserve System.
- **[LVJ2025]** Lopez-Salido, D., & Vissing-Jorgensen, A. (2025). Used as the benchmark for the own-arbitrage elasticity β₂.
- **[Hansen1996]** Hansen, B. E. (1996). *Inference when a nuisance parameter is not identified under the null hypothesis*. Econometrica.

The YUN2026 paper is available on request.

---

## Limitations

This is a research artifact, not a production trading system. Specifically:

1. **Calibrated parameters** (λ, ∂W/∂M) are not empirically estimated and the sensitivity of the stability condition to them has not been fully mapped.
2. **β₂ identification failure** — the local estimate diverges in sign from the LVJ(2025) benchmark, and the dashboard uses LVJ for policy quantification rather than the local estimate.
3. **G-SIB data** is initialized from 2025Q4 filings and refreshed on quarterly cadence; intra-quarter changes are not captured automatically.
4. **Interaction rules** are limited to the three documented in [FEDS2026 §5.6]; higher-order interactions are not modeled.
5. **Cache TTL** is 1 hour in-memory per client session; FRED is updated on its native release schedule (weekly for WRESBAL/WTREGEN, daily for rate series).

---

## Disclaimer

This dashboard is provided for research and educational purposes only. It does not constitute investment advice, a recommendation, or a solicitation. Data is drawn from public releases and may lag official publications. Model parameters are research estimates with documented identification limits. No representation is made as to the accuracy, completeness, or fitness for any particular purpose. Outputs should be independently verified before being used to inform any decision.

---

## License

<!-- TODO: choose MIT or Apache 2.0 — MIT is most common for portfolio projects -->

---

## Author

**Xin (Michael) Yun**
[LinkedIn](https://linkedin.com/in/xinyun5160) · [Portfolio](https://migueldesanta.github.io) · yun.xin@outlook.com
