import { createServer } from "node:http";
import { readFile, readdir, mkdir, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const knowledgeDir = path.join(__dirname, "data", "knowledge");
const runtimeDir = process.env.VERCEL
  ? path.join("/tmp", "mensa-wegweiser-runtime")
  : path.join(__dirname, "data", "runtime");

await loadDotEnv(path.join(__dirname, ".env"));

const env = {
  port: Number(process.env.PORT || 3000),
  useSaia: Boolean(process.env.SAIA_API_KEY),
  saiaApiKey: process.env.SAIA_API_KEY || "",
  saiaBaseUrl: process.env.SAIA_BASE_URL || "https://chat-ai.academiccloud.de/v1",
  saiaModel: process.env.SAIA_MODEL || "mistral-large-3-675b-instruct-2512",
  saiaTemperature: Number(process.env.SAIA_TEMPERATURE || 0.2),
  saiaTopP: Number(process.env.SAIA_TOP_P || 1),
  useOllama: process.env.USE_OLLAMA === "true",
  ollamaUrl: process.env.OLLAMA_URL || "http://127.0.0.1:11434",
  ollamaModel: process.env.OLLAMA_MODEL || "llama3.1:8b",
  logTranscripts: process.env.LOG_CHAT_TRANSCRIPTS === "true",
  accessPassword: process.env.APP_PASSWORD || "",
  requiresAccessPassword: Boolean(process.env.VERCEL || process.env.APP_PASSWORD),
  feedbackToEmail: process.env.FEEDBACK_TO_EMAIL || process.env.CONTACT_TO_EMAIL || "",
  feedbackFromEmail: process.env.FEEDBACK_FROM_EMAIL || process.env.CONTACT_FROM_EMAIL || "Atlas Feedback <onboarding@resend.dev>",
  feedbackProxyUrl: process.env.FEEDBACK_PROXY_URL || "",
  resendApiKey: process.env.RESEND_API_KEY || "",
};

const modelPricingUsdPerMillion = new Map([
]);

const preservedShortTokens = new Set(["mv", "iq", "ev", "jt"]);

const officialEntryLinks = [
  {
    label: "Mitgliedschaft",
    url: "https://www.mensa.de/about/membership/",
    description: "Einstieg in Mitgliedschaft, Aufnahme und erste Orientierung",
  },
  {
    label: "Veranstaltungen",
    url: "https://www.mensa.de/about/veranstaltungen/",
    description: "Einstieg zu Treffen und Veranstaltungen",
  },
  {
    label: "Mensa Regional",
    url: "https://www.mensa.de/about/regional/",
    description: "Weg zur eigenen Region oder Stadt",
  },
  {
    label: "Kids & Juniors",
    url: "https://www.mensa.de/kiju/",
    description: "Angebote für hochbegabte Kinder, Jugendliche und Familien",
  },
  {
    label: "Mensa Youth",
    url: "https://www.mensa.de/young-adults/",
    description: "Angebote für junge Erwachsene",
  },
  {
    label: "Mitgliederbereich",
    url: "https://www.mensa.de/members/",
    description: "Login zum Mitgliederbereich",
  },
  {
    label: "Kontakt",
    url: "https://www.mensa.de/contact-us/",
    description: "Allgemeiner Kontaktweg",
  },
];

const officialToolLinks = [
  {
    label: "Mitgliederbereich",
    url: "https://www.mensa.de/members/",
    description: "Login und Gastzugang für interne Bereiche",
  },
];

const regionalPageUrls = new Map([
  ["Aachen", "https://www.mensa.de/about/regional/regionalseite-aachen/"],
  ["Aschaffenburg", "https://www.mensa.de/about/regional/regionalseite-aschaffenburg/"],
  ["Berlin & Brandenburg", "https://www.mensa.de/about/regional/regionalseite-berlinbrandenburg/"],
  ["Bodensee", "https://www.mensa.de/about/regional/regionalseite-bodensee/"],
  ["Braunschweig", "https://www.mensa.de/about/regional/regionalseite-braunschweig/"],
  ["Darmstadt", "https://www.mensa.de/about/regional/regionalseite-darmstadt/"],
  ["Düsseldorf", "https://www.mensa.de/about/regional/regionalseite-duesseldorf/"],
  ["Frankfurt", "https://www.mensa.de/about/regional/regionalseite-frankfurt/"],
  ["Freiburg", "https://www.mensa.de/about/regional/regionalseite-freiburg/"],
  ["Fulda", "https://www.mensa.de/about/regional/regionalseite-fulda/"],
  ["Göttingen-Kassel", "https://www.mensa.de/about/regional/regionalseite-goettingen-kassel/"],
  ["Hagen", "https://www.mensa.de/about/regional/regionalseite-hagen/"],
  ["Hamburg", "https://www.mensa.de/about/regional/regionalseite-hamburg/"],
  ["Hamm, Arnsberg", "https://www.mensa.de/about/regional/regionalseite-hamm-arnsberg/"],
  ["Hannover", "https://www.mensa.de/about/regional/regionalseite-hannover/"],
  ["Karlsruhe", "https://www.mensa.de/about/regional/regionalseite-karlsruhe/"],
  ["Kiel", "https://www.mensa.de/about/regional/regionalseite-kiel/"],
  ["Köln", "https://www.mensa.de/about/regional/regionalseite-koeln/"],
  ["Mainz, Wiesbaden", "https://www.mensa.de/about/regional/regionalseite-mainz-wiesbaden/"],
  ["Marburg, Gießen", "https://www.mensa.de/about/regional/regionalseite-marburg-giessen/"],
  ["Mecklenburg-Vorpommern", "https://www.mensa.de/about/regional/regionalseite-mecklenburg-vorpommern/"],
  ["München", "https://www.mensa.de/about/regional/regionalseite-muenchen/"],
  ["Münster", "https://www.mensa.de/about/regional/regionalseite-muenster/"],
  ["Niederrhein", "https://www.mensa.de/about/regional/regionalseite-niederrhein/"],
  ["Nordwest", "https://www.mensa.de/about/regional/regionalseite-nordwest/"],
  ["Nürnberg", "https://www.mensa.de/about/regional/regionalseite-nuernberg/"],
  ["Ostwestfalen-Lippe", "https://www.mensa.de/about/regional/regionalseite-ostwestfalen-lippe/"],
  ["Passau", "https://www.mensa.de/about/regional/regionalseite-passau/"],
  ["Pfalz", "https://www.mensa.de/about/regional/regionalseite-pfalz/"],
  ["Regensburg", "https://www.mensa.de/about/regional/regionalseite-regensburg/"],
  ["Rhein-Mosel", "https://www.mensa.de/about/regional/regionalseite-rhein-mosel/"],
  ["Rhein-Neckar", "https://www.mensa.de/about/regional/regionalseite-rhein-neckar/"],
  ["Ruhrgebiet", "https://www.mensa.de/about/regional/regionalseite-ruhrgebiet/"],
  ["Saarland", "https://www.mensa.de/about/regional/regionalseite-saarland/"],
  ["Sachsen", "https://www.mensa.de/about/regional/regionalseite-sachsen/"],
  ["Sachsen-Anhalt", "https://www.mensa.de/about/regional/regionalseite-sachsen-anhalt/"],
  ["Schwaben", "https://www.mensa.de/about/regional/regionalseite-schwaben/"],
  ["Stuttgart", "https://www.mensa.de/about/regional/regionalseite-stuttgart/"],
  ["Thüringen", "https://www.mensa.de/about/regional/regionalseite-thueringen/"],
  ["Würzburg", "https://www.mensa.de/about/regional/regionalseite-wuerzburg/"],
]);

const regionalSigLinks = new Map();

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
]);

const stopWords = new Set([
  "aber",
  "als",
  "also",
  "am",
  "an",
  "auch",
  "auf",
  "bei",
  "bin",
  "bis",
  "das",
  "dem",
  "den",
  "der",
  "des",
  "die",
  "du",
  "ein",
  "eine",
  "einem",
  "einen",
  "einer",
  "es",
  "fuer",
  "für",
  "habe",
  "haben",
  "ich",
  "im",
  "in",
  "ist",
  "ja",
  "kann",
  "mit",
  "mensa",
  "muss",
  "nicht",
  "oder",
  "sich",
  "sie",
  "sind",
  "und",
  "vom",
  "von",
  "was",
  "wenn",
  "wer",
  "wie",
  "wir",
  "zu",
  "zum",
  "zur",
]);

const queryExpansions = new Map([
  ["aufnahmetest", ["iq", "test", "intelligenztest", "mitgliedschaft", "qualifikation"]],
  ["beitreten", ["mitglied", "mitgliedschaft", "aufnahme", "aufnahmetest"]],
  ["geschaeftsstelle", ["kontakt", "office", "email", "mail"]],
  ["geschäftsstelle", ["kontakt", "office", "email", "mail"]],
  ["hochbegabt", ["hochbegabung", "iq", "intelligenz"]],
  ["intelligenztest", ["iq", "test", "aufnahmetest", "mitgliedschaft"]],
  ["iq", ["intelligenztest", "test", "aufnahmetest"]],
  ["kontakt", ["geschaeftsstelle", "office", "email", "mail", "ansprechperson"]],
  ["kontaktieren", ["kontakt", "geschaeftsstelle", "office", "email", "mail", "ansprechperson"]],
  ["kontaktier", ["kontakt", "geschaeftsstelle", "office", "email", "mail", "ansprechperson"]],
  ["mail", ["email", "kontakt", "geschaeftsstelle"]],
  ["mitglied", ["mitgliedschaft", "aufnahme", "beitreten", "aufnahmetest"]],
  ["mitgliedschaft", ["mitglied", "aufnahme", "beitreten", "aufnahmetest"]],
  ["mv", ["mitgliederversammlung", "vereinsinterne", "gremien"]],
  ["neumitglied", ["neu", "mitglied", "mitgliedschaft", "einstieg"]],
  ["termin", ["veranstaltung", "treffen", "event"]],
  ["test", ["iq", "intelligenztest", "aufnahmetest"]],
  ["veranstaltung", ["termin", "treffen", "event"]],
]);

let index = [];
let sourceFiles = [];
let locsecContacts = new Map();
let contactDirectory = [];

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

await mkdir(runtimeDir, { recursive: true });
await loadKnowledge();
await loadContactDirectory();
await loadLocSecDirectory();

export async function handleRequest(req, res) {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      const ollamaAvailable = env.useOllama ? await checkOllamaAvailable() : false;
      return sendJson(res, 200, {
        ok: true,
        authRequired: Boolean(env.accessPassword),
        beta: true,
        mode: env.useSaia ? "saia" : env.useOllama && ollamaAvailable ? "ollama" : "local-retrieval",
        saiaConfigured: Boolean(env.saiaApiKey),
        saiaAvailable: env.useSaia,
        saiaModel: env.useSaia ? env.saiaModel : null,
        ollamaConfigured: env.useOllama,
        ollamaAvailable,
        ollamaModel: env.useOllama ? env.ollamaModel : null,
        logTranscripts: env.logTranscripts,
        sources: sourceFiles.length,
      });
    }

    if (req.method === "GET" && url.pathname === "/api/sources") {
      const authError = getAuthError(req);
      if (authError) {
        return sendJson(res, 401, { error: authError });
      }
      return sendJson(res, 200, { sources: sourceFiles });
    }

    if (req.method === "POST" && url.pathname === "/api/locsec") {
      const authError = getAuthError(req);
      if (authError) {
        return sendJson(res, 401, { error: authError });
      }
      const body = await readJson(req);
      const postcode = sanitizeText(body.postcode || "").replace(/\D/g, "").slice(0, 5);

      if (postcode.length < 4) {
        return sendJson(res, 400, { error: "Bitte gib mindestens die ersten vier PLZ-Ziffern ein." });
      }

      const result = lookupLocSecByPostcode(postcode);
      if (!result.locsec) {
        return sendJson(res, 404, {
          postcode,
          prefix: result.prefix,
          error: "Für diesen PLZ-Präfix ist keine Region hinterlegt. Bitte manuell prüfen.",
        });
      }

      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && url.pathname === "/api/chat") {
      const authError = getAuthError(req);
      if (authError) {
        return sendJson(res, 401, { error: authError });
      }
      const body = await readJson(req);
      const question = sanitizeText(body.question || "");
      const messages = sanitizeConversation(body.messages);

      if (!question || question.length < 3) {
        return sendJson(res, 400, { error: "Bitte stelle eine konkrete Frage." });
      }

      if (question.length > 1600) {
        return sendJson(res, 400, { error: "Die Frage ist für diesen Prototyp zu lang." });
      }

      const matches = searchKnowledge(question, 5);
      const answer = await answerQuestion(question, matches, messages);

      if (env.logTranscripts) {
        await appendJsonl("chat.jsonl", {
          ts: new Date().toISOString(),
          question,
          messages,
          answer: answer.text,
          sources: answer.sources.map((source) => source.id),
        });
      }

      return sendJson(res, 200, answer);
    }

    if (req.method === "POST" && url.pathname === "/api/feedback") {
      const authError = getAuthError(req);
      if (authError) {
        return sendJson(res, 401, { error: authError });
      }
      const body = await readJson(req);
      if (sanitizeText(body.company || "")) {
        return sendJson(res, 200, { ok: true, message: "Danke, das Feedback wurde gesendet." });
      }

      const feedback = {
        ts: new Date().toISOString(),
        type: sanitizeText(body.type || "chat-feedback").slice(0, 80),
        helpful: body.helpful === true,
        question: sanitizeText(body.question || "").slice(0, 500),
        answerId: sanitizeText(body.answerId || "").slice(0, 80),
        name: sanitizeText(body.name || "").slice(0, 120),
        email: sanitizeEmail(body.email || "").slice(0, 320),
        note: sanitizeText(body.note || body.message || "").slice(0, 2000),
      };

      if (!feedback.note || feedback.note.length < 5) {
        return sendJson(res, 400, { error: "Bitte schreib kurz, was verbessert werden sollte." });
      }

      await appendJsonl("feedback.jsonl", feedback);

      const emailResult = await sendFeedbackEmail(feedback);
      if (!emailResult.ok) {
        return sendJson(res, emailResult.status, { ok: false, error: emailResult.error });
      }

      return sendJson(res, 200, { ok: true, message: "Danke, das Feedback wurde gesendet." });
    }

    if (req.method === "POST" && url.pathname === "/api/reload") {
      const authError = getAuthError(req);
      if (authError) {
        return sendJson(res, 401, { error: authError });
      }
      await loadKnowledge();
      await loadContactDirectory();
      await loadLocSecDirectory();
      return sendJson(res, 200, { ok: true, sources: sourceFiles.length, chunks: index.length });
    }

    return serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: "Interner Fehler im lokalen Chatbot." });
  }
}

export default handleRequest;

const isDirectCliStart =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectCliStart) {
  const server = createServer(handleRequest);
  server.listen(env.port, () => {
    console.log(`Mensa chatbot running on http://localhost:${env.port}`);
    const mode = env.useSaia
      ? `SAIA (${env.saiaModel})`
      : env.useOllama
        ? `Ollama (${env.ollamaModel})`
        : "local retrieval";
    console.log(`Mode: ${mode}`);
  });
}

async function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;

  const raw = await readFile(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function loadKnowledge() {
  const files = await collectMarkdownFiles(knowledgeDir);
  const chunks = [];

  for (const filePath of files) {
    const raw = await readFile(filePath, "utf8");
    const relativePath = path.relative(__dirname, filePath);
    const title = readTitle(raw) || path.basename(filePath, ".md");
    const sections = splitSections(raw);

    sections.forEach((section, sectionIndex) => {
      if (section.text.length < 80) return;
      const sectionChunks = splitLongSection(section.text);

      sectionChunks.forEach((text, chunkIndex) => {
        const id = `${relativePath}#${sectionIndex + 1}.${chunkIndex + 1}`;
        chunks.push({
          id,
          title: section.heading || title,
          file: relativePath,
          text,
          tokens: tokenize(`${section.heading} ${text}`),
        });
      });
    });
  }

  index = chunks;
  sourceFiles = files.map((filePath) => path.relative(__dirname, filePath)).sort();
}

function lookupLocSecByPostcode(postcode) {
  const digits = String(postcode || "").replace(/\D/g, "").slice(0, 5);
  const prefixText = digits.slice(0, 4);
  const prefix = Number(prefixText);

  if (prefixText.length < 4 || !Number.isInteger(prefix)) {
    return { postcode: digits, prefix: prefixText, locsec: "", source: "manual-review" };
  }

  const range = locsecPrefixRanges.find((entry) => prefix >= entry.start && prefix <= entry.end);
  return {
    postcode: digits,
    prefix: prefixText,
    locsec: range?.locsec || "",
    source: range ? "local-prefix" : "manual-review",
  };
}

function getAuthError(req) {
  if (env.requiresAccessPassword && !env.accessPassword) return "Server ist ohne APP_PASSWORD nicht freigeschaltet.";
  if (!env.accessPassword) return "";
  const providedPassword = sanitizeText(req.headers["x-access-password"] || "");
  if (!providedPassword) return "Passwort erforderlich.";
  if (providedPassword !== env.accessPassword) return "Passwort falsch.";
  return "";
}

function isAuthorized(req) {
  return !getAuthError(req);
}

async function collectMarkdownFiles(dir) {
  if (!existsSync(dir)) return [];

  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const current = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(current)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(current);
    }
  }

  return files.sort();
}

async function loadLocSecDirectory() {
  locsecContacts = new Map();
}

async function loadContactDirectory() {
  contactDirectory = [];
}

function splitSections(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections = [];
  let currentHeading = "";
  let currentLines = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch && currentLines.length > 0) {
      sections.push({
        heading: currentHeading,
        text: cleanMarkdown(currentLines.join("\n")),
      });
      currentLines = [];
    }

    if (headingMatch) {
      currentHeading = headingMatch[2].trim();
      continue;
    }

    currentLines.push(line);
  }

  if (currentLines.length > 0) {
    sections.push({
      heading: currentHeading,
      text: cleanMarkdown(currentLines.join("\n")),
    });
  }

  return sections;
}

function splitLongSection(text) {
  const tokens = tokenize(text);
  if (tokens.length <= 650) return [text];

  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const chunks = [];
  let current = [];
  let currentTokenCount = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokenCount = tokenize(paragraph).length;

    if (current.length > 0 && currentTokenCount + paragraphTokenCount > 650) {
      chunks.push(current.join("\n\n"));
      current = [];
      currentTokenCount = 0;
    }

    current.push(paragraph);
    currentTokenCount += paragraphTokenCount;
  }

  if (current.length > 0) {
    chunks.push(current.join("\n\n"));
  }

  return chunks;
}

function readTitle(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

function cleanMarkdown(markdown) {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function searchKnowledge(question, limit) {
  const queryTokens = expandQueryTokens(tokenize(question));
  const querySet = new Set(queryTokens);
  const locsecContext = extractLocSecContext(question);
  const normalizedLocSecContext = normalize(locsecContext);
  const isDefinitionQuestion = /\b(?:was|wer)\s+(?:ist|sind|bedeutet|bedeuten)\b/i.test(question);

  return index
    .map((chunk) => {
      const chunkSet = new Set(chunk.tokens);
      const tokenHits = [...querySet].filter((token) => chunkSet.has(token)).length;
      const normalizedText = normalize(`${chunk.title} ${chunk.text}`);
      const phraseBoost = queryTokens.some((token) => normalizedText.includes(token)) ? 1 : 0;
      const titleBoost = tokenize(chunk.title).filter((token) => querySet.has(token)).length * 2;
      const lengthPenalty = chunk.tokens.length > 1800 ? 2 : chunk.tokens.length > 900 ? 1 : 0;
      const curatedBoost = 4;
      const curatedDefinitionBoost = isDefinitionQuestion && titleBoost > 0 ? 10 : 0;
      const locsecBoost =
        normalizedLocSecContext &&
        (normalize(chunk.title).includes(normalizedLocSecContext) ||
          normalizedText.includes(`locsec gebiet ${normalizedLocSecContext}`) ||
          normalizedText.includes(`locsec-gebiet ${normalizedLocSecContext}`))
          ? 12
          : 0;
      const score =
        tokenHits + phraseBoost + titleBoost + curatedBoost + curatedDefinitionBoost + locsecBoost - lengthPenalty;
      return { ...chunk, score };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function extractLocSecContext(question) {
  const match = question.match(/zugeordnete(?:s|n)?\s+LocSec-Gebiet\s+ist\s+(.+?)(?:\.|\n|$)/i);
  return match ? match[1].trim() : "";
}

function extractPostcodeContext(question) {
  const match = question.match(/(?:PLZ|Postleitzahl)\s+ist\s+(\d{4,5})/i);
  return match ? match[1] : "";
}

function findLocSecContact(locsec) {
  return locsecContacts.get(normalize(canonicalizeLocSecName(locsec))) || "";
}

function findRegionalPageUrl(locsec) {
  if (!locsec) return "";
  return regionalPageUrls.get(canonicalizeLocSecName(locsec)) || "";
}

function findRegionalSigLink(locsec) {
  if (!locsec) return null;
  return regionalSigLinks.get(canonicalizeLocSecName(locsec)) || null;
}

function findContactByEmail(email) {
  const normalizedEmail = normalize(sanitizeEmail(email));
  return contactDirectory.find((entry) => normalize(entry.email) === normalizedEmail) || null;
}

function findLocSecByEmail(email) {
  const normalizedEmail = normalize(sanitizeEmail(email));
  for (const [locsec, contactEmail] of locsecContacts.entries()) {
    if (normalize(contactEmail) === normalizedEmail) return locsec;
  }
  return "";
}

function findContactsByPersonName(name) {
  const nameTokens = tokenize(name).filter((token) => token.length >= 2);
  if (nameTokens.length === 0) return [];

  return contactDirectory.filter((entry) => {
    const normalizedLabel = normalize(entry.label);
    return nameTokens.every((token) => normalizedLabel.includes(token));
  });
}

function findRelevantContacts(question, contextualLocSec, limit = 3) {
  const primary = primaryQuestion(question);
  const normalizedQuestion = normalize(primary);
  const questionTokens = new Set(tokenize(primary));
  const results = [];
  const seenEmails = new Set();

  const pushContact = (label, email, note = "") => {
    const cleanEmail = sanitizeEmail(email);
    if (!cleanEmail) return;
    const key = normalize(cleanEmail);
    if (seenEmails.has(key)) return;
    seenEmails.add(key);
    results.push({ label: sanitizeText(label) || cleanEmail, email: cleanEmail, note });
  };

  if (contextualLocSec) {
    const locsecEmail = findLocSecContact(contextualLocSec);
    if (locsecEmail) {
      pushContact(`LocSec ${contextualLocSec}`, locsecEmail, "regional");
    }
  }

  const scored = contactDirectory
    .map((entry) => ({
      ...entry,
      score: scoreContactEntry(entry, normalizedQuestion, questionTokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const entry of scored) {
    pushContact(entry.label, entry.email, entry.section);
    if (results.length >= limit) break;
  }

  return results.slice(0, limit);
}

function hasSpecificContactTopic(question) {
  const tokens = new Set(tokenize(primaryQuestion(question)));
  return (
    tokens.has("mitglied") ||
    tokens.has("mitgliedschaft") ||
    tokens.has("verwaltung") ||
    tokens.has("beitrag") ||
    tokens.has("ausweis") ||
    tokens.has("zahlung") ||
    tokens.has("kuendigung") ||
    tokens.has("kiju") ||
    tokens.has("kids") ||
    tokens.has("juniors") ||
    tokens.has("kind") ||
    tokens.has("jugend") ||
    tokens.has("youth") ||
    tokens.has("junge") ||
    tokens.has("erwachsene") ||
    tokens.has("praevention") ||
    tokens.has("presse") ||
    tokens.has("bildung") ||
    tokens.has("forschung") ||
    tokens.has("vorstand")
  );
}

function scoreContactEntry(entry, normalizedQuestion, questionTokens) {
  const normalizedLabel = normalize(`${entry.section} ${entry.label} ${entry.email}`);
  let score = 0;

  for (const token of questionTokens) {
    if (token.length < 3) continue;
    if (normalizedLabel.includes(token)) score += 2;
  }

  if (normalizedQuestion.includes("kontakt") || normalizedQuestion.includes("fragen")) {
    score += normalizedLabel.includes("kontakt") ? 3 : 0;
  }

  if (normalizedQuestion.includes("mitglied") || normalizedQuestion.includes("beitrag") || normalizedQuestion.includes("ausweis")) {
    if (normalizedLabel.includes("office") || normalizedLabel.includes("verwaltung") || normalizedLabel.includes("geschäftsstelle") || normalizedLabel.includes("geschaeftsstelle") || normalizedLabel.includes("gf")) {
      score += 6;
    }
  }

  if (normalizedQuestion.includes("junge") || normalizedQuestion.includes("youth")) {
    if (normalizedLabel.includes("junge-erwachsene") || normalizedLabel.includes("youth") || normalizedLabel.includes("mysec")) score += 6;
  }

  if (normalizedQuestion.includes("kind") || normalizedQuestion.includes("jugend") || normalizedQuestion.includes("junior") || normalizedQuestion.includes("family")) {
    if (normalizedLabel.includes("kiju")) score += 6;
  }

  if (normalizedQuestion.includes("praevent") || normalizedQuestion.includes("gewalt")) {
    if (normalizedLabel.includes("praevention") || normalizedLabel.includes("gewaltfrei")) score += 6;
  }

  if (normalizedQuestion.includes("bildung") || normalizedQuestion.includes("lernen")) {
    if (normalizedLabel.includes("bildung")) score += 6;
  }

  if (normalizedQuestion.includes("forschung") || normalizedQuestion.includes("wissenschaft")) {
    if (normalizedLabel.includes("forschung")) score += 6;
  }

  if (normalizedQuestion.includes("presse") || normalizedQuestion.includes("medien")) {
    if (normalizedLabel.includes("presse")) score += 6;
  }

  if (normalizedQuestion.includes("vorstand") || normalizedQuestion.includes("satzung")) {
    if (normalizedLabel.includes("vorstand")) score += 6;
  }

  if (normalizedQuestion.includes("regional") || normalizedQuestion.includes("region") || normalizedQuestion.includes("treffen") || normalizedQuestion.includes("veranstaltung")) {
    if (normalizedLabel.includes("locsec") || normalizedLabel.includes("region")) score += 5;
  }

  return score;
}

function primaryQuestion(question) {
  return String(question || "")
    .split(/\n\s*Lokaler Kontext:/i)[0]
    .trim();
}

function sanitizeConversation(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .slice(-6)
    .map((entry) => ({
      role: entry?.role === "assistant" ? "assistant" : "user",
      content: sanitizeText(entry?.content || "").slice(0, 500),
    }))
    .filter((entry) => entry.content);
}

function resolveQuestionWithConversation(question, conversation = []) {
  const primary = primaryQuestion(question);
  const normalizedPrimary = normalize(primary);
  if (!isEllipticFollowUp(normalizedPrimary)) return question;

  const referencedPerson = extractLastMentionedPerson(conversation);
  if (!referencedPerson) return question;

  const resolvedPrimary = primary.replace(/^(das|der|die|er|sie)\b/i, referencedPerson);
  return String(question || "").replace(primary, resolvedPrimary);
}

function isEllipticFollowUp(normalizedQuestion) {
  return (
    /^(das|der|die|er|sie)\b/.test(normalizedQuestion) &&
    (
      normalizedQuestion.includes("locsec") ||
      normalizedQuestion.includes("region") ||
      normalizedQuestion.includes("freiburg") ||
      normalizedQuestion.includes("nuernberg") ||
      normalizedQuestion.includes("muenchen")
    )
  );
}

function extractLastMentionedPerson(conversation = []) {
  for (let index = conversation.length - 1; index >= 0; index -= 1) {
    const content = sanitizeText(conversation[index]?.content || "");
    const explicitQuestionMatch = content.match(/^wer\s+ist\s+(.+?)[?!.]*$/i);
    if (explicitQuestionMatch) return sanitizeText(explicitQuestionMatch[1]);

    const inferredLabelMatch = content.match(/^(.+?)\s+ist\s+in\s+der\s+wissensbasis/i);
    if (inferredLabelMatch) {
      const label = sanitizeText(inferredLabelMatch[1]);
      return cleanPersonLabel(label);
    }
  }

  return "";
}

function cleanPersonLabel(label) {
  return sanitizeText(String(label || "").replace(/^LocSec\s*\(Regionale Ansprechperson\):\s*/i, "").split(/\s+[–-]\s+/)[0]);
}

async function answerQuestion(question, matches, conversation = []) {
  const answerId = crypto.randomUUID();
  const greetingQuestion = isGreetingQuestion(question);
  const resolvedQuestion = resolveQuestionWithConversation(question, conversation);
  const directAnswer = greetingQuestion ? buildGreetingAnswer(resolvedQuestion) : buildDirectAnswer(resolvedQuestion);
  const contextualMatches = resolvedQuestion !== question ? searchKnowledge(resolvedQuestion, 5) : matches;
  const effectiveMatches = greetingQuestion
    ? searchKnowledge("Ich bin neu Mitgliedschaft Veranstaltungen Regional Kontakt SIGs", 6)
    : contextualMatches;

  if (directAnswer) {
    return {
      answerId,
      confidence: "high",
      text: restoreGermanUmlauts(stripUnapprovedUrls(directAnswer)),
      sources: sourcePayload(effectiveMatches),
    };
  }

  if (effectiveMatches.length === 0) {
    return {
      answerId,
      confidence: "low",
      text:
        "Dazu finde ich hier noch keine verlässliche Information. Für neue Mitglieder wäre das eine gute Ergänzung für die Onboarding-FAQ; bis dahin sollte die Frage an eine zuständige Person weitergegeben werden.",
      sources: [],
    };
  }

  if (env.useSaia) {
    const saiaResult = await askSaia(resolvedQuestion, effectiveMatches, conversation);
    const saiaAnswer = saiaResult.text;
    const rejectionReason = generatedAnswerRejectionReason(saiaAnswer);
    if (!rejectionReason) {
      const finalText = stripOpeningGreeting(
        appendRelevantLinks(stripUnapprovedUrls(saiaAnswer), question, effectiveMatches)
      );
      await logUsage({
        answerId,
        provider: "saia",
        model: saiaResult.model,
        status: "ok",
        usage: saiaResult.usage,
        finalText,
        sourceCount: effectiveMatches.length,
      });

      return {
        answerId,
        confidence: confidenceFromMatches(effectiveMatches),
        text: restoreGermanUmlauts(finalText),
        sources: sourcePayload(effectiveMatches),
      };
    }

    const sourceFallback = buildSourceFallbackAnswer(resolvedQuestion, effectiveMatches);
    if (sourceFallback) {
      const finalText = restoreGermanUmlauts(stripUnapprovedUrls(sourceFallback));
      await logUsage({
        answerId,
        provider: "saia",
        model: saiaResult.model,
        status: saiaResult.error ? `fallback:${saiaResult.error}` : `fallback:${rejectionReason}`,
        usage: saiaResult.usage,
        finalText,
        sourceCount: effectiveMatches.length,
      });

      return {
        answerId,
        confidence: confidenceFromMatches(effectiveMatches),
        text: finalText,
        sources: sourcePayload(effectiveMatches),
      };
    }

    if (saiaResult.error === "quota") {
      await logUsage({
        answerId,
        provider: "saia",
        model: saiaResult.model,
        status: "quota",
        usage: saiaResult.usage,
        finalText: "",
        sourceCount: effectiveMatches.length,
      });

      return {
        answerId,
        confidence: "low",
        text:
          "Gerade ist das SAIA-Kontingent ausgeschöpft. Versuch es später noch einmal. Ich gebe lieber keine ungenaue Ersatzantwort aus, weil die Orientierung für neue Mitglieder verlässlich bleiben soll.",
        sources: sourcePayload(effectiveMatches),
      };
    }

    console.warn("SAIA answer rejected", rejectionReason, saiaAnswer.slice(0, 240));
    await logUsage({
      answerId,
        provider: "saia",
        model: saiaResult.model,
        status: `rejected:${rejectionReason}`,
        usage: saiaResult.usage,
        finalText: saiaAnswer,
        sourceCount: effectiveMatches.length,
      });

    return {
      answerId,
      confidence: "low",
      text:
        "Gerade konnte keine verlässliche Antwort erzeugt werden. Versuch es gleich noch einmal oder formuliere die Frage etwas konkreter.",
      sources: sourcePayload(effectiveMatches),
    };
  }

  if (env.useOllama) {
    const ollamaAnswer = await askOllama(question, effectiveMatches);
    if (ollamaAnswer && !isUnsafeGeneratedAnswer(ollamaAnswer)) {
      return {
        answerId,
        confidence: confidenceFromMatches(effectiveMatches),
        text: restoreGermanUmlauts(stripUnapprovedUrls(ollamaAnswer)),
        sources: sourcePayload(effectiveMatches),
      };
    }
  }

  return {
    answerId,
    confidence: confidenceFromMatches(effectiveMatches),
    text: restoreGermanUmlauts(stripUnapprovedUrls(stripOpeningGreeting(buildExtractiveAnswer(resolvedQuestion, effectiveMatches)))),
    sources: sourcePayload(effectiveMatches),
  };
}

function buildGreetingAnswer(question) {
  const contextualLocSec = extractLocSecContext(question);
  const contactEmail = findLocSecContact(contextualLocSec);
  const regionalPageUrl = findRegionalPageUrl(contextualLocSec);
  const eventCalendarUrl = "https://www.mensa.de/about/veranstaltungen/";

  const answer = [
    "Schön, dass du jetzt Teil von Mensa bist.",
    "",
    "Ein guter nächster Schritt ist deine regionale Gruppe, ein erstes Treffen und bei Interesse auch ein Blick auf SIGs.",
    "",
    `Den Veranstaltungskalender findest du hier: ${eventCalendarUrl}`,
  ];

  if (regionalPageUrl && contextualLocSec) {
    answer.push("", `Für deine Region passt diese Seite: ${regionalPageUrl}`);
  }

  if (contactEmail) {
    answer.push("", `Für regionale Rückfragen hilft dir ${contactEmail}.`);
  }

  return answer.join("\n");
}

function buildDirectAnswer(question) {
  const contextualLocSec = extractLocSecContext(question);
  const contextualPostcode = extractPostcodeContext(question);
  const contactEmail = findLocSecContact(contextualLocSec);
  const locsecContact = contactEmail ? findContactByEmail(contactEmail) : null;
  const officeContact = null;
  const relevantContacts = findRelevantContacts(question, contextualLocSec, 3);
  const primary = primaryQuestion(question);
  const compactPrimary = primary.replace(/\s+/g, "");

  if (/^\d{4,5}$/.test(compactPrimary)) {
    const lookup = lookupLocSecByPostcode(compactPrimary);
    if (lookup.locsec) {
      return `Für die PLZ ${lookup.postcode} ist das LocSec-Gebiet ${lookup.locsec} zuständig.`;
    }

    return "Für diese PLZ ist keine Region hinterlegt. Bitte manuell prüfen.";
  }

  const personRegionClaim = extractPersonRegionClaim(question);
  if (personRegionClaim) {
    const expectedEmail = findLocSecContact(personRegionClaim.locsec);
    const expectedContact = expectedEmail ? findContactByEmail(expectedEmail) : null;
    const matchingContacts = findContactsByPersonName(personRegionClaim.person);
    const exactMatch = matchingContacts.find((entry) => normalize(entry.email) === normalize(expectedEmail));

    if (exactMatch && expectedEmail) {
      return `${personRegionClaim.person} ist in der Wissensbasis als LocSec für ${personRegionClaim.locsec} hinterlegt. Kontakt: ${expectedEmail}.`;
    }

    if (expectedContact && expectedEmail) {
      return `In der Wissensbasis ist für ${personRegionClaim.locsec} aktuell ${expectedContact.label} hinterlegt. Kontakt: ${expectedEmail}.`;
    }
  }

  const namedPerson = extractNamedPerson(question);
  if (namedPerson) {
    const matchingContacts = findContactsByPersonName(namedPerson);
    if (matchingContacts.length > 0) {
      const primaryContact = matchingContacts[0];
      const locsec = findLocSecByEmail(primaryContact.email);
      if (locsec) {
        return `${primaryContact.label} ist in der Wissensbasis als LocSec für ${locsec} hinterlegt. Du erreichst ${nameReference(primaryContact.label)} unter ${primaryContact.email}.`;
      }

      return `${primaryContact.label} ist in der Wissensbasis als Kontakt hinterlegt. Du erreichst ${nameReference(primaryContact.label)} unter ${primaryContact.email}.`;
    }
  }

  if (asksForCurrentLocSec(question)) {
    if (contextualLocSec) {
      const postcodeText = contextualPostcode ? ` ${contextualPostcode}` : "";
      return `Für die PLZ${postcodeText} ist das LocSec-Gebiet ${contextualLocSec} zuständig.`;
    }

    return "Gib mir bitte mindestens die ersten vier Ziffern deiner PLZ, dann sage ich dir, welches LocSec-Gebiet für dich zuständig ist.";
  }

  if (asksForPostcodeRegion(question)) {
    if (contextualLocSec) {
      const postcodeText = contextualPostcode ? ` ${contextualPostcode}` : "";
      return `Für die PLZ${postcodeText} ist das LocSec-Gebiet ${contextualLocSec} zuständig.`;
    }

    return [
      "Gib mir bitte mindestens die ersten vier Ziffern deiner PLZ, dann ordne ich dir das passende LocSec-Gebiet zu.",
    ].join("\n");
  }

  if (asksForToolOverview(question)) {
    const answer = [
      "Die öffentliche Demo enthält keine Informationen zu internen Tools.",
      "",
      "Aktuelle und verbindliche Informationen findest du im offiziellen Mitgliederbereich.",
      "Link: Mitgliederbereich - https://www.mensa.de/members/",
    ];

    return answer.join("\n");
  }

  if (asksForSourceOrigin(question)) {
    return [
      "Die öffentliche Demo verwendet eine kleine, selbst formulierte Beispiel-Wissensbasis.",
      "",
      "Sie enthält keine Kopie der Mensa-Website, keine internen Seiten und kein Kontaktverzeichnis. Für aktuelle und verbindliche Informationen verweist Atlas auf offizielle öffentliche Seiten.",
    ].join("\n");
  }

  if (asksForAtlasBot(question)) {
    return [
      "Atlas ist ein Chatbot-Prototyp für die Orientierung neuer Mitglieder in einer Community.",
      "",
      "Er beantwortet viele Fragen direkt aus der hinterlegten Wissensbasis. Bei regionalen Themen hilft deine PLZ bei der Zuordnung, und bei offeneren Fragen kann ein optionales Sprachmodell unterstützen.",
      "",
      "Atlas ist eine Beta. Chatverläufe werden standardmäßig nicht gespeichert.",
    ].join("\n");
  }

  if (asksForMChat(question)) {
    return "Informationen zu internen Kommunikationsdiensten sind nicht Bestandteil der öffentlichen Demo. Bitte nutze dafür die offiziellen Mitgliederinformationen.";
  }

  if (asksForWebsiteOverview(question)) {
    const answer = [
      "Für den Einstieg sind diese Websites hilfreich:",
      "",
      ...officialEntryLinks.map((link) => `${link.label}: ${link.description}\n${link.url}`),
    ];

    const regionalPageUrl = findRegionalPageUrl(contextualLocSec);
    if (regionalPageUrl) {
      answer.push("", `Regionalseite ${contextualLocSec}: ${regionalPageUrl}`);
    }

    return answer.join("\n");
  }

  if (asksForFirstSteps(question)) {
    const answer = [];

    if (contextualLocSec) {
      answer.push(
        `Für deinen Einstieg im LocSec-Gebiet ${contextualLocSec} reicht meist ein einfacher erster Schritt:`,
        "",
        "Such dir zuerst die regionale Gruppe und schau nach einer niedrigschwelligen Veranstaltung in deiner Nähe.",
        "",
        "Danach kannst du thematische Gruppen oder überregionale Veranstaltungen dazunehmen, wenn du möchtest.",
        "",
        "Für allgemeine Fragen hilft die offizielle Kontaktseite."
      );

      if (contactEmail) {
        answer.push("", `Für regionale Rückfragen hilft meist ${contactEmail}.`);
      }
    } else {
      answer.push(
        "Wenn du magst, gib mir einfach deine PLZ, dann ordne ich dir das passende LocSec-Gebiet zu.",
        "",
        "Danach helfen dir die regionale Seite und der Veranstaltungskalender am schnellsten weiter.",
        "",
        "Für allgemeine Fragen hilft die offizielle Kontaktseite."
      );

      if (officeContact) {
        answer[0] = "Wenn du magst, gib mir einfach deine PLZ, dann ordne ich dir das passende LocSec-Gebiet zu.";
        answer[4] = `Für allgemeine Fragen hilft meist ${officeContact.email}.`;
      }
    }

    return answer.join("\n");
  }

  if (asksForEventDiscovery(question)) {
    const answer = [];
    const eventCalendarUrl = "https://www.mensa.de/about/veranstaltungen/";

    if (contextualLocSec) {
      answer.push(
        `Für das LocSec-Gebiet ${contextualLocSec} findest du Veranstaltungen am schnellsten über die Regionalseite und den Veranstaltungskalender.`,
        "",
        "Dort siehst du, welche Treffen es in deiner Nähe gibt und ob eine Anmeldung nötig ist."
      );

      const regionalPageUrl = findRegionalPageUrl(contextualLocSec);
      if (regionalPageUrl) {
        answer.push("", `Regionalseite ${contextualLocSec}: ${regionalPageUrl}`);
      }

      if (contactEmail) {
        answer.push("", `Für Rückfragen hilft meist ${contactEmail}.`);
      }
    } else {
      answer.push(
        "Schau zuerst in die regionale Übersicht und in den Veranstaltungskalender. Dort findest du die Treffen am schnellsten.",
        "",
        "Wenn du mir deine PLZ gibst, nenne ich dir die passende Region dazu."
      );

      if (officeContact) {
        answer.push("", `Für allgemeine Rückfragen hilft meist ${officeContact.email}.`);
      }
    }

    answer.push("", `Veranstaltungskalender: ${eventCalendarUrl}`);
    return answer.join("\n");
  }

  if (asksForNearbyMeetings(question)) {
    const answer = [];
    const eventCalendarUrl = "https://www.mensa.de/about/veranstaltungen/";

    if (contextualLocSec) {
      answer.push(
        `Für dich ist das LocSec-Gebiet ${contextualLocSec} relevant.`,
        "",
        "Ein guter nächster Schritt ist, auf der Regionalseite und im Veranstaltungskalender nach Treffen in deiner Nähe zu schauen. Wenn ein Termin nur knapp beschrieben ist, kannst du kurz beim LocSec nachfragen, ob du einfach dazukommen kannst oder ob eine Anmeldung sinnvoll ist."
      );

      if (contactEmail) {
        answer.push("", `Für Rückfragen vor dem ersten Treffen passt meist eine kurze Mail an ${contactEmail}.`);
      }
    } else {
      answer.push(
        "Schau zuerst in die regionale Übersicht und in den Veranstaltungskalender. Dort findest du die Treffen in deiner Nähe am schnellsten.",
        "",
        "Wenn du mir deine PLZ gibst, ordne ich dir die passende Region dazu ein."
      );

      if (officeContact) {
        answer.push("", `Für allgemeine Rückfragen hilft meist ${officeContact.email}.`);
      }
    }

    const regionalPageUrl = findRegionalPageUrl(contextualLocSec);
    if (regionalPageUrl) {
      answer.push("", `Regionalseite ${contextualLocSec}: ${regionalPageUrl}`);
    }

    answer.push("", `Veranstaltungskalender: ${eventCalendarUrl}`);

    return answer.join("\n");
  }

  if (asksForLocalContactMessage(question)) {
    const answer = [];

    if (contextualLocSec) {
      answer.push(
        `Für eine erste Nachricht im LocSec-Gebiet ${contextualLocSec} reicht meist etwas Kurzes und Freundliches:`,
        "",
        "Sag einfach, dass du neu bei Mensa bist, aus welcher Ecke du ungefähr kommst und auf welches Treffen oder welche Art von Veranstaltung du dich beziehst.",
        "",
        "Eine gute kurze Formulierung ist zum Beispiel: Ich bin neu bei Mensa und komme aus deiner Region. Ich wollte fragen, ob ich zu einem der nächsten Treffen dazukommen kann und ob ich dafür noch etwas beachten sollte."
      );

      if (contactEmail) {
        answer.push("", `Dafür kannst du direkt an ${contactEmail} schreiben.`);
      }
    } else {
      answer.push(
        "Schreib kurz, dass du neu bei Mensa bist, aus welcher Region du kommst und worum es dir geht.",
        "",
        "Eine gute kurze Formulierung ist zum Beispiel: Ich bin neu bei Mensa und komme aus meiner Region. Ich wollte fragen, wer für mein Thema zuständig ist und worauf ich beim ersten Kontakt achten sollte."
      );

      if (officeContact) {
        answer.push("", `Für allgemeine Anfragen hilft meist ${officeContact.email}.`);
      }
    }

    return answer.join("\n");
  }

  if (asksForWhoToContact(question) || asksForContact(question)) {
    const answer = [];
    const topicContacts = hasSpecificContactTopic(question) ? findRelevantContacts(question, contextualLocSec, 3) : [];

    if (contextualLocSec) {
      answer.push(
        `Bei regionalen Fragen ist im LocSec-Gebiet ${contextualLocSec} der LocSec meist der beste erste Kontakt.`,
        "",
        "Wenn es um Treffen in deiner Nähe, den Einstieg vor Ort oder eine kurze Rückfrage zu einer Veranstaltung geht, bist du dort richtig aufgehoben."
      );

      if (contactEmail) {
        const contactLabel = locsecContact?.label && !normalize(locsecContact.label).includes(normalize(contactEmail))
          ? `${locsecContact.label}: `
          : "";
        answer.push("", `Für ${contextualLocSec} ist das in der Regel ${contactLabel}${contactEmail}.`);
      }
    } else {
      answer.push(
        "Für allgemeine Fragen ist die Geschäftsstelle die erste Anlaufstelle.",
        "",
        "Wenn du eine regionale Frage hast, ist der LocSec vor Ort meist die passendste Kontaktperson."
      );

      if (officeContact) {
        answer.push("", `Konkreter Kontakt: ${officeContact.email}.`);
      }
    }

    if (topicContacts.length > 0) {
      answer.push("", "Passende Kontakte aus der Wissensbasis:", ...formatContactLines(topicContacts));
    }

    return answer.join("\n");
  }

  if (asksForMeetingAttendance(question)) {
    const answer = [];

    if (contextualLocSec) {
      answer.push(
        `Im LocSec-Gebiet ${contextualLocSec} kannst du zu vielen Treffen grundsätzlich dazukommen, aber entscheidend ist immer die jeweilige Veranstaltungsbeschreibung.`,
        "",
        "Schau deshalb zuerst auf den konkreten Termin: Dort steht normalerweise, ob das Treffen offen ist, ob Gäste willkommen sind und ob du dich vorher anmelden solltest.",
        "",
        "Wenn etwas unklar bleibt, reicht vor dem ersten Besuch eine kurze Rückfrage beim LocSec-Team."
      );

      if (contactEmail) {
        answer.push("", `Dafür passt meist eine kurze Mail an ${contactEmail}.`);
      }
    } else {
      answer.push(
        "Ob du einfach dazukommen kannst, steht immer in der jeweiligen Veranstaltungsbeschreibung.",
        "",
        "Dort siehst du, ob das Treffen offen ist, ob eine Anmeldung nötig ist oder ob es eine besondere Form gibt.",
        "",
        "Wenn du deine PLZ angibst, nenne ich dir die passende Region dazu."
      );

      if (officeContact) {
        answer.push("", `Für allgemeine Rückfragen hilft meist ${officeContact.email}.`);
      }
    }

    return answer.join("\n");
  }

  if (asksForMeetingRegistration(question)) {
    const answer = [];

    if (contextualLocSec) {
      answer.push(
        `Ob du dich für ein Treffen im LocSec-Gebiet ${contextualLocSec} anmelden musst, steht normalerweise direkt in der jeweiligen Veranstaltungsbeschreibung.`,
        "",
        "Manche Treffen sind offen und unkompliziert, bei anderen ist eine Anmeldung sinnvoll oder nötig, zum Beispiel wegen Reservierungen, begrenzter Plätze oder Planung.",
        "",
        "Wenn der Termin knapp beschrieben ist, frag lieber kurz nach, statt zu raten."
      );

      if (contactEmail) {
        answer.push("", `Für solche Rückfragen kannst du ${contactEmail} anschreiben.`);
      }
    } else {
      answer.push(
        "Ob eine Anmeldung nötig ist, steht normalerweise direkt in der Veranstaltungsbeschreibung.",
        "",
        "Manche Treffen sind offen und unkompliziert, bei anderen ist eine Anmeldung sinnvoll oder nötig, zum Beispiel wegen Reservierungen, begrenzter Plätze oder Planung.",
        "",
        "Wenn der Termin knapp beschrieben ist, frag lieber kurz nach, statt zu raten."
      );

      if (officeContact) {
        answer.push("", `Für allgemeine Rückfragen hilft meist ${officeContact.email}.`);
      }
    }

    return answer.join("\n");
  }

  if (asksForSigs(question)) {
    const answer = [
      "SIG steht für Special Interest Group.",
      "",
      "Das sind thematische Gruppen innerhalb von Mensa, zum Beispiel zu Spielen, Sprache, Wissenschaft, Kultur oder Reisen.",
      "",
      "Für Neumitglieder sind SIGs oft ein guter Einstieg, wenn gerade kein regionales Treffen passt oder ein gemeinsames Thema den Kontakt leichter macht.",
    ];

    const regionalSigLink = findRegionalSigLink(contextualLocSec);

    if (asksForLinkRequest(question)) {
      answer.push(
        "",
        "Weitere Informationen findest du über die offiziellen öffentlichen Seiten von Mensa in Deutschland."
      );
    }

    if (regionalSigLink) {
      answer.push("", `Kontakt: ${regionalSigLink.label} - E-Mail: ${regionalSigLink.email}`);
    }

    return answer.join("\n");
  }

  if (asksForMensaYouth(question)) {
    const answer = [
      "Mensa Youth ist der Bereich für junge Erwachsene bei Mensa in Deutschland.",
      "",
      "Dazu gehören Angebote auf lokaler, regionaler und internationaler Ebene, zum Beispiel regelmäßige Treffen in manchen Städten, gemeinsame Pubquiz-Besuche, Ausflüge in Kultur und Natur sowie überregionale Tagesveranstaltungen.",
    ];

    if (asksForLinkRequest(question)) {
      answer.push("", "Link: Mensa Youth - https://www.mensa.de/young-adults/");
    }

    return answer.join("\n");
  }

  if (asksForKidsAndJuniors(question)) {
    const answer = [
      "Kids & Juniors ist der Mensa-Bereich für hochbegabte Kinder, Jugendliche und Familien.",
      "",
      "Dazu gehören regionale Angebote sowie Camps und Seminare für verschiedene Altersgruppen.",
    ];

    if (asksForLinkRequest(question)) {
      answer.push("", "Link: Kids & Juniors - https://www.mensa.de/kiju/");
    }

    return answer.join("\n");
  }

  return "";
}

function asksForPostcodeRegion(question) {
  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  if (!(tokenSet.has("plz") || tokenSet.has("postleitzahl"))) return false;

  const regionIntent =
    tokenSet.has("region") ||
    tokenSet.has("gebiet") ||
    tokenSet.has("zuständig") ||
    tokenSet.has("zustaendig") ||
    tokenSet.has("zustandig") ||
    tokenSet.has("locsec") ||
    tokenSet.has("zugeordnet") ||
    tokenSet.has("zuordnung");

  if (!regionIntent) return false;

  const topicTokens = [
    "sig",
    "sigs",
    "youth",
    "kids",
    "juniors",
    "kiju",
    "treffen",
    "veranstaltung",
    "veranstaltungen",
    "mitglied",
    "kontakt",
    "kontakte",
    "mail",
    "email",
    "website",
    "websites",
    "seite",
    "seiten",
    "anmelden",
    "anmeldung",
    "einsteigen",
    "einstieg",
  ];

  return !topicTokens.some((token) => tokenSet.has(token));
}

function asksForCurrentLocSec(question) {
  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  if (!tokenSet.has("locsec")) return false;

  const normalizedQuestion = normalize(primaryQuestion(question));
  return (
    /\bmein\s+locsec\b/.test(normalizedQuestion) ||
    /\bwas\s+ist\s+mein\s+locsec\b/.test(normalizedQuestion) ||
    /\bwelches\s+locsec\b/.test(normalizedQuestion) ||
    /\bwer\s+ist\s+mein\s+locsec\b/.test(normalizedQuestion) ||
    /\bwelches\s+locsec(?:-gebiet)?\s+habe\s+ich\b/.test(normalizedQuestion)
  );
}

function extractNamedPerson(question) {
  const primary = primaryQuestion(question).trim();
  const match = primary.match(/^wer\s+ist\s+(.+?)[?!.]*$/i);
  if (!match) return "";
  return sanitizeText(match[1]);
}

function extractPersonRegionClaim(question) {
  const primary = primaryQuestion(question).trim();
  const match = primary.match(/^(.+?)\s+(?:ist|waere|wäre|muesste|müsste)(?:\s+wohl|\s+doch)?\s+(?:der\s+)?locsec\s+von\s+(.+?)(?:\s+sein)?[?!.]*$/i);
  if (!match) return null;

  return {
    person: sanitizeText(match[1]),
    locsec: canonicalizeLocSecName(sanitizeText(match[2])),
  };
}

function nameReference(label) {
  const firstName = sanitizeText(String(label || "").split(/\s+/)[0] || "");
  return firstName || "die Person";
}

function asksForToolOverview(question) {
  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  return (
    tokenSet.has("tool") ||
    tokenSet.has("tools") ||
    tokenSet.has("werkzeug") ||
    tokenSet.has("werkzeuge") ||
    tokenSet.has("confluence") ||
    tokenSet.has("emvz") ||
    tokenSet.has("beschlussdatenbank") ||
    tokenSet.has("mitgliederbereich")
  );
}

function asksForSourceOrigin(question) {
  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  return (
    tokenSet.has("herkunft") ||
    tokenSet.has("quelle") ||
    tokenSet.has("quellen") ||
    tokenSet.has("infos") ||
    tokenSet.has("informationen") ||
    tokenSet.has("daten") ||
    tokenSet.has("datengrundlage")
  );
}

function asksForAtlasBot(question) {
  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  if (!tokenSet.has("atlas")) return false;

  const normalizedQuestion = normalize(primaryQuestion(question));
  return (
    /\b(wie|was|woher|wer|über|ueber|funktioniert|ist)\b/.test(normalizedQuestion) ||
    tokenSet.size <= 3
  );
}

function asksForMChat(question) {
  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  return tokenSet.has("mchat") || tokenSet.has("chatdienst") || tokenSet.has("kommunikationsdienst");
}

function isGreetingQuestion(question) {
  const normalizedQuestion = normalize(primaryQuestion(question)).replace(/[!?.,]+/g, " ").trim();
  if (!normalizedQuestion) return false;

  if (
    normalizedQuestion === "hallo" ||
    normalizedQuestion === "hi" ||
    normalizedQuestion === "hey" ||
    normalizedQuestion === "moin" ||
    normalizedQuestion === "servus" ||
    normalizedQuestion === "grüßgott" ||
    normalizedQuestion === "grussgott" ||
    normalizedQuestion === "gruss dich" ||
    normalizedQuestion === "gruß dich"
  ) {
    return true;
  }

  if (/^guten\s+(tag|morgen|abend)$/.test(normalizedQuestion)) return true;

  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  const hasGreetingToken =
    tokenSet.has("hallo") ||
    tokenSet.has("hi") ||
    tokenSet.has("hey") ||
    tokenSet.has("moin") ||
    tokenSet.has("servus") ||
    (tokenSet.has("guten") && (tokenSet.has("tag") || tokenSet.has("morgen") || tokenSet.has("abend")));

  if (!hasGreetingToken) return false;

  return tokenSet.size <= 3;
}

function asksForFirstSteps(question) {
  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  if (asksForLinkRequest(question)) return false;
  return (
    (tokenSet.has("neu") && tokenSet.has("zuerst")) ||
    (tokenSet.has("neu") && tokenSet.has("erste")) ||
    tokenSet.has("einstieg") ||
    tokenSet.has("neumitglied")
  );
}

function asksForNearbyMeetings(question) {
  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  return (
    (tokenSet.has("treffen") && (tokenSet.has("nähe") || tokenSet.has("naehe"))) ||
    (tokenSet.has("veranstaltungen") && (tokenSet.has("nähe") || tokenSet.has("naehe")))
  );
}

function asksForEventDiscovery(question) {
  const normalizedQuestion = normalize(primaryQuestion(question));
  return (
    /\bwo\s+(?:kann\s+ich\s+)?(?:die\s+)?veranstalt\w*\s+(?:finden|sehen|schauen)\b/.test(normalizedQuestion) ||
    /\bwo\s+finde\s+ich\s+(?:die\s+)?veranstalt\w*\b/.test(normalizedQuestion) ||
    /\bveranstalt\w*\s+(?:finden|sehen|schauen)\b/.test(normalizedQuestion)
  );
}

function asksForMeetingAttendance(question) {
  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  return (
    tokenSet.has("treffen") &&
    (
      (tokenSet.has("einfach") && tokenSet.has("gehen")) ||
      tokenSet.has("dazukommen") ||
      tokenSet.has("vorbeikommen")
    )
  );
}

function asksForMeetingRegistration(question) {
  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  return (
    (tokenSet.has("treffen") || tokenSet.has("veranstaltung") || tokenSet.has("veranstaltungen")) &&
    (
      tokenSet.has("anmelden") ||
      tokenSet.has("anmeldung")
    )
  );
}

function asksForLocalContactMessage(question) {
  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  return (
    tokenSet.has("schreibe") ||
    tokenSet.has("schreiben") ||
    tokenSet.has("nachricht") ||
    tokenSet.has("formulieren")
  ) && (
    tokenSet.has("kontakt") ||
    tokenSet.has("locsec") ||
    hasContactPersonToken(tokenSet)
  );
}

function asksForWhoToContact(question) {
  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  const hasWhoIntent = tokenSet.has("wer") || tokenSet.has("wen") || (tokenSet.has("wende") && tokenSet.has("mich"));
  const hasResponsibilityIntent =
    tokenSet.has("zustaendig") ||
    tokenSet.has("zustandig") ||
    tokenSet.has("zustaendige") ||
    tokenSet.has("zustandige");
  const hasContactIntent =
    tokenSet.has("kontaktiere") ||
    tokenSet.has("kontakt") ||
    hasContactPersonToken(tokenSet) ||
    hasResponsibilityIntent;

  return (
    (hasWhoIntent && hasContactIntent) ||
    ((tokenSet.has("mein") || tokenSet.has("meine")) && hasContactPersonToken(tokenSet))
  );
}

function asksForContact(question) {
  const tokens = tokenize(primaryQuestion(question));
  return tokens.some((token) =>
    token.startsWith("kontakt") ||
    [
      "kontakt",
      "contact",
      "email",
      "mail",
      "telefon",
      "adresse",
      "ansprechperson",
      "ansprechpartner",
      "ansprechpartnerin",
      "mitgliederbetreuung",
      "geschaeftsstelle",
    ].includes(token)
  );
}

function hasContactPersonToken(tokenSet) {
  return (
    tokenSet.has("ansprechperson") ||
    tokenSet.has("ansprechpartner") ||
    tokenSet.has("ansprechpartnerin")
  );
}

function asksForMembership(question) {
  const tokens = tokenize(primaryQuestion(question));
  return tokens.some((token) =>
    token.startsWith("mitglied") ||
    ["beitreten", "aufnahme", "aufnehmen", "aufnahmetest", "iq", "intelligenztest", "test", "tests"].includes(token)
  );
}

function asksForRegionalMeetings(question) {
  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  return (
    tokenSet.has("naehe") ||
    tokenSet.has("nähe") ||
    tokenSet.has("treffen") ||
    tokenSet.has("veranstaltung") ||
    tokenSet.has("veranstaltungen") ||
    tokenSet.has("stammtisch") ||
    tokenSet.has("regional") ||
    tokenSet.has("region")
  );
}

function asksForMemberResources(question) {
  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  return (
    tokenSet.has("einführungsseite") ||
    tokenSet.has("einführungsseiten") ||
    tokenSet.has("einfuehrungsseite") ||
    tokenSet.has("einfuehrungsseiten") ||
    tokenSet.has("einstieg") ||
    tokenSet.has("start") ||
    tokenSet.has("aktiv") ||
    tokenSet.has("aktive")
  );
}

function asksForLinkRequest(question) {
  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  return (
    tokenSet.has("website") ||
    tokenSet.has("websites") ||
    tokenSet.has("webseite") ||
    tokenSet.has("seiten") ||
    tokenSet.has("seite") ||
    tokenSet.has("url") ||
    tokenSet.has("urls") ||
    tokenSet.has("link") ||
    tokenSet.has("links") ||
    tokenSet.has("einführungsseite") ||
    tokenSet.has("einführungsseiten") ||
    tokenSet.has("einfuehrungsseite") ||
    tokenSet.has("einfuehrungsseiten")
  );
}

function asksForWebsiteOverview(question) {
  if (!asksForLinkRequest(question)) return false;

  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  const asksForBroadEntry =
    tokenSet.has("alle") ||
    tokenSet.has("top") ||
    tokenSet.has("übersicht") ||
    tokenSet.has("uebersicht") ||
    tokenSet.has("hilfreich") ||
    tokenSet.has("wichtige") ||
    tokenSet.has("wichtigsten") ||
    tokenSet.has("einstieg") ||
    tokenSet.has("einführungsseite") ||
    tokenSet.has("einführungsseiten") ||
    tokenSet.has("einfuehrungsseite") ||
    tokenSet.has("einfuehrungsseiten");
  const asksForSpecificArea =
    asksForMembership(question) ||
    asksForRegionalMeetings(question) ||
    asksForContact(question) ||
    asksForMensaYouth(question) ||
    asksForKidsAndJuniors(question) ||
    asksForSigs(question) ||
    asksForToolOverview(question);

  return asksForBroadEntry || !asksForSpecificArea;
}

function asksForMensaYouth(question) {
  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  return (
    tokenSet.has("youth") ||
    tokenSet.has("young") ||
    tokenSet.has("adults") ||
    (tokenSet.has("junge") && tokenSet.has("erwachsene"))
  );
}

function asksForLocSecDefinition(question) {
  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  if (!tokenSet.has("locsec")) return false;
  return !asksForCurrentLocSec(question);
}

function asksForSigs(question) {
  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  if (!(tokenSet.has("sig") || tokenSet.has("sigs"))) return false;

  const normalizedQuestion = normalize(primaryQuestion(question));
  const definitionIntent =
    /\bwas\s+(?:ist|sind)\b/.test(normalizedQuestion) ||
    /\b(?:ist|sind|bedeutet|bedeuten|definition|erkläre|erklaere)\b/.test(normalizedQuestion);

  if (!definitionIntent) return false;

  return !(
    tokenSet.has("plz") ||
    tokenSet.has("postleitzahl") ||
    tokenSet.has("region") ||
    tokenSet.has("gebiet") ||
    tokenSet.has("treffen") ||
    tokenSet.has("veranstaltung") ||
    tokenSet.has("kontakte") ||
    tokenSet.has("kontakt")
  );
}

function asksForKidsAndJuniors(question) {
  const tokenSet = new Set(tokenize(primaryQuestion(question)));
  return (
    tokenSet.has("kids") ||
    tokenSet.has("juniors") ||
    tokenSet.has("kiju") ||
    tokenSet.has("kinder") ||
    tokenSet.has("jugend") ||
    tokenSet.has("jugendliche") ||
    tokenSet.has("eltern") ||
    tokenSet.has("familie") ||
    tokenSet.has("familien")
  );
}

function generatedAnswerRejectionReason(answer) {
  if (!answer) return "empty";
  if (isUnsafeGeneratedAnswer(answer)) return "unsafe";
  if (isIncompleteGeneratedAnswer(answer)) return "incomplete";
  return "";
}

function buildSourceFallbackAnswer(question, matches) {
  if (!asksForDefinitionLikeQuestion(question)) return "";

  const topMatch = matches[0];
  if (!topMatch || Number(topMatch.score || 0) < 6) return "";

  const excerpt = sanitizeText(topMatch.text || topMatch.excerpt || "");
  if (!excerpt) return "";

  const sentences = excerpt
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 2);

  return sentences.join(" ");
}

function asksForDefinitionLikeQuestion(question) {
  const normalizedQuestion = normalize(primaryQuestion(question));
  return (
    /\bwofuer\s+steht\b/.test(normalizedQuestion) ||
    /\bwas\s+bedeutet\b/.test(normalizedQuestion) ||
    /\bwas\s+ist\b/.test(normalizedQuestion) ||
    /\bbedeutet\b/.test(normalizedQuestion) ||
    /\bdefinition\b/.test(normalizedQuestion) ||
    /\berklaere\b/.test(normalizedQuestion)
  );
}

function isUnsafeGeneratedAnswer(answer) {
  const normalizedAnswer = normalize(answer);
  const unsafePatterns = [
    "link zur",
    "name der geschaeftsstelle",
    "name der geschaftsstelle",
    "hier klicken",
    "auf unserer website",
    "unsere website",
    "unserer website",
    "was moechtest du zuerst tun",
    "was moechtest du wissen",
    "wie kann ich dir helfen",
    "wie kann ich ihnen",
    "behilflich sein",
    "du: hallo",
    "ich bin ein onboarding-assistent",
    "ich helfe dir gerne bei der orientierung",
    "ich helfe dir gerne dabei",
  ];

  return unsafePatterns.some((pattern) => normalizedAnswer.includes(normalize(pattern)));
}

function isIncompleteGeneratedAnswer(answer) {
  const trimmed = answer.trim();
  if (trimmed.length < 220) return false;
  if (/https?:\/\/\S+$/i.test(trimmed) || /^Link:/im.test(trimmed)) return false;
  return !/[.!?)]$/.test(trimmed);
}

function buildGroundedPrompt(question, matches, conversation = []) {
  const greetingQuestion = isGreetingQuestion(question);
  const runtimeContext = buildRuntimeContext();
  const conversationContext = formatConversationContext(conversation);
  const context = matches
    .map((match, index) => `Quelle ${index + 1}: ${match.title}\n${match.text}`)
    .join("\n\n---\n\n");
  const approvedLinks = (asksForLinkRequest(question) ? collectRelevantLinks(question, matches) : [])
    .slice(0, asksForWebsiteOverview(question) ? 8 : 3)
    .map((link) => `- ${link.label}: ${link.url}${link.description ? ` (${link.description})` : ""}`)
    .join("\n");

  return [
    "Du bist ein lokaler Onboarding-Assistent für Neumitglieder von Mensa in Deutschland.",
    "Antworte auf Deutsch, warm, einladend, klar und per Du.",
    "Starte Antworten nicht mit einer Begrüßung wie Hallo, Hi, Guten Tag, Willkommen oder Schön, dass du da bist. Die Begrüßung steht bereits in der ersten Chatnachricht.",
    "Klinge unterstützend gegenüber einem neuen Mitglied: ruhig, konkret und ermutigend, aber nicht übertrieben locker.",
    "Vermeide bürokratischen Ton. Schreibe lieber 'du kannst' oder 'ein guter nächster Schritt ist' als abstrakte Formulierungen.",
    "Schreibe mit deutschen Umlauten und ß, also z. B. für, können, zuständig, verlässlich, ausschließlich.",
    greetingQuestion
      ? "Wenn die Nutzerfrage nur ein Gruß wie Hallo, Hallo?, Hi oder Guten Tag ist, antworte mit einem kurzen warmen Einstieg auf die neue Mitgliedschaft. Nenne als sinnvolle nächste Schritte die regionale Gruppe, eine erste Veranstaltung, den Veranstaltungskalender und SIGs, aber erfinde keinen langen Standardtext."
      : "Beantworte zuerst die konkrete Frage. Ignoriere Quellenabschnitte, die nur zufällig ähnliche Begriffe enthalten, aber nicht zur Frage passen.",
    "Wenn die Frage nach einer Definition fragt, gib zuerst eine kurze Definition in 1-2 Sätzen und ergänze danach höchstens relevante praktische Hinweise.",
    "Bei Fragen nach einem konkreten Begriff oder Bereich wie Mensa Youth, Kids & Juniors, LocSec oder SIGs bleib bei genau diesem Begriff. Hänge keine allgemeine Neumitglieder-Orientierung an, wenn danach nicht gefragt wurde.",
    "Wenn die Frage nach dem Finden von Treffen fragt, erkläre den Weg zum Veranstaltungskalender und regionalen Gruppen.",
    "Wenn die Frage nach Teilnahme, Anmeldung oder einfachem Vorbeikommen fragt, erkläre, dass die konkrete Veranstaltungsbeschreibung entscheidend ist.",
    "Wenn ein regionaler Kontext bekannt ist und die Frage sich auf Einstieg, Treffen oder Kontakt vor Ort bezieht, nenne am Ende die passende Regionalseite und die konkrete Kontaktadresse, falls vorhanden.",
    "Wenn die aktuelle Frage nur als kurze Folgefrage formuliert ist, nutze den unten stehenden Gesprächskontext, um Bezüge wie er, sie, das oder dieser Name korrekt aufzulösen.",
    "Nutze ausschließlich die unten stehenden, selbst formulierten Demo-Quellen. Die öffentliche Repository-Version enthält keine Kopie der Mensa-Website, keine internen Seiten und kein Kontaktverzeichnis. Erfinde keine Vereinsregeln, Kontakte, Termine, Websites, Links, E-Mail-Adressen, Telefonnummern oder internen Prozesse.",
    "Wenn die Frage nach Kontakt, Ansprechpartnern, E-Mail-Adressen oder Zuständigkeiten fragt, nenne möglichst konkrete Kontaktpersonen oder E-Mail-Adressen aus den Quellen und bevorzuge die freigegebenen Kontaktlisten.",
    "Nenne allgemeine Rollenbezeichnungen nur ergänzend, wenn sie mit einer konkreten E-Mail-Adresse oder Person aus den Quellen verbunden sind.",
    "Nenne Links nur, wenn die Frage ausdrücklich nach Websites, Seiten, Links, URLs oder Einführungsseiten fragt.",
    "Wenn nach einer Website-Übersicht oder Einführungsseiten gefragt wird, darfst du bis zu acht Links aus der freigegebenen Linkliste nennen. Beschrifte kurz, wofür sie relevant sind.",
    "Nutze bei Linklisten nur die Beschreibungen aus der freigegebenen Linkliste. Erfinde keine Altersgrenzen oder Zielgruppen-Details.",
    "Wenn nicht ausdrücklich nach Websites oder Links gefragt wird, schreibe keine Link-Zeilen.",
    "Wenn keine passende URL vorhanden ist, schreibe keinen Link und erfinde keine URL.",
    "Du darfst neben den Quellen auch den unten stehenden Betriebskontext verwenden, wenn nach dem aktuell verwendeten Modell, Anbieter oder Betriebsmodus von Atlas gefragt wird.",
    "Wenn du den Modellnamen oder Anbieter aus dem Betriebskontext nennst, übernimm ihn exakt und unverändert. Erfinde keine Versionsnummer und ändere keine Zeichenfolge.",
    "Schreibe 'Ein konkreter Kontakt ist in der lokalen Wissensbasis noch nicht hinterlegt.' nur dann, wenn die Person ausdrücklich nach einem konkreten Kontakt fragt und in den Quellen wirklich keine konkrete Adresse oder Ansprechperson steht.",
    "Wenn die Quellen für die Frage nicht reichen, sage das klar und bitte darum, die Frage an eine zuständige Person weiterzugeben.",
    "Sprich nicht ueber Quellen, Dokumente oder Wissensbasis, ausser wenn ein Kontakt oder eine Information nicht hinterlegt ist.",
    "",
    `Frage: ${question}`,
    "",
    conversationContext ? `Gesprächskontext:\n${conversationContext}\n` : "",
    `Betriebskontext:\n${runtimeContext}`,
    "",
    approvedLinks ? `Freigegebene passende Links:\n${approvedLinks}` : "Freigegebene passende Links: keine",
    "",
    `Quellen:\n${context}`,
  ].join("\n");
}

function buildRuntimeContext() {
  if (env.useSaia) {
    return [
      "Atlas ist aktuell an ein konfiguriertes Sprachmodell angebunden.",
      "Technische Betriebsdetails werden in der öffentlichen Demo nicht näher beschrieben.",
    ].join("\n");
  }

  if (env.useOllama) {
    return [
      "Atlas nutzt aktuell eine optionale lokale Modellintegration.",
      "Technische Betriebsdetails werden in der öffentlichen Demo nicht näher beschrieben.",
    ].join("\n");
  }

  return [
    "Atlas läuft aktuell ohne extern angebundenes Chat-Modell und beantwortet Fragen direkt aus der lokalen Wissensbasis.",
    "Dieser Betriebskontext ist verlässlich und darf bei Fragen zum Modell oder Anbieter direkt genannt werden.",
  ].join("\n");
}

function formatConversationContext(conversation = []) {
  return conversation
    .slice(-6)
    .map((entry) => `${entry.role === "assistant" ? "Atlas" : "Nutzer"}: ${entry.content}`)
    .join("\n");
}

async function askSaia(question, matches, conversation = []) {
  if (!env.saiaApiKey) return { text: "", error: "missing-key", model: env.saiaModel, usage: null };

  const model = env.saiaModel;
  const endpoint = `${env.saiaBaseUrl.replace(/\/$/, "")}/chat/completions`;
  const prompt = buildGroundedPrompt(question, matches, conversation);
  const requestBody = {
    model,
    messages: [
      {
        role: "system",
        content:
          "Du bist Atlas, ein präziser Onboarding-Assistent für neue Mensa-Mitglieder in Deutschland. Antworte nur auf Basis der bereitgestellten Quellen und des explizit angegebenen Betriebskontexts und füge keine unbestätigten Fakten hinzu.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: env.saiaTemperature,
    top_p: env.saiaTopP,
    max_tokens: 2048,
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.saiaApiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.warn("SAIA request failed", response.status, errorText.slice(0, 500));

        if (response.status === 429) {
          return { text: "", error: "quota", model, usage: null };
        }

        if (response.status >= 500 && attempt === 0) {
          continue;
        }

        return { text: "", error: "request-failed", model, usage: null };
      }

      const data = await response.json();
      const text = sanitizeText(data.choices?.[0]?.message?.content || "");
      return {
        text,
        error: "",
        model,
        usage: usageFromOpenAIResponse(model, data.usage, prompt, text),
      };
    } catch (error) {
      console.warn("SAIA request failed", error instanceof Error ? error.message : String(error));
      if (attempt === 0) continue;
      return { text: "", error: "request-failed", model, usage: null };
    }
  }

  return { text: "", error: "request-failed", model, usage: null };
}

function usageFromOpenAIResponse(model, usage, prompt, text) {
  const promptTokens = numberOrEstimate(usage?.prompt_tokens, prompt);
  const outputTokens = numberOrEstimate(usage?.completion_tokens, text);
  const totalTokens = Number(usage?.total_tokens || promptTokens + outputTokens);

  return {
    inputTokens: promptTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd: estimateModelCostUsd(model, promptTokens, outputTokens),
    estimated: !usage,
  };
}

function numberOrEstimate(value, text) {
  const number = Number(value || 0);
  return number > 0 ? number : estimateTokenCount(text);
}

function estimateTokenCount(text) {
  return Math.ceil(String(text || "").length / 4);
}

function estimateModelCostUsd(model, inputTokens, outputTokens) {
  const pricing = modelPricingUsdPerMillion.get(model.replace(/^models\//, ""));
  if (!pricing) return null;
  return roundCurrency((inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output);
}

function roundCurrency(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function appendRelevantLinks(answer, question, matches) {
  if (!asksForLinkRequest(question)) return answer;

  const links = collectRelevantLinks(question, matches).filter((link) => !answer.includes(link.url));
  if (links.length === 0) return answer;
  const limit = asksForWebsiteOverview(question) ? 8 : 3;

  return [
    answer,
    "",
    ...links.slice(0, limit).map((link) => `Link: ${link.label} - ${link.url}`),
  ].join("\n");
}

function stripOpeningGreeting(answer) {
  return String(answer || "")
    .replace(/^\s*(?:hallo|hi|hey|guten\s+(?:tag|morgen|abend)|willkommen)(?:\s+[^,\n!.?]+)?[,\n!.?]\s*/i, "")
    .trim();
}

function collectRelevantLinks(question, matches) {
  const links = [];
  const seen = new Set();
  const contextualLocSec = extractLocSecContext(question);
  const regionalPageUrl = findRegionalPageUrl(contextualLocSec);

  if (asksForWebsiteOverview(question)) {
    officialEntryLinks.forEach((link) => addLink(links, seen, link.label, link.url, link.description));
  }

  if (asksForMembership(question)) {
    addLink(links, seen, "Mitgliedschaft", "https://www.mensa.de/about/membership/", "Einstieg in Mitgliedschaft, Aufnahme und erste Orientierung");
    addLink(links, seen, "IQ-Test bei Mensa", "https://www.mensa.de/about/membership/iq-test-bei-mensa/", "Informationen zum Mensa-IQ-Test");
    addLink(links, seen, "Online-IQ-Test", "https://www.mensa.de/about/membership/online-iq-test/", "Online-Einstieg zum IQ-Test");
    addLink(links, seen, "Psychologensuche", "https://www.mensa.de/about/membership/psychologensuche/", "Anlaufstellen für externe Gutachten");
  }

  if (asksForRegionalMeetings(question)) {
    addLink(links, seen, "Veranstaltungen", "https://www.mensa.de/about/veranstaltungen/", "Einstieg zu Treffen und Veranstaltungen");
    addLink(links, seen, "Mensa Regional", "https://www.mensa.de/about/regional/", "Weg zur eigenen Region oder Stadt");
  }

  if (asksForKidsAndJuniors(question)) {
    addLink(links, seen, "Kids & Juniors", "https://www.mensa.de/kiju/", "Angebote für hochbegabte Kinder, Jugendliche und Familien");
  }

  if (asksForMensaYouth(question)) {
    addLink(links, seen, "Mensa Youth", "https://www.mensa.de/young-adults/", "Angebote für junge Erwachsene");
  }

  if (asksForContact(question)) {
    addLink(links, seen, "Kontakt", "https://www.mensa.de/contact-us/", "Allgemeiner Kontaktweg");
  }

  if (asksForToolOverview(question)) {
    officialToolLinks.forEach((link) => addLink(links, seen, link.label, link.url, link.description));
  }

  if (regionalPageUrl) {
    addLink(links, seen, `Regionalseite ${contextualLocSec}`, regionalPageUrl, `Regionale Einstiegsseite für ${contextualLocSec}`);
  }

  for (const match of matches) {
    for (const url of extractUrls(match.text)) {
      if (!isRelevantUrlForQuestion(url, question)) continue;
      addLink(links, seen, labelForUrl(url, match.title), url);
    }
  }

  return links;
}

function addLink(links, seen, label, url, description = "") {
  const cleanUrl = url.replace(/[.,;]+$/, "");
  const key = cleanUrl.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  links.push({ label, url: cleanUrl, description });
}

function extractUrls(text) {
  return [...String(text || "").matchAll(/https?:\/\/[^\s)]+/gi)].map((match) => match[0]);
}

function isRelevantUrlForQuestion(url, question) {
  const normalizedQuestion = normalize(question);
  const normalizedUrl = normalize(url);

  if (asksForRegionalMeetings(question)) {
    return normalizedUrl.includes("/about/veranstaltungen/") || normalizedUrl.includes("/about/regional/");
  }

  if (asksForMembership(question)) {
    return (
      normalizedUrl.includes("/about/membership/") ||
      normalizedUrl.includes("/about/membership/iq-test-bei-mensa/") ||
      normalizedUrl.includes("/about/membership/online-iq-test/") ||
      normalizedUrl.includes("/about/membership/psychologensuche/")
    );
  }

  if (asksForContact(question)) {
    return (
      normalizedUrl.includes("/contact-us/") ||
      normalizedUrl.includes("/about/regional/")
    );
  }

  if (asksForToolOverview(question)) {
    return normalizedUrl.includes("/members/");
  }

  if (asksForSigs(question)) return false;

  return (
    normalizedUrl.includes("mensa.de") &&
    tokenize(question).some((token) => normalizedUrl.includes(token) || normalizedQuestion.includes(token))
  );
}

function labelForUrl(url, title) {
  const normalizedUrl = normalize(url);
  if (normalizedUrl.includes("/about/veranstaltungen/")) return "Veranstaltungen";
  if (normalizedUrl.includes("/about/membership/iq-test-bei-mensa/")) return "IQ-Test bei Mensa";
  if (normalizedUrl.includes("/about/membership/online-iq-test/")) return "Online-IQ-Test";
  if (normalizedUrl.includes("/about/membership/psychologensuche/")) return "Psychologensuche";
  if (normalizedUrl.includes("/kiju/")) return "Kids & Juniors";
  if (normalizedUrl.includes("/young-adults/")) return "Mensa Youth";
  if (normalizedUrl.includes("/members/")) return "Mitgliederbereich";
  if (normalizedUrl.includes("/contact-us/")) return "Kontakt";
  if (normalizedUrl.includes("/about/regional/")) return title || "Regionalseite";
  if (normalizedUrl.includes("/about/membership/")) return "Mitgliedschaft";
  return title || "Website";
}

function stripUnapprovedUrls(answer) {
  const approvedPrefixes = [
    "https://www.mensa.de/about/membership/",
    "https://www.mensa.de/about/veranstaltungen/",
    "https://www.mensa.de/about/regional/",
    "https://www.mensa.de/kiju/",
    "https://www.mensa.de/young-adults/",
    "https://www.mensa.de/members/",
    "https://www.mensa.de/contact-us/",
  ].map((url) => normalize(url));

  return String(answer || "")
    .replace(/https?:\/\/[^\s)]+/gi, (url) => {
      const cleanUrl = url.replace(/[.,;]+$/, "");
      const normalizedUrl = normalize(cleanUrl);
      return approvedPrefixes.some((prefix) => normalizedUrl.startsWith(prefix)) ? cleanUrl : "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function askOllama(question, matches) {
  const prompt = buildGroundedPrompt(question, matches);

  try {
    const response = await fetch(`${env.ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.ollamaModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.2,
          num_ctx: 4096,
        },
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) return "";

    const data = await response.json();
    return sanitizeText(data.response || "");
  } catch {
    return "";
  }
}

async function checkOllamaAvailable() {
  try {
    const response = await fetch(`${env.ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(800),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function buildExtractiveAnswer(question, matches) {
  const leadSentences = keySentences(matches[0].text, question, 2);
  const lead = leadSentences.length
    ? leadSentences.join(" ")
    : "In der lokalen Wissensbasis gibt es dazu passende Hinweise.";
  const caveat =
    "Wenn du eine verbindliche Auskunft brauchst, wende dich bitte an die Mitgliederbetreuung oder eine lokal zuständige Person.";

  if (/\b(?:was|wer)\s+(?:ist|sind|bedeutet|bedeuten)\b/i.test(question)) {
    return [lead, "", caveat].filter(Boolean).join("\n");
  }

  const used = new Set(leadSentences);
  const bullets = matches
    .slice(1)
    .flatMap((match) => keySentences(match.text, question, 2))
    .filter((sentence) => !used.has(sentence))
    .slice(0, 4)
    .map((sentence) => `- ${sentence}`);

  return [lead, "", ...dedupe(bullets), "", caveat].filter(Boolean).join("\n");
}

function keySentences(text, question, limit) {
  const querySet = new Set(tokenize(question));
  const sentences = text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 35 && sentence.length < 320)
    .filter(isUserFacingSentence);

  const scored = sentences
    .map((sentence) => {
      const tokens = tokenize(sentence);
      const score = tokens.filter((token) => querySet.has(token)).length;
      return { sentence, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.sentence);

  if (scored.length >= limit) return scored;

  const fallback = sentences.filter((sentence) => !scored.includes(sentence));
  return [...scored, ...fallback].slice(0, limit);
}

function isUserFacingSentence(sentence) {
  const normalizedSentence = normalize(sentence);
  const internalTerms = [
    "der bot",
    "onboarding-bot",
    "chatbot",
    "wissensbasis",
    "produktiver betrieb",
    "vor einem echten einsatz",
    "freigegeben",
    "hinterlegt",
  ];

  return (
    !normalizedSentence.endsWith("bzw.") &&
    !normalizedSentence.startsWith("vertrauensstruktur") &&
    !internalTerms.some((term) => normalizedSentence.includes(normalize(term)))
  );
}

function sourcePayload(matches) {
  return matches.map((match) => ({
    id: match.id,
    title: match.title,
    file: match.file,
    excerpt: match.text.slice(0, 420),
    score: match.score,
  }));
}

function confidenceFromMatches(matches) {
  const score = matches.reduce((sum, match) => sum + match.score, 0);
  if (score >= 12) return "high";
  if (score >= 5) return "medium";
  return "low";
}

function tokenize(value) {
  return normalize(value)
    .split(/[^a-z0-9äöüß]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 || preservedShortTokens.has(token))
    .filter((token) => !stopWords.has(token));
}

function expandQueryTokens(tokens) {
  const expanded = new Set(tokens);

  for (const token of tokens) {
    const normalizedToken = normalize(token);
    const additions = queryExpansions.get(normalizedToken) || [];
    additions.forEach((addition) => expanded.add(normalize(addition)));

    if (normalizedToken.endsWith("schaft")) {
      expanded.add(normalizedToken.replace(/schaft$/, ""));
    }

    if (normalizedToken.endsWith("en")) {
      expanded.add(normalizedToken.slice(0, -2));
    }

    if (normalizedToken.endsWith("er")) {
      expanded.add(normalizedToken.slice(0, -2));
    }
  }

  return [...expanded].filter((token) => token.length > 2 && !stopWords.has(token));
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

function restoreGermanUmlauts(value) {
  const protectedPattern = /(https?:\/\/[^\s]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
  return String(value || "")
    .split(protectedPattern)
    .map((segment) => {
      if (!segment) return segment;
      if (protectedPattern.test(segment)) {
        protectedPattern.lastIndex = 0;
        return segment;
      }
      protectedPattern.lastIndex = 0;
      return segment
        .replace(/\bUeber/g, "Über")
        .replace(/\bueber/g, "über")
        .replace(/\bFuer/g, "Für")
        .replace(/\bfuer/g, "für")
        .replace(/\bKuerz/g, "Kürz")
        .replace(/\bkuerz/g, "kürz")
        .replace(/\bEinfuehr/g, "Einführ")
        .replace(/\beinfuehr/g, "einführ")
        .replace(/\bZurueck/g, "Zurück")
        .replace(/\bzurueck/g, "zurück")
        .replace(/\bUngefaehr/g, "Ungefähr")
        .replace(/\bungefaehr/g, "ungefähr")
        .replace(/\bGaeng/g, "Gäng")
        .replace(/\bgaeng/g, "gäng")
        .replace(/\bErklaer/g, "Erklär")
        .replace(/\berklaer/g, "erklär")
        .replace(/\bZustaend/g, "Zuständ")
        .replace(/\bzustaend/g, "zuständ")
        .replace(/\bKoenn/g, "Könn")
        .replace(/\bkoenn/g, "könn")
        .replace(/\bMoeg/g, "Mög")
        .replace(/\bmoeg/g, "mög")
        .replace(/\bNaech/g, "Näch")
        .replace(/\bnaech/g, "näch")
        .replace(/\bTaeg/g, "Täg")
        .replace(/\btaeg/g, "täg")
        .replace(/\bGaest/g, "Gäst")
        .replace(/\bgaest/g, "gäst")
        .replace(/\bGuenst/g, "Günst")
        .replace(/\bguenst/g, "günst")
        .replace(/Ae/g, "Ä")
        .replace(/Oe/g, "Ö")
        .replace(/ae/g, "ä")
        .replace(/oe/g, "ö");
    })
    .join("");
}

function canonicalizeLocSecName(value) {
  const raw = String(value || "").trim().replace(/\s+/g, " ");
  const normalizedValue = normalize(raw);

  if (normalizedValue === "berlin& brandenburg" || normalizedValue === "berlin & brandenburg") {
    return "Berlin & Brandenburg";
  }

  if (normalizedValue === "goettingen, kassel" || normalizedValue === "goettingen-kassel") {
    return "Göttingen-Kassel";
  }

  return raw;
}

function sanitizeEmail(value) {
  return String(value || "")
    .replace(/^mailto:/i, "")
    .replace(/\?.*$/, "")
    .trim();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function sanitizeContactLabel(label, section = "") {
  return String(label || "")
    .replace(/\s+/g, " ")
    .replace(/\s+[–—-]\s*[^–—-]+$/, "")
    .replace(/\s*\(mailto:.*$/, "")
    .replace(/^E-?Mail:\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim() || String(section || "").trim();
}

function formatContactLines(entries) {
  return entries.map((entry) => `- ${entry.label}: ${entry.email}`);
}

function dedupe(items) {
  return [...new Set(items)];
}

function sanitizeText(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .trim();
}

async function readJson(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) {
      throw new Error("Request too large");
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function appendJsonl(fileName, value) {
  await appendFile(path.join(runtimeDir, fileName), `${JSON.stringify(value)}\n`, "utf8");
}

async function sendFeedbackEmail(feedback) {
  if (!env.resendApiKey || !env.feedbackToEmail) {
    return sendFeedbackViaProxy(feedback);
  }

  const subject = `Atlas Feedback${feedback.name ? ` von ${feedback.name}` : ""}`;
  const replyTo = isValidEmail(feedback.email) ? feedback.email : undefined;
  const text = [
    `Typ: ${feedback.type || "Feedback"}`,
    `Name: ${feedback.name || "nicht angegeben"}`,
    `E-Mail: ${feedback.email || "nicht angegeben"}`,
    `Gesendet: ${feedback.ts || new Date().toISOString()}`,
    feedback.question ? `Frage: ${feedback.question}` : "",
    feedback.answerId ? `Answer ID: ${feedback.answerId}` : "",
    "",
    feedback.note,
  ]
    .filter((line) => line !== "")
    .join("\n");

  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "atlas-feedback/1.0",
      },
      body: JSON.stringify({
        from: env.feedbackFromEmail,
        to: [env.feedbackToEmail],
        reply_to: replyTo,
        subject,
        text,
      }),
    });
  } catch (error) {
    console.warn("Feedback email request failed", error instanceof Error ? error.message : String(error));
    return { ok: false, status: 502, error: "Feedback konnte gerade nicht gesendet werden." };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.warn("Feedback email failed", response.status, body.slice(0, 500));
    return { ok: false, status: response.status >= 500 ? 502 : 500, error: "Feedback konnte gerade nicht gesendet werden." };
  }

  return { ok: true };
}

async function sendFeedbackViaProxy(feedback) {
  if (!env.feedbackProxyUrl) {
    return {
      ok: false,
      status: 503,
      error: "Das Feedbackformular ist noch nicht für E-Mail-Versand konfiguriert.",
    };
  }

  const message = [
    "Feedback aus Atlas",
    "",
    `Name: ${feedback.name || "nicht angegeben"}`,
    `E-Mail: ${feedback.email || "nicht angegeben"}`,
    `Gesendet: ${feedback.ts || new Date().toISOString()}`,
    feedback.question ? `Frage: ${feedback.question}` : "",
    feedback.answerId ? `Answer ID: ${feedback.answerId}` : "",
    "",
    feedback.note,
  ]
    .filter((line) => line !== "")
    .join("\n");

  let response;
  try {
    response = await fetch(env.feedbackProxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "atlas-feedback/1.0",
      },
      body: JSON.stringify({
        name: feedback.name || "Atlas Feedback",
        email: isValidEmail(feedback.email) ? feedback.email : "atlas-feedback@example.invalid",
        message,
      }),
    });
  } catch (error) {
    console.warn("Feedback proxy request failed", error instanceof Error ? error.message : String(error));
    return { ok: false, status: 502, error: "Feedback konnte gerade nicht gesendet werden." };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.warn("Feedback proxy failed", response.status, body.slice(0, 500));
    return { ok: false, status: response.status >= 500 ? 502 : 500, error: "Feedback konnte gerade nicht gesendet werden." };
  }

  return { ok: true };
}

async function logUsage({ answerId, provider, model, status, usage, finalText, sourceCount }) {
  const outputTokensWithAppendedLinks = finalText ? estimateTokenCount(finalText) : usage?.outputTokens || 0;
  const estimatedCostUsd = usage?.estimatedCostUsd ?? null;

  const entry = {
    ts: new Date().toISOString(),
    answerId,
    provider,
    model,
    status,
    sourceCount,
    inputTokens: usage?.inputTokens || 0,
    outputTokens: usage?.outputTokens || 0,
    outputTokensWithAppendedLinks,
    totalTokens: usage?.totalTokens || 0,
    estimatedCostUsd,
  };

  await appendJsonl("usage.jsonl", entry);
  console.log(
    `Usage ${provider}/${model} ${status}: input=${entry.inputTokens} output=${entry.outputTokens} estimated=$${entry.estimatedCostUsd ?? "unknown"}`
  );
}

async function serveStatic(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendText(res, 405, "Method not allowed");
  }

  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    return sendText(res, 403, "Forbidden");
  }

  try {
    const content = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes.get(ext) || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    if (req.method === "HEAD") return res.end();
    return res.end(content);
  } catch {
    return sendText(res, 404, "Not found");
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(text);
}
