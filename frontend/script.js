 // ===== CONFIG =====
const BACKEND_URL = "https://zehn-ai-backend.muhammadrafayhanafi76.workers.dev";
 
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
