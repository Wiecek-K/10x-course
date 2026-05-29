# F-01: Domain Data Foundation — Implementation Plan

## Overview

F-01 wprowadza pierwszy schemat domeny projektu: tabelę `links` z RLS per user_id i minimalne SSR API (`POST /api/links` create + `GET /api/links` list). Ustala konwencje, które dziedziczą wszystkie kolejne sliceay z roadmapy: typed schema (generowane z Supabase), Zod jako warstwa walidacji wejścia API, granularne RLS per operacja. Zakres świadomie minimalny per roadmap foundation scope cap — brak UI, brak kategorii, brak lifecycle event log.

## Current State Analysis

**Co istnieje:**
- Astro 6 SSR + `@astrojs/cloudflare` adapter; wdrożone na CF Workers (`https://tabzero.ajmag.workers.dev`)
- Supabase produkcyjnie podpięte; auth flow działa end-to-end (per `context/deployment/deploy-plan.md` smoke test)
- `src/lib/supabase.ts:5` — `createClient(headers, cookies)` SSR client; nullable (returns null gdy brakuje env vars)
- `src/middleware.ts:13` — wstrzykuje `user` do `context.locals.user` przed każdym requestem
- `src/env.d.ts:3` — typuje `App.Locals.user` jako `User | null`
- Konwencja API: `src/pages/api/auth/signin.ts` używa `formData` + redirectów (auth-specific; nie sets wzoru dla biz-API)
- `astro.config.mjs:18` deklaruje `env.schema` z `SUPABASE_URL` i `SUPABASE_KEY` jako server secrets

**Czego brakuje (luki, które F-01 wypełnia):**
- `supabase/migrations/` jest **puste** (zero migracji)
- `src/types.ts` nie istnieje
- `src/db/` nie istnieje; brak generowanych Database types
- `zod` nie ma w `package.json` mimo że CLAUDE.md deklaruje walidację Zod jako konwencję
- `package.json:2` `name` = `10x-astro-starter` (stale po bootstrap)
- `supabase/config.toml:5` `project_id` = `10x-astro-starter` (stale)

**Constraints odkryte podczas research:**
- CLAUDE.md: migracje nazwane `YYYYMMDDHHmmss_short_description.sql`; RLS per-op per-role; always-enable
- CLAUDE.md: API routes muszą exportować `const prerender = false` (Astro 6 default może prerender-ować mimo `output: "server"`)
- CLAUDE.md: ścieżka aliasu `@/*` → `./src/*` (zawsze; bez `../../`)
- `wrangler.jsonc` ma `nodejs_compat` włączony i `observability: { enabled: true }`
- Supabase config wskazuje PG 17 (`major_version = 17`)
- Astro 6 wymaga `astro:env/server` zamiast usuniętego `Astro.locals.runtime.env` — istniejący `src/lib/supabase.ts:3` już to robi poprawnie

## Desired End State

Po wdrożeniu F-01:
- Migracja zaaplikowana lokalnie + remote; tabela `public.links` istnieje w Supabase z RLS i 4 politykami
- `bun run db:types` generuje aktualne `src/db/database.types.ts` (committed do repo)
- `src/types.ts` eksportuje `Link` (entity) + `CreateLinkInput` + `ListLinksQuery` (Zod-inferred DTO)
- `src/lib/schemas/links.ts` eksportuje `CreateLinkSchema` + `ListLinksQuerySchema`
- `POST /api/links` przyjmuje JSON body, validuje Zod, sprawdza auth, insert, zwraca 201 z `Link`
- `GET /api/links?in_library=...` validuje query, sprawdza auth, zwraca listę `{ links: Link[] }` ordered DESC
- Brak autentykacji w jakimkolwiek endpoint → 401; malformed input → 400 ze strukturalnym Zod errorem
- Manualny RLS sanity check: drugi user nie widzi linków pierwszego

### Key Discoveries

- Astro 6 wymaga `import { env } from 'cloudflare:workers'` lub `astro:env/server` — istniejący `src/lib/supabase.ts:3` używa tego drugiego; nowe API routes idą tą samą drogą.
- Middleware już resolve'uje `user` przez `supabase.auth.getUser()` w `src/middleware.ts:11-13` — API routes powinny **używać** `context.locals.user`, nie re-fetchować przez kolejny `getUser()` (oszczędza round-trip i zachowuje semantykę request-level user).
- `src/pages/api/auth/signin.ts` jako jedyne istniejące API używa `formData` + redirectów — to wzorzec auth-form-specific; biz-API ustanawia nowy wzorzec JSON-in / JSON-out z Zod boundary.

## What We're NOT Doing

- **Categories / tags / meta-instructions** — S-06 territory; F-01 świadomie nie dodaje `category_id` ani M2M junction.
- **Lifecycle event log** (events: `zachowane / zamknięte / odrzucone` + visit tracking) — S-04 territory.
- **`PATCH /api/links/:id`** (manual edit opisu) — S-04 (NFR "ręczna edycja").
- **`DELETE /api/links/:id`** — S-04 (closure-via-event z konsekwentnym DELETE).
- **`GET /api/links/:id`** — żaden bieżący slice tego nie potrzebuje.
- **UI komponenty** dla listy / formularza dodawania — wszystkie sliceay są user-facing.
- **Bot / extension integration** — S-01 / S-05.
- **Pagination** — PRD scale (~100 user, kilkadziesiąt linków/user) nie wymaga; jeśli któryś user wyhoduje >1000 linków, paginacja dochodzi przed S-03 NL search UI staje się slow.
- **Test runner setup** (vitest/playwright) — osobna decyzja niezwiązana z F-01; verification jest manual + automated build/lint.
- **Refaktor istniejących auth endpointów do Zod** — out of scope; F-01 ustala wzór tylko dla NOWYCH endpointów.
- **Migration rollback automation** — w razie potrzeby rollback przez nową migrację `DROP TABLE links CASCADE;`, nie `db reset` na prod.

## Implementation Approach

Trzy fazy z czytelnymi granicami: (1) DB layer (migracja + RLS + generation pipeline); (2) types/validation layer (zod + shared types + schemas); (3) API layer (endpointy). Każda faza waliduje się build + lint automatycznie i ma manualny smoke step. Granica między fazami jest naturalna — Phase 1 nie dotyka TS kodu poza generated types; Phase 2 nie dotyka API; Phase 3 wymaga obu poprzednich.

Strategia migracji: dev-first via local Supabase stack (`bunx supabase start` wymaga Dockera), apply migration, generate types, commit. Apply do prod przez `bunx supabase db push` (lub przez CF Builds gdy zostanie podpięte; per deploy-plan jest pending — out of scope dla F-01).

## Critical Implementation Details

- **`prerender = false` na API routes**: Astro 6 z `output: "server"` w configu nadal może traktować pliki bez explicit flag jako prerender-able. CLAUDE.md to deklaruje — `src/pages/api/links/index.ts` MUSI exportować `export const prerender = false;` na samym górze pliku. Pominięcie → endpoint nie odpowiada na runtime requests.
- **Migration → types ordering**: `bun run db:types` musi być wykonane **po** apply migracji do **lokalnego** Supabase (skrypt używa `--local`). Próba generacji typów przed apply daje stary lub pusty schema. Sekwencja w Phase 1: write migration → `bunx supabase db reset` → `bun run db:types` → commit.

## Phase 1: Schema migration + RLS + type generation

### Overview

Pierwsza migracja domeny tworzy tabelę `links` z RLS i 4 granularnymi politykami; podpina bun script do generacji `Database` types; zamyka drobne housekeeping (project_id, package name).

### Changes Required:

#### 1. Migracja `links` table z RLS

**File**: `supabase/migrations/20260529120000_create_links.sql`

**Intent**: Tworzy `public.links` jako pierwszą tabelę domeny. Przed zapisem pliku utwórz katalog: `mkdir -p supabase/migrations` (`supabase init` nie tworzy go automatycznie gdy żadna migracja jeszcze nie istnieje). włącza RLS i deklaruje 4 polityki authenticated per-op scoped `auth.uid() = user_id`. Definiuje minimalny schema dla S-01 / S-02 / S-04 / S-05 / S-06: PK uuid, FK do `auth.users` z `ON DELETE CASCADE` (gdy user kasuje konto, jego linki znikają — NFR "Izolacja danych"), URL jako text NOT NULL, nullable `micro_description` (per NFR niezawodności — link bez opisu jest dozwolony), boolean `in_library` (default false = inbox), nullable `last_visited`, audit timestamps z trigger.

**Contract**: Migracja zawiera:
- `CREATE TABLE public.links` z kolumnami: `id uuid PK DEFAULT gen_random_uuid()`, `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `url text NOT NULL`, `micro_description text` (nullable), `in_library boolean NOT NULL DEFAULT false`, `processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'done', 'failed'))`, `last_visited timestamptz` (nullable), `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`
- `CREATE INDEX idx_links_user_created ON public.links (user_id, created_at DESC)` — wspiera default list query
- `ALTER TABLE public.links ENABLE ROW LEVEL SECURITY`
- 4 polityki: `links_select_authenticated` (FOR SELECT TO authenticated USING `auth.uid() = user_id`), `links_insert_authenticated` (FOR INSERT TO authenticated WITH CHECK `auth.uid() = user_id`), `links_update_authenticated` (FOR UPDATE TO authenticated USING + WITH CHECK `auth.uid() = user_id`), `links_delete_authenticated` (FOR DELETE TO authenticated USING `auth.uid() = user_id`)
- Trigger `BEFORE UPDATE` aktualizujący `updated_at` — standard PL/pgSQL function `set_updated_at()` przypięta do tabeli

#### 2. `db:types` npm script

**File**: `package.json`

**Intent**: Dodaje script wrapping Supabase CLI: generuje typed schema z lokalnego stacka. Zmienia również stale `name` na `tabzero` żeby pole tożsamości projektu było spójne z `wrangler.jsonc` `name: tabzero`.

**Contract**: 
- `scripts.db:types` = `"supabase gen types typescript --local > src/db/database.types.ts"`
- `name` (top-level): `"tabzero"` (był `"10x-astro-starter"`)

#### 3. Generated Database types

**File**: `src/db/database.types.ts`

**Intent**: Auto-generated output `bun run db:types` po apply migracji lokalnie. Committed do repo żeby downstream slices nie musiały uruchamiać generation przy każdym checkout. Nagłówek pliku ostrzega przed ręczną edycją.

**Contract**: Output `supabase gen types typescript --local`. Plik zawiera `export type Database = { public: { Tables: { links: { Row: {...}, Insert: {...}, Update: {...} } } } }` z polami matchującymi migrację.

#### 4. Housekeeping — Supabase project_id

**File**: `supabase/config.toml`

**Intent**: Naprawia stare `project_id` po bootstrap (`10x-astro-starter` → `tabzero`). Kosmetyczne ale zapobiega confusion w `supabase status` i `supabase functions list`.

**Contract**: `:5` → `project_id = "tabzero"`.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly locally: `bunx supabase db reset` succeeds, `bunx supabase db diff` returns empty
- Migration applies cleanly to remote: `bunx supabase db push` succeeds
- Generated types file exists and non-empty: `test -s src/db/database.types.ts`
- `bun run build` passes
- `bun run lint` passes

#### Manual Verification:

- Supabase Studio (local `http://localhost:54323`): tabela `public.links` istnieje z poprawnym schema; RLS enabled (zielona ikonka); 4 polityki widoczne, każda scoped na `auth.uid() = user_id`
- Insert ręczny przez Studio jako user A: udaje się; przełącz na user B → user B widzi tylko własne rows (RLS sanity)
- Remote Supabase dashboard pokazuje analogiczny stan (links table + RLS + 4 policies)
- `package.json` `name` = `tabzero`; `supabase/config.toml` `project_id` = `tabzero`

**Implementation Note**: Po Phase 1 wszystkie automated verification + manual verification mają być potwierdzone zanim przejdziesz do Phase 2. Phase blocks używają plain bullets — checkboxy dla tych itemów żyją w `## Progress` na końcu.

---

## Phase 2: Shared types + Zod schemas

### Overview

Wprowadza `zod` jako dependency; tworzy `src/types.ts` jako shared types entry point i `src/lib/schemas/links.ts` jako Zod boundary reuse-friendly dla S-01 (bot capture).

### Changes Required:

#### 1. Install `zod`

**File**: `package.json`

**Intent**: Dodaje `zod` jako runtime dependency. Ustala konwencję CLAUDE.md "API routes: validate input with zod" jako rzeczywistość, nie tylko deklarację.

**Contract**: `bun add zod` → nowa linia w `dependencies` z aktualną wersją zod.

#### 2. Shared types entry point

**File**: `src/types.ts`

**Intent**: Singularne miejsce dla entity i DTO types używanych przez konsumentów (API routes, później UI komponenty, services). Re-exportuje `Link` z generated `Database` types; eksportuje Zod-inferred input shapes.

**Contract**: Module exports:
- `export type ProcessingStatus = 'pending' | 'processing' | 'done' | 'failed'`
- `export type Link = Omit<Database['public']['Tables']['links']['Row'], 'processing_status'> & { processing_status: ProcessingStatus }` — narrows generated `string` to the semantic union; keep the Omit pattern so future column additions from the generator pass through unchanged
- `export type LinkInsert = Database['public']['Tables']['links']['Insert']`
- `export type CreateLinkInput = z.infer<typeof CreateLinkSchema>` (re-export from `@/lib/schemas/links`)
- `export type ListLinksQuery = z.infer<typeof ListLinksQuerySchema>` (re-export from `@/lib/schemas/links`)

#### 3. Zod schemas for links API

**File**: `src/lib/schemas/links.ts`

**Intent**: Eksportuje walidatory wejścia dla nowych endpointów. Eksponuje schemas na zewnątrz żeby S-01 (bot) i S-05 (extension) mogły je reuse bez duplikacji shape'u "URL". `CreateLinkSchema` przyjmuje tylko URL — `micro_description` jest auto-gen w S-02, nie przychodzi z capture; `in_library` defaultuje na false po stronie DB.

**Contract**:
- `CreateLinkSchema = z.object({ url: z.string().url() })`
- `ListLinksQuerySchema = z.object({ in_library: z.enum(['true','false']).optional().transform(v => v === undefined ? undefined : v === 'true') })` — query strings są zawsze stringami, więc transform na boolean

### Success Criteria:

#### Automated Verification:

- `bun run build` passes (TS check łapie nowe typy)
- `bun run lint` passes
- TS check potwierdza eksporty: importowanie `Link`, `CreateLinkInput`, `ListLinksQuery` z `@/types` rozwiązuje się
- Importowanie `CreateLinkSchema`, `ListLinksQuerySchema` z `@/lib/schemas/links` rozwiązuje się

#### Manual Verification:

- W lokalnym REPL (np. `bun --eval`): `CreateLinkSchema.safeParse({ url: "https://example.com" })` zwraca `success: true`
- `CreateLinkSchema.safeParse({ url: "not a url" })` zwraca `success: false` z `ZodError`
- `ListLinksQuerySchema.safeParse({ in_library: "true" })` zwraca `{ data: { in_library: true } }`
- `ListLinksQuerySchema.safeParse({})` zwraca `{ data: { in_library: undefined } }`
- TypeScript autocomplete w VS Code działa dla `Link.in_library` (typ: `boolean`), `Link.micro_description` (typ: `string | null`), i `Link.processing_status` (typ: `ProcessingStatus`)

**Implementation Note**: Po Phase 2 paused for manual confirmation przed Phase 3.

---

## Phase 3: API endpoints

### Overview

Implementuje `POST /api/links` (create) i `GET /api/links` (list) z Zod walidacją wejścia, auth check via `context.locals.user`, i Supabase SSR client. Manual smoke test przez curl lokalnie + na deployed Workerze.

### Changes Required:

#### 1. `POST /api/links` + `GET /api/links`

**File**: `src/pages/api/links/index.ts`

**Intent**: Jeden plik route z dwiema metodami. POST tworzy link dla aktualnego usera; GET zwraca listę user'a z opcjonalnym filtrem `in_library`. Oba endpointy: parse + Zod validate → auth check (`context.locals.user`) → Supabase query → JSON response. RLS gwarantuje izolację niezależnie od kodu, ale eksplicytny `user_id` przy insert spełnia NOT NULL constraint.

**Contract**:
- Plik exportuje `const prerender = false;` (Astro 6 SSR convention per CLAUDE.md)
- `const POST: APIRoute = async (context) => {...}`:
  - Parse `await context.request.json()` (try/catch → 400 "Invalid JSON" jeśli nie-JSON)
  - `CreateLinkSchema.safeParse(body)` → 400 ze strukturalnym `{ error: 'validation_error', issues: [...] }` przy fail
  - `if (!context.locals.user) → 401 { error: 'unauthorized' }`
  - `supabase.from('links').insert({ user_id: context.locals.user.id, url: data.url }).select().single()`
  - Return 201 z JSON: bezpośrednio `Link` object (nie envelope — pojedynczy zasób). Supabase query result ma typ `Row` gdzie `processing_status: string` — zwróć z `as Link` assertion (poprawne: CHECK constraint gwarantuje, że runtime value zawsze spełnia `ProcessingStatus`; generator nie wąska string → union)
- `const GET: APIRoute = async (context) => {...}`:
  - `ListLinksQuerySchema.safeParse(Object.fromEntries(context.url.searchParams))` → 400 przy fail
  - `if (!context.locals.user) → 401`
  - Builder: `supabase.from('links').select('*').order('created_at', { ascending: false })`; jeśli `data.in_library !== undefined`, dodaj `.eq('in_library', data.in_library)`
  - Return 200 z JSON `{ links: data as Link[] }` (envelope dla forward-compat na meta/pagination later; ten sam powód `as` co w POST)
- Supabase client pobierany przez `createClient(context.request.headers, context.cookies)` — to samo co middleware (cookies-based SSR session). Nie sprawdzaj null — middleware już obsługuje ten przypadek ustawiając `user = null`, co odpala 401 wcześniej.

### Success Criteria:

#### Automated Verification:

- `bun run build` passes
- `bun run lint` passes
- Endpoint file exists: `test -f src/pages/api/links/index.ts`
- `grep -q "export const prerender = false" src/pages/api/links/index.ts` (sanity check że flag jest)

#### Manual Verification:

- Local dev `bun run dev`, signin jako test user (cookie set), curl `POST http://localhost:4321/api/links` z `--cookie "$(grep auth ...)"` i body `{"url":"https://example.com"}` zwraca 201 z `Link`
- Następnie `curl GET http://localhost:4321/api/links` z tym samym cookie zwraca `{ links: [...] }` zawierające utworzony link
- `curl GET http://localhost:4321/api/links?in_library=true` zwraca `{ links: [] }` (defaultowo `in_library = false`)
- `curl POST http://localhost:4321/api/links` BEZ cookie zwraca 401 `{ error: 'unauthorized' }`
- `curl POST http://localhost:4321/api/links` z cookie i body `{"url":"not-a-url"}` zwraca 400 z `ZodError` issues
- Deploy: `bun run build` + `wrangler deploy`; powtórz wszystkie curl tests na `https://tabzero.ajmag.workers.dev/api/links` — wszystkie 5 scenariuszy pass
- RLS isolation: signup drugiego usera; jego `GET /api/links` zwraca pustą listę (nie widzi linków pierwszego)

**Implementation Note**: Po Phase 3 wszystko zielone → F-01 jest gotowy do archiwizacji przez `/10x-archive domain-data-foundation`. `/10x-archive` automatycznie przerzuci F-01 status w roadmapie na `done` i doda wpis w `## Done`.

---

## Testing Strategy

### Unit Tests

Brak — test runner nie jest skonfigurowany w projekcie (potwierdzone w CLAUDE.md: "No test runner is configured yet"). Możliwa przyszła decyzja, ale nie blokuje F-01. Walidacja shape'u Zod schemas robiona manualnie w Phase 2 manual verification (REPL-style `safeParse` z poprawnymi i błędnymi inputami).

### Integration Tests

Manual via curl w Phase 3 manual verification — pokrywa: happy path (POST + GET), 401 (brak auth), 400 (Zod validation), filter `in_library`, RLS isolation między dwoma userami. Te same scenariusze powtórzone na local dev oraz deployed Workerze.

### Manual Testing Steps

1. `bunx supabase start` (jeśli używasz lokalnego Supabase)
2. `bun run dev` w jednym terminalu
3. Otwórz `http://localhost:4321/auth/signup`, zarejestruj testowego usera; po confirm-email → signin → dashboard działa (smoke z istniejącego flow)
4. Wyciągnij session cookie z DevTools → użyj w curl
5. Wykonaj 5 scenariuszy z Phase 3 Manual Verification
6. Powtórz na prod URL po `wrangler deploy`
7. Drugi user → RLS isolation check

## Performance Considerations

PRD scale: ~100 użytkowników, kilkadziesiąt linków per użytkownik. Brak paginacji w `GET /api/links` jest świadomy. Index `(user_id, created_at DESC)` zapewnia <10ms query latency dla baz <10K linków/user (zweryfikowane na podstawie Postgres heuristics dla single-column-then-timestamp composite). Jeśli któryś user wyhoduje >1000 linków, paginacja (cursor lub offset) dochodzi w przyszłej iteracji — najpewniej tuż przed S-03 NL search staje się too-slow.

Cloudflare Workers free-tier CPU limit (10ms) nie jest ryzykiem dla F-01 — endpointy są I/O-bound (Supabase HTTP call), zero in-Worker computation. Per `context/foundation/infrastructure.md` Devil's Advocate — Worker pozostaje pure HTTP orchestrator.

## Migration Notes

To pierwsza migracja domeny — brak istniejących danych do migracji.

**Apply order:**
1. Local: `bunx supabase db reset` (czysty stan dev — bezpieczne, brak danych do utraty)
2. Verify: `bunx supabase db diff` — pusta diff oznacza że schema lokalny matchuje migrations
3. Generate types: `bun run db:types` (nadpisuje `src/db/database.types.ts`)
4. Commit migration + types together (atomicznie)
5. Apply to prod: `bunx supabase db push` (potrzebny `SUPABASE_ACCESS_TOKEN`; manual step zgodnie z deploy-plan boundary)

**Rollback strategy**: w razie problemu z prod migracją, **nie** używamy `supabase db reset` na prod (destruktywne). Zamiast tego nowa migracja `<timestamp>_drop_links.sql` z `DROP TABLE public.links CASCADE;`. Trigger function `set_updated_at()` pozostaje (re-usable).

## References

- Roadmap entry: `context/foundation/roadmap.md` (F-01 Foundation section)
- PRD NFRs: `context/foundation/prd.md` §Non-Functional Requirements ("Izolacja danych", "Niezawodność zapisu", "Dostępność funkcji core")
- PRD Access Control: `context/foundation/prd.md` §Access Control §Prywatność
- CLAUDE.md: migration naming convention + RLS rule + API zod convention + `prerender = false` rule
- Existing SSR client: `src/lib/supabase.ts:5`
- User resolution source of truth: `src/middleware.ts:11-13` + `src/env.d.ts:3`
- Astro env schema: `astro.config.mjs:18`
- Cloudflare deploy boundary: `context/deployment/deploy-plan.md` §Production-access boundary

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Schema migration + RLS + type generation

#### Automated

- [ ] 1.1 Migration applies cleanly locally (`bunx supabase db reset` + `bunx supabase db diff` empty)
- [ ] 1.2 Migration applies cleanly to remote (`bunx supabase db push` succeeds)
- [ ] 1.3 Generated types file exists and non-empty (`test -s src/db/database.types.ts`)
- [ ] 1.4 `bun run build` passes
- [ ] 1.5 `bun run lint` passes

#### Manual

- [ ] 1.6 Supabase Studio: `links` table z poprawnym schema; RLS enabled; 4 polityki widoczne
- [ ] 1.7 RLS sanity: insert jako user A; user B widzi tylko własne rows
- [ ] 1.8 Remote dashboard pokazuje analogiczny stan
- [ ] 1.9 `package.json` `name` = `tabzero`; `supabase/config.toml` `project_id` = `tabzero`

### Phase 2: Shared types + Zod schemas

#### Automated

- [ ] 2.1 `bun run build` passes (TS check picks up new types)
- [ ] 2.2 `bun run lint` passes
- [ ] 2.3 Imports z `@/types` (`Link`, `CreateLinkInput`, `ListLinksQuery`) rozwiązują się
- [ ] 2.4 Imports z `@/lib/schemas/links` (`CreateLinkSchema`, `ListLinksQuerySchema`) rozwiązują się

#### Manual

- [ ] 2.5 `CreateLinkSchema.safeParse({url:"https://example.com"})` → success
- [ ] 2.6 `CreateLinkSchema.safeParse({url:"not a url"})` → failure z ZodError
- [ ] 2.7 `ListLinksQuerySchema.safeParse({in_library:"true"})` → `{data: {in_library: true}}`
- [ ] 2.8 TS autocomplete dla `Link.in_library` (boolean), `Link.micro_description` (string|null), i `Link.processing_status` (ProcessingStatus) działa

### Phase 3: API endpoints

#### Automated

- [ ] 3.1 `bun run build` passes
- [ ] 3.2 `bun run lint` passes
- [ ] 3.3 Endpoint file exists: `src/pages/api/links/index.ts`
- [ ] 3.4 `prerender = false` jest exportowany z endpoint file

#### Manual

- [ ] 3.5 Local POST z session cookie i valid body → 201 z Link
- [ ] 3.6 Local GET z session cookie → `{ links: [...] }` z utworzonym linkiem
- [ ] 3.7 Local GET `?in_library=true` → `{ links: [] }`
- [ ] 3.8 Local POST bez session → 401 `{ error: 'unauthorized' }`
- [ ] 3.9 Local POST z malformed body `{"url":"not-a-url"}` → 400 z ZodError issues
- [ ] 3.10 Deploy `wrangler deploy`; te same 5 scenariuszy curl na prod URL pass
- [ ] 3.11 RLS isolation: drugi user nie widzi linków pierwszego
