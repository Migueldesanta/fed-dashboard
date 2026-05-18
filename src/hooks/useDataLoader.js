// src/hooks/useDataLoader.js
import { useEffect, useCallback } from 'react';
import { useApp } from '../lib/AppContext';
import { fetchFredSeries, fetchFredLatest, fetchOFRStress } from '../lib/api';
import { B_SCARCE, CLIFF_RISK, STABILITY } from '../lib/constants';

export function useDataLoader() {
  const { state, dispatch } = useApp();

  const loadFredData = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', key: 'fred', value: true });
    dispatch({ type: 'SET_ERROR', key: 'fred', value: '' });

    try {
      const [resHist, effrHist, iorbData, sofrData, tgaHist] = await Promise.all([
        fetchFredSeries('WRESBAL', 500),   // Large limit to skip old missing data
        fetchFredSeries('EFFR', 500),
        fetchFredSeries('IORB', 500),
        fetchFredSeries('SOFR', 500),
        fetchFredSeries('WTREGEN', 500),
      ]);

      console.log('[FRED] resHist:', resHist.length, resHist[resHist.length - 1]);
      console.log('[FRED] effrHist:', effrHist.length, effrHist[effrHist.length - 1]);
      console.log('[FRED] iorbData:', iorbData.length, iorbData[iorbData.length - 1]);
      console.log('[FRED] sofrData:', sofrData.length, sofrData[sofrData.length - 1]);
      console.log('[FRED] tgaHist:', tgaHist.length, tgaHist[tgaHist.length - 1]);

      const latestRes  = resHist[resHist.length - 1];
      const prevRes    = resHist[resHist.length - 2];
      const latestTga  = tgaHist[tgaHist.length - 1];

      // ── 利率对齐：以EFFR最新日期为基准，找IORB和SOFR最近的值 ──
      // FRED返回值单位均为百分比（如4.33 = 4.33%），差值×100 = bps
      const latestEffr = effrHist[effrHist.length - 1];
      const effrDate   = latestEffr?.date;

      // IORB: 找离EFFR日期最近的值（IORB是周频，EFFR是日频）
      function findNearest(series, targetDate) {
        if (!series.length) return null;
        if (!targetDate) return series[series.length - 1];
        // prefer exact match, else last value before or on targetDate
        const sorted = [...series].filter(d => d.date <= targetDate);
        return sorted.length ? sorted[sorted.length - 1] : series[series.length - 1];
      }

      const matchedIorb = findNearest(iorbData, effrDate);
      const matchedSofr = findNearest(sofrData, effrDate);

      // WRESBAL unit from FRED = billions USD (already in billions, no conversion needed)
      // FRED series description: "Billions of U.S. Dollars"
      // But verify: typical value ~3100 means $3.1T ✓
      const reservesRaw   = latestRes?.value     ?? null;
      const prevReservesRaw = prevRes?.value     ?? null;

      // Sanity check: if value > 10000, likely in millions → convert to billions
      const reservesB     = reservesRaw !== null
        ? (reservesRaw > 10000 ? reservesRaw / 1000 : reservesRaw)
        : null;
      const prevReservesB = prevReservesRaw !== null
        ? (prevReservesRaw > 10000 ? prevReservesRaw / 1000 : prevReservesRaw)
        : null;

      const effr          = latestEffr?.value     ?? null;  // percent
      const iorb          = matchedIorb?.value    ?? null;  // percent
      const sofr          = matchedSofr?.value    ?? null;  // percent
      const tgaRaw        = latestTga?.value      ?? null;
      const tga           = tgaRaw !== null
        ? (tgaRaw > 10000 ? tgaRaw / 1000 : tgaRaw)
        : null;

      // Normalize history arrays too
      const normalizeHist = arr => arr.map(d => ({
        ...d,
        value: d.value > 10000 ? d.value / 1000 : d.value
      }));

      dispatch({
        type: 'SET_FRED_DATA',
        payload: {
          reserves: reservesB,
          reservesHistory: normalizeHist(resHist),
          effr, iorb, sofr, tga,
          effrHistory: effrHist,
          tgaHistory: normalizeHist(tgaHist),
        }
      });

      // ── 指标计算 ─────────────────────────────────────────────
      const effrIorb = (effr !== null && iorb !== null)
        ? ((effr - iorb) * 100).toFixed(1) : null;
      const sofrIorb = (sofr !== null && iorb !== null)
        ? ((sofr - iorb) * 100).toFixed(1) : null;

      // B_SCARCE = 2242.5 (in paper's units = $B USD)
      // WRESBAL after normalization is also in $B USD
      // So direct comparison works: ~3100B vs 2242.5B
      const bScarceB = B_SCARCE;  // 2242.5 billions USD
      const marginB  = reservesB !== null ? (reservesB - bScarceB).toFixed(1) : null;

      let regime = 'Unknown';
      if (reservesB !== null) {
        if (reservesB < bScarceB)        regime = 'Scarce';
        else if (reservesB < bScarceB * 1.6) regime = 'Ample';
        else                              regime = 'Excess';
      }

      // 断崖风险：单周降幅 or 利差急升
      let cliffRisk = false;
      if (prevReservesB && reservesB) {
        const weeklyDrop = prevReservesB - reservesB;
        // CLIFF_RISK.WEEKLY_DROP_THRESHOLD = 150 亿美元 = 15 billion
        if (weeklyDrop > CLIFF_RISK.WEEKLY_DROP_THRESHOLD / 10) cliffRisk = true;
      }
      // EFFR-IORB > 20bps 触发断崖
      if (effrIorb !== null && parseFloat(effrIorb) > CLIFF_RISK.EFFR_IORB_JUMP) cliffRisk = true;

      // Lt: count triggered indicators
      let lt = 0;
      if (parseFloat(effrIorb) > 2) lt++;
      if (parseFloat(sofrIorb) > 2) lt++;
      if (regime === 'Scarce') lt++;

      dispatch({
        type: 'SET_INDICATORS',
        payload: { margin: marginB, effrIorb, sofrIorb, regime, lt, cliffRisk, stabilityOk: STABILITY.IS_STABLE }
      });

    } catch (err) {
      dispatch({ type: 'SET_ERROR', key: 'fred', value: err.message });
    } finally {
      dispatch({ type: 'SET_LOADING', key: 'fred', value: false });
    }
  }, [dispatch]);

  const loadOFR = useCallback(async () => {
    try {
      const data = await fetchOFRStress();
      if (data.length > 0) {
        const latest = data[data.length - 1];
        dispatch({ type: 'SET_OFR', payload: latest });
      }
    } catch {}
  }, [dispatch]);

  useEffect(() => {
    loadFredData();
    loadOFR();
    const interval = setInterval(() => {
      loadFredData();
      loadOFR();
    }, 60 * 60 * 1000); // refresh every hour
    return () => clearInterval(interval);
  }, [loadFredData, loadOFR]);

  return { reload: loadFredData };
}
