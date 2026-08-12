# TRIZ Research Interface — Repository Refactor & Implementation Task

You have already inspected and understood this repository.

Now modify the existing project to turn it into a controlled research interface for evaluating LLM-based TRIZ reasoning.

Do **not rebuild the application from scratch** unless absolutely necessary. Reuse the current frontend and Cloudflare Worker/OpenRouter architecture where practical, but refactor components where the existing design conflicts with the experimental requirements below.

Before editing, inspect the relevant existing code again and preserve working functionality that is not explicitly replaced.

---

# 1. Research Design

The application must contain **two completely independent tabs/tasks**:

1. **Solution Generation**
2. **Contradiction Identification**

These tasks must be experimentally independent.

No model-generated output, conversation history, hidden state, previous response, or inferred contradiction from one task may ever be automatically passed into the other.

Each model invocation must remain a fresh, stateless request.

---

# 2. Global Experiment Settings

Create a compact **Experiment Settings** section near the top of the interface.

It should apply to model calls in both tabs where relevant.

## Reasoning Effort

Use:

```text
medium
```

for all supported models.

This should be fixed for the experiment rather than casually editable per case.

If model/provider syntax differs, translate the common nominal `medium` setting appropriately for that provider.

## Maximum Output Tokens

Use:

```text
2500
```

for all solution-generation models.

Contradiction-identification responses may use a smaller technically appropriate cap if necessary, but keep this explicitly defined and logged.

## Sampling Parameters

Do **not** artificially force identical temperature/top-p/top-k values across model families.

Use each model/provider's documented/default sampling behavior unless the existing Worker requires otherwise.

Do not expose unnecessary sampling controls in the main UI.

## Optional Seed

Add an optional:

```text
Seed
```

input.

Requirements:

- Seed is not mandatory.
- Blank means no seed is requested.
- Send it only when the target model/provider supports it.
- Do not pretend unsupported models are deterministic.
- Log both:
  - requested seed
  - whether it was actually sent/applied for each model

A seed must never silently cause a request failure for a model that does not support it.

---

# 3. Case Identification

Add a shared:

```text
Case ID
```

field.

Example:

```text
AM_CPU_FAN_01
```

Use the Case ID when logging outputs from both tasks.

Do not use it as model context unless necessary for technical identification.

---

# 4. TAB 1 — Solution Generation

This is the main controlled TRIZ solution-generation experiment.

The workflow must be:

```text
Problem Definition A
        +
Source-reported contradiction pairs
        ↓
Deterministic classical TRIZ contradiction matrix lookup
        ↓
Principles per contradiction
        ↓
Union + deduplication
        ↓
Closed candidate principle set
        +
Canonical principle descriptions
        +
Selection policy
        ↓
Independent target LLM
        ↓
Selected principle subset
        ↓
Contradiction coverage
        ↓
Final solution
```

---

# 5. Problem Definition A

Rename/use the main problem field in this tab as:

```text
1. Problem Definition A
```

This contains a neutral pre-TRIZ technical problem definition.

The application should treat it as plain problem data.

Do not perform contradiction inference from it inside this task.

---

# 6. Replace the Existing Contradiction Selection UI

Remove the current independent multi-select structure for:

```text
Improvement Parameters
Worsening Parameters
```

because it creates ambiguity about pair relationships.

Replace it with:

```text
2. Contradictions
```

Each contradiction must be represented by **one explicit row** containing:

```text
[Improving TRIZ Parameter dropdown]
[Worsening TRIZ Parameter dropdown]
[Add / Remove control]
```

Each row represents exactly one pair:

```text
C1 = improving parameter X → worsening parameter Y
```

No Cartesian-product interpretation is allowed.

## Dynamic rows

- Start with one contradiction row.
- A green `+` button adds another row directly below.
- New rows must align exactly with the row above.
- Each row after the first should also have a compact remove control.
- Users may add as many contradiction rows as needed.
- Preserve a clean, compact interface similar to the existing visual style.

## Internal representation

Use an explicit pair-based structure such as:

```json
{
  "contradictions": [
    {
      "id": "C1",
      "improvingParameterId": 3,
      "worseningParameterId": 5
    },
    {
      "id": "C2",
      "improvingParameterId": 6,
      "worseningParameterId": 8
    }
  ]
}
```

Do not represent contradictions as two unrelated arrays.

---

# 7. Central TRIZ Reference Data

Create or reuse a single centralized source of truth for:

1. the **39 classical TRIZ engineering parameters**
2. the **40 classical TRIZ inventive principles**
3. a **canonical description field for every inventive principle**
4. the **classical contradiction matrix**

## Important constraint

Do **not** search the internet, external documentation, academic sources, TRIZ websites, or other repositories for:

- the classical TRIZ contradiction matrix,
- principle-to-contradiction mappings,
- canonical descriptions of the 40 inventive principles.

Do **not** infer, reconstruct, approximate, or generate any missing TRIZ reference data using an LLM.

These data will be manually provided and verified by the researcher later.

The implementation task is only to create the **data structures, placeholders, lookup logic, validation logic, and UI integration** required to use them.

---

# 8. TRIZ Engineering Parameters

If the repository already contains the 39 engineering parameter IDs and names, centralize and reuse them.

Do not replace them with externally researched data.

Create a centralized structure such as:

```js
export const TRIZ_PARAMETERS = [
  { id: 1, name: "Weight of moving object" },
  { id: 2, name: "Weight of stationary object" },
  // ...
];
```

If the existing repository already contains all 39 parameter names, migrate those existing values into this structure.

If anything is missing or uncertain, leave an explicit placeholder rather than researching it.

---

# 9. TRIZ Inventive Principles and Canonical Descriptions

If the repository already contains the 40 principle IDs and names, centralize and reuse them.

Add a field for a canonical description, but **do not populate the descriptions yourself**.

Use a structure such as:

```js
export const TRIZ_PRINCIPLES = [
  {
    id: 1,
    name: "Segmentation",
    canonicalDescription: [
      // TODO: USER_SUPPLIED_CANONICAL_DESCRIPTION
    ]
  },
  {
    id: 2,
    name: "Taking out",
    canonicalDescription: [
      // TODO: USER_SUPPLIED_CANONICAL_DESCRIPTION
    ]
  }
  // ...
];
```

The final structure must support multiple short statements per principle.

For example, after the researcher manually populates it later, a record may look like:

```js
{
  id: 1,
  name: "Segmentation",
  canonicalDescription: [
    "Divide an object into independent parts.",
    "Make an object easy to disassemble.",
    "Increase the degree of fragmentation or segmentation."
  ]
}
```

This example defines the intended **data format only**. Do not use it as permission to generate descriptions for the other principles.

The canonical descriptions must:

- be domain-neutral,
- describe the principle itself,
- contain no case-specific solution examples,
- be identical for every target model,
- come from one centralized data structure.

Do not invent additional case-specific explanations.

---

# 10. Classical TRIZ Contradiction Matrix

Create a centralized placeholder for the classical contradiction matrix.

Do **not** populate matrix cells from memory, internet search, LLM inference, or approximation.

Use a deterministic data structure such as:

```js
export const TRIZ_MATRIX = {
  // Format:
  // "<improvingParameterId>:<worseningParameterId>": [principleId, principleId, ...],

  // USER WILL POPULATE THE VERIFIED MATRIX DATA HERE.
};
```

Alternatively, if a 39×39 representation is architecturally cleaner, use that.

The essential requirements are:

- improving/worsening direction must remain explicit,
- each cell can contain zero or more principle IDs,
- lookup must be deterministic,
- no LLM may participate in the lookup,
- missing data must remain missing rather than being inferred.

---

# 11. Distinguish Missing Matrix Data from Verified Empty Cells

Do not silently treat missing reference data as a valid empty matrix cell.

The system must distinguish:

```text
VERIFIED EMPTY MATRIX CELL
```

from:

```text
MATRIX DATA HAS NOT YET BEEN ENTERED
```

Use an explicit representation if needed.

For example:

```js
function getPrinciplesForContradiction(improvingId, worseningId) {
  const key = `${improvingId}:${worseningId}`;

  if (!(key in TRIZ_MATRIX)) {
    return {
      status: "matrix_data_missing",
      principles: []
    };
  }

  return {
    status: "ok",
    principles: TRIZ_MATRIX[key]
  };
}
```

Do not automatically repair or infer missing matrix entries.

---

# 12. Replace LLM-Based Principle Selection

The current LLM-based principle-selection behavior must no longer determine the candidate principles used in the experiment.

Replace:

```text
contradictions
→ GPT-5.4-mini
→ proposed principles
```

with:

```text
exact contradiction pair
→ deterministic classical TRIZ matrix lookup
→ principle IDs
```

The lookup must be deterministic.

Do not ask an LLM to infer matrix entries.

---

# 13. Preserve Per-Contradiction Principle Provenance

For each contradiction, compute and internally preserve:

```json
{
  "contradictionId": "C1",
  "improvingParameterId": 3,
  "worseningParameterId": 5,
  "matrixPrinciples": [1, 5, 6]
}
```

This information is important for research logging.

However:

**Do not show the target LLM which principle came from which contradiction.**

The LLM should receive:

- all contradiction pairs
- the union candidate principle set

but not:

```text
C1 → Principles 1, 5, 6
C2 → Principles 3, 6, 7
```

That mapping is research metadata, not model guidance.

---

# 14. Candidate Principle Union

After matrix lookup:

1. collect principles from every contradiction,
2. combine them,
3. remove duplicates,
4. sort them deterministically, preferably by ascending principle ID.

Example:

```text
C1 → 1, 5, 6
C2 → 3, 6, 7

Union → 1, 3, 5, 6, 7
```

The resulting union is the model's **closed candidate principle set**.

Do not invent principle IDs when matrix data is unavailable.

---

# 15. Corresponding TRIZ Principles UI

Below the contradiction rows, display:

```text
3. Corresponding TRIZ Principles
```

Show the deterministic union in a compact table.

Example:

| ID | Principle | Canonical Description |
|---|---|---|
| 1 | Segmentation | [researcher-supplied description] |
| 3 | Local Quality | [researcher-supplied description] |
| 6 | Universality | [researcher-supplied description] |

Keep the UI compact and readable.

The user should **not manually add arbitrary principles outside this set**.

The table should update automatically whenever contradiction rows change.

---

# 16. Canonical Description Handling

The UI and model prompt builder should retrieve descriptions only from:

```js
TRIZ_PRINCIPLES[...].canonicalDescription
```

There must be no fallback such as:

- asking an LLM for the meaning,
- generating a description dynamically,
- searching externally,
- using a model's internal knowledge.

If a candidate principle has no canonical description entered yet, flag it clearly in the UI as:

```text
Canonical description not yet provided
```

and prevent a production/research run if canonical descriptions are required for that experiment.

---

# 17. Closed Principle Set Rule

Target models must be explicitly instructed:

```text
Use only the candidate TRIZ inventive principles provided below.

Do not introduce, reference, or apply any TRIZ inventive principle outside this candidate set.
```

The model may choose any subset of the provided candidates.

It may use all candidates if genuinely necessary.

It may not use a TRIZ principle outside the union.

---

# 18. Principle Selection Policy

Add:

```text
4. Principle Selection Policy
```

Provide exactly two mutually exclusive options, visually similar to radio/selectable cards:

### Default

```text
Parsimonious Selection
```

### Alternative

```text
Minimal Principle Use
```

Only one may be active.

`Parsimonious Selection` must always be selected by default when a new case/session starts.

---

# 19. Parsimonious Selection Prompt Logic

Implement the conceptual instruction:

```text
Select a coherent subset of the provided candidate principles that is sufficient to adequately address every supplied contradiction.

Prefer fewer principles when a smaller subset provides equally complete and technically coherent coverage.

Do not use additional principles merely because they are available.

However, do not sacrifice contradiction coverage, solution coherence, or technical adequacy simply to reduce the number of principles.

Use all provided candidate principles if they are genuinely necessary.
```

Priority:

```text
1. Full contradiction coverage
2. Technical coherence and adequacy
3. Parsimony
```

---

# 20. Minimal Principle Use Prompt Logic

Implement the conceptual instruction:

```text
Aim to adequately address every supplied contradiction using the smallest reasonably sufficient subset of the provided candidate principles.

A single principle may address multiple contradictions.

Add another principle only when the currently selected subset cannot adequately address one or more remaining contradictions.

Never leave a contradiction insufficiently addressed merely to reduce the principle count.
```

Priority:

```text
1. Full contradiction coverage
2. Smallest reasonably sufficient principle subset
3. Technical coherence
```

This is a **soft optimization objective**, not a mathematical proof of absolute minimum cardinality.

Do not phrase it as if the model must prove a globally minimal solution.

---

# 21. Contradiction Coverage Is Mandatory

For both selection policies:

```text
Every supplied contradiction must be adequately addressed.
```

The model must explicitly report how each contradiction is addressed.

A small principle subset is not considered successful if one or more supplied contradictions remain unresolved.

---

# 22. What the Solution Model Must See

Before generating a solution, every target model must receive the same logical information:

## A. Problem Definition A

Exact user-entered text.

## B. Source-reported contradiction pairs

Example:

```text
Contradiction C1
Improving TRIZ Parameter:
12 — Shape

Worsening TRIZ Parameter:
32 — Ease of Manufacture
```

Repeat for every contradiction.

## C. Candidate principle union

For every candidate principle provide:

- principle ID
- principle name
- researcher-supplied canonical description

Example:

```text
1 — Segmentation

- Divide an object into independent parts.
- Make an object easy to disassemble.
- Increase the degree of fragmentation or segmentation.
```

## D. Selection policy

Either Parsimonious or Minimal.

## E. Closed-set rule

Explicitly state that no other inventive principle may be used.

## F. Coverage requirement

Explicitly state that every supplied contradiction must be addressed.

---

# 23. What the Solution Model Must NOT See

Do not expose:

- Problem Definition B
- output from Contradiction Identification
- source paper solution
- author-selected final solution
- contradiction → individual matrix-principle mapping
- any previous model's output
- previous request history
- unused hidden research annotations
- any LLM-generated principle recommendation from the old `/matrix` workflow

---

# 24. Structured Solution Response

Update the solution-generation prompt and parser so each model returns a strict structured response.

Preferred structure:

```json
{
  "selectedPrinciples": [
    {
      "id": 6,
      "name": "Universality"
    }
  ],
  "contradictionCoverage": [
    {
      "contradictionId": "C1",
      "addressedByPrincipleIds": [6],
      "explanation": "..."
    }
  ],
  "principleApplication": [
    {
      "principleId": 6,
      "application": "..."
    }
  ],
  "solution": "..."
}
```

Requirements:

- `selectedPrinciples` must be a subset of candidate principles.
- Every selected principle ID must correspond to the provided canonical set.
- `contradictionCoverage` must contain every supplied contradiction ID.
- `addressedByPrincipleIds` must use only selected candidate principles.
- `principleApplication` must explain how the chosen principle is concretely implemented.
- `solution` must provide one coherent final technical solution.

Do not require the model to list unused principles unless useful for internal logging.

---

# 25. Validate Structured Solution Output

Add deterministic validation after model output.

At minimum validate:

1. JSON/schema validity
2. no principle outside candidate union
3. every `selectedPrinciple` exists in candidate union
4. every supplied contradiction appears in `contradictionCoverage`
5. coverage references only selected candidate principles
6. required fields are present

If validation fails:

- preserve the raw response,
- record the validation error,
- optionally perform at most one deterministic formatting/repair pass if necessary,
- do not silently invent missing reasoning or principles.

If a repair pass changes the response, log both original and repaired output.

---

# 26. TAB 2 — Contradiction Identification

Create a second tab:

```text
Contradiction Identification
```

This task must use:

```text
Problem Definition B
```

and must be completely separate from Solution Generation.

---

# 27. Problem Definition B

The tab should contain:

```text
1. Problem Definition B
```

Problem Definition B is a pre-TRIZ natural technical problem narrative where relevant trade-offs remain naturally expressed in ordinary technical language.

The model must not receive source-reported contradictions.

---

# 28. New Contradiction Identification Endpoint

Do not repurpose `/matrix`.

Do not use the existing solution-generation prompt.

Create a dedicated endpoint, for example:

```text
POST /identify
```

Suggested logical payload:

```json
{
  "caseId": "AM_CPU_FAN_01",
  "problem": "...",
  "model": "...",
  "seed": null
}
```

The endpoint should call each selected model independently.

No Task 1 result may be automatically transferred into Solution Generation.

---

# 29. Contradiction Identification Prompt

The model's task is:

```text
Identify the TRIZ contradictions present in the supplied technical problem.

Infer contradictions from the problem itself.

Do not invent contradictions that are not supported by the text.
```

For every proposed contradiction request:

- improving aspect in natural language
- worsening aspect in natural language
- improving TRIZ parameter ID and name
- worsening TRIZ parameter ID and name
- contradiction type where applicable
- concise evidence/justification grounded in Problem Definition B

The model should be allowed to identify zero, one, or multiple contradictions.

Do not force a fixed number.

---

# 30. Structured Contradiction Output

Use a strict structure such as:

```json
{
  "contradictions": [
    {
      "improvingAspect": "...",
      "worseningAspect": "...",
      "improvingParameter": {
        "id": 12,
        "name": "Shape"
      },
      "worseningParameter": {
        "id": 32,
        "name": "Ease of Manufacture"
      },
      "contradictionType": "technical",
      "evidence": "..."
    }
  ]
}
```

Validate parameter IDs against the centralized classical 39-parameter list.

Do not automatically compare with expert/source-reported contradictions inside the model prompt.

That comparison belongs to later research analysis.

---

# 31. Keep Both Tasks Stateless

No shared LLM context.

No:

- conversation history
- thread ID
- previous response
- cached model output
- previous contradiction prediction
- automatic transfer between tabs

Each request must be a fresh model call.

The UI may share `Case ID` and experiment settings, but not generated model content.

---

# 32. Model Calls

Continue to support the project's target model set through OpenRouter.

For each task:

- construct one independent request per model,
- preserve the same logical task input across models,
- only model/provider-specific API syntax may differ.

Concurrency may remain limited for rate protection if necessary.

Do not compare latency unless concurrency is explicitly controlled.

---

# 33. Prompt Construction Must Be Explicit and Inspectable

Move task prompts/templates into clearly named functions/constants rather than scattering them through bundled logic.

Examples:

```text
buildSolutionPrompt()
buildContradictionIdentificationPrompt()
```

Prompt construction must be readable in source.

The research log should preserve either:

- the exact final prompt,
or
- enough deterministic input/template information to reconstruct it exactly.

---

# 34. Remove Experimental Dependency on the Existing LLM-Based `/matrix`

The old `/matrix` endpoint currently asks GPT to recommend principles.

That behavior must **not participate in the main research workflow**.

Options:

- remove it from the UI,
- deprecate it,
- or leave it only as a non-experimental legacy feature.

The Solution Generation experiment must use deterministic classical matrix lookup only.

Do not allow GPT-5.4-mini or any other language model to select the initial candidate principle pool.

---

# 35. Research Logging

Implement automatic logging for every model call.

Use **JSONL as the primary archival format** because nested contradictions/principles must be preserved.

Each run should capture, where applicable:

```json
{
  "caseId": "...",
  "taskType": "solution_generation | contradiction_identification",
  "timestamp": "...",

  "model": "...",
  "provider": "...",

  "problemDefinitionType": "A | B",
  "problemDefinition": "...",

  "sourceReportedContradictions": [],

  "contradictionMatrixMappings": [],
  "candidatePrincipleUnion": [],

  "selectionPolicy": "parsimonious | minimal",

  "reasoningEffort": "medium",
  "maxOutputTokens": 2500,

  "requestedSeed": null,
  "seedApplied": false,

  "requestPayload": {},
  "finalPrompt": "...",

  "rawResponse": "...",
  "parsedResponse": {},

  "validationStatus": "...",
  "validationErrors": [],

  "error": null
}
```

Do not expose API keys, Worker tokens, OpenRouter keys, or other secrets in logs.

---

# 36. Export

Provide a simple researcher-facing export action.

At minimum support:

```text
Export JSONL
```

Optionally support CSV for flattened analysis data.

JSONL is the authoritative format.

---

# 37. Reference Data Validation

Add a reference-data validation function capable of reporting:

- missing parameter entries,
- missing principle names,
- missing canonical principle descriptions,
- missing matrix mappings,
- invalid principle IDs referenced by matrix cells,
- duplicate IDs,
- malformed matrix keys.

Do not automatically repair reference data.

Report the problem so the researcher can correct the source data manually.

---

# 38. Development vs Research-Ready State

The application may run in a development state with incomplete placeholders.

However, before a real research run, provide a validation status such as:

```text
TRIZ Reference Data
Parameters: READY
Principle Names: READY
Canonical Descriptions: INCOMPLETE
Contradiction Matrix: INCOMPLETE

Research Run: BLOCKED
```

A real Solution Generation run should be blockable when required TRIZ reference data for the selected contradictions is incomplete.

---

# 39. UI Requirements

Keep the current application visually consistent.

Avoid a complete visual redesign.

Focus on clarity and compactness.

Desired structure:

## Global area

```text
Case ID
Experiment Settings
  - Optional Seed
  - Reasoning effort: Medium
  - Max output tokens: 2500
```

## Tab 1

```text
Solution Generation

1. Problem Definition A

2. Contradictions

   [Improving Parameter] [Worsening Parameter] [+]
   [Improving Parameter] [Worsening Parameter] [-]

3. Corresponding TRIZ Principles

   compact deterministic union table

4. Principle Selection Policy

   (●) Parsimonious Selection
   ( ) Minimal Principle Use

5. Generate Solutions

   model comparison results
```

## Tab 2

```text
Contradiction Identification

1. Problem Definition B

2. Identify Contradictions

   model comparison results
```

---

# 40. Preserve Research Independence in the UI

Switching tabs must not automatically populate one task with model-generated content from the other.

If the same `Case ID` is used, that is only metadata association.

Problem Definition A and Problem Definition B must remain separate fields.

---

# 41. Do Not Introduce Hidden AI Preprocessing

Do not use an LLM to:

- rewrite Problem A
- rewrite Problem B
- refine contradictions
- rank candidate principles
- reduce candidate principles before the target model sees them
- translate contradiction pairs into another representation
- fill missing principle descriptions
- fill missing contradiction-matrix entries

unless explicitly requested later.

The experimental input must remain transparent.

---

# 42. Tests

Add or perform focused tests for the critical research logic.

At minimum verify:

### Contradiction pair semantics

Two rows:

```text
3 → 5
6 → 8
```

must produce exactly two contradictions, not:

```text
3→5
3→8
6→5
6→8
```

### Matrix determinism

Identical contradiction input must always produce identical candidate principle union.

### Missing vs empty matrix cells

A missing/unentered matrix cell must not be treated as a verified empty cell.

### Deduplication

If:

```text
C1 → 1,5,6
C2 → 3,6,7
```

the result must be:

```text
1,3,5,6,7
```

### Closed-set validation

If a model outputs a principle outside the candidate union, validation must fail.

### Coverage validation

If any supplied contradiction is absent from `contradictionCoverage`, validation must fail.

### Canonical description validation

A research run must be blocked if any candidate principle lacks a researcher-supplied canonical description.

### Task isolation

Running Contradiction Identification before Solution Generation must not alter the latter's request payload or prompt.

### Model equality

Within the same task, logical experiment inputs must be identical across models except for model/provider-specific API mechanics.

---

# 43. Implementation Strategy

Work incrementally.

Recommended sequence:

1. Refactor centralized TRIZ reference data.
2. Create placeholders for canonical descriptions and contradiction matrix.
3. Add reference-data validation.
4. Implement deterministic contradiction matrix lookup.
5. Replace contradiction selection UI with explicit rows.
6. Implement candidate principle union.
7. Add canonical-description rendering.
8. Implement selection-policy UI and prompts.
9. Refactor `/solve` and response schema.
10. Add structured validation.
11. Add second tab.
12. Implement `/identify`.
13. Add logging/export.
14. Add optional seed support.
15. Run regression and research-logic tests.

Do not combine unrelated changes into opaque large edits if they can be separated.

---

# 44. Important Constraint About Existing `worker.js`

The repository currently contains a bundled/compiled Worker artifact rather than the original build source/toolchain.

Before editing Worker logic:

- inspect whether the bundled file can be safely maintained,
- avoid blindly patching generated code if a cleaner maintainable source file can be introduced,
- if necessary, create a clean Worker source architecture while preserving current deployment behavior,
- do not break authentication, CORS, rate limiting, or OpenRouter integration.

If deployment configuration is missing, state clearly what must be supplied by the user rather than inventing values.

Never expose existing secrets.

---

# 45. Completion Report

After implementing the changes, provide:

## A. Files changed

List every modified/new file and purpose.

## B. New architecture

Explain the final flow concisely.

## C. Solution Generation request flow

Show exactly what reaches each target model.

## D. Contradiction Identification request flow

Show exactly what reaches each target model.

## E. TRIZ data source

Explain where:
- parameters
- principles
- canonical descriptions
- classical matrix

are stored.

Clearly identify which fields remain researcher-supplied placeholders.

## F. Experimental safeguards

Confirm:
- deterministic matrix lookup
- closed principle set
- full contradiction coverage
- task independence
- common reasoning effort
- max output tokens
- optional seed handling
- no LLM-generated matrix data
- no LLM-generated canonical descriptions

## G. Remaining uncertainties

Especially provider-specific seed support or missing deployment configuration.

## H. Tests performed

Report which critical tests passed or failed.

---

# Final Principle

The core experiment must enforce this design:

```text
Researcher/source fixes the contradictions
        ↓
Researcher-supplied classical TRIZ matrix deterministically fixes the candidate principle space
        ↓
All candidate principles are shown with the same researcher-supplied canonical definitions
        ↓
Target LLM chooses a subset according to the selected policy
        ↓
Target LLM must address every supplied contradiction
        ↓
Target LLM generates the technical solution
```

No separate LLM may act as an upstream principle selector.

No LLM may search for, infer, generate, complete, or repair the classical TRIZ matrix or the canonical principle descriptions.

Treat TRIZ reference knowledge as **research data supplied by the researcher**, not as information the application is allowed to generate.

The software should provide the schema, placeholders, deterministic processing logic, validation, and UI integration.

Do not introduce hidden model-generated preprocessing between the research input and the target model.
