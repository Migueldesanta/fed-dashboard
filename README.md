# 美联储流动性液压监测终端 v7.0

基于 [YUN2026] Michael Yun (2026) DAG框架 和 [FEDS2026] Anderson et al. (2026) FEDS 2026-019 构建的实时流动性监测终端。

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# .env 已预填 EmailJS 配置，无需修改

# 3. 本地开发
npm run dev
# 访问 http://localhost:5173
```

打开后，点击右上角 **⚙ 设置**，填入：
- **FRED API Key**（免费：https://fred.stlouisfed.org/docs/api/api_key.html）
- **DeepSeek API Key**（https://platform.deepseek.com）

---

## 部署到 Cloudflare Pages

### 方法一：通过 GitHub（推荐）

1. 将代码推送到 GitHub 仓库
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
3. Pages → Create a project → Connect to Git → 选择仓库
4. 构建设置：
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`
5. 环境变量（在 Cloudflare Pages Settings → Environment variables）：
   ```
   FRED_API_KEY = aec35073cfcd24002343239c7cf60522
   VITE_EMAILJS_SERVICE_ID = service_e3b9bxd
   VITE_EMAILJS_TEMPLATE_ID = template_nms785y
   VITE_EMAILJS_PUBLIC_KEY = bJKwdNi_PlenolKHA
   ```
6. 点击 **Save and Deploy**

### 方法二：Wrangler CLI

```bash
# 安装 Wrangler
npm install -g wrangler

# 登录
wrangler login

# 构建
npm run build

# 部署
npx wrangler pages deploy dist --project-name=liquidity-monitor

# 设置环境变量（后端 Function 使用）
npx wrangler pages secret put FRED_API_KEY
# 输入：aec35073cfcd24002343239c7cf60522
```

---

## 数据来源与论文来源标注

| 数据 | 来源 | 论文标注 |
|------|------|----------|
| 准备金余额 WRESBAL | FRED（Cloudflare代理） | - |
| 稀缺门限 $224.25B | Hansen(1996)门限回归 | [YUN2026 §11.5, 表12] |
| 棘轮效应 µ∈[0.67,1.01] | 两锚点识别 | [YUN2026 §11.5, 表12] |
| 恐慌反馈 β₃=426.4 | 2SLS IV估计，F=20.2 | [YUN2026 §13.5, 表18] |
| 政策响应速度 δ=1549.5 | 三次事件研究均值 | [YUN2026 §13.6, 表19] |
| LCR弹性 α₁=0.038 | DiD-RDD估计 | [YUN2026 §12.4, 表15] |
| 15项政策菜单 | Anderson et al. 2026 | [FEDS2026-019 表3/附录] |
| G-SIB数据（初始值） | 2025Q4季报 | [YUN2026 §12.3, 表14] |
| β₂=-0.80（政策量化基准） | LVJ(2025)银行级panel | [FEDS2026参考] |

⚠️ **校准参数（非实证估计）**：λ=0.05, ∂W/∂M=0.10，β₂(本文)=+0.57未收敛至LVJ基准

---

## EmailJS 邮件模板设置

在 [EmailJS](https://www.emailjs.com) 控制台，确保模板包含以下变量：
- `{{to_email}}` — 收件人
- `{{subject}}` — 邮件主题
- `{{message_html}}` — 邮件正文（HTML格式）

---

## 架构说明

```
前端 (Cloudflare Pages)          后端 (Cloudflare Functions)
       |                                    |
React + Tailwind + Recharts        /api/fred.js 代理FRED
       |                            (隐藏FRED API Key)
FRED → /api/fred (代理)
FRBNY → 直接调用（公开）
OFR  → 直接调用（公开）
SEC  → 直接调用（公开）
DeepSeek → 用户Key，前端直接调用（不经后端）
EmailJS  → Public Key，前端直接调用
```
