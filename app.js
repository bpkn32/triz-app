    // Cloudflare Worker endpoint
    const WORKER_ORIGIN = "https://cold-surf-b603.citetic.workers.dev";

    const matrixContainer = document.getElementById("matrix-container");
    const matrixTable = document.getElementById("matrixTable");
    const solutionTable = document.getElementById("solution-table");
    const solutionTableBody = document.getElementById("solution-table-body");
    const solutionText = document.getElementById("solution-text");
    const principlesSelect = document.getElementById("principles-select");
    const apiTokenInput = document.getElementById("api-token");

    apiTokenInput.value = sessionStorage.getItem("triz-api-token") || "";
    apiTokenInput.addEventListener("input", () => {
      sessionStorage.setItem("triz-api-token", apiTokenInput.value.trim());
    });

    const ALL_MODELS = {
      "openai/gpt-5.4-mini": "GPT-5.4-mini",
      "google/gemini-3.6-flash": "Gemini 3.6 Flash",
      "anthropic/claude-sonnet-5": "Claude Sonnet 5",
      "x-ai/grok-4.5": "Grok 4.5",
    };

    const PRINCIPLES = [
      "Segmentation",
      "Taking out",
      "Local quality",
      "Asymmetry",
      "Merging",
      "Universality",
      "Nested doll",
      "Anti-weight",
      "Preliminary anti-action",
      "Preliminary action",
      "Beforehand cushioning",
      "Equipotentiality",
      "The other way round",
      "Spheroidality - Curvature",
      "Dynamics",
      "Partial or excessive actions",
      "Another dimension",
      "Mechanical vibration",
      "Periodic action",
      "Continuity of useful action",
      "Skipping",
      "Blessing in disguise",
      "Feedback",
      "Intermediary",
      "Self-service",
      "Copying",
      "Cheap short-living objects",
      "Mechanics substitution",
      "Pneumatics and hydraulics",
      "Flexible shells and thin films",
      "Porous materials",
      "Color changes",
      "Homogeneity",
      "Discarding and recovering",
      "Parameter changes",
      "Phase transitions",
      "Thermal expansion",
      "Strong oxidants",
      "Inert atmosphere",
      "Composite materials",
    ];

    const principleByName = new Map(PRINCIPLES.map((name, index) => [name, { id: index + 1, name }]));
    const modelStatuses = new Map();

    function clearElement(element) {
      element.replaceChildren();
    }

    function appendText(parent, text, className = "") {
      const node = document.createElement("div");
      if (className) node.className = className;
      node.textContent = text;
      parent.appendChild(node);
      return node;
    }

    function setStatus(statusCell, status, className) {
      statusCell.dataset.status = status;
      clearElement(statusCell);
      appendText(statusCell, status === "completed" ? "Completed" : status === "failed" ? "Failed" : "Processing", className);
    }

    async function postJson(path, payload, timeoutMs = 120000) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const headers = { "Content-Type": "application/json" };
      const apiToken = apiTokenInput.value.trim();
      if (apiToken) headers["x-triz-api-token"] = apiToken;
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

    function createLoading(cell) {
      clearElement(cell);
      const wrapper = document.createElement("div");
      wrapper.className = "flex items-center";

      const spinner = document.createElement("div");
      spinner.className = "animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2";
      wrapper.appendChild(spinner);

      const label = document.createElement("span");
      label.className = "text-gray-500";
      label.textContent = "Generating...";
      wrapper.appendChild(label);

      cell.appendChild(wrapper);
    }

    function createRetryButton(modelId, modelName) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600";
      button.textContent = "Retry";
      button.addEventListener("click", () => retryModel(modelId, modelName));
      return button;
    }

    function renderError(cell, modelId, modelName, errorMessage) {
      clearElement(cell);
      const wrapper = document.createElement("div");
      wrapper.className = "text-red-600";
      appendText(wrapper, "Request failed", "font-semibold");
      const lowerMessage = String(errorMessage).toLowerCase();
      const userMessage = lowerMessage.includes("too many requests")
        ? "The rate limit was reached. Wait about one minute before retrying this model."
        : lowerMessage.includes("timed out")
          ? "The model took too long to respond. Gemini and other reasoning models can be slower; retry this model once."
          : "The model could not complete this request. Please retry or choose different inputs.";
      appendText(wrapper, userMessage, "text-sm mb-2");
      appendText(wrapper, `Technical details: ${errorMessage}`, "text-xs text-gray-600 mb-2");
      wrapper.appendChild(createRetryButton(modelId, modelName));
      cell.appendChild(wrapper);
    }

    function renderSolution(cell, data) {
      clearElement(cell);
      const wrapper = document.createElement("div");
      wrapper.className = "max-h-40 overflow-y-auto space-y-2";

      if (Array.isArray(data.principles) && data.principles.length > 0) {
        appendText(wrapper, "Selected TRIZ Principles:", "font-semibold");
        data.principles.forEach((principle) => {
          const id = Number.isInteger(principle.id) ? `${principle.id}. ` : "";
          appendText(wrapper, `${id}${principle.name || "Unnamed principle"}: ${principle.explanation || ""}`);
        });
      }

      appendText(wrapper, "Solution:", "font-semibold mt-2");
      appendText(wrapper, data.solution || "");
      cell.appendChild(wrapper);
    }

    function renderMatrix(principles) {
      clearElement(matrixTable);
      if (!principles?.length) {
        const row = matrixTable.insertRow();
        const cell = row.insertCell();
        cell.className = "p-2";
        cell.textContent = "No matching TRIZ principle found.";
      } else {
        const header = matrixTable.insertRow();
        header.className = "bg-gray-200";
        ["#", "Principle"].forEach((label) => {
          const th = document.createElement("th");
          th.className = "p-2 border";
          th.textContent = label;
          header.appendChild(th);
        });

        principles.forEach((principle) => {
          const row = matrixTable.insertRow();
          const idCell = row.insertCell();
          idCell.className = "p-2 border";
          idCell.textContent = Number.isInteger(principle.id) ? principle.id : "";

          const nameCell = row.insertCell();
          nameCell.className = "p-2 border";
          nameCell.textContent = principle.name || "";
        });
      }
      matrixContainer.classList.remove("hidden");

      const principleNamesFromMatrix = principles.map(p => p.name);
      Array.from(principlesSelect.options).forEach(option => {
        option.selected = principleNamesFromMatrix.includes(option.value);
      });
    }

    function getSelectedValues(selectId) {
      return Array.from(document.getElementById(selectId).selectedOptions)
        .map(option => option.value)
        .filter(Boolean);
    }

    document.getElementById("btn-matrix").addEventListener("click", async () => {
      const improve = getSelectedValues("improve");
      const worsen = getSelectedValues("worsen");
      if (improve.length === 0 || worsen.length === 0) {
        alert("Please select both parameters to view the contradiction matrix, or leave them empty to skip matrix generation.");
        return;
      }

      Array.from(principlesSelect.options).forEach(option => option.selected = false);
      clearElement(matrixTable);
      matrixContainer.classList.add("hidden");

      const payload = {
        improveParam: improve,
        worsenParam: worsen,
        model: "openai/gpt-5.4-mini" // Default model for matrix
      };
      try {
        const data = await postJson("/matrix", payload);
        renderMatrix(data.principles);
      } catch (err) {
        alert("Matrix error: " + err.message);
      }
    });

    async function processModel(modelId, modelName, problem, improve, worsen, manualPrinciples) {
      const solutionCellId = `solution-${modelId.replace(/[^a-zA-Z0-9]/g, '-')}`;
      const statusCellId = `status-${modelId.replace(/[^a-zA-Z0-9]/g, '-')}`;
      const solutionCell = document.getElementById(solutionCellId);
      const statusCell = document.getElementById(statusCellId);

      createLoading(solutionCell);
      setStatus(statusCell, "processing", "text-blue-600");
      modelStatuses.set(modelId, "processing");

      try {
        const payload = {
          problem,
          improveParam: improve || null,
          worsenParam: worsen || null,
          manualPrinciples: manualPrinciples,
          model: modelId
        };

        const data = await postJson("/solve", payload);
        renderSolution(solutionCell, data);
        setStatus(statusCell, "completed", "text-green-600");
        modelStatuses.set(modelId, "completed");
      } catch (err) {
        renderError(solutionCell, modelId, modelName, err.name === "AbortError" ? "Request timed out" : err.message);
        setStatus(statusCell, "failed", "text-red-600");
        modelStatuses.set(modelId, "failed");
      }
    }

    async function retryModel(modelId, modelName) {
      const problem = document.getElementById("problem").value.trim();
      const improve = getSelectedValues("improve");
      const worsen = getSelectedValues("worsen");
      const manualPrinciples = getSelectedPrinciples();

      await processModel(modelId, modelName, problem, improve, worsen, manualPrinciples);
      renderSummary();
    }

    function getSelectedPrinciples() {
      return Array.from(principlesSelect.selectedOptions)
        .map(opt => principleByName.get(opt.value))
        .filter(Boolean);
    }

    function renderSummary() {
      const previousSummary = document.getElementById("processing-summary");
      if (previousSummary) previousSummary.remove();

      const totalModels = Object.keys(ALL_MODELS).length;
      const failedModels = Array.from(modelStatuses.values()).filter(status => status === "failed").length;
      const completedModels = Array.from(modelStatuses.values()).filter(status => status === "completed").length;
      const successRate = Math.round((completedModels / totalModels) * 100);

      const summaryDiv = document.createElement("div");
      summaryDiv.id = "processing-summary";
      summaryDiv.className = "mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-blue-800";
      appendText(summaryDiv, `Processing Summary: ${completedModels}/${totalModels} models completed successfully (${successRate}% success rate)`);
      if (failedModels > 0) {
        const note = document.createElement("small");
        note.textContent = "Failed models can be retried individually using the Retry buttons above.";
        summaryDiv.appendChild(note);
      }
      solutionTable.appendChild(summaryDiv);
    }

    document.getElementById("btn-solve").addEventListener("click", async () => {
      const problem = document.getElementById("problem").value.trim();
      const improve = getSelectedValues("improve");
      const worsen = getSelectedValues("worsen");

      if (!problem) {
        alert("Please describe the problem (field 1 is mandatory).");
        return;
      }

      const manualPrinciples = getSelectedPrinciples();

      solutionTable.classList.remove("hidden");
      solutionText.classList.add("hidden");
      clearElement(solutionTableBody);
      modelStatuses.clear();

      const previousSummary = document.getElementById("processing-summary");
      if (previousSummary) previousSummary.remove();

      Object.entries(ALL_MODELS).forEach(([modelId, modelName]) => {
        const row = document.createElement("tr");

        const modelCell = row.insertCell();
        modelCell.className = "border border-gray-300 p-2 font-medium";
        modelCell.textContent = modelName;

        const solutionCell = row.insertCell();
        solutionCell.className = "border border-gray-300 p-2";
        solutionCell.id = `solution-${modelId.replace(/[^a-zA-Z0-9]/g, '-')}`;
        createLoading(solutionCell);

        const statusCell = row.insertCell();
        statusCell.className = "border border-gray-300 p-2";
        statusCell.id = `status-${modelId.replace(/[^a-zA-Z0-9]/g, '-')}`;
        setStatus(statusCell, "processing", "text-blue-600");
        modelStatuses.set(modelId, "processing");

        solutionTableBody.appendChild(row);
      });

      const queue = Object.entries(ALL_MODELS);
      const concurrency = 2;
      const workers = Array.from({ length: concurrency }, async () => {
        while (queue.length > 0) {
          const [modelId, modelName] = queue.shift();
          await processModel(modelId, modelName, problem, improve, worsen, manualPrinciples);
        }
      });

      await Promise.all(workers);
      renderSummary();
    });
