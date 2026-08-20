 require("dotenv").config();
const express = require("express");
const cors = require("cors");
 
const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
 
// Two models:
// - MAIN_MODEL: fast, high-quality general model (no built-in search)
// - SEARCH_MODEL: Groq's Compound Mini system — has built-in web search,
//   so no separate search API call is needed. Single request, faster overall.
const MAIN_MODEL = "openai/gpt-oss-120b";
const SEARCH_MODEL = "groq/compound-mini";
 
app.use(cors());
app.use(express.json({ limit: "2mb" }));


 
const SYSTEM_INSTRUCTION = `You are "Zehn AI" — a helpful, intelligent, general-purpose AI assistant used by people worldwide.
You help with anything: answering questions, coding, writing, translation, explanations, math, research, and general guidance.
Your tone is professional yet warm and approachable — adjust formality to match the user's tone.
Always respond in the same language the user writes in. Default to English when unsure.
Keep answers clear, well-structured, and helpful. Use examples or code where useful.
When you have access to live web search results, answer confidently and directly from them — do not say you lack real-time access. If a match or event has clearly concluded based on the results, state the outcome as fact.`;
 
const SEARCH_TRIGGERS = [
  "today", "latest", "current", "currently", "now", "recent", "news",
  "score", "weather", "price", "stock", "who is the", "when is", "when did",
  "this year", "this week", "aaj", "abhi", "taaza", "mausam",
  "cricket", "match", "live", "playing", "vs", "series", "tournament",
  "won", "winning", "result", "results", "standings", "ranking", "kaun jeeta",
  "world cup", "fifa", "olympics", "election", "champion", "champions league",
  "final", "finals", "released", "launched", "announced", "happened", "who won",
  "world record", "update", "update on", "kya hua", "hua tha",
  "ipl", "psl", "super bowl", "wimbledon", "us open", "grand slam",
  "oscars", "oscar", "grammy", "grammys", "nobel", "ballon d'or",
  "budget", "exchange rate", "interest rate", "gdp", "inflation",
  "premier league", "la liga", "nba finals", "playoffs", "asia cup",
  "t20", "odi", "test series", "prime minister", "president of",
  "ceo of", "new movie", "box office"
];
 
const YEAR_PATTERN = /\b(202[3-9]|203[0-9])\b/;
 
function needsWebSearch(text) {
  const lower = text.toLowerCase();
  if (YEAR_PATTERN.test(text)) return true;
  return SEARCH_TRIGGERS.some((kw) => lower.includes(kw));
}
 
app.get("/", (req, res) => {
  res.send("Zehn AI backend is running");
});
 
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
 
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY is not set in the backend .env file." });
    }
 
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "A messages array is required." });
    }
 
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const usedWebSearch = lastUserMessage ? needsWebSearch(lastUserMessage.text) : false;
    const modelToUse = usedWebSearch ? SEARCH_MODEL : MAIN_MODEL;
 
    const chatMessages = [
      { role: "system", content: SYSTEM_INSTRUCTION },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.text,
      })),
    ];
 
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });
 
    const data = await groqRes.json();
 
    if (!groqRes.ok) {
      console.error("Groq API error:", data);
      return res.status(groqRes.status).json({
        error: data && data.error && data.error.message ? data.error.message : "Error from Groq API.",
      });
    }
 
    const reply =
      data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : "Sorry, I couldn't generate a response.";
 
    res.json({ reply, usedWebSearch });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Something went wrong on the server." });
  }
});
 
app.post("/api/title", async (req, res) => {
  try {
    const { message } = req.body;
    if (!GROQ_API_KEY || !message) {
      return res.status(400).json({ title: null });
    }
 
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MAIN_MODEL,
        messages: [
          {
            role: "system",
            content: "Generate a short, clear chat title (3-6 words) summarizing what the user is asking about. Reply with ONLY the title text — no quotes, no punctuation at the end, no extra commentary.",
          },
          { role: "user", content: message },
        ],
        temperature: 0.4,
        max_tokens: 20,
      }),
    });
 
    const data = await groqRes.json();
    const title =
      data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content.trim().replace(/^["']|["']$/g, "")
        : null;
 
    res.json({ title });
  } catch (err) {
    console.error("Title generation error:", err);
    res.json({ title: null });
  }
});
 
app.listen(PORT, () => {
  console.log("Zehn AI backend is running: http://localhost:" + PORT);
});
 


