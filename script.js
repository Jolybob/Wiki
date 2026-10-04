const SOURCE = {
  project: "pathfinder-fr%2Ffoundryvtt-pathfinder2-fr",
  ref: "master",
  api: "https://gitlab.com/api/v4",
  raw: "https://gitlab.com/pathfinder-fr/foundryvtt-pathfinder2-fr/-/raw/master"
};

const CATEGORIES = [
  ["ancestries", "Ascendances"], ["heritages", "Héritages"], ["backgrounds", "Historiques"],
  ["classes", "Classes"], ["class-features", "Capacités de classe"], ["feats", "Dons"],
  ["spells", "Sorts"], ["equipment", "Équipement"], ["deities", "Divinités"],
  ["actions", "Actions"], ["conditions", "États"], ["pathfinder-bestiary", "Bestiaire"],
  ["pathfinder-bestiary-2", "Bestiaire 2"], ["pathfinder-bestiary-3", "Bestiaire 3"],
  ["pathfinder-monster-core", "Monstres de base"], ["hazards", "Dangers"], ["vehicles", "Véhicules"]
].map(([path, label]) => ({ path: "data/" + path, label }));
const state = { root: [], currentPath: "", currentItems: [], cache: new Map(), page: 1, hasMore: false };
const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value || "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
}[char]));

const menuToggle = $(".menu-toggle");
const nav = $(".site-nav");
const searchInput = $("#search-input");
const content = $("#content");
const categories = $("#categories");
const breadcrumbs = $("#breadcrumbs");
const resultCount = $("#result-count");
const connectionStatus = $("#connection-status");
const sourceVersion = $("#source-version");
const reader = $("#reader");
const readerTitle = $("#reader-title");
const readerMeta = $("#reader-meta");
const readerBody = $("#reader-body");
const readerSource = $("#reader-source");

menuToggle?.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
});

document.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput?.focus();
  }
  if (event.key === "Escape" && !reader.hidden) closeReader();
});

document.querySelectorAll("[data-close-reader]").forEach(el => el.addEventListener("click", closeReader));

function setStatus(text, type) {
  connectionStatus.textContent = text;
  connectionStatus.className = "status status-" + type;
}

async function gitlabJson(path, params = {}) {
  const url = new URL(SOURCE.api + "/" + path);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error("GitLab API " + response.status);
    return response.json();
  } catch (error) {
    if (error.name === "AbortError") throw new Error("GitLab API : délai dépassé (15 s)");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function listTree(path = "", page = 1) {
  const key = "tree:" + path + ":" + page;
  if (state.cache.has(key)) return state.cache.get(key);
  const batch = await gitlabJson("projects/" + SOURCE.project + "/repository/tree", {
    ref: SOURCE.ref, path, per_page: 100, page
  });
  state.cache.set(key, batch);
  return batch;
}

function displayName(item) {
  return item.name
    .replace(/\.(htm|html|md)$/i, "")
    .replace(/^[a-z]+-\d+-/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function renderCategories() {
  categories.innerHTML = CATEGORIES.map(dir =>
    '<button class="category-button" type="button" data-path="' + escapeHtml(dir.path) + '">' +
    escapeHtml(dir.label) + '</button>'
  ).join("");
  categories.querySelectorAll("[data-path]").forEach(button => {
    button.addEventListener("click", () => openDirectory(button.dataset.path));
  });
}

function renderBreadcrumbs(path) {
  const parts = path ? path.split("/") : [];
  breadcrumbs.innerHTML = '<a href="#browse" data-root>Source</a>' + parts.map((part, index) =>
    ' / <a href="#browse" data-breadcrumb="' + escapeHtml(parts.slice(0, index + 1).join("/")) + '">' +
    escapeHtml(displayName({ name: part })) + '</a>'
  ).join("");
  breadcrumbs.querySelector("[data-root]")?.addEventListener("click", () => openDirectory(""));
  breadcrumbs.querySelectorAll("[data-breadcrumb]").forEach(el =>
    el.addEventListener("click", () => openDirectory(el.dataset.breadcrumb))
  );
}

function renderItems(items) {
  const visible = items.filter(item => item.type === "tree" || /\.(htm|html|md)$/i.test(item.name));
  state.currentItems = visible;
  resultCount.textContent = visible.length + " entrée" + (visible.length > 1 ? "s" : "");
  if (!visible.length) {
    content.innerHTML = '<div class="empty-panel"><span class="empty-mark">✧</span><h2>Dossier vide</h2><p>Aucune entrée lisible dans ce dossier.</p></div>';
    return;
  }
  content.innerHTML = visible.map((item, index) =>
    '<button class="data-card" type="button" data-index="' + index + '">' +
    '<span class="name">' + escapeHtml(displayName(item)) + '</span>' +
    '<span class="path">' + escapeHtml(item.path) + '</span>' +
    '<span class="kind">' + (item.type === "tree" ? "Dossier" : "Fiche") + '</span></button>'
  ).join("");
  content.querySelectorAll("[data-index]").forEach(card => {
    const item = visible[Number(card.dataset.index)];
    card.addEventListener("click", () => item.type === "tree" ? openDirectory(item.path) : openFile(item));
  });
}

async function openDirectory(path) {
  content.innerHTML = '<div class="empty-panel"><span class="empty-mark">✦</span><h2>Chargement…</h2><p>Lecture de <strong>' +
    escapeHtml(path || "la source") + '</strong>.</p></div>';
  renderBreadcrumbs(path);
  try {
    const items = await listTree(path, 1);
    state.currentPath = path;
    state.page = 1;
    state.hasMore = items.length === 100;
    renderItems(items);
    document.querySelectorAll(".category-button").forEach(button =>
      button.classList.toggle("active", button.dataset.path === path)
    );
  } catch (error) {
    showError(error);
  }
}

function renderLoadMore() {
  document.querySelector("#load-more")?.remove();
  if (!state.hasMore) return;
  const button = document.createElement("button");
  button.id = "load-more";
  button.className = "load-more";
  button.type = "button";
  button.textContent = "Charger les 100 entrées suivantes";
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Chargement…";
    try {
      const next = await listTree(state.currentPath, state.page + 1);
      state.page += 1;
      state.hasMore = next.length === 100;
      state.currentItems = state.currentItems.concat(next);
      renderItems(state.currentItems);
      renderLoadMore();
    } catch (error) {
      button.disabled = false;
      button.textContent = "Réessayer";
      showError(error);
    }
  });
  content.appendChild(button);
}

function parseEntry(raw) {
  const lines = raw.split(/\r?\n/);
  const get = label => {
    const line = lines.find(item => item.startsWith(label + ":"));
    return line ? line.slice(label.length + 1).trim() : "";
  };
  const start = lines.findIndex(line => line.trim() === "-- Desc (fr) --");
  const end = lines.findIndex((line, index) => index > start && line.trim().startsWith("-- End desc"));
  let description = start >= 0 ? lines.slice(start + 1, end > start ? end : undefined).join("\n").trim() : "";
  if (!description) description = raw;
  return { name: get("Nom") || get("Name") || "Entrée PF2e", description };
}

function sanitizeHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowed = new Set(["P","BR","STRONG","EM","B","I","UL","OL","LI","A","H1","H2","H3","H4","TABLE","THEAD","TBODY","TR","TH","TD","BLOCKQUOTE"]);
  template.content.querySelectorAll("*").forEach(node => {
    if (!allowed.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }
    [...node.attributes].forEach(attr => {
      if (node.tagName === "A" && attr.name === "href" && /^https?:/i.test(attr.value)) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noreferrer");
      } else {
        node.removeAttribute(attr.name);
      }
    });
  });
  return template.innerHTML;
}

async function openFile(item) {
  reader.hidden = false;
  document.body.style.overflow = "hidden";
  readerTitle.textContent = displayName(item);
  readerMeta.textContent = item.path;
  readerBody.innerHTML = "<p>Chargement…</p>";
  readerSource.href = SOURCE.raw + "/" + item.path.split("/").map(encodeURIComponent).join("/");
  try {
    const response = await fetch(readerSource.href, { cache: "no-store" });
    if (!response.ok) throw new Error("Fichier " + response.status);
    const raw = await response.text();
    const entry = parseEntry(raw);
    readerTitle.textContent = entry.name;
    readerBody.innerHTML = sanitizeHtml(entry.description.replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1"));
  } catch (error) {
    readerBody.innerHTML = '<p class="status status-error">Impossible de charger cette fiche : ' +
      escapeHtml(error.message) + '</p>';
  }
}

function closeReader() {
  reader.hidden = true;
  document.body.style.overflow = "";
}

function showError(error) {
  setStatus("Source inaccessible", "error");
  content.innerHTML = '<div class="empty-panel"><span class="empty-mark">!</span><h2>Impossible de lire GitLab</h2><p>' +
    escapeHtml(error.message) + '. Vérifiez votre connexion ou les permissions/CORS de la source.</p></div>';
}

async function searchSource(query) {
  const term = query.trim().toLowerCase();
  if (!term) {
    renderItems(state.currentItems);
    return;
  }
  const matches = state.currentItems.filter(item =>
    item.name.toLowerCase().includes(term) || item.path.toLowerCase().includes(term)
  );
  resultCount.textContent = matches.length + " résultat" + (matches.length > 1 ? "s" : "");
  renderItems(matches);
}

searchInput?.addEventListener("input", () => searchSource(searchInput.value));

async function init() {
  setStatus("Source prête", "ok");
  sourceVersion.textContent = "GitLab · " + SOURCE.ref;
  state.root = CATEGORIES.map(item => ({ type: "tree", path: item.path, name: item.path.split("/").pop() }));
  renderCategories();
  renderBreadcrumbs("");
  content.innerHTML = '<div class="empty-panel"><span class="empty-mark">✧</span><h2>Choisissez une catégorie</h2><p>Les données sont lues directement depuis GitLab, sans copie dans GitHub.</p></div>';
  resultCount.textContent = CATEGORIES.length + " catégories";
}
init();
