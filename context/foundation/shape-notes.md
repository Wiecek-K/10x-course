---
project: null
context_type: greenfield
created: 2026-05-26
updated: 2026-05-27
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "pain hierarchy"
      decision: "Dwa bóle MVP: (1) capture friction jako prerequisite; (2) cognitive overhead on start — strach przed zaprojektowaniem systemu upfront. Pozostałe bóle (chaos, utrata kontekstu) są downstream."
    - topic: "product insight"
      decision: "Istniejące narzędzia wymagają systemu upfront. Ten produkt odwraca porządek: zero-friction capture od dnia 0, struktura wyłania się automatycznie."
    - topic: "primary persona"
      decision: "Sam użytkownik (self-learner z wieloma zainteresowaniami — każdy kto lubi pochłaniać treści i rozwijać się w wielu obszarach) + wąska społeczność Discord jako early feedback loop, nie deployment target."
    - topic: "auth model"
      decision: "Email/OAuth login przez gotową bibliotekę. Flat user model — brak ról, każdy użytkownik widzi wyłącznie swoją bazę danych. Prywatność by design."
    - topic: "mobile capture"
      decision: "Bot w komunikatorze (Telegram jako kandydat MVP; platforma TBD — patrz Open Questions). Natywna aplikacja mobilna = v2+."
    - topic: "scale model"
      decision: "BYOK (Bring Your Own Key) dla MVP — użytkownik podpina własny token LLM API. Model pośrednictwa + subskrypcja = v2+ przy monetyzacji."
  frs_drafted: 12
  quality_check_status: accepted
---

<!-- shape-notes.md — written by /10x-shape, consumed by /10x-prd -->
<!-- DO NOT edit manually during an active session; the skill owns this file. -->

## Vision & Problem Statement

Osoba z wieloma równoległymi zainteresowaniami — ktoś kto lubi pochłaniać różne treści, poszerzać wiedzę i zdobywać nowe umiejętności — zapisuje dziesiątki linków tygodniowo z różnych kanałów informacyjnych i traci do nich dostęp, bo istniejące narzędzia albo wymagają zbyt wiele przy samym zapisie, albo wymagają zaprojektowania systemu organizacji zanim cokolwiek zaczniesz. Efekt: chaos list "na później" bez kontekstu, albo blokada na starcie i brak w ogóle.

Istniejące narzędzia (Pocket, Raindrop, Obsidian) zakładają że użytkownik _najpierw_ projektuje system kategorii i tagów, _potem_ zaczyna zapisywać. Ten produkt odwraca ten porządek: capture jest natychmiastowy i zero-friction, a struktura wyłania się automatycznie w tle — bot uczy się użytkownika, proponuje i tworzy kategorie, i pozwala im ewoluować bez ręcznego sprzątania. Konfiguracja Obsidian + Claude jest barierą dla osób niezaawansowanych technicznie; ten produkt ma być dostępny od pierwszego kliknięcia.

## User & Persona

### Primary persona

**Rola:** Ciekawski self-learner z wieloma równolegle żywymi zainteresowaniami — każdy, kto lubi pochłaniać różne treści (artykuły, filmy, podcasty), poszerzać wiedzę i zdobywać nowe umiejętności w wielu obszarach jednocześnie.

**Kontekst:** Intensywnie konsumuje treści online z wielu niezwiązanych ze sobą dziedzin. Ma kilka aktywnych "zajawek" naraz, przeskakuje między nimi w zależności od nastroju i energii. Nie jest zaawansowany technicznie w sensie konfigurowania narzędzi produktywności — ani nie chce być.

**Moment sięgania po produkt:**

- Natrafia na coś interesującego i chce to zapisać w 2 sekundy, bez myślenia gdzie to trafi.
- Chce zacząć ogarniać swoją wiedzę ale orientuje się że "powinien najpierw zaprojektować system" — i blokuje się.
- Wraca po tygodniach/miesiącach szukając czegoś co widział — i nie ma żadnego kontekstu poza tytułem linka.

**Primary persona — to sam autor projektu.** Budowany najpierw dla siebie, z wbudowanym feedback loop przez wąską społeczność discordową.

### Secondary persona

Osoby z serwerów Discord o podobnym profilu: self-learnerzy i knowledge workerzy z wieloma zainteresowaniami. Służą jako early feedback, nie są deployment target MVP.

## Access Control

**Model:** Login email + hasło / OAuth przez gotową bibliotekę auth.

**Role:** Brak ról — flat model. Jeden użytkownik, jedno konto, jedna prywatna baza danych. Żadna funkcjonalność nie wymaga uprawnienia admina.

**Prywatność:** Każdy użytkownik widzi wyłącznie swoje dane. Dostęp do cudzej bazy nie istnieje w żadnym scenariuszu MVP.

**Kanały dostępu (MVP):** rozszerzenie przeglądarki (desktop) + bot Telegram (mobile).

## Success Criteria

### Primary

Użytkownik może zapisać link w ≤ 2 kliknięciach (extension przeglądarkowe lub wiadomość do bota Telegram), zobaczyć automatycznie wygenerowany micro-opis oparty na zawartości strony, i odnaleźć ten link tygodnie później przez zapytanie w naturalnym języku — bez pamiętania tytułu ani URL.

Dowód że MVP działa: użytkownik (autor projektu) korzysta z produktu jako swojego głównego narzędzia do zapisywania linków przez min. 2 tygodnie bez powrotu do poprzednich metod.

### Secondary

Automatyczna kategoryzacja nowo dodawanych linków do istniejących kategorii użytkownika. Każda kategoria ma własny opis (meta-instrukcję) definiujący: (a) co ma do niej trafiać i (b) jak linki wewnątrz powinny być opisywane (styl i głębokość micro-opisu może różnić się per-kategoria). Bot używa tych instrukcji zarówno do routingu jak i do generowania opisów.

*Uwaga: to jest zalążek głównej logiki biznesowej produktu — patrz `## Business Logic` (faza 5).*

### Guardrails

- **Capture musi być zero-friction.** Każdy krok dodany do zapisu linka to ryzyko że użytkownik go pominie. Regresja: jeśli zapisanie linka wymaga więcej niż 2 akcji użytkownika, MVP nie działa.
- **Dane użytkownika są izolowane.** Żaden scenariusz nie może ujawnić linków jednego użytkownika innemu.

## Forward: v2+

Funkcje świadomie wyłączone z MVP — zapisane żeby nie zginęły:

### Capture & import
- Import playlisty YouTube (YouTube Data API)
- Parsowanie historycznych konwersacji z timestampami (WhatsApp export, Telegram history, "wiadomości do siebie")
- Natywna aplikacja mobilna (zastąpi bota Telegram gdy baza użytkowników uzasadni koszt)

### Organizacja & AI
- Jednorazowa propozycja drzewa kategorii po zebraniu N linków (bot analizuje bazę i proponuje strukturę)
- Automatyczna ewolucja kategorii w czasie (bot wykrywa nowe wzorce i proponuje nowe kategorie / scalenie istniejących)
- Mechanizmy uczenia się preferencji użytkownika (pamięć co się podobało, co nie — z argumentacją; inspiracja: "Tańczący z Botami")
- Dobieranie trudności/nastroju treści do aktualnego stanu użytkownika

### Capture — tryb rozszerzony (v2)
- "Zapisz jako" — opcjonalny formularz przy capture z większą kontrolą użytkownika (priorytet, notatka wstępna, ręczna kategoria). Domyślny 2-klikowy zapis pozostaje niezmieniony. Dwa tryby nie wymagają zmiany modelu danych — rozszerzony zapis to po prostu pre-wypełnienie pól które normalnie uzupełnia system.

### Algorytmy behawioralne (v3+)
- Dane z FR-008 (lifecycle linków) + FR-012 (dashboard events) jako zbiór treningowy dla modeli behawioralnych: np. predykcja czy link zostanie pochłonięty czy odrzucony na podstawie historii użytkownika w danej kategorii, dobór trudności/nastroju treści do aktualnego stanu aktywności.

### Monetyzacja & infrastruktura
- Model pośrednictwa API + subskrypcja (trigger: potrzeba monetyzacji przy większej grupie; MVP = BYOK)
- Własny LLM lub fine-tuning modelu (MVP korzysta z zewnętrznych API przez token użytkownika)

### Search & retrieval
- Contextual/semantic search oparty na vector DB (zastąpi LLM brute-force gdy liczba linków przekroczy ~100–200 lub koszt API zacznie boleć)
- Eksport list do YouTube i innych platform

## Functional Requirements

### Capture

- FR-001: Użytkownik może zapisać link przez rozszerzenie przeglądarki w ≤ 2 kliknięciach. Priority: must-have
  > Socrates: Bookmarklet szybszy do zbudowania, omija Chrome Web Store. Rezolucja: nie budujemy od zera — wychodzimy od kodu open-source istniejącego rozszerzenia (Obsidian Web Clipper lub MarkDownload; oba dostępne jako OSS). Na MVP nie potrzebujemy akceptacji Web Store (unpacked extension). Zestaw własnych funkcji definiujemy dopiero gdy wiemy czego nam brakuje w gotowcach.

- FR-002: Użytkownik może zapisać link wysyłając go do bota w wybranym komunikatorze. Priority: must-have
  > Socrates: Telegram był luźnym pomysłem — użytkownik sam z niego nie korzysta; wybór padł na Telegram wyłącznie ze względu na łatwość postawienia bota. Rezolucja: mobile capture zostaje jako must-have; konkretna platforma (Telegram / WhatsApp / inny) to open question — decyzja po weryfikacji co jest najłatwiejsze dewelopersko i czego używa pierwsze grono testowe. Patrz `## Open Questions`.

- FR-003: Użytkownik może zaimportować zakładki z pliku HTML eksportu przeglądarki. Priority: nice-to-have
  > Socrates: Import ujawnia chaos — pierwsze wrażenie to "baza śmieci". Rezolucja: FR pozostaje nice-to-have, ale flow importu dostaje obowiązkowy krok przeglądu: użytkownik widzi listę importowanych linków i może szybko zaznaczyć które zachować a które odrzucić. Nowa propozycja wartości: "pomożemy posprzątać stary chaos" zamiast "przenosimy śmieci do nowego miejsca".

### Processing

- FR-004: System automatycznie pobiera zawartość strony i generuje micro-opis po dodaniu linka. Priority: must-have
  > Socrates: ~30-40% URL niescrapowalnych (paywalle, JS-heavy, YouTube). Rezolucja: trzypoziomowa strategia scrapingu zainspirowana real-world flow: (1) darmowy scraper — stripping HTML tagów, prosta ekstrakcja tekstu; (2) płatny scraper z proxy gdy (1) zablokowany; (3) Web Archive jako fallback gdy oba zawiodą. Dla YouTube i materiałów wideo: zewnętrzne API napisów (np. Rapid Hub) → streszczenie z napisów. Podejście potwierdzone praktycznie (patrz `bot-dancer.md`).

- FR-005: System obsługuje strony niemożliwe do scrapowania bez utraty linka. Priority: must-have
  > Socrates: "Sygnalizuje użytkownikowi" przy każdym błędzie = szum informacyjny + wrażenie broken product. Rezolucja: capture flow (extension, bot) jest całkowicie milczący na błąd scrapowania — link zostaje zapisany bez opisu. Błąd jest sygnalizowany wyłącznie wizualnie w głównej aplikacji (oznaczenie linka). Priorytet capture = szybkość i cisza.

### Organizacja

- FR-006: System proponuje strukturę kategorii użytkownikowi po zebraniu wystarczającej liczby linków, bazując na predefined templates dopasowanych przez LLM do profilu zapisanych treści. Priority: must-have
  > Socrates: Tworzenie kategorii upfront = "Obsidian trap" — użytkownik musi zaprojektować system zanim skorzysta z produktu. Rezolucja: major revision — brak wymagania tworzenia kategorii upfront. Aplikacja przechowuje kilka predefined templates struktury kategorii. Po zebraniu N linków LLM analizuje bazę i dopasowuje najlepiej pasujący template, który proponuje użytkownikowi. Użytkownik może zaakceptować, zmodyfikować lub odrzucić propozycję. Własne kategorie z meta-instrukcjami użytkownik może dodawać w dowolnym momencie jako rozwinięcie zaproponowanej struktury.

- FR-007: Użytkownik może przeglądać swoją bazę linków per-kategoria, w widoku "wszystkie" oraz przez interfejs pseudo-czatu wyszukiwania. Priority: must-have
  > Socrates: Bez kategorii widok "wszystkie" = chronologiczna lista identyczna z Pocket. Rezolucja: micro-opisy generowane przez scraping + interfejs pseudo-czatu jako główny sposób nawigacji (użytkownik zadaje pytanie, system zwraca pasujące linki). Wartość widoczna od pierwszego linka — bez potrzeby istnienia kategorii.

- FR-008: Użytkownik może wykonać świadomą akcję zamknięcia linka z listy "na później" — wybierając jeden z trzech trybów: (1) "pochłonięte — zachowaj w bibliotece" (link przechodzi do stanu referencyjnego, pozostaje searchable), (2) "pochłonięte — zamknij" (link usuwany z bazy, event odnotowany w statystykach), (3) "odrzuć" (link usuwany bez czytania, event odnotowany w statystykach). Każda akcja zamknięcia oferuje opcjonalne pole notatki. Priority: must-have
  > Rewizja (sesja 2): oryginalny FR-008 miał 2 stany (nieprzeczytane/przeczytane). Rozszerzony do 4-stanowego lifecycle po analizie wartości dla dashboardu. Kluczowe ustalenia: (a) "pochłonięte_zamknięte" i "odrzucone" są identyczne w bazie danych (permanentne usunięcie linka) — różnią się wyłącznie w liczniku statystyk; (b) tarcie przy przejściu jest CELOWE — wymusza świadome zarządzanie listą; (c) kliknięcie linka z listy "na później" NIE zmienia stanu — tylko dodaje visual marker i aktualizuje last_visited timestamp; (d) notatka przy akcji zamknięcia jest opcjonalna i seed'uje przyszłą funkcję "second brain".

### Dashboard & Statystyki

- FR-012: Użytkownik może zobaczyć prosty dashboard aktywności per kategoria: liczbę linków w stanie "na później", liczbę akcji zamknięcia per typ (pochłonięte_zachowane / pochłonięte_zamknięte / odrzucone) w wybranym przedziale czasowym (ostatnie 7d / 30d / all-time), oraz datę ostatniego odwiedzenia w danej kategorii (last_visited). Priority: nice-to-have
  > Socrates: Dashboard z pustymi danymi przez pierwsze 2 tygodnie może sprawiać wrażenie broken product. Rezolucja: FR-012 jako nice-to-have — dane zbiera FR-008 od dnia 1 (stany i eventy są w modelu danych od startu), dashboard można dodać gdy jest wystarczająco danych żeby miał sens. Decyzja: jeśli nie starczy czasu w 3-tygodniowym MVP, dashboard wchodzi w sprint post-MVP. Model danych nie wymaga zmian retroaktywnych.

### Search

- FR-009: Użytkownik może wyszukać link zapytaniem w naturalnym języku (LLM przeszukuje micro-opisy i zwraca najlepiej pasujący wynik). Priority: must-have
  > Socrates: Słaba jakość opisów (niescrapowalne linki) = złe wyniki = użytkownik obwinia search. Rezolucja: FR stoi; ryzyko odnotowane. Mitigacja: trzypoziomowy scraping (FR-004) maksymalizuje pokrycie opisami. Osobny wskaźnik jakości opisów do monitorowania po launch.

### Onboarding

- FR-010: Użytkownik może używać aplikacji bez żadnej konfiguracji startowej — linki trafiają do domyślnego "inbox" dopóki nie powstanie struktura kategorii. Priority: must-have
  > Socrates: Inbox rośnie w nieskończoność i staje się kolejnym chaosem. Rezolucja: FR stoi; inbox jest świadomie tymczasowy. Po zebraniu N linków system proponuje strukturę (FR-006) — to jest naturalny trigger do opuszczenia inbox mode.

- FR-011: Użytkownik może skonfigurować lub zmodyfikować strukturę kategorii w dowolnym momencie (podczas onboardingu lub później). Priority: must-have
  > Socrates: Onboarding z konfiguracją kategorii = bariera wejścia. Rezolucja: FR stoi, ale zmieniony kontekst — onboarding NIE wymaga konfiguracji kategorii (patrz FR-010). Konfiguracja kategorii staje się opcjonalnym krokiem onboardingu i jest dostępna w dowolnym momencie. Bariera = zero.

## User Stories

### US-01: Użytkownik zapisuje link podczas przeglądania internetu

- **Given** zalogowany użytkownik z zainstalowanym rozszerzeniem przeglądarki
- **When** natrafia na interesującą stronę i klika ikonę rozszerzenia, następnie potwierdza zapis
- **Then** link pojawia się w jego bazie z automatycznie wygenerowanym micro-opisem; użytkownik dostaje wizualne potwierdzenie w ≤ 3 sekundy

#### Acceptance Criteria
- Zapis wymaga ≤ 2 akcji użytkownika
- Micro-opis jest widoczny w bazie w ciągu max 30 sekund od zapisu
- Jeśli strona jest niescrapowalna — link zapisuje się, opis = "(nie udało się pobrać zawartości)", bez błędu krytycznego

### US-02: Użytkownik szuka czegoś co zapisał miesiąc temu

- **Given** zalogowany użytkownik z co najmniej kilkoma zapisanymi linkami
- **When** wpisuje zapytanie w naturalnym języku (np. "ten artykuł o wzorcach projektowych w Pythonie")
- **Then** system zwraca link(i) które najlepiej pasują do zapytania, nawet jeśli użytkownik nie pamięta tytułu

#### Acceptance Criteria
- Wyszukiwanie działa bez pamiętania dokładnych słów kluczowych z tytułu
- Wynik pojawia się w ≤ 5 sekund
- Przy braku pasujących wyników — komunikat informacyjny, nie pusty ekran

### Second brain
- Automatyczne budowanie notatek/newslettera z zapisanych treści (dwie ścieżki: pełna automatyzacja lub semi-auto z notatkami użytkownika)
- Zapisywanie cytatów bezpośrednio ze strony przez extension
- Agent tekstowy z poziomu głównego ekranu ("dodaj link dotyczący xyz z wczoraj do listy abc")
- Statystyki aktywności (kategorie, zaległości, nadrobione)

## Product Framing

**Typ produktu:** Web app (aplikacja webowa dostępna przez przeglądarkę; extension i bot jako kanały capture, nie osobne produkty).

**Skala użytkowników:** medium — dziesiątki do ~100. MVP celuje w autora projektu + wąską społeczność Discord jako early feedback.

**Timeline:**
- `mvp_weeks: 3`
- `hard_deadline: null`
- `after_hours_only: true`

**Uwaga do skali:** przy zachowaniu modelu BYOK (użytkownik podpina własny token LLM API) skala do ~100 użytkowników nie wymaga zmian infrastrukturalnych. Przejście na model pośrednictwa API + subskrypcja = oddzielna decyzja produktowa; patrz `## Forward: v2+`.

## Business Logic

System dopasowuje każdy nowo zapisany link do kategorii i generuje jego micro-opis zgodnie z regułami per-kategoria oraz wyuczonym stylem opisów użytkownika — bez ręcznej interwencji przy każdym zapisie.

**Co system konsumuje jako wejście:**
- URL linka (z extension lub bota)
- Zawartość strony (pobrany tekst przez scraping, napisy dla wideo)
- Meta-instrukcje kategorii: opis co do niej trafia + oczekiwany styl i głębokość opisu
- Wyuczony styl użytkownika: dwa kubełki przykładów (opisy które się podobały / nie podobały), z których LLM uczy się personalnego głosu — preferowany styl nie jest artykułowany regułą, tylko demonstrowany przykładami (mechanizm z bot-dancer.md)

**Wyjście i jak użytkownik je napotyka:**
- Link pojawia się w bazie już skategoryzowany i opisany, bez żadnej akcji użytkownika po zapisie
- Z czasem opisy brzmią coraz bardziej "jak moje" — system uczy się na podstawie feedbacku i historii

**Uproszczenia MVP vs. target:**
- MVP: per-kategoria meta-instrukcje jako jedyne źródło stylu; jednorazowa propozycja struktury kategorii po zebraniu N linków; styl uczony pasywnie z bazy istniejących opisów
- Target: ciągłe zarządzanie strukturą kategorii przez bota; explicit feedback loop "lubię / nie lubię opis"; personalizacja trudności/nastroju treści do stanu użytkownika

**Dodatkowa reguła (sesja 2) — celowe tarcie przy zamknięciu:**
System celowo wymusza świadome przejście przy zamykaniu linka: użytkownik wybiera jeden z trzech trybów zakończenia i ma opcję dopisania notatki. Kliknięcie linka z listy "na później" nie zmienia jego stanu — jedynie rejestruje wizytę (visual marker + timestamp). Zamknięcie jest zawsze jawną decyzją, nigdy automatyczną. Filozofia: capture = zero tarcia; closure = świadoma akcja. Dane z closures budują historię aktywności per zainteresowanie — fundament przyszłych algorytmów behawioralnych (v3+).

## Non-Functional Requirements

- **Latencja potwierdzenia zapisu.** Użytkownik widzi potwierdzenie że link trafił do bazy w ≤ 2 sekundy od wysłania (przez extension lub bota). Generowanie micro-opisu i kategoryzacja dostarczane są asynchronicznie — nie blokują potwierdzenia zapisu.

- **Niezawodność zapisu.** Każdy link który dotrze do systemu jest zapisywany — awaria scrapingu nie może skutkować utratą linka. Linki bez opisu są wizualnie odróżnialne w interfejsie przeglądania. Użytkownik może ręcznie wprowadzić lub edytować opis dla dowolnego linka.

- **Dostępność funkcji core.** Zapisywanie, przeglądanie i ręczna edycja linków są dostępne niezależnie od stanu modułów AI (scraping, kategoryzacja, wyszukiwanie). Awaria komponentu AI degraduje funkcję AI — nie wyłącza aplikacji.

- **Wsparcie przeglądarek.** Aplikacja webowa działa na dwóch ostatnich major wersjach Chrome i Firefox na desktopie.

- **Izolacja danych.** Linki jednego użytkownika nie są widoczne innemu użytkownikowi w żadnym scenariuszu działania systemu.

## Non-Goals

- **Brak współdzielenia list / team workspaces.** Produkt jest ściśle single-user; żadne linki nie są publiczne ani udostępnialne innym użytkownikom. Sharing = v2+ z osobną decyzją o modelu prywatności.
- **Brak natywnej aplikacji mobilnej.** Mobile capture obsługuje bot w komunikatorze; aplikacja webowa nie jest PWA i nie oferuje trybu offline ani dostępu z home screen.
- **Brak pełnego archiwizowania treści stron.** Zapisujemy link i micro-opis — nie pełną kopię HTML/PDF strony. Jeśli strona zniknie, micro-opis jest jedynym śladem treści.
- **Brak własnego systemu billing i abonamentu.** MVP działa w modelu BYOK — użytkownik podpina własny token LLM API; operator nie zarządza kosztami ani płatnościami użytkowników.
- **Brak gwarancji offline.** Aplikacja wymaga aktywnego połączenia z internetem; żaden widok nie jest dostępny bez sieci.
- **Brak moderacji i content policy.** System nie filtruje ani nie ocenia tego co użytkownik zapisuje; baza linków jest prywatna i nieinspektowana przez operatora.

## Open Questions

1. **Zbieranie metadanych do QA algorytmów kategoryzacji** — przy większej grupie użytkowników przydatne do weryfikacji czy routing i opisy działają poprawnie. Niejasne czy potrzebne w MVP. Do decyzji: (a) czy w ogóle, (b) jakie dane, (c) czy anonimizowane. Blokada: nie — MVP działa bez tego; decyzja po obserwacji pierwszej grupy testowej.

2. **Platforma bota do mobile capture** — Telegram wybrany ze względu na łatwość integracji, ale użytkownik personalnie z niego nie korzysta. Do weryfikacji: która platforma (Telegram / WhatsApp / inny) jest (a) najłatwiejsza dewelopersko i (b) używana przez pierwszą grupę testową z Discorda. Blokada: nie — Telegram jest wystarczający na MVP, decyzja może być zmieniona bez wpływu na architekturę.
