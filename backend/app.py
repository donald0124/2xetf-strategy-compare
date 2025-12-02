import yfinance as yf
import pandas as pd
import time
import os
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# 快取設定 (避免每次都去敲 Yahoo)
cache = {"data": None, "timestamp": 0}
CACHE_DURATION = 43200 # 12小時


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
    
    # 2. 【關鍵】解決 NaN -> null
    df = df.astype(object).where(pd.notnull(df), None)
    
    formatted_data = []
    
    for date, row in df.iterrows():
        try:
            item = {
                "date": date.strftime('%Y-%m-%d'),
                # 【修正】加上你的 Round 邏輯
                # 判斷：如果有值 (row[...] 存在) -> 轉 float -> 取小數點後兩位
                #      如果是 None -> 就回傳 None
                "price1x": round(float(row['0050.TW']), 2) if row['0050.TW'] else None,
                "price2x_631": round(float(row['00631L.TW']), 2) if row['00631L.TW'] else None,
                "price2x_675": round(float(row['00675L.TW']), 2) if row['00675L.TW'] else None
            }
            formatted_data.append(item)
        except Exception as e:
            # 只有當轉型失敗時才會跳過
            continue
            
    print(f"✅ 數據處理完成，共 {len(formatted_data)} 筆交易日")
    return formatted_data



@app.route('/')
def home():
    return "Stock API is running!"

@app.route('/api/history')
def get_history():
    current_time = time.time()
    
    # --- 快取檢查邏輯 ---
    # 1. 如果快取有資料 (cache["data"] 不是 None)
    # 2. 且 資料還沒過期 (目前時間 - 上次更新時間 < 12小時)
    if cache["data"] and (current_time - cache["timestamp"] < CACHE_DURATION):
        print("⚡ [快取] 使用記憶體中的舊資料，不重新下載")
        return jsonify(cache["data"])
    
    # --- 快取失效，重新抓取 ---
    try:
        print("🔄 [更新] 快取過期或無資料，重新抓取...")
        result = fetch_stock_data()
        
        # 更新全域變數
        cache["data"] = result
        cache["timestamp"] = current_time
        
        return jsonify(result)
    except Exception as e:
        print(f"❌ 錯誤: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Zeabur 會透過 PORT 環境變數指定 Port，預設 5000
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)