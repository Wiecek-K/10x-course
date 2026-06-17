---
title: "Zgłaszanie błędów scrapowania (ciche porażki + LLM-sędzia) jako korpus do rozwoju flow scrapowania"
date: 2026-06-16
slice: null
trigger: Inspired by current work (youtube-metadata-description — jakość scrapingu)
status: raw
---

**Value:** Wartość głównie dla nas (buildersów), nie dla end-usera bezpośrednio: budujemy korpus/bazę zgłoszeń przypadków, gdzie obecne rozwiązanie scrapowania nie daje rady — zarówno cichych porażek (status `done`, ale treść zła, np. zescrapowano tylko nawigację), jak i tych już oznaczonych `failed` przez scraper. Te dane pozwalają realnie rozwijać flow scrapowania (priorytet tierów FR-004, dobór dostawców, kalibracja LLM-sędziego) na podstawie tego, co faktycznie zawodzi, zamiast zgadywać.

**Pełny pomysł:** Wprowadzić w aplikacji możliwość zgłaszania błędów — linków, gdzie scraper błędu nie zgłosił i status linku jest poprawny (`done`), ale użytkownik stwierdza, że scrapowanie i tak nie przebiegło pomyślnie (np. nie zescrapowano właściwej treści strony). Zapisy zgłoszeń umieścić gdzieś obok automatycznie zapisanych linków, przy których sam scraper od razu zgłosił, że nie da rady (`failed`) — jedno miejsce "do poprawy". Opcjonalnie: po scrapowaniu wpiąć jeszcze LLM w roli sędziego, który sprawdza, czy zescrapowana zawartość jest poprawna, czy też zescrapowano jedynie nawigację — automatyczne łapanie cichych porażek bez czekania na zgłoszenie usera.

**Powiązania:** rozwój S-02 (`auto-description-pipeline`); zasila parkowane itemy roadmapy — pełne 3-tier scraping, wybór paid proxy "po dogfoodingu na podstawie danych co Firecrawl realnie pomija". Ten korpus = te dane.
