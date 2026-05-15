// src/lib/AppContext.jsx
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { GSIB_INITIAL, PARAMETERS, B_SCARCE, STABILITY } from './constants';
import { getSnapshotFromURL } from './snapshot';

const AppContext = createContext(null);

const initialState = {
  // API Keys (from localStorage)
  fredKey: '',
  deepseekKey: '',

  // FRED data
  fredData: {
    reserves: null,      // latest WRESBAL (billion $)
    reservesHistory: [],
    effr: null,
    iorb: null,
    sofr: null,
    tga: null,
    tgaHistory: [],
    effrHistory: [],
  },

  // Computed indicators
  indicators: {
    margin: null,        // reserves - B_SCARCE
    effrIorb: null,      // bps
    sofrIorb: null,      // bps
    regime: 'Unknown',   // 'Ample' | 'Scarce' | 'Excess'
    lt: 0,               // 0-5 count of triggered indicators
    cliffRisk: false,
    stabilityOk: STABILITY.IS_STABLE,
  },

  // OFR stress
  ofrStress: null,

  // G-SIB data (editable)
  gsibData: GSIB_INITIAL,

  // Policy simulator
  selectedPolicies: new Set(),
  policyScenario: 'mid',
  syncNsfr: true,
  policyResult: { simple: 0, adjusted: 0, byPolicy: {}, interactions: [], rawByPolicy: {} },

  // AI Briefing
  briefing: '',
  briefingLoading: false,
  briefingError: '',

  // Email
  emailRecipients: '',
  emailStatus: '',

  // UI
  activeTab: 'macro',
  loading: {},
  errors: {},

  // Audit
  auditLogs: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_KEYS':
      return { ...state, fredKey: action.fredKey, deepseekKey: action.deepseekKey };
    case 'SET_FRED_DATA':
      return { ...state, fredData: { ...state.fredData, ...action.payload } };
    case 'SET_INDICATORS':
      return { ...state, indicators: { ...state.indicators, ...action.payload } };
    case 'SET_OFR':
      return { ...state, ofrStress: action.payload };
    case 'SET_GSIB':
      return { ...state, gsibData: action.payload };
    case 'UPDATE_GSIB_ROW':
      return {
        ...state,
        gsibData: state.gsibData.map((r, i) => i === action.index ? { ...r, ...action.data } : r)
      };
    case 'TOGGLE_POLICY': {
      const next = new Set(state.selectedPolicies);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return { ...state, selectedPolicies: next };
    }
    case 'SET_POLICY_SCENARIO':
      return { ...state, policyScenario: action.payload };
    case 'TOGGLE_NSFR':
      return { ...state, syncNsfr: !state.syncNsfr };
    case 'SET_POLICY_RESULT':
      return { ...state, policyResult: action.payload };
    case 'RESET_POLICIES':
      return { ...state, selectedPolicies: new Set() };
    case 'SET_BRIEFING':
      return { ...state, briefing: action.payload, briefingLoading: false, briefingError: '' };
    case 'SET_BRIEFING_LOADING':
      return { ...state, briefingLoading: action.payload };
    case 'SET_BRIEFING_ERROR':
      return { ...state, briefingError: action.payload, briefingLoading: false };
    case 'SET_EMAIL_RECIPIENTS':
      return { ...state, emailRecipients: action.payload };
    case 'SET_EMAIL_STATUS':
      return { ...state, emailStatus: action.payload };
    case 'SET_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: { ...state.loading, [action.key]: action.value } };
    case 'SET_ERROR':
      return { ...state, errors: { ...state.errors, [action.key]: action.value } };
    case 'RESTORE_SNAPSHOT':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const snap = getSnapshotFromURL();
  const merged = snap
    ? { ...initialState, ...snap, selectedPolicies: new Set(snap.selectedPolicies || []) }
    : initialState;

  const [state, dispatch] = useReducer(reducer, merged);

  // Persist keys to localStorage
  useEffect(() => {
    const savedFred = localStorage.getItem('fred_key') || '';
    const savedDs = localStorage.getItem('deepseek_key') || '';
    if (savedFred || savedDs) {
      dispatch({ type: 'SET_KEYS', fredKey: savedFred, deepseekKey: savedDs });
    }
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
