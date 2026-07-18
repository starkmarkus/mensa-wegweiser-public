const messagesEl = document.querySelector("#messages");
const homeStageEl = document.querySelector("#homeStage");
const formEl = document.querySelector("#chatForm");
const questionGhostEl = document.querySelector("#questionGhost");
const inputEl = document.querySelector("#questionInput");
const postcodeInputEl = document.querySelector("#postcodeInput");
const locsecBadgeEl = document.querySelector("#locsecBadge");
const accessGateEl = document.querySelector("#accessGate");
const accessFormEl = document.querySelector("#accessForm");
const accessPasswordInputEl = document.querySelector("#accessPasswordInput");
const accessErrorEl = document.querySelector("#accessError");
const chatPanelEl = document.querySelector(".chat-panel");
const infoButtonEl = document.querySelector("#infoButton");
const infoModalEl = document.querySelector("#botInfoModal");
const infoModalCloseEl = document.querySelector("#botInfoClose");
const feedbackButtonEl = document.querySelector("#feedbackButton");
const feedbackModalEl = document.querySelector("#feedbackModal");
const feedbackModalCloseEl = document.querySelector("#feedbackClose");
const feedbackFormEl = document.querySelector("#feedbackForm");
const feedbackStatusEl = document.querySelector("#feedbackStatus");
const introQuestions = Array.from(document.querySelectorAll(".suggestions button")).map((button) =>
  button.textContent.trim()
);

let isGenerating = false;
let activePostcode = "";
let activeLocSec = "";
let accessPassword = "";
let introAnimationToken = 0;
let introAnimationRunning = false;
let conversationHistory = [];

const locsecPrefixRanges = [
  { start: 5200, end: 5299, locsec: "Aachen" },
  { start: 6370, end: 6399, locsec: "Aschaffenburg" },
  { start: 300, end: 399, locsec: "Berlin & Brandenburg" },
  { start: 1000, end: 1699, locsec: "Berlin & Brandenburg" },
  { start: 1726, end: 1729, locsec: "Berlin & Brandenburg" },
  { start: 7820, end: 7849, locsec: "Bodensee" },
  { start: 8800, end: 8899, locsec: "Bodensee" },
  { start: 3800, end: 3880, locsec: "Braunschweig" },
  { start: 6400, end: 6499, locsec: "Darmstadt" },
  { start: 4000, end: 4399, locsec: "Düsseldorf" },
  { start: 6000, end: 6369, locsec: "Frankfurt" },
  { start: 6576, end: 6576, locsec: "Frankfurt" },
  { start: 6582, end: 6599, locsec: "Frankfurt" },
  { start: 7700, end: 7819, locsec: "Freiburg" },
  { start: 7850, end: 7999, locsec: "Freiburg" },
  { start: 3600, end: 3699, locsec: "Fulda" },
  { start: 3400, end: 3441, locsec: "Göttingen-Kassel" },
  { start: 3444, end: 3499, locsec: "Göttingen-Kassel" },
  { start: 3700, end: 3767, locsec: "Göttingen-Kassel" },
  { start: 3769, end: 3799, locsec: "Göttingen-Kassel" },
  { start: 5800, end: 5839, locsec: "Hagen" },
  { start: 5850, end: 5899, locsec: "Hagen" },
  { start: 2000, end: 2392, locsec: "Hamburg" },
  { start: 2455, end: 2457, locsec: "Hamburg" },
  { start: 2463, end: 2464, locsec: "Hamburg" },
  { start: 2500, end: 2549, locsec: "Hamburg" },
  { start: 5900, end: 5999, locsec: "Hamm, Arnsberg" },
  { start: 2900, end: 2940, locsec: "Hannover" },
  { start: 2942, end: 3159, locsec: "Hannover" },
  { start: 3161, end: 3170, locsec: "Hannover" },
  { start: 3172, end: 3199, locsec: "Hannover" },
  { start: 7500, end: 7536, locsec: "Karlsruhe" },
  { start: 7540, end: 7671, locsec: "Karlsruhe" },
  { start: 2400, end: 2454, locsec: "Kiel" },
  { start: 2458, end: 2462, locsec: "Kiel" },
  { start: 2465, end: 2499, locsec: "Kiel" },
  { start: 2550, end: 2599, locsec: "Kiel" },
  { start: 5000, end: 5199, locsec: "Köln" },
  { start: 5700, end: 5722, locsec: "Köln" },
  { start: 5734, end: 5799, locsec: "Köln" },
  { start: 5500, end: 5599, locsec: "Mainz, Wiesbaden" },
  { start: 6500, end: 6575, locsec: "Mainz, Wiesbaden" },
  { start: 6577, end: 6581, locsec: "Mainz, Wiesbaden" },
  { start: 3500, end: 3599, locsec: "Marburg, Gießen" },
  { start: 1700, end: 1725, locsec: "Mecklenburg-Vorpommern" },
  { start: 1730, end: 1999, locsec: "Mecklenburg-Vorpommern" },
  { start: 2393, end: 2399, locsec: "Mecklenburg-Vorpommern" },
  { start: 8000, end: 8429, locsec: "München" },
  { start: 8440, end: 8599, locsec: "München" },
  { start: 4800, end: 4999, locsec: "Münster" },
  { start: 4630, end: 4651, locsec: "Niederrhein" },
  { start: 4751, end: 4799, locsec: "Niederrhein" },
  { start: 2600, end: 2899, locsec: "Nordwest" },
  { start: 9000, end: 9239, locsec: "Nürnberg" },
  { start: 9500, end: 9649, locsec: "Nürnberg" },
  { start: 3160, end: 3160, locsec: "Ostwestfalen-Lippe" },
  { start: 3171, end: 3171, locsec: "Ostwestfalen-Lippe" },
  { start: 3200, end: 3399, locsec: "Ostwestfalen-Lippe" },
  { start: 3442, end: 3443, locsec: "Ostwestfalen-Lippe" },
  { start: 3768, end: 3768, locsec: "Ostwestfalen-Lippe" },
  { start: 8430, end: 8439, locsec: "Passau" },
  { start: 9400, end: 9429, locsec: "Passau" },
  { start: 9440, end: 9499, locsec: "Passau" },
  { start: 6684, end: 6799, locsec: "Pfalz" },
  { start: 7672, end: 7699, locsec: "Pfalz" },
  { start: 9240, end: 9399, locsec: "Regensburg" },
  { start: 9430, end: 9439, locsec: "Regensburg" },
  { start: 5300, end: 5499, locsec: "Rhein-Mosel" },
  { start: 5600, end: 5699, locsec: "Rhein-Mosel" },
  { start: 6800, end: 6999, locsec: "Rhein-Neckar" },
  { start: 7470, end: 7499, locsec: "Rhein-Neckar" },
  { start: 4400, end: 4629, locsec: "Ruhrgebiet" },
  { start: 4652, end: 4750, locsec: "Ruhrgebiet" },
  { start: 5840, end: 5849, locsec: "Ruhrgebiet" },
  { start: 6600, end: 6683, locsec: "Saarland" },
  { start: 100, end: 299, locsec: "Sachsen" },
  { start: 400, end: 599, locsec: "Sachsen" },
  { start: 800, end: 999, locsec: "Sachsen" },
  { start: 600, end: 699, locsec: "Sachsen-Anhalt" },
  { start: 2941, end: 2941, locsec: "Sachsen-Anhalt" },
  { start: 3881, end: 3999, locsec: "Sachsen-Anhalt" },
  { start: 7340, end: 7349, locsec: "Schwaben" },
  { start: 8600, end: 8799, locsec: "Schwaben" },
  { start: 8900, end: 8999, locsec: "Schwaben" },
  { start: 7000, end: 7339, locsec: "Stuttgart" },
  { start: 7350, end: 7469, locsec: "Stuttgart" },
  { start: 7537, end: 7539, locsec: "Stuttgart" },
  { start: 700, end: 799, locsec: "Thüringen" },
  { start: 9650, end: 9699, locsec: "Thüringen" },
  { start: 9800, end: 9999, locsec: "Thüringen" },
  { start: 9700, end: 9799, locsec: "Würzburg" },
];

init();

function init() {
  setConversationMode(false);
  startIntroAnimation();

  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = inputEl.value.trim();
    if (!question || isGenerating) return;
    inputEl.value = "";
    resizeInput();
    await ask(question);
  });

  document.querySelectorAll(".suggestions button").forEach((button) => {
    button.addEventListener("click", () => {
      if (!isGenerating) ask(button.textContent.trim());
    });
  });

  inputEl.addEventListener("input", () => {
    resizeInput();
    if (inputEl.value.trim()) stopIntroAnimation();
  });
  inputEl.addEventListener("focus", stopIntroAnimation);
  inputEl.addEventListener("blur", () => {
    if (isPristineScreen() && !inputEl.value.trim()) startIntroAnimation();
  });
  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formEl.requestSubmit();
    }
  });

  postcodeInputEl.addEventListener("input", updateLocationContext);
  accessFormEl.addEventListener("submit", submitAccessPassword);
  infoButtonEl?.addEventListener("click", toggleInfoModal);
  infoModalCloseEl?.addEventListener("click", closeInfoModal);
  infoModalEl?.querySelector("[data-info-close]")?.addEventListener("click", closeInfoModal);
  feedbackButtonEl?.addEventListener("click", openFeedbackModal);
  feedbackModalCloseEl?.addEventListener("click", closeFeedbackModal);
  feedbackModalEl?.querySelector("[data-feedback-close]")?.addEventListener("click", closeFeedbackModal);
  feedbackFormEl?.addEventListener("submit", submitFeedbackForm);
  document.addEventListener("keydown", handleGlobalKeydown);

  updateLocationContext();
  resizeInput();
}

async function ask(question) {
  setConversationMode(true);
  stopIntroAnimation();
  syncLocationFromChatQuestion(question);
  setGenerating(true);
  appendMessage("user", question);
  pushConversationEntry("user", question);
  const loading = loadingMessageNode();
  loading.classList.add("loading");
  messagesEl.append(loading);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  const questionForServer = buildQuestionWithContext(question);
  const recentMessages = buildRecentConversationPayload();

  try {
    const response = await apiFetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ question: questionForServer, messages: recentMessages }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Die Anfrage konnte nicht beantwortet werden.");
    }

    loading.remove();
    await appendBotAnswer(data);
  } catch (error) {
    loading.className = "message bot error";
    loading.querySelector(".message-content").textContent = error.message;
  } finally {
    setGenerating(false);
  }
}

function setConversationMode(hasConversation) {
  chatPanelEl.classList.toggle("is-pristine", !hasConversation);
  homeStageEl.hidden = hasConversation;
  messagesEl.setAttribute("aria-hidden", hasConversation ? "false" : "true");
  if (hasConversation) {
    stopIntroAnimation();
  } else if (!inputEl.value.trim()) {
    startIntroAnimation();
  }
}

function syncLocationFromChatQuestion(question) {
  const normalized = String(question || "").trim();
  if (!/^\d{4,5}$/.test(normalized)) return false;

  if (postcodeInputEl.value !== normalized) {
    postcodeInputEl.value = normalized;
  }

  updateLocationContext();
  return true;
}

async function submitAccessPassword(event) {
  event.preventDefault();
  const candidate = accessPasswordInputEl.value.trim();
  if (!candidate) {
    accessErrorEl.textContent = "Bitte Passwort eingeben.";
    return;
  }

  accessPassword = candidate;
  accessErrorEl.textContent = "";

  try {
    const response = await apiFetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ question: "Was ist ein LocSec?" }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Passwort falsch." }));
      throw new Error(data.error || "Passwort falsch.");
    }

    unlockAccess();
  } catch (error) {
    accessPassword = "";
    accessErrorEl.textContent = error.message || "Passwort falsch.";
  }
}

function unlockAccess() {
  accessGateEl.classList.add("is-hidden");
  accessPasswordInputEl.value = "";
  if (isPristineScreen()) startIntroAnimation();
}

function lockAccess(message = "Passwort erforderlich.") {
  accessPassword = "";
  accessGateEl.classList.remove("is-hidden");
  accessErrorEl.textContent = message;
  accessPasswordInputEl.focus();
}

function openInfoModal() {
  if (!infoModalEl) return;
  stopIntroAnimation();
  infoModalEl.hidden = false;
  infoModalEl.setAttribute("aria-hidden", "false");
  window.requestAnimationFrame(() => infoModalCloseEl?.focus());
}

function closeInfoModal() {
  if (!infoModalEl || infoModalEl.hidden) return;
  infoModalEl.hidden = true;
  infoModalEl.setAttribute("aria-hidden", "true");
  infoButtonEl?.focus();
  if (isPristineScreen() && !inputEl.value.trim()) {
    startIntroAnimation();
  }
}

function toggleInfoModal() {
  if (!infoModalEl) return;
  if (infoModalEl.hidden) {
    openInfoModal();
  } else {
    closeInfoModal();
  }
}

function openFeedbackModal() {
  if (!feedbackModalEl) return;
  stopIntroAnimation();
  feedbackModalEl.hidden = false;
  feedbackModalEl.setAttribute("aria-hidden", "false");
  window.requestAnimationFrame(() => feedbackModalCloseEl?.focus());
}

function closeFeedbackModal() {
  if (!feedbackModalEl || feedbackModalEl.hidden) return;
  feedbackModalEl.hidden = true;
  feedbackModalEl.setAttribute("aria-hidden", "true");
  feedbackButtonEl?.focus();
  if (isPristineScreen() && !inputEl.value.trim()) {
    startIntroAnimation();
  }
}

function handleGlobalKeydown(event) {
  if (event.key !== "Escape") return;
  if (infoModalEl && !infoModalEl.hidden) {
    event.preventDefault();
    closeInfoModal();
  } else if (feedbackModalEl && !feedbackModalEl.hidden) {
    event.preventDefault();
    closeFeedbackModal();
  }
}

async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (accessPassword) {
    headers.set("x-access-password", accessPassword);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    lockAccess("Passwort falsch oder abgelaufen.");
  }

  return response;
}

async function submitFeedbackForm(event) {
  event.preventDefault();
  if (!feedbackFormEl || !feedbackStatusEl) return;

  const formData = new FormData(feedbackFormEl);
  const message = String(formData.get("message") || "").trim();
  if (message.length < 5) {
    feedbackStatusEl.textContent = "Bitte schreib kurz, was verbessert werden sollte.";
    feedbackStatusEl.classList.add("is-error");
    return;
  }

  const submitButton = feedbackFormEl.querySelector("button[type='submit']");
  submitButton.disabled = true;
  feedbackStatusEl.textContent = "Feedback wird gesendet...";
  feedbackStatusEl.classList.remove("is-error");

  try {
    const response = await apiFetch("/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        type: "modal-feedback",
        email: String(formData.get("email") || ""),
        message,
        company: String(formData.get("company") || ""),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Feedback konnte gerade nicht gesendet werden.");
    }
    feedbackFormEl.reset();
    feedbackStatusEl.textContent = data.message || "Danke, das Feedback wurde gesendet.";
  } catch (error) {
    feedbackStatusEl.textContent = error.message || "Feedback konnte gerade nicht gesendet werden.";
    feedbackStatusEl.classList.add("is-error");
  } finally {
    submitButton.disabled = false;
  }
}

function loadingMessageNode() {
  const node = messageNode("bot", "");
  const content = node.querySelector(".message-content");
  const label = document.createElement("span");
  label.textContent = "Antwort wird vorbereitet";

  const dots = document.createElement("span");
  dots.className = "typing-dots";
  dots.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 3; index += 1) {
    dots.append(document.createElement("span"));
  }

  content.replaceChildren(label, dots);
  return node;
}

async function appendBotAnswer(data) {
  const node = messageNode("bot", "");
  const content = node.querySelector(".message-content");
  node.classList.add("streaming");
  messagesEl.append(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  await streamText(content, data.text);
  renderMessageFormatting(content);
  pushConversationEntry("assistant", data.text || "");
  node.classList.remove("streaming");

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendMessage(role, text) {
  const node = messageNode(role, text);
  messagesEl.append(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return node;
}

function pushConversationEntry(role, text) {
  const cleanText = String(text || "").trim();
  if (!cleanText) return;

  conversationHistory.push({ role, content: cleanText });
  if (conversationHistory.length > 12) {
    conversationHistory = conversationHistory.slice(-12);
  }
}

function buildRecentConversationPayload() {
  return conversationHistory.slice(-6).map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));
}

function messageNode(role, text) {
  const node = document.createElement("article");
  node.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = role === "user" ? "Du" : "M";

  const content = document.createElement("div");
  content.className = "message-content";
  content.textContent = text;

  node.append(avatar, content);
  return node;
}

function setGenerating(active) {
  isGenerating = active;
  formEl.classList.toggle("is-generating", active);
  inputEl.disabled = active;
  formEl.querySelector(".send-button").disabled = active;
  document.querySelectorAll(".suggestions button").forEach((button) => {
    button.disabled = active;
  });
}

function updateLocationContext() {
  const digits = postcodeInputEl.value.replace(/\D/g, "").slice(0, 5);
  if (postcodeInputEl.value !== digits) {
    postcodeInputEl.value = digits;
  }

  activePostcode = digits;
  activeLocSec = digits.length >= 4 ? locsecForPostcode(digits) : "";

  locsecBadgeEl.classList.toggle("is-active", Boolean(activeLocSec));
  locsecBadgeEl.textContent = activeLocSec
    ? `LocSec ${activeLocSec}`
    : digits.length >= 4
      ? "Manuelle PLZ-Prüfung nötig"
      : "LocSec nach PLZ";
}

function locsecForPostcode(postcode) {
  const prefixText = String(postcode || "").replace(/\D/g, "").slice(0, 4);
  const prefix = Number(prefixText);
  if (prefixText.length < 4 || !Number.isInteger(prefix)) return "";

  const range = locsecPrefixRanges.find((entry) => prefix >= entry.start && prefix <= entry.end);
  return range?.locsec || "";
}

function buildQuestionWithContext(question) {
  if (!activePostcode || !activeLocSec) return question;

  const contextualQuestion = [
    question,
    "",
    `Lokaler Kontext: Die eingegebene PLZ ist ${activePostcode}. Das zugeordnete LocSec-Gebiet ist ${activeLocSec}. Beziehe regionale Fragen nach Möglichkeit auf dieses LocSec-Gebiet.`,
  ].join("\n");

  return contextualQuestion.length <= 1550 ? contextualQuestion : question;
}

function resizeInput() {
  inputEl.style.height = "auto";
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 160)}px`;
}

async function streamText(element, text) {
  element.textContent = "";

  const parts = String(text || "").match(/\S+\s*|\n+/g) || [];
  for (const part of parts) {
    element.textContent += part;
    messagesEl.scrollTop = messagesEl.scrollHeight;
    await wait(part.includes("\n") ? 20 : 18);
  }
}

function renderMessageFormatting(element) {
  const text = element.textContent;
  const tokenPattern = /(\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s]+)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    if (match[1]) {
      const anchor = document.createElement("a");
      anchor.href = match[3];
      anchor.textContent = match[2];
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      parts.push(anchor);
    } else if (match[4]) {
      const url = match[4].replace(/[.,;]+$/, "");
      const trailing = match[4].slice(url.length);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.textContent = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      parts.push(anchor);

      if (trailing) {
        parts.push(document.createTextNode(trailing));
      }
    } else if (match[5]) {
      const strong = document.createElement("strong");
      strong.textContent = match[5];
      parts.push(strong);
    } else {
      const emphasis = document.createElement("em");
      emphasis.textContent = match[6];
      parts.push(emphasis);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(document.createTextNode(text.slice(lastIndex)));
  }

  element.replaceChildren(...parts);
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isPristineScreen() {
  return chatPanelEl.classList.contains("is-pristine");
}

function stopIntroAnimation() {
  introAnimationToken += 1;
  introAnimationRunning = false;
  formEl.classList.remove("is-ghosting");
  if (questionGhostEl) {
    questionGhostEl.textContent = "";
    questionGhostEl.hidden = true;
  }
}

function showIntroQuestion(text) {
  if (!questionGhostEl) return;
  formEl.classList.add("is-ghosting");
  questionGhostEl.hidden = false;
  questionGhostEl.textContent = text;
  questionGhostEl.dataset.hasText = text ? "true" : "false";
}

async function typeIntroQuestion(question, token) {
  for (let index = 1; index <= question.length; index += 1) {
    if (
      token !== introAnimationToken ||
      !isPristineScreen() ||
      inputEl.value.trim() ||
      document.activeElement === inputEl
    ) {
      return false;
    }

    showIntroQuestion(question.slice(0, index));
    await wait(index < 10 ? 60 : index < 24 ? 42 : 28);
  }

  return true;
}

async function eraseIntroQuestion(question, token) {
  for (let index = question.length; index >= 0; index -= 1) {
    if (
      token !== introAnimationToken ||
      !isPristineScreen() ||
      inputEl.value.trim() ||
      document.activeElement === inputEl
    ) {
      return false;
    }

    showIntroQuestion(question.slice(0, index));
    await wait(index > 22 ? 18 : 24);
  }

  return true;
}

async function startIntroAnimation() {
  if (!questionGhostEl || introAnimationRunning || !isPristineScreen() || inputEl.value.trim()) return;

  introAnimationRunning = true;
  const token = ++introAnimationToken;

  try {
    while (
      token === introAnimationToken &&
      isPristineScreen() &&
      !inputEl.value.trim() &&
      document.activeElement !== inputEl
    ) {
      for (const question of introQuestions) {
        if (
          token !== introAnimationToken ||
          !isPristineScreen() ||
          inputEl.value.trim() ||
          document.activeElement === inputEl
        ) {
          return;
        }

        await typeIntroQuestion(question, token);
        if (token !== introAnimationToken || !isPristineScreen()) return;
        await wait(900);
        await eraseIntroQuestion(question, token);
        await wait(220);
      }
    }
  } finally {
    if (token === introAnimationToken) {
      introAnimationRunning = false;
      if (questionGhostEl) {
        questionGhostEl.dataset.hasText = "false";
      }
    }
  }
}
