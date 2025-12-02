import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, Activity, AlertTriangle, RefreshCw, DollarSign, Settings, Calendar, Eye, Lock, Unlock, ArrowUp, ArrowDown } from 'lucide-react';

import staticData from './data.json'; 

// --- UI 小元件 ---
const NumberControl = ({ label, value, onChange, min, max, step, suffix = "", color = "slate", icon: Icon }) => (
  <div className="mb-4">
    <div className="flex justify-between mb-1">
      <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
        {Icon && <Icon size={14} className={`text-${color}-500`} />}
        {label}
      </label>
      <span className={`text-sm font-bold text-${color}-600`}>{typeof value === 'number' ? value.toFixed(step < 1 ? 2 : 0) : value}{suffix}</span>
    </div>
    <div className="flex items-center gap-2">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className={`w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-${color}-600`} />
    </div>
  </div>
);

// StatCard 支援 Benchmark 對照數據
const StatCard = ({ title, value, benchmarkValue, subtext, benchmarkSubtext, icon: Icon, color = "blue", highlight = false }) => (
  <div className={`bg-white p-4 rounded-xl border ${highlight ? `border-${color}-400 ring-1 ring-${color}-100` : 'border-slate-200'} shadow-sm flex items-start space-x-4`}>
    <div className={`p-3 rounded-lg bg-${color}-50 text-${color}-600`}><Icon size={24} /></div>
    <div className="flex-1">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
      {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
      {benchmarkValue && (
        <p className="text-xs text-slate-400 mt-1 font-medium">
          (0050: <span className="text-slate-600">{benchmarkValue}</span>)
        </p>
      )}
      {benchmarkSubtext && <p className="text-xs text-slate-400 mt-0">{benchmarkSubtext}</p>}
    </div>
  </div>
);

const ToggleButton = ({ label, active, color, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
      active 
        ? `bg-${color}-100 text-${color}-700 border-${color}-300` 
        : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
    }`}
  >
    <div className={`w-2 h-2 rounded-full ${active ? `bg-${color}-500` : 'bg-slate-300'}`} />
    {label}
  </button>
);

export default function BacktestSimulator() {
  const [rawData] = useState(staticData);
  const [selectedEtf, setSelectedEtf] = useState("price2x_631");
  const [initialCapital, setInitialCapital] = useState(1000000);
  const [etfPercent, setEtfPercent] = useState(50); 
  
  // 【新增】波動容忍設定
  const [isSymmetric, setIsSymmetric] = useState(true); // 是否對稱
  const [symmetricRange, setSymmetricRange] = useState(20); // 對稱時的數值
  const [upperRange, setUpperRange] = useState(20); // 上漲容忍 (賣出)
  const [lowerRange, setLowerRange] = useState(20); // 下跌容忍 (買入)

  const [interestRate, setInterestRate] = useState(1.0); 

  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [chartVisibility, setChartVisibility] = useState({
    total: true,
    benchmark: true,
    etf: false,
    cash: false
  });

  // --- 日期邏輯 ---
  useEffect(() => {
    if (!rawData || rawData.length === 0) return;
    const firstValidItem = rawData.find(d => d[selectedEtf] !== null && d.price1x !== null);
    const lastValidItem = rawData[rawData.length - 1];

    if (firstValidItem && lastValidItem) {
      if (!dateRange.start) {
        setDateRange({ start: firstValidItem.date, end: lastValidItem.date });
      } else {
        if (dateRange.start < firstValidItem.date) {
           setDateRange(prev => ({ ...prev, start: firstValidItem.date }));
        }
      }
    }
  }, [selectedEtf, rawData]);

  // --- 數據過濾 ---
  const validData = useMemo(() => {
    if (!rawData) return [];
    return rawData.filter(item => {
      if (item.price1x === null || item[selectedEtf] === null) return false;
      if (dateRange.start && item.date < dateRange.start) return false;
      if (dateRange.end && item.date > dateRange.end) return false;
      return true;
    });
  }, [rawData, selectedEtf, dateRange]);

  // --- 回測核心 ---
  const results = useMemo(() => {
    if (validData.length === 0) return null;

    let cash = initialCapital * (1 - etfPercent / 100);
    let shares = (initialCapital * (etfPercent / 100)) / validData[0][selectedEtf];
    const benchmarkShares = initialCapital / validData[0].price1x;

    let tradeCount = 0;
    const history = [];
    
    let maxEquity = 0;
    let maxDrawdown = 0;
    let benchMaxEquity = 0;
    let benchMaxDrawdown = 0;
    
    const targetRatio = etfPercent / (100 - etfPercent);
    
    // 【修改】閾值計算邏輯
    let thresholdBuy, thresholdSell;
    if (isSymmetric) {
        thresholdBuy = targetRatio * (1 - symmetricRange / 100);
        thresholdSell = targetRatio * (1 + symmetricRange / 100);
    } else {
        // 下跌容忍 lowerRange -> 觸發買入
        thresholdBuy = targetRatio * (1 - lowerRange / 100);
        // 上漲容忍 upperRange -> 觸發賣出
        thresholdSell = targetRatio * (1 + upperRange / 100);
    }

    const dailyInterestRate = interestRate / 100 / 365;

    validData.forEach((day) => {
      cash += cash * dailyInterestRate;

      const currentPrice = day[selectedEtf];
      const etfValue = shares * currentPrice;
      const totalEquity = cash + etfValue;
      const currentRatio = cash > 10 ? etfValue / cash : 9999;
      
      const benchmarkEquity = benchmarkShares * day.price1x;

      // 策略 MDD
      if (totalEquity > maxEquity) maxEquity = totalEquity;
      const drawdown = (totalEquity - maxEquity) / maxEquity;
      if (drawdown < maxDrawdown) maxDrawdown = drawdown;

      // Benchmark MDD
      if (benchmarkEquity > benchMaxEquity) benchMaxEquity = benchmarkEquity;
      const benchDrawdown = (benchmarkEquity - benchMaxEquity) / benchMaxEquity;
      if (benchDrawdown < benchMaxDrawdown) benchMaxDrawdown = benchDrawdown;

      let action = null;
      if (currentRatio > thresholdSell) {
        const targetEtfValue = totalEquity * (targetRatio / (targetRatio + 1));
        const sellAmount = etfValue - targetEtfValue;
        if (sellAmount > 1000) {
          shares -= sellAmount / currentPrice;
          cash += sellAmount * 0.998; 
          tradeCount++;
          action = 'SELL';
        }
      } else if (currentRatio < thresholdBuy) {
        const targetEtfValue = totalEquity * (targetRatio / (targetRatio + 1));
        const buyAmount = targetEtfValue - etfValue;
        if (buyAmount > 1000 && cash >= buyAmount) {
          shares += buyAmount / currentPrice;
          cash -= buyAmount * 1.002; 
          tradeCount++;
          action = 'BUY';
        }
      }

      history.push({
        date: day.date,
        equity: Number(totalEquity.toFixed(2)),
        benchmark: Number(benchmarkEquity.toFixed(2)),
        etfValue: Number(etfValue.toFixed(2)),
        cash: Number(cash.toFixed(2)),
        drawdown: drawdown,
        benchDrawdown: benchDrawdown, // 【新增】
        action: action
      });
    });

    const finalEquity = history[history.length - 1].equity;
    const finalBenchmarkEquity = history[history.length - 1].benchmark;
    const totalReturn = (finalEquity - initialCapital) / initialCapital;
    const benchmarkReturn = (finalBenchmarkEquity - initialCapital) / initialCapital;
    
    const years = validData.length / 252;
    const cagr = Math.pow(finalEquity / initialCapital, 1 / years) - 1;
    // 【新增】Benchmark CAGR
    const benchmarkCagr = Math.pow(finalBenchmarkEquity / initialCapital, 1 / years) - 1;

    return { 
        history, 
        finalEquity, finalBenchmarkEquity,
        totalReturn, benchmarkReturn,
        cagr, benchmarkCagr,
        maxDrawdown, benchMaxDrawdown,
        tradeCount 
    };
  }, [validData, initialCapital, etfPercent, isSymmetric, symmetricRange, upperRange, lowerRange, selectedEtf, interestRate]);

  if (!results) return <div className="p-10 text-center">請選擇有效日期範圍或確認數據...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-100 pb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Settings className="text-blue-600" />
                台股槓桿 ETF 真實回測
              </h1>
              <p className="text-slate-500 text-xs mt-1">
                資料區間: {validData[0]?.date} ~ {validData[validData.length-1]?.date} (共 {validData.length} 交易日)
              </p>
            </div>
            
            <div className="flex gap-2">
               {['price2x_631', 'price2x_675'].map(ticker => (
                  <button
                    key={ticker}
                    onClick={() => setSelectedEtf(ticker)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
                      selectedEtf === ticker 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {ticker === 'price2x_631' ? '00631L (元大正2)' : '00675L (富邦正2)'}
                  </button>
               ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
             <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Calendar size={12}/> 開始日期</label>
                <input type="date" value={dateRange.start} max={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
             </div>
             <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Calendar size={12}/> 結束日期</label>
                <input type="date" value={dateRange.end} min={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* 左側控制 */}
          <div className="lg:col-span-4 space-y-4">
            {/* 1. 資金與配置 */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <DollarSign size={16} /> 資金與配置
              </h2>
              <NumberControl label="配置重心 (ETF %)" value={etfPercent} onChange={setEtfPercent} min={0} max={100} step={5} suffix="%" color="blue" />
              <div className="pt-2 border-t border-slate-100">
                 <NumberControl label="現金活存利率 (%)" value={interestRate} onChange={setInterestRate} min={0} max={5} step={0.1} suffix="%" color="emerald" />
              </div>
            </div>

            {/* 2. 再平衡波動容忍 (Symmetric Toggle) */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Activity size={16} /> 再平衡門檻
                </h2>
                <button 
                  onClick={() => setIsSymmetric(!isSymmetric)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs transition-colors border ${isSymmetric ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}
                >
                  {isSymmetric ? <Lock size={12} /> : <Unlock size={12} />}
                  {isSymmetric ? '鎖定對稱' : '獨立調整'}
                </button>
              </div>

              {isSymmetric ? (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                   <NumberControl label="波動容忍 (±%)" value={symmetricRange} onChange={setSymmetricRange} min={5} max={50} step={1} suffix="%" color="indigo" />
                   <p className="text-xs text-slate-400 mt-2 text-center">當 ETF 佔比偏離目標 ±{symmetricRange}% 時觸發再平衡</p>
                </div>
              ) : (
                <div className="space-y-2">
                   <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                      <NumberControl label="上漲容忍 (觸發賣出)" value={upperRange} onChange={setUpperRange} min={5} max={50} step={1} suffix="%" color="red" icon={ArrowUp} />
                   </div>
                   <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                      <NumberControl label="下跌容忍 (觸發買入)" value={lowerRange} onChange={setLowerRange} min={5} max={50} step={1} suffix="%" color="green" icon={ArrowDown} />
                   </div>
                </div>
              )}
            </div>
          </div>

          {/* 右側圖表 */}
          <div className="lg:col-span-8 space-y-6">
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard 
                title="總報酬率" 
                value={`${(results.totalReturn * 100).toFixed(1)}%`} 
                subtext={`CAGR: ${(results.cagr * 100).toFixed(1)}%`} 
                benchmarkValue={`${(results.benchmarkReturn * 100).toFixed(1)}%`}
                benchmarkSubtext={`(0050 CAGR: ${(results.benchmarkCagr * 100).toFixed(1)}%)`}
                icon={TrendingUp} 
                color="blue" 
              />
              <StatCard 
                title="最大回撤" 
                value={`${(results.maxDrawdown * 100).toFixed(1)}%`} 
                benchmarkValue={`${(results.benchMaxDrawdown * 100).toFixed(1)}%`}
                subtext="資產縮水幅度" 
                icon={AlertTriangle} 
                color="red" 
                highlight={true} 
              />
              <StatCard 
                title="交易次數" 
                value={results.tradeCount} 
                subtext="再平衡次數" 
                icon={RefreshCw} 
                color="purple" 
              />
              <StatCard 
                title="期末資產" 
                value={(results.finalEquity / 10000).toFixed(0) + "萬"} 
                benchmarkValue={(results.finalBenchmarkEquity / 10000).toFixed(0) + "萬"}
                subtext={`本金: ${(initialCapital/10000).toFixed(0)}萬`} 
                icon={DollarSign} 
                color="green" 
              />
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-[450px] flex flex-col">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">資產成長曲線</h3>
                  <div className="flex gap-2">
                    <ToggleButton label="總資產" color="blue" active={chartVisibility.total} onClick={() => setChartVisibility(p => ({...p, total: !p.total}))} />
                    <ToggleButton label="0050" color="slate" active={chartVisibility.benchmark} onClick={() => setChartVisibility(p => ({...p, benchmark: !p.benchmark}))} />
                    <ToggleButton label="ETF" color="sky" active={chartVisibility.etf} onClick={() => setChartVisibility(p => ({...p, etf: !p.etf}))} />
                    <ToggleButton label="現金" color="emerald" active={chartVisibility.cash} onClick={() => setChartVisibility(p => ({...p, cash: !p.cash}))} />
                  </div>
               </div>

              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={results.history}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tickFormatter={(t) => t.substring(0, 4)} stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" tickFormatter={(v) => `${(v/10000).toFixed(0)}萬`} domain={['auto', 'auto']} />
                    <Tooltip formatter={(val) => val.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend />
                    
                    {chartVisibility.total && <Line type="monotone" dataKey="equity" name="策略總資產" stroke="#2563eb" strokeWidth={3} dot={false} />}
                    {chartVisibility.benchmark && <Line type="monotone" dataKey="benchmark" name="0050 (100%)" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />}
                    {chartVisibility.etf && <Line type="monotone" dataKey="etfValue" name="策略 ETF 價值" stroke="#7dd3fc" strokeWidth={2} dot={false} />}
                    {chartVisibility.cash && <Line type="monotone" dataKey="cash" name="策略現金價值" stroke="#10b981" strokeWidth={2} dot={false} />}
                    </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
             <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-[200px]">
               <h3 className="text-sm font-bold mb-2 text-slate-500">回撤幅度 (MDD)</h3>
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={results.history}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="date" tickFormatter={(t) => t.substring(0, 4)} hide />
                   <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                   <Tooltip formatter={(v) => (v*100).toFixed(2) + '%'} />
                   {/* 【新增】0050 MDD 線 (灰色背景) */}
                   <Area type="monotone" dataKey="benchDrawdown" stroke="#cbd5e1" fill="#f1f5f9" name="0050 MDD" />
                   {/* 策略 MDD 線 (紅色) */}
                   <Area type="monotone" dataKey="drawdown" stroke="#ef4444" fill="#fee2e2" name="策略 MDD" />
                 </AreaChart>
               </ResponsiveContainer>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}