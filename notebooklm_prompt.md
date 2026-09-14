# NotebookLM Ground-Truth Prompt Template

Her case için, sitedeki "Corresponding TRIZ Principles" tablosunda gördüğün
aday prensip listesini ve seçtiğin çelişkileri aşağıdaki yer tutuculara
doldurup NotebookLM'e (ilgili makale kaynak olarak eklenmiş chat'te) yapıştır.

---

You have access to the source paper(s) for this case. Based only on what the
paper actually describes as the real-world solution, answer the following.

Problem Description:
{PROBLEM_DESCRIPTION}

The following contradictions were identified for this problem:
{CONTRADICTION_LIST}
(format: "Contradiction C1 — Improving: <parameter name> / Worsening: <parameter name>")

The following is the set of candidate TRIZ inventive principles associated
with these contradictions:
{CANDIDATE_PRINCIPLES_LIST}
(format: "<id> — <principle name>: <canonical description>")

Task:
Identify which of the above candidate principles were actually embodied in
the paper's real solution, and how. Then write up the paper's actual solution
following these strict requirements:

- Write it as a neutral, humanized engineering write-up — as if it were the
  Solution or Implementation section of a technical report written by the
  engineer who solved the problem.
- Do NOT mention TRIZ, inventive principles (by name or number), contradictions,
  parameters, matrices, or any analytical framework. Describe only the concrete
  engineering solution and its rationale, in plain domain language, as if the
  ideas originated from ordinary engineering reasoning.
- Do NOT cite the paper, the authors, page numbers, or use phrases like
  "the study found," "according to the paper," "the authors propose." Write
  it in the same voice as if you were the engineer describing your own work,
  not someone summarizing a source.
- Do NOT use headings, bullet points, numbered lists, or markdown formatting.
  Write one continuous flowing paragraph or a few connected paragraphs of prose.
- Do NOT add meta-commentary about NotebookLM, AI, or the extraction process.
- Target roughly 150-300 words.

Output only the write-up text, nothing else.

---

## Notlar

- `{CONTRADICTION_LIST}` ve `{CANDIDATE_PRINCIPLES_LIST}` her case için
  sitedeki adımlardan (2. Contradictions, 3. Corresponding TRIZ Principles)
  birebir kopyalanmalı — böylece hem AI modellerine hem NotebookLM'e aynı
  girdi verilmiş olur, kıyas adil kalır.
- Bu şablonla üretilen metin, worker'ın ürettiği `solution` alanıyla aynı
  üslup kısıtlarına tabi (TRIZ jargonu yok, başlık/madde yok, AI ifadesi yok,
  150-300 kelime) — kör karşılaştırmada ikisi de aynı "şekilde" görünmeli.
