// ============================================================
// 核心数学与实证常量
// 来源：
//   [YUN2026]  Michael Yun (2026) "美联储缩表政策的结构性因果分析框架"
//              内部研究文档，2026年5月
//   [FEDS2026] Anderson, Barbarino, Diercks & Miran (2026)
//              "A User's Guide to Reducing the Federal Reserve's Balance Sheet"
//              FEDS 2026-019, Board of Governors of the Federal Reserve System
// ============================================================

// ── 区制门限 ─────────────────────────────────────────────────
// [YUN2026 §11.5, 表12] Hansen(1996)门限回归，n=587周频观测
// 格点搜索最优值，介于2019锚点($1,394B)与2025锚点($2,848B)之间
export const B_SCARCE = 2242.5;   // 亿美元，稀缺区入口门限

// [YUN2026 §11.5, 表12] 两锚点棘轮效应识别，控制GDP增长后
export const B_RATCHET_SHIFT = 1118; // 亿美元，QE周期不可逆需求上移量

// 2019锚点 [YUN2026 §11.2]
export const B_SCARCE_2019 = 1394; // $1,394B，2019/9事件准备金水平

// 2025锚点 [YUN2026 §11.2]
export const B_SCARCE_2025 = 2848; // $2,848B，2025/11事件准备金水平

// ── DSCM 结构参数 ─────────────────────────────────────────────
export const PARAMETERS = {
  // [YUN2026 §13.5, 表18] TGA波动作IV的2SLS估计，第一阶段F=20.2
  BETA_3: 426.4,           // 恐慌反馈强度 β₃

  // [YUN2026 §13.6, 表19] 三次历史流动性注入事件研究均值
  DELTA: 1549.5,           // 政策响应速度 δ（亿美元/百分点）

  // [YUN2026 §11.5, 表12] Hansen门限回归，充裕区压力反应系数
  LAMBDA_A: 0.011,         // 充裕区压力弹性 λA（注：表12原值0.0054，此处使用稳定性检验值0.011）

  // [YUN2026 §11.5, 表12] Hansen门限回归，稀缺区压力反应系数
  LAMBDA_S: 0.0009,        // 稀缺区压力系数 λS

  // [YUN2026 §13.7, 表20] 市场弹性约束——注意：校准值非估计值
  LAMBDA: 0.05,            // 市场弹性 λ ⚠️ 校准假设，非回归估计

  // [YUN2026 §13.7, 表20] 阈值校准——注意：校准值非估计值
  DW_DM: 0.10,             // 预警敏感性 ∂W/∂M ⚠️ 校准假设，非回归估计

  // [YUN2026 §12.4, 表15] DiD-RDD估计，处理组vs对照组差值+1.14pp
  ALPHA_1: 0.038,          // LCR弹性 α₁

  // [YUN2026 §12.4, 表15] 6家G-SIB合计$2,230B ÷ 系统$3,100B
  GSIB_SHARE: 0.719,       // G-SIB准备金占系统比例

  // [YUN2026 §11.5, 表12] 两锚点棘轮效应估计
  MU_LOWER: 0.67,          // 棘轮效应下界 µ̂
  MU_UPPER: 1.01,          // 棘轮效应上界 µ̂

  // [YUN2026 §13.4, 表17] 四阶段FE控制后，注意：仍未收敛到LVJ基准(-0.80)
  BETA_2_OWN: 0.57,        // 套利利差弹性（本文估计）⚠️ 与LVJ(-0.80)方向仍相反
  BETA_2_LVJ: -0.80,       // [FEDS2026参考] LVJ(2025)文献基准值，用于政策量化

  // [FEDS2026 §Table 3] 蒙特卡洛验证通过率
  MC_PASS_RATE: 0.9125,    // 联合验证通过率 91.25%

  // [YUN2026 §15.4, 表23] 10,000次蒙特卡洛
  MC_CI_LOW: 1791,         // 95% CI 下界（亿美元）
  MC_CI_HIGH: 2181,        // 95% CI 上界（亿美元）
};

// ── 流动性螺旋稳定条件 [YUN2026 §7.2, 条件1] ─────────────────
// 稳定条件：δ > β₃ · ∂W/∂M · λ · λA
const RHS = PARAMETERS.BETA_3 * PARAMETERS.DW_DM * PARAMETERS.LAMBDA * PARAMETERS.LAMBDA_A;
export const STABILITY = {
  LHS: PARAMETERS.DELTA,  // 政策响应速度
  RHS: RHS,                // 恐慌反馈乘积项
  IS_STABLE: PARAMETERS.DELTA > RHS,
  MARGIN: PARAMETERS.DELTA - RHS,
  // LHS=1549.5，RHS=0.0235，LHS/RHS≈65,979 [YUN2026 §13.7, 发现4]
};

// ── 15项政策菜单 ──────────────────────────────────────────────
// 来源：[FEDS2026] 表3、附录Table 32；[YUN2026] §5, §14, 表21
// min/mid/max 单位：亿美元
export const POLICIES = [
  {
    id: 1, name: 'LCR 认可贴现窗口能力',
    min: 50, mid: 250, max: 450,
    dscm: 'LCLOR', channel: 'I',
    src: '[FEDS2026 选项1] [YUN2026 §14.2.1, 表21]',
    note: 'ΔR = -(1/3)×20%×HQLA，G-SIB合计$446B'
  },
  {
    id: 2, name: '压力期 LCR 重新校准',
    min: 50, mid: 125, max: 200,
    dscm: 'LCLOR', channel: 'I',
    src: '[FEDS2026 选项2] [YUN2026 §5.2, 表25]',
    note: '管理缓冲×30%，118%→108%'
  },
  {
    id: 3, name: 'ILST 改革认可 DW 能力',
    min: 50, mid: 125, max: 200,
    dscm: 'LCLOR', channel: 'I',
    src: '[FEDS2026 选项3] [YUN2026 §5.2, 表25]',
    note: '大型银行准备金×5-10%'
  },
  {
    id: 4, name: '清算流动性改革 (RLEN)',
    min: 0, mid: 50, max: 100,
    dscm: 'LCLOR', channel: 'I',
    src: '[FEDS2026 选项4] [YUN2026 §5.2, 表25]',
    note: 'G-SIB准备金×5%'
  },
  {
    id: 5, name: 'SLR 减免（交易商）',
    min: 0, mid: 50, max: 100,
    dscm: 'Kt', channel: 'I',
    src: '[FEDS2026 选项5] [YUN2026 §5.2, 表25]',
    note: '间接效应，扩展交易商吸收能力'
  },
  {
    id: 6, name: '国债-准备金等同处理',
    min: 25, mid: 38, max: 50,
    dscm: 'Gt', channel: 'II',
    src: '[FEDS2026 选项6] [YUN2026 §5.3, 表27]',
    note: '管理缓冲×1-2%，污名化路径'
  },
  {
    id: 7, name: 'EFFR > IORB',
    min: 150, mid: 350, max: 550,
    dscm: 'Δt', channel: 'III',
    src: '[FEDS2026 选项7] [YUN2026 §14.2.2] [LVJ2025 βˆ₂≈-0.80]',
    note: '套利消除，使用LVJ基准值-0.80'
  },
  {
    id: 8, name: '准备金分级利率',
    min: 0, mid: 50, max: 100,
    dscm: 'Δt', channel: 'III',
    src: '[FEDS2026 选项8] [YUN2026 §5.3, 表27]',
    note: '挪威经验，难精确量化'
  },
  {
    id: 9, name: 'FIMA 回购扩展',
    min: 25, mid: 112, max: 200,
    dscm: 'Kt', channel: 'IV',
    src: '[FEDS2026 选项9] [YUN2026 §5.4, 表29]',
    note: '扩展期限至84天，$25-200B'
  },
  {
    id: 10, name: 'FBO 互换协调',
    min: 0, mid: 200, max: 200,
    dscm: 'β5', channel: 'IV',
    src: '[FEDS2026 选项10] [YUN2026 §5.4, 表29] [ADS2025]',
    note: 'FBO准备金$1T×20%≈$200B'
  },
  {
    id: '11a', name: 'SRP 去污名化沟通',
    min: 30, mid: 55, max: 80,
    dscm: 'Gt', channel: 'V',
    src: '[FEDS2026 选项11a] [YUN2026 §5.4, 表29]',
    note: '定性效应，与选项1有协同'
  },
  {
    id: '11b', name: 'SRP 扩展 + 中央清算',
    min: 50, mid: 85, max: 120,
    dscm: 'Φt,Kt', channel: 'V',
    src: '[FEDS2026 选项11b] [YUN2026 §5.4, 表29]',
    note: '支付摩擦路径 + 交易商容量'
  },
  {
    id: 12, name: 'TGA 国库券对冲',
    min: 50, mid: 125, max: 200,
    dscm: 'Φt', channel: 'V',
    src: '[FEDS2026 选项12] [YUN2026 §5.4, 表29] [VJ2026]',
    note: 'TGA波动性↓，$50-200B'
  },
  {
    id: 13, name: 'Fedwire LSM',
    min: 95, mid: 110, max: 126,
    dscm: 'Φt', channel: 'V',
    src: '[FEDS2026 选项13] [YUN2026 §14.2.3, 公式32] [Norman2010]',
    note: 'Fedwire日均流动性$630B×15-20%'
  },
  {
    id: 14, name: 'TGA 管理改革（TT&L 复活）',
    min: 200, mid: 300, max: 400,
    dscm: 'Let', channel: 'VI',
    src: '[FEDS2026 选项14] [YUN2026 §14.2.4, 公式33]',
    note: '降低波动性而非水平，$200-400B'
  },
  {
    id: 15, name: '抑制外资逆回购',
    min: 0, mid: 50, max: 100,
    dscm: 'Let', channel: 'VI',
    src: '[FEDS2026 选项15] [YUN2026 §5.5, 表31]',
    note: '取决于替代品吸引力'
  },
];

// ── G-SIB 初始数据（论文Table 14，2025Q4）─────────────────────
// [YUN2026 §12.3, 表14] 基于2025年末季报数据
export const GSIB_INITIAL = [
  { bank: 'JPMorgan Chase', code: 'JPM', cik: '0000019617',
    reserves: 690, lcr: 111, slr: 5.8, dw_preposition: 180,
    hqla: 1692, assets: 4425, src: '[YUN2026 表14, JPM 4Q25]' },
  { bank: 'Bank of America', code: 'BAC', cik: '0000070858',
    reserves: 560, lcr: 117, slr: 5.7, dw_preposition: 145,
    hqla: 1398, assets: 3262, src: '[YUN2026 表14, BAC 4Q25]' },
  { bank: 'Citigroup', code: 'C', cik: '0000831001',
    reserves: 430, lcr: 120, slr: 5.5, dw_preposition: 115,
    hqla: 967, assets: 2411, src: '[YUN2026 表14, C 4Q25]' },
  { bank: 'Wells Fargo', code: 'WFC', cik: '0000072971',
    reserves: 330, lcr: 119, slr: 6.2, dw_preposition: 90,
    hqla: 850, assets: 1981, src: '[YUN2026 表14, WFC 4Q25]' },
  { bank: 'Goldman Sachs', code: 'GS', cik: '0000886982',
    reserves: 125, lcr: 130, slr: 5.2, dw_preposition: 42,
    hqla: 315, assets: 1808, src: '[YUN2026 表14, GS 4Q25]' },
  { bank: 'Morgan Stanley', code: 'MS', cik: '0000895421',
    reserves: 95, lcr: 128, slr: 5.4, dw_preposition: 32,
    hqla: 237, assets: 1365, src: '[YUN2026 表14, MS 4Q25]' },
];

// ── FRED 系列 ──────────────────────────────────────────────────
export const FRED_SERIES = {
  WRESBAL: { id: 'WRESBAL', name: '准备金余额', unit: '十亿美元', freq: 'w' },
  EFFR:    { id: 'EFFR',    name: 'EFFR有效联邦基金利率', unit: '%', freq: 'd' },
  IORB:    { id: 'IORB',    name: 'IORB准备金利率', unit: '%', freq: 'd' },
  SOFR:    { id: 'SOFR',    name: 'SOFR', unit: '%', freq: 'd' },
  WTREGEN: { id: 'WTREGEN', name: 'TGA财政部一般账户', unit: '十亿美元', freq: 'w' },
  IOER:    { id: 'IOER',    name: 'IOER（历史回填）', unit: '%', freq: 'd' },
};

// ── QT 压力测试参数 ────────────────────────────────────────────
// [FEDS2026 背景] 当前QT节奏估算
export const QT_WEEKLY_REDUCTION = 8.75; // 亿美元/周（约35B/月）

// ── 断崖风险触发条件 [YUN2026 §7.3, 命题3] ────────────────────
export const CLIFF_RISK = {
  WEEKLY_DROP_THRESHOLD: 150,  // 单周下降超过150B触发
  EFFR_IORB_JUMP: 20,          // EFFR-IORB单日跳升>20bps触发
  SOFR_IORB_DAYS: 3,           // SOFR-IORB连续N天>5bps触发
  SOFR_IORB_THRESHOLD: 5,      // bps
};

// ── 交互效应规则 [FEDS2026 §5.6] [YUN2026 §5.6] ──────────────
export const INTERACTION_RULES = {
  // 规则1：污名化协同（选项1 + 选项11a）
  STIGMA_SYNERGY: {
    policyA: 1, policyB: '11a',
    boost: 50,       // 同时选中时，选项1上限提升50B
    penalty: 0.5,    // 单独选中时，效果折半
  },
  // 规则2：LCR-NSFR替代约束
  NSFR_PENALTY: 0.6, // 未同步改革NSFR时，选项1/2乘以0.6
  // 规则3：TGA-LSM替代（选项12 + 选项14）
  TGA_LSM_CAP: {
    policy12: 12, policy14: 14,
    cap_12_when_combined: 200, // 同时选中时选项12上限锁定200B
  },
};
