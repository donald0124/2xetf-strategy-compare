import yfinance as yf
import pandas as pd
import json
import os

def generate_static_data():
    print("🚀 [1/3] 開始從 Yahoo Finance 下載數據...")
    
    # 定義股票清單
    tickers = ["0050.TW", "00631L.TW", "00675L.TW"]
    
    # 下載數據 (從 2014 開始)
    # auto_adjust=True: 自動還原股價 (含息)
    data = yf.download(tickers, start="2014-10-01", auto_adjust=True)
    
    # 處理資料格式
    if 'Close' in data.columns.levels[0]:
        df = data['Close']
    else:
        df = data

    # 1. 移除連 0050 都沒有的日子 (Benchmark 必須存在)
    df = df.dropna(subset=['0050.TW'])
    
    # 2. 將剩餘的 NaN (空值) 填補為 None (JSON null)
    df = df.astype(object).where(pd.notnull(df), None)
    
    formatted_data = []
    
    print("⚙️ [2/3] 正在處理數據清洗與格式轉換...")
    for date, row in df.iterrows():
        try:
            item = {
                "date": date.strftime('%Y-%m-%d'),
                "price1x": round(float(row['0050.TW']), 2) if row['0050.TW'] else None,
                "price2x_631": round(float(row['00631L.TW']), 2) if row['00631L.TW'] else None,
                "price2x_675": round(float(row['00675L.TW']), 2) if row['00675L.TW'] else None
            }
            formatted_data.append(item)
        except Exception as e:
            continue
            
    # 設定輸出路徑：存到前端的 public 資料夾中
    # 相對路徑：從 backend 資料夾往上一層 (..) -> frontend -> public
    output_dir = '../frontend/public'
    output_file = os.path.join(output_dir, 'data.json')
    
    # 確保目錄存在
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    print(f"💾 [3/3] 正在寫入檔案: {output_file}")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(formatted_data, f)
    
    print(f"✅ 成功！已生成 {len(formatted_data)} 筆交易資料。")
    print("👉 現在你的前端可以直接讀取 '/data.json' 了！")

if __name__ == '__main__':
    generate_static_data()