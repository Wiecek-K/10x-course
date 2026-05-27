Po zainstalowaniu rozszerzenia przeglądarki [Web Clipper](https://obsidian.md/pl/help/web-clipper) możesz uzyskać do niego dostęp na kilka sposobów, w zależności od przeglądarki:

1.  Ikona Obsidian na pasku narzędzi przeglądarki.
2.  Skróty klawiszowe, aby aktywować rozszerzenie z klawiatury.
3.  Menu kontekstowe, klikając prawym przyciskiem myszy odwiedzaną stronę internetową.

Aby zapisać stronę w Obsidian, kliknij przycisk **Zapisz w Obsidian**.

## Przechwytywanie strony

Po otwarciu rozszerzenia Web Clipper wyodrębnia dane z bieżącej strony internetowej zgodnie z ustawieniami w Twoim [szablonie](https://obsidian.md/pl/help/web-clipper/templates). Możesz tworzyć własne szablony i dostosowywać wynik za pomocą [zmiennych](https://obsidian.md/pl/help/web-clipper/variables) i [filtrów](https://obsidian.md/pl/help/web-clipper/filters).

Domyślnie Web Clipper próbuje inteligentnie wyodrębnić jedynie główną treść artykułu, z wyłączeniem innych elementów na stronie. Możesz jednak zmienić to zachowanie w następujący sposób:

- Jeśli istnieje niestandardowy szablon, zostanie użyty Twój szablon.
- Jeśli jest zaznaczony fragment tekstu, zostanie użyte zaznaczenie. Możesz użyć `Ctrl/Cmd+A`, aby zaznaczyć całą stronę.
- Jeśli istnieją jakiekolwiek [wyróżnienia](https://obsidian.md/pl/help/web-clipper/highlight), zostaną one użyte.

## Pobieranie obrazów

Obrazy nie są automatycznie pobierane podczas korzystania z Web Clipper. Zamiast tego obrazy zawierają link do ich internetowego adresu URL. Oszczędza to miejsce w skarbcu, ale oznacza, że obrazy nie będą dostępne offline ani gdy adres URL przestanie działać.

Możesz pobrać obrazy dla dowolnego pliku w Obsidian za pomocą [polecenia](https://obsidian.md/pl/help/plugins/command-palette) o nazwie **Pobierz załączniki aktywnego pliku**. To polecenie można również przypisać do skrótu klawiszowego w Obsidian.

## Skróty klawiszowe

Web Clipper zawiera skróty klawiszowe, których możesz używać, aby przyspieszyć swoją pracę. Aby zmienić mapowania klawiszy, przejdź do **Ustawienia Web Clipper** → **Ogólne** i postępuj zgodnie z instrukcjami dla swojej przeglądarki. Mapowania można zmienić we wszystkich przeglądarkach z wyjątkiem Safari, które nie obsługuje edycji skrótów klawiszowych.

| Akcja               | macOS         | Windows/Linux  |
| ------------------- | ------------- | -------------- |
| Otwórz clipper      | `Cmd+Shift+O` | `Ctrl+Shift+O` |
| Przechwyć           | `Opt+Shift+O` | `Alt+Shift+O`  |
| Przełącz zakreślacz | `Opt+Shift+H` | `Alt+Shift+H`  |
| Przełącz czytnik    | `Opt+Shift+R` | `Alt+Shift+R`  |

## Funkcje interfejsu

Interfejs Web Clipper jest podzielony na cztery sekcje:

1.  **Nagłówek**, w którym możesz przełączać szablony, włączać [wyróżnianie](https://obsidian.md/pl/help/web-clipper/highlight), [tryb czytania](https://obsidian.md/pl/help/web-clipper/reader) oraz uzyskać dostęp do ustawień.
2.  **Atrybuty** pokazują [metadane](https://obsidian.md/pl/help/properties) wyodrębnione ze strony, które zostaną zapisane jako [Atrybuty](https://obsidian.md/pl/help/properties) w Obsidian.
3.  **Treść notatki**, która zostanie zapisana w Obsidian.
4.  **Stopka** pozwala wybrać skarbiec i folder oraz zapisać w Obsidian.

Funkcje nagłówka obejmują:

Funkcje stopki obejmują:

- Przycisk **Zapisz w Obsidian** do zapisywania danych w Obsidian.
- Rozwijane menu **Sejf** do przełączania między zapisanymi sejfami dodanymi w ustawieniach Web Clipper.
- Pole **Folder** do określenia folderu, w którym ma zostać zapisany plik.
- **Tłumacz** do uruchamiania [zapytań w języku naturalnym](https://obsidian.md/pl/help/web-clipper/interpreter) na stronie.
