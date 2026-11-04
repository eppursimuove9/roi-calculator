import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
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
const signedMoney = (n) => `${n < 0 ? '-' : '+'}${fmtMoney(Math.abs(n))}`;
const fmtPct = (n) => (n === null || n === undefined || !isFinite(n) ? 'N/A' : `${Math.round(n).toLocaleString()}%`);

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

function SplitPanel({ title, subtitle, accent, hero, rows, locked = false, onUnlock }) {
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

const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function App() {
  // --- STATE AND VARIABLES (Current Inputs) ---
  const [devs, setDevs] = useState(12);
  const [locPerDev, setLocPerDev] = useState(1500);
  const [automation, setAutomation] = useState(0);
  const [seniors, setSeniors] = useState(3);
  const [dailyReviewHoursPerSenior, setDailyReviewHoursPerSenior] = useState(3);
  const [minsPer500, setMinsPer500] = useState(45);
  const [hourlyRate, setHourlyRate] = useState(90);
  
  // --- STATE AND VARIABLES (Target/AI Scenario) ---
  const [targetAutomation, setTargetAutomation] = useState(75);
  const [humanInTheLoop, setHumanInTheLoop] = useState(10); // % of AI reviews needing human override
  const [savingsRealizationRate, setSavingsRealizationRate] = useState(50);
  
  // Financials
  const [softwareCost, setSoftwareCost] = useState(45000);
  const [pricingModel, setPricingModel] = useState('saas'); // saas | tokens
  const [costPer1kLoc, setCostPer1kLoc] = useState(0.15);

  // --- PAYWALL STATE (Lead Capture) ---
  const [avoidedCostConfidence, setAvoidedCostConfidence] = useState(50); // % of avoided manual-review cost a CFO would accept
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
    hourlyRate, targetAutomation, humanInTheLoop, softwareCost, pricingModel, costPer1kLoc, savingsRealizationRate, avoidedCostConfidence
  ]);

  // --- LOGIC AND MATH CALCULATIONS (CFO-READY) ---
  const workingDaysPerYear = 230;

  // Demand
  const totalDailyLoc = devs * locPerDev;
  const rawReviewDemandHours = (totalDailyLoc / 500) * (minsPer500 / 60);
  
  // Capacity Limit
  const capacityHours = seniors * dailyReviewHoursPerSenior;

  // As-Is Scenario
  // Same human-in-the-loop rate is applied to current automation so both scenarios are comparable
  const asIsHitl = humanInTheLoop / 100;
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
  const annualTechDebtValue = techDebtClearedDailyHours * workingDaysPerYear * hourlyRate;
  const confidenceAdjustedAvoidedCost = annualTechDebtValue * (avoidedCostConfidence / 100);

  // Software Costing
  const annualLoc = totalDailyLoc * workingDaysPerYear;
  // Tokens are only consumed on the code the AI actually reviews
  const tokenAnnualCost = (annualLoc / 1000) * costPer1kLoc * toBeAiCoverage;
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

  // --- Three views: As-Is, To-Be, Combined. The Combined view is exactly To-Be minus As-Is. ---
  const asIsSeniorCost = asIsExecuted * workingDaysPerYear * hourlyRate;
  const asIsBacklogCost = asIsBacklog * workingDaysPerYear * hourlyRate;
  const toBeSeniorCost = asIsSeniorCost - realizedHardSavings; // after the share of freed time that becomes real savings
  const toBeTotalCost = toBeSeniorCost + calculatedSoftwareCost;
  const costChange = toBeTotalCost - asIsSeniorCost; // positive = costs more to operate
  const asIsLoad = capacityHours > 0 ? (asIsHumanDemand / capacityHours) * 100 : 0;
  const toBeLoad = capacityHours > 0 ? (toBeTotalHumanDemand / capacityHours) * 100 : 0;
  const asIsAiShare = rawReviewDemandHours > 0 ? (asIsNetAiHandled / rawReviewDemandHours) * 100 : 0;
  const toBeAiShare = rawReviewDemandHours > 0 ? (toBeNetAiHandled / rawReviewDemandHours) * 100 : 0;
  const backlogRemoved = Math.max(0, asIsBacklog - toBeBacklog);
  const backlogRemovedPct = asIsBacklog > 0 ? (backlogRemoved / asIsBacklog) * 100 : null;
  const strategicNetValue = strategicBenefit - calculatedSoftwareCost;
  const paybackText = paybackMonths === null ? 'N/A' : (paybackMonths >= 36 ? `${(paybackMonths / 12).toFixed(1)} yrs` : `${paybackMonths.toFixed(1)} mo`);
  const loadTone = (v) => (v > 100 ? 'text-red-400' : 'text-emerald-400');

  const asIsPanel = {
    title: 'As-Is', subtitle: 'What you live with today', accent: 'border-t-slate-400', pdfColor: [71, 85, 105],
    hero: { label: 'Yearly senior review cost', value: fmtMoney(asIsSeniorCost), note: 'What the review time your seniors actually spend costs you.' },
    rows: [
      { label: 'Review demand vs. capacity', value: fmtPct(asIsLoad), tone: loadTone(asIsLoad) },
      { label: 'Backlog per day', value: `${asIsBacklog.toFixed(1)} h`, tone: asIsBacklog > 0 ? 'text-red-400' : 'text-emerald-400' },
      { label: 'Cost to review the backlog by hand (yearly)', value: fmtMoney(asIsBacklogCost), tone: asIsBacklog > 0 ? 'text-amber-400' : 'text-white' },
      { label: 'Senior review hours per day', value: `${asIsExecuted.toFixed(1)} h` },
      { label: 'Reviews handled by AI', value: fmtPct(asIsAiShare) },
    ],
  };
  const toBePanel = {
    title: 'To-Be', subtitle: 'Where you want to get', accent: 'border-t-violet-500', pdfColor: [124, 58, 237],
    hero: { label: 'Total yearly operating cost', value: fmtMoney(toBeTotalCost), note: 'Senior review time plus the software.' },
    rows: [
      { label: 'Senior review cost (after expected savings)', value: fmtMoney(toBeSeniorCost) },
      { label: 'Software cost', value: fmtMoney(calculatedSoftwareCost) },
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
      { label: `Avoided review cost (${avoidedCostConfidence}% confidence, non-cash)`, value: `+${fmtMoney(confidenceAdjustedAvoidedCost)}`, tone: 'text-amber-400' },
      { label: 'Net value incl. avoided cost', value: signedMoney(strategicNetValue), tone: strategicNetValue < 0 ? 'text-red-400' : 'text-emerald-400' },
      { label: 'Conservative ROI', value: fmtPct(roiPercentage), tone: isNegativeRoi ? 'text-red-400' : 'text-emerald-400' },
      { label: 'Strategic ROI', value: fmtPct(strategicRoi), tone: isNegativeStrategic ? 'text-red-400' : 'text-emerald-400' },
      { label: 'Payback (hard savings only)', value: paybackText, tone: paybackMonths === null || isNegativeRoi ? 'text-red-400' : 'text-emerald-400' },
    ],
  };

  // --- CHART DATA (one bar per scenario; segments in SEGMENTS order) ---
  const r1 = (x) => Number(x.toFixed(1));
  const chartData = [
    { name: "Today (As-Is)", HumanReviewed: r1(asIsExecuted), UnusedCapacity: r1(Math.max(0, capacityHours - asIsExecuted)), Backlog: r1(asIsBacklog), AIHandled: r1(asIsNetAiHandled) },
    { name: "With AI (To-Be)", HumanReviewed: r1(toBeExecuted), UnusedCapacity: r1(Math.max(0, capacityHours - toBeExecuted)), Backlog: r1(toBeBacklog), AIHandled: r1(toBeNetAiHandled) },
  ];

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
    const top = startY + 16;
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

      [asIsPanel, toBePanel, combinedPanel].forEach((panel) => {
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 8,
          head: [[`${panel.title}: ${panel.subtitle}`, '']],
          body: [[panel.hero.label, panel.hero.value], ...panel.rows.map((r) => [r.label, r.value])],
          headStyles: { fillColor: panel.pdfColor },
          columnStyles: { 1: { halign: 'right' } },
        });
      });

      if (exportOpts.chart) {
        let y = doc.lastAutoTable.finalY + 12;
        if (y > 180) { doc.addPage(); y = 20; }
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
    const paybackStr = paybackMonths !== null ? `${paybackMonths.toFixed(1)} months` : 'Not recoverable via hard savings';
    const roiStr = roiPercentage !== null ? `${roiPercentage.toFixed(0)}%` : 'N/A';

    let prompt = "";
    if (type === 'pitch') {
      prompt = `Based on the following Verification Tax operational data, write an executive pitch (maximum 3 key bullet points) for the board of directors regarding an investment of $${calculatedSoftwareCost.toLocaleString()} USD in Agentic CI/CD tools (${costTypeStr}).
      
      Current Operational Risks:
      - We are accumulating a daily backlog of ${asIsBacklog.toFixed(1)} hours of unreviewed code because human capacity is capped at ${capacityHours} hrs/day.
      
      Target Scenario Value:
      - Avoided cost (NOT cash): clearing the backlog avoids roughly $${annualTechDebtValue.toLocaleString()} USD/year of manual review effort; a conservative ${avoidedCostConfidence}% confidence view is $${confidenceAdjustedAvoidedCost.toLocaleString()} USD.
      - Strategic ROI (hard savings + confidence-adjusted avoided cost): ${strategicRoi !== null ? strategicRoi.toFixed(0) + '%' : 'N/A'}.
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
      2. The investment avoids about $${annualTechDebtValue.toLocaleString()} USD/year of manual review effort on the backlog (non-cash; ${avoidedCostConfidence}% confidence view: $${confidenceAdjustedAvoidedCost.toLocaleString()} USD). Strategic ROI: ${strategicRoi !== null ? strategicRoi.toFixed(0) + '%' : 'N/A'}.
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
            
            {/* CURRENT SCENARIO */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold flex items-center gap-2 border-b pb-4 mb-6 text-slate-800">
                <Users className="w-5 h-5 text-slate-500" /> Current Operations (As-Is)
              </h2>
              <div className="space-y-6">
                <ControlSlider label="Active Developers" value={devs} min={1} max={500} setter={setDevs} tooltip="Developers whose code gets reviewed." />
                <ControlSlider label="LOC per Dev / Day" value={locPerDev} min={100} max={15000} step={100} setter={setLocPerDev} tooltip="Lines of code each developer writes or changes per day." />
                
                <div className="pt-4 border-t border-slate-100 space-y-6">
                  <ControlSlider label="Senior Engineers" value={seniors} min={1} max={100} setter={setSeniors} tooltip="Engineers who spend time reviewing other people's code." />
                  <ControlSlider 
                    label="Review Hrs / Senior / Day" value={dailyReviewHoursPerSenior} min={0.5} max={8} step={0.5} setter={setDailyReviewHoursPerSenior} suffix="h" tooltip="Hours per day each senior can give to reviews, not their whole workday." />
                  <ControlSlider label="Mins to audit 500 LOC" value={minsPer500} min={5} max={120} step={5} setter={setMinsPer500} suffix="m" tooltip="Time a senior needs to properly review 500 lines." />
                  <ControlSlider label="Senior Hourly Rate" value={hourlyRate} min={30} max={500} step={5} setter={setHourlyRate} prefix="$" tooltip="Full hourly cost of a senior engineer." />
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

                <ControlSlider 
                  label="Savings Realization Rate" value={savingsRealizationRate} min={0} max={100} step={5} setter={setSavingsRealizationRate} suffix="%" tooltip="How much of the freed time turns into real money saved." />

                {/* PRICING MODEL SELECTOR */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-4 mb-2">Software Cost Model</div>
                  <div className="flex gap-2 bg-slate-200 p-1 rounded-lg mb-4">
                    <button onClick={() => setPricingModel('saas')} className={`flex-1 text-xs font-bold py-2 rounded transition-all ${pricingModel === 'saas' ? 'bg-white text-slate-900 shadow-sm border border-slate-300' : 'text-slate-500 hover:text-slate-700'}`}>SaaS License</button>
                    <button onClick={() => setPricingModel('tokens')} className={`flex-1 text-xs font-bold py-2 rounded transition-all ${pricingModel === 'tokens' ? 'bg-white text-slate-900 shadow-sm border border-slate-300' : 'text-slate-500 hover:text-slate-700'}`}>API Tokens</button>
                  </div>
                  
                  {pricingModel === 'saas' ? (
                    <ControlSlider label="Annual Software Cost" value={softwareCost} min={0} max={1000000} step={1000} setter={setSoftwareCost} prefix="$" tooltip="What the AI tool costs per year." />
                  ) : (
                    <div className="space-y-4">
                      <ControlSlider label="Inference Cost (per 1k LOC)" value={costPer1kLoc} min={0.01} max={5.00} step={0.01} setter={setCostPer1kLoc} prefix="$" tooltip="What the AI charges per 1,000 lines it reviews." />
                      <div className="bg-slate-100 p-3 rounded-lg border border-slate-200 flex justify-between items-center shadow-inner">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1"><Rocket className="w-3 h-3" /> Annual API Cost</span>
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
              <p className="text-slate-400 text-xs mb-5">All money figures are per year. Read left to right: where you are, where you want to be, and what the change adds up to.</p>
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

            {/* EXPORT PANEL */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Download className="w-5 h-5 text-slate-700" /> Export report (PDF)</h3>
                  <p className="text-sm text-slate-500 mt-1">Includes your assumptions and results. Choose what else to add.</p>
                </div>
                <button
                  onClick={() => isUnlocked ? handleDownloadPDF() : setShowModal(true)}
                  disabled={isGeneratingPdf}
                  className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold border shrink-0 ${isUnlocked ? 'bg-[#0B1120] text-white border-[#0B1120] hover:bg-slate-800' : 'bg-orange-50 text-[#f52e01] border-orange-200 hover:bg-orange-100'}`}
                >
                  {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : (isUnlocked ? <Download className="w-4 h-4" /> : <Lock className="w-4 h-4" />)}
                  {isGeneratingPdf ? 'Generating PDF...' : (isUnlocked ? 'Download PDF' : 'Unlock Export')}
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={exportOpts.chart} onChange={(e) => setExportOpts(o => ({ ...o, chart: e.target.checked }))} className="accent-[#f52e01]" /> Include chart
                </label>
                <label className={`flex items-center gap-2 ${aiSummaries.pitch ? 'cursor-pointer' : 'opacity-50'}`}>
                  <input type="checkbox" disabled={!aiSummaries.pitch} checked={exportOpts.pitch && !!aiSummaries.pitch} onChange={(e) => setExportOpts(o => ({ ...o, pitch: e.target.checked }))} className="accent-[#f52e01]" />
                  Include Board Pitch {!aiSummaries.pitch && <span className="text-xs text-slate-500">(generate it above first)</span>}
                </label>
                <label className={`flex items-center gap-2 ${aiSummaries.email ? 'cursor-pointer' : 'opacity-50'}`}>
                  <input type="checkbox" disabled={!aiSummaries.email} checked={exportOpts.email && !!aiSummaries.email} onChange={(e) => setExportOpts(o => ({ ...o, email: e.target.checked }))} className="accent-[#f52e01]" />
                  Include CFO Email {!aiSummaries.email && <span className="text-xs text-slate-500">(generate it above first)</span>}
                </label>
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
                <p><strong className="text-slate-800">Two ROI numbers, on purpose.</strong> The conservative one counts only real savings and is the one a finance team will trust. The strategic one also counts avoided cost and shows the fuller picture. Showing both keeps the case honest.</p>
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