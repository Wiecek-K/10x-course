# Analiza skilla 10x-shape — Wyjaśnienie po polsku

## Sekcje w tym raporcie

1. **Problem & Purpose** — Po co skill istnieje i jaki ból usuwa
2. **Chain Position** — Gdzie siedzi w workflow: co wchodzi, co wychodzi
3. **Anatomy Walkthrough** — Sekcja po sekcji mapa SKILL.md
4. **Key Mechanics** — Co napędza to, że skill działa; części o dużej dźwigni
5. **Design Decisions** — Dlaczego zbudowany tak, a nie inaczej; odrzucone alternatywy
6. **Adaptation Guide** — Co można zmienić (easy/medium/hard) z konkretnymi przykładami
7. **Building Something Similar** — Krok po kroku: od pustego pliku do working skilla

---

## 1. Problem & Purpose

### Po co skill istnieje?

Przed 10x-shape użytkownicy mieli problem: **mieli pomysł na produkt lub zmianę w systemie, ale nie wiedzieli, jak go sstrukturyzować, zanim napisali kod.**

Wynik: produkty budowane bez jasnej wizji → scope creep → niekończące się projekty → zbyt duże MVP.

### Ból, który usuwa

**Brak struktury** w fazie odkrywania:
- Jaki problem naprawdę rozwiązujesz?
- Dla kogo? (jakaś persona, nie "wszyscy")
- Jakie jest MVP? (najmniejszy flow, który coś dokazuje)
- Jakie są functional requirements?
- Jakie są constraints?
- Jak duży jest ten projekt naprawdę?

Bez tego — idysz w implementację z pustą głową. Z tym — masz `shape-notes.md`, dokument, który inputs do `/10x-prd` (który genuje formalny PRD).

### Kiedy go używać?

✅ **USE**:
- Zupełnie nowy projekt (greenfield)
- Zmiana w istniejącym systemie — nowy moduł, duża feature, architekturalna poprawa (brownfield)
- Wznowienie wcześniejszej sesji shaping'u

❌ **SKIP**:
- PRD już istnieje (użyj `/10x-frame` lub `/10x-plan`)
- Single bug / mała refaktoryzacja w istniejącym kodzie (użyj `/10x-frame` — to lighter-weight)

---

## 2. Chain Position

### Workflow: gdzie siedzi 10x-shape?

**Greenfield chain**:
```
/10x-init → /10x-shape → /10x-prd → /10x-tech-stack-selector → /10x-bootstrapper
```

**Brownfield chain**:
```
/10x-init → /10x-shape → /10x-prd → /10x-stack-assess → /10x-health-check
```

### Handoff model

- **Input upstream**: nic (lub opcjonalnie: notes z `-@path`). `/10x-init` tworzy scaffold (`context/foundation/`), `/10x-shape` go konsumuje.
- **Output**: `context/foundation/shape-notes.md` — dokument z frontmatter'em (`checkpoint`, `context_type`, `project`) i 6+ sekcjami bodycontent.
- **Downstream**: `/10x-prd` czyta `shape-notes.md` i genuje `context/foundation/prd.md` (formalny PRD zgodny ze locked schema).

### Handoff key

- **Shape-notes** to not-a-PRD — to notes z diskusji, checkpoint'ami (które fazy skończone), quality warnings.
- **/10x-prd** to document generator — czyta shape-notes, mapuje do PRD schema, produkcuje `prd.md`.
- **Razem** tworzą "two-pass system": najpierw discovery (shape), potem formalny dokument (prd).

---

## 3. Anatomy Walkthrough

**10x-shape** to 746-liniowy skill. Struktura:

| Sekcja | Linie | Co robi | Dlaczego ważne |
|--------|-------|---------|----------------|
| Frontmatter YAML | 1–24 | Name, description, argument-hint, allowed-tools | `description` kontroluje trigger phrases; `allowed-tools` to security boundary — skill nie może robić niczego nieostrożnie |
| Role statement | 26 | Jednozdaniowa filozofia: "facilitator, not generator" | Ustawia personality — skill pyta, nie wymyśla |
| When to use / skip | 34–38 | Warunki kiedy invokować; kiedy pominąć i użyć innego skilla | Prevents misuse — skill ma jasne boundary'i |
| Relationship to other skills | 40–47 | Links do `/10x-init`, `/10x-prd`, `/10x-frame`, `/10x-stack-assess` | Posycjonuje skill w ecosystem; pokazuje co upstream, co downstream |
| Initial Response | 49–70 | Co robić na start: arg capture, file read, lub ask for seed idea | First impression — jak skill greets user |
| **Process** (CORE) | 72–620 | 8 Step'ów discovery (Steps 0–8) | Cały algorytm — tu się dzieje magia |
| Critical guardrails | 722–737 | 8 hard rules (facilitator, schema, stack openness, anti-patterns, soft gate, mode-aware, universal language, resume) | Prevents failure modes — każdy guardrail ma konkretną przyczynę |
| Notes | 740–746 | Meta-notes o skill'u | Context dla maintainerów |

### Core: Process — 8 Steps breakdown

```
Step 0:   Check context/foundation/ exists → ask /10x-init if missing
Step 0.5: Resume detection — check czy shape-notes.md już exists
Step 0.7: Context type detection — greenfield or brownfield? (auto-detect via git/lockfiles)
Step 1:   Vision & Problem (+ brownfield: Current System)
Step 2:   Access Control
Step 3:   MVP Discipline + Timeline
Step 4:   Functional Requirements & User Stories
Step 4.5: Socrates Challenge — one counter-argument per FR
Step 5:   Business Logic & Non-Functional Requirements
Step 6:   Product Framing (product_type, target_scale, timeline_budget, Non-Goals)
Step 7:   Quality Cross-Check (soft gate — warns but allows override)
Step 8:   Hand-off (copy `/10x-prd` to clipboard, STOP — nie chain automatically)
```

Każdy step:
- Otwiera się z pytaniem otwartym
- Wyłapuje gray areas (AskUserQuestion multi-select)
- Locks decision back to user (one-line summary confirm)
- Pisze sekcję do `shape-notes.md`
- Bumps `checkpoint.current_phase` i `checkpoint.phases_completed`

---

## 4. Key Mechanics

### Mechanic #1: Discovery Pattern (applies to Steps 1–6)

**Jak działa**: Każda faza discovery'ego idzie w loop: Open → Surface gray areas → Recommend → Lock → Write

```
1. Open z pytaniem otwartym (BMAD facilitator stance)
   ↓
2. Surface 3–5 gray areas (AskUserQuestion multi-select, where applicable)
   ↓
3. Mark one option "(Recommended)" — first option, plus "Not sure" fallback
   ↓
4. Lock decision — one-line summary user confirms
   ↓
5. Write to shape-notes.md + bump checkpoint
```

**Gdzie**: Steps 1–6 (linie 259–620) — każdy step to ta sama pattern z inną contentem.

**Leverage**: High. Gdybyś zmienił tę pattern (np. "auto-commit bez lock"), porami user'a nie będą load-bearing — skill będzie wymyślać zamiast pytać.

---

### Mechanic #2: Context-Type Auto-Detection (greenfield vs brownfield)

**Jak działa**: Step 0.7 (linie 144–239) skanuje cwd przez 3 tiers sygnałów:
- **Tier 1 (strong)**: git history (`git log` returns non-zero exit)
- **Tier 2 (strong)**: lockfiles (`package-lock.json`, `Cargo.lock`, etc.)
- **Tier 3 (weak)**: manifest files alone (`package.json` bez lockfile'u)

Scoring:
- T1 lub T2 hit → brownfield (high confidence)
- T3 only → ambiguous (flag it: "could be fresh init")
- No hits → greenfield

Dann asks user to confirm.

**Gdzie**: Step 0.7, linie 144–239.

**Leverage**: Critical. Context type (`greenfield` vs `brownfield`) controls phase behavior dla całego reszty discovery'ego. Greenfield pyta "what are you building", brownfield pyta "what exists, what's changing, what must preserve". Inversion całego framing'u.

---

### Mechanic #3: Resume with Checkpoint Tracking

**Jak działa**: Step 0.5 (linie 100–142) czyta frontmatter `checkpoint:` block z prior session:

```yaml
checkpoint:
  current_phase: 4
  phases_completed: [1, 2, 3]
  frs_drafted: 7
  quality_check_status: pending
```

Na resume:
- Summarize each completed phase in 1–2 sentences (don't replay)
- Jump directly to next unfinished phase
- Continue from there

**Gdzie**: Step 0.5, linie 100–142.

**Leverage**: Medium-high. Pozwala user'ovi wznowić bez repeatacji — ważne dla wielosesyjnych projektów. Bez tego, wielosesyjna praca byłaby frustrująca (replay'owanie decisions).

---

### Mechanic #4: Anti-Pattern Detection (empty-CRUD, MVP-too-big)

**Jak działa**:

**Empty-CRUD** (Step 5, linie 502–525): Jeśli business logic user'a to "users can add/view/update/remove records", skill **names this by name**: "You've described a CRUD list — that's a known anti-pattern. CRUD without a domain decision means your app provides no value the user couldn't get from a spreadsheet."

Dann surface common rule shapes (recommendation, prioritization, classification, validation, scoring, workflow, calculation) i ask user to pick one.

**MVP-too-big** (Step 3, linie 354–379): Jeśli MVP flow > ~6 user actions OR timeline > ~3 weeks after-hours, surface the cost explicitly:

```
This is bigger than what typically ships in three weeks of after-hours work.
Two valid paths from here:
  - Scope down (Recommended)
  - Commit to longer timeline (understand the cost)
```

Ask with AskUserQuestion, force user'ow to pick deliberately.

**Gdzie**: Empty-CRUD w Step 5 (linie 502–525); MVP-too-big w Step 3 (linie 354–379).

**Leverage**: High. Skill prevents hollow products (empty CRUD) i abandoned projects (MVP too big without acknowledgment). Anti-patterns named by name — nie generic "your idea has issues" warnings.

---

### Mechanic #5: Soft-Gate Quality Cross-Check (Step 7)

**Jak działa**: Step 7 (linie 622–676) sprawdza 6 elementów (greenfield) czy 7 (brownfield):

1. Access Control present?
2. Business Logic (one-sentence rule)?
3. Project artifacts (shape-notes.md exists)?
4. Timeline-cost acknowledged?
5. Non-Goals present?
6. Preserved behavior (brownfield only)?

Dla każdego missing/weak — **list by name** z one-line consequence: "Business Logic: not captured as a one-sentence rule — your PRD will be hollow without a domain decision."

Dann ask: "Address gaps now? Accept and finish? Restart phase N?"

**Gdzie**: Step 7, linie 622–676.

**Leverage**: High. Soft gate (warns, not blocks) prevents shipping hollow docs. But user can override — choice is theirs. Quality check status (`warned` vs `accepted`) jdzie do checkpoint, `/10x-prd` go czyta.

---

## 5. Design Decisions

### Decyzja #1: Two-Pass System (Shape → PRD)

**Wybór**: Skill tworzy `shape-notes.md` (notes z discovery), nie `prd.md` (formalny dokument).

**Alternatywa odrzucona**: Mogliśmy genować prd.md direktnie w tym skilla.

**Dlaczego this way wins**: 
- Separacja concern'ów: discovery (10x-shape) jest messy, iteracyjne; PRD (10x-prd) jest formalny, schema-locked
- User'e może edit'ować shape-notes ręcznie między sessions (text file, nie generated)
- `/10x-prd` mniej musi znać o discovery process — czyta shape-notes, mapuje do schema, done
- Checkpoint tracking w shape-notes (które fazy, quality status) to audit trail — PRD nie musi o tym wiedzieć

---

### Decyzja #2: Facilitator, Not Generator

**Wybór**: Skill nigdy nie wymyśla domain content. Pyta, jeśli brakuje.

**Alternatywa odrzucona**: Mogliśmy genować "placeholder" vision, FRs, business logic basado na seed idea.

**Dlaczego this way wins**:
- Generated content jest hollow — user mówi "yeah, that works" ale nie myśli głębok
- Facilitator stance (pytanie → listen → lock) forces user'ę to think
- Artifact (shape-notes.md) jest authoritative source of truth dla user'a; generated content by definition nie jest
- Downstream skills (`/10x-prd`, `/10x-tech-stack-selector`) mogą ufać że content w shape-notes je user-validated

---

### Decyzja #3: Context-Type Auto-Detection (not user choice)

**Wybór**: Skill detects greenfield vs brownfield automatically (git history, lockfiles), asks user to confirm.

**Alternatywa odrzucona**: Mogliśmy ask "greenfield or brownfield?" upfront bez detection.

**Dlaczego this way wins**:
- Autodetection catches the common case (existing project = brownfield obvious) bez extra Q&A
- User confirmation prevents misdetection (ambiguous cases — manifest only — user can override)
- Detection signal are Tier-ed (T1 strongest → T2 → T3 weakest) so we can raise ambiguity only when it's real
- Different phase behavior (greenfield vs brownfield) is so radical (opening questions, persona scope, preserved-behavior tracking) że detection mitigates user confusion

---

### Decyzja #4: Soft Gate (warning, not blocker)

**Wybór**: Quality cross-check w Step 7 warns o missing elements, ale nie blocks finish.

**Alternatywa odrzucona**: Mogliśmy require all 6/7 elements present przed finish.

**Dlaczego this way wins**:
- Real projects haben gray areas. Hard gate byłaby frustrating (user: "wiem, że biznes logic brakuje, ale chciałbym iść dalej anyway").
- Soft gate lets user make conscious choice — override is recorded (`quality_check_status: warned`) i surfaced w `/10x-prd`'s `## Open Questions`
- `/10x-prd` może handle'ować warned status (ask user to fill gaps later, nie blok)
- Jeśli user ignores warnings i later regrets — to ich fault, nie skill'u; choice was recorded

---

### Decyzja #5: Schema is the Contract (not flexible format)

**Wybór**: Shape-notes sekcje mapują na locked PRD schema (`references/prd-schema.md`). Skill enforces exact section names, field names, checkpoint keys.

**Alternatywa odrzucona**: Mogliśmy let user customize section names, reorder, skip sections.

**Dlaczego this way wins**:
- `/10x-prd` relies na exact section names — jeśli shape-notes zmienia names, `/10x-prd` loses sync
- Locked schema makes shape-notes machine-readable (downstream tools mogą grep/parse reliably)
- User flexibility (custom sections) = downstream brittleness (every tool musi handle variants)
- Cost: slightly rigid, ale benefit (chain reliability) beats flexibility here

---

### Decyzja #6: No Stack Questions (product-level only)

**Wybór**: Skill nigdy nie pyta o framework, database, language, deployment. PRD captures product-level fields only: `product_type`, `target_scale`, `timeline_budget`.

**Alternatywa odrzucona**: Mogliśmy ask "what tech stack do you prefer?" tutaj w discovery.

**Dlaczego this way wins**:
- Stack decisions powinny być informowane by PRD (product constraints) + team context + team skills. Pytanie tutaj (pre-PRD) lock'uje user'a w choice zanim ma full picture
- `/10x-tech-stack-selector` (downstream) reads PRD as input + runs interview. Jeśli user już committed to stack — interview becomes theater, nie discovery
- PRD jest product-level artifact; tech stack jest implementation-level. Mixing them violates separation of concerns
- If user volunteers tech preferences, skill captures them w shape-notes' `## Forward: tech-stack` block (informational, not PRD-mapped)

---

## 6. Adaptation Guide

### Easy (low risk, immediate effect)

**Co zmienić**: Trigger phrases w `description` field, pytania w discovery phases, option labels w AskUserQuestion.

**Przykład**: 
```yaml
# Obecne (linia 10–13):
"new project", "from scratch", "starting an app", "od pomysłu", "shape an idea",
"brainstorm a product", "greenfield", "I have an idea"

# Zmieniony (np. dodaj trigger dla konkretnego użytkownika):
"new project", "from scratch", "shape an idea", "zaplanuj MVP", "odkryj produkt"
```

**Co się złamie?** Nic poważnego. Skill aktywuje w różnych momentach, ale comportement logiki remainuje ten sam.

---

**Przykład #2**: Zmień opening question w Step 1 (greenfield)
```
# Obecna (linia 265):
"Let's start with the pain. In one or two sentences — who has it, what's the moment they feel it, what does it cost them today?"

# Zmieniona (bardziej direct):
"What's the core problem you're solving? Who has it, when do they feel it, what's the cost today?"
```

**Co się złamie?** Nic — user may give different depth of answer, ale Step 1 processuje to samo.

---

### Medium (requires understanding chain)

**Co zmienić**: Anti-pattern detection criteria, quality gate rules, liczba gray-area questions, benchmark'ów (np. "3 weeks" → "2 weeks").

**Przykład #1**: Zmień MVP-too-big threshold (Step 3, linie 354–356)
```
# Obecna:
"If the flow has more than ~6 distinct user actions before producing value, OR 
the user's own estimate exceeds ~3 weeks of after-hours work, OR the flow requires 
multiple integrations…"

# Zmieniona (dla małych team'ów, increase threshold):
"If the flow has more than ~8 user actions OR exceeds ~4 weeks…"
```

**Co się złamie?** Skill będzie less aggressive w scope-down recommendations. Może user'e commit'ną się do bigger MVP, które się nie skończy. Risk: niedostarczenie.

---

**Przykład #2**: Zmień quality gate rules (Step 7, linie 627–633)

Obecne checks:
```
1. Access Control present?
2. Business Logic (one-sentence rule)?
3. Project artifacts?
4. Timeline-cost acknowledged?
5. Non-Goals present?
6. Preserved behavior (brownfield only)?
```

Zmieniona (dodaj "User Stories required"):
```
1. Access Control present?
2. Business Logic (one-sentence rule)?
3. Project artifacts?
4. Timeline-cost acknowledged?
5. Non-Goals present?
6. User Stories (minimum 1)?  ← NEW
7. Preserved behavior (brownfield only)?
```

**Co się złamie?** `/10x-prd` może expect minimum user stories, musisz update'ować `/10x-prd` schema + requirements too.

---

### Hard (structural, risk of breaking chain contracts)

**Co zmienić**: Allowed-tools list, output file format, section names, checkpoint keys, handoff sequence.

**Przykład #1**: Zmień output path
```
# Obecna (Step 8 writes to):
context/foundation/shape-notes.md

# Zmieniona (np. per-phase files):
context/foundation/shape/phase-1.md
context/foundation/shape/phase-2.md
…
```

**Co się złamie?** `/10x-prd` hardcodes path check:
```
if not file_exists("context/foundation/shape-notes.md"):
  ask user to run /10x-shape first
```

Jeśli zmienisz path → `/10x-prd` won't find notes → refuses to start. Musisz update `/10x-prd` to read from new path.

---

**Przykład #2**: Zmień `checkpoint:` field names
```
# Obecne frontmatter:
checkpoint:
  current_phase: 4
  phases_completed: [1, 2, 3]
  frs_drafted: 7
  quality_check_status: pending

# Zmieniona (np. rename phases_completed → completed_phases):
checkpoint:
  current_phase: 4
  completed_phases: [1, 2, 3]  ← RENAMED
  frs_drafted: 7
  quality_check_status: pending
```

**Co się złamie?** Step 0.5 (resume detection, linia 110) parsuje frontmatter:
```
Extract: `current_phase`, `phases_completed`, `frs_drafted`, `quality_check_status`
```

Jeśli zmieniš key name → Step 0.5 fails parsing → resume breaks. Musisz update Step 0.5 + all step'ów które bump `phases_completed`.

---

## 7. Building Something Similar

### Short path: konwersacyjny (fastest for personal skills)

Jeśli budujesz skill dla siebie, czasami wystarczy:

1. Otwórz convo z Claude
2. "Let's build a skill that does X" (describe intent)
3. Iterate on SKILL.md wersje — 3–4 rounds
4. Test w Claude Code
5. Deploy

**Wniosek**: Fast iteration, nie formalny proces.

---

### Structured path: od zera do working skilla

Jeśli budujesz skill, który będzie shared lub chain-integrated (jak 10x-shape), ten proces:

---

#### **Step 1: Start with a prompt (not a SKILL.md)**

Zanim piszesz SKILL.md, napisz raw prompt (bez frontmatter'u). Test go w conversation. Robisz:

```
[user message]
I want to build a skill that: [intent]

[claude — raw prompt, no SKILL.md yet]
Understand the intent. Produce the core behavior. Iterate.

[after ~3 rounds]
Does this prompt produce roughly the right output? Yes → proceed. No → iterate.
```

**W 10x-shape**: Originalna prompt musiała capture discovery pattern, facilitator stance, anti-pattern detection. Warunkiem success: prompt produced coherent shape-notes z all required sections.

---

#### **Step 2: Create the SKILL.md skeleton**

```yaml
---
name: your-skill-name
description: >
  One-line description with trigger phrases.
  Phrases help Claude Code invoke skill when user types them.
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
---

# Your Skill Name

Brief intro: what this skill does (one sentence).

## When to use, when to skip

**Use when**: [concrete trigger conditions]
**Skip when**: [explicit non-goals]

## Relationship to other skills

- Upstream: what does this skill consume?
- Downstream: what consumes my output?

## Initial Response

What to do on first invocation.

## Process

Steps 1, 2, 3, … [your algorithm]

## Critical guardrails

[3–5 hard rules]
```

**W 10x-shape**: Frontmatter establishes name, trigger phrases (greenfield, brownfield, shape, od pomysłu), allowed-tools (Read, Write, Bash, AskUserQuestion, TaskCreate, TaskUpdate, Skill). Role statement (line 26): "Facilitator, not generator."

---

#### **Step 3: Implement the process**

Structure your algorithm as numbered steps. For each step:

- **Open** mit einer question
- **Ask** multi-select (AskUserQuestion) jeśli gray areas
- **Lock** user's decision back
- **Write** to output artifact
- **Bump** state (checkpoint, counters)

Keep steps modular. 10x-shape has 8 steps (0, 0.5, 0.7, 1–6); każdy ma clear input/output.

---

#### **Step 4: Build in guardrails**

What's the **worst** that could go wrong? Write 3–5 specific guardrails:

**10x-shape examples** (lines 722–737):
1. "Facilitator, not generator" — never generate domain content user didn't say
2. "Schema is the contract" — shape-notes must conform to locked prd-schema.md
3. "Stack openness is binding" — never ask about tech stack (product-level only)
4. "Anti-patterns are surfaced by name" — not generic warnings
5. "Soft gate, not hard gate" — warn but allow override
6. "Mode-aware behavior" — greenfield vs brownfield requires different questions
7. "Universal language only" — no 10xDevs / cohort language
8. "Resume preserves prior work" — summarize completed phases, don't replay

Każdy guardrail ma konkretny powód (failure mode it prevents).

---

#### **Step 5: Add scope boundaries**

Write a "What this skill does NOT do" section. 10x-shape example:

```
## Critical guardrails

5. Soft gate, not hard gate.
   The closing cross-check WARNS but allows the user to override every gap.
```

Explicit boundaries prevent scope creep.

---

#### **Step 6: Add references (if needed)**

Jeśli skill enforces a schema, template, czy registry — put te w `references/` directory.

**10x-shape**: has `references/prd-schema.md` (locked PRD format). Skill reads it at every checkpoint write.

Struktura:
```
.claude/skills/your-skill/
  ├── SKILL.md
  └── references/
      ├── schema.md
      ├── template.md
      └── registry.yaml
```

---

#### **Step 7: Add chain integration (if needed)**

Jeśli skill jest part of a chain:

- Define upstream input (what file it reads, which skill writes it)
- Define downstream output (what file it writes, which skill reads it)
- Add "Relationship to other skills" section
- Add "STOP, do not chain" to guardrails (skilled nigdy nie auto-chain'uje)

**10x-shape**: upstream = none (lub `.env.example` for context init), downstream = `/10x-prd` consumes `shape-notes.md`.

---

#### **Step 8: Add advanced patterns (if needed)**

Based on what your skill demonstrates, mention advanced patterns:

- **Sub-agent orchestration** — if skill spawns multiple agents
- **Complexity scaling** — if skill adapts to input size (like 10x-shape adapts greenfield/brownfield)
- **Self-review gates** — if skill validates own output (like Step 7 quality check)
- **Checkpoint-based resume** — if skill supports multi-session work
- **AskUserQuestion for interactive decisions** — if skill surfaces gray areas

**10x-shape** implementuje:
- ✅ Complexity scaling (greenfield vs brownfield modes)
- ✅ Self-review gates (Step 7 cross-check)
- ✅ Checkpoint-based resume (Step 0.5)
- ✅ AskUserQuestion throughout (every phase)

---

### Common mistakes to avoid

1. **Starting z advanced patterns zanim core behavior works** — Build Step 1 first, test, then add resume support.

2. **Writing guardrails too vague** — "be careful" ≠ useful guardrail. Write specifics: "NEVER auto-chain to the next skill; user runs /10x-prd when ready."

3. **Forgetting the scope-boundaries section** — Scope creep is #1 skill failure mode. Explicit "What this does NOT do" prevents it.

4. **Making `description` too broad or too narrow** — Too broad → activates on everything (noise). Too narrow → never activates (useless). Test trigger phrases w Claude Code.

5. **Não validating against downstream contracts** — If `/10x-prd` expects certain section names in shape-notes, build them correctly. Mismatch = downstream skill breaks silently.

---

## Summary: W jednym zdaniu

**10x-shape** to facilitator skill, które prowadzi user'ę przez 6-fazowy discovery process (vision, persona, MVP, FRs, business logic, framing) i produces `shape-notes.md` — audit trail z checkpoint'ami i quality gates — który downstream `/10x-prd` genuje formalny PRD z.

**Building similar skill**:
1. Start z raw prompt (test it)
2. Create SKILL.md skeleton (frontmatter + sections)
3. Implement algorithm (numbered steps)
4. Add guardrails (3–5 specifics)
5. Add scope boundaries
6. Add references (if needed)
7. Add chain integration (if multi-step workflow)
8. Add advanced patterns (complexity scaling, checkpoints, gates)

**Key insight**: skills to structured conversation — user inputs, AI questions, decisions lock'owane back, artifacts written. Respekt schema'ów, guardrails, chain contracts. Reszta jest details.
