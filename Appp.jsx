import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, Activity, AlertTriangle, RefreshCw, DollarSign, Settings, Lock, Unlock, ArrowDown, ArrowUp } from 'lucide-react';
import staticData from './data.json';

// --- UI 元件 (保持原本設計) ---
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

export default function BacktestSimulator() {
  // --- 狀態設定 ---
  // 【關鍵修改】直接把 import 進來的資料設為初始值，不需要 loading 狀態了
  const [marketData, setMarketData] = useState(staticData);
  const [loading, setLoading] = useState(false); // 永遠是 false
  
  const [selectedEtf, setSelectedEtf] = useState("price2x_631");
  const [initialCapital, setInitialCapital] = useState(1000000);
  const [etfPercent, setEtfPercent] = useState(50); 
  const [symmetricRange, setSymmetricRange] = useState(20);


  // --- 2. 回測核心邏輯 (使用真實數據) ---
  const results = useMemo(() => {
    if (marketData.length === 0) return null;

    let cash = initialCapital * (1 - etfPercent / 100);
    // 根據選擇的 ETF 欄位 (price2x_631 或 price2x_675) 來計算
    let shares = (initialCapital * (etfPercent / 100)) / marketData[0][selectedEtf];
    
    // Benchmark: 100% 投入 0050
    const benchmarkShares = initialCapital / marketData[0].price1x;

    let tradeCount = 0;
    const history = [];
    let maxEquity = 0;
    let maxDrawdown = 0;
    
    // 目標比值 (例如 50% 就是 1:1 = 1)
    const targetRatio = etfPercent / (100 - etfPercent);
    const thresholdBuy = targetRatio * (1 - symmetricRange / 100);
    const thresholdSell = targetRatio * (1 + symmetricRange / 100);

    marketData.forEach((day) => {
      const currentPrice = day[selectedEtf]; // 動態抓取選定 ETF 的價格
      const etfValue = shares * currentPrice;
      const totalEquity = cash + etfValue;
      const currentRatio = cash > 10 ? etfValue / cash : 9999;
      
      const benchmarkEquity = benchmarkShares * day.price1x;

      // 計算 MDD
      if (totalEquity > maxEquity) maxEquity = totalEquity;
      const drawdown = (totalEquity - maxEquity) / maxEquity;
      if (drawdown < maxDrawdown) maxDrawdown = drawdown;

      // 再平衡邏輯 (Symmetric)
      let action = null;
      if (currentRatio > thresholdSell) {
        // 賣出 ETF
        const targetEtfValue = totalEquity * (targetRatio / (targetRatio + 1));
        const sellAmount = etfValue - targetEtfValue;
        if (sellAmount > 1000) {
          shares -= sellAmount / currentPrice;
          cash += sellAmount * 0.998; // 扣成本
          tradeCount++;
          action = 'SELL';
        }
      } else if (currentRatio < thresholdBuy) {
        // 買入 ETF
        const targetEtfValue = totalEquity * (targetRatio / (targetRatio + 1));
        const buyAmount = targetEtfValue - etfValue;
        if (buyAmount > 1000 && cash >= buyAmount) {
          shares += buyAmount / currentPrice;
          cash -= buyAmount * 1.002; // 扣成本
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
    const years = marketData.length / 252;
    const cagr = Math.pow(finalEquity / initialCapital, 1 / years) - 1;

    return { history, finalEquity, totalReturn, cagr, maxDrawdown, tradeCount };
  }, [marketData, initialCapital, etfPercent, symmetricRange, selectedEtf]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-xl font-bold text-slate-600">載入歷史股價中...</div>;
  if (!results) return <div>數據載入失敗，請確認後端是否已啟動。</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 pb-4">
          <div>




    <div className="bg-red-100 p-2 text-red-600 text-xs mb-4">
      <p>Debug Info:</p>
      <p>Loading: {loading ? "Yes" : "No"}</p>
      <p>Data Length: {marketData ? marketData.length : "0"}</p>
      <p>Raw Data Sample: {marketData && marketData.length > 0 ? JSON.stringify(marketData[0]) : "None"}</p>
    </div>




            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <Settings className="text-blue-600" />
              台股槓桿 ETF 真實回測
            </h1>
            <p className="text-slate-500 mt-1 text-sm">數據來源: Yahoo Finance (自動除權息還原)</p>
          </div>
          
          {/* ETF 選擇器 */}
          <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1">
            <button 
              onClick={() => setSelectedEtf("price2x_631")}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${selectedEtf === "price2x_631" ? "bg-blue-600 text-white shadow" : "text-slate-500 hover:bg-slate-50"}`}
            >
              00631L (元大正2)
            </button>
            <button 
              onClick={() => setSelectedEtf("price2x_675")}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${selectedEtf === "price2x_675" ? "bg-blue-600 text-white shadow" : "text-slate-500 hover:bg-slate-50"}`}
            >
              00675L (富邦正2)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* 左側控制 */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><DollarSign size={16} /> 資金與配置</h2>
              <NumberControl label="配置重心 (ETF %)" value={etfPercent} onChange={setEtfPercent} min={0} max={100} step={5} suffix="%" color="blue" />
              <NumberControl label="波動容忍 (±%)" value={symmetricRange} onChange={setSymmetricRange} min={5} max={50} step={1} suffix="%" color="indigo" />
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
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">資產走勢 (vs 0050)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={results.history}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickFormatter={(t) => t.substring(0, 4)} stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(v) => `${(v/10000).toFixed(0)}萬`} domain={['auto', 'auto']} />
                  <Tooltip formatter={(val) => Math.round(val).toLocaleString()} />
                  <Legend />
                  <Line type="monotone" dataKey="equity" name="策略總資產" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="benchmark" name="0050 Benchmark" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* MDD 圖表 */}
             <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-[200px]">
               <h3 className="text-sm font-bold mb-2 text-slate-500">回撤幅度 (MDD)</h3>
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={results.history}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="date" tickFormatter={(t) => t.substring(0, 4)} hide />
                   <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                   <Tooltip formatter={(v) => (v*100).toFixed(2) + '%'} />
                   <Area type="monotone" dataKey="drawdown" stroke="#ef4444" fill="#fee2e2" />
                 </AreaChart>
               </ResponsiveContainer>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}