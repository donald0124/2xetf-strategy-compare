import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, Activity, AlertTriangle, RefreshCw, DollarSign, Settings, Calendar, Eye } from 'lucide-react';

import staticData from './data.json'; 

// --- UI 小元件 ---
const NumberControl = ({ label, value, onChange, min, max, step, suffix = "", color = "slate" }) => (
  <div className="mb-4">
    <div className="flex justify-between mb-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <span className={`text-sm font-bold text-${color}-600`}>{typeof value === 'number' ? value.toFixed(step < 1 ? 2 : 0) : value}{suffix}</span>
    </div>
    <div className="flex items-center gap-2">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className={`w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-${color}-600`} />
    </div>
  </div>
);

const StatCard = ({ title, value, subtext, icon: Icon, color = "blue", highlight = false }) => (
  <div className={`bg-white p-4 rounded-xl border ${highlight ? `border-${color}-400 ring-1 ring-${color}-100` : 'border-slate-200'} shadow-sm flex items-start space-x-4`}>
    <div className={`p-3 rounded-lg bg-${color}-50 text-${color}-600`}><Icon size={24} /></div>
    <div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
      {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
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
  const [symmetricRange, setSymmetricRange] = useState(20);
  
  // 日期範圍 (YYYY-MM-DD)
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // 圖表顯示開關
  const [chartVisibility, setChartVisibility] = useState({
    total: true,
    benchmark: true,
    etf: false,
    cash: false
  });

  // --- 自動日期偵測 ---
  // 當切換 ETF 時，自動抓取該 ETF 的有效起始日
  useEffect(() => {
    if (!rawData || rawData.length === 0) return;
    const firstValidItem = rawData.find(d => d[selectedEtf] !== null && d.price1x !== null);
    const lastValidItem = rawData[rawData.length - 1];

    if (firstValidItem && lastValidItem) {
      setDateRange({
        start: firstValidItem.date,
        end: lastValidItem.date
      });
    }
  }, [selectedEtf, rawData]);

  // --- 數據過濾 (The NaN Fix) ---
  // 這裡會把 null 的資料踢掉，確保回測引擎拿到乾淨的數據
  const validData = useMemo(() => {
    if (!rawData) return [];
    return rawData.filter(item => {
      // 1. 踢掉空值
      if (item.price1x === null || item[selectedEtf] === null) return false;
      // 2. 踢掉日期範圍外的
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
    
    const targetRatio = etfPercent / (100 - etfPercent);
    const thresholdBuy = targetRatio * (1 - symmetricRange / 100);
    const thresholdSell = targetRatio * (1 + symmetricRange / 100);

    validData.forEach((day) => {
      const currentPrice = day[selectedEtf];
      const etfValue = shares * currentPrice;
      const totalEquity = cash + etfValue;
      const currentRatio = cash > 10 ? etfValue / cash : 9999;
      
      const benchmarkEquity = benchmarkShares * day.price1x;

      if (totalEquity > maxEquity) maxEquity = totalEquity;
      const drawdown = (totalEquity - maxEquity) / maxEquity;
      if (drawdown < maxDrawdown) maxDrawdown = drawdown;

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
        equity: Math.round(totalEquity),
        benchmark: Math.round(benchmarkEquity),
        etfValue: Math.round(etfValue),
        cash: Math.round(cash),
        drawdown: drawdown,
        action: action
      });
    });

    const finalEquity = history[history.length - 1].equity;
    const totalReturn = (finalEquity - initialCapital) / initialCapital;
    const years = validData.length / 252;
    const cagr = Math.pow(finalEquity / initialCapital, 1 / years) - 1;

    return { history, finalEquity, totalReturn, cagr, maxDrawdown, tradeCount };
  }, [validData, initialCapital, etfPercent, symmetricRange, selectedEtf]);

  if (!results) return <div className="p-10 text-center">請選擇有效日期範圍或確認數據...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Area */}
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

          {/* 日期選擇器 */}
          <div className="flex flex-wrap items-end gap-4">
             <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                  <Calendar size={12}/> 開始日期
                </label>
                <input 
                  type="date" 
                  value={dateRange.start} 
                  max={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
             </div>
             <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                  <Calendar size={12}/> 結束日期
                </label>
                <input 
                  type="date" 
                  value={dateRange.end} 
                  min={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* 左側控制 */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <DollarSign size={16} /> 資金與配置
              </h2>
              <NumberControl label="配置重心 (ETF %)" value={etfPercent} onChange={setEtfPercent} min={0} max={100} step={5} suffix="%" color="blue" />
              <NumberControl label="波動容忍 (±%)" value={symmetricRange} onChange={setSymmetricRange} min={5} max={50} step={1} suffix="%" color="indigo" />
            </div>

            {/* 圖表顯示控制 (你要的功能在這裡) */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
               <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Eye size={16} /> 圖表顯示設定
              </h2>
              <div className="flex flex-wrap gap-2">
                <ToggleButton 
                  label="策略總資產" color="blue" active={chartVisibility.total} 
                  onClick={() => setChartVisibility(p => ({...p, total: !p.total}))} 
                />
                <ToggleButton 
                  label="0050 Benchmark" color="slate" active={chartVisibility.benchmark} 
                  onClick={() => setChartVisibility(p => ({...p, benchmark: !p.benchmark}))} 
                />
                <ToggleButton 
                  label="ETF 部位" color="sky" active={chartVisibility.etf} 
                  onClick={() => setChartVisibility(p => ({...p, etf: !p.etf}))} 
                />
                <ToggleButton 
                  label="現金部位" color="emerald" active={chartVisibility.cash} 
                  onClick={() => setChartVisibility(p => ({...p, cash: !p.cash}))} 
                />
              </div>
            </div>
          </div>

          {/* 右側圖表 */}
          <div className="lg:col-span-8 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="總報酬率" value={`${(results.totalReturn * 100).toFixed(1)}%`} subtext={`CAGR: ${(results.cagr * 100).toFixed(1)}%`} icon={TrendingUp} color="blue" />
              <StatCard title="最大回撤" value={`${(results.maxDrawdown * 100).toFixed(1)}%`} subtext="資產縮水幅度" icon={AlertTriangle} color="red" highlight={true} />
              <StatCard title="交易次數" value={results.tradeCount} subtext="再平衡次數" icon={RefreshCw} color="purple" />
              <StatCard title="期末資產" value={(results.finalEquity / 10000).toFixed(0) + "萬"} subtext={`本金: ${(initialCapital/10000).toFixed(0)}萬`} icon={DollarSign} color="green" />
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-[400px]">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">資產成長曲線</h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={results.history}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickFormatter={(t) => t.substring(0, 4)} stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(v) => `${(v/10000).toFixed(0)}萬`} domain={['auto', 'auto']} />
                  <Tooltip formatter={(val) => Math.round(val).toLocaleString()} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend />
                  
                  {chartVisibility.total && (
                    <Line type="monotone" dataKey="equity" name="策略總資產" stroke="#2563eb" strokeWidth={3} dot={false} />
                  )}
                  {chartVisibility.benchmark && (
                    <Line type="monotone" dataKey="benchmark" name="0050 (100%)" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  )}
                  {chartVisibility.etf && (
                    <Line type="monotone" dataKey="etfValue" name="策略 ETF 價值" stroke="#7dd3fc" strokeWidth={2} dot={false} />
                  )}
                  {chartVisibility.cash && (
                    <Line type="monotone" dataKey="cash" name="策略現金價值" stroke="#10b981" strokeWidth={2} dot={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
            
             <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-[200px]">
               <h3 className="text-sm font-bold mb-2 text-slate-500">回撤幅度 (MDD)</h3>
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={results.history}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="date" tickFormatter={(t) => t.substring(0, 4)} hide />
                   <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                   <Tooltip formatter={(v) => (v*100).toFixed(2) + '%'} />
                   <Area type="monotone" dataKey="drawdown" stroke="#ef4444" fill="#fee2e2" name="MDD" />
                 </AreaChart>
               </ResponsiveContainer>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}