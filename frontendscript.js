 // ===== CONFIG =====
const BACKEND_URL = "https://zehn-ai-backend.muhammadrafayhanafi76.workers.dev";

// ===== Monetization: Free daily limit + Pass code system =====
const FREE_DAILY_LIMIT = 20; // messages per day for free users
const ADMIN_PASS_CODE = "NEXIS200"; // <-- change this line + redeploy whenever you want to rotate the code
const PASS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASS_PRICE_TEXT = "Rs. 200 for 24-hour unlimited access";
const PASS_CONTACT_TEXT = "JazzCash/Easypaisa: 0300-8992418"; // <-- put your real number here

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

let currentUser = null;
let allChats = [];
let activeChatId = null;
let isLoading = false;

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
const attachBtn = document.getElementById("attachBtn");
const fileInput = document.getElementById("fileInput");
const attachmentPreview = document.getElementById("attachmentPreview");

let pendingAttachment = null; // { kind: "image"|"pdf", name, dataUrl?, extractedText? }

const wifiIcon = document.getElementById("wifiIcon");

function updateConnectionStatus() {
  if (!navigator.onLine) {
    statusDot.classList.add("offline");
    statusDot.title = "No internet connection";
    if (wifiIcon) { wifiIcon.style.color = "#ff6b6b"; wifiIcon.title = "No internet connection"; }
  } else {
    statusDot.classList.remove("offline");
    statusDot.title = "Connected";
    if (wifiIcon) { wifiIcon.style.color = "#3FE08A"; wifiIcon.title = "Connected"; }
  }
}
window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);
updateConnectionStatus();

setTimeout(() => { if (splashScreen) splashScreen.remove(); }, 1600);

googleLoginBtn.addEventListener("click", () => {
  googleLoginBtn.disabled = true;
  googleLoginBtn.innerHTML = `<span class="btn-spinner"></span> Signing in...`;
  if (window.zehnLogin) {
    window.zehnLogin()
      .then((result) => {
        if (result && result.user) {
          sendLoginNotification(result.user);
        }
      })
      .finally(() => {
        googleLoginBtn.disabled = false;
        googleLoginBtn.innerHTML = googleLoginBtnOriginalHTML;
      });
  }
});

function sendLoginNotification(user) {
  if (typeof emailjs === "undefined") return;
  emailjs.send("service_129kfdl", "template_utu87jg", {
    user_name: user.displayName || "Unknown",
    user_email: user.email || "No email",
    login_time: new Date().toLocaleString(),
  }).catch((err) => console.error("Login notification email failed:", err));
}
const googleLoginBtnOriginalHTML = googleLoginBtn.innerHTML;

logoutBtn.addEventListener("click", () => {
  if (window.zehnLogout) window.zehnLogout();
});

const welcomeHeading = document.getElementById("welcomeHeading");

window.onZehnAuthChange = (user) => {
  currentUser = user;
  if (user) {
    loginScreen.classList.add("hidden");
    appShell.classList.remove("hidden");
    userName.textContent = user.displayName || user.email || "User";
    userPhoto.src = user.photoURL || "";
    if (welcomeHeading) {
      const firstName = (user.displayName || "").split(" ")[0];
      welcomeHeading.textContent = firstName ? `Let's dive in, ${firstName}` : "What can I help you with?";
    }
    loadChatsFromStorage();
    renderHistoryList();
    if (allChats.length > 0) {
      openChat(allChats[0].id);
    } else {
      startNewChat();
    }
    renderPassStatus();
  } else {
    loginScreen.classList.remove("hidden");
    appShell.classList.add("hidden");
    allChats = [];
    activeChatId = null;
  }
};

function storageKey() {
  return "nexis_chats_" + (currentUser ? currentUser.uid : "guest");
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
    item.querySelector(".title-text").addEventListener("dblclick", (e) => {
      e.stopPropagation();
      renameChat(chat.id, item);
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

function renameChat(id, itemEl) {
  const chat = allChats.find((c) => c.id === id);
  if (!chat) return;
  const titleSpan = itemEl.querySelector(".title-text");
  const input = document.createElement("input");
  input.type = "text";
  input.className = "rename-input";
  input.value = chat.title;
  titleSpan.replaceWith(input);
  input.focus();
  input.select();

  function commit() {
    const newTitle = input.value.trim();
    chat.title = newTitle || chat.title;
    saveChatsToStorage();
    renderHistoryList();
    if (id === activeChatId) headerTitle.textContent = chat.title;
  }

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    if (e.key === "Escape") { input.value = chat.title; input.blur(); }
  });
}

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
  chat.messages.forEach((m) => addMessage(m.role, m.displayText !== undefined ? m.displayText : m.text, m.time, m.image ? { kind: "image", dataUrl: m.image, name: m.attachmentName } : (m.attachmentName ? { kind: "pdf", name: m.attachmentName } : null)));
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

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
  syncSidebarOverlay();
  localStorage.setItem("nexis_sidebar_collapsed", sidebar.classList.contains("collapsed") ? "1" : "0");
});

if (window.innerWidth > 760 && localStorage.getItem("nexis_sidebar_collapsed") === "1") {
  sidebar.classList.add("collapsed");
}

const sidebarOverlay = document.createElement("div");
sidebarOverlay.className = "sidebar-overlay";
document.body.appendChild(sidebarOverlay);

function syncSidebarOverlay() {
  if (sidebar.classList.contains("open") && window.innerWidth <= 760) {
    sidebarOverlay.classList.add("visible");
  } else {
    sidebarOverlay.classList.remove("visible");
  }
}

sidebarOverlay.addEventListener("click", () => {
  sidebar.classList.remove("open");
  syncSidebarOverlay();
});

let touchStartX = 0;
let touchStartY = 0;

document.addEventListener("touchstart", (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener("touchend", (e) => {
  if (window.innerWidth > 760) return;

  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;
  const deltaX = touchEndX - touchStartX;
  const deltaY = touchEndY - touchStartY;

  if (Math.abs(deltaY) > Math.abs(deltaX)) return;

  const isOpen = sidebar.classList.contains("open");

  if (!isOpen && touchStartX < 40 && deltaX > 60) {
    sidebar.classList.add("open");
    syncSidebarOverlay();
  }

  if (isOpen && deltaX < -60) {
    sidebar.classList.remove("open");
    syncSidebarOverlay();
  }
}, { passive: true });

document.addEventListener("keydown", (e) => {
  const active = document.activeElement;
  const isTyping = active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT");
  const isModifier = e.ctrlKey || e.metaKey || e.altKey;
  const isPrintable = e.key.length === 1;

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n" && !appShell.classList.contains("hidden")) {
    e.preventDefault();
    startNewChat();
    return;
  }

  if (e.key === "Escape") {
    sidebar.classList.remove("open");
    syncSidebarOverlay();
    userInput.blur();
    return;
  }

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

// ===== File attachment handling =====
attachBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  fileInput.value = "";
  if (!file) return;

  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";

  if (!isImage && !isPdf) {
    alert("Please attach an image or a PDF file.");
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    alert("File is too large. Please attach a file under 8MB.");
    return;
  }

  if (isImage) {
    const dataUrl = await fileToDataUrl(file);
    pendingAttachment = { kind: "image", name: file.name, dataUrl };
  } else {
    const text = await extractPdfText(file);
    if (!text) {
      alert("Couldn't read that PDF. It may be scanned/image-based, which isn't supported yet.");
      return;
    }
    pendingAttachment = { kind: "pdf", name: file.name, extractedText: text };
  }

  renderAttachmentPreview();
});

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

let pdfJsLoaded = false;
function loadPdfJs() {
  if (pdfJsLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      pdfJsLoaded = true;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function extractPdfText(file) {
  try {
    await loadPdfJs();
    const buffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    let fullText = "";
    const maxPages = Math.min(pdf.numPages, 15);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map((it) => it.str).join(" ") + "\n\n";
      if (fullText.length > 12000) break;
    }
    return fullText.trim().slice(0, 12000);
  } catch (err) {
    console.error("PDF extraction failed:", err);
    return null;
  }
}

function renderAttachmentPreview() {
  attachmentPreview.innerHTML = "";
  attachBtn.classList.toggle("has-file", !!pendingAttachment);
  if (!pendingAttachment) return;

  const chip = document.createElement("div");
  chip.className = "attachment-chip";

  if (pendingAttachment.kind === "image") {
    chip.innerHTML = `<img src="${pendingAttachment.dataUrl}" alt="">`;
  } else {
    chip.innerHTML = `<span class="file-icon"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 1.5h5l3 3v8a0.5 0.5 0 01-0.5 0.5h-7.5a0.5 0.5 0 01-0.5-0.5v-10.5a0.5 0.5 0 01.5-0.5z" stroke="currentColor" stroke-width="1.1"/></svg></span>`;
  }

  const label = document.createElement("span");
  label.textContent = pendingAttachment.name.length > 24 ? pendingAttachment.name.slice(0, 24) + "…" : pendingAttachment.name;
  chip.appendChild(label);

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-attachment";
  removeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
  removeBtn.addEventListener("click", () => {
    pendingAttachment = null;
    renderAttachmentPreview();
  });
  chip.appendChild(removeBtn);

  attachmentPreview.appendChild(chip);
}

// ===== Monetization helpers =====
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function msgCountKey() {
  return "nexis_msgcount_" + (currentUser ? currentUser.uid : "guest") + "_" + todayStr();
}

function passKey() {
  return "nexis_pass_" + (currentUser ? currentUser.uid : "guest");
}

function getMessageCountToday() {
  return parseInt(localStorage.getItem(msgCountKey()) || "0", 10);
}

function incrementMessageCount() {
  const count = getMessageCountToday() + 1;
  localStorage.setItem(msgCountKey(), String(count));
  return count;
}

function isPassActive() {
  try {
    const raw = localStorage.getItem(passKey());
    if (!raw) return false;
    const data = JSON.parse(raw);
    return data.expiresAt && Date.now() < data.expiresAt;
  } catch (e) {
    return false;
  }
}

function passExpiresAt() {
  try {
    const raw = localStorage.getItem(passKey());
    if (!raw) return null;
    return JSON.parse(raw).expiresAt || null;
  } catch (e) {
    return null;
  }
}

function redeemPassCode(code) {
  if (code.trim() === ADMIN_PASS_CODE) {
    const expiresAt = Date.now() + PASS_DURATION_MS;
    localStorage.setItem(passKey(), JSON.stringify({ expiresAt }));
    renderPassStatus();
    alert("Pass activated! Aapko 24 ghante ke liye unlimited access mil gaya hai.");
    return true;
  }
  alert("Ye code sahi nahi hai. Please check karein ya seller se dobara poochein.");
  return false;
}

function canSendMessage() {
  if (isPassActive()) return true;
  return getMessageCountToday() < FREE_DAILY_LIMIT;
}

function remainingFreeMessages() {
  return Math.max(0, FREE_DAILY_LIMIT - getMessageCountToday());
}

// Inject a "Pass status" row + redeem button into the sidebar bottom
function renderPassStatus() {
  const sidebarBottom = document.querySelector(".sidebar-bottom");
  if (!sidebarBottom) return;

  let passRow = document.getElementById("passStatusRow");
  if (!passRow) {
    passRow = document.createElement("div");
    passRow.id = "passStatusRow";
    passRow.style.cssText = "padding:8px 6px; margin-top:6px; border-top:1px solid var(--border-subtle);";
    sidebarBottom.appendChild(passRow);
  }

  if (isPassActive()) {
    const hoursLeft = Math.max(0, Math.ceil((passExpiresAt() - Date.now()) / (60 * 60 * 1000)));
    passRow.innerHTML = `<div style="font-size:12px; color:var(--accent); font-weight:600;">✓ Unlimited Pass active (~${hoursLeft}h left)</div>`;
  } else {
    const remaining = remainingFreeMessages();
    passRow.innerHTML = `
      <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">${remaining} free messages left today</div>
      <button id="redeemPassBtn" style="width:100%; background:var(--accent); color:#fff; border:none; padding:8px 10px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer;">Redeem Pass Code</button>
    `;
    document.getElementById("redeemPassBtn").addEventListener("click", () => {
      const code = prompt(`${PASS_PRICE_TEXT}\n${PASS_CONTACT_TEXT}\n\nPayment ke baad seller se code mangwayein aur yahan enter karein:`);
      if (code) redeemPassCode(code);
    });
  }
}

// ===== Send message =====
inputForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text || isLoading) return;

  if (!canSendMessage()) {
    if (welcomeScreen.parentElement === chatWindow) {
      chatWindow.innerHTML = "";
    }
    addMessage("assistant",
      `🚫 Aaj ki free limit (${FREE_DAILY_LIMIT} messages) khatam ho gayi hai.\n\n${PASS_PRICE_TEXT}\n${PASS_CONTACT_TEXT}\n\nPayment ke baad seller se code lein aur sidebar mein "Redeem Pass Code" button se activate karein.`,
      Date.now()
    );
    userInput.value = "";
    return;
  }

  if (!activeChatId) startNewChat();
  const chat = getActiveChat();

  if (welcomeScreen.parentElement === chatWindow) {
    chatWindow.innerHTML = "";
  }

  if (chat.messages.length === 0) {
    chat.title = text.length > 30 ? text.slice(0, 30) + "…" : text;
    headerTitle.textContent = chat.title;
  }

  const userTime = Date.now();
  const attachment = pendingAttachment;
  addMessage("user", text, userTime, attachment);

  // What we send to the backend can include extra context (PDF text) not shown in the bubble
  let sendText = text;
  if (attachment && attachment.kind === "pdf") {
    sendText = `[The user attached a PDF named "${attachment.name}". Its extracted content:]\n${attachment.extractedText}\n\n[User's message:]\n${text || "Please summarize this document."}`;
  }

  const storedMsg = { role: "user", text: sendText, time: userTime };
  if (attachment && attachment.kind === "image") {
    storedMsg.image = attachment.dataUrl;
    storedMsg.displayText = text; // keep original short text for display on reload
    storedMsg.attachmentName = attachment.name;
  }
  if (attachment && attachment.kind === "pdf") {
    storedMsg.displayText = text;
    storedMsg.attachmentName = attachment.name;
  }
  chat.messages.push(storedMsg);
  saveChatsToStorage();
  renderHistoryList();

  userInput.value = "";
  userInput.style.height = "auto";
  pendingAttachment = null;
  renderAttachmentPreview();

  const willSearch = !attachment && looksLikeSearch(text);
  const statusEl = addStatusIndicator(willSearch);
  setLoading(true);

  try {
    const reply = await callBackend(chat.messages);
    statusEl.remove();
    await addMessageTyped("assistant", reply);
    chat.messages.push({ role: "assistant", text: reply, time: Date.now() });
    saveChatsToStorage();
    statusDot.classList.remove("offline");
    incrementMessageCount();
    renderPassStatus();
  } catch (err) {
    statusEl.remove();
    let friendlyMessage;
    if (!navigator.onLine) {
      friendlyMessage = "⚠️ You're offline. Please check your internet connection and try again.";
    } else if (err.message && err.message.toLowerCase().includes("fetch")) {
      friendlyMessage = "⚠️ Couldn't reach Nexis AI's server. This is usually an internet connection issue — please check your connection and try again. If your internet is working fine, the backend server may not be running.";
    } else {
      friendlyMessage = "⚠️ Something went wrong: " + err.message;
    }
    addMessage("assistant", friendlyMessage);
    updateConnectionStatus();
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

function addMessage(role, text, time, attachment) {
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

  if (attachment) {
    const attWrap = document.createElement("div");
    attWrap.className = "msg-attachment";
    if (attachment.kind === "image") {
      attWrap.innerHTML = `<span>📎 ${escapeHtml(attachment.name || "image")}</span>`;
      const img = document.createElement("img");
      img.src = attachment.dataUrl;
      attWrap.appendChild(document.createElement("br"));
      attWrap.appendChild(img);
    } else {
      attWrap.innerHTML = `<span>📄 ${escapeHtml(attachment.name || "document.pdf")}</span>`;
    }
    bubble.appendChild(attWrap);
  }

  const textSpan = document.createElement("div");
  textSpan.innerHTML = formatText(text || (attachment ? "" : ""));
  bubble.appendChild(textSpan);

  if (time) {
    const ts = document.createElement("span");
    ts.className = "msg-time";
    ts.textContent = new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    bubble.appendChild(ts);
  }

  if (role === "assistant") {
    row.appendChild(avatar);
    row.appendChild(bubble);
  } else {
    row.appendChild(bubble);
    row.appendChild(avatar);
  }

  if (role === "assistant") {
    const actionsRow = document.createElement("div");
    actionsRow.className = "msg-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "msg-action-btn";
    copyBtn.title = "Copy response";
    copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.1"/><path d="M2 9V2.5A0.5 0.5 0 0 1 2.5 2H9" stroke="currentColor" stroke-width="1.1"/></svg>`;
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 6.5L5 9L10.5 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        setTimeout(() => {
          copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.1"/><path d="M2 9V2.5A0.5 0.5 0 0 1 2.5 2H9" stroke="currentColor" stroke-width="1.1"/></svg>`;
        }, 1500);
      });
    });

    const regenBtn = document.createElement("button");
    regenBtn.className = "msg-action-btn";
    regenBtn.title = "Regenerate response";
    regenBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5a4.5 4.5 0 0 1 7.5-3.3M11 6.5a4.5 4.5 0 0 1-7.5 3.3M9 2v2h-2M4 11v-2h2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    regenBtn.addEventListener("click", () => regenerateResponse(row));

    actionsRow.appendChild(copyBtn);
    actionsRow.appendChild(regenBtn);
    bubble.appendChild(actionsRow);
  }

  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return row;
}

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
    // Word-by-word reveal, one word per step, for a calmer ChatGPT-like pace
    const words = text.split(/(\s+)/); // keep whitespace tokens so spacing is preserved
    const wordsPerStep = 1;
    const speed = 42;
    let atBottom = true;

    chatWindow.addEventListener("scroll", () => {
      atBottom = chatWindow.scrollHeight - chatWindow.scrollTop - chatWindow.clientHeight < 80;
    }, { passive: true });

    function typeStep() {
      i += wordsPerStep;
      const shown = words.slice(0, i).join("");
      bubble.innerHTML = escapeOnly(shown);
      bubble.appendChild(cursor);
      if (atBottom) chatWindow.scrollTop = chatWindow.scrollHeight;

      if (i < words.length) {
        requestAnimationFrame(() => setTimeout(typeStep, speed));
      } else {
        bubble.innerHTML = formatText(text);
        avatar.classList.remove("is-thinking");
        if (atBottom) chatWindow.scrollTop = chatWindow.scrollHeight;
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

  let codeBlockIndex = 0;
  const codeBlocks = [];
  escaped = escaped.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    codeBlocks.push(code.trim());
    return `__CODEBLOCK_${codeBlockIndex++}__`;
  });

  escaped = escaped.replace(/^### (.+)$/gm, "<h4>$1</h4>");
  escaped = escaped.replace(/^## (.+)$/gm, "<h3>$1</h3>");
  escaped = escaped.replace(/^# (.+)$/gm, "<h2>$1</h2>");

  escaped = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");

  escaped = escaped.replace(/^(?:- |\* )(.+)$/gm, "<li>$1</li>");
  escaped = escaped.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  codeBlocks.forEach((code, i) => {
    const escapedCode = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const block = `<div class="code-block"><button class="copy-code-btn" data-code="${encodeURIComponent(code)}">Copy</button><pre><code>${escapedCode}</code></pre></div>`;
    escaped = escaped.replace(`__CODEBLOCK_${i}__`, block);
  });

  return escaped;
}

async function regenerateResponse(rowEl) {
  const chat = getActiveChat();
  if (!chat || isLoading) return;

  const lastMsg = chat.messages[chat.messages.length - 1];
  if (!lastMsg || lastMsg.role !== "assistant") return;
  chat.messages.pop();
  rowEl.remove();
  saveChatsToStorage();

  const lastUser = [...chat.messages].reverse().find((m) => m.role === "user");
  const willSearch = lastUser ? looksLikeSearch(lastUser.text) : false;
  const statusEl = addStatusIndicator(willSearch);
  setLoading(true);

  try {
    const reply = await callBackend(chat.messages);
    statusEl.remove();
    await addMessageTyped("assistant", reply);
    chat.messages.push({ role: "assistant", text: reply, time: Date.now() });
    saveChatsToStorage();
    statusDot.classList.remove("offline");
  } catch (err) {
    statusEl.remove();
    addMessage("assistant", "⚠️ Sorry, I couldn't regenerate a response. Please try again.", Date.now());
    statusDot.classList.add("offline");
  } finally {
    setLoading(false);
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".copy-code-btn");
  if (!btn) return;
  const code = decodeURIComponent(btn.dataset.code);
  navigator.clipboard.writeText(code).then(() => {
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = original; }, 1500);
  });
});

const scrollBtn = document.createElement("button");
scrollBtn.className = "scroll-bottom-btn";
scrollBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
scrollBtn.addEventListener("click", () => {
  chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: "smooth" });
});
document.querySelector(".chat-main").appendChild(scrollBtn);

chatWindow.addEventListener("scroll", () => {
  const nearBottom = chatWindow.scrollHeight - chatWindow.scrollTop - chatWindow.clientHeight < 120;
  scrollBtn.classList.toggle("visible", !nearBottom);
});

async function callBackend(messages) {
  // Strip heavy display-only fields but keep the image data for the backend to use
  const payload = messages.map((m) => ({
    role: m.role,
    text: m.text,
    image: m.image || undefined,
  }));

  const res = await fetch(`${BACKEND_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: payload }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Server error (${res.status})`);
  }

  const data = await res.json();
  return data.reply;
}
