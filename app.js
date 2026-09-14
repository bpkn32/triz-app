// ============================================================================
// app.js — TRIZ Research Interface (Frontend Application Logic)
// ============================================================================
//
// Imports reference data authoritatively from triz-data.js.
// Manages:
//   - Tab switching (Solution Generation / Contradiction Identification)
//   - Case ID, Seed, API token state
//   - Dynamic contradiction-pair rows
//   - Reactive union preview & case-readiness validation
//   - Task 1 (Solution Generation) & Task 2 (Contradiction Identification) flows
//   - IndexedDB research log storage & JSONL export
// ============================================================================

import {
  TRIZ_PARAMETERS,
  TRIZ_PRINCIPLES,
  getPrinciplesForContradiction,
  getPrincipleById,
  computeCandidateUnion,
  validateReferenceData
} from "./triz-data.js";

// Cloudflare Worker Origin
const WORKER_ORIGIN = "https://triz-app.berkpiskin-a.workers.dev";

// Models used for parallel research runs
const ALL_MODELS = {
  "openai/gpt-5.4-mini": "GPT-5.4-mini",
  "google/gemini-3.6-flash": "Gemini 3.6 Flash",
  "anthropic/claude-sonnet-5": "Claude Sonnet 5",
  "x-ai/grok-4.5": "Grok 4.5"
};

// ============================================================================
// 1. DOM Element References
// ============================================================================

const caseIdInput = document.getElementById("case-id");
const seedInput = document.getElementById("seed");

const tabBtnSolve = document.getElementById("tab-btn-solve");
const tabBtnIdentify = document.getElementById("tab-btn-identify");
const tabSolve = document.getElementById("tab-solve");
const tabIdentify = document.getElementById("tab-identify");

const problemATextarea = document.getElementById("problem-a");
const problemBTextarea = document.getElementById("problem-b");

const contradictionsContainer = document.getElementById("contradictions-container");
const principlesUnionBody = document.getElementById("principles-union-body");
const principlesUnionEmpty = document.getElementById("principles-union-empty");

const policyCardParsimonious = document.getElementById("policy-card-parsimonious");
const policyCardMinimal = document.getElementById("policy-card-minimal");

const validationStatusBanner = document.getElementById("validation-status");
const btnSolve = document.getElementById("btn-solve");
const btnIdentify = document.getElementById("btn-identify");

const solveResults = document.getElementById("solve-results");
const solveResultsBody = document.getElementById("solve-results-body");
const identifyResults = document.getElementById("identify-results");
const identifyResultsBody = document.getElementById("identify-results-body");

const btnExportJsonl = document.getElementById("btn-export-jsonl");
const logCountSpan = document.getElementById("log-count");

// ============================================================================
// 2. Application State
// ============================================================================

let currentTab = "solve"; // "solve" | "identify"
let contradictionRows = []; // [{ id: "C1", improvingId: 0, worseningId: 0 }]
let rowCounter = 0;
let selectionPolicy = "parsimonious"; // "parsimonious" | "minimal"
let modelStatuses = new Map();

// ============================================================================
// 3. IndexedDB Persistent Research Logging
// ============================================================================

const DB_NAME = "triz-research-log";
const DB_VERSION = 1;
const STORE_NAME = "entries";

function openLogDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        store.createIndex("caseId", "caseId", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("taskType", "taskType", { unique: false });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function saveLogEntry(entry) {
  try {
    const db = await openLogDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    await new Promise((resolve, reject) => {
      const req = store.add(entry);
      req.onsuccess = resolve;
      req.onerror = reject;
    });
    updateLogCountDisplay();
  } catch (err) {
    console.error("Failed to save research log entry to IndexedDB:", err);
  }
}

async function getAllLogEntries() {
  try {
    const db = await openLogDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    return await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = reject;
    });
  } catch (err) {
    console.error("Failed to read research log entries from IndexedDB:", err);
    return [];
  }
}

async function updateLogCountDisplay() {
  const entries = await getAllLogEntries();
  logCountSpan.textContent = `Log entries: ${entries.length}`;
}

// ============================================================================
// 4. Tab Navigation
// ============================================================================

function switchTab(targetTab) {
  currentTab = targetTab;
  if (targetTab === "solve") {
    tabBtnSolve.classList.add("tab-btn-active");
    tabBtnIdentify.classList.remove("tab-btn-active");
    tabSolve.classList.remove("hidden");
    tabIdentify.classList.add("hidden");
  } else {
    tabBtnIdentify.classList.add("tab-btn-active");
    tabBtnSolve.classList.remove("tab-btn-active");
    tabIdentify.classList.remove("hidden");
    tabSolve.classList.add("hidden");
  }
}

tabBtnSolve.addEventListener("click", () => switchTab("solve"));
tabBtnIdentify.addEventListener("click", () => switchTab("identify"));

// ============================================================================
// 5. Principle Selection Policy Controls
// ============================================================================

function setSelectionPolicy(policy) {
  selectionPolicy = policy;
  if (policy === "parsimonious") {
    policyCardParsimonious.classList.add("policy-card-selected");
    policyCardMinimal.classList.remove("policy-card-selected");
    policyCardParsimonious.querySelector("input").checked = true;
  } else {
    policyCardMinimal.classList.add("policy-card-selected");
    policyCardParsimonious.classList.remove("policy-card-selected");
    policyCardMinimal.querySelector("input").checked = true;
  }
}

policyCardParsimonious.addEventListener("click", () => setSelectionPolicy("parsimonious"));
policyCardMinimal.addEventListener("click", () => setSelectionPolicy("minimal"));

// ============================================================================
// 6. Dynamic Contradiction Pair Rows
// ============================================================================

function createParameterOptions() {
  const defaultOpt = '<option value="0">-- Select Parameter --</option>';
  const opts = TRIZ_PARAMETERS.map(
    (p) => `<option value="${p.id}">${p.id}. ${p.name}</option>`
  ).join("");
  return defaultOpt + opts;
}

function addContradictionRow(improvingId = 0, worseningId = 0) {
  rowCounter += 1;
  const rowId = `C${rowCounter}`;

  const rowDiv = document.createElement("div");
  rowDiv.className = "contradiction-row";
  rowDiv.dataset.rowId = rowId;

  const label = document.createElement("span");
  label.className = "text-sm font-medium text-gray-500 w-8 flex-shrink-0";
  label.textContent = rowId;

  const impSelect = document.createElement("select");
  impSelect.className = "p-2 border rounded text-sm";
  impSelect.innerHTML = createParameterOptions();
  impSelect.value = String(improvingId);

  const arrow = document.createElement("span");
  arrow.className = "arrow";
  arrow.textContent = "→";

  const worSelect = document.createElement("select");
  worSelect.className = "p-2 border rounded text-sm";
  worSelect.innerHTML = createParameterOptions();
  worSelect.value = String(worseningId);

  const btnAdd = document.createElement("button");
  btnAdd.type = "button";
  btnAdd.className = "btn-add-row";
  btnAdd.textContent = "+";
  btnAdd.title = "Add contradiction row";
  btnAdd.addEventListener("click", () => addContradictionRow());

  const btnRemove = document.createElement("button");
  btnRemove.type = "button";
  btnRemove.className = "btn-remove-row";
  btnRemove.textContent = "−";
  btnRemove.title = "Remove contradiction row";
  btnRemove.addEventListener("click", () => removeContradictionRow(rowDiv));

  const btnGroup = document.createElement("div");
  btnGroup.className = "row-btn-group";
  btnGroup.appendChild(btnAdd);
  btnGroup.appendChild(btnRemove);

  rowDiv.appendChild(label);
  rowDiv.appendChild(impSelect);
  rowDiv.appendChild(arrow);
  rowDiv.appendChild(worSelect);
  rowDiv.appendChild(btnGroup);

  contradictionsContainer.appendChild(rowDiv);

  const rowObj = { id: rowId, element: rowDiv, impSelect, worSelect };
  contradictionRows.push(rowObj);

  impSelect.addEventListener("change", updateUnionAndValidation);
  worSelect.addEventListener("change", updateUnionAndValidation);

  updateRowButtons();
  updateUnionAndValidation();
}

function removeContradictionRow(rowElement) {
  if (contradictionRows.length <= 1) return; // Keep at least one row
  contradictionRows = contradictionRows.filter((r) => r.element !== rowElement);
  rowElement.remove();
  renumberContradictionRows();
  updateRowButtons();
  updateUnionAndValidation();
}

function renumberContradictionRows() {
  contradictionRows.forEach((r, idx) => {
    const newId = `C${idx + 1}`;
    r.id = newId;
    r.element.dataset.rowId = newId;
    r.element.querySelector("span").textContent = newId;
  });
}

function updateRowButtons() {
  const isOnlyOne = contradictionRows.length === 1;
  contradictionRows.forEach((r) => {
    const btnRemove = r.element.querySelector(".btn-remove-row");
    btnRemove.style.display = isOnlyOne ? "none" : "flex";
  });
}

function getSelectedContradictions() {
  return contradictionRows
    .map((r) => ({
      id: r.id,
      improvingParameterId: Number(r.impSelect.value),
      worseningParameterId: Number(r.worSelect.value)
    }))
    .filter((c) => c.improvingParameterId > 0 && c.worseningParameterId > 0);
}

// ============================================================================
// 7. Reactive Union Preview & Validation Status Display
// ============================================================================

function clearElement(el) {
  el.replaceChildren();
}

function updateUnionAndValidation() {
  const selectedContradictions = getSelectedContradictions();

  // Clear union preview table
  clearElement(principlesUnionBody);

  if (selectedContradictions.length === 0) {
    principlesUnionEmpty.classList.remove("hidden");
    principlesUnionEmpty.textContent = "Select parameters for at least one contradiction pair above to see candidate principles.";
    updateValidationStatus(null);
    return;
  }

  // Compute mappings & union
  const mappings = selectedContradictions.map((c) => {
    const lookup = getPrinciplesForContradiction(c.improvingParameterId, c.worseningParameterId);
    return {
      contradictionId: c.id,
      matrixPrinciples: lookup.principles,
      status: lookup.status
    };
  });

  const candidateIds = computeCandidateUnion(mappings);

  if (candidateIds.length === 0) {
    principlesUnionEmpty.classList.remove("hidden");
    const hasMissingCell = mappings.some((m) => m.status === "matrix_data_missing");
    principlesUnionEmpty.textContent = hasMissingCell
      ? "One or more matrix cells have not yet been entered."
      : "Selected contradiction pairs resulted in a verified empty candidate set.";
  } else {
    principlesUnionEmpty.classList.add("hidden");
    candidateIds.forEach((id) => {
      const p = getPrincipleById(id);
      const row = principlesUnionBody.insertRow();

      const idCell = row.insertCell();
      idCell.className = "p-2 border border-gray-300 font-mono text-center";
      idCell.textContent = String(id);

      const nameCell = row.insertCell();
      nameCell.className = "p-2 border border-gray-300 font-medium";
      nameCell.textContent = p ? p.name : `Principle ${id}`;

      const descCell = row.insertCell();
      descCell.className = "p-2 border border-gray-300 text-xs";
      if (p && Array.isArray(p.canonicalDescription) && p.canonicalDescription.length > 0) {
        descCell.innerHTML = p.canonicalDescription.map((line) => `• ${line}`).join("<br>");
      } else {
        descCell.innerHTML = '<span class="text-amber-600 italic">Canonical description not yet provided</span>';
      }
    });
  }

  // Validate case-specific readiness
  const valResult = validateReferenceData(selectedContradictions);
  updateValidationStatus(valResult);
}

function updateValidationStatus(valResult) {
  if (!valResult || !valResult.case) {
    validationStatusBanner.classList.add("hidden");
    btnSolve.disabled = true;
    return;
  }

  const { case: caseVal } = valResult;
  validationStatusBanner.classList.remove("hidden");

  if (caseVal.researchReady) {
    validationStatusBanner.className = "p-3 rounded border text-sm validation-ready";
    validationStatusBanner.innerHTML = `
      <strong>Research Status: READY</strong><br>
      All required matrix cells are present (${caseVal.candidatePrincipleCount} candidate principles derived).
      All required canonical descriptions are provided.
    `;
    btnSolve.disabled = false;
  } else {
    validationStatusBanner.className = "p-3 rounded border text-sm validation-blocked";
    let issuesHtml = caseVal.issues.map((i) => `• ${i}`).join("<br>");
    validationStatusBanner.innerHTML = `
      <strong>Research Status: BLOCKED — Case reference data incomplete</strong><br>
      Solution generation is disabled until required reference data is entered:<br>
      ${issuesHtml}
    `;
    btnSolve.disabled = true;
  }
}

// ============================================================================
// 8. API Communication Helper
// ============================================================================

async function postJson(path, payload, timeoutMs = 120000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { "Content-Type": "application/json" };

  try {
    const res = await fetch(`${WORKER_ORIGIN}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// 9. UI Rendering Helpers for Results
// ============================================================================

function createLoadingCell(cell) {
  clearElement(cell);
  const wrapper = document.createElement("div");
  wrapper.className = "flex items-center space-x-2";

  const spinner = document.createElement("div");
  spinner.className = "animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600";
  wrapper.appendChild(spinner);

  const label = document.createElement("span");
  label.className = "text-gray-500 text-sm";
  label.textContent = "Processing model...";
  wrapper.appendChild(label);

  cell.appendChild(wrapper);
}

function setStatusCell(statusCell, status) {
  statusCell.dataset.status = status;
  clearElement(statusCell);
  const badge = document.createElement("span");
  if (status === "completed") {
    badge.className = "badge badge-ready";
    badge.textContent = "Completed";
  } else if (status === "failed") {
    badge.className = "badge badge-blocked";
    badge.textContent = "Failed";
  } else {
    badge.className = "badge badge-incomplete";
    badge.textContent = "Processing";
  }
  statusCell.appendChild(badge);
}

function renderSolveError(cell, modelId, modelName, errorMessage) {
  clearElement(cell);
  const wrapper = document.createElement("div");
  wrapper.className = "text-red-600 text-sm space-y-1";

  const header = document.createElement("div");
  header.className = "font-semibold";
  header.textContent = "Request Failed";
  wrapper.appendChild(header);

  const details = document.createElement("div");
  details.className = "text-xs text-gray-600";
  details.textContent = errorMessage;
  wrapper.appendChild(details);

  cell.appendChild(wrapper);
}

function renderSolveResponse(cell, data) {
  clearElement(cell);
  const wrapper = document.createElement("div");
  wrapper.className = "text-sm space-y-3 max-h-96 overflow-y-auto p-1";

  // Selected principles
  if (Array.isArray(data.selectedPrinciples) && data.selectedPrinciples.length > 0) {
    const princDiv = document.createElement("div");
    princDiv.innerHTML = '<strong>Selected Principles:</strong> ' +
      data.selectedPrinciples.map((p) => `<span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded mr-1">#${p.id} ${p.name}</span>`).join(" ");
    wrapper.appendChild(princDiv);
  }

  // Contradiction coverage
  if (Array.isArray(data.contradictionCoverage) && data.contradictionCoverage.length > 0) {
    const covDiv = document.createElement("div");
    covDiv.innerHTML = "<strong>Contradiction Coverage:</strong>";
    const covList = document.createElement("ul");
    covList.className = "list-disc list-inside text-xs space-y-1 mt-1";
    data.contradictionCoverage.forEach((c) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${c.contradictionId}:</strong> addressed by [${(c.addressedByPrincipleIds || []).map((id) => `#${id}`).join(", ")}] — ${c.explanation || ""}`;
      covList.appendChild(li);
    });
    covDiv.appendChild(covList);
    wrapper.appendChild(covDiv);
  }

  // Principle application
  if (Array.isArray(data.principleApplication) && data.principleApplication.length > 0) {
    const appDiv = document.createElement("div");
    appDiv.innerHTML = "<strong>Principle Application:</strong>";
    const appList = document.createElement("ul");
    appList.className = "list-disc list-inside text-xs space-y-1 mt-1";
    data.principleApplication.forEach((pa) => {
      const p = getPrincipleById(pa.principleId);
      const name = p ? p.name : `Principle ${pa.principleId}`;
      const li = document.createElement("li");
      li.innerHTML = `<strong>#${pa.principleId} ${name}:</strong> ${pa.application || ""}`;
      appList.appendChild(li);
    });
    appDiv.appendChild(appList);
    wrapper.appendChild(appDiv);
  }

  // Solution text
  if (data.solution) {
    const solDiv = document.createElement("div");
    solDiv.className = "bg-gray-50 p-2 border rounded";
    solDiv.innerHTML = "<strong>Solution:</strong><br>" + data.solution.replace(/\n/g, "<br>");
    wrapper.appendChild(solDiv);
  }

  // Validation badge
  const valDiv = document.createElement("div");
  valDiv.className = "text-xs pt-1 border-t";
  if (data.validationStatus === "valid") {
    valDiv.innerHTML = '<span class="text-green-600">✓ Deterministic Validation: PASS</span>';
  } else if (data.validationStatus === "normalized") {
    valDiv.innerHTML = '<span class="text-blue-600">ℹ Deterministic Validation: NORMALIZED</span>';
  } else {
    valDiv.innerHTML = `<span class="text-red-600">⚠ Deterministic Validation: FAILED (${(data.validationErrors || []).join("; ")})</span>`;
  }
  wrapper.appendChild(valDiv);

  cell.appendChild(wrapper);
}

function renderIdentifyResponse(cell, data) {
  clearElement(cell);
  const wrapper = document.createElement("div");
  wrapper.className = "text-sm space-y-3 max-h-96 overflow-y-auto p-1";

  if (Array.isArray(data.contradictions) && data.contradictions.length > 0) {
    data.contradictions.forEach((c, idx) => {
      const card = document.createElement("div");
      card.className = "bg-gray-50 p-2 border rounded space-y-1 text-xs";
      card.innerHTML = `
        <div class="font-semibold text-blue-800">Contradiction #${idx + 1}</div>
        <div><strong>Improving:</strong> ${c.improvingAspect || ""} → <span class="bg-green-100 text-green-800 px-1 rounded">Parameter ${c.improvingParameter?.id}: ${c.improvingParameter?.name}</span></div>
        <div><strong>Worsening:</strong> ${c.worseningAspect || ""} → <span class="bg-red-100 text-red-800 px-1 rounded">Parameter ${c.worseningParameter?.id}: ${c.worseningParameter?.name}</span></div>
        ${c.evidence ? `<div><strong>Evidence:</strong> <em>${c.evidence}</em></div>` : ""}
      `;
      wrapper.appendChild(card);
    });
  } else {
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "text-gray-500 italic text-xs";
    emptyMsg.textContent = "No contradictions identified by this model.";
    wrapper.appendChild(emptyMsg);
  }

  // Validation status
  const valDiv = document.createElement("div");
  valDiv.className = "text-xs pt-1 border-t";
  if (data.validationStatus === "valid") {
    valDiv.innerHTML = '<span class="text-green-600">✓ Deterministic Validation: PASS</span>';
  } else if (data.validationStatus === "normalized") {
    valDiv.innerHTML = '<span class="text-blue-600">ℹ Deterministic Validation: NORMALIZED</span>';
  } else {
    valDiv.innerHTML = `<span class="text-red-600">⚠ Validation: FAILED (${(data.validationErrors || []).join("; ")})</span>`;
  }
  wrapper.appendChild(valDiv);

  cell.appendChild(wrapper);
}

// ============================================================================
// 10. Task 1: Solution Generation Execution Flow
// ============================================================================

async function processSolveModel(modelId, modelName, payload) {
  const cellId = `solve-sol-${modelId.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const statusId = `solve-stat-${modelId.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const solutionCell = document.getElementById(cellId);
  const statusCell = document.getElementById(statusId);

  createLoadingCell(solutionCell);
  setStatusCell(statusCell, "processing");
  modelStatuses.set(modelId, "processing");

  const modelPayload = { ...payload, model: modelId };
  const timestamp = new Date().toISOString();

  try {
    const data = await postJson("/solve", modelPayload);
    renderSolveResponse(solutionCell, data);
    setStatusCell(statusCell, "completed");
    modelStatuses.set(modelId, "completed");

    // Save research log
    await saveLogEntry({
      caseId: payload.caseId || null,
      taskType: "solution_generation",
      timestamp,
      model: modelId,
      provider: modelId.split("/")[0],
      problemDefinitionType: "A",
      problemDefinition: payload.problem,
      sourceReportedContradictions: payload.contradictions,
      selectionPolicy: payload.selectionPolicy,
      requestedSeed: payload.seed,
      reasoningEffort: "medium",
      maxOutputTokens: 2500,
      requestPayload: modelPayload,
      parsedResponse: data,
      validationStatus: data.validationStatus,
      validationErrors: data.validationErrors || [],
      researchMeta: data.researchMeta || null,
      error: null
    });
  } catch (err) {
    renderSolveError(solutionCell, modelId, modelName, err.message);
    setStatusCell(statusCell, "failed");
    modelStatuses.set(modelId, "failed");

    // Save error log entry
    await saveLogEntry({
      caseId: payload.caseId || null,
      taskType: "solution_generation",
      timestamp,
      model: modelId,
      provider: modelId.split("/")[0],
      problemDefinitionType: "A",
      problemDefinition: payload.problem,
      sourceReportedContradictions: payload.contradictions,
      selectionPolicy: payload.selectionPolicy,
      requestedSeed: payload.seed,
      reasoningEffort: "medium",
      maxOutputTokens: 2500,
      requestPayload: modelPayload,
      parsedResponse: null,
      validationStatus: "failed",
      validationErrors: [err.message],
      researchMeta: null,
      error: err.message
    });
  }
}

btnSolve.addEventListener("click", async () => {
  const problem = problemATextarea.value.trim();
  const contradictions = getSelectedContradictions();
  const caseId = caseIdInput.value.trim();

  // Validate seed
  const rawSeed = seedInput.value.trim();
  let seed = null;
  if (rawSeed !== "") {
    const parsed = Number(rawSeed);
    if (!Number.isInteger(parsed) || parsed < 0) {
      alert("Seed must be a non-negative integer or left blank.");
      return;
    }
    seed = parsed;
  }

  if (!problem) {
    alert("Please enter Problem Definition A.");
    return;
  }

  if (contradictions.length === 0) {
    alert("Please select parameters for at least one contradiction pair.");
    return;
  }

  // Validate reference data completeness for case
  const valResult = validateReferenceData(contradictions);
  if (!valResult.case || !valResult.case.researchReady) {
    alert("Solution Generation is disabled: required reference data for this case is incomplete.");
    return;
  }

  const payload = {
    caseId,
    problem,
    contradictions,
    selectionPolicy,
    seed
  };

  // Prepare UI
  solveResults.classList.remove("hidden");
  clearElement(solveResultsBody);
  modelStatuses.clear();

  Object.entries(ALL_MODELS).forEach(([modelId, modelName]) => {
    const row = document.createElement("tr");

    const modelCell = row.insertCell();
    modelCell.className = "border border-gray-300 p-2 font-medium w-40";
    modelCell.textContent = modelName;

    const solCell = row.insertCell();
    solCell.className = "border border-gray-300 p-2";
    solCell.id = `solve-sol-${modelId.replace(/[^a-zA-Z0-9]/g, "-")}`;
    createLoadingCell(solCell);

    const statCell = row.insertCell();
    statCell.className = "border border-gray-300 p-2 w-28";
    statCell.id = `solve-stat-${modelId.replace(/[^a-zA-Z0-9]/g, "-")}`;
    setStatusCell(statCell, "processing");

    solveResultsBody.appendChild(row);
  });

  // Concurrency-2 execution queue
  const queue = Object.entries(ALL_MODELS);
  const concurrency = 2;
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const [modelId, modelName] = queue.shift();
      await processSolveModel(modelId, modelName, payload);
    }
  });

  await Promise.all(workers);
});

// ============================================================================
// 11. Task 2: Contradiction Identification Execution Flow
// ============================================================================

async function processIdentifyModel(modelId, modelName, payload) {
  const cellId = `id-cell-${modelId.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const statusId = `id-stat-${modelId.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const resultCell = document.getElementById(cellId);
  const statusCell = document.getElementById(statusId);

  createLoadingCell(resultCell);
  setStatusCell(statusCell, "processing");

  const modelPayload = { ...payload, model: modelId };
  const timestamp = new Date().toISOString();

  try {
    const data = await postJson("/identify", modelPayload);
    renderIdentifyResponse(resultCell, data);
    setStatusCell(statusCell, "completed");

    // Save research log
    await saveLogEntry({
      caseId: payload.caseId || null,
      taskType: "contradiction_identification",
      timestamp,
      model: modelId,
      provider: modelId.split("/")[0],
      problemDefinitionType: "B",
      problemDefinition: payload.problem,
      sourceReportedContradictions: null,
      selectionPolicy: null,
      requestedSeed: payload.seed,
      reasoningEffort: "medium",
      maxOutputTokens: 2500,
      requestPayload: modelPayload,
      parsedResponse: data,
      validationStatus: data.validationStatus,
      validationErrors: data.validationErrors || [],
      researchMeta: data.researchMeta || null,
      error: null
    });
  } catch (err) {
    renderSolveError(resultCell, modelId, modelName, err.message);
    setStatusCell(statusCell, "failed");

    // Save error log entry
    await saveLogEntry({
      caseId: payload.caseId || null,
      taskType: "contradiction_identification",
      timestamp,
      model: modelId,
      provider: modelId.split("/")[0],
      problemDefinitionType: "B",
      problemDefinition: payload.problem,
      sourceReportedContradictions: null,
      selectionPolicy: null,
      requestedSeed: payload.seed,
      reasoningEffort: "medium",
      maxOutputTokens: 2500,
      requestPayload: modelPayload,
      parsedResponse: null,
      validationStatus: "failed",
      validationErrors: [err.message],
      researchMeta: null,
      error: err.message
    });
  }
}

btnIdentify.addEventListener("click", async () => {
  const problem = problemBTextarea.value.trim();
  const caseId = caseIdInput.value.trim();

  // Validate seed
  const rawSeed = seedInput.value.trim();
  let seed = null;
  if (rawSeed !== "") {
    const parsed = Number(rawSeed);
    if (!Number.isInteger(parsed) || parsed < 0) {
      alert("Seed must be a non-negative integer or left blank.");
      return;
    }
    seed = parsed;
  }

  if (!problem) {
    alert("Please enter Problem Definition B.");
    return;
  }

  const payload = {
    caseId,
    problem,
    seed
  };

  // Prepare UI
  identifyResults.classList.remove("hidden");
  clearElement(identifyResultsBody);

  Object.entries(ALL_MODELS).forEach(([modelId, modelName]) => {
    const row = document.createElement("tr");

    const modelCell = row.insertCell();
    modelCell.className = "border border-gray-300 p-2 font-medium w-40";
    modelCell.textContent = modelName;

    const resCell = row.insertCell();
    resCell.className = "border border-gray-300 p-2";
    resCell.id = `id-cell-${modelId.replace(/[^a-zA-Z0-9]/g, "-")}`;
    createLoadingCell(resCell);

    const statCell = row.insertCell();
    statCell.className = "border border-gray-300 p-2 w-28";
    statCell.id = `id-stat-${modelId.replace(/[^a-zA-Z0-9]/g, "-")}`;
    setStatusCell(statCell, "processing");

    identifyResultsBody.appendChild(row);
  });

  // Concurrency-2 execution queue
  const queue = Object.entries(ALL_MODELS);
  const concurrency = 2;
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const [modelId, modelName] = queue.shift();
      await processIdentifyModel(modelId, modelName, payload);
    }
  });

  await Promise.all(workers);
});

// ============================================================================
// 12. Research Log JSONL Export
// ============================================================================

btnExportJsonl.addEventListener("click", async () => {
  const entries = await getAllLogEntries();
  if (entries.length === 0) {
    alert("No research log entries to export yet.");
    return;
  }

  // Convert each entry to one JSON string line
  const lines = entries.map((entry) => JSON.stringify(entry));
  const content = lines.join("\n");

  const blob = new Blob([content], { type: "application/x-jsonlines;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.download = `triz-research-log-${timestamp}.jsonl`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// ============================================================================
// 13. Application Initialization
// ============================================================================

function init() {
  // Start with one initial contradiction row
  addContradictionRow();
  // Update log count display from IndexedDB
  updateLogCountDisplay();
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
