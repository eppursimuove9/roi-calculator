import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, LineChart, Line, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertTriangle, TrendingUp, Users, Lock, Download, ChevronRight, Info, Sparkles, Loader2, Mail, FileText, RefreshCw, Target, Rocket, PieChart, BookOpen } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- UTILITIES ---
const clamp = (value, min, max) => {
  if (isNaN(value) || !isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
};

// --- CONTROL COMPONENT (SLIDER + INPUT) ---
function ControlSlider({ 
  label, value, min, max, step = 1, setter, suffix = "", prefix = "", tooltip, 
  highlightClass = "text-slate-700 bg-slate-50 border-slate-200 focus:ring-slate-500", 
  accentClass = "accent-slate-600" 
}) {
  const [inputValue, setInputValue] = useState(value.toString());

  useEffect(() => { setInputValue(value.toString()); }, [value]);

  const handleInputChange = (e) => setInputValue(e.target.value);
  const handleInputBlur = () => {
    let parsed = parseFloat(inputValue);
    const finalValue = clamp(parsed, min, max);
    setInputValue(finalValue.toString());
    setter(finalValue);
  };
  const handleSliderChange = (e) => {
    const val = parseFloat(e.target.value);
    setInputValue(val.toString());
    setter(val);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="font-semibold text-sm text-slate-700 flex items-center gap-1">
          {label}
          {tooltip && <HelpTip text={tooltip} />}
        </label>
        <div className="flex items-center">
          {prefix && <span className="text-slate-500 font-semibold mr-1">{prefix}</span>}
          <input 
            type="number" value={inputValue} min={min} max={max} step={step}
            onChange={handleInputChange} onBlur={handleInputBlur}
            className={`w-24 text-right font-bold border rounded px-2 py-1 outline-none focus:ring-2 transition-all ${highlightClass}`}
          />
          {suffix && <span className="text-slate-500 font-semibold ml-1">{suffix}</span>}
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={handleSliderChange} className={`w-full cursor-pointer ${accentClass}`} />
    </div>
  );
}

// Set to false to lock the As-Is panel behind the subscription too.
const AS_IS_FREE = true;

const fmtMoney = (n) => {
  if (n === null || n === undefined || !isFinite(n)) return 'N/A';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  return `${sign}$${Math.round(abs).toLocaleString()}`;
};
// Large ROI shown as a multiple of cost, so it reads as a ratio instead of thousands of percent
const fmtRoi = (n) => {
  if (n === null || n === undefined || !isFinite(n)) return 'N/A';
  if (n < 100) return `${Math.round(n).toLocaleString()}%`;
  const x = n / 100;
  return x > 100 ? '>100x' : `${x >= 10 ? Math.round(x) : x.toFixed(1)}x`;
};
const fmtBreakEven = (v) => (v === null ? 'Not reachable' : (v <= 0 ? '0%' : (v > 100 ? '>100%' : (v < 1 ? '<1%' : `${Math.round(v)}%`))));
const signedMoney = (n) => `${n < 0 ? '-' : '+'}${fmtMoney(Math.abs(n))}`;
const fmtPct = (n) => (n === null || n === undefined || !isFinite(n) ? 'N/A' : (n > 1000 ? '>1,000%' : `${Math.round(n).toLocaleString()}%`));

// Chart segments, in stacking order (left to right). The dashed capacity line sits at the end of the first two.
const SEGMENTS = [
  { key: 'HumanReviewed', label: 'Reviewed by seniors', color: '#3b82f6', pdf: [59, 130, 246], hint: 'Senior time actually spent on reviews.' },
  { key: 'UnusedCapacity', label: 'Unused senior capacity', color: '#6ee7b7', pdf: [110, 231, 183], hint: 'Senior hours left over. This is where real savings come from.' },
  { key: 'Backlog', label: 'Unreviewed backlog', color: '#ef4444', pdf: [239, 68, 68], hint: 'Code nobody has time to review.' },
  { key: 'AIHandled', label: 'Reviewed by AI', color: '#8b5cf6', pdf: [139, 92, 246], hint: 'Does not use senior time.' },
];

function HelpTip({ text }) {
  const [open, setOpen] = useState(false);
  const pointer = useRef('');
  return (
    <span
      className="relative inline-flex"
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setOpen(true); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setOpen(false); }}
    >
      <button
        type="button"
        aria-label="What is this?"
        aria-expanded={open}
        onPointerDown={(e) => { pointer.current = e.pointerType; }}
        onClick={() => { if (pointer.current !== 'mouse') setOpen((o) => !o); }}
        onBlur={() => setOpen(false)}
        className="text-slate-400 hover:text-slate-700 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f52e01]"
      >
        <Info className="w-4 h-4" />
      </button>
      {open && (
        <span role="tooltip" className="absolute z-30 left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 rounded-lg bg-[#0B1120] text-white text-xs leading-snug font-normal normal-case tracking-normal p-3 shadow-xl">
          {text}
        </span>
      )}
    </span>
  );
}

function SplitPanel({ title, subtitle, accent, hero, rows, footnote = null, locked = false, onUnlock }) {
  return (
    <div className={`relative min-w-0 rounded-xl border border-[#1E2D4A] border-t-4 ${accent} bg-[#111A2E] overflow-hidden`}>
      <div className={`p-4 ${locked ? 'blur-md opacity-40 select-none' : ''}`} aria-hidden={locked}>
        <div className="text-white font-bold text-sm leading-tight">{title}</div>
        <div className="text-slate-400 text-xs mb-3">{subtitle}</div>
        <div className="mb-2 pb-3 border-b border-[#1E2D4A]">
          <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wide leading-tight">{hero.label}</div>
          <div className={`text-2xl font-black tabular-nums leading-tight break-words ${hero.tone || 'text-white'}`}>{hero.value}</div>
          {hero.note && <div className="text-[11px] text-slate-400 leading-snug mt-1">{hero.note}</div>}
        </div>
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-3 py-2 border-b border-[#1E2D4A] last:border-0">
            <span className="text-xs text-slate-400 leading-snug min-w-0">{r.label}</span>
            <span className={`text-sm font-bold tabular-nums text-right shrink-0 max-w-[55%] break-words ${r.tone || 'text-white'}`}>{r.value}</span>
          </div>
        ))}
        {footnote && <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 text-[11px] text-amber-200 leading-snug">{footnote}</div>}
      </div>
      {locked && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center p-4 bg-[#0B1120]/70 backdrop-blur-sm">
          <Lock className="w-8 h-8 text-[#f52e01] mb-2" />
          <p className="text-white text-sm font-bold mb-3">Subscribe to unlock</p>
          <button onClick={onUnlock} className="bg-[#f52e01] hover:bg-[#ff4117] text-white text-sm font-bold py-2 px-5 rounded-lg flex items-center gap-1">
            Unlock <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm min-w-[210px]">
      <div className="font-bold text-slate-900 mb-2">{label}</div>
      {SEGMENTS.map((sg) => {
        const item = payload.find((x) => x.dataKey === sg.key);
        if (!item || !item.value) return null;
        return (
          <div key={sg.key} className="flex justify-between gap-4 text-slate-600">
            <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: sg.color }} />{sg.label}</span>
            <span className="font-bold text-slate-900 tabular-nums">{Number(item.value).toFixed(1)}h</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------- PURE MODEL (shared by the UI, scenarios, sensitivity, PDF and Excel) ----------
function calcModel(inp) {
  const { devs, locPerDev, automation, seniors, dailyReviewHoursPerSenior, minsPer500, hourlyRate, targetAutomation, humanInTheLoop, savingsRealizationRate, softwareCost, pricingModel, costPer1kLoc, avoidedCostConfidence, implementationCost, rampMonths, currentToolCost, avoidedBasis, defectsPer1kLoc, costPerDefect, discountRate, volumeGrowth, salaryGrowth, workingDays } = inp;
  // --- LOGIC AND MATH CALCULATIONS (CFO-READY) ---
  const workingDaysPerYear = workingDays;

  // Demand
  const totalDailyLoc = devs * locPerDev;
  const rawReviewDemandHours = (totalDailyLoc / 500) * (minsPer500 / 60);
  
  // Capacity Limit
  const capacityHours = seniors * dailyReviewHoursPerSenior;

  // As-Is Scenario
  // Same human-in-the-loop rate is applied to current automation so both scenarios are comparable
  // Today's follow-up rate is a fact about the team. Scenarios and sensitivity change only the future rate.
  const asIsHitl = (inp.asIsHumanInTheLoop ?? humanInTheLoop) / 100;
  const asIsAiHandledRaw = rawReviewDemandHours * (automation / 100);
  const asIsAiFailedToHuman = asIsAiHandledRaw * asIsHitl;
  const asIsNetAiHandled = asIsAiHandledRaw - asIsAiFailedToHuman;
  const asIsHumanDemand = (rawReviewDemandHours * (1 - (automation / 100))) + asIsAiFailedToHuman;
  const asIsExecuted = Math.min(asIsHumanDemand, capacityHours);
  const asIsBacklog = Math.max(0, asIsHumanDemand - capacityHours);

  // To-Be Scenario
  const toBeAiCoverage = targetAutomation / 100;
  const toBeHitl = humanInTheLoop / 100;
  
  const toBeAiHandledRaw = rawReviewDemandHours * toBeAiCoverage;
  const toBeAiFailedToHuman = toBeAiHandledRaw * toBeHitl;
  const toBeNetAiHandled = toBeAiHandledRaw - toBeAiFailedToHuman;

  const toBeTotalHumanDemand = (rawReviewDemandHours * (1 - toBeAiCoverage)) + toBeAiFailedToHuman;
  const toBeExecuted = Math.min(toBeTotalHumanDemand, capacityHours);
  const toBeBacklog = Math.max(0, toBeTotalHumanDemand - capacityHours);

  // --- CORE FINANCIAL METRICS ---
  // 1. Hard Savings (Only applies if human execution actually drops)
  const hardSavingsDailyHours = Math.max(0, asIsExecuted - toBeExecuted);
  const annualHardSavingsValue = hardSavingsDailyHours * workingDaysPerYear * hourlyRate;
  const realizedHardSavings = annualHardSavingsValue * (savingsRealizationRate / 100);

  // 2. Risk Mitigation (Value of Tech Debt / Backlog cleared by AI)
  const techDebtClearedDailyHours = Math.max(0, asIsBacklog - toBeBacklog);
  // Counterfactual: what it would cost to clear this backlog manually (hours x rate). Not cash.
  // Two ways to price the same cleared backlog (never both, so nothing is counted twice):
  //  - effort: hours x hourly rate. - defects: lines of code cleared x escaped-defect rate x cost per defect.
  const locPerReviewHour = minsPer500 > 0 ? 30000 / minsPer500 : 0;
  const clearedLocPerYear = techDebtClearedDailyHours * workingDaysPerYear * locPerReviewHour;
  const avoidedDefectsPerYear = (clearedLocPerYear / 1000) * defectsPer1kLoc;
  const annualTechDebtValue = avoidedBasis === 'defects'
    ? avoidedDefectsPerYear * costPerDefect
    : techDebtClearedDailyHours * workingDaysPerYear * hourlyRate;
  const confidenceAdjustedAvoidedCost = annualTechDebtValue * (avoidedCostConfidence / 100);

  // Software Costing
  const annualLoc = totalDailyLoc * workingDaysPerYear;
  // Only the added coverage is new spend: the share the team already automates is already being paid for
  const incrementalCoverage = Math.max(0, toBeAiCoverage - automation / 100);
  const tokenAnnualCost = (annualLoc / 1000) * costPer1kLoc * incrementalCoverage;
  const calculatedSoftwareCost = pricingModel === 'saas' ? softwareCost : tokenAnnualCost;

  // ROI & Payback (Calculated strictly on Hard Savings)
  const netAnnualBenefit = realizedHardSavings - calculatedSoftwareCost;
  const roiPercentage = calculatedSoftwareCost > 0 ? (netAnnualBenefit / calculatedSoftwareCost) * 100 : null;
  const paybackMonths = realizedHardSavings > 0 ? (calculatedSoftwareCost / realizedHardSavings) * 12 : null;
  const isNegativeRoi = roiPercentage !== null && roiPercentage < 0;

  // Strategic view: hard savings + confidence-adjusted avoided cost (clearly labeled as non-cash)
  const strategicBenefit = realizedHardSavings + confidenceAdjustedAvoidedCost;
  const strategicRoi = calculatedSoftwareCost > 0 ? ((strategicBenefit - calculatedSoftwareCost) / calculatedSoftwareCost) * 100 : null;
  const isNegativeStrategic = strategicRoi !== null && strategicRoi < 0;

  // --- Three-year projection: setup cost, adoption ramp, growth and present value ---
  const growthOn = volumeGrowth !== 0 || salaryGrowth !== 0;
  const yearFig = [0, 1, 2].map((y) => {
    if (y === 0 || !growthOn) return { hard: realizedHardSavings, avoidedFull: annualTechDebtValue, avoided: confidenceAdjustedAvoidedCost, software: calculatedSoftwareCost };
    // Later years: same model with more code and a higher hourly rate (capacity stays fixed)
    const q = calcModel({ ...inp, locPerDev: locPerDev * Math.pow(1 + volumeGrowth / 100, y), hourlyRate: hourlyRate * Math.pow(1 + salaryGrowth / 100, y), volumeGrowth: 0, salaryGrowth: 0 });
    return { hard: q.realizedHardSavings, avoidedFull: q.annualTechDebtValue, avoided: q.confidenceAdjustedAvoidedCost, software: q.calculatedSoftwareCost };
  });
  const monthlyRate = Math.pow(1 + discountRate / 100, 1 / 12) - 1;
  const series = [{ month: 0, cumHard: -implementationCost, cumStrategic: -implementationCost }];
  const years = [0, 1, 2].map(() => ({ hard: 0, avoided: 0, software: 0 }));
  let cumH = -implementationCost, cumS = -implementationCost, npvH = -implementationCost, npvS = -implementationCost;
  let paybackHardMonth = null, paybackStrategicMonth = null, avoidedFull3 = 0;
  for (let mo = 1; mo <= 36; mo++) {
    const yi = Math.floor((mo - 1) / 12);
    const f = yearFig[yi];
    const ramp = rampMonths <= 0 ? 1 : Math.min(1, mo / rampMonths);
    const h = (f.hard / 12) * ramp, av = (f.avoided / 12) * ramp, sw = f.software / 12;
    avoidedFull3 += (f.avoidedFull / 12) * ramp;
    cumH += h - sw; cumS += h + av - sw;
    const df = 1 / Math.pow(1 + monthlyRate, mo);
    npvH += (h - sw) * df; npvS += (h + av - sw) * df;
    const y = years[yi];
    y.hard += h; y.avoided += av; y.software += sw;
    if (paybackHardMonth === null && cumH >= 0) paybackHardMonth = mo;
    if (paybackStrategicMonth === null && cumS >= 0) paybackStrategicMonth = mo;
    series.push({ month: mo, cumHard: Math.round(cumH), cumStrategic: Math.round(cumS) });
  }
  const tot = (k) => years.reduce((acc, y) => acc + y[k], 0);
  const cost3 = tot('software') + implementationCost;
  // Lowest confidence in avoided cost (%) at which the 3-year investment breaks even.
  // 0 = hard savings alone cover it. null = it cannot break even. Above 100 = not even if all the avoided cost were real.
  const beGap = cost3 - tot('hard');
  const breakEven = beGap <= 0 ? 0 : (avoidedFull3 > 0 ? (beGap / avoidedFull3) * 100 : null);
  const hardNet = tot('hard') - cost3;
  const strategicNet = tot('hard') + tot('avoided') - cost3;
  const threeYear = {
    series, years, paybackHardMonth, paybackStrategicMonth, hardNet, strategicNet, cost: cost3, breakEven,
    hardNpv: npvH, strategicNpv: npvS,
    hardRoi: cost3 > 0 ? (hardNet / cost3) * 100 : null,
    strategicRoi: cost3 > 0 ? (strategicNet / cost3) * 100 : null,
  };
  // flat copies so scenarios and sensitivity can read them by key
  return { avoidedDefectsPerYear, workingDaysPerYear, totalDailyLoc, rawReviewDemandHours, capacityHours, asIsHitl, asIsAiHandledRaw, asIsAiFailedToHuman, asIsNetAiHandled, asIsHumanDemand, asIsExecuted, asIsBacklog, toBeAiCoverage, toBeHitl, toBeAiHandledRaw, toBeAiFailedToHuman, toBeNetAiHandled, toBeTotalHumanDemand, toBeExecuted, toBeBacklog, hardSavingsDailyHours, annualHardSavingsValue, realizedHardSavings, techDebtClearedDailyHours, annualTechDebtValue, confidenceAdjustedAvoidedCost, annualLoc, tokenAnnualCost, calculatedSoftwareCost, netAnnualBenefit, roiPercentage, paybackMonths, isNegativeRoi, strategicBenefit, strategicRoi, isNegativeStrategic, threeYear, threeYearHardNet: hardNet, threeYearStrategicNet: strategicNet };
}

const clampTo = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const INPUT_LIMITS = {
  devs: [1, 500], locPerDev: [100, 15000], automation: [0, 100], seniors: [1, 100], dailyReviewHoursPerSenior: [0.5, 8],
  minsPer500: [5, 120], hourlyRate: [30, 500], targetAutomation: [0, 100], humanInTheLoop: [0, 100],
  savingsRealizationRate: [0, 100], softwareCost: [0, 1000000], costPer1kLoc: [0.01, 5], avoidedCostConfidence: [0, 100],
  implementationCost: [0, 1000000], rampMonths: [0, 24],
  currentToolCost: [0, 1000000], defectsPer1kLoc: [0, 5], costPerDefect: [0, 100000], discountRate: [0, 30],
  volumeGrowth: [0, 50], salaryGrowth: [0, 15], workingDays: [150, 260],
};
// Turns untrusted data (share link, saved scenario) into a safe inputs object
function sanitizeInputs(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  Object.entries(INPUT_LIMITS).forEach(([k, [lo, hi]]) => {
    const n = Number(raw[k]);
    if (raw[k] !== undefined && raw[k] !== null && raw[k] !== '' && Number.isFinite(n)) out[k] = clampTo(n, lo, hi);
  });
  if (raw.pricingModel === 'saas' || raw.pricingModel === 'tokens') out.pricingModel = raw.pricingModel;
  if (raw.avoidedBasis === 'effort' || raw.avoidedBasis === 'defects') out.avoidedBasis = raw.avoidedBasis;
  return out;
}

const SCENARIOS = [
  { key: 'pessimistic', label: 'Pessimistic' },
  { key: 'base', label: 'Base' },
  { key: 'optimistic', label: 'Optimistic' },
];
// Scenarios flex only the assumptions about the AI and its costs, never the facts about the team.
function scenarioInputs(inp, kind) {
  if (kind === 'base') return inp;
  const bad = kind === 'pessimistic';
  const mul = bad ? 1.25 : 0.85;
  return {
    ...inp,
    asIsHumanInTheLoop: inp.asIsHumanInTheLoop ?? inp.humanInTheLoop,
    humanInTheLoop: clampTo(inp.humanInTheLoop + (bad ? 10 : -5), 0, 100),
    savingsRealizationRate: clampTo(inp.savingsRealizationRate + (bad ? -25 : 20), 0, 100),
    avoidedCostConfidence: clampTo(inp.avoidedCostConfidence + (bad ? -25 : 20), 0, 100),
    softwareCost: inp.softwareCost * mul,
    costPer1kLoc: inp.costPer1kLoc * mul,
    implementationCost: inp.implementationCost * mul,
    rampMonths: Math.max(0, inp.rampMonths + (bad ? 3 : -1)),
  };
}

// Each variable is nudged down (-1) and up (+1) by a typical margin
const SENS_VARS = [
  { label: 'AI automation level', apply: (i, d) => ({ ...i, targetAutomation: clampTo(i.targetAutomation + 15 * d, i.automation, 100) }) },
  { label: 'Human-in-the-loop rate', apply: (i, d) => ({ ...i, asIsHumanInTheLoop: i.asIsHumanInTheLoop ?? i.humanInTheLoop, humanInTheLoop: clampTo(i.humanInTheLoop + 10 * d, 0, 100) }) },
  { label: 'Savings realization', apply: (i, d) => ({ ...i, savingsRealizationRate: clampTo(i.savingsRealizationRate + 25 * d, 0, 100) }) },
  { label: 'Confidence in avoided cost', apply: (i, d) => ({ ...i, avoidedCostConfidence: clampTo(i.avoidedCostConfidence + 25 * d, 0, 100) }) },
  { label: 'Review speed (min / 500 LOC)', apply: (i, d) => ({ ...i, minsPer500: clampTo(i.minsPer500 * (1 + 0.3 * d), 5, 240) }) },
  { label: 'Senior hourly rate', apply: (i, d) => ({ ...i, hourlyRate: i.hourlyRate * (1 + 0.2 * d) }) },
  { label: 'Code volume per developer', apply: (i, d) => ({ ...i, locPerDev: i.locPerDev * (1 + 0.25 * d) }) },
  { label: 'Senior review hours per day', apply: (i, d) => ({ ...i, dailyReviewHoursPerSenior: clampTo(i.dailyReviewHoursPerSenior * (1 + 0.25 * d), 0.5, 8) }) },
  { label: 'Software cost', apply: (i, d) => ({ ...i, softwareCost: i.softwareCost * (1 + 0.25 * d), costPer1kLoc: i.costPer1kLoc * (1 + 0.25 * d) }) },
  { label: 'Setup cost', apply: (i, d) => ({ ...i, implementationCost: i.implementationCost * (1 + 0.5 * d) }) },
  { label: 'Adoption ramp (months)', apply: (i, d) => ({ ...i, rampMonths: Math.max(0, i.rampMonths + 3 * d) }) },
];
function computeTornado(inp, metric) {
  const base = calcModel(inp)[metric];
  return SENS_VARS.map((v) => {
    const lo = calcModel(v.apply(inp, -1))[metric] - base;
    const hi = calcModel(v.apply(inp, 1))[metric] - base;
    const down = Math.min(0, lo, hi), up = Math.max(0, lo, hi);
    return { label: v.label, down, up, range: up - down };
  }).filter((r) => r.range > 1).sort((x, y) => y.range - x.range);
}

const BENCHMARKS = [
  { label: 'Minutes to audit 500 LOC', value: (i) => i.minsPer500, range: [60, 100], unit: 'min',
    note: 'Effective reviews run below 300 to 500 lines per hour, which is 60 to 100 minutes per 500 lines.',
    source: 'SmartBear / Cisco peer code review study', url: 'https://smartbear.com/learn/code-review/best-practices-for-peer-code-review' },
  { label: 'Senior hourly rate (US reference)', value: (i) => i.hourlyRate, range: [64, 105], unit: '$/h', noStatus: true,
    note: 'The median software developer wage is about $64/h and the top quartile about $81/h, before benefits and overhead. The upper bound adds roughly 30% (our estimate). Rates differ a lot by country, so use your own.',
    source: 'US Bureau of Labor Statistics, May 2024', url: 'https://www.bls.gov/ooh/computer-and-information-technology/software-developers.htm' },
  { label: 'Software cost per developer, per year', value: (i) => (i.pricingModel === 'saas' ? i.softwareCost / i.devs : null), range: [288, 864], unit: '$/dev/yr',
    note: 'Published AI code review seats cost $24 to $72 per developer per month on annual billing. Enterprise platforms are quoted and can cost more.',
    source: 'CodeRabbit public pricing', url: 'https://www.coderabbit.ai/pricing' },
  { label: 'Human-in-the-loop rate', value: (i) => i.humanInTheLoop, range: [20, 50], unit: '%',
    note: 'Indicative only. One third-party comparison reports AI reviewers at roughly 50 to 66% precision or recall, so a meaningful share of their output still needs a person.',
    source: 'Morph comparison of CodeRabbit and Greptile', url: 'https://www.morphllm.com/comparisons/coderabbit-vs-greptile' },
];

function LockedSection({ locked, onUnlock, children }) {
  return (
    <div className="relative">
      <div className={locked ? 'blur-sm opacity-40 pointer-events-none select-none' : ''} aria-hidden={locked}>{children}</div>
      {locked && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center p-4">
          <Lock className="w-8 h-8 text-[#f52e01] mb-2" />
          <p className="text-slate-900 text-sm font-bold mb-3">Subscribe to unlock</p>
          <button onClick={onUnlock} className="bg-[#f52e01] hover:bg-[#ff4117] text-white text-sm font-bold py-2 px-5 rounded-lg flex items-center gap-1">Unlock <ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}

// Builds a values-only workbook (no formulas, on purpose)
function buildWorkbook(XLSX, { inputs, m, scenarioResults, tornado, tornadoLabel }) {
  const usd = '$#,##0;-$#,##0', pct = '0%', hrs = '0.0';
  const c = (v, z) => ({ v, t: 'n', z });
  const wb = XLSX.utils.book_new();
  const add = (name, rows, widths) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = widths.map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add('Assumptions', [
    ['Assumption', 'Value'],
    ['Active developers', inputs.devs], ['LOC per developer per day', inputs.locPerDev],
    ['Current AI automation (%)', inputs.automation], ['Target AI automation (%)', inputs.targetAutomation],
    ['Senior engineers', inputs.seniors], ['Review hours per senior per day', inputs.dailyReviewHoursPerSenior],
    ['Minutes to audit 500 LOC', inputs.minsPer500], ['Senior hourly rate (USD)', inputs.hourlyRate],
    ['Human-in-the-loop (%)', inputs.humanInTheLoop], ['Savings realization (%)', inputs.savingsRealizationRate],
    ['Confidence in avoided cost (%)', inputs.avoidedCostConfidence],
    ['Pricing model', inputs.pricingModel === 'saas' ? 'SaaS license' : 'API tokens'],
    ['Annual software cost (USD)', c(m.calculatedSoftwareCost, usd)],
    ['One-time setup cost (USD)', c(inputs.implementationCost, usd)], ['Adoption ramp (months)', inputs.rampMonths],
    ['Current AI tool cost (USD per year)', c(inputs.currentToolCost, usd)], ['Working days per year', inputs.workingDays],
    ['How the cleared backlog is valued', inputs.avoidedBasis === 'defects' ? 'Defects avoided' : 'Review effort'],
    ['Escaped defects per 1k unreviewed LOC', inputs.defectsPer1kLoc], ['Cost per escaped defect (USD)', c(inputs.costPerDefect, usd)],
    ['Code volume growth per year (%)', inputs.volumeGrowth], ['Hourly rate growth per year (%)', inputs.salaryGrowth], ['Discount rate (%)', inputs.discountRate],
  ], [38, 18]);
  add('As-Is vs To-Be', [
    ['Per day', 'As-Is', 'To-Be'],
    ['Review demand before automation (h)', c(m.rawReviewDemandHours, hrs), c(m.rawReviewDemandHours, hrs)],
    ['Human review demand (h)', c(m.asIsHumanDemand, hrs), c(m.toBeTotalHumanDemand, hrs)],
    ['Senior capacity (h)', c(m.capacityHours, hrs), c(m.capacityHours, hrs)],
    ['Human review executed (h)', c(m.asIsExecuted, hrs), c(m.toBeExecuted, hrs)],
    ['Backlog (h)', c(m.asIsBacklog, hrs), c(m.toBeBacklog, hrs)],
    ['Reviewed by AI (h)', c(m.asIsNetAiHandled, hrs), c(m.toBeNetAiHandled, hrs)],
    [], ['Per year (steady state)', 'Value'],
    ['Realized hard savings (USD)', c(m.realizedHardSavings, usd)],
    ['Avoided cost, 100% (USD, non-cash)', c(m.annualTechDebtValue, usd)],
    ['Avoided cost after confidence (USD)', c(m.confidenceAdjustedAvoidedCost, usd)],
    ['Conservative ROI', m.roiPercentage === null ? 'N/A' : c(m.roiPercentage / 100, pct)],
    ['Strategic ROI', m.strategicRoi === null ? 'N/A' : c(m.strategicRoi / 100, pct)],
  ], [46, 16, 16]);
  add('Scenarios', [
    ['Result', ...scenarioResults.map((s) => s.label)],
    ['Net change in yearly cost (USD)', ...scenarioResults.map((s) => c(s.m.calculatedSoftwareCost - s.m.realizedHardSavings, usd))],
    ['Backlog removed per day (h)', ...scenarioResults.map((s) => c(s.m.techDebtClearedDailyHours, hrs))],
    ['Conservative ROI', ...scenarioResults.map((s) => (s.m.roiPercentage === null ? 'N/A' : c(s.m.roiPercentage / 100, pct)))],
    ['Strategic ROI', ...scenarioResults.map((s) => (s.m.strategicRoi === null ? 'N/A' : c(s.m.strategicRoi / 100, pct)))],
    ['3-year net, hard savings only (USD)', ...scenarioResults.map((s) => c(s.m.threeYear.hardNet, usd))],
    ['3-year net, incl. avoided cost (USD)', ...scenarioResults.map((s) => c(s.m.threeYear.strategicNet, usd))],
    ['3-year present value, hard savings only (USD)', ...scenarioResults.map((s) => c(s.m.threeYear.hardNpv, usd))],
    ['3-year present value, incl. avoided cost (USD)', ...scenarioResults.map((s) => c(s.m.threeYear.strategicNpv, usd))],
    ['Break-even confidence', ...scenarioResults.map((s) => (s.m.threeYear.breakEven === null ? 'Not reachable' : c(s.m.threeYear.breakEven / 100, pct)))],
  ], [40, 16, 16, 16]);
  add('3-Year View', [
    ['Month', 'Cumulative net, hard only (USD)', 'Cumulative net, incl. avoided cost (USD)'],
    ...m.threeYear.series.map((r) => [r.month, c(r.cumHard, usd), c(r.cumStrategic, usd)]),
  ], [10, 34, 40]);
  add('Sensitivity', [
    [`Impact on 3-year net: ${tornadoLabel}`, 'If worse (USD)', 'If better (USD)'],
    ...tornado.map((r) => [r.label, c(r.down, usd), c(r.up, usd)]),
  ], [36, 18, 18]);
  return wb;
}

const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function App() {
  // --- STATE AND VARIABLES (Current Inputs) ---
  const [devs, setDevs] = useState(12);
  const [locPerDev, setLocPerDev] = useState(1500);
  const [automation, setAutomation] = useState(0);
  const [seniors, setSeniors] = useState(3);
  const [dailyReviewHoursPerSenior, setDailyReviewHoursPerSenior] = useState(3);
  const [minsPer500, setMinsPer500] = useState(75);
  const [hourlyRate, setHourlyRate] = useState(90);
  
  // --- STATE AND VARIABLES (Target/AI Scenario) ---
  const [targetAutomation, setTargetAutomation] = useState(75);
  const [humanInTheLoop, setHumanInTheLoop] = useState(25); // % of AI reviews needing human override
  const [savingsRealizationRate, setSavingsRealizationRate] = useState(50);
  
  // Financials
  const [softwareCost, setSoftwareCost] = useState(7000);
  const [pricingModel, setPricingModel] = useState('saas'); // saas | tokens
  const [costPer1kLoc, setCostPer1kLoc] = useState(0.15);

  // --- PAYWALL STATE (Lead Capture) ---
  const [avoidedCostConfidence, setAvoidedCostConfidence] = useState(50); // % of the avoided manual-review cost the user is confident to count
  const [leadEmail, setLeadEmail] = useState("");
  const [leadError, setLeadError] = useState("");
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(() => {
    try { return localStorage.getItem('tpe_pro_unlocked') === '1'; } catch { return false; }
  });
  const [showModal, setShowModal] = useState(false);

  // --- AI STATE (Gemini API with Cache) ---
  const [aiSummaries, setAiSummaries] = useState({ pitch: "", email: "" });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [activeAiTab, setActiveAiTab] = useState("pitch"); 
  
  // --- PDF STATE ---
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [exportOpts, setExportOpts] = useState({ chart: true, pitch: false, email: false });
  const [showGuide, setShowGuide] = useState(true);
  const [implementationCost, setImplementationCost] = useState(10000); // one-time setup, planning assumption
  const [rampMonths, setRampMonths] = useState(3); // months to reach full effect, planning assumption
  const [currentToolCost, setCurrentToolCost] = useState(0); // what the team already pays for AI review tools
  const [avoidedBasis, setAvoidedBasis] = useState('effort'); // 'effort' | 'defects'
  const [defectsPer1kLoc, setDefectsPer1kLoc] = useState(0.1); // planning assumption (no public benchmark), used only with the defects basis
  const [costPerDefect, setCostPerDefect] = useState(2000); // planning assumption (no public benchmark), used only with the defects basis
  const [discountRate, setDiscountRate] = useState(10); // planning assumption for present value
  const [volumeGrowth, setVolumeGrowth] = useState(0); // yearly growth in code volume
  const [salaryGrowth, setSalaryGrowth] = useState(0); // yearly growth in the hourly rate
  const [workingDays, setWorkingDays] = useState(230);
  const [sensMetric, setSensMetric] = useState('threeYearHardNet');
  const [isGeneratingXlsx, setIsGeneratingXlsx] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const [savedScenarios, setSavedScenarios] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem('tpe_scenarios') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
  });

  // Sync automation boundaries
  useEffect(() => {
    setTargetAutomation((prev) => Math.max(prev, automation));
  }, [automation]);

  // AI Cache Invalidation
  useEffect(() => {
    setAiSummaries({ pitch: "", email: "" });
    setAiError("");
  }, [
    devs, locPerDev, automation, seniors, dailyReviewHoursPerSenior, minsPer500, 
    hourlyRate, targetAutomation, humanInTheLoop, softwareCost, pricingModel, costPer1kLoc, savingsRealizationRate, avoidedCostConfidence, implementationCost, rampMonths,
    currentToolCost, avoidedBasis, defectsPer1kLoc, costPerDefect, discountRate, volumeGrowth, salaryGrowth, workingDays
  ]);

  const inputs = { devs, locPerDev, automation, seniors, dailyReviewHoursPerSenior, minsPer500, hourlyRate, targetAutomation, humanInTheLoop, savingsRealizationRate, softwareCost, pricingModel, costPer1kLoc, avoidedCostConfidence, implementationCost, rampMonths, currentToolCost, avoidedBasis, defectsPer1kLoc, costPerDefect, discountRate, volumeGrowth, salaryGrowth, workingDays };
  const m = calcModel(inputs);
  const { workingDaysPerYear, totalDailyLoc, rawReviewDemandHours, capacityHours, asIsHitl, asIsAiHandledRaw, asIsAiFailedToHuman, asIsNetAiHandled, asIsHumanDemand, asIsExecuted, asIsBacklog, toBeAiCoverage, toBeHitl, toBeAiHandledRaw, toBeAiFailedToHuman, toBeNetAiHandled, toBeTotalHumanDemand, toBeExecuted, toBeBacklog, hardSavingsDailyHours, annualHardSavingsValue, realizedHardSavings, techDebtClearedDailyHours, annualTechDebtValue, confidenceAdjustedAvoidedCost, annualLoc, tokenAnnualCost, calculatedSoftwareCost, netAnnualBenefit, roiPercentage, paybackMonths, isNegativeRoi, strategicBenefit, strategicRoi, isNegativeStrategic } = m;
  const ty = m.threeYear;

  // --- Three views: As-Is, To-Be, Combined. The Combined view is exactly To-Be minus As-Is. ---
  const asIsSeniorCost = asIsExecuted * workingDaysPerYear * hourlyRate;
  const asIsBacklogCost = asIsBacklog * workingDaysPerYear * hourlyRate;
  const toBeSeniorCost = asIsSeniorCost - realizedHardSavings; // after the share of freed time that becomes real savings
  const asIsTotalCost = asIsSeniorCost + currentToolCost; // seniors plus the AI tools already paid for
  const toBeTotalCost = toBeSeniorCost + currentToolCost + calculatedSoftwareCost;
  const costChange = toBeTotalCost - asIsTotalCost; // positive = costs more to operate
  const asIsLoad = capacityHours > 0 ? (asIsHumanDemand / capacityHours) * 100 : 0;
  const toBeLoad = capacityHours > 0 ? (toBeTotalHumanDemand / capacityHours) * 100 : 0;
  const asIsAiShare = rawReviewDemandHours > 0 ? (asIsNetAiHandled / rawReviewDemandHours) * 100 : 0;
  const toBeAiShare = rawReviewDemandHours > 0 ? (toBeNetAiHandled / rawReviewDemandHours) * 100 : 0;
  const backlogRemoved = Math.max(0, asIsBacklog - toBeBacklog);
  const backlogRemovedPct = asIsBacklog > 0 ? (backlogRemoved / asIsBacklog) * 100 : null;
  const strategicNetValue = strategicBenefit - calculatedSoftwareCost;
  const avoidedLabel = avoidedBasis === 'defects' ? 'Avoided defect cost' : 'Avoided review cost';
  const avoidedWhat = avoidedBasis === 'defects' ? 'escaped-defect cost' : 'manual review effort';
  const loadTone = (v) => (v > 100 ? 'text-red-400' : 'text-emerald-400');

  const asIsPanel = {
    title: 'As-Is', subtitle: 'What you live with today', accent: 'border-t-slate-400', pdfColor: [71, 85, 105],
    hero: { label: 'Total yearly operating cost', value: fmtMoney(asIsTotalCost), note: 'Senior review time plus the AI tools you already pay for.' },
    rows: [
      { label: 'Senior review cost', value: fmtMoney(asIsSeniorCost) },
      ...(currentToolCost > 0 ? [{ label: 'Current AI tool cost', value: fmtMoney(currentToolCost) }] : []),
      { label: 'Review demand vs. capacity', value: fmtPct(asIsLoad), tone: loadTone(asIsLoad) },
      { label: 'Backlog per day', value: `${asIsBacklog.toFixed(1)} h`, tone: asIsBacklog > 0 ? 'text-red-400' : 'text-emerald-400' },
      { label: 'Cost to review the backlog by hand (yearly)', value: fmtMoney(asIsBacklogCost), tone: asIsBacklog > 0 ? 'text-amber-400' : 'text-white' },
      { label: 'Senior review hours per day', value: `${asIsExecuted.toFixed(1)} h` },
      { label: 'Reviews handled by AI', value: fmtPct(asIsAiShare) },
    ],
  };
  const toBePanel = {
    title: 'To-Be', subtitle: 'Where you want to get', accent: 'border-t-violet-500', pdfColor: [124, 58, 237],
    hero: { label: 'Total yearly operating cost', value: fmtMoney(toBeTotalCost), note: 'Senior review time plus all AI software costs.' },
    rows: [
      { label: 'Senior review cost (after expected savings)', value: fmtMoney(toBeSeniorCost) },
      ...(currentToolCost > 0 ? [{ label: 'Current AI tool cost', value: fmtMoney(currentToolCost) }] : []),
      { label: 'Added software cost', value: fmtMoney(calculatedSoftwareCost) },
      { label: 'Review demand vs. capacity', value: fmtPct(toBeLoad), tone: loadTone(toBeLoad) },
      { label: 'Backlog per day', value: `${toBeBacklog.toFixed(1)} h`, tone: toBeBacklog > 0 ? 'text-red-400' : 'text-emerald-400' },
      { label: 'Senior review hours per day', value: `${toBeExecuted.toFixed(1)} h` },
      { label: 'Reviews handled by AI', value: fmtPct(toBeAiShare) },
    ],
  };
  const combinedPanel = {
    title: 'Combined', subtitle: 'What the strategy delivers', accent: 'border-t-[#f52e01]', pdfColor: [245, 46, 1],
    hero: {
      label: 'Net change in yearly cost', value: costChange === 0 ? '$0' : signedMoney(costChange),
      tone: costChange > 0 ? 'text-red-400' : 'text-emerald-400',
      note: costChange > 0 ? 'Costs more to run than today.' : (costChange < 0 ? 'Costs less to run than today.' : 'No change in yearly cost.'),
    },
    rows: [
      { label: 'Backlog removed per day', value: `${backlogRemoved.toFixed(1)} h${backlogRemovedPct !== null ? ` (${Math.round(backlogRemovedPct)}%)` : ''}`, tone: backlogRemoved > 0 ? 'text-emerald-400' : 'text-white' },
      { label: `${avoidedLabel} (${avoidedCostConfidence}% confidence, non-cash)`, value: `+${fmtMoney(confidenceAdjustedAvoidedCost)}`, tone: 'text-amber-400' },
      { label: 'Conservative ROI (steady state, hard savings)', value: fmtPct(roiPercentage), tone: isNegativeRoi ? 'text-red-400' : 'text-emerald-400' },
      { label: 'Strategic ROI (steady state, incl. avoided cost)', value: fmtRoi(strategicRoi), tone: isNegativeStrategic ? 'text-red-400' : 'text-emerald-400' },
      { label: 'Payback, hard savings (incl. setup and ramp)', value: ty.paybackHardMonth ? `Month ${ty.paybackHardMonth}` : 'Not within 36 months', tone: ty.paybackHardMonth ? 'text-emerald-400' : 'text-red-400' },
    ],
    footnote: hardSavingsDailyHours === 0 && toBeLoad > 100
      ? 'Your team is still at its capacity limit with AI, so there is no cash saving. The value is in the backlog removed.'
      : (isNegativeRoi ? 'Hard savings alone do not cover the software cost. Read this together with the avoided cost.' : null),
  };

  // Headline results: lead with these, then the percentages
  const breakEven = ty.breakEven;
  const headline = [
    { label: '3-year net value', value: signedMoney(ty.strategicNet), tone: ty.strategicNet < 0 ? 'text-red-400' : 'text-emerald-400',
      note: 'Including avoided cost, after setup cost and the adoption ramp.' },
    { label: 'Payback', value: ty.paybackStrategicMonth ? `Month ${ty.paybackStrategicMonth}` : 'Not within 36 months', tone: ty.paybackStrategicMonth ? 'text-emerald-400' : 'text-red-400',
      note: `Including avoided cost. Hard savings only: ${ty.paybackHardMonth ? `month ${ty.paybackHardMonth}` : 'not within 36 months'}.` },
    { label: 'Break-even confidence', value: fmtBreakEven(breakEven), tone: breakEven === null || breakEven > 100 ? 'text-red-400' : 'text-emerald-400',
      note: breakEven === null ? 'There is no avoided cost to count and hard savings do not cover the cost.'
        : (breakEven === 0 ? 'Hard savings alone cover the 3-year cost.'
        : (breakEven > 100 ? 'Not reachable, even if all of the avoided cost were real.'
        : `The investment breaks even over 3 years if at least this share of the avoided cost is real. You assumed ${avoidedCostConfidence}%.`)) },
  ];

  // --- CHART DATA (one bar per scenario; segments in SEGMENTS order) ---
  const r1 = (x) => Number(x.toFixed(1));
  const chartData = [
    { name: "Today (As-Is)", HumanReviewed: r1(asIsExecuted), UnusedCapacity: r1(Math.max(0, capacityHours - asIsExecuted)), Backlog: r1(asIsBacklog), AIHandled: r1(asIsNetAiHandled) },
    { name: "With AI (To-Be)", HumanReviewed: r1(toBeExecuted), UnusedCapacity: r1(Math.max(0, capacityHours - toBeExecuted)), Backlog: r1(toBeBacklog), AIHandled: r1(toBeNetAiHandled) },
  ];

  // --- SCENARIOS, SENSITIVITY AND 3-YEAR TABLES (shared by UI, PDF and Excel) ---
  const scenarioResults = SCENARIOS.map((sc) => ({ ...sc, m: calcModel(scenarioInputs(inputs, sc.key)) }));
  const scenarioRows = [
    { label: 'Net change in yearly cost', values: scenarioResults.map((x) => { const d = x.m.calculatedSoftwareCost - x.m.realizedHardSavings; return d === 0 ? '$0' : signedMoney(d); }) },
    { label: 'Backlog removed per day', values: scenarioResults.map((x) => `${x.m.techDebtClearedDailyHours.toFixed(1)} h`) },
    { label: 'Conservative ROI (steady state)', values: scenarioResults.map((x) => fmtPct(x.m.roiPercentage)) },
    { label: 'Strategic ROI (steady state)', values: scenarioResults.map((x) => fmtRoi(x.m.strategicRoi)) },
    { label: 'Break-even confidence', values: scenarioResults.map((x) => fmtBreakEven(x.m.threeYear.breakEven)) },
    { label: '3-year net, hard savings only', values: scenarioResults.map((x) => signedMoney(x.m.threeYear.hardNet)) },
    { label: '3-year net, incl. avoided cost', values: scenarioResults.map((x) => signedMoney(x.m.threeYear.strategicNet)) },
    { label: `3-year present value at ${discountRate}%, hard savings only`, values: scenarioResults.map((x) => signedMoney(x.m.threeYear.hardNpv)) },
    { label: `3-year present value at ${discountRate}%, incl. avoided cost`, values: scenarioResults.map((x) => signedMoney(x.m.threeYear.strategicNpv)) },
  ];
  const tornado = computeTornado(inputs, sensMetric);
  const tornadoLabel = sensMetric === 'threeYearHardNet' ? 'hard savings only' : 'incl. avoided cost';

  const setupByYear = [implementationCost, 0, 0];
  const yearCols = ty.years.map((y, i) => ({ ...y, setup: setupByYear[i] }));
  yearCols.push({ hard: yearCols.reduce((a, y) => a + y.hard, 0), avoided: yearCols.reduce((a, y) => a + y.avoided, 0), software: yearCols.reduce((a, y) => a + y.software, 0), setup: implementationCost });
  const yearRows = [
    ['Hard savings', (y) => fmtMoney(y.hard)],
    ['Avoided cost (weighted, non-cash)', (y) => fmtMoney(y.avoided)],
    ['Software cost', (y) => fmtMoney(y.software)],
    ['Setup cost', (y) => fmtMoney(y.setup)],
    ['Net, hard savings only', (y) => signedMoney(y.hard - y.software - y.setup)],
    ['Net, incl. avoided cost', (y) => signedMoney(y.hard + y.avoided - y.software - y.setup)],
  ].map(([label, f]) => ({ label, values: yearCols.map(f) }));

  // --- SHARE / SAVE / EXCEL ---
  const applyInputs = (raw) => {
    const v = sanitizeInputs(raw);
    const setters = { devs: setDevs, locPerDev: setLocPerDev, automation: setAutomation, seniors: setSeniors, dailyReviewHoursPerSenior: setDailyReviewHoursPerSenior,
      minsPer500: setMinsPer500, hourlyRate: setHourlyRate, targetAutomation: setTargetAutomation, humanInTheLoop: setHumanInTheLoop,
      savingsRealizationRate: setSavingsRealizationRate, softwareCost: setSoftwareCost, pricingModel: setPricingModel, costPer1kLoc: setCostPer1kLoc,
      avoidedCostConfidence: setAvoidedCostConfidence, implementationCost: setImplementationCost, rampMonths: setRampMonths,
      currentToolCost: setCurrentToolCost, avoidedBasis: setAvoidedBasis, defectsPer1kLoc: setDefectsPer1kLoc, costPerDefect: setCostPerDefect,
      discountRate: setDiscountRate, volumeGrowth: setVolumeGrowth, salaryGrowth: setSalaryGrowth, workingDays: setWorkingDays };
    Object.entries(v).forEach(([k, val]) => setters[k](val));
  };

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('s');
      if (q) applyInputs(JSON.parse(atob(q)));
    } catch { /* ignore malformed links */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyShareLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?s=${encodeURIComponent(btoa(JSON.stringify(inputs)))}`;
    try { await navigator.clipboard.writeText(url); } catch { window.prompt('Copy this link', url); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const persistScenarios = (list) => {
    setSavedScenarios(list);
    try { localStorage.setItem('tpe_scenarios', JSON.stringify(list)); } catch { /* ignore */ }
  };
  const saveScenario = () => {
    if (!isUnlocked) { setShowModal(true); return; }
    const name = scenarioName.trim() || `Scenario ${savedScenarios.length + 1}`;
    persistScenarios([{ id: Date.now(), name, inputs, savedAt: Date.now() }, ...savedScenarios].slice(0, 20));
    setScenarioName("");
  };
  const loadScenario = (sc) => applyInputs(sc.inputs);
  const deleteScenario = (id) => persistScenarios(savedScenarios.filter((x) => x.id !== id));

  const handleDownloadExcel = async () => {
    setIsGeneratingXlsx(true);
    try {
      const XLSX = await import('xlsx');
      const wb = buildWorkbook(XLSX, { inputs, m, scenarioResults, tornado, tornadoLabel });
      XLSX.writeFile(wb, `ROI_Model_Verification_Tax_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      console.error("Error generating Excel:", error);
      alert("There was an error generating the Excel file. Please try again.");
    } finally {
      setIsGeneratingXlsx(false);
    }
  };

  const handleUnlock = async (e) => {
    e.preventDefault();
    setLeadError("");
    setLeadSubmitting(true);
    let subscribed = false;
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: leadEmail.trim() }),
      });
      if (res.status === 400) {
        setLeadError("Please enter a valid email address.");
        setLeadSubmitting(false);
        return;
      }
      subscribed = res.ok;
    } catch (err) {
      console.error("Subscribe error:", err);
    }
    // Local development only: lets you test the PRO view before /api/subscribe exists.
    // In production builds (import.meta.env.DEV is false) access requires a successful subscription.
    if (!subscribed && import.meta.env.DEV) subscribed = true;

    if (!subscribed) {
      setLeadError("We couldn't complete your subscription. Please try again in a moment.");
      setLeadSubmitting(false);
      return;
    }
    try { localStorage.setItem('tpe_pro_unlocked', '1'); } catch { /* ignore */ }
    setIsUnlocked(true);
    setShowModal(false);
    setLeadSubmitting(false);
  };

  // --- PDF EXPORT FUNCTION ---
  const stripMd = (t) => t
    .replace(/^[\s]*[-*]\s+/gm, '- ')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[^\x00-\xFF]/g, '');

  // Draws the chart with vector shapes (crisp, no screenshot needed). Returns the next free y.
  const drawChartPdf = (doc, startY) => {
    const x0 = 52, plotW = 138, rowH = 14, gap = 10;
    const top = startY + 25;
    const plotH = 6 + chartData.length * (rowH + gap);
    const totals = chartData.map((d) => SEGMENTS.reduce((acc, sg) => acc + d[sg.key], 0));
    const maxVal = Math.max(capacityHours, ...totals, 1) * 1.1;
    const scale = plotW / maxVal;

    doc.setFontSize(12); doc.setTextColor(15, 23, 42);
    doc.text("Where the review work goes (hours per day)", 14, startY + 4);
    doc.setFontSize(8); doc.setTextColor(100);
    doc.text("Dashed line = most review hours your seniors can give. Red past the line = code nobody reviews.", 14, startY + 9);

    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2);
    for (let t = 0; t <= 4; t++) {
      const val = (maxVal * t) / 4;
      const x = x0 + val * scale;
      doc.line(x, top, x, top + plotH);
      doc.setFontSize(7); doc.setTextColor(100);
      doc.text(`${val.toFixed(0)}h`, x, top + plotH + 4, { align: 'center' });
    }

    chartData.forEach((d, i) => {
      const y = top + 6 + i * (rowH + gap);
      doc.setFontSize(9); doc.setTextColor(15, 23, 42);
      doc.text(d.name, x0 - 3, y + rowH / 2 + 1, { align: 'right' });
      let x = x0;
      SEGMENTS.forEach((sg) => {
        const w = d[sg.key] * scale;
        if (w <= 0) return;
        doc.setFillColor(...sg.pdf);
        doc.rect(x, y, w, rowH, 'F');
        if (w > 11) {
          doc.setFontSize(7); doc.setTextColor(sg.key === 'UnusedCapacity' ? 15 : 255, sg.key === 'UnusedCapacity' ? 23 : 255, sg.key === 'UnusedCapacity' ? 42 : 255);
          doc.text(`${d[sg.key].toFixed(1)}h`, x + w / 2, y + rowH / 2 + 1, { align: 'center' });
        }
        x += w;
      });
    });

    const cx = x0 + capacityHours * scale;
    doc.setDrawColor(11, 17, 32); doc.setLineWidth(0.6);
    doc.setLineDashPattern([2, 1.5], 0);
    doc.line(cx, top - 3, cx, top + plotH);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(8); doc.setTextColor(11, 17, 32);
    doc.text(`Senior capacity: ${capacityHours.toFixed(1)}h`, cx, top - 5, { align: 'center' });

    let lx = 14; const ly = top + plotH + 12;
    SEGMENTS.forEach((sg) => {
      doc.setFillColor(...sg.pdf); doc.rect(lx, ly - 2.5, 3, 3, 'F');
      doc.setFontSize(8); doc.setTextColor(60);
      doc.text(sg.label, lx + 5, ly);
      lx += 5 + doc.getTextWidth(sg.label) + 8;
    });
    return ly + 10;
  };

  const writeTextSection = (doc, title, text) => {
    doc.addPage();
    doc.setFontSize(14); doc.setTextColor(15, 23, 42);
    doc.text(title, 14, 22);
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text("AI-generated draft. Verify the figures before sharing.", 14, 28);
    doc.setFontSize(10); doc.setTextColor(40);
    let y = 38;
    doc.splitTextToSize(stripMd(text), 182).forEach((line) => {
      if (y > 278) { doc.addPage(); y = 20; }
      doc.text(line, 14, y);
      y += 5.5;
    });
  };

  const handleDownloadPDF = () => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF();
      const timestamp = new Date().toLocaleDateString();
      const money = (n) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

      doc.setFontSize(18); doc.setTextColor(15, 23, 42);
      doc.text("Business Case: Verification Tax ROI", 14, 22);
      doc.setFontSize(10); doc.setTextColor(100);
      doc.text(`Generated on: ${timestamp}`, 14, 30);
      doc.text("Confidential ROI Analysis Report - The Predictive Engine", 14, 35);

      autoTable(doc, {
        startY: 45,
        head: [['Assumption', 'Value']],
        body: [
          ['Active developers', `${devs}`],
          ['LOC per dev / day', `${locPerDev}`],
          ['Senior engineers / review hrs per senior per day', `${seniors} / ${dailyReviewHoursPerSenior}h`],
          ['Minutes to audit 500 LOC', `${minsPer500}m`],
          ['Senior hourly rate', `$${hourlyRate}`],
          ['AI automation (current -> target)', `${automation}% -> ${targetAutomation}%`],
          ['Human-in-the-loop override', `${humanInTheLoop}%`],
          ['Savings realization rate', `${savingsRealizationRate}%`],
          ['Confidence in avoided cost', `${avoidedCostConfidence}%`],
          ['Backlog valued by', avoidedBasis === 'defects' ? `Defects avoided (${defectsPer1kLoc} per 1k LOC, $${costPerDefect} each)` : 'Review effort (hours x rate)'],
          ['Working days / current AI tool cost', `${workingDays} / $${currentToolCost}`],
          ['Growth in code volume / hourly rate, per year', `${volumeGrowth}% / ${salaryGrowth}%`],
          ['Setup cost / adoption ramp / discount rate', `$${implementationCost} / ${rampMonths} mo / ${discountRate}%`],
        ],
        headStyles: { fillColor: [15, 23, 42] },
      });

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [['Operational Metric (per day)', 'As-Is', 'To-Be']],
        body: [
          ['Human review demand', `${asIsHumanDemand.toFixed(1)}h`, `${toBeTotalHumanDemand.toFixed(1)}h`],
          ['Human review executed', `${asIsExecuted.toFixed(1)}h`, `${toBeExecuted.toFixed(1)}h`],
          ['Backlog (unreviewed)', `${asIsBacklog.toFixed(1)}h`, `${toBeBacklog.toFixed(1)}h`],
          ['Reviewed by AI', `${asIsNetAiHandled.toFixed(1)}h`, `${toBeNetAiHandled.toFixed(1)}h`],
        ],
        headStyles: { fillColor: [15, 23, 42] },
      });

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [['Headline results (3 years)', 'Value', 'What it means']],
        body: headline.map((h) => [h.label, h.value, h.note]),
        headStyles: { fillColor: [245, 46, 1] },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      });

      [asIsPanel, toBePanel, combinedPanel].forEach((panel) => {
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 8,
          head: [[`${panel.title}: ${panel.subtitle}`, '']],
          body: [[panel.hero.label, panel.hero.value], ...panel.rows.map((r) => [r.label, r.value]),
            ...(panel.footnote ? [[{ content: panel.footnote, colSpan: 2, styles: { fontStyle: 'italic', textColor: [100, 100, 100] } }]] : [])],
          headStyles: { fillColor: panel.pdfColor },
          columnStyles: { 1: { halign: 'right' } },
        });
      });

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [['Scenario comparison', ...SCENARIOS.map((x) => x.label)]],
        body: scenarioRows.map((r) => [r.label, ...r.values]),
        headStyles: { fillColor: [15, 23, 42] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      });
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [['Three-year view (with setup cost and adoption ramp)', 'Year 1', 'Year 2', 'Year 3', 'Total']],
        body: yearRows.map((r) => [r.label, ...r.values]),
        headStyles: { fillColor: [15, 23, 42] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      });
      if (tornado.length) {
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 8,
          head: [[`Biggest drivers of the 3-year result (${tornadoLabel})`, 'If worse', 'If better']],
          body: tornado.slice(0, 6).map((r) => [r.label, signedMoney(r.down), signedMoney(r.up)]),
          headStyles: { fillColor: [15, 23, 42] },
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        });
      }

      if (exportOpts.chart) {
        let y = doc.lastAutoTable.finalY + 12;
        if (y > 165) { doc.addPage(); y = 20; }
        drawChartPdf(doc, y);
      }
      if (exportOpts.pitch && aiSummaries.pitch) writeTextSection(doc, "Board Pitch", aiSummaries.pitch);
      if (exportOpts.email && aiSummaries.email) writeTextSection(doc, "CFO Budget Request", aiSummaries.email);

      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setTextColor(148, 163, 184);
        doc.text("Powered by The Predictive Engine PRO - ROI Verification Tax Simulator", 14, 290);
        doc.text(`Page ${i} of ${pages}`, 196, 290, { align: 'right' });
      }

      doc.save(`ROI_Report_Verification_Tax_${timestamp.replace(/\//g, '-')}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("There was an error generating the PDF. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // --- MARKDOWN PARSER ---
  const formatAIResponse = (text) => {
    if (!text) return "";
    let formatted = escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^[\s]*[\-\*]\s+(.*)$/gm, '<li class="ml-6 list-disc mb-1">$1</li>');
    
    formatted = formatted.replace(/(<li class="ml-6 list-disc mb-1">.*?<\/li>\s*)+/g, '<ul class="my-3">$&</ul>');
    formatted = formatted.replace(/\n{3,}/g, '\n\n');
    formatted = formatted.replace(/\n/g, '<br/>');
    formatted = formatted.replace(/<br\/>(?=<ul)/g, '');
    formatted = formatted.replace(/<\/ul><br\/>/g, '</ul>');
    formatted = formatted.replace(/<\/li><br\/>/g, '</li>');
    return formatted;
  };

  // --- GEMINI API INTEGRATION ---
  const executeAIGeneration = async (type) => {
    setAiLoading(true);
    setAiError("");

    const costTypeStr = pricingModel === 'saas' ? 'CAPEX (Flat-rate Licenses)' : 'OPEX (API/Tokens Consumption)';
    const paybackStr = ty.paybackHardMonth ? `month ${ty.paybackHardMonth} (including setup cost and the adoption ramp)` : 'Not recoverable via hard savings within 36 months';
    const roiStr = roiPercentage !== null ? `${roiPercentage.toFixed(0)}%` : 'N/A';

    let prompt = "";
    if (type === 'pitch') {
      prompt = `Based on the following Verification Tax operational data, write an executive pitch (maximum 3 key bullet points) for the board of directors regarding an investment of $${calculatedSoftwareCost.toLocaleString()} USD in Agentic CI/CD tools (${costTypeStr}).
      
      Current Operational Risks:
      - We are accumulating a daily backlog of ${asIsBacklog.toFixed(1)} hours of unreviewed code because human capacity is capped at ${capacityHours} hrs/day.
      
      Target Scenario Value:
      - Avoided cost (NOT cash): clearing the backlog avoids roughly $${annualTechDebtValue.toLocaleString()} USD/year of ${avoidedWhat}; a conservative ${avoidedCostConfidence}% confidence view is $${confidenceAdjustedAvoidedCost.toLocaleString()} USD.
      - 3-year net value including avoided cost: ${signedMoney(ty.strategicNet)} USD. Break-even confidence: ${fmtBreakEven(ty.breakEven)} (the minimum share of the avoided cost that must be real for the investment to pay back over 3 years).
      - Strategic ROI (hard savings + confidence-adjusted avoided cost): ${fmtRoi(strategicRoi)}.
      - Hard Capacity Savings: We will capture $${realizedHardSavings.toLocaleString()} USD in real capacity savings (Realization rate: ${savingsRealizationRate}%).
      - ROI (Hard Savings only): ${roiStr}. Payback: ${paybackStr}.
      
      ${isNegativeRoi ?
        'CRITICAL NOTE: Direct cash ROI is negative. The pitch MUST NOT claim the software pays for itself in cash. It must focus entirely on eradicating the technical debt backlog and unlocking engineering velocity.' :
        `Tone: Strategic consultant (The Predictive Engine). Focus on how this investment pays for itself in ${paybackStr} and clears critical technical bottlenecks.`}
      Be direct, persuasive, and precise. Output in English.`;
    } else if (type === 'email') {
      prompt = `Act as a B2B Engineering Director. Write a formal email to the CFO requesting $${calculatedSoftwareCost.toLocaleString()} USD (${costTypeStr}) for code review automation (Agentic CI/CD).
      
      Financial Data:
      1. We are currently blocked, accumulating ${asIsBacklog.toFixed(1)} hours of unreviewed tech debt daily.
      2. The investment avoids about $${annualTechDebtValue.toLocaleString()} USD/year of ${avoidedWhat} on the backlog (non-cash; ${avoidedCostConfidence}% confidence view: $${confidenceAdjustedAvoidedCost.toLocaleString()} USD). 3-year net value including avoided cost: ${signedMoney(ty.strategicNet)} USD. The investment breaks even over 3 years if at least ${fmtBreakEven(ty.breakEven)} of that avoided cost is real. Strategic ROI: ${fmtRoi(strategicRoi)}.
      3. It generates $${realizedHardSavings.toLocaleString()} USD in realized hard savings.
      
      ${isNegativeRoi ?
        'IMPORTANT: ROI is negative based purely on hard savings. Transparently state to the CFO that this is a risk mitigation and velocity play, not a pure cost-cutting measure.' :
        'Focus on capital efficiency, the clearance of operational risk, and the hard payback period of ' + paybackStr + '.'}
      Eliminate jargon. Do not use terms like "sunk cost". Output in English.`;
    }

    const systemInstruction = "You are an executive consultant specializing in Revenue Operations, DevOps, and B2B finance. Communicate concisely, oriented towards financial truth. Use bullet points and bold text. Never invent savings metrics.";

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, systemInstruction }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP error ${response.status}`);
      if (data?.text) {
        setAiSummaries(prev => ({ ...prev, [type]: data.text }));
      } else {
        throw new Error("No content received");
      }
    } catch (err) {
      setAiError("An error occurred while contacting the AI engine. Please try again later.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-orange-200 pb-12 overflow-x-hidden">
      
      {/* Top Navbar */}
      <div className="bg-[#0B1120] text-white px-6 py-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <img 
            src="https://media.beehiiv.com/cdn-cgi/image/format=auto,onerror=redirect/uploads/asset/file/412cff10-d6bf-4948-93cb-9626504d550b/Gemini_Generated_Image_hgi88jhgi88jhgi8-ezremove.png" 
            alt="The Predictive Engine Logo" 
            className="w-10 h-10 mix-blend-screen object-contain"
            style={{ width: '40px', height: '40px', flexShrink: 0 }}
          />
          <span className="font-bold tracking-wide text-lg hidden sm:inline-block">The Predictive Engine <span className="text-[#f52e01] font-light">PRO</span></span>
        </div>
        <button 
          onClick={() => !isUnlocked && setShowModal(true)}
          className={`text-sm px-4 py-2 rounded-md transition-colors border ${isUnlocked ? 'bg-[#f52e01] border-[#ff4117] text-white shadow-sm' : 'bg-[#111A2E] hover:bg-[#1E2D4A] border-[#1E2D4A]'}`}
        >
          {isUnlocked ? 'Pro Account Active' : 'Sign In'}
        </button>
      </div>

      <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
        
        {/* Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-bold uppercase tracking-widest mb-2">
            Business Case Simulator
          </div>
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900">
            ROI Calculator: <span className="text-[#f52e01]">Verification Tax</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-4xl">
            Model technical debt eradication. Separate "Hard Cash Savings" from "Avoided Cost" to build a bulletproof CFO-ready business case for Agentic CI/CD platforms.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Controls */}
          <div className="xl:col-span-4 space-y-6">
            
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 leading-snug">
              <strong>Starting values are examples.</strong> Replace them with your own team's numbers.
            </div>

            {/* CURRENT SCENARIO */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold flex items-center gap-2 border-b pb-4 mb-6 text-slate-800">
                <Users className="w-5 h-5 text-slate-500" /> Current Operations (As-Is)
              </h2>
              <div className="space-y-6">
                <ControlSlider label="Active Developers" value={devs} min={1} max={500} setter={setDevs} tooltip="Developers whose code gets reviewed. Include seniors here too if they also write code." />
                <ControlSlider label="LOC per Dev / Day" value={locPerDev} min={100} max={15000} step={100} setter={setLocPerDev} tooltip="Lines of code each developer writes or changes per day." />
                <ControlSlider label="Current AI Automation" value={automation} min={0} max={100} setter={setAutomation} suffix="%" tooltip="Share of review work the AI already handles today. Use 0 if you have no AI review yet." />
                
                <div className="pt-4 border-t border-slate-100 space-y-6">
                  <ControlSlider label="Senior Engineers" value={seniors} min={1} max={100} setter={setSeniors} tooltip="Engineers who review other people's code. Their review hours set your capacity." />
                  <ControlSlider 
                    label="Review Hrs / Senior / Day" value={dailyReviewHoursPerSenior} min={0.5} max={8} step={0.5} setter={setDailyReviewHoursPerSenior} suffix="h" tooltip="Hours per day each senior can give to reviews, not their whole workday." />
                  <ControlSlider label="Mins to audit 500 LOC" value={minsPer500} min={5} max={120} step={5} setter={setMinsPer500} suffix="m" tooltip="Time a senior needs to properly review 500 lines." />
                  <ControlSlider label="Senior Hourly Rate" value={hourlyRate} min={30} max={500} step={5} setter={setHourlyRate} prefix="$" tooltip="Full hourly cost of a senior engineer." />
                  <ControlSlider label="Working Days / Year" value={workingDays} min={150} max={260} step={5} setter={setWorkingDays} tooltip="Productive days per year used to turn daily results into yearly ones." />
                  <ControlSlider label="Current AI Tool Cost" value={currentToolCost} min={0} max={1000000} step={1000} setter={setCurrentToolCost} prefix="$" tooltip="What you already pay yearly for AI review tools. Assumed to continue in both scenarios." />
                </div>
              </div>
            </div>

            {/* TARGET SCENARIO AND ROI */}
            <div className="bg-slate-50 p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold flex items-center gap-2 border-b border-slate-200 pb-4 mb-6 text-slate-800">
                <Target className="w-5 h-5 text-slate-500" /> Optimization Strategy (To-Be)
              </h2>
              <div className="space-y-6">
                <ControlSlider 
                  label="Target AI Automation" value={targetAutomation} min={automation} max={100} setter={setTargetAutomation} suffix="%"
                  highlightClass="text-[#f52e01] bg-orange-50 border-orange-200 focus:ring-orange-500" accentClass="accent-[#f52e01]" tooltip="Share of review work the AI would take over." />
                
                <ControlSlider 
                  label="Human-in-the-Loop Override" value={humanInTheLoop} min={0} max={100} step={1} setter={setHumanInTheLoop} suffix="%"
                  highlightClass="text-amber-700 bg-amber-50 border-amber-200" accentClass="accent-amber-500" tooltip="Share of the AI's reviews that a person still has to redo or fix." />

                <ControlSlider 
                  label="Confidence in Avoided Cost" value={avoidedCostConfidence} min={0} max={100} step={5} setter={setAvoidedCostConfidence} suffix="%" tooltip="How much of the avoided cost you'd defend in front of a CFO." />

                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">How to value the backlog AI clears <HelpTip text="Review effort prices those hours at your hourly rate. Defects avoided prices the bugs that would otherwise slip through." /></div>
                  <div className="flex gap-2 bg-slate-200 p-1 rounded-lg">
                    {[['effort', 'Review effort'], ['defects', 'Defects avoided']].map(([k, l]) => (
                      <button key={k} onClick={() => setAvoidedBasis(k)} className={`flex-1 text-xs font-bold py-2 rounded transition-all ${avoidedBasis === k ? 'bg-white text-slate-900 shadow-sm border border-slate-300' : 'text-slate-500 hover:text-slate-800'}`}>{l}</button>
                    ))}
                  </div>
                </div>
                {avoidedBasis === 'defects' && (
                  <div className="space-y-6">
                    <ControlSlider label="Escaped Defects / 1k LOC" value={defectsPer1kLoc} min={0} max={5} step={0.05} setter={setDefectsPer1kLoc} tooltip="Bugs that reach production per 1,000 lines that nobody reviews." />
                    <ControlSlider label="Cost per Escaped Defect" value={costPerDefect} min={0} max={100000} step={500} setter={setCostPerDefect} prefix="$" tooltip="Average cost of one production bug: fixing it, downtime and customer impact." />
                  </div>
                )}

                <ControlSlider 
                  label="Savings Realization Rate" value={savingsRealizationRate} min={0} max={100} step={5} setter={setSavingsRealizationRate} suffix="%" tooltip="How much of the freed time turns into real money saved." />

                <ControlSlider label="Setup Cost (one-time)" value={implementationCost} min={0} max={1000000} step={1000} setter={setImplementationCost} prefix="$"
                  highlightClass="text-emerald-700 bg-white border-emerald-200 focus:ring-emerald-500" accentClass="accent-emerald-600"
                  tooltip="One-time cost of integration, setup and training." />
                <ControlSlider label="Adoption Ramp" value={rampMonths} min={0} max={24} step={1} setter={setRampMonths} suffix=" mo"
                  highlightClass="text-indigo-700 bg-white border-indigo-200 focus:ring-indigo-500" accentClass="accent-indigo-600"
                  tooltip="Months until the AI delivers its full effect." />
                <ControlSlider label="Code Volume Growth / Year" value={volumeGrowth} min={0} max={50} step={1} setter={setVolumeGrowth} suffix="%" tooltip="How much more code your team expects to write each year. Review capacity stays fixed." />
                <ControlSlider label="Hourly Rate Growth / Year" value={salaryGrowth} min={0} max={15} step={1} setter={setSalaryGrowth} suffix="%" tooltip="Expected yearly raise in the cost of a senior hour." />
                <ControlSlider label="Discount Rate" value={discountRate} min={0} max={30} step={1} setter={setDiscountRate} suffix="%" tooltip="Used for present value. It reflects that money received later is worth less." />

                {/* PRICING MODEL SELECTOR */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-4 mb-2">Software Cost Model</div>
                  <div className="flex gap-2 bg-slate-200 p-1 rounded-lg mb-4">
                    <button onClick={() => setPricingModel('saas')} className={`flex-1 text-xs font-bold py-2 rounded transition-all ${pricingModel === 'saas' ? 'bg-white text-slate-900 shadow-sm border border-slate-300' : 'text-slate-500 hover:text-slate-700'}`}>SaaS License</button>
                    <button onClick={() => setPricingModel('tokens')} className={`flex-1 text-xs font-bold py-2 rounded transition-all ${pricingModel === 'tokens' ? 'bg-white text-slate-900 shadow-sm border border-slate-300' : 'text-slate-500 hover:text-slate-700'}`}>API Tokens</button>
                  </div>
                  
                  {pricingModel === 'saas' ? (
                    <ControlSlider label="Annual Software Cost" value={softwareCost} min={0} max={1000000} step={1000} setter={setSoftwareCost} prefix="$" tooltip="Yearly cost of the new tool, on top of what you pay today." />
                  ) : (
                    <div className="space-y-4">
                      <ControlSlider label="Inference Cost (per 1k LOC)" value={costPer1kLoc} min={0.01} max={5.00} step={0.01} setter={setCostPer1kLoc} prefix="$" tooltip="What the AI charges per 1,000 lines it reviews." />
                      <div className="bg-slate-100 p-3 rounded-lg border border-slate-200 flex justify-between items-center shadow-inner">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1"><Rocket className="w-3 h-3" /> Added API Cost (yearly)</span>
                        <span className="text-lg font-black text-slate-700">${tokenAnnualCost.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Results */}
          <div className="xl:col-span-8 space-y-6 min-w-0">

            {/* QUICK GUIDE (free, helps first-time visitors) */}
            {showGuide && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><BookOpen className="w-5 h-5 text-[#f52e01]" /> New here? Three steps</h2>
                    <p className="text-sm text-slate-600 mt-1">This tool estimates what slow code review costs your team, and what AI review could change.</p>
                  </div>
                  <button onClick={() => setShowGuide(false)} className="text-xs font-bold text-slate-500 hover:text-slate-800 shrink-0">Hide</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="font-bold text-slate-900 mb-1">Describe your team</div>
                    Fill in <em>Current Operations</em>: how many developers you have, how much code they write, and how many hours your senior engineers can spend on reviews.
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="font-bold text-slate-900 mb-1">Pick an AI scenario</div>
                    In <em>Optimization Strategy</em>, choose how much review the AI takes over, how often a person still has to step in, and what the software costs.
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="font-bold text-slate-900 mb-1">Read the result</div>
                    Check whether your team is overloaded, how much real money AI saves, and how much work it removes from the backlog. Then export a report.
                  </div>
                </div>
              </div>
            )}

            {/* OPERATING METRICS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Total Daily Demand', value: rawReviewDemandHours.toFixed(1), note: 'Review hours your code needs each day, before any automation.', bar: 'border-b-slate-400' },
                { label: 'Human Capacity Limit', value: capacityHours.toFixed(1), note: 'The most review hours your senior engineers can give per day.', bar: 'border-b-emerald-500' },
                { label: 'Daily Backlog Today', value: asIsBacklog.toFixed(1), note: "Hours of code per day that nobody has time to review. This is today's risk.", bar: 'border-b-[#f52e01]' },
              ].map((m) => (
                <div key={m.label} className={`min-w-0 bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-b-4 ${m.bar}`}>
                  <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2 leading-tight">{m.label}</div>
                  <div className="text-3xl font-black text-slate-900 tabular-nums">{m.value} <span className="text-lg text-slate-400">h</span></div>
                  <div className="text-sm text-slate-500 mt-1 leading-snug">{m.note}</div>
                </div>
              ))}
            </div>

            {/* FINANCIAL SPLITS: AS-IS / TO-BE / COMBINED */}
            <div className="bg-[#0B1120] rounded-2xl shadow-lg border border-[#1E2D4A] p-5 lg:p-6">
              <div className="text-white text-sm font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-[#f52e01]" /> Financial Splits (CFO Ready)
              </div>
              <p className="text-slate-400 text-xs mb-5">All money figures are per year at full adoption. Read left to right: where you are, where you want to be, and what the change adds up to.</p>
              <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 ${!isUnlocked ? 'blur-md opacity-40 select-none' : ''}`} aria-hidden={!isUnlocked}>
                {headline.map((h) => (
                  <div key={h.label} className="min-w-0 rounded-xl border border-[#1E2D4A] bg-[#111A2E] p-4">
                    <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wide leading-tight">{h.label}</div>
                    <div className={`text-2xl font-black tabular-nums leading-tight break-words mt-1 ${h.tone}`}>{h.value}</div>
                    <div className="text-[11px] text-slate-400 leading-snug mt-1">{h.note}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <SplitPanel {...asIsPanel} locked={!isUnlocked && !AS_IS_FREE} onUnlock={() => setShowModal(true)} />
                <SplitPanel {...toBePanel} locked={!isUnlocked} onUnlock={() => setShowModal(true)} />
                <SplitPanel {...combinedPanel} locked={!isUnlocked} onUnlock={() => setShowModal(true)} />
              </div>
            </div>

            {/* AI EXECUTIVE PITCH SECTION */}
            {isUnlocked && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                   <h3 className="font-bold flex items-center gap-2 text-slate-900"><Sparkles className="w-5 h-5 text-amber-500" /> AI Executive Assistant</h3>
                   <div className="flex gap-2">
                      <button onClick={() => setActiveAiTab('pitch')} className={`text-xs font-bold py-2 px-4 rounded-md transition-colors ${activeAiTab === 'pitch' ? 'bg-slate-200 text-slate-900' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><FileText className="w-4 h-4 inline mr-1"/> Pitch</button>
                      <button onClick={() => setActiveAiTab('email')} className={`text-xs font-bold py-2 px-4 rounded-md transition-colors ${activeAiTab === 'email' ? 'bg-slate-200 text-slate-900' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><Mail className="w-4 h-4 inline mr-1"/> Email</button>
                   </div>
                </div>
                <div className="min-h-[160px] p-6 bg-slate-50 rounded-xl border border-slate-100">
                   {aiLoading ? (
                     <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3 py-6">
                       <Sparkles className="w-8 h-8 animate-pulse text-amber-400" />
                       <p className="text-sm font-medium">Synthesizing executive model...</p>
                     </div>
                   ) : aiError ? (
                     <div className="text-red-500 text-sm flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> {aiError}</div>
                   ) : aiSummaries[activeAiTab] ? (
                     <div>
                       <div dangerouslySetInnerHTML={{__html: formatAIResponse(aiSummaries[activeAiTab])}} className="prose prose-sm max-w-none text-slate-800"></div>
                       <button onClick={() => executeAIGeneration(activeAiTab)} className="mt-4 text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 ml-auto"><RefreshCw className="w-3 h-3"/> Regenerate</button>
                     </div>
                   ) : (
                     <div className="flex flex-col items-center justify-center py-4 space-y-4">
                        <p className="text-slate-400 text-sm italic">Generate a CFO-ready business case outlining hard savings vs avoided cost.</p>
                        <button onClick={() => executeAIGeneration(activeAiTab)} className="bg-[#0B1120] hover:bg-slate-800 text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Sparkles className="w-4 h-4"/> Generate Draft</button>
                     </div>
                   )}
                </div>
              </div>
            )}

            {/* CAPACITY VS DEMAND CHART */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-slate-700" /> Where the review work goes, every day
              </h3>
              <p className="text-sm text-slate-500 mt-1 mb-4 max-w-3xl">
                Each bar is one day of code review. The dashed line is the most your seniors can review. Red past the line is code nobody gets to review; violet is work the AI takes off your seniors' plate.
              </p>

              <div className={`h-72 w-full transition-all duration-500 ${!isUnlocked ? 'opacity-30 pointer-events-none' : ''}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 28, right: 24, left: 8, bottom: 8 }} barCategoryGap="28%">
                    <defs>
                      {SEGMENTS.map((sg) => (
                        <linearGradient key={sg.key} id={`g-${sg.key}`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={sg.color} stopOpacity={0.75} />
                          <stop offset="100%" stopColor={sg.color} stopOpacity={1} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid horizontal={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis type="number" unit="h" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={120} axisLine={false} tickLine={false} tick={{ fill: '#0B1120', fontWeight: 700, fontSize: 13 }} />
                    <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
                    <ReferenceLine x={capacityHours} ifOverflow="extendDomain" stroke="#0B1120" strokeWidth={2} strokeDasharray="5 4"
                      label={{ position: 'top', value: `Senior capacity: ${capacityHours.toFixed(1)}h`, fill: '#0B1120', fontWeight: 700, fontSize: 12 }} />
                    {SEGMENTS.map((sg) => (
                      <Bar key={sg.key} dataKey={sg.key} name={sg.label} stackId="w" fill={`url(#g-${sg.key})`} stroke="#fff" strokeWidth={2} radius={6} barSize={52} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                {SEGMENTS.map((sg) => (
                  <div key={sg.key} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="mt-0.5 w-3 h-3 rounded-full shrink-0" style={{ background: sg.color }} />
                    <span><strong className="text-slate-800">{sg.label}.</strong> {sg.hint}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* SCENARIOS + SENSITIVITY */}
            <LockedSection locked={!isUnlocked} onUnlock={() => setShowModal(true)}>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Target className="w-5 h-5 text-slate-700" /> Scenarios and sensitivity</h3>
                <p className="text-sm text-slate-500 mt-1 mb-4 max-w-3xl">These are illustrative cases, not forecasts. They keep your automation target and the facts about your team fixed, and change how well things go. Pessimistic: human follow-up +10 points, savings realization -25, confidence -25, costs +25%, ramp +3 months. Optimistic: -5, +20, +20, costs -15%, ramp -1 month.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-3 font-bold">Result</th>
                        {SCENARIOS.map((sc) => <th key={sc.key} className={`py-2 px-3 font-bold text-right ${sc.key === 'base' ? 'text-[#f52e01]' : ''}`}>{sc.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {scenarioRows.map((r) => (
                        <tr key={r.label} className="border-t border-slate-100">
                          <td className="py-2 pr-3 text-slate-600">{r.label}</td>
                          {r.values.map((v, i) => <td key={i} className={`py-2 px-3 text-right font-bold tabular-nums ${i === 1 ? 'bg-orange-50 text-slate-900' : 'text-slate-700'}`}>{v}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-slate-900">What moves the result the most</h4>
                    <p className="text-sm text-slate-500">Each bar shows how the 3-year result changes when that input moves by a fixed, illustrative margin (for example 25% on costs). The margins are not benchmarks. Check the longest bars first.</p>
                  </div>
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-lg shrink-0">
                    {[['threeYearHardNet', 'Hard savings only'], ['threeYearStrategicNet', 'Incl. avoided cost']].map(([k, l]) => (
                      <button key={k} onClick={() => setSensMetric(k)} className={`text-xs font-bold px-3 py-1.5 rounded-md ${sensMetric === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="mt-3 w-full" style={{ height: Math.max(180, tornado.length * 36 + 60) }}>
                  {tornado.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-slate-500">No input changes this result. Raise the AI automation level to see drivers.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tornado} layout="vertical" stackOffset="sign" margin={{ top: 8, right: 24, left: 8, bottom: 8 }} barCategoryGap="25%">
                        <CartesianGrid horizontal={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(v) => fmtMoney(v)} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                        <YAxis type="category" dataKey="label" width={150} axisLine={false} tickLine={false} tick={{ fill: '#0B1120', fontWeight: 600, fontSize: 12 }} />
                        <RechartsTooltip formatter={(v, n) => [signedMoney(v), n === 'down' ? 'If worse' : 'If better']} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
                        <ReferenceLine x={0} stroke="#0B1120" strokeWidth={1.5} />
                        <Bar dataKey="down" stackId="t" fill="#ef4444" radius={4} />
                        <Bar dataKey="up" stackId="t" fill="#10b981" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </LockedSection>

            {/* THREE-YEAR VIEW */}
            <LockedSection locked={!isUnlocked} onUnlock={() => setShowModal(true)}>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-slate-700" /> Three-year view</h3>
                <p className="text-sm text-slate-500 mt-1 mb-4 max-w-3xl">Adds the one-time setup cost and a gradual adoption ramp. The lines show cumulative net value; above zero means the investment has paid for itself.</p>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ty.series} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" ticks={[0, 6, 12, 18, 24, 30, 36]} tickFormatter={(v) => `M${v}`} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => fmtMoney(v)} axisLine={false} tickLine={false} width={70} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <RechartsTooltip labelFormatter={(v) => `Month ${v}`} formatter={(v, n) => [signedMoney(v), n === 'cumHard' ? 'Hard savings only' : 'Incl. avoided cost']} />
                      <ReferenceLine y={0} stroke="#0B1120" strokeWidth={1.5} />
                      <Line type="monotone" dataKey="cumHard" stroke="#3b82f6" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="cumStrategic" stroke="#f52e01" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
                  <span className="flex items-center gap-2"><span className="w-3 h-1 rounded bg-[#3b82f6]" /> Hard savings only. Break-even: <strong>{ty.paybackHardMonth ? `month ${ty.paybackHardMonth}` : 'not within 36 months'}</strong></span>
                  <span className="flex items-center gap-2"><span className="w-3 h-1 rounded bg-[#f52e01]" /> Incl. avoided cost. Break-even: <strong>{ty.paybackStrategicMonth ? `month ${ty.paybackStrategicMonth}` : 'not within 36 months'}</strong></span>
                </div>
                <p className="mt-4 text-sm text-slate-600">Present value at {discountRate}% a year: hard savings only <strong>{signedMoney(ty.hardNpv)}</strong>, including avoided cost <strong>{signedMoney(ty.strategicNpv)}</strong>.</p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-3 text-left font-bold">Per year</th>
                        {['Year 1', 'Year 2', 'Year 3', '3-year total'].map((h) => <th key={h} className="py-2 px-3 text-right font-bold">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {yearRows.map((r) => (
                        <tr key={r.label} className="border-t border-slate-100">
                          <td className="py-2 pr-3 text-slate-600">{r.label}</td>
                          {r.values.map((v, i) => <td key={i} className={`py-2 px-3 text-right tabular-nums ${i === 3 ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{v}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </LockedSection>

            {/* BENCHMARKS */}
            <details className="group bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <summary className="cursor-pointer font-bold text-slate-900 flex items-center gap-2 list-none">
                <BookOpen className="w-5 h-5 text-slate-500" /> Benchmarks and sources
                <span className="ml-auto text-xs font-semibold text-slate-500 group-open:hidden">Show</span>
                <span className="ml-auto text-xs font-semibold text-slate-500 hidden group-open:inline">Hide</span>
              </summary>
              <p className="mt-4 text-sm text-slate-600">We compared your inputs with public references where they exist. These are reference ranges from public sources, mostly US or global vendor data, not a standard. A value outside them is not wrong, but be ready to explain it.</p>
              <div className="mt-4 space-y-4">
                {BENCHMARKS.map((b) => {
                  const v = b.value(inputs);
                  const status = v === null || b.noStatus ? null : (v < b.range[0] ? 'Below reference range' : (v > b.range[1] ? 'Above reference range' : 'Within reference range'));
                  return (
                    <div key={b.label} className="border-t border-slate-100 pt-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-slate-900">{b.label}</strong>
                        {status && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${status.startsWith('Within') ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{status}</span>}
                      </div>
                      <div className="text-slate-600 mt-1">Your value: <strong>{v === null ? 'n/a for this pricing model' : `${Math.round(v * 100) / 100} ${b.unit}`}</strong>. Reference range: {b.range[0]} to {b.range[1]} {b.unit}.</div>
                      <div className="text-slate-500 mt-1">{b.note} Source: <a href={b.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-800">{b.source}</a></div>
                    </div>
                  );
                })}
                <div className="border-t border-slate-100 pt-4 text-sm text-slate-500">
                  <strong className="text-slate-900">Planning assumptions.</strong> We found no reliable public benchmark for lines of code per developer per day, review hours per senior, realization rate, confidence in avoided cost, setup cost, adoption ramp, defect rate and cost per defect, growth rates or the discount rate. Replace them with your own data. They are the inputs most likely to be questioned.
                </div>
              </div>
            </details>

            {/* EXPORT & SHARE PANEL */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Download className="w-5 h-5 text-slate-700" /> Export and share</h3>
              <p className="text-sm text-slate-500 mt-1">Your inputs stay in your browser. Nothing is stored on our servers.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={() => isUnlocked ? handleDownloadPDF() : setShowModal(true)} disabled={isGeneratingPdf}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold border ${isUnlocked ? 'bg-[#0B1120] text-white border-[#0B1120] hover:bg-slate-800' : 'bg-orange-50 text-[#f52e01] border-orange-200 hover:bg-orange-100'}`}>
                  {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : (isUnlocked ? <Download className="w-4 h-4" /> : <Lock className="w-4 h-4" />)}
                  {isGeneratingPdf ? 'Generating PDF...' : (isUnlocked ? 'Download PDF' : 'Unlock PDF')}
                </button>
                <button onClick={() => isUnlocked ? handleDownloadExcel() : setShowModal(true)} disabled={isGeneratingXlsx}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold border ${isUnlocked ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700' : 'bg-orange-50 text-[#f52e01] border-orange-200 hover:bg-orange-100'}`}>
                  {isGeneratingXlsx ? <Loader2 className="w-4 h-4 animate-spin" /> : (isUnlocked ? <FileText className="w-4 h-4" /> : <Lock className="w-4 h-4" />)}
                  {isGeneratingXlsx ? 'Preparing Excel...' : (isUnlocked ? 'Download Excel' : 'Unlock Excel')}
                </button>
                <button onClick={copyShareLink} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold border border-slate-300 text-slate-700 hover:bg-slate-50">
                  <Mail className="w-4 h-4" /> {copied ? 'Link copied' : 'Copy share link'}
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={exportOpts.chart} onChange={(e) => setExportOpts(o => ({ ...o, chart: e.target.checked }))} className="accent-[#f52e01]" /> PDF: include chart
                </label>
                <label className={`flex items-center gap-2 ${aiSummaries.pitch ? 'cursor-pointer' : 'opacity-50'}`}>
                  <input type="checkbox" disabled={!aiSummaries.pitch} checked={exportOpts.pitch && !!aiSummaries.pitch} onChange={(e) => setExportOpts(o => ({ ...o, pitch: e.target.checked }))} className="accent-[#f52e01]" />
                  PDF: include Board Pitch {!aiSummaries.pitch && <span className="text-xs text-slate-500">(generate it above first)</span>}
                </label>
                <label className={`flex items-center gap-2 ${aiSummaries.email ? 'cursor-pointer' : 'opacity-50'}`}>
                  <input type="checkbox" disabled={!aiSummaries.email} checked={exportOpts.email && !!aiSummaries.email} onChange={(e) => setExportOpts(o => ({ ...o, email: e.target.checked }))} className="accent-[#f52e01]" />
                  PDF: include CFO Email {!aiSummaries.email && <span className="text-xs text-slate-500">(generate it above first)</span>}
                </label>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100">
                <div className="text-sm font-bold text-slate-900 mb-2">Saved scenarios (this browser only)</div>
                <div className="flex gap-2">
                  <input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} maxLength={40} placeholder="Name, e.g. Q1 budget case"
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-[#f52e01]" />
                  <button onClick={saveScenario} className="px-4 py-2 rounded-lg text-sm font-bold bg-slate-900 text-white hover:bg-slate-700 shrink-0">Save</button>
                </div>
                {savedScenarios.length > 0 && (
                  <ul className="mt-3 divide-y divide-slate-100 text-sm">
                    {savedScenarios.map((sc) => (
                      <li key={sc.id} className="py-2 flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-slate-700">{sc.name} <span className="text-xs text-slate-400">{new Date(sc.savedAt).toLocaleDateString()}</span></span>
                        <span className="flex gap-3 shrink-0">
                          <button onClick={() => loadScenario(sc)} className="font-bold text-[#f52e01] hover:underline">Load</button>
                          <button onClick={() => deleteScenario(sc.id)} className="text-slate-500 hover:text-red-600">Delete</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* HOW TO READ (no formulas on purpose) */}
            <details className="group bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <summary className="cursor-pointer font-bold text-slate-900 flex items-center gap-2 list-none">
                <Info className="w-5 h-5 text-slate-500" /> How to read these results
                <span className="ml-auto text-xs font-semibold text-slate-500 group-open:hidden">Show</span>
                <span className="ml-auto text-xs font-semibold text-slate-500 hidden group-open:inline">Hide</span>
              </summary>
              <div className="mt-4 space-y-4 text-sm text-slate-600 leading-relaxed">
                <p><strong className="text-slate-800">Overload (backlog).</strong> Every team has a limit on how much code its senior engineers can review in a day. When the code coming in is more than that limit, the extra piles up as backlog: reviews that get delayed or skipped. That pile is the risk this tool puts a number on.</p>
                <p><strong className="text-slate-800">What AI changes.</strong> AI takes over part of the reviewing. Some of its work still needs a person to step in, so we let you set how often that happens. The chart shows who ends up doing the work, with and without AI.</p>
                <p><strong className="text-slate-800">Hard savings.</strong> Real money, and only when your seniors truly end up spending less time on reviews. If they are overloaded both before and after AI, they stay just as busy, so there is little cash to save. You also choose how much of any freed time you expect to turn into real savings.</p>
                <p><strong className="text-slate-800">Avoided cost.</strong> The backlog AI clears is work you would otherwise have to pay people to do. It is a useful comparison, but it is not cash, so you decide how much of it you are confident to count.</p>
                <p><strong className="text-slate-800">Read these first.</strong> The 3-year net value, the payback, and the break-even confidence. The last one is the most telling: it is the share of the avoided cost that has to be real for the investment to pay back. A low number means the case does not rely on a generous assumption.</p>
                <p><strong className="text-slate-800">The ROI percentages come second.</strong> The conservative one counts only real savings and is the one a finance team will trust. The strategic one also counts avoided cost and can look very large when the software is cheap, which is why large values are shown as multiples.</p>
                <p><strong className="text-slate-800">Scenarios and sensitivity.</strong> The pessimistic and optimistic cases change only the assumptions about the AI and its costs. The sensitivity chart shows which inputs move the three-year result the most, so you know where to look for better data first.</p>
                <p><strong className="text-slate-800">Three-year view.</strong> Adds a one-time setup cost and a gradual ramp, because AI rarely delivers its full effect on day one. The steady-state ROI above assumes full effect from the start.</p>
                <p><strong className="text-slate-800">Valuing the backlog.</strong> You can price the backlog AI clears in two ways: by the review effort it would take, or by the bugs that would otherwise slip into production. Only one is used at a time, so nothing is counted twice. Growth and the discount rate then show how the three years look as your code and salaries grow, and what the money is worth in today's terms.</p>
                <p><strong className="text-slate-800">Why a higher hourly rate can improve the result.</strong> The software costs the same whatever your seniors earn, but every hour AI frees or every backlog hour it clears is worth more. The As-Is panel shows how much more your current setup costs when salaries rise.</p>
                <p><strong className="text-slate-800">A common situation.</strong> A busy team with a large backlog adopts AI. The backlog shrinks a lot, but the seniors stay just as busy. The conservative ROI looks weak and the strategic ROI looks strong. Neither is wrong: the value is in risk and speed, not in cutting payroll.</p>
                <p className="text-xs text-slate-500">These are estimates to support a decision, based on the numbers you enter. They are not guarantees.</p>
              </div>
            </details>

          </div>
        </div>
      </div>

      {/* LEAD CAPTURE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1120]/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-6">
              <Rocket className="w-6 h-6 text-[#f52e01]" />
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 mb-2">Unlock PRO Analytics</h3>
            <p className="text-slate-600 mb-6">Subscribe to unlock the CFO Financial Split model, generate PDF reports, and write AI-driven Board Pitches.</p>
            <form onSubmit={handleUnlock} className="space-y-4">
              <input type="email" required value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} placeholder="alex@yourcompany.com" className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#f52e01] outline-none" />
              {leadError && <p className="text-sm text-red-600">{leadError}</p>}
              <button type="submit" disabled={leadSubmitting} className="w-full bg-[#f52e01] hover:bg-[#ff4117] disabled:opacity-60 text-white font-bold py-3 rounded-lg shadow-md transition-colors">{leadSubmitting ? 'Unlocking...' : 'Subscribe & Unlock Free'}</button>
            </form>
            <div className="mt-6 flex justify-between items-center text-xs text-slate-500">
               <span><Lock className="w-3 h-3 inline"/> 100% Secure.</span>
               <button onClick={() => setShowModal(false)} className="hover:text-slate-800 font-bold">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}