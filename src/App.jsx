import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertTriangle, CheckCircle, TrendingUp, DollarSign, Clock, Users, Lock, Download, ChevronRight, Info, Sparkles, Loader2, Mail, FileText, Calendar, Target, Rocket, PieChart, RefreshCw } from 'lucide-react';

// --- UTILITIES ---
const clamp = (value, min, max) => {
  if (isNaN(value) || !isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
};

export default function App() {
  // --- STATE AND VARIABLES (Current Inputs) ---
  const [devs, setDevs] = useState(12);
  const [locPerDev, setLocPerDev] = useState(1500);
  const [automation, setAutomation] = useState(20);
  const [seniors, setSeniors] = useState(3);
  const [dailyReviewHoursPerSenior, setDailyReviewHoursPerSenior] = useState(3);
  const [minsPer500, setMinsPer500] = useState(45);
  const [hourlyRate, setHourlyRate] = useState(90);
  
  // --- STATE AND VARIABLES (Target Scenario & ROI) ---
  const [targetAutomation, setTargetAutomation] = useState(75);
  const [softwareCost, setSoftwareCost] = useState(45000);
  const [pricingModel, setPricingModel] = useState('saas'); // 'saas' | 'tokens'
  const [costPer1kLoc, setCostPer1kLoc] = useState(0.15);
  const [savingsRealizationRate, setSavingsRealizationRate] = useState(50);

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

  // --- TARGET AUTOMATION SYNCHRONIZATION ---
  // Target automation can never be lower than current automation.
  useEffect(() => {
    setTargetAutomation((prev) => Math.max(prev, automation));
  }, [automation]);

  // --- AI CACHE INVALIDATION ---
  // Clear generated texts if any input changes to avoid outdated data
  useEffect(() => {
    setAiSummaries({ pitch: "", email: "" });
    setAiError("");
  }, [
    devs, locPerDev, automation, seniors, dailyReviewHoursPerSenior, minsPer500, 
    hourlyRate, targetAutomation, softwareCost, pricingModel, costPer1kLoc, savingsRealizationRate
  ]);

  // --- LOGIC AND MATH CALCULATIONS ---
  const workingDaysPerYear = 230;

  // 1. Demand
  const totalDailyLoc = devs * locPerDev;
  const rawReviewDemandHours = (totalDailyLoc / 500) * (minsPer500 / 60);
  
  const currentReviewDemandHours = rawReviewDemandHours * (1 - automation / 100);
  const targetReviewDemandHours = rawReviewDemandHours * (1 - targetAutomation / 100);

  // 2. Capacity and Backlog
  const seniorHoursAvailable = seniors * dailyReviewHoursPerSenior;
  
  const currentDailyBacklog = Math.max(0, currentReviewDemandHours - seniorHoursAvailable);
  const targetDailyBacklog = Math.max(0, targetReviewDemandHours - seniorHoursAvailable);

  const currentExecutedReviewHours = Math.min(currentReviewDemandHours, seniorHoursAvailable);

  // 3. Economic Valuation
  const currentAnnualVerificationValue = currentReviewDemandHours * workingDaysPerYear * hourlyRate;
  const currentWeeklyVerificationValue = currentReviewDemandHours * 5 * hourlyRate;

  // 4. Benefits and ROI
  const annualReleasedHours = Math.max(0, currentReviewDemandHours - targetReviewDemandHours) * workingDaysPerYear;
  const annualCapacityValue = annualReleasedHours * hourlyRate; // Potential capacity value
  const realizedAnnualSavings = annualCapacityValue * (savingsRealizationRate / 100); // Realizable financial savings

  const annualLoc = totalDailyLoc * workingDaysPerYear;
  const tokenAnnualCost = (annualLoc / 1000) * costPer1kLoc;
  const calculatedSoftwareCost = pricingModel === 'saas' ? softwareCost : tokenAnnualCost;

  const netAnnualBenefit = realizedAnnualSavings - calculatedSoftwareCost;
  
  // Handling null/negative financial variables
  const roiPercentage = calculatedSoftwareCost > 0 ? (netAnnualBenefit / calculatedSoftwareCost) * 100 : null;
  const paybackMonths = realizedAnnualSavings > 0 ? (calculatedSoftwareCost / realizedAnnualSavings) * 12 : null;

  // --- CHART DATA (5-day A/B Projection) ---
  const chartData = [
    { name: 'Mon', backlog: currentDailyBacklog * 1, targetBacklog: targetDailyBacklog * 1 },
    { name: 'Tue', backlog: currentDailyBacklog * 2, targetBacklog: targetDailyBacklog * 2 },
    { name: 'Wed', backlog: currentDailyBacklog * 3, targetBacklog: targetDailyBacklog * 3 },
    { name: 'Thu', backlog: currentDailyBacklog * 4, targetBacklog: targetDailyBacklog * 4 },
    { name: 'Fri', backlog: currentDailyBacklog * 5, targetBacklog: targetDailyBacklog * 5 },
  ];

  const handleUnlock = (e) => {
    e.preventDefault();
    setIsUnlocked(true);
    setShowModal(false);
  };

  // --- PDF EXPORT FUNCTION ---
  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      if (!window.html2pdf) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      window.scrollTo(0, 0);
      const element = document.getElementById('pdf-report-container');
      
      const opt = {
        margin:       0.4,
        filename:     'ROI_Report_Verification_Tax.pdf',
        image:        { type: 'jpeg', quality: 1 },
        html2canvas:  { scale: 2, useCORS: true, scrollY: 0, logging: false },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await window.html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("There was an error generating the PDF. Please check your connection and try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // --- MARKDOWN PARSER ---
  const formatAIResponse = (text) => {
    if (!text) return "";
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-indigo-900">$1</strong>')
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
  const fetchWithRetry = async (url, options, retries = 5) => {
    const delays = [1000, 2000, 4000, 8000, 16000];
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delays[i]));
      }
    }
  };

  const executeAIGeneration = async (type) => {
    setAiLoading(true);
    setAiError("");
    
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    // NUEVO: Validación de seguridad
    if (!apiKey) {
      setAiError("La API Key no está configurada en Vercel. Asegúrate de agregar VITE_GEMINI_API_KEY en Settings.");
      setAiLoading(false);
      return;
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const costTypeStr = pricingModel === 'saas' ? 'CAPEX (Flat-rate Licenses)' : 'OPEX (API/Tokens Consumption)';
    const paybackStr = paybackMonths !== null ? `${paybackMonths.toFixed(1)} months` : 'Not recoverable under current assumptions';
    const roiStr = roiPercentage !== null ? `${roiPercentage.toFixed(0)}%` : 'N/A';
    
    const isNegativeCase = (roiPercentage !== null && roiPercentage < 0) || paybackMonths === null;

    let prompt = "";
    if (type === 'pitch') {
      prompt = `Based on the following operational and financial data from my engineering team, write an executive pitch (maximum 3 key bullet points) for the board of directors regarding an investment of $${calculatedSoftwareCost.toLocaleString()} USD in Agentic CI/CD tools (${costTypeStr}).
      
      Current Risk Metrics:
      - Technical Debt Backlog: Accumulating ${currentDailyBacklog.toFixed(1)} daily hours of unattended code review.
      - Annual Verification Burden Value: $${currentAnnualVerificationValue.toLocaleString()} USD (equivalent capacity cost).
      
      Target Scenario & ROI Metrics:
      - Savings Realization Rate: ${savingsRealizationRate}%.
      - Potential Released Capacity Value: $${annualCapacityValue.toLocaleString()} USD.
      - Realizable Financial Savings: $${realizedAnnualSavings.toLocaleString()} USD.
      - Return on Investment (ROI): ${roiStr}.
      - Payback Period: ${paybackStr}.
      - Net Annual Benefit: $${netAnnualBenefit.toLocaleString()} USD.
      
      ${isNegativeCase ? 
        'CRITICAL NOTE: The ROI is negative or null under current realization assumptions. The pitch must not invent a false positive case. It must state that the current investment is not financially recovered with the current realization rate, suggesting evaluating the adoption from the perspective of critical technical debt mitigation or adjusting the cost strategy.' : 
        `The tone should be that of a CTO or strategic consultant (The Predictive Engine). Focus on how this investment pays for itself in ${paybackStr} through realizable savings, and how it allows reallocating senior talent towards value creation.`}
      Be direct, persuasive, and precise with the metrics. Do not use the terms "Sunk cost" or "Lost money". The output must be in English.`;
    } else if (type === 'email') {
      prompt = `Act as a B2B Engineering Director. Write a formal and direct email addressed to the CFO requesting a budget of $${calculatedSoftwareCost.toLocaleString()} USD (${costTypeStr}) to acquire code review automation (Agentic CI/CD).
      
      Exact financial data:
      1. The Annual Verification Burden Value (manual review) is $${currentAnnualVerificationValue.toLocaleString()} USD.
      2. The investment will release capacity worth $${annualCapacityValue.toLocaleString()} USD. Applying our realization rate of ${savingsRealizationRate}%, the realizable financial savings are $${realizedAnnualSavings.toLocaleString()} USD.
      3. Net Annual Benefit: $${netAnnualBenefit.toLocaleString()} USD.
      4. Payback Period: ${paybackStr}. Projected ROI: ${roiStr}.
      
      ${isNegativeCase ? 
        'IMPORTANT: The ROI is negative. The email must be transparent with the CFO, indicating that although the pure financial ROI is not currently favorable, the investment should be evaluated based on the urgency to reduce the technical debt backlog or alleviate senior capacity, without dressing up the numbers.' : 
        'The email should have a clear Subject, be structured, and focus 100% on the business case and capital efficiency.'}
      Eliminate hyper-technical jargon. Do not use terms like "capital leak" or "sunk cost". The output must be in English.`;
    }

    try {
      const result = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: {
            parts: [{ text: "You are an executive consultant specializing in Revenue Operations, DevOps, and B2B finance. You communicate concisely, analytically, and oriented towards the financial truth of operating models. Use bullet points and bold text to highlight metrics. Never invent savings metrics that are not in the prompt. Do not guarantee cash savings if the realization rate does not support it." }]
          }
        })
      });

      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        setAiSummaries(prev => ({ ...prev, [type]: text }));
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
    highlightClass = "text-blue-700 bg-blue-50 border-blue-200 focus:ring-blue-500", 
    accentClass = "accent-blue-600" 
  }) => {
    
    const [inputValue, setInputValue] = useState(value.toString());

    // Sync text input if value changes externally
    useEffect(() => {
      setInputValue(value.toString());
    }, [value]);

    const handleInputChange = (e) => {
      setInputValue(e.target.value);
    };

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
              type="number" 
              value={inputValue}
              min={min}
              max={max}
              step={step}
              onChange={handleInputChange} 
              onBlur={handleInputBlur}
              className={`w-24 text-right font-bold border rounded px-2 py-1 outline-none focus:ring-2 transition-all ${highlightClass}`}
            />
            {suffix && <span className="text-slate-500 font-semibold ml-1">{suffix}</span>}
          </div>
        </div>
        <input 
          type="range" min={min} max={max} step={step} 
          value={value} 
          onChange={handleSliderChange} 
          className={`w-full cursor-pointer ${accentClass}`} 
        />
      </div>
    );
  };

  return (
    // FIX: Se añade overflow-x-hidden para matar el scroll horizontal
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-200 pb-12 overflow-x-hidden">
      
      {/* Top Navbar */}
      <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          {/* FIX: Estilo en línea forzado para evitar el logo gigante si el CSS se demora */}
          <img 
            src="https://media.beehiiv.com/cdn-cgi/image/format=auto,onerror=redirect/uploads/asset/file/412cff10-d6bf-4948-93cb-9626504d550b/Gemini_Generated_Image_hgi88jhgi88jhgi8-ezremove.png" 
            alt="The Predictive Engine Logo" 
            className="w-10 h-10 mix-blend-screen object-contain"
            style={{ width: '40px', height: '40px', flexShrink: 0 }}
          />
          <span className="font-bold tracking-wide text-lg hidden sm:inline-block">The Predictive Engine <span className="text-blue-400 font-light">PRO</span></span>
        </div>
        <button 
          onClick={() => !isUnlocked && setShowModal(true)}
          className={`text-sm px-4 py-2 rounded-md transition-colors border ${isUnlocked ? 'bg-blue-600 border-blue-500 text-white shadow-sm' : 'bg-slate-800 hover:bg-slate-700 border-slate-700'}`}
        >
          {isUnlocked ? 'Pro Account Active' : 'Sign In'}
        </button>
      </div>

      {/* Main Container - FIX: Ya tiene max-w-7xl mx-auto, ahora funcionará perfecto con el overflow oculto del padre */}
      <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
        
        {/* Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-widest mb-2">
            Business Case Simulator
          </div>
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900">
            ROI Calculator: <span className="text-blue-600">Verification Tax</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-4xl">
            Model the technical demand generated by AI adoption. Evaluate A/B scenarios and generate a business case based on capacity value and realizable savings to justify Agentic CI/CD platforms.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Controls */}
          <div className="xl:col-span-4 space-y-6">
            
            {/* CURRENT SCENARIO */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold flex items-center gap-2 border-b pb-4 mb-6 text-slate-800">
                <Users className="w-5 h-5 text-slate-500" />
                Current Scenario (As-Is)
              </h2>
              <div className="space-y-6">
                <ControlSlider label="Active Developers" value={devs} min={1} max={500} setter={setDevs} />
                <ControlSlider label="LOC per Dev / Day" value={locPerDev} min={100} max={15000} step={100} setter={setLocPerDev} />
                <ControlSlider label="Current Agentic CI/CD" value={automation} min={0} max={100} setter={setAutomation} suffix="%" />
                
                <div className="pt-4 border-t border-slate-100 space-y-6">
                  <ControlSlider label="Senior Engineers" value={seniors} min={1} max={100} setter={setSeniors} />
                  <ControlSlider 
                    label="Review Hours per Senior / Day" 
                    value={dailyReviewHoursPerSenior} 
                    min={0.5} max={8} step={0.5} 
                    setter={setDailyReviewHoursPerSenior} suffix="h"
                    tooltip="Average daily hours each senior engineer can dedicate to manual code review."
                  />
                  <ControlSlider label="Mins to audit 500 LOC" value={minsPer500} min={5} max={120} step={5} setter={setMinsPer500} suffix="m" />
                  <ControlSlider label="Senior Hourly Rate" value={hourlyRate} min={30} max={500} step={5} setter={setHourlyRate} prefix="$" />
                </div>
              </div>
            </div>

            {/* TARGET SCENARIO AND ROI */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-2xl shadow-sm border border-indigo-100">
              <h2 className="text-lg font-bold flex items-center gap-2 border-b border-indigo-200 pb-4 mb-6 text-indigo-900">
                <Target className="w-5 h-5 text-indigo-600" />
                Optimization Strategy (To-Be)
              </h2>
              <div className="space-y-6">
                <ControlSlider 
                  label="Target Automation" value={targetAutomation} min={automation} max={100} setter={setTargetAutomation} suffix="%"
                  highlightClass="text-indigo-700 bg-white border-indigo-200 focus:ring-indigo-500" accentClass="accent-indigo-600"
                  tooltip="The Agentic CI/CD level you would reach by integrating new tools. Cannot be lower than the current level."
                />

                <ControlSlider 
                  label="Savings Realization Rate" value={savingsRealizationRate} min={0} max={100} step={5} setter={setSavingsRealizationRate} suffix="%"
                  highlightClass="text-emerald-700 bg-white border-emerald-200 focus:ring-emerald-500" accentClass="accent-emerald-600"
                  tooltip="Percentage of released capacity value that can be converted into liquid financial savings, overtime reduction, or future avoided costs."
                />

                {/* PRICING MODEL SELECTOR */}
                <div className="pt-2 border-t border-indigo-200/50">
                  <div className="text-xs font-bold text-indigo-900 uppercase tracking-wider mt-4 mb-2">Software Cost Model</div>
                  <div className="flex gap-2 bg-indigo-100/50 p-1 rounded-lg mb-4 border border-indigo-100">
                    <button 
                      onClick={() => setPricingModel('saas')} 
                      className={`flex-1 text-xs font-bold py-2 rounded transition-all ${pricingModel === 'saas' ? 'bg-white text-indigo-900 shadow-sm border border-indigo-200' : 'text-indigo-600 hover:bg-indigo-100'}`}
                    >
                      SaaS License
                    </button>
                    <button 
                      onClick={() => setPricingModel('tokens')} 
                      className={`flex-1 text-xs font-bold py-2 rounded transition-all ${pricingModel === 'tokens' ? 'bg-white text-indigo-900 shadow-sm border border-indigo-200' : 'text-indigo-600 hover:bg-indigo-100'}`}
                    >
                      API Tokens
                    </button>
                  </div>
                  
                  {pricingModel === 'saas' ? (
                    <ControlSlider 
                      label="Annual Software Cost" value={softwareCost} min={0} max={1000000} step={1000} setter={setSoftwareCost} prefix="$"
                      highlightClass="text-emerald-700 bg-white border-emerald-200 focus:ring-emerald-500" accentClass="accent-emerald-600"
                      tooltip="Flat investment (CAPEX/OPEX) required annually."
                    />
                  ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <ControlSlider 
                        label="Inference Cost (per 1k LOC)" value={costPer1kLoc} min={0.01} max={5.00} step={0.01} setter={setCostPer1kLoc} prefix="$"
                        highlightClass="text-emerald-700 bg-white border-emerald-200 focus:ring-emerald-500" accentClass="accent-emerald-600"
                      />
                      <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 flex justify-between items-center shadow-inner">
                        <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                          <Rocket className="w-3 h-3" /> Annual API Cost
                        </span>
                        <span className="text-lg font-black text-emerald-600">
                          ${tokenAnnualCost.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Results (PDF Container) */}
          <div id="pdf-report-container" className="xl:col-span-8 space-y-6 bg-[#F8FAFC] pb-4">
            
            <div className="hidden pdf-header mb-4">
               <h2 className="text-2xl font-black text-slate-900 border-b pb-2">The Predictive Engine: Business Case & ROI Analysis</h2>
            </div>

            {/* Premium Metric & ROI Simulator (PAYWALL) */}
            <div className="relative overflow-hidden bg-slate-900 rounded-2xl shadow-lg border border-slate-800">
              <div className={`p-6 lg:p-8 transition-all duration-500 ${!isUnlocked ? 'blur-md opacity-60' : ''}`}>
                
                {/* Current Financial Impact */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 border-b border-slate-700 pb-8">
                  <div>
                    <div className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" /> Annual Verification Burden Value
                    </div>
                    <div className="text-4xl lg:text-5xl font-black text-white mb-2 tracking-tight">
                      ${currentAnnualVerificationValue.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                    </div>
                    <p className="text-slate-400 max-w-lg text-sm">Estimated economic value of hours required to manually verify AI-generated or assisted code (Annualized to {workingDaysPerYear} productive days).</p>
                  </div>
                  <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 min-w-[180px]">
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Weekly Impact</div>
                    <div className="text-2xl font-bold text-amber-400">${currentWeeklyVerificationValue.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div>
                  </div>
                </div>

                {/* ROI Dashboard */}
                <div>
                  <div className="text-emerald-400 text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                    <PieChart className="w-4 h-4" /> Business Case: Return on Investment (Target: {targetAutomation}%)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-between">
                      <div className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase mb-1">Potential Capacity</div>
                      <div className="text-xl sm:text-2xl font-black text-slate-200">+${annualCapacityValue.toLocaleString(undefined, {maximumFractionDigits:0})}</div>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-between border-b-2 border-b-emerald-500">
                      <div className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase mb-1">Realizable Savings</div>
                      <div className="text-xl sm:text-2xl font-black text-emerald-400">+${realizedAnnualSavings.toLocaleString(undefined, {maximumFractionDigits:0})}</div>
                    </div>
                    <div className={`bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-between border-b-2 ${roiPercentage !== null && roiPercentage < 0 ? 'border-b-red-500' : 'border-b-blue-500'}`}>
                      <div className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase mb-1">Projected ROI</div>
                      <div className={`text-xl sm:text-2xl font-black ${roiPercentage !== null && roiPercentage < 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {roiPercentage !== null ? `${roiPercentage.toFixed(0)}%` : 'N/A'}
                      </div>
                    </div>
                    <div className={`bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-between border-b-2 ${paybackMonths === null ? 'border-b-red-500' : 'border-b-white'}`}>
                      <div className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase mb-1">Payback Period</div>
                      <div className={`text-lg sm:text-xl md:text-2xl font-black ${paybackMonths === null ? 'text-red-400' : 'text-white'}`}>
                        {paybackMonths !== null ? `${paybackMonths.toFixed(1)} months` : 'Not recoverable'}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
              
              {/* Lock Overlay */}
              {!isUnlocked && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/70 z-10 p-6 text-center backdrop-blur-sm">
                  <Lock className="w-12 h-12 text-blue-400 mb-4 drop-shadow-lg" />
                  <h4 className="text-2xl font-extrabold text-white mb-2">Unlock the ROI Simulator</h4>
                  <p className="text-slate-300 text-base mb-6 max-w-lg">
                    Calculate the real annual value, model A/B scenarios, and get the <strong>Payback Period</strong> needed to evaluate your investment.
                  </p>
                  <button 
                    onClick={() => setShowModal(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-xl shadow-xl flex items-center gap-2 transition-transform hover:scale-105"
                  >
                    Unlock Complete Model <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Key Operating Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Current Daily Demand</div>
                <div className="text-3xl font-black text-slate-900">{currentReviewDemandHours.toFixed(1)} <span className="text-lg text-slate-400">h</span></div>
                <div className="text-sm text-slate-500 mt-1">Required review hours</div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Executed Capacity</div>
                <div className="text-3xl font-black text-slate-900">{currentExecutedReviewHours.toFixed(1)} <span className="text-lg text-slate-400">h</span></div>
                <div className="text-sm text-slate-500 mt-1">Human operating limit</div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Daily Backlog</div>
                <div className="text-3xl font-black text-slate-900">{currentDailyBacklog.toFixed(1)} <span className="text-lg text-slate-400">h</span></div>
                <div className="text-sm text-slate-500 mt-1">Unattended demand per day</div>
              </div>
            </div>

            {/* AI EXECUTIVE PITCH SECTION */}
            {isUnlocked && (
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-2xl shadow-sm border border-indigo-100 flex flex-col relative overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-indigo-100 pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-600" />
                      AI Executive Assistant
                    </h3>
                    <p className="text-sm text-indigo-700 mt-1">
                      Generate a structured business case based on the chosen realization parameters.
                    </p>
                  </div>
                  
                  {/* TABS */}
                  <div className="flex gap-2 bg-indigo-100 p-1 rounded-lg" data-html2canvas-ignore="true">
                    <button 
                      onClick={() => setActiveAiTab('pitch')}
                      className={`text-sm font-semibold py-2 px-4 rounded-md transition-all flex items-center gap-2 ${activeAiTab === 'pitch' ? 'bg-white text-indigo-800 shadow-sm' : 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50'}`}
                    >
                      <FileText className="w-4 h-4" /> Board Pitch
                    </button>
                    <button 
                      onClick={() => setActiveAiTab('email')}
                      className={`text-sm font-semibold py-2 px-4 rounded-md transition-all flex items-center gap-2 ${activeAiTab === 'email' ? 'bg-white text-indigo-800 shadow-sm' : 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50'}`}
                    >
                      <Mail className="w-4 h-4" /> CAPEX Request
                    </button>
                  </div>
                </div>
                
                {/* AI RESULTS AREA */}
                <div className="bg-white rounded-xl p-6 border border-indigo-100 min-h-[160px] shadow-inner">
                  {aiLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-indigo-400 space-y-3 py-10">
                      <Sparkles className="w-8 h-8 animate-pulse text-indigo-500" />
                      <p className="text-sm font-medium">Synthesizing financial model with Gemini and drafting proposal...</p>
                    </div>
                  ) : aiError ? (
                    <div className="text-red-500 text-sm flex items-center gap-2 py-6"><AlertTriangle className="w-5 h-5" /> {aiError}</div>
                  ) : aiSummaries[activeAiTab] ? (
                    <div>
                      <div 
                        className="prose prose-sm md:prose-base max-w-none text-slate-800 leading-relaxed" 
                        dangerouslySetInnerHTML={{ __html: formatAIResponse(aiSummaries[activeAiTab]) }} 
                      />
                      <div className="mt-6 pt-4 border-t border-indigo-50 flex justify-end" data-html2canvas-ignore="true">
                        <button 
                          onClick={() => executeAIGeneration(activeAiTab)}
                          className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" /> Regenerate with updated data
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                      <div className="text-slate-400 text-sm text-center italic max-w-md">
                        {activeAiTab === 'pitch' 
                          ? "Generate a 3 key-point pitch to present to the board of directors." 
                          : "Draft a formal email for the CFO justifying the budget request."}
                      </div>
                      <button 
                        onClick={() => executeAIGeneration(activeAiTab)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                        data-html2canvas-ignore="true"
                      >
                        <Sparkles className="w-4 h-4" />
                        Generate {activeAiTab === 'pitch' ? 'Pitch' : 'Request'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* A/B Comparison Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-96 flex flex-col relative overflow-hidden">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-slate-700" />
                    Scenario Comparison: Technical Debt Backlog
                  </h3>
                  <p className="text-sm text-slate-500">Projection of daily accumulated review hours that exceed operating capacity.</p>
                </div>
                <button 
                  onClick={() => isUnlocked ? handleDownloadPDF() : setShowModal(true)}
                  disabled={isGeneratingPdf}
                  data-html2canvas-ignore="true"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold border transition-colors ${isUnlocked ? 'text-slate-700 bg-slate-50 border-slate-200 hover:bg-slate-100' : 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100'}`}
                >
                  {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : (isUnlocked ? <Download className="w-4 h-4" /> : <Lock className="w-4 h-4" />)}
                  {isGeneratingPdf ? 'Generating PDF...' : 'Export Report'}
                </button>
              </div>

              <div className={`flex-1 w-full h-full min-h-[200px] transition-all duration-500 ${!isUnlocked ? 'opacity-30 pointer-events-none' : ''}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 25, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 600}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} unit="h" />
                    <RechartsTooltip 
                      formatter={(value, name) => [
                        `${Number(value).toFixed(1)} hours`, 
                        name === 'backlog' ? 'Current Backlog' : 'Optimized Backlog'
                      ]}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}
                    />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px' }}/>
                    <Line 
                      type="monotone" 
                      dataKey="backlog" 
                      name="Current Scenario (As-Is)" 
                      stroke={currentDailyBacklog > 0 ? "#ef4444" : "#f59e0b"} 
                      strokeWidth={4} 
                      dot={{ r: 5, strokeWidth: 2, fill: '#fff' }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="targetBacklog" 
                      name={`Target Scenario (${targetAutomation}% Automation)`} 
                      stroke="#10b981" 
                      strokeWidth={4} 
                      strokeDasharray="5 5"
                      dot={{ r: 5, strokeWidth: 2, fill: '#fff' }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* LEAD CAPTURE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="p-8">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                <Rocket className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 mb-2">Unlock THE PREDICTIVE ENGINE <span className="text-blue-600">PRO</span></h3>
              <p className="text-slate-600 mb-6">
                Join the waitlist of operational leaders. Enter your email to unlock the ROI Dashboard, scenario comparison, and AI to generate business cases.
              </p>
              
              <form onSubmit={handleUnlock} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Corporate Email</label>
                  <input 
                    type="email" 
                    required
                    placeholder="alex@yourcompany.com" 
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors"
                >
                  Unlock PRO Features
                </button>
              </form>
            </div>
            <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs text-slate-500 flex items-center gap-1"><Lock className="w-3 h-3"/> 100% Secure. Zero Spam.</span>
              <button onClick={() => setShowModal(false)} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}