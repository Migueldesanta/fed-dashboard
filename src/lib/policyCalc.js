// src/lib/policyCalc.js
// 15项政策的交互效应计算逻辑
// 来源：[FEDS2026 §5.6] [YUN2026 §5.6]

import { POLICIES, INTERACTION_RULES } from './constants';

/**
 * 计算选中政策的总效应
 * @param {Set} selectedIds - 选中的政策ID集合
 * @param {Object} opts - 选项：useNsfr（是否同步改革NSFR）
 * @param {'min'|'mid'|'max'} scenario - 场景选择
 * @returns {{ simple, adjusted, byPolicy, interactions }}
 */
export function calcPolicyEffect(selectedIds, opts = {}, scenario = 'mid') {
  const { syncNsfr = true } = opts;
  const selected = POLICIES.filter(p => selectedIds.has(p.id));
  const interactions = [];

  // 第一步：计算每项政策的原始值
  const raw = {};
  selected.forEach(p => {
    raw[p.id] = p[scenario];
  });

  // 简单加总
  const simple = Object.values(raw).reduce((a, b) => a + b, 0);

  // 第二步：应用交互效应规则
  const adjusted = { ...raw };

  // 规则1：污名化协同 [FEDS2026 §5.6, YUN2026 §5.6]
  const has1 = selectedIds.has(1);
  const has11a = selectedIds.has('11a');
  if (has1 && has11a) {
    const boost = INTERACTION_RULES.STIGMA_SYNERGY.boost;
    adjusted[1] = Math.min(raw[1] + boost, POLICIES.find(p => p.id === 1).max + boost);
    interactions.push({
      rule: '污名化协同（选项1 + 11a）',
      effect: `+${boost}B 协同增益`,
      src: '[FEDS2026 §5.6] [YUN2026 §5.6 规则1]'
    });
  } else if (has1 && !has11a) {
    adjusted[1] = raw[1] * INTERACTION_RULES.STIGMA_SYNERGY.penalty;
    interactions.push({
      rule: '单独选项1（未配11a）',
      effect: `效果×${INTERACTION_RULES.STIGMA_SYNERGY.penalty}（折半）`,
      src: '[FEDS2026 §5.6] [YUN2026 §5.6 规则1]'
    });
  } else if (!has1 && has11a) {
    adjusted['11a'] = raw['11a'] * INTERACTION_RULES.STIGMA_SYNERGY.penalty;
    interactions.push({
      rule: '单独选项11a（未配选项1）',
      effect: `效果×${INTERACTION_RULES.STIGMA_SYNERGY.penalty}（折半）`,
      src: '[FEDS2026 §5.6] [YUN2026 §5.6 规则1]'
    });
  }

  // 规则2：LCR-NSFR替代约束 [FEDS2026 §5.6, YUN2026 §5.6 规则2]
  if (!syncNsfr) {
    if (adjusted[1] !== undefined) {
      const before = adjusted[1];
      adjusted[1] = adjusted[1] * INTERACTION_RULES.NSFR_PENALTY;
      interactions.push({
        rule: 'NSFR未同步改革',
        effect: `选项1: ${before.toFixed(0)}B → ${adjusted[1].toFixed(0)}B (×0.6)`,
        src: '[FEDS2026 §5.6] [YUN2026 §5.6 规则2]'
      });
    }
    if (adjusted[2] !== undefined) {
      const before = adjusted[2];
      adjusted[2] = adjusted[2] * INTERACTION_RULES.NSFR_PENALTY;
      interactions.push({
        rule: 'NSFR未同步改革',
        effect: `选项2: ${before.toFixed(0)}B → ${adjusted[2].toFixed(0)}B (×0.6)`,
        src: '[FEDS2026 §5.6] [YUN2026 §5.6 规则2]'
      });
    }
  }

  // 规则3：TGA-LSM替代 [FEDS2026 §5.6, YUN2026 §5.6 规则3]
  const has12 = selectedIds.has(12);
  const has14 = selectedIds.has(14);
  if (has12 && has14) {
    const cap = INTERACTION_RULES.TGA_LSM_CAP.cap_12_when_combined;
    if (adjusted[12] > cap) {
      adjusted[12] = cap;
      interactions.push({
        rule: 'TGA-LSM替代（选项12 + 14）',
        effect: `选项12上限锁定为${cap}B（原${raw[12]}B）`,
        src: '[FEDS2026 §5.6] [YUN2026 §5.6 规则3]'
      });
    }
  }

  const adjustedTotal = Object.values(adjusted).reduce((a, b) => a + b, 0);

  return {
    simple: Math.round(simple),
    adjusted: Math.round(adjustedTotal),
    byPolicy: adjusted,
    interactions,
    rawByPolicy: raw,
  };
}

/**
 * QT压力测试：计算X周后的准备金余额
 * [FEDS2026 背景] 每周缩表8.75B
 */
export function qtProjection(currentReserves, weeksAhead, weeklyReduction = 8.75) {
  return currentReserves - weeklyReduction * weeksAhead;
}

/**
 * 计算触及稀缺门限的周数
 */
export function weeksToScarce(currentReserves, bScarce, weeklyReduction = 8.75, policyRelease = 0) {
  const effective = currentReserves + policyRelease;
  if (effective <= bScarce) return 0;
  return Math.floor((effective - bScarce) / weeklyReduction);
}
