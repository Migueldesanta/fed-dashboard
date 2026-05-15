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
        fetchFredSeries('WRESBAL', 52),
        fetchFredSeries('EFFR', 52),
        fetchFredSeries('IORB', 10),
        fetchFredSeries('SOFR', 10),
        fetchFredSeries('WTREGEN', 52),
      ]);

      const latestRes = resHist[resHist.length - 1];
      const prevRes   = resHist[resHist.length - 2];
      const latestEffr = effrHist[effrHist.length - 1];
      const latestIorb = iorbData[iorbData.length - 1];
      const latestSofr = sofrData[sofrData.length - 1];
      const latestTga  = tgaHist[tgaHist.length - 1];

      const reserves = latestRes?.value * 1000 || null; // convert B$ to $B (already in B)
      // WRESBAL is in billions, keep as billions
      const reservesB = latestRes?.value || null;
      const prevReservesB = prevRes?.value || null;

      const effr = latestEffr?.value || null;
      const iorb = latestIorb?.value || null;
      const sofr = latestSofr?.value || null;
      const tga  = latestTga?.value || null;

      dispatch({
        type: 'SET_FRED_DATA',
        payload: {
          reserves: reservesB,       // in billions
          reservesHistory: resHist,
          effr, iorb, sofr, tga,
          effrHistory: effrHist,
          tgaHistory: tgaHist,
        }
      });

      // Compute indicators
      const effrIorb = (effr !== null && iorb !== null) ? ((effr - iorb) * 100).toFixed(1) : null;
      const sofrIorb = (sofr !== null && iorb !== null) ? ((sofr - iorb) * 100).toFixed(1) : null;
      const margin = reservesB !== null ? (reservesB - B_SCARCE / 10).toFixed(1) : null;
      // B_SCARCE is in 亿美元 (100M), WRESBAL is in billions
      // B_SCARCE = 2242.5 亿美元 = 224.25 billion USD
      const bScarceB = B_SCARCE / 10; // convert to billions
      const marginB = reservesB !== null ? (reservesB - bScarceB).toFixed(1) : null;

      let regime = 'Unknown';
      if (reservesB !== null) {
        if (reservesB < bScarceB) regime = 'Scarce';
        else if (reservesB < bScarceB * 1.5) regime = 'Ample';
        else regime = 'Excess';
      }

      // Cliff risk detection
      let cliffRisk = false;
      if (prevReservesB && reservesB) {
        const weeklyDrop = prevReservesB - reservesB;
        if (weeklyDrop > CLIFF_RISK.WEEKLY_DROP_THRESHOLD / 10) cliffRisk = true;
      }
      if (parseFloat(effrIorb) > CLIFF_RISK.EFFR_IORB_JUMP) cliffRisk = true;

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
