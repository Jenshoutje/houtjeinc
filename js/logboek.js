import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* === Config === */
const SUPABASE_URL = "https://ytsaxqpscrxnnqevenoh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0c2F4cXBzY3J4bm5xZXZlbm9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4NTU2NjgsImV4cCI6MjA3MTQzMTY2OH0.427U_pG4I-Vx7xUcn93E_gvZtIPiOQaqN0Y9R89kpQA";
const STORAGE_BUCKET = "logboek";
const BUCKET_IS_PUBLIC = false; // true = publicUrl; false = signedUrl
const ACTIVE_EMAIL = "jenshouthuijsen@hotmail.com"; // voor policies en UI

/* === Supabase client === */
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

/* === DOM refs === */
const searchEl = document.getElementById("search");
const sortEl = document.getElementById("sort");
const filterTypeEl = document.getElementById("filterType");
const filterTagEl = document.getElementById("filterTag");
const filterProjectEl = document.getElementById("filterProject");

const statCountEl = document.getElementById("statCount");
const statFilesEl = document.getElementById("statFiles");
const statSinceEl = document.getElementById("statSince");

const groupsEl = document.getElementById("groups");
const emptyStateEl = document.getElementById("emptyState");

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const newEntryBtn = document.getElementById("newEntryBtn");

const entryDialog = document.getElementById("entryDialog");
const entryForm = document.getElementById("entryForm");
const entryTypeEl = document.getElementById("entryType");
const titleEl = document.getElementById("title");
const fileInputEl = document.getElementById("fileInput");
const linkUrlEl = document.getElementById("linkUrl");
const noteEl = document.getElementById("note");
const tagsEl = document.getElementById("tags");
const projectEl = document.getElementById("project");
const visibilityEl = document.getElementById("visibility");
const closeDialogBtn = document.getElementById("closeDialog");

/* === State === */
let session = null;
let allEntries = [];
let allProjects = [];
let allTags = new Set();

/* === Helpers === */
const fmtDate = (d) => new Date(d).toLocaleDateString("nl-NL", { year: "numeric", month: "short", day: "2-digit" });
const groupKey = (d) => {
  const dt = new Date(d);
  const now = new Date();
  const diff = (now - dt) / 86400000;
  if (diff < 1) return "Vandaag";
  if (diff < 7) return "Deze week";
  if (now.getFullYear() === dt.getFullYear()) return dt.toLocaleDateString("nl-NL", { month: "long" });
  return dt.getFullYear().toString();
};
const splitTags = (s) => (s || "").split(",").map(t => t.trim()).filter(Boolean);

/* === Auth/UI === */
async function init() {
  const { data: { session: s } } = await sb.auth.getSession();
  session = s || null;
  toggleAuthUI();

  await loadProjects();
  await loadEntries();
  wireEvents();
}

function toggleAuthUI() {
  const loggedIn = !!session;
  loginBtn.hidden = loggedIn;
  logoutBtn.hidden = !loggedIn;
  newEntryBtn.hidden = !loggedIn;
}

loginBtn.addEventListener("click", async () => {
  const email = prompt("E-mailadres voor login (magic link):", ACTIVE_EMAIL);
  if (!email) return;
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href.split("#")[0] }
  });
  if (error) alert(error.message);
  else alert("Controleer je e‑mail voor de loginlink.");
});

logoutBtn.addEventListener("click", async () => {
  await sb.auth.signOut();
  session = null;
  toggleAuthUI();
});

newEntryBtn.addEventListener("click", () => {
  entryForm.reset();
  entryTypeEl.value = "file";
  setTypeVisibility("file");
  entryDialog.showModal();
});

closeDialogBtn.addEventListener("click", () => entryDialog.close());

entryTypeEl.addEventListener("change", () => setTypeVisibility(entryTypeEl.value));
function setTypeVisibility(type) {
  for (const el of entryForm.querySelectorAll("[data-type]")) {
    el.hidden = el.getAttribute("data-type") !== type;
  }
}

/* === Data load === */
async function loadProjects() {
  // Optioneel: projecten tabel
  const { data, error } = await sb.from("projects").select("id,title,created_at,slug").order("title", { ascending: true });
  if (!error && data) {
    allProjects = data;
    // dropdowns
    for (const p of data) {
      const o = new Option(p.title, p.id);
      projectEl.add(o.cloneNode(true));
      filterProjectEl.add(new Option(p.title, p.id));
    }
    // stat since
    const first = data.reduce((min, p) => (min && min < p.created_at ? min : p.created_at), null);
    if (first) statSinceEl.textContent = new Date(first).getFullYear();
    else statSinceEl.textContent = new Date().getFullYear();
  } else {
    statSinceEl.textContent = new Date().getFullYear();
  }
}

async function loadEntries() {
  const { data, error } = await sb
    .from("log_entries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error(error);
    return;
  }
  allEntries = data || [];
  // tags verzamelen
  allTags = new Set();
  for (const e of allEntries) {
    (e.tags || []).forEach(t => allTags.add(t));
  }
  // tag filter vullen
  filterTagEl.innerHTML = "";
  filterTagEl.add(new Option("Alle tags", ""));
  [...allTags].sort().forEach(t => filterTagEl.add(new Option(t, t)));

  render();
}

/* === Entry opslaan === */
entryForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!session) {
    alert("Log eerst in.");
    return;
  }

  const type = entryTypeEl.value; // file | note | link
  const title = titleEl.value.trim();
  const note = noteEl.value.trim();
  const tags = splitTags(tagsEl.value);
  const projectId = projectEl.value || null;
  const visibility = visibilityEl.checked ? "public" : "private";

  let file_url = null;
  let mime = null;
  let size = null;

  try {
    if (type === "file") {
      const file = fileInputEl.files?.[0];
      if (!file) {
        alert("Kies een bestand.");
        return;
      }
      const path = `${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await sb.storage.from(STORAGE_BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false
      });
      if (upErr) throw upErr;

      // URL bepalen
      if (BUCKET_IS_PUBLIC) {
        const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        file_url = data.publicUrl;
      } else {
        const { data } = await sb.storage.from(STORAGE_BUCKET).createSignedUrl(path, 60 * 60 * 24);
        file_url = data?.signedUrl ?? null;
      }
      mime = file.type || null;
      size = file.size || null;
    }

    if (type === "link") {
      const url = (linkUrlEl.value || "").trim();
      if (!url) {
        alert("Voer een URL in.");
        return;
      }
      file_url = url;
      mime = "text/url";
    }

    // Insert record
    const payload = {
      title: title || (type === "file" ? fileInputEl.files[0]?.name : type === "link" ? "Link" : "Notitie"),
      note,
      tags,
      project_id: projectId,
      file_url,
      mime,
      size,
      type,
      visibility
    };

    const { error: insErr } = await sb.from("log_entries").insert(payload);
    if (insErr) throw insErr;

    entryDialog.close();
    await loadEntries();
  } catch (e) {
    console.error(e);
    alert(e.message || "Er ging iets mis bij opslaan.");
  }
});

/* === Lijst/filters === */
function wireEvents() {
  for (const el of [searchEl, sortEl, filterTypeEl, filterTagEl, filterProjectEl]) {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  }
}

function applyFilters(entries) {
  const q = (searchEl.value || "").toLowerCase();
  const t = filterTypeEl.value;
  const tag = filterTagEl.value;
  const proj = filterProjectEl.value;

  let out = entries.slice();

  if (t !== "all") out = out.filter(e => (e.type || inferType(e)).toLowerCase() === t);
  if (tag) out = out.filter(e => (e.tags || []).includes(tag));
  if (proj) out = out.filter(e => e.project_id === proj);

  if (q) {
    out = out.filter(e => {
      const hay = [
        e.title || "",
        e.note || "",
        (e.tags || []).join(" "),
        e.file_url || ""
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  const sort = sortEl.value;
  if (sort === "new") out.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  if (sort === "old") out.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
  if (sort === "az") out.sort((a,b) => (a.title||"").localeCompare(b.title||""));

  return out;
}

function inferType(e) {
  if (e.type) return e.type;
  if (e.file_url) return e.mime === "text/url" ? "link" : "file";
  return "note";
}

async function ensureUrl(e) {
  // Voor private buckets: maak een verse signed URL als de oude verlopen kan zijn
  if (BUCKET_IS_PUBLIC || !e.file_url || e.type === "link") return e.file_url;
  if (!e.storage_path) return e.file_url; // als je storage pad bewaart, kun je vers tekenen
  const { data } = await sb.storage.from(STORAGE_BUCKET).createSignedUrl(e.storage_path, 60 * 60); // 1 uur
  return data?.signedUrl ?? e.file_url;
}

function renderStats(list) {
  statCountEl.textContent = list.length;
  const fileCount = list.filter(e => (e.type || inferType(e)) === "file").length;
  statFilesEl.textContent = fileCount;
}

function renderGroups(list) {
  groupsEl.innerHTML = "";
  if (!list.length) {
    emptyStateEl.hidden = false;
    return;
  }
  emptyStateEl.hidden = true;

  // Groeperen per label
  const buckets = new Map();
  for (const e of list) {
    const k = groupKey(e.created_at);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(e);
  }

  for (const [label, items] of buckets) {
    const sec = document.createElement("section");
    sec.className = "group";
    sec.innerHTML = `<h3 class="group__title">${label}</h3><div class="grid cards"></div>`;
    const grid = sec.querySelector(".grid");

    items.forEach(e => {
      const card = document.createElement("article");
      card.className = "card";

      const type = (e.type || inferType(e)).toUpperCase();
      const project = allProjects.find(p => p.id === e.project_id)?.title || "—";
      const tags = (e.tags || []).map(t => `<span class="badge">${t}</span>`).join(" ");

      const actions = [];
      if (e.file_url) actions.push(`<a class="btn btn--sm" href="${e.file_url}" target="_blank" rel="noopener">Openen</a>`);
      actions.push(`<button class="btn btn--sm btn--ghost" data-copy="${e.file_url || ""}" ${e.file_url ? "" : "disabled"}>Kopieer link</button>`);

      card.innerHTML = `
        <header class="card__header">
          <span class="chip">${type}</span>
          <time class="meta">${fmtDate(e.created_at)}</time>
        </header>
        <h4 class="card__title">${escapeHtml(e.title || "(zonder titel)")}</h4>
        ${e.note ? `<p class="card__text">${escapeHtml(e.note).slice(0, 240)}${e.note.length > 240 ? "…" : ""}</p>` : ""}
        <div class="meta-row">
          <div class="meta"><strong>Project:</strong> ${escapeHtml(project)}</div>
          <div class="tags">${tags}</div>
        </div>
        <footer class="card__footer">${actions.join(" ")}</footer>
      `;
      grid.appendChild(card);

      const copyBtn = card.querySelector("[data-copy]");
      if (copyBtn && e.file_url) {
        copyBtn.addEventListener("click", async () => {
          let u = e.file_url;
          // Indien private en storage_path beschikbaar: ververst URL aanvragen (optioneel).
          try {
            await navigator.clipboard.writeText(u);
          } catch {
            // fallback
            const ta = document.createElement("textarea");
            ta.value = u;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
          }
          copyBtn.textContent = "Gekopieerd";
          setTimeout(() => (copyBtn.textContent = "Kopieer link"), 1500);
        });
      }
    });

    groupsEl.appendChild(sec);
  }
}

function render() {
  const filtered = applyFilters(allEntries);
  renderStats(filtered);
  renderGroups(filtered);
}

/* === Events zoek/sort/filter === */
searchEl?.addEventListener("input", render);
sortEl?.addEventListener("change", render);
filterTypeEl?.addEventListener("change", render);
filterTagEl?.addEventListener("change", render);
filterProjectEl?.addEventListener("change", render);

/* === Utilities === */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}

/* === Init === */
init();
