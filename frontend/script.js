 // ===== CONFIG =====
const BACKEND_URL = "http://localhost:3000";
 
// Mirror of backend's search trigger keywords (for showing "Searching the web..." live)
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
 
function looksLikeSearch(text) {
  const lower = text.toLowerCase();
  if (YEAR_PATTERN.test(text)) return true;
  return SEARCH_TRIGGERS.some((kw) => lower.includes(kw));
}
 
// ===== State =====
let currentUser = null;
let allChats = [];
let activeChatId = null;
let isLoading = false;
 
// ===== DOM refs =====
const splashScreen = document.getElementById("splashScreen");
const loginScreen = document.getElementById("loginScreen");
const appShell = document.getElementById("appShell");
const googleLoginBtn = document.getElementById("googleLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userPhoto = document.getElementById("userPhoto");
const userName = document.getElementById("userName");
 
const chatWindow = document.getElementById("chatWindow");
const welcomeScreen = document.getElementById("welcomeScreen");
const inputForm = document.getElementById("inputForm");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const headerTitle = document.getElementById("headerTitle");
const statusDot = document.getElementById("statusDot");
const historyList = document.getElementById("historyList");
 
// Remove splash from the DOM after its animation finishes
setTimeout(() => { if (splashScreen) splashScreen.remove(); }, 2100);
 
// ===== Auth wiring =====
googleLoginBtn.addEventListener("click", () => {
  if (window.zehnLogin) window.zehnLogin();
});
 
logoutBtn.addEventListener("click", () => {
  if (window.zehnLogout) window.zehnLogout();
});
 
window.onZehnAuthChange = (user) => {
  currentUser = user;
  if (user) {
    loginScreen.classList.add("hidden");
    appShell.classList.remove("hidden");
    userName.textContent = user.displayName || user.email || "User";
    userPhoto.src = user.photoURL || "";
    loadChatsFromStorage();
    renderHistoryList();
    if (allChats.length > 0) {
      openChat(allChats[0].id);
    } else {
      startNewChat();
    }
  } else {
    loginScreen.classList.remove("hidden");
    appShell.classList.add("hidden");
    allChats = [];
    activeChatId = null;
  }
};
 
// ===== localStorage helpers =====
function storageKey() {
  return "zehn_chats_" + (currentUser ? currentUser.uid : "guest");
}
 
function loadChatsFromStorage() {
  try {
    const raw = localStorage.getItem(storageKey());
    allChats = raw ? JSON.parse(raw) : [];
  } catch (e) {
    allChats = [];
  }
}
 
function saveChatsToStorage() {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(allChats));
  } catch (e) {
    console.error("Could not save chat history:", e);
  }
}
 
function getActiveChat() {
  return allChats.find((c) => c.id === activeChatId);
}
 
// ===== Sidebar history rendering =====
function renderHistoryList() {
  historyList.innerHTML = '<p class="suggestions-label">Recent chats</p>';
  allChats.forEach((chat) => {
    const item = document.createElement("button");
    item.className = "history-item" + (chat.id === activeChatId ? " active" : "");
    item.innerHTML = `
      <span class="title-text">${escapeHtml(chat.title || "New chat")}</span>
      <span class="delete-chat" data-id="${chat.id}">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3.5h9M5 3.5V2h3v1.5M3 3.5l.5 7.5h5l.5-7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
      </span>
    `;
    item.addEventListener("click", (e) => {
      if (e.target.closest(".delete-chat")) return;
      openChat(chat.id);
    });
    item.querySelector(".delete-chat").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteChat(chat.id);
    });
    historyList.appendChild(item);
  });
}
 
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
 
function deleteChat(id) {
  allChats = allChats.filter((c) => c.id !== id);
  saveChatsToStorage();
  if (activeChatId === id) {
    if (allChats.length > 0) {
      openChat(allChats[0].id);
    } else {
      startNewChat();
    }
  } else {
    renderHistoryList();
  }
}
 
// ===== Chat lifecycle =====
function startNewChat() {
  const newChat = { id: "chat_" + Date.now(), title: "New chat", messages: [] };
  allChats.unshift(newChat);
  activeChatId = newChat.id;
  saveChatsToStorage();
  renderHistoryList();
  renderMessages();
  headerTitle.textContent = "New Conversation";
}
 
function openChat(id) {
  activeChatId = id;
  renderHistoryList();
  renderMessages();
  const chat = getActiveChat();
  headerTitle.textContent = chat && chat.title ? chat.title : "New Conversation";
}
 
newChatBtn.addEventListener("click", startNewChat);
 
function renderMessages() {
  chatWindow.innerHTML = "";
  const chat = getActiveChat();
  if (!chat || chat.messages.length === 0) {
    chatWindow.appendChild(welcomeScreen);
    welcomeScreen.style.display = "flex";
    welcomeScreen.style.flexDirection = "column";
    return;
  }
  chat.messages.forEach((m) => addMessage(m.role, m.text));
  chatWindow.scrollTop = chatWindow.scrollHeight;
}
 
// ===== Auto-resize textarea =====
userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 160) + "px";
});
 
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    inputForm.requestSubmit();
  }
});
 
sidebarToggle.addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
  sidebar.classList.toggle("open");
});
 
// Auto-focus input when typing anywhere on the page
document.addEventListener("keydown", (e) => {
  const active = document.activeElement;
  const isTyping = active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT");
  const isModifier = e.ctrlKey || e.metaKey || e.altKey;
  const isPrintable = e.key.length === 1;
 
  if (!isTyping && !isModifier && isPrintable && !appShell.classList.contains("hidden")) {
    userInput.focus();
  }
});
 
document.addEventListener("click", (e) => {
  const chip = e.target.closest(".suggestion-chip");
  if (chip) {
    userInput.value = chip.dataset.prompt;
    inputForm.requestSubmit();
  }
});
 
// ===== Send message =====
inputForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text || isLoading) return;
 
  if (!activeChatId) startNewChat();
  const chat = getActiveChat();
 
  if (welcomeScreen.parentElement === chatWindow) {
    chatWindow.innerHTML = "";
  }
 
  if (chat.messages.length === 0) {
    chat.title = text.length > 30 ? text.slice(0, 30) + "…" : text;
    headerTitle.textContent = chat.title;
  }
 
  addMessage("user", text);
  chat.messages.push({ role: "user", text });
  saveChatsToStorage();
  renderHistoryList();
 
  userInput.value = "";
  userInput.style.height = "auto";
 
  const willSearch = looksLikeSearch(text);
  const statusEl = addStatusIndicator(willSearch);
  setLoading(true);
 
  try {
    const reply = await callBackend(chat.messages);
    statusEl.remove();
    await addMessageTyped("assistant", reply);
    chat.messages.push({ role: "assistant", text: reply });
    saveChatsToStorage();
    statusDot.classList.remove("offline");
  } catch (err) {
    statusEl.remove();
    addMessage("assistant", "⚠️ Sorry, I couldn't respond right now. Please check if the backend is running.\n\n(Error: " + err.message + ")");
    statusDot.classList.add("offline");
  } finally {
    setLoading(false);
  }
});
 
function setLoading(state) {
  isLoading = state;
  sendBtn.disabled = state;
}
 
function assistantAvatarSVG() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="4" cy="6" r="2" fill="currentColor" opacity="0.5"/><circle cx="20" cy="6" r="2" fill="currentColor" opacity="0.5"/><circle cx="4" cy="18" r="2" fill="currentColor" opacity="0.5"/><circle cx="20" cy="18" r="2" fill="currentColor" opacity="0.5"/></svg>`;
}
 
function addMessage(role, text) {
  const row = document.createElement("div");
  row.className = `message-row ${role}`;
 
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  if (role === "assistant") {
    avatar.innerHTML = assistantAvatarSVG();
  } else if (currentUser && currentUser.photoURL) {
    avatar.innerHTML = `<img src="${currentUser.photoURL}" alt="">`;
  } else {
    avatar.innerHTML = `<span>You</span>`;
  }
 
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = formatText(text);
 
  if (role === "assistant") {
    row.appendChild(avatar);
    row.appendChild(bubble);
  } else {
    row.appendChild(bubble);
    row.appendChild(avatar);
  }
 
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return row;
}
 
// ===== Status indicator: "Searching the web..." or "Thinking..." with blinking avatar =====
function addStatusIndicator(isSearching) {
  const row = document.createElement("div");
  row.className = "message-row assistant";
  row.innerHTML = `
    <div class="avatar is-thinking">${assistantAvatarSVG()}</div>
    <div class="bubble">
      <div class="status-row">
        <span class="status-icon">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 4"/></svg>
        </span>
        <span class="status-text status-text-shimmer">${isSearching ? "Searching the web…" : "Thinking…"}</span>
      </div>
    </div>`;
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return row;
}
 
// ===== Typing animation render (fast) =====
function addMessageTyped(role, text) {
  return new Promise((resolve) => {
    const row = document.createElement("div");
    row.className = `message-row ${role}`;
 
    const avatar = document.createElement("div");
    avatar.className = "avatar is-thinking";
    avatar.innerHTML = assistantAvatarSVG();
 
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    const cursor = document.createElement("span");
    cursor.className = "cursor-blink";
    bubble.appendChild(cursor);
 
    row.appendChild(avatar);
    row.appendChild(bubble);
    chatWindow.appendChild(row);
    chatWindow.scrollTop = chatWindow.scrollHeight;
 
    let i = 0;
    // Faster: bigger chunks, shorter delay
    const chunkSize = Math.max(2, Math.round(text.length / 60));
    const speed = 6;
 
    function typeStep() {
      i += chunkSize;
      const shown = text.slice(0, i);
      bubble.innerHTML = escapeOnly(shown);
      bubble.appendChild(cursor);
      chatWindow.scrollTop = chatWindow.scrollHeight;
 
      if (i < text.length) {
        setTimeout(typeStep, speed);
      } else {
        bubble.innerHTML = formatText(text);
        avatar.classList.remove("is-thinking");
        chatWindow.scrollTop = chatWindow.scrollHeight;
        resolve(row);
      }
    }
    typeStep();
  });
}
 
function escapeOnly(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
 
function formatText(text) {
  let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  escaped = escaped.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
  escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return escaped;
}
 
async function callBackend(messages) {
  const res = await fetch(`${BACKEND_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
 
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Server error (${res.status})`);
  }
 
  const data = await res.json();
  return data.reply;
}
 