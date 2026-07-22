/* ===================== REXROCK - gestion documents (localStorage + export/import JSON) ===================== */

const DOC_TYPES = {
  facture:       { title: "FACTURE",           label: "Facture",            prefix: "FA", numLabel: "Facture N°" },
  devis:         { title: "DEVIS",             label: "Devis",              prefix: "DV", numLabel: "Devis N°" },
  bon_commande:  { title: "BON DE COMMANDE",   label: "Bon de Commande",    prefix: "BC", numLabel: "BC N°" },
  bon_livraison: { title: "BON DE LIVRAISON",  label: "Bon de Livraison",   prefix: "BL", numLabel: "BL N°" },
};

const STORAGE_KEY = "rexrock_data_v2";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayDDMMYYYY() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function formatDateInput(value) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += "/" + digits.slice(2, 4);
  if (digits.length > 4) out += "/" + digits.slice(4, 8);
  return out;
}

function nextNumber(type) {
  const list = state.docs[type] || [];
  const year = new Date().getFullYear();
  let max = 0;
  list.forEach((d) => {
    const m = /(\d+)$/.exec(d.number || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `${DOC_TYPES[type].prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
}

function emptyDocData(type) {
  return {
    id: null,
    number: nextNumber(type),
    date: todayDDMMYYYY(),
    client: { name: "", address: "", ice: "" },
    items: [{ ref: "", designation: "", spec: "", qte: 1, pu: 0 }],
    remise: { show: false, type: "percent", value: 0 },
    wordsBase: "ttc",
    showRef: true,
  };
}

/* ---------------- persistence ---------------- */

function loadData() {
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch (e) {
    raw = null;
  }
  if (!raw) raw = {};
  if (!raw.logo) raw.logo = null;
  raw.company = {
    name: "STE REXROCK",
    tagline: "Machinery and spare parts",
    footerEmail: "Contact.rexrock@gmail.com",
    footerAddress: "Adresse: 12 Rue Saria Ben Zounaim, Etage 3, Appt N°3 Palmier. CASABLANCA",
    footerCapital: "Capital social: 100 000 DHS",
    footerRC: "R.C: 693983",
    footerPatente: "Patente: 34771826",
    footerIce: "ICE: 003807256000032",
    footerCnss: "CNSS: 7105793",
    ...raw.company,
  };
  if (!raw.docs) raw.docs = {};
  Object.keys(DOC_TYPES).forEach((t) => {
    const d = raw.docs[t];
    if (Array.isArray(d)) {
      raw.docs[t] = d;
    } else if (d && typeof d === "object") {
      // migrate from old single-document-per-type format
      raw.docs[t] = [{ ...d, id: uid() }];
    } else {
      raw.docs[t] = [];
    }
  });
  return raw;
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadData();
let currentType = "facture";

/* editing draft state (used only while modal is open) */
let editing = null; // { type, id, isNew, data }
let isDirty = false;

/* ---------------- number to french words ---------------- */

const UNITS = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
const TEENS = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingt", "quatre-vingt-dix"];

function convertHundreds(n) {
  let out = "";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h > 0) {
    out += (h > 1 ? UNITS[h] + " cent" : "cent") + (h > 1 && rest === 0 ? "s" : "");
    if (rest > 0) out += " ";
  }
  if (rest > 0) {
    if (rest < 10) {
      out += UNITS[rest];
    } else if (rest < 20) {
      out += TEENS[rest - 10];
    } else {
      const t = Math.floor(rest / 10);
      const u = rest % 10;
      if (t === 7 || t === 9) {
        out += TENS[t - 1] + "-" + TEENS[u];
      } else {
        out += TENS[t];
        if (u === 1 && t !== 8) out += " et un";
        else if (u > 0) out += "-" + UNITS[u];
        else if (t === 8) out += "s";
      }
    }
  }
  return out;
}

function convertNumberToWords(n) {
  n = Math.floor(n);
  if (n === 0) return "zéro";
  const groups = [];
  let num = n;
  while (num > 0) {
    groups.push(num % 1000);
    num = Math.floor(num / 1000);
  }
  const scales = ["", "mille", "million", "milliard"];
  let parts = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;
    let words = convertHundreds(g);
    if (i === 1) {
      words = (g === 1 ? "mille" : words + " mille");
    } else if (i >= 2) {
      words += " " + scales[i] + (g > 1 ? "s" : "");
    }
    parts.push(words);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function amountToFrenchWords(amount) {
  amount = Math.round(amount * 100) / 100;
  const dirhams = Math.floor(amount);
  const centimes = Math.round((amount - dirhams) * 100);
  let out = convertNumberToWords(dirhams) + " dirham" + (dirhams > 1 ? "s" : "");
  if (centimes > 0) {
    out += " et " + convertNumberToWords(centimes) + " centime" + (centimes > 1 ? "s" : "");
  }
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/* ---------------- formatting & totals ---------------- */

function fmt(n) {
  if (isNaN(n)) n = 0;
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDH(n) {
  return fmt(n) + " DH";
}

const TVA_RATE = 0.20;

function computeTotalsFor(doc) {
  const totalHT = doc.items.reduce((s, it) => s + (Number(it.qte) || 0) * (Number(it.pu) || 0), 0);
  let remiseAmount = 0;
  if (doc.remise.show) {
    remiseAmount = doc.remise.type === "percent"
      ? totalHT * (Number(doc.remise.value) || 0) / 100
      : (Number(doc.remise.value) || 0);
    remiseAmount = Math.min(remiseAmount, totalHT);
  }
  const netHT = totalHT - remiseAmount;
  const tva = netHT * TVA_RATE;
  const ttc = netHT + tva;
  return { totalHT, remiseAmount, netHT, tva, ttc };
}

/* typing a target Total TTC rescales every item's Prix Unit. HT / Prix HT
   proportionally so the item table stays the source of truth */
function distributeTtcToItems(ttc) {
  const data = editing.data;
  const netHT = ttc / (1 + TVA_RATE);
  let desiredTotalHT = netHT;
  if (data.remise.show) {
    desiredTotalHT = data.remise.type === "percent"
      ? netHT / (1 - Math.min(Number(data.remise.value) || 0, 99) / 100)
      : netHT + (Number(data.remise.value) || 0);
  }
  const oldTotalHT = data.items.reduce((s, it) => s + (Number(it.qte) || 0) * (Number(it.pu) || 0), 0);
  if (oldTotalHT > 0) {
    const factor = desiredTotalHT / oldTotalHT;
    data.items.forEach((it) => { it.pu = Math.round((Number(it.pu) || 0) * factor * 100) / 100; });
  } else {
    const totalQte = data.items.reduce((s, it) => s + (Number(it.qte) || 0), 0);
    data.items.forEach((it) => {
      const qte = Number(it.qte) || 0;
      const pu = totalQte > 0 ? (desiredTotalHT * qte) / totalQte : desiredTotalHT / data.items.length;
      it.pu = Math.round(pu * 100) / 100;
    });
  }
}

function parseLocaleNumber(str) {
  const cleaned = String(str).replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/* ---------------- DOM refs ---------------- */

const listTitleEl = document.getElementById("listTitle");
const listBody = document.getElementById("listBody");
const listEmpty = document.getElementById("listEmpty");
const listRowTemplate = document.getElementById("listRowTemplate");

const modalOverlay = document.getElementById("modalOverlay");
const modalHeading = document.getElementById("modalHeading");

const docNumberEl = document.getElementById("docNumber");
const docNumberLabelEl = document.getElementById("docNumberLabel");
const docDateEl = document.getElementById("docDate");
const clientNameEl = document.getElementById("clientName");
const clientAddressEl = document.getElementById("clientAddress");
const clientIceEl = document.getElementById("clientIce");
const itemsBody = document.getElementById("itemsBody");
const rowTemplate = document.getElementById("rowTemplate");
const totalHTEl = document.getElementById("totalHT");
const htRow = document.getElementById("htRow");
const htLabelCell = document.getElementById("htLabelCell");
const tvaRow = document.getElementById("tvaRow");
const ttcRow = document.getElementById("ttcRow");
const totalTVAEl = document.getElementById("totalTVA");
const totalTTCEl = document.getElementById("totalTTC");
const remiseRow = document.getElementById("remiseRow");
const remiseAmountEl = document.getElementById("remiseAmount");
const remiseTypeEl = document.getElementById("remiseType");
const remiseValueEl = document.getElementById("remiseValue");
const remiseToggle = document.getElementById("remiseToggle");
const refToggle = document.getElementById("refToggle");
const itemsTable = document.getElementById("itemsTable");
const itemsTableWrap = itemsTable.parentElement;
const amountWordsEl = document.getElementById("amountWords");
const wordsBaseEl = document.getElementById("wordsBase");
const logoImg = document.getElementById("logoImg");
const logoPlaceholder = document.getElementById("logoPlaceholder");
const logoInput = document.getElementById("logoInput");
const companyNameEl = document.getElementById("companyNameEl");
const companyTaglineEl = document.getElementById("companyTaglineEl");
const footerEmailEl = document.getElementById("footerEmail");
const footerAddressEl = document.getElementById("footerAddress");
const footerCapitalEl = document.getElementById("footerCapital");
const footerRCEl = document.getElementById("footerRC");
const footerPatenteEl = document.getElementById("footerPatente");
const footerIceEl = document.getElementById("footerIce");
const footerCnssEl = document.getElementById("footerCnss");

/* ---------------- list rendering ---------------- */

function renderList() {
  listTitleEl.textContent = DOC_TYPES[currentType].label + "s";
  const list = state.docs[currentType];
  listBody.innerHTML = "";
  listEmpty.classList.toggle("hidden", list.length > 0);
  list
    .slice()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .forEach((doc) => {
      const frag = listRowTemplate.content.cloneNode(true);
      const tr = frag.querySelector("tr");
      tr.querySelector(".doc-number").textContent = doc.number;
      tr.querySelector(".doc-date").textContent = doc.date;
      tr.querySelector(".doc-client").textContent = doc.client.name || "-";
      tr.querySelector(".doc-ttc").textContent = fmtDH(computeTotalsFor(doc).ttc);
      tr.querySelector(".btn-edit").addEventListener("click", () => openEdit(currentType, doc.id));
      tr.querySelector(".btn-print").addEventListener("click", () => printDoc(currentType, doc.id));
      tr.querySelector(".btn-delete").addEventListener("click", () => deleteDoc(currentType, doc.id));
      listBody.appendChild(frag);
    });
}

function deleteDoc(type, id) {
  if (!confirm("Supprimer ce document définitivement ?")) return;
  state.docs[type] = state.docs[type].filter((d) => d.id !== id);
  saveData();
  renderList();
}

/* ---------------- dynamic A4 fit ---------------- */

const PRINT_MARGIN_MM = 10;
const A4_HEIGHT_MM = 297;
const PX_PER_MM = 96 / 25.4;
const FOOTER_GAP_MM = 6; // breathing room between the signatures and the footer
const printFooterEl = document.getElementById("printFooter");
const totalsSignatureBlock = document.getElementById("totalsSignatureBlock");

function fitPrintAreaToPage() {
  const body = document.getElementById("printBody");
  body.style.zoom = "";
  body.style.paddingBottom = "";
  totalsSignatureBlock.style.paddingBottom = "";
  /* the totals/words/signature block is normal flow now (sits directly
     under the table, no artificial gap) -- but since it renders *after*
     printBody, printBody's own padding doesn't protect it from the
     fixed-position footer. The reservation belongs on whichever element
     is the last one before the footer, so put it here instead. */
  const footerMm = printFooterEl.offsetHeight / PX_PER_MM + FOOTER_GAP_MM;
  totalsSignatureBlock.style.paddingBottom = footerMm + "mm";
}

function resetPrintAreaScale() {
  const body = document.getElementById("printBody");
  body.style.zoom = "";
  body.style.paddingBottom = "";
  totalsSignatureBlock.style.paddingBottom = "";
}

function printCurrent() {
  fitPrintAreaToPage();
  window.print();
}

window.addEventListener("afterprint", resetPrintAreaScale);

function printDoc(type, id) {
  openEdit(type, id);
  setTimeout(() => printCurrent(), 150);
}

/* ---------------- modal rendering ---------------- */

function renderLogo() {
  if (state.logo) {
    logoImg.src = state.logo;
    logoImg.classList.remove("hidden");
    logoPlaceholder.classList.add("hidden");
  } else {
    logoImg.src = "";
    logoImg.classList.add("hidden");
    logoPlaceholder.classList.remove("hidden");
  }
}

function renderCompanyInfo() {
  const c = state.company;
  companyNameEl.textContent = c.name;
  companyTaglineEl.textContent = c.tagline;
  footerEmailEl.textContent = c.footerEmail;
  footerAddressEl.textContent = c.footerAddress;
  footerCapitalEl.textContent = c.footerCapital;
  footerRCEl.textContent = c.footerRC;
  footerPatenteEl.textContent = c.footerPatente;
  footerIceEl.textContent = c.footerIce;
  footerCnssEl.textContent = c.footerCnss;
}

function wireCompanyField(el, key) {
  el.addEventListener("input", () => {
    state.company[key] = el.textContent;
    saveData();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      el.blur();
    }
  });
}
[
  [companyNameEl, "name"],
  [companyTaglineEl, "tagline"],
  [footerEmailEl, "footerEmail"],
  [footerAddressEl, "footerAddress"],
  [footerCapitalEl, "footerCapital"],
  [footerRCEl, "footerRC"],
  [footerPatenteEl, "footerPatente"],
  [footerIceEl, "footerIce"],
  [footerCnssEl, "footerCnss"],
].forEach(([el, key]) => wireCompanyField(el, key));

function autoGrow(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

function renderRow(item) {
  const frag = rowTemplate.content.cloneNode(true);
  const tr = frag.querySelector("tr");
  tr.querySelector(".ref-input").value = item.ref;
  const desEl = tr.querySelector(".designation-input");
  desEl.value = item.designation;
  const specEl = tr.querySelector(".spec-input");
  specEl.value = item.spec || "";
  tr.querySelector(".qte-input").value = item.qte;
  tr.querySelector(".pu-input").value = fmt(item.pu);
  tr.querySelector(".montant-cell").textContent = fmtDH(item.qte * item.pu);
  requestAnimationFrame(() => { autoGrow(desEl); autoGrow(specEl); });
  return tr;
}

function renderItems() {
  itemsBody.innerHTML = "";
  editing.data.items.forEach((item) => {
    itemsBody.appendChild(renderRow(item));
  });
}

function renderModalFields() {
  const data = editing.data;
  modalHeading.textContent = (editing.isNew ? "Créer - " : "Modifier - ") + DOC_TYPES[editing.type].label;
  docNumberLabelEl.textContent = DOC_TYPES[editing.type].numLabel;
  docNumberEl.value = data.number;
  docDateEl.value = data.date;
  clientNameEl.value = data.client.name;
  clientAddressEl.value = data.client.address;
  clientIceEl.value = data.client.ice;
  requestAnimationFrame(() => autoGrow(clientAddressEl));
  remiseToggle.checked = data.remise.show;
  remiseRow.classList.toggle("hidden", !data.remise.show);
  remiseTypeEl.value = data.remise.type;
  remiseValueEl.value = data.remise.value;
  wordsBaseEl.value = data.wordsBase;
  refToggle.checked = data.showRef !== false;
  itemsTable.classList.toggle("hide-ref", data.showRef === false);
}

function renderTotals() {
  const data = editing.data;
  const t = computeTotalsFor(data);
  totalHTEl.textContent = fmtDH(t.totalHT);
  remiseAmountEl.textContent = "- " + fmtDH(t.remiseAmount);
  totalTVAEl.textContent = fmtDH(t.tva);
  if (document.activeElement !== totalTTCEl) {
    totalTTCEl.value = fmtDH(t.ttc);
  }

  const showTtc = data.wordsBase !== "ht";
  tvaRow.classList.toggle("hidden", !showTtc);
  ttcRow.classList.toggle("hidden", !showTtc);
  htRow.classList.toggle("bg-slate-100", !showTtc);
  htLabelCell.classList.toggle("font-bold", !showTtc);
  totalHTEl.classList.toggle("font-bold", !showTtc);
  totalHTEl.classList.toggle("font-medium", showTtc);

  const base = data.wordsBase === "ht" ? t.netHT : t.ttc;
  amountWordsEl.textContent = amountToFrenchWords(base) + ".";
}

function renderModal() {
  renderLogo();
  renderCompanyInfo();
  renderModalFields();
  renderItems();
  renderTotals();
}

/* ---------------- modal open/close ---------------- */

function showModal() {
  modalOverlay.classList.remove("hidden");
  isDirty = false;
}

function hideModal() {
  modalOverlay.classList.add("hidden");
  editing = null;
}

function openCreate(type) {
  editing = { type, id: null, isNew: true, data: emptyDocData(type) };
  renderModal();
  showModal();
}

function openEdit(type, id) {
  const doc = state.docs[type].find((d) => d.id === id);
  if (!doc) return;
  editing = { type, id, isNew: false, data: JSON.parse(JSON.stringify(doc)) };
  renderModal();
  showModal();
}

function requestClose() {
  if (isDirty && !confirm("Fermer sans enregistrer les modifications ?")) return;
  hideModal();
}

function saveCurrent() {
  if (!editing) return;
  const list = state.docs[editing.type];
  editing.data.updatedAt = Date.now();
  if (editing.isNew) {
    editing.data.id = uid();
    editing.data.createdAt = Date.now();
    list.push(editing.data);
    editing.id = editing.data.id;
    editing.isNew = false;
  } else {
    const idx = list.findIndex((d) => d.id === editing.id);
    if (idx >= 0) list[idx] = editing.data;
  }
  saveData();
  isDirty = false;
  modalHeading.textContent = "Modifier - " + DOC_TYPES[editing.type].label;
  if (editing.type === currentType) renderList();
}

/* ---------------- JSON export / import ---------------- */

function downloadBlob(text, filename) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportCurrentAsJson() {
  if (!editing) return;
  const payload = { docType: editing.type, ...editing.data };
  const json = JSON.stringify(payload, null, 2);
  const filename = `${(editing.data.number || "document").replace(/[^a-zA-Z0-9-_]/g, "_")}.json`;
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return;
      // fall through to download fallback
    }
  }
  downloadBlob(json, filename);
}

function importJsonFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch (e) {
      alert("Fichier JSON invalide.");
      return;
    }
    const type = parsed.docType && DOC_TYPES[parsed.docType] ? parsed.docType : currentType;
    currentType = type;
    updateNavActive();
    renderList();
    const base = emptyDocData(type);
    const data = {
      ...base,
      ...parsed,
      id: null,
      client: { ...base.client, ...(parsed.client || {}) },
      remise: { ...base.remise, ...(parsed.remise || {}) },
      items: Array.isArray(parsed.items) && parsed.items.length ? parsed.items : base.items,
    };
    delete data.docType;
    editing = { type, id: null, isNew: true, data };
    renderModal();
    showModal();
  };
  reader.readAsText(file);
}

/* ---------------- nav ---------------- */

function updateNavActive() {
  document.querySelectorAll(".nav-btn, .nav-btn-mobile").forEach((b) => {
    b.classList.toggle("active", b.dataset.type === currentType);
  });
}

document.getElementById("navTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-btn");
  if (!btn) return;
  currentType = btn.dataset.type;
  updateNavActive();
  renderList();
});

const navMenuToggle = document.getElementById("navMenuToggle");
const navTabsMobile = document.getElementById("navTabsMobile");

navMenuToggle.addEventListener("click", () => {
  navTabsMobile.classList.toggle("hidden");
  navMenuToggle.classList.toggle("open");
});

navTabsMobile.addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-btn-mobile");
  if (!btn) return;
  currentType = btn.dataset.type;
  updateNavActive();
  renderList();
  navTabsMobile.classList.add("hidden");
  navMenuToggle.classList.remove("open");
});

/* ---------------- modal field events ---------------- */

function markDirty() { isDirty = true; }

docNumberEl.addEventListener("input", () => { editing.data.number = docNumberEl.value; markDirty(); });
docDateEl.addEventListener("input", () => {
  docDateEl.value = formatDateInput(docDateEl.value);
  editing.data.date = docDateEl.value;
  markDirty();
});
clientNameEl.addEventListener("input", () => { editing.data.client.name = clientNameEl.value; markDirty(); });
clientAddressEl.addEventListener("input", () => {
  editing.data.client.address = clientAddressEl.value;
  autoGrow(clientAddressEl);
  markDirty();
});
clientIceEl.addEventListener("input", () => { editing.data.client.ice = clientIceEl.value; markDirty(); });

wordsBaseEl.addEventListener("change", () => {
  editing.data.wordsBase = wordsBaseEl.value;
  markDirty();
  renderTotals();
});

remiseToggle.addEventListener("change", () => {
  editing.data.remise.show = remiseToggle.checked;
  remiseRow.classList.toggle("hidden", !remiseToggle.checked);
  markDirty();
  renderTotals();
});
remiseTypeEl.addEventListener("change", () => {
  editing.data.remise.type = remiseTypeEl.value;
  markDirty();
  renderTotals();
});
remiseValueEl.addEventListener("input", () => {
  editing.data.remise.value = Number(remiseValueEl.value) || 0;
  markDirty();
  renderTotals();
});

refToggle.addEventListener("change", () => {
  editing.data.showRef = refToggle.checked;
  itemsTable.classList.toggle("hide-ref", !refToggle.checked);
  markDirty();
});

document.getElementById("btnAddRow").addEventListener("click", () => {
  editing.data.items.push({ ref: "", designation: "", spec: "", qte: 1, pu: 0 });
  markDirty();
  renderItems();
  renderTotals();
});

totalTTCEl.addEventListener("focus", () => totalTTCEl.select());
totalTTCEl.addEventListener("input", () => {
  const val = totalTTCEl.value.trim();
  if (val !== "") {
    distributeTtcToItems(parseLocaleNumber(val));
    renderItems();
  }
  markDirty();
  renderTotals();
});

itemsBody.addEventListener("input", (e) => {
  const tr = e.target.closest("tr");
  const idx = Array.from(itemsBody.children).indexOf(tr);
  const item = editing.data.items[idx];
  if (!item) return;
  if (e.target.classList.contains("ref-input")) item.ref = e.target.value;
  if (e.target.classList.contains("designation-input")) {
    item.designation = e.target.value;
    autoGrow(e.target);
  }
  if (e.target.classList.contains("spec-input")) {
    item.spec = e.target.value;
    autoGrow(e.target);
  }
  if (e.target.classList.contains("qte-input")) item.qte = Number(e.target.value) || 0;
  if (e.target.classList.contains("pu-input")) item.pu = parseLocaleNumber(e.target.value);
  tr.querySelector(".montant-cell").textContent = fmtDH(item.qte * item.pu);
  markDirty();
  renderTotals();
});

itemsBody.addEventListener("focusin", (e) => {
  if (e.target.classList.contains("pu-input")) e.target.select();
});

itemsBody.addEventListener("focusout", (e) => {
  if (!e.target.classList.contains("pu-input")) return;
  const tr = e.target.closest("tr");
  const idx = Array.from(itemsBody.children).indexOf(tr);
  const item = editing.data.items[idx];
  if (!item) return;
  e.target.value = fmt(item.pu);
});

itemsBody.addEventListener("click", (e) => {
  const btn = e.target.closest(".del-row");
  if (!btn) return;
  const tr = btn.closest("tr");
  const idx = Array.from(itemsBody.children).indexOf(tr);
  if (editing.data.items.length <= 1) return;
  editing.data.items.splice(idx, 1);
  markDirty();
  renderItems();
  renderTotals();
});

/* ---------------- global toolbar events ---------------- */

logoInput.addEventListener("change", () => {
  const file = logoInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.logo = reader.result;
    saveData();
    renderLogo();
  };
  reader.readAsDataURL(file);
});

document.getElementById("btnRemoveLogo").addEventListener("click", () => {
  state.logo = null;
  logoInput.value = "";
  saveData();
  renderLogo();
});

const jsonFileInput = document.getElementById("jsonFileInput");
document.getElementById("btnImportJson").addEventListener("click", () => jsonFileInput.click());
jsonFileInput.addEventListener("change", () => {
  const file = jsonFileInput.files[0];
  if (file) importJsonFile(file);
  jsonFileInput.value = "";
});

document.getElementById("btnCreate").addEventListener("click", () => openCreate(currentType));

/* ---------------- modal action buttons ---------------- */

document.getElementById("btnSaveDoc").addEventListener("click", saveCurrent);
document.getElementById("btnExportJson").addEventListener("click", exportCurrentAsJson);
document.getElementById("btnPrintModal").addEventListener("click", printCurrent);
document.getElementById("btnCloseModal").addEventListener("click", requestClose);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) requestClose();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalOverlay.classList.contains("hidden")) requestClose();
});

/* ---------------- init ---------------- */
updateNavActive();
renderList();
renderCompanyInfo();
