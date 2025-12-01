import yfinance as yf
import pandas as pd

# ==========================================
# 1. 設定欲抓取的股票
# ==========================================
print("👉 請輸入多個股票代號，用「空白鍵」隔開")
print("   範例：0050 2330 0056")
user_input = input("請輸入：").strip()

# 將輸入的字串切分成串列 (List)
raw_tickers = user_input.split()

# 自動加上 .TW (如果是上櫃請手動輸入 .TWO，這裡預設處理上市)
ticker_list = []
for t in raw_tickers:
    t = t.upper()
    if not t.endswith('.TW') and not t.endswith('.TWO'):
        ticker_list.append(f"{t}.TW")
    else:
        ticker_list.append(t)

print(f"\n🚀 準備下載以下標的：{ticker_list}")

try:
    # ==========================================
    # 2. 一次下載所有資料
    # ==========================================
    # 這裡會下載所有標的的所有欄位 (Open, High, Low, Close...)
    # auto_adjust=True: 使用還原權值股價
    data = yf.download(ticker_list, start="2000-01-01", auto_adjust=True)
    
    if data.empty:
        print("❌ 下載失敗，找不到資料。")
    else:
        # ==========================================
        # 3. 關鍵步驟：只選取 'Close' 欄位
        # ==========================================
        # yfinance 下載多檔時，資料結構是 (價格類別, 股票代號)
        # 我們直接選取 'Close'，pandas 會自動幫我們把不同股票排成不同欄位
        df_close = data['Close']
        
        # 四捨五入到小數點後 2 位
        df_close = df_close.round(2)
        
        # 依照日期排序 (通常預設就是排好的，但保險起見)
        df_close.sort_index(ascending=True, inplace=True)

        # ==========================================
        # 4. 存檔
        # ==========================================
        filename = "stocks_compare.csv"
        df_close.to_csv(filename, encoding='utf-8-sig')
        
        print(f"\n✅ 成功下載！")
        print(f"📄 資料包含：{', '.join(df_close.columns)}")
        print(f"📁 檔案已儲存為：{filename}")
        
        print("\n--- 資料預覽 (最後 5 天) ---")
        print(df_close.tail())

except Exception as e:
    print(f"❌ 發生錯誤: {e}")