# 每日運動飲食紀錄（Netlify 版 · 綠色設計）

## 這次更新了什麼

1. **食物改成手掌測量法 + 手動輸入**，不再呼叫 AI 分析照片——完全免費、零延遲。可以選擇性附上一張照片，
   但那張照片只會在手機本機壓縮存成小縮圖，純粹當作個人備忘，不會上傳到任何地方、不會產生費用。
2. **整個介面重新設計**：淺米色底、綠色為主，柔霧光暈背景、大數字搭配圓環進度。
3. **運動估算改用 Groq（完全免費）**，不再需要 Anthropic 金鑰。Groq 提供永久免費額度（每分鐘 30 次請求、
   每天最多上千次），對個人記錄用量來說綽綽有餘。

## 檔案結構

```
netlify-food-tracker/
├── index.html                          前端頁面（資料存在瀏覽器 localStorage）
├── manifest.json / sw.js / icon-*.png  PWA：加到主畫面、全螢幕、離線開啟
├── netlify.toml                        Netlify 設定
└── netlify/functions/
    ├── analyze-food.js                 目前未使用（保留，之後想恢復 AI 拍照分析可以再接回來，用的是 Anthropic API）
    └── analyze-exercise.js             運動熱量估算（呼叫 Groq API，免費）
```

## 部署步驟

### 1. 申請 Groq API 金鑰（完全免費，只有運動估算會用到）
1. 到 https://console.groq.com 註冊/登入（不需要信用卡）
2. 左側找到 API Keys → Create API Key，複製金鑰（格式類似 `gsk_...`）
3. 免費額度：每分鐘 30 次請求、每天最多約 1,000 次，個人記錄用量完全夠用，不會被收費

### 2. 部署到 Netlify
1. 到 https://app.netlify.com 註冊/登入
2. 把這個資料夾整個拖曳到首頁的部署區塊
3. 部署完成後，到 Project configuration → Environment variables，新增：
   - Key: `GROQ_API_KEY`
   - Value: 剛剛複製的金鑰（`gsk_` 開頭那一串）
4. 回到 Deploys，點 Trigger deploy → Deploy site 讓環境變數生效

### 3. 加到手機主畫面
用手機瀏覽器打開 Netlify 給你的網址，選單裡點「加入主畫面 / Add to Home Screen」，
因為網址是你自己的網域，點開圖示後會直接全螢幕顯示這個 App，不會跳去 Claude。

## 之後想改設計或功能

- 顏色/字體/版面：直接編輯 `index.html` 最上面 `<style>` 裡的 CSS 變數（`--paper`、`--fern`、`--accent` 等）
- 想把運動也改成手動輸入（完全不用 API）：跟我說，我可以幫你移除 `analyze-exercise` 的呼叫
- 手掌測量法的份量單位（熱量/蛋白質數值）在 `index.html` 裡的 `HAND_UNITS` 物件，想調整數值可以直接改
