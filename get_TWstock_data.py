import yfinance as yf
import pandas as pd
from datetime import datetime

# ==========================================
# 互動式設定
# ==========================================

stock_input = input("👉 請輸入股票代號 (例如 2330, 0050): ").strip()

# 處理代號後綴
if not stock_input.upper().endswith('.TW') and not stock_input.upper().endswith('.TWO'):
    ticker = f"{stock_input}.TW"
else:
    ticker = stock_input.upper()

start_date = "2000-01-01"

print(f"\n🚀 正在下載 {ticker} 資料...")

try:
    # 下載資料
    df = yf.download(ticker, start=start_date, auto_adjust=True)

    if df.empty:
        print(f"❌ 找不到代號 {ticker} 的資料。")
    else:
        # ==========================================
        # ✨ 新增步驟：四捨五入
        # ==========================================
        # 將所有數據四捨五入到小數點後 2 位
        df = df.round(2)
        
        # --- 存檔 ---
        csv_filename = f"{stock_input}_history.csv"
        df.to_csv(csv_filename, encoding='utf-8-sig')

        print(f"\n✅ 成功下載 {len(df)} 筆資料！")
        print(f"✨ 數值已整理為小數點後 2 位")
        print(f"📁 檔案已儲存於：{csv_filename}")
        
        # 顯示最後幾筆，確認數字是否變漂亮了
        print("\n--- 整理後的數據預覽 ---")
        print(df.tail())

except Exception as e:
    print(f"❌ 發生錯誤: {e}")