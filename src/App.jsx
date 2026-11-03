import React, { useState, useEffect } from 'react';
import { BarChart, Bar, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertTriangle, TrendingUp, Users, Lock, Download, ChevronRight, Info, Sparkles, Loader2, Mail, FileText, RefreshCw, Target, Rocket, PieChart } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- UTILITIES ---
const clamp = (value, min, max) => {
  if (isNaN(value) || !isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
};

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
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // --- AI STATE (Gemini API with Cache) ---
  const [aiSummaries, setAiSummaries] = useState({ pitch: "", email: "" });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [activeAiTab, setActiveAiTab] = useState("pitch"); 
  
  // --- PDF STATE ---
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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
    hourlyRate, targetAutomation, humanInTheLoop, softwareCost, pricingModel, costPer1kLoc, savingsRealizationRate
  ]);

  // --- LOGIC AND MATH CALCULATIONS (CFO-READY) ---
  const workingDaysPerYear = 230;

  // Demand
  const totalDailyLoc = devs * locPerDev;
  const rawReviewDemandHours = (totalDailyLoc / 500) * (minsPer500 / 60);
  
  // Capacity Limit
  const capacityHours = seniors * dailyReviewHoursPerSenior;

  // As-Is Scenario
  const asIsHumanDemand = rawReviewDemandHours * (1 - (automation / 100));
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
  const annualTechDebtValue = techDebtClearedDailyHours * workingDaysPerYear * hourlyRate;

  // Software Costing
  const annualLoc = totalDailyLoc * workingDaysPerYear;
  const tokenAnnualCost = (annualLoc / 1000) * costPer1kLoc;
  const calculatedSoftwareCost = pricingModel === 'saas' ? softwareCost : tokenAnnualCost;

  // ROI & Payback (Calculated strictly on Hard Savings)
  const netAnnualBenefit = realizedHardSavings - calculatedSoftwareCost;
  const roiPercentage = calculatedSoftwareCost > 0 ? (netAnnualBenefit / calculatedSoftwareCost) * 100 : null;
  const paybackMonths = realizedHardSavings > 0 ? (calculatedSoftwareCost / realizedHardSavings) * 12 : null;
  const isNegativeRoi = roiPercentage !== null && roiPercentage < 0;

  // --- CHART DATA (Capacity vs Demand Stacked Bar) ---
  const chartData = [
    { 
      name: "Current (As-Is)", 
      HumanExecuted: Number(asIsExecuted.toFixed(1)), 
      Backlog: Number(asIsBacklog.toFixed(1)), 
      AIHandled: 0 
    },
    { 
      name: "Optimized (To-Be)", 
      HumanExecuted: Number(toBeExecuted.toFixed(1)), 
      Backlog: Number(toBeBacklog.toFixed(1)), 
      AIHandled: Number(toBeNetAiHandled.toFixed(1)) 
    }
  ];

  const handleUnlock = (e) => {
    e.preventDefault();
    setIsUnlocked(true);
    setShowModal(false);
  };

  // --- PDF EXPORT FUNCTION ---
  const handleDownloadPDF = () => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF();
      const timestamp = new Date().toLocaleDateString();

      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text("Business Case: Verification Tax ROI", 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${timestamp}`, 14, 30);
      doc.text("Confidential ROI Analysis Report - The Predictive Engine", 14, 35);

      autoTable(doc, {
        startY: 45,
        head: [['Operational Metric', 'As-Is', 'To-Be']],
        body: [
          ['Daily Human Demand', `${asIsHumanDemand.toFixed(1)}h`, `${toBeTotalHumanDemand.toFixed(1)}h`],
          ['Daily Human Executed', `${asIsExecuted.toFixed(1)}h`, `${toBeExecuted.toFixed(1)}h`],
          ['Daily Tech Debt (Backlog)', `${asIsBacklog.toFixed(1)}h`, `${toBeBacklog.toFixed(1)}h`]
        ],
        headStyles: { fillColor: [15, 23, 42] },
      });

      const finalY = doc.lastAutoTable.finalY || 45;
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("Financial Impact Summary", 14, finalY + 15);

      const roiStr = roiPercentage !== null ? `${roiPercentage.toFixed(0)}%` : 'N/A';
      const paybackStr = paybackMonths !== null ? `${paybackMonths.toFixed(1)} Months` : 'N/A';

      autoTable(doc, {
        startY: finalY + 20,
        head: [['Financial Indicator', 'Calculated Value']],
        body: [
          ['Realized Hard Capacity Savings', `$${realizedHardSavings.toLocaleString(undefined, {maximumFractionDigits: 0})}`],
          ['Risk Mitigation Value (Debt Cleared)', `$${annualTechDebtValue.toLocaleString(undefined, {maximumFractionDigits: 0})}`],
          ['Calculated Annual Software Cost', `$${calculatedSoftwareCost.toLocaleString(undefined, {maximumFractionDigits: 0})}`],
          ['Projected ROI (Hard Savings Only)', `${roiStr}`],
          ['Payback Period', `${paybackStr}`],
        ],
        headStyles: { fillColor: [245, 46, 1] }, 
      });

      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("Powered by The Predictive Engine PRO - ROI Verification Tax Simulator", 14, 285);

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
    let formatted = text
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
      - Risk Mitigation: The AI will clear $${annualTechDebtValue.toLocaleString()} USD in annualized technical debt risk.
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
      2. The investment eradicates $${annualTechDebtValue.toLocaleString()} USD in unreviewed risk annually.
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

  // --- CONTROL COMPONENT (SLIDER + INPUT) ---
  const ControlSlider = ({ 
    label, value, min, max, step = 1, setter, suffix = "", prefix = "", tooltip, 
    highlightClass = "text-slate-700 bg-slate-50 border-slate-200 focus:ring-slate-500", 
    accentClass = "accent-slate-600" 
  }) => {
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
            {tooltip && <span title={tooltip} className="cursor-help text-slate-400 hover:text-slate-600"><Info className="w-4 h-4"/></span>}
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
            Model technical debt eradication. Separate "Hard Cash Savings" from "Risk Mitigation" to build a bulletproof CFO-ready business case for Agentic CI/CD platforms.
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
                <ControlSlider label="Active Developers" value={devs} min={1} max={500} setter={setDevs} />
                <ControlSlider label="LOC per Dev / Day" value={locPerDev} min={100} max={15000} step={100} setter={setLocPerDev} />
                
                <div className="pt-4 border-t border-slate-100 space-y-6">
                  <ControlSlider label="Senior Engineers" value={seniors} min={1} max={100} setter={setSeniors} />
                  <ControlSlider 
                    label="Review Hrs / Senior / Day" value={dailyReviewHoursPerSenior} min={0.5} max={8} step={0.5} setter={setDailyReviewHoursPerSenior} suffix="h"
                    tooltip="Max daily hours a senior can dedicate to manual code review."
                  />
                  <ControlSlider label="Mins to audit 500 LOC" value={minsPer500} min={5} max={120} step={5} setter={setMinsPer500} suffix="m" />
                  <ControlSlider label="Senior Hourly Rate" value={hourlyRate} min={30} max={500} step={5} setter={setHourlyRate} prefix="$" />
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
                  highlightClass="text-[#f52e01] bg-orange-50 border-orange-200 focus:ring-orange-500" accentClass="accent-[#f52e01]"
                />
                
                <ControlSlider 
                  label="Human-in-the-Loop Override" value={humanInTheLoop} min={0} max={100} step={1} setter={setHumanInTheLoop} suffix="%"
                  highlightClass="text-amber-700 bg-amber-50 border-amber-200" accentClass="accent-amber-500"
                  tooltip="Percentage of AI-reviewed code that fails or requires human manual correction."
                />

                <ControlSlider 
                  label="Savings Realization Rate" value={savingsRealizationRate} min={0} max={100} step={5} setter={setSavingsRealizationRate} suffix="%"
                  tooltip="Percentage of freed human capacity converted into liquid cash savings."
                />

                {/* PRICING MODEL SELECTOR */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-4 mb-2">Software Cost Model</div>
                  <div className="flex gap-2 bg-slate-200 p-1 rounded-lg mb-4">
                    <button onClick={() => setPricingModel('saas')} className={`flex-1 text-xs font-bold py-2 rounded transition-all ${pricingModel === 'saas' ? 'bg-white text-slate-900 shadow-sm border border-slate-300' : 'text-slate-500 hover:text-slate-700'}`}>SaaS License</button>
                    <button onClick={() => setPricingModel('tokens')} className={`flex-1 text-xs font-bold py-2 rounded transition-all ${pricingModel === 'tokens' ? 'bg-white text-slate-900 shadow-sm border border-slate-300' : 'text-slate-500 hover:text-slate-700'}`}>API Tokens</button>
                  </div>
                  
                  {pricingModel === 'saas' ? (
                    <ControlSlider label="Annual Software Cost" value={softwareCost} min={0} max={1000000} step={1000} setter={setSoftwareCost} prefix="$" />
                  ) : (
                    <div className="space-y-4">
                      <ControlSlider label="Inference Cost (per 1k LOC)" value={costPer1kLoc} min={0.01} max={5.00} step={0.01} setter={setCostPer1kLoc} prefix="$" />
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
          <div className="xl:col-span-8 space-y-6">
            
            {/* OPERATING METRICS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Total Daily Demand</div>
                <div className="text-3xl font-black text-slate-900">{asIsHumanDemand.toFixed(1)} <span className="text-lg text-slate-400">h</span></div>
                <div className="text-sm text-slate-500 mt-1">Review hours required</div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-b-4 border-b-emerald-500">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Human Capacity Limit</div>
                <div className="text-3xl font-black text-slate-900">{capacityHours.toFixed(1)} <span className="text-lg text-slate-400">h</span></div>
                <div className="text-sm text-slate-500 mt-1">Maximum operational limit</div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-b-4 border-b-[#f52e01]">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Daily Tech Debt (Backlog)</div>
                <div className="text-3xl font-black text-slate-900">{asIsBacklog.toFixed(1)} <span className="text-lg text-slate-400">h</span></div>
                <div className="text-sm text-slate-500 mt-1">Unreviewed risk per day</div>
              </div>
            </div>

            {/* PREMIUM METRICS (PAYWALL) */}
            <div className="relative overflow-hidden bg-[#0B1120] rounded-2xl shadow-lg border border-[#1E2D4A]">
              <div className={`p-6 lg:p-8 transition-all duration-500 ${!isUnlocked ? 'blur-md opacity-40' : ''}`}>
                
                <div className="text-white text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-[#f52e01]" /> Financial Splits (CFO Ready)
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#111A2E] p-4 rounded-xl border border-[#1E2D4A] border-b-2 border-b-blue-500">
                    <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">Hard Capacity Savings</div>
                    <div className="text-xl font-black text-white">+${realizedHardSavings.toLocaleString(undefined, {maximumFractionDigits:0})}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Real cash/time freed</div>
                  </div>
                  <div className="bg-[#111A2E] p-4 rounded-xl border border-[#1E2D4A] border-b-2 border-b-amber-500">
                    <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">Risk Mitigation Value</div>
                    <div className="text-xl font-black text-amber-400">+${annualTechDebtValue.toLocaleString(undefined, {maximumFractionDigits:0})}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Tech debt cleared</div>
                  </div>
                  <div className={`bg-[#111A2E] p-4 rounded-xl border border-[#1E2D4A] border-b-2 ${isNegativeRoi ? 'border-b-red-500' : 'border-b-emerald-500'}`}>
                    <div className="text-slate-400 text-[10px] font-bold uppercase mb-1 flex justify-between">
                       Hard ROI {isNegativeRoi && <span className="text-red-400">Negative</span>}
                    </div>
                    <div className={`text-xl font-black ${isNegativeRoi ? 'text-red-400' : 'text-emerald-400'}`}>
                      {roiPercentage !== null ? `${roiPercentage.toFixed(0)}%` : 'N/A'}
                    </div>
                  </div>
                  <div className={`bg-[#111A2E] p-4 rounded-xl border border-[#1E2D4A] border-b-2 ${paybackMonths === null || isNegativeRoi ? 'border-b-red-500' : 'border-b-emerald-500'}`}>
                    <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">Payback Period</div>
                    <div className={`text-xl font-black ${paybackMonths === null || isNegativeRoi ? 'text-red-400' : 'text-emerald-400'}`}>
                      {paybackMonths !== null ? `${paybackMonths.toFixed(1)} mo` : 'N/A'}
                    </div>
                  </div>
                </div>

              </div>
              
              {!isUnlocked && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B1120]/70 z-10 p-6 text-center backdrop-blur-sm">
                  <Lock className="w-12 h-12 text-[#f52e01] mb-4 drop-shadow-lg" />
                  <h4 className="text-2xl font-extrabold text-white mb-2">Unlock True CFO Metrics</h4>
                  <p className="text-slate-300 text-sm mb-6 max-w-md">Split ROI into "Hard Savings" vs "Risk Mitigation" to build a bulletproof business case.</p>
                  <button onClick={() => setShowModal(true)} className="bg-[#f52e01] hover:bg-[#ff4117] text-white font-bold py-3 px-8 rounded-xl shadow-xl flex items-center gap-2">
                    Unlock Pro Analytics <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* STACKED BAR CHART (CAPACITY VS DEMAND) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-96 flex flex-col relative overflow-hidden">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-slate-700" /> Capacity vs. Demand Analysis
                  </h3>
                </div>
                <button 
                  onClick={() => isUnlocked ? handleDownloadPDF() : setShowModal(true)}
                  disabled={isGeneratingPdf}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold border ${isUnlocked ? 'bg-slate-50 hover:bg-slate-100 border-slate-200' : 'bg-orange-50 text-[#f52e01] border-orange-200 hover:bg-orange-100'}`}
                >
                  {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : (isUnlocked ? <Download className="w-4 h-4" /> : <Lock className="w-4 h-4" />)}
                  {isGeneratingPdf ? 'Generating PDF...' : (isUnlocked ? 'Export' : 'Unlock Export')}
                </button>
              </div>

              <div className={`flex-1 w-full h-full min-h-[200px] ${!isUnlocked ? 'opacity-30 pointer-events-none' : ''}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontWeight: 'bold', fill: '#0B1120'}}/>
                    <YAxis label={{ value: 'Hours / Day', angle: -90, position: 'insideLeft', fill: '#64748b' }} axisLine={false} tickLine={false}/>
                    <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', fontWeight: 'bold', border: '1px solid #e2e8f0'}} />
                    <Legend />
                    {/* The critical operational limit line */}
                    <ReferenceLine y={capacityHours} stroke="#10b981" strokeWidth={3} strokeDasharray="4 4" label={{ position: 'top', value: 'Human Capacity Limit', fill: '#10b981', fontWeight: 'bold' }} />
                    
                    <Bar dataKey="HumanExecuted" stackId="a" fill="#3b82f6" name="Human Review Hrs" maxBarSize={100} />
                    <Bar dataKey="Backlog" stackId="a" fill="#ef4444" name="Unreviewed Risk (Backlog)" radius={[4, 4, 0, 0]} maxBarSize={100} />
                    <Bar dataKey="AIHandled" stackId="b" fill="#8b5cf6" name="AI Handled Hrs" radius={[4, 4, 0, 0]} maxBarSize={100} />
                  </BarChart>
                </ResponsiveContainer>
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
                        <p className="text-slate-400 text-sm italic">Generate a CFO-ready business case outlining hard savings vs risk mitigation.</p>
                        <button onClick={() => executeAIGeneration(activeAiTab)} className="bg-[#0B1120] hover:bg-slate-800 text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Sparkles className="w-4 h-4"/> Generate Draft</button>
                     </div>
                   )}
                </div>
              </div>
            )}
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
              <input type="email" required placeholder="alex@yourcompany.com" className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#f52e01] outline-none" />
              <button type="submit" className="w-full bg-[#f52e01] hover:bg-[#ff4117] text-white font-bold py-3 rounded-lg shadow-md transition-colors">Subscribe & Unlock Free</button>
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