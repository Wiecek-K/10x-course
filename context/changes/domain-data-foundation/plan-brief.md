# F-01: Domain data foundation — Plan Brief

> Full plan: `context/changes/domain-data-foundation/plan.md`
> Roadmap entry: `context/foundation/roadmap.md` (F-01)

## What & Why

F-01 tworzy pierwszy schemat domeny projektu — tabelę `links` z RLS per user_id i minimalne SSR API (POST create + GET list). Roadmap wskazuje F-01 jako foundation z najszerszym fan-out (odblokowuje wszystkie 6 slice'ów). Inwestycja "data deeply" z framingu sekwencjonowania (`main_goal: market-feedback`) zaczyna się tutaj — schemat ma znaczenie strategiczne, bo refaktor RLS lub statusu po wylądowaniu downstream slice'ów kosztuje czas, którego nie ma przy `top_blocker: capacity`.

## Starting Point

Astro 6 SSR + Supabase + Cloudflare Workers działa end-to-end dla auth (signup → confirm-email → signin → dashboard smoke test passed w prodzie per `context/deployment/deploy-plan.md`). Ale `supabase/migrations/` jest puste — zero schematu domeny. `src/types.ts` nie istnieje. `zod` nie jest w dependencies. Generowanych Database types nie ma. F-01 wypełnia tę pustkę bez wchodzenia w UI, kategorie czy lifecycle event log (te dochodzą w S-04 / S-06).

## Desired End State

Tabela `links` istnieje w Supabase (lokalnie + remote) z RLS i 4 granularnymi politykami `authenticated`; generowane typy `Database` są w repo; Zod jest zainstalowany jako konwencja walidacji wejścia; dwa endpointy `POST /api/links` + `GET /api/links` działają end-to-end dla zalogowanego usera, odrzucają 401 dla anonimowych, i RLS izoluje dane między userami w manualnym sanity-checku. Tym samym S-01 (bot capture) ma kompletny producer-side surface, a S-02 (auto-opis) ma cel do update'owania w background pipeline.

## Key Decisions Made

| Decision                    | Choice                                                       | Why (1 sentence)                                                                                            | Source         |
| --------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------------- |
| Status representation       | Boolean `in_library`                                         | Lifecycle jest binary forever (user-confirmed); kategorie ortogonalne; zero enum management.                | Plan           |
| API auth posture            | Session cookie via `context.locals.user`                     | Zgodne z istniejącym middleware; bot/extension rozwiążą swój auth w S-01/S-05 osobno.                       | Plan           |
| Database types              | Generated + `db:types` bun script                            | Typed queries od dnia 1; sync po każdej zmianie schematu jednym `bun run db:types`.                         | Plan           |
| Input validation            | Zod, install w F-01                                          | Ustala konwencję CLAUDE.md "validate input with zod"; downstream slices dziedziczą wzorzec za darmo.        | Plan           |
| API surface                 | Tylko `POST /api/links` + `GET /api/links` (list)            | Foundation scope cap z roadmapy; PATCH/DELETE/by-id dochodzą w S-04.                                        | Roadmap + Plan |
| List shape                  | `ORDER BY created_at DESC` + opcjonalny `?in_library=...`    | Forward-compat dla S-04 split inbox/library views; PRD scale (~100 user) nie wymaga paginacji.              | Plan           |
| processing_status column    | `text NOT NULL DEFAULT 'pending'` z CHECK 4-wartościowym     | Kolumna musi istnieć zanim S-02 consumer ląduje — dodanie jej w F-02/S-02 to bezcelowy drugi migration na tej samej tabeli; `default 'pending'` eliminuje backfill. | Cross-feature (F-02 planning) |

## Scope

**In scope:**
- Migracja `links` z RLS + 4 polityki authenticated per-op (SELECT/INSERT/UPDATE/DELETE)
- Kolumna `processing_status text NOT NULL DEFAULT 'pending'` w migracji (enum: `pending / processing / done / failed`; wypełniana przez S-02 consumer)
- Generowane `src/db/database.types.ts` + `bun run db:types` script
- `src/types.ts` jako shared types entry: `ProcessingStatus` union type + `Link` z narrowed `processing_status: ProcessingStatus` + Zod-inferred DTOs
- `src/lib/schemas/links.ts` z Zod schemas (`CreateLinkSchema`, `ListLinksQuerySchema`)
- `POST /api/links` + `GET /api/links`
- Housekeeping: `supabase/config.toml` `project_id` i `package.json` `name` → `tabzero`

**Out of scope:**
- Categories / tags / meta-instructions (S-06 territory)
- Lifecycle event log (S-04 territory)
- PATCH / DELETE / `GET /api/links/:id` (S-04 territory)
- UI komponenty
- Pagination (PRD scale nie wymaga)
- Test runner setup (osobna decyzja)
- Refaktor istniejących auth endpointów do Zod (out of scope; F-01 ustala wzór tylko dla NOWYCH endpointów)

## Architecture / Approach

Trzy warstwy z czytelnymi granicami:
1. **Postgres + RLS** — DB jest source of truth dla izolacji user-data; 4 polityki na role `authenticated` scoped `auth.uid() = user_id` egzekwują NFR "Izolacja danych" niezależnie od tego co robi kod aplikacji.
2. **TS types + Zod schemas** — generated Database types pokrywają compile-time shape; Zod schemas pokrywają runtime input validity. Schemas eksportowane reuse-friendly dla S-01/S-05.
3. **Astro SSR API routes** — cienka warstwa: parse + Zod validate → auth check (`context.locals.user`) → Supabase query → JSON response. API nie ufa niczemu poza middleware-resolved user.

## Phases at a Glance

| Phase                              | What it delivers                                                     | Key risk                                                                  |
| ---------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1. Schema migration + RLS + types  | Migracja + 4 polityki + generowane types + housekeeping              | Pomyłka w RLS = potencjalny data leak w S-01; manual RLS isolation check  |
| 2. Shared types + Zod schemas      | `src/types.ts`, `src/lib/schemas/links.ts` + zod dep                 | Drift Schema → Database types → Zod jeśli kolejność krokow się rozjedzie  |
| 3. API endpoints                   | `POST /api/links` + `GET /api/links` działające end-to-end           | Spójność error semantics (401 vs 400 vs 500); session cookie w curl       |

**Prerequisites:** Wdrożone Cloudflare Workers + produkcyjny Supabase (✓ per `context/deployment/deploy-plan.md`); Docker dla `bunx supabase start` (opcjonalne ale zalecane dla local dev + `db:types` workflow).

**Estimated effort:** Nie estymuję czasu — roadmap świadomie pomija kalendarz (`/10x-roadmap` guardrail). F-01 typowo 1 sesja roboczo gdy się siądzie z energią; może 2 sesje jeśli Phase 1 RLS testing odsłoni edge cases.

## Open Risks & Assumptions

- **Założenie binary lifecycle**: jeśli kiedyś pojawi się 3. stan (snooze, needs-review) — refaktor `boolean → enum + data migration`. Jednorazowy koszt świadomie akceptowany (user-confirmed: "nie przewiduję pojawienia się trzeciego stanu").
- **Założenie bot session**: bot/extension uzyskają sesję Supabase w S-01/S-05 (przez ten sam SSR client lub equivalent flow). Jeśli okaże się że bot wymaga service-role + bearer token, F-01 dostanie extension w S-01 plan (dual-auth POST).
- **Założenie skali**: ~100 user / kilkadziesiąt linków/user nie wymaga paginacji. Jeśli któryś user zacznie hodować bazę >1000 linków, paginacja dochodzi zanim S-03 NL search UI zacznie boleć.

## Success Criteria (Summary)

- Tabela `links` istnieje w produkcyjnym Supabase z RLS i 4 politykami widocznymi w dashboard
- Zalogowany user wykonuje POST + GET end-to-end (curl + dev + deployed Worker); RLS izoluje dane między dwoma userami w manual sanity-checku
- Wszystkie kolejne sliceay z roadmapy (S-01..S-06) mogą startować bez re-architecting `links` schematu
