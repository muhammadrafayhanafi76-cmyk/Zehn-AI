require("dotenv").config();
 require("dotenv").config();
const express = require("express");
const cors = require("cors");
 
const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const GROQ_MODEL = "openai/gpt-oss-120b"; // newer, stronger model, still free & fast on Groq
 
app.use(cors());
app.use(express.json({ limit: "2mb" }));
 
const SYSTEM_INSTRUCTION = `You are "Zehn AI" — a helpful, intelligent, general-purpose AI assistant used by people worldwide.
You help with anything: answering questions, coding, writing, translation, explanations, math, research, and general guidance.
Your tone is professional yet warm and approachable — adjust formality to match the user's tone.
Always respond in the same language the user writes in. Default to English when unsure.
Keep answers clear, well-structured, and helpful. Use examples or code where useful.
If you are given "Web search results" in the conversation, treat them as the most current and reliable source available — use them directly and confidently to answer, even for fast-changing topics like live sports scores, news, or prices. Do not say you lack real-time access if search results were provided — just answer from them. If the search results are genuinely insufficient (e.g. a match is still in progress and results only show pre-match info), say what you found and note that it may not reflect the very latest score — but if the results show a completed match or final result, state it clearly and confidently as fact. Cite source names naturally in your answer (not raw URLs).`;
 
// Keywords that suggest the user wants current / real-time information
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
 
// Any 4-digit year from 2023 onwards in the message also triggers a search,
// so this stays future-proof without needing manual keyword updates every year.
const YEAR_PATTERN = /\b(202[3-9]|203[0-9])\b/;
 
function needsWebSearch(text) {
  const lower = text.toLowerCase();
  if (YEAR_PATTERN.test(text)) return true;
  return SEARCH_TRIGGERS.some((kw) => lower.includes(kw));
}
 
async function webSearch(query) {
  if (!TAVILY_API_KEY) return null;
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: "advanced",
        max_results: 6,
        include_answer: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("Tavily error:", data);
      return null;
    }
    return data;
  } catch (err) {
    console.error("Tavily fetch failed:", err);
    return null;
  }
}
 
function formatSearchResults(data) {
  if (!data) return "";
  let out = "Web search results:\n";
  if (data.answer) {
    out += `Quick answer: ${data.answer}\n\n`;
  }
  if (Array.isArray(data.results)) {
    data.results.forEach((r, i) => {
      out += `[${i + 1}] ${r.title}\n${r.content}\n(Source: ${r.url})\n\n`;
    });
  }
  return out;
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
    let searchContext = "";
 
    console.log("User asked:", lastUserMessage ? lastUserMessage.text : "none");
    console.log("Needs search?", lastUserMessage ? needsWebSearch(lastUserMessage.text) : false);
    if (lastUserMessage && needsWebSearch(lastUserMessage.text)) {
      console.log("Calling Tavily...");
      const searchData = await webSearch(lastUserMessage.text);
      console.log("Tavily returned:", searchData ? "data received" : "null/failed");
      if (searchData) {
        searchContext = formatSearchResults(searchData);
      }
    }
 
    const chatMessages = [
      { role: "system", content: SYSTEM_INSTRUCTION },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.text,
      })),
    ];
 
    if (searchContext) {
      chatMessages.splice(chatMessages.length - 1, 0, {
        role: "system",
        content: searchContext,
      });
    }
 
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: chatMessages,
        temperature: 0.8,
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
 
    res.json({ reply: reply, usedWebSearch: !!searchContext });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Something went wrong on the server." });
  }
});
 
app.listen(PORT, () => {
  console.log("Zehn AI backend is running: http://localhost:" + PORT);
});
 
