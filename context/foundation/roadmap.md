---
project: tabzero
version: 1
status: draft
created: 2026-05-29
updated: 2026-06-01
prd_version: 1
main_goal: market-feedback
top_blocker: capacity
---

# Roadmap: tabzero

> Wyprowadzone z `context/foundation/prd.md` (v1) + auto-zbadana baza kodu (commit `d5c8e37`, deploy https://tabzero.ajmag.workers.dev).
> Edit-in-place; archiwizuj gdy zastąpione.
> Sliceay poniżej są w kolejności dependencyjnej. Tabela "At a glance" jest indeksem.

## Vision recap

Osoba z wieloma równoległymi zainteresowaniami zapisuje dziesiątki linków tygodniowo i traci do nich dostęp — istniejące narzędzia (Pocket, Raindrop, Obsidian) zakładają że *najpierw* zaprojektujesz system kategorii, *potem* zaczniesz zapisywać. tabzero odwraca tę kolejność: capture jest natychmiastowy i zero-friction, a struktura wyłania się automatycznie w tle (auto-opis przy zapisie, propozycja kategorii po zebraniu bazy). Wedge tego produktu — ta jedna cecha, która jeśli zniknie, czyni go nieodróżnialnym od generycznego "save-for-later" — to fakt, że użytkownik nigdy nie projektuje systemu, a mimo to po tygodniach znajduje to, czego szuka.

## North star

**S-02: Auto-opis dla zapisanego linka** — wieńczy gwiazdę przewodnią rozpoczętą w S-01 (bot capture). Razem S-01+S-02 dostarczają primary success criterion z PRD ("zapisać link w ≤2 kliknięciach → zobaczyć auto-opis → odnaleźć NL search") i są pierwszym punktem, od którego dogfooding ma sens dla `main_goal: market-feedback`.

> Gwiazda przewodnia — najmniejszy end-to-end slice, który po wylądowaniu dowodzi, że podstawowa hipoteza produktu działa (tu: zero-friction capture + automatyczny opis = wartość bez projektowania kategorii). Sekwencjonowana tak wcześnie, jak Prerequisites pozwalają — bo wszystko inne ma sens tylko jeśli to działa.

## At a glance

| ID    | Change ID                       | Outcome (user can …)                                                              | Prerequisites    | PRD refs                  | Status   |
| ----- | ------------------------------- | --------------------------------------------------------------------------------- | ---------------- | ------------------------- | -------- |
| F-01  | `domain-data-foundation`        | (foundation) schemat `links` + RLS per user_id + minimalne API SSR                | —                | NFR "Izolacja danych", Access Control | done     |
| F-02  | `link-processing-queue`         | (foundation) Cloudflare Queue podpięta; producer/consumer scaffold; brak logiki    | —                | NFR "Latencja potwierdzenia ≤2s", infrastructure.md | done     |
| S-01  | `bot-capture-to-inbox`          | wysłać URL do bota i zobaczyć link w inboxie (URL only, opis przyjdzie z S-02)    | F-01             | FR-002, FR-010, NFR "Latencja potwierdzenia ≤2s" | proposed |
| S-02  | `auto-description-pipeline`     | zobaczyć auto-opis przy każdym zapisanym linku w ≤30s; linki niescrapowalne oznaczone wizualnie | F-01, F-02, S-01 | FR-004, FR-005, NFR "Niezawodność zapisu", NFR "Dostępność funkcji core" | proposed |
| S-04  | `link-closure-flow`             | przejrzeć inbox, otworzyć link (wizyta zapisana), świadomie zamknąć link w jednym z 3 trybów z opcjonalną notatką; ręcznie edytować opis | F-01, S-01      | FR-008, FR-007 (browse "wszystkie"), NFR "Niezawodność zapisu" (ręczna edycja) | proposed |
| S-03  | `nl-search-on-links`            | wpisać zapytanie w naturalnym języku i dostać pasujące linki w ≤5s               | F-01, S-02       | FR-007 (NL search), FR-009, US-02 | proposed |
| S-06  | `category-proposal-and-routing` | dostać propozycję struktury kategorii po N linkach; dodawać własne kategorie z meta-instrukcjami; nowe linki auto-routowane | F-01, F-02, S-02 | FR-006, FR-007 (per-kategoria), FR-011, Success Criteria §Secondary | proposed |
| S-05  | `extension-capture`             | kliknąć ikonę rozszerzenia przeglądarki i zapisać link w ≤2 kliknięciach          | F-01             | FR-001, FR-010, US-01     | proposed |

## Dependency graph

```
F-01 ───┬──────────────────────────────────────────────────> S-05
        │
        └──> S-01 ──┬──────────────────────────────────────> S-04
                    │
F-02 ───────────────┴──> S-02 ──┬──────────────────────────> S-03
                                 └──────────────────────────> S-06
```

Czytanie: strzałka A → B oznacza "A jest prerequisite B". F-01 i F-02 mogą iść równolegle. S-05 może iść równolegle z całym rdzeniem (zależy tylko od F-01).

## Streams

Nawigacja — grupuje itemy dzielące łańcuch Prerequisites. Kanoniczne uporządkowanie żyje w grafie zależności poniżej; ta tabela to proponowana kolejność czytania w poprzek równoległych torów.

| Stream | Theme                  | Chain                          | Note                                                                          |
| ------ | ---------------------- | ------------------------------ | ----------------------------------------------------------------------------- |
| A      | Wedge proof            | `F-01 → S-01 → S-02`           | Trzon dowodu inwersji; sekwencjonowane tak wcześnie jak graf pozwala — to dźwignia dla `main_goal: market-feedback`. |
| B      | Async backbone         | `F-02`                         | Foundation podpięcia kolejki; dołącza do A przy `S-02`. Może iść równolegle z `F-01`. |
| C      | Library interaction    | `S-04`                         | Closure + manual edit; dołącza do A przy `S-01`. Niezależne od opisów — można rozwijać równolegle z `S-02`. |
| D      | Retrieval & structure  | `S-03 / S-06`                  | Obie dołączają do A przy `S-02`; po wylądowaniu opisów działają równolegle. |
| E      | Extension surface      | `S-05`                         | Dołącza do A przy `F-01`; świadomie deferred za dowodem przez bota.           |

## Baseline

Co jest już w bazie kodu na `2026-05-29` (auto-zbadane + user-confirmed). Foundations poniżej zakładają że to jest na miejscu i NIE re-scaffold-uje tego.

- **Frontend:** **present** — Astro 6 + React 19 + Tailwind v4 + shadcn/ui per `package.json`, `astro.config.mjs`; pages `src/pages/{index,dashboard,auth/*}.astro`; UI w `src/components/ui/`.
- **Backend / API:** **present** (sam szkielet) — Astro SSR (`output:"server"`); auth endpoints w `src/pages/api/auth/`. Brak endpointów domeny.
- **Data:** **partial** — Supabase produkcyjnie podpięte (per `context/deployment/deploy-plan.md`), ale `supabase/migrations/` puste — brak schematu domeny. To luka, którą domyka F-01.
- **Auth:** **present** — Supabase SSR auth w `src/lib/supabase.ts` + `src/middleware.ts`; smoke test w prodzie potwierdza pełny flow signup → confirm-email → signin → dashboard → signout.
- **Deploy / infra:** **present** — wdrożone na Cloudflare Workers (`wrangler.jsonc`, `name: tabzero`); CI lint+build w `.github/workflows/ci.yml`. CF Builds auto-deploy-on-merge pending per deploy-plan — operacyjne, poza zakresem tej roadmapy.
- **Observability:** **partial** — `observability: { enabled: true }` w `wrangler.jsonc` (CF Workers Logs, retencja 3 dni); brak Sentry/OTEL/dashboard. Wystarczające na MVP; rozwiniecie kiedy któryś slice tego zażąda.
- **Background jobs (Cloudflare Queues):** **absent** — `has_background_jobs: true` zadeklarowane w tech-stack, infrastructure.md prowadzi przez setup, ale żadna kolejka nie jest podpięta. Luka domyka F-02.

## Foundations

### F-01: Domain data foundation (`links` + RLS)

- **Outcome:** (foundation) schemat domeny dla `links` (URL, nullable `micro_description`, `status` z domyślnym `inbox`, `last_visited`, `created_at`, `user_id`) z RLS per user_id; minimalne SSR API do create/read linka. Brak UI, brak kategorii, brak lifecycle event log — to ma sens dopiero w S-04/S-06.
- **Change ID:** `domain-data-foundation`
- **PRD refs:** NFR "Izolacja danych", Access Control §Prywatność, FR-010 (domyślny inbox jako stan początkowy linka)
- **Unlocks:** S-01, S-02, S-03, S-04, S-05, S-06 — wszystkie pozostałe sliceay zapisują albo czytają `links`.
- **Prerequisites:** —
- **Parallel with:** F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** to jest jedyna foundation oznaczona "invest deeply" — schemat domeny ma znaczenie strategiczne (refaktor RLS lub statusu enuma po wylądowaniu jakiegokolwiek slice'a kosztuje czas, którego nie ma przy `top_blocker: capacity`). Zakres trzymany minimalnie żeby nie ześliznąć się w "buduj całą bazę z góry" — tylko `links` + RLS, kategorie i events osobno w S-06/S-04.
- **Status:** done

### F-02: Background processing skeleton (Cloudflare Queue plumbing)

- **Outcome:** (foundation) kolejka `tabzero-link-processing` podpięta w `wrangler.jsonc`; helper producer importowalny z API; minimalny consumer Worker który ack'uje jobs (jeszcze nic nie robi). Brak scrapingu, brak LLM calls — to wszystko jest w S-02.
- **Change ID:** `link-processing-queue`
- **PRD refs:** NFR "Latencja potwierdzenia ≤2s" (asynchroniczne odpięcie opisu od potwierdzenia capture), FR-004 (auto-opis async), `context/foundation/infrastructure.md` §Getting Started krok 5
- **Unlocks:** S-02 (consumer wykonuje scraping + LLM), S-06 (routing kategoryzacji idzie tym samym torem)
- **Prerequisites:** —
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** CF Queues free tier = 10k ops/dzień (~3300 capture/dzień przy 3 jobach na link); dla MVP wystarczy. Plumbing-only foundation — nie wbudowywać scraping ani LLM logiki tutaj, bo wpadnie w pułapkę "buduj cały backend z góry".
- **Status:** done

## Slices

### S-01: Mobile capture przez bota → link w inboxie

- **Outcome:** użytkownik wysyła URL do bota w komunikatorze; bot odpowiada potwierdzeniem w ≤2s; link pojawia się w inboxie web app (jako URL, opis przyjdzie z S-02).
- **Change ID:** `bot-capture-to-inbox`
- **PRD refs:** FR-002, FR-010, NFR "Latencja potwierdzenia ≤2s"
- **Prerequisites:** F-01
- **Parallel with:** S-05 (drugi kanał capture; oba zależą tylko od F-01)
- **Blockers:** —
- **Unknowns:**
  - Platforma bota (Telegram MVP vs WhatsApp vs inny) — Owner: user. Block: no. (Telegram jest domyślnie wystarczający; też w `## Open Roadmap Questions`.)
  - Identity binding messenger user ↔ Supabase user (pairing code? magic link?) — Owner: TBD. Block: no. (Decyzja /10x-plan-level.)
- **Risk:** pierwszy user-facing slice — wprowadza bot setup, API do POST linków, identity binding i minimalny widok inboxu naraz. PRD nie ma literalnego US dla bota (US-01 jest desktop-only) — luka odnotowana w Open Roadmap Questions.
- **Status:** proposed

### S-02: Auto-opis dla zapisanego linka

- **Outcome:** dla każdego nowo zapisanego linka (z dowolnego kanału capture) system pobiera treść strony 3-poziomową strategią (FR-004: free scraper → płatny proxy → Web Archive; dla wideo: API napisów) i generuje micro-opis przez LLM (BYOK). Opis pojawia się w inboxie w ≤30s. Linki niescrapowalne są wizualnie oznaczone, ale nigdy nie tracone (FR-005).
- **Change ID:** `auto-description-pipeline`
- **PRD refs:** FR-004, FR-005, NFR "Niezawodność zapisu", NFR "Dostępność funkcji core"
- **Prerequisites:** F-01, F-02, S-01
- **Parallel with:** S-04 (closure flow zależy tylko od S-01)
- **Blockers:** —
- **Unknowns:**
  - Konkretni vendorzy per tier scraping (kandydaci: Jina Reader / ScrapingBee / Wayback Machine per infrastructure.md) — Owner: TBD. Block: no.
  - Provider LLM dla generowania opisu + jak przyjmujemy BYOK klucz — Owner: TBD. Block: no.
  - Źródło napisów YouTube (Rapid Hub z PRD socrates) — Owner: TBD. Block: no.
- **Risk:** najcięższy slice w roadmapie — 3 tiery scrapingu + LLM call + lifecycle update + widoczny stan "jeszcze przetwarzam". Świadomie akceptowane jako koszt udowodnienia inwersji (`main_goal: market-feedback`), ale to jest gdzie `top_blocker: capacity` najmocniej uderza — zaplanować podział na pod-jednostki na poziomie /10x-plan.
- **Status:** proposed

### S-04: Closure flow + per-link manual edit

- **Outcome:** użytkownik widzi inbox (chronologiczna lista linków), klika link żeby go otworzyć (rejestrowany visit + timestamp; stan się NIE zmienia), oraz świadomie zamyka link w jednym z 3 trybów ("pochłonięte — zachowaj w bibliotece" / "pochłonięte — zamknij" / "odrzuć") z opcjonalną notatką. Ręczna edycja opisu i URL dostępna dla każdego linka.
- **Change ID:** `link-closure-flow`
- **PRD refs:** FR-008, FR-007 (browse "wszystkie"), NFR "Niezawodność zapisu" (ręczna edycja)
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02, S-03, S-06, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** mały slice technicznie ale ciężki UX-owo — 4-stanowy lifecycle z celowym tarciem przy zamknięciu jest filozoficznym sercem produktu (PRD §Business Logic). Jeśli dogfooding pokaże że tarcie jest źle skalibrowane, kalibracja wraca jako iteracja, nie redesign.
- **Status:** proposed

### S-03: NL search na zapisanych linkach

- **Outcome:** użytkownik wpisuje zapytanie w naturalnym języku w interfejs wyszukiwania; system zwraca pasujące linki w ≤5s. Komunikat informacyjny przy braku trafień zamiast pustego ekranu (US-02 acceptance criteria).
- **Change ID:** `nl-search-on-links`
- **PRD refs:** FR-007 (interfejs wyszukiwania w naturalnym języku), FR-009, US-02
- **Prerequisites:** F-01, S-02
- **Parallel with:** S-06, S-04, S-05
- **Blockers:** —
- **Unknowns:**
  - LLM brute-force po micro-opisach vs wczesne embeddings/vector DB — Owner: TBD. Block: no. (Brute-force OK dla MVP; vector DB jest w PRD §Forward dla >100-200 linków.)
  - Budżet latencji przy rosnącej bazie linków pod brute-force — Owner: TBD. Block: no.
- **Risk:** jakość wyszukiwania dziedziczy jakość opisów z S-02 — jeśli S-02 ma luki (niescrapowalne strony), użytkownik obwini search. Mitigacja jest na poziomie S-02 (3-tier scraping); w S-03 trzeba dobrze pokazać "nie znaleziono" zamiast bełkotu.
- **Status:** proposed

### S-06: Propozycja struktury kategorii + meta-instrukcje + routing + per-kategoria browse

- **Outcome:** po zebraniu N linków system proponuje strukturę kategorii (z predefined templates dopasowanych do profilu treści użytkownika); użytkownik akceptuje / modyfikuje / odrzuca. W dowolnym momencie może dodać własną kategorię z meta-instrukcją (co do niej trafia + jakim stylem opisywać). Nowe linki są automatycznie kierowane do kategorii przez background pipeline. Per-kategoria browse view dostępne w UI.
- **Change ID:** `category-proposal-and-routing`
- **PRD refs:** FR-006, FR-007 (browse per-kategoria), FR-011, Success Criteria §Secondary
- **Prerequisites:** F-01, F-02, S-02
- **Parallel with:** S-03, S-04, S-05
- **Blockers:** —
- **Unknowns:**
  - Zawartość predefined templates — jakie zestawy kategorii ship-ujemy w MVP? PRD nie wylicza — Owner: user (po pierwszym tygodniu dogfoodingu jest sygnał) lub TBD. Block: no.
  - N threshold dla propozycji ("po ilu linkach proponujemy strukturę?") — PRD mówi "po zebraniu wystarczającej liczby" bez liczby. Owner: TBD. Block: no.
- **Risk:** to jest Success Criteria §Secondary, nie north star — sliceuje się dopiero gdy bot+opis są stabilne. Jakość kategoryzacji znowu dziedziczy jakość opisów z S-02. Routing przez kolejkę (F-02) re-using tej samej infrastruktury co opis.
- **Status:** proposed

### S-05: Extension capture (desktop)

- **Outcome:** użytkownik klika ikonę rozszerzenia w przeglądarce → URL bieżącej karty zapisany w ≤2 kliknięciach z potwierdzeniem w ≤2s → link pojawia się w inboxie. Reuse'uje S-02 pipeline gdy jest dostępny; bez S-02 zapisuje URL bez opisu (niezawodność > kompletność).
- **Change ID:** `extension-capture`
- **PRD refs:** FR-001, FR-010, US-01
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-04
- **Blockers:** —
- **Unknowns:**
  - OSS fork start point: Obsidian Web Clipper vs MarkDownload (oba MIT, oba w PRD socrates FR-001) — Owner: user. Block: no.
  - Dystrybucja: Chrome unpacked vs Web Store (PRD socrates: unpacked OK na MVP) — Owner: user. Block: no.
- **Risk:** extension dev to nowe terytorium (sygnał z `top_blocker: capacity` — patrz też alternatywa `skills` jaka była rozważana). OSS fork adaptacja może odsłonić niespodziewaną pracę. Świadomie sekwencjonowane *za* dowodem przez bota — gdyby capacity zabrakło, extension wpada do Parked, bo bot pokrywa kanał capture na MVP.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                       | Suggested issue title                                            | Ready for `/10x-plan` | Notes |
| ---------- | ------------------------------- | ---------------------------------------------------------------- | --------------------- | ----- |
| F-01       | `domain-data-foundation`        | Schema domeny `links` + RLS per user_id + minimalne SSR API      | yes                   | Run `/10x-plan domain-data-foundation` |
| F-02       | `link-processing-queue`         | Cloudflare Queue `tabzero-link-processing` + producer/consumer scaffold | yes             | Run `/10x-plan link-processing-queue` — może iść równolegle z F-01 |
| S-01       | `bot-capture-to-inbox`          | Bot capture (Telegram MVP): URL → inbox + minimalny widok inboxu | no                    | Blokada: prereq F-01. Resolve `/10x-plan` po F-01. |
| S-02       | `auto-description-pipeline`     | 3-tier scraping + LLM micro-opis (BYOK) + visible processing state | no                  | Blokada: prereqs F-01, F-02, S-01. Najcięższy slice — rozważ podział w /10x-plan. |
| S-04       | `link-closure-flow`             | 4-stanowy closure flow + visit tracking + manual edit            | no                    | Blokada: prereqs F-01, S-01. Można w parallel z S-02. |
| S-03       | `nl-search-on-links`            | NL search po micro-opisach z latencją ≤5s                        | no                    | Blokada: prereqs F-01, S-02 (opis = corpus). |
| S-06       | `category-proposal-and-routing` | Propozycja kategorii z predefined templates + meta-instrukcje + auto-routing | no        | Blokada: prereqs F-01, F-02, S-02. Secondary criterion. |
| S-05       | `extension-capture`             | Browser extension capture (fork z OSS: Web Clipper / MarkDownload) | no                  | Blokada: prereq F-01. Świadomie deferred za dowodem bota. |

## Open Roadmap Questions

1. **Platforma bota do mobile capture (FR-002 / S-01)** — Telegram wybrany ze względu na łatwość integracji w MVP, ale user personalnie z niego nie korzysta. Do weryfikacji: która platforma (Telegram / WhatsApp / inny) jest (a) najłatwiejsza dewelopersko i (b) używana przez pierwszą grupę testową z Discorda. Owner: user. Block: nie — Telegram działa jako MVP default; decyzja może być zmieniona bez wpływu na architekturę.

2. **Zbieranie metadanych do QA algorytmów kategoryzacji (FR-006 / S-06)** — przy większej grupie użytkowników przydatne do weryfikacji czy routing i opisy działają. Do decyzji: (a) czy w ogóle, (b) jakie dane, (c) czy anonimizowane. Owner: user. Block: nie — MVP działa bez tego; decyzja po obserwacji pierwszej grupy testowej.

3. **PRD nie ma US dla bot capture (gap w dokumentacji)** — US-01 opisuje literalnie tylko desktop/extension flow, a S-01 (gwiazda przewodnia) zależy od kanału mobilnego. Akcja: re-run `/10x-prd` żeby dopisać US-03 lustrzane do US-01 dla bota. Owner: user. Block: nie — slice plan-uje się z FR-002+FR-010, ale US zapełniłby formalną symetrię.

## Parked

- **Współdzielenie list / team workspaces** — PRD §Non-Goals: v2+, osobna decyzja o modelu prywatności.
- **Natywna aplikacja mobilna** — PRD §Non-Goals: bot w komunikatorze pokrywa mobile capture w MVP.
- **Pełne archiwizowanie treści stron** — PRD §Non-Goals: zapisujemy link + micro-opis; jeśli strona zniknie, opis jest jedynym śladem.
- **Własny billing i abonament** — PRD §Non-Goals: MVP = BYOK; monetyzacja = v2+.
- **Gwarancja offline** — PRD §Non-Goals: aplikacja wymaga sieci.
- **Moderacja i content policy** — PRD §Non-Goals: baza prywatna, nieinspektowana.
- **Tryb rozszerzonego zapisu (formularz capture z priorytetem / notatką / ręczną kategorią)** — PRD §Non-Goals: v2+; domyślny 2-klikowy zapis jest jedynym trybem MVP.
- **FR-003: Import zakładek z HTML eksportu przeglądarki** — nice-to-have. Parked ze względu na `top_blocker: capacity` (3 tygodnie after-hours). Wraca jako kandydat po dogfoodingu jeśli czas pozwoli.
- **FR-012: Dashboard aktywności per kategoria** — nice-to-have. PRD §Dashboard explicite: "jeśli nie starczy czasu w 3-tygodniowym MVP, dashboard wchodzi w sprint post-MVP". Model danych w F-01 + S-04 + S-06 zbiera surowce; widok dochodzi później.
- **Cloudflare Builds CI auto-deploy-on-merge** — operacyjne, śledzone w `context/deployment/deploy-plan.md` jako pending. Poza zakresem feature roadmapy.

## Done

(Pusta przy pierwszym generowaniu. `/10x-archive` dopisuje wpis tutaj — i przerzuca status itema na `done` — gdy zmiana z pasującym Change ID jest archiwizowana. NIE wypełniać ręcznie.)

- **F-01: (foundation) schemat domeny dla `links` (URL, nullable `micro_description`, `status` z domyślnym `inbox`, `last_visited`, `created_at`, `user_id`) z RLS per user_id; minimalne SSR API do create/read linka. Brak UI, brak kategorii, brak lifecycle event log — to ma sens dopiero w S-04/S-06.** — Archived 2026-05-31 → `context/archive/2026-05-29-domain-data-foundation/`. Lesson: —.
- **F-02: (foundation) kolejka `tabzero-link-processing` podpięta w `wrangler.jsonc`; helper producer importowalny z API; minimalny consumer Worker który ack'uje jobs (jeszcze nic nie robi). Brak scrapingu, brak LLM calls — to wszystko jest w S-02.** — Archived 2026-06-01 → `context/archive/2026-05-29-link-processing-queue/`. Lesson: —.
