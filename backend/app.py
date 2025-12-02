import yfinance as yf
import pandas as pd
import time
import os
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# 快取設定：12小時更新一次
cache = {
    "data": None,
    "timestamp": 0
}
CACHE_DURATION = 43200 


def fetch_stock_data():
    print("🚀 開始從 Yahoo Finance 下載數據...")
    
    tickers = ["0050.TW", "00631L.TW", "00675L.TW"]
    
    # 下載數據，從 2014 開始 (這是 00631L 上市年份)
    data = yf.download(tickers, start="2014-10-01", auto_adjust=True)
    
    if 'Close' in data.columns.levels[0]:
        df = data['Close']
    else:
        df = data

    # 【修改重點 1】只移除 0050 是空值的日子 (Benchmark 一定要有)
    df = df.dropna(subset=['0050.TW'])
    
    # 【修改重點 2】將剩餘的 NaN (空值) 填補為 None，這樣轉成 JSON 會變成 null
    # Pandas 的 NaN 在 JSON 中不合法，必須轉成 Python 的 None
    df = df.where(pd.notnull(df), None)
    
    formatted_data = []
    
    for date, row in df.iterrows():
        try:
            item = {
                "date": date.strftime('%Y-%m-%d'),
                "price1x": round(float(row['0050.TW']), 2) if row['0050.TW'] else None,
                
                # 如果是 None 就不轉 float，保留 None
                "price2x_631": round(float(row['00631L.TW']), 2) if row['00631L.TW'] else None,
                "price2x_675": round(float(row['00675L.TW']), 2) if row['00675L.TW'] else None
            }
            formatted_data.append(item)
        except Exception as e:
            print(f"Skipping row {date}: {e}")
            continue
            
    print(f"✅ 數據處理完成，共 {len(formatted_data)} 筆交易日")
    return formatted_data



@app.route('/')
def home():
    return "Stock API is running!"

@app.route('/api/history')
def get_history():
    current_time = time.time()
    
    # 檢查快取
    if cache["data"] and (current_time - cache["timestamp"] < CACHE_DURATION):
        print("⚡ 使用快取數據")
        return jsonify(cache["data"])
    
    try:
        result = fetch_stock_data()
        cache["data"] = result
        cache["timestamp"] = current_time
        return jsonify(result)
    except Exception as e:
        print(f"❌ 錯誤: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # 強制設定 host='0.0.0.0' 和 port=5000
    app.run(host='0.0.0.0', port=5001, debug=True)
