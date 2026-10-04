const SOURCE = {
  project: "pathfinder-fr%2Ffoundryvtt-pathfinder2-fr",
  ref: "master",
  api: "https://gitlab.com/api/v4",
  raw: "https://gitlab.com/pathfinder-fr/foundryvtt-pathfinder2-fr/-/raw/master"
};

const state = { root: [], currentPath: "", currentItems: [], cache: new Map() };
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
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error("GitLab API " + response.status);
  return response.json();
}

async function listTree(path = "") {
  const key = "tree:" + path;
  if (state.cache.has(key)) return state.cache.get(key);
  const items = [];
  let page = 1;
  while (true) {
    const batch = await gitlabJson("projects/" + SOURCE.project + "/repository/tree", {
      ref: SOURCE.ref, path, per_page: 100, page
    });
    items.push(...batch);
    if (batch.length < 100 || page >= 20) break;
    page += 1;
  }
  state.cache.set(key, items);
  return items;
}

function displayName(item) {
  return item.name
    .replace(/\.(htm|html|md)$/i, "")
    .replace(/^[a-z]+-\d+-/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function renderCategories() {
  const dirs = state.root.filter(item => item.type === "tree");
  categories.innerHTML = dirs.map(dir =>
    '<button class="category-button" type="button" data-path="' + escapeHtml(dir.path) + '">' +
    escapeHtml(displayName(dir)) + '</button>'
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
    const items = await listTree(path);
    state.currentPath = path;
    renderItems(items);
    document.querySelectorAll(".category-button").forEach(button =>
      button.classList.toggle("active", button.dataset.path === path)
    );
  } catch (error) {
    showError(error);
  }
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
  try {
    setStatus("Connexion à GitLab…", "loading");
    state.root = await listTree("");
    renderCategories();
    sourceVersion.textContent = "branche " + SOURCE.ref;
    setStatus("Source connectée", "ok");
    await openDirectory("data");
  } catch (error) {
    showError(error);
  }
}

init();
