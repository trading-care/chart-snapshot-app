const express = require("express");
const axios = require("axios");
const { RSI, SMA } = require("technicalindicators");
const cors = require("cors");

const app = express();
app.use(cors());

const symbols = ["BINANCE:BTCUSDT", "BINANCE:ETHUSDT", "BINANCE:SOLUSDT"]; // có thể dùng list từ Google Sheets
const TAAPI_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbHVlIjoiNjdmYjk4Y2Y4MDZmZjE2NTFlYTE2OWQzIiwiaWF0IjoxNzQ0NTQxOTMwLCJleHAiOjMzMjQ5MDA1OTMwfQ.RUxCk4gLcfg0eVtHqpaHyme8WV2vA_ofkcId9YBMggc';
async function fetchOHLCV(symbol, interval = "60") {
  const url = `https://api.taapi.io/ohlcv?secret=${TAAPI_KEY}&exchange=binance&symbol=${symbol.replace('BINANCE:', '')}&interval=${interval}`;
  const res = await axios.get(url);
  return res.data?.candles?.slice(-100); // lấy 100 cây nến gần nhất
}

function detectGoldenCross(ma50, ma200) {
  if (ma50.length < 2 || ma200.length < 2) return false;
  return ma50[ma50.length - 2] < ma200[ma200.length - 2] &&
         ma50[ma50.length - 1] > ma200[ma200.length - 1];
}

app.get("/api/screener", async (req, res) => {
  const interval = req.query.interval || "60"; // mặc định 1H
  const results = [];

  for (const symbol of symbols) {
    try {
      const ohlcv = await fetchOHLCV(symbol, interval);
      const closePrices = ohlcv.map(c => c.close);
      const volumes = ohlcv.map(c => c.volume);

      const rsi = RSI.calculate({ values: closePrices, period: 14 }).pop();
      const ma50 = SMA.calculate({ values: closePrices, period: 50 });
      const ma200 = SMA.calculate({ values: closePrices, period: 200 });

      const goldenCross = detectGoldenCross(ma50, ma200);

      const avgVolume = volumes.slice(-20, -1).reduce((a, b) => a + b, 0) / 20;
      const volumeSpike = volumes[volumes.length - 1] > avgVolume * 2;

      let signal = [];
      if (rsi > 70) signal.push("RSI > 70");
      if (rsi < 30) signal.push("RSI < 30");
      if (goldenCross) signal.push("Golden Cross");
      if (volumeSpike) signal.push("Volume Spike");

      if (signal.length) {
        results.push({
          symbol,
          rsi: rsi.toFixed(2),
          volume: volumes[volumes.length - 1],
          signal: signal.join(", "),
        });
      }

    } catch (err) {
      console.error(`Error fetching ${symbol}:`, err.message);
    }
  }

  res.json({ results });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Web App running on port", PORT));
