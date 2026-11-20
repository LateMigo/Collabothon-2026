# ROLA I KONTEKST

Wciel się w rolę Senior Full-Stack Software Architecta (Python/FastAPI + React). Tworzysz kompletny, działający szkielet (MVP) webowej aplikacji edukacyjnej na hackathon **„Finance Quest”** pod hasłem **„Innovations for all generations”**.

Zespół ma mniej niż 48 godzin. Kod musi być **czysty, modułowy, gotowy do natychmiastowego uruchomienia lokalnie** i pozbawiony zbędnego narzutu, ale jednocześnie musi demonstrować **realną architekturę produkcyjną („how to get there”)** — z wyraźnym rozdzieleniem warstw, walidacją po stronie serwera, niezależną warstwą danych, silnikiem kolejki zdarzeń opóźnionych, śledzeniem historii decyzji gracza oraz przygotowanymi punktami rozszerzeń (Day-2 hooks), a nie zwykłą makietę frontendową.

---

# BEZWZGLĘDNE OGRANICZENIA I ZASADY REPOZYTORIUM

1. **ZAKAZ PLIKÓW LICENCYJNYCH:** Projekt **NIE MOŻE** zawierać żadnego pliku licencji (`LICENSE`, `LICENSE.md`, MIT, Apache itp.) ani nagłówków licencyjnych w kodzie. W `package.json` pomiń pole `"license"`.
2. **BRAK PUSTYCH ZASTĘPNIKÓW W MVP:** Wszystkie funkcje z sekcji **Zakres MVP** (w tym system wydarzeń wielowątkowych z opóźnieniem rynkowym, wykres giełdowy, zakup i sprzedaż akcji, dywidendy, czynsz, ryzyko bankructwa oraz końcowa analiza ruchów gracza) muszą mieć pełny, działający kod bez `// TODO` czy skrótów typu `...reszta kodu...`. Wyjątkiem są wyraźnie oznaczone punkty rozszerzeń z sekcji **Skalowalność (Day 2)**.
3. **JĘZYK APLIKACJI (100% ANGIELSKI):** Cały interfejs użytkownika (UI), komunikaty AI, dane w `game_data.json`, komentarze w kodzie oraz `README.md` muszą być w **języku angielskim**. Kod (nazwy zmiennych, klas, endpointów) również pisz po angielsku.
4. **FIKCYJNE UNIWERSUM:** Wszystkie firmy, kraje, waluty (fikcyjny dolar `$`), osoby i wydarzenia muszą być w 100% zmyślone (bezpieczeństwo edukacyjne w duchu gry *BitLife*).

---

# 1. KONCEPCJA GRY I UNIWERSALNA DOSTĘPNOŚĆ

* **Formuła:** Turowa gra edukacyjna ucząca podstaw inwestowania, zarządzania płynnością (czynsz, dywidendy) oraz krytycznej analizy informacji i opóźnionych reakcji rynku (Week 1 -> Week 2 -> ... -> Week 6).
* **Deterministyczny przebieg:** Scenariusz tygodniowy (minimum 6 tygodni) jest sztywno oskryptowany w pliku konfiguracyjnym `game_data.json`, aby zapewnić pełną kontrolę nad prezentacją przed jury.
* **Uniwersalny design (Universal Design — bez podziału na grupy wiekowe):**
  * Aplikacja **NIE** dzieli użytkowników na profile wiekowe ani nie pyta o wiek przed grą. Zamiast tego od początku jest zaprojektowana uniwersalnie — zrozumiała, klarowna i pozbawiona zbędnego żargonu zarówno dla młodszych, jak i starszych graczy.

---

# 2. STACK TECHNOLOGICZNY I ARCHITEKTURA („HOW TO GET THERE”)

* **Backend:** Python 3.11+, **FastAPI**, Pydantic v2, Uvicorn, `python-dotenv`, `google-genai` (oficjalne SDK Google AI Studio / Gemini API).
  * **Zarządzanie stanem sesji:** Abstrakcja repozytorium sesji (`SessionStore` w pamięci z czystym interfejsem gotowym pod przyszłą podmianę na Redis/PostgreSQL). Stan sesji przechowuje m.in.:
    * portfel gracza, gotówkę, `monthly_rent`, `previous_monthly_rent`,
    * `price_history` oraz bieżący stan spółek (ceny, `dividend_per_share`, `bankruptcy_risk`, `is_bankrupt`),
    * kolejkę `pending_effects`,
    * **rejestr decyzji gracza (`action_log` / `weekly_snapshots`)**: dokładną historię każdej transakcji kupna/sprzedaży (tydzień, spółka, liczba akcji, cena, typ operacji), użyć doradcy, otrzymanych dywidend, zapłaconego czynszu oraz stanu gotówki na koniec każdego tygodnia — wykorzystywaną do końcowej analizy edukacyjnej.
  * **Separacja danych od logiki:** Wszystkie spółki, branże, tygodnie, wydarzenia, zmyłki i efekty znajdują się wyłącznie w `backend/data/game_data.json`. Kod silnika symulacji nie może mieć zahardkodowanych nazw firm ani wydarzeń.
  * **Konfiguracja CORS:** Skonfigurowana w FastAPI dla lokalnego adresu Vite (`http://localhost:5173`).
* **Frontend:** **React (Vite) + czysty HTML i CSS** (CSS Variables do obsługi motywu domyślnego i trybu High Readability; wykres giełdowy zbudowany jako lekki komponent SVG w czystym React/CSS). **NIE używaj** ciężkich bibliotek UI (MUI, Chakra, Bootstrap, Tailwind).
* **Integracja z Google AI Studio (Gemini API):**
  * Dedykowany serwis `backend/app/services/ai_service.py`.
  * Klucz `GEMINI_API_KEY` oraz nazwa modelu (domyślnie `gemini-2.5-flash`) wczytywane z `backend/.env` (dostarcz plik `backend/.env.example`).
  * **Obowiązkowy tryb Fallback/Mock:** Jeśli brakuje `GEMINI_API_KEY`, wystąpi błąd sieci lub przekroczenie limitu API, serwis automatycznie i bez awarii przełącza się na deterministyczne odpowiedzi zapasowe w prostym, uniwersalnym języku angielskim, oznaczając odpowiedź flagą `ai_source: "gemini" | "fallback"`.
  * **Trzy konkretne role AI w backendzie:**
    1. **Tłumacz żargonu, przyczyn/skutków i mikro-lekcje (po zakończeniu tygodnia):** Backend przekazuje do Gemini API (oraz trybu fallback) zmiany cen, listę `triggered_consequences` wraz z informacją, w którym tygodniu pojawiła się pierwotna wiadomość (`source_week`), oraz zdemaskowane zmyłki. Prompt dla Gemini musi wymuszać, aby krótkie, zrozumiałe w 2 minuty podsumowanie tury (w przystępnym, uniwersalnym języku angielskim) podkreślało mechanizm **opóźnienia rynkowego (market lag)** — wyjaśniając prosto, dlaczego informacja sprzed np. 2 tygodni dopiero teraz podbiła kurs spółki albo podniosła koszty utrzymania (czynsz).
    3. **Końcowa analiza ruchów i coaching edukacyjny (End-of-Game Post-Mortem):** Po zakończeniu gry (po 6. tygodniu lub przy utracie płynności) backend przekazuje do Gemini API (oraz deterministycznego analizatora fallback) cały `action_log` gracza, `weekly_snapshots`, końcowy wynik ROI oraz pełną oś czasu wydarzeń rynkowych. AI zwraca ustrukturyzowaną analizę (JSON/Pydantic):
       * **Podsumowanie stylu gry** (np. ostrożny, agresywny, skoncentrowany na jednej branży, reaktywny),
       * **Mocne strony (`strengths`):** co gracz zrobił dobrze (konkretne odniesienia do jego transakcji i tygodni),
       * **Co można było zrobić inaczej (`improvements`):** konkretne, edukacyjne sugestie zmian na podstawie realnych ruchów gracza (np. zignorowanie sygnału spadku cen surowców w Week 1, brak dywersyfikacji przed pożarem fabryki, brak rezerwy gotówki przed czynszem w Week 4, uleganie szumowi informacyjnemu),
       * **Praktyczne tipy na przyszłość (`actionable_tips`):** 3–4 uniwersalne, konkretne wskazówki finansowe i inwestycyjne do zapamiętania po grze.

---

# 3. SYSTEM WYDARZEŃ WIELOWĄTKOWYCH I SILNIK KOLEJKI OPÓŹNIEŃ (BACKEND)

### A. Ustandaryzowana struktura wydarzeń w `backend/data/game_data.json`

W każdym tygodniu w panelu wiadomości pojawia się kilka wydarzeń (np. 2 kluczowe wydarzenia rynkowo-ekonomiczne + opcjonalny szum informacyjny / zmyłka). Każda spółka w `game_data.json` musi mieć pola: `id`, `name`, `ticker`, `industry` (np. `"food"`, `"energy"`, `"tech"`, `"medtech"`), `main_product`, `initial_price`, `dividend_per_share`, `bankruptcy_risk` (float `0.0–1.0`), `description`, `country`, `owner`, `condition`.

Każde wydarzenie w `game_data.json` musi mieć dokładnie poniższą strukturę:

* `id`: unikalny identyfikator wydarzenia,
* `title`: nagłówek widoczny w panelu bocznym (po angielsku),
* `description`: treść widoczna w panelu bocznym w tygodniu ogłoszenia (po angielsku),
* `is_noise`: `true` / `false` (czy to zmyłka bez efektu rynkowego),
* `effects`: lista jednego lub wielu efektów (pusta dla `is_noise: true`), gdzie każdy obiekt efektu ma pola:
  * `target_type`: `"stock_price"` | `"dividend"` | `"rent"` | `"bankruptcy_risk"`,
  * `target_id`: ID konkretnej firmy, nazwa branży (np. `"food"`) lub `"global"` (np. dla czynszu),
  * `change_type`: `"percent"` (np. `-0.30` = spadek o 30%) lub `"flat"` (np. `+80` do czynszu lub `+0.25` do ryzyka bankructwa),
  * `value`: wartość liczbowej zmiany,
  * `delay_weeks`: liczba całkowita (`0` = efekt natychmiastowy w bieżącym przejściu tury; `1`, `2`, `3` = efekt uruchomi się dopiero za X tygodni),
  * `consequence_text`: krótki komunikat po angielsku wyświetlany dopiero w momencie zadziałania efektu (np. *"The drop in meat prices from 2 weeks ago just boosted restaurant chain margins."*).

### B. Silnik kolejki efektów opóźnionych (`POST /api/sessions/{session_id}/next-week`)

Stan gry posiada tablicę `pending_effects` (kolejka zaplanowanych konsekwencji, przechowująca dodatkowo `source_week`, `source_event_title` oraz wyliczony `trigger_week`).

Podczas przechodzenia do kolejnego tygodnia (`POST /api/sessions/{session_id}/next-week`) backend wykonuje ściśle następującą kolejność:

1. **Aktywacja efektów zaplanowanych na ten tydzień:** Sprawdź wszystkie elementy w `pending_effects`, dla których `trigger_week == current_week`. Zastosuj ich wpływ na ceny akcji, `dividend_per_share`, `monthly_rent` lub `bankruptcy_risk`, zapisz je do listy `triggered_consequences` (z metadanymi `source_week` i `is_delayed: true` do wyświetlenia graczowi i wysłania do AI), a następnie usuń z kolejki `pending_effects`.
2. **Pobranie nowych wydarzeń na bieżący tydzień:** Pobierz ze scenariusza bieżące wydarzenia (2 główne wydarzenia + zmyłki):
   * Efekty z `delay_weeks == 0` (np. pożar fabryki firmy X -> natychmiastowy spadek akcji o 35%) zaaplikuj od razu i dopisz do `triggered_consequences` (z flagą `is_delayed: false`).
   * Efekty z `delay_weeks > 0` (np. spadek cen mięsa -> rynek reaguje za 2 tygodnie) wrzuć do `pending_effects` z wyliczonym polem `trigger_week = current_week + delay_weeks` oraz `source_week = current_week`.
3. **Aktualizacja czynszu:** Jeśli aktywował się efekt typu `"rent"` (np. podwyżka cen energii podnosząca czynsz z `$400` do `$480`), nowa stawka `monthly_rent` od razu aktualizuje się w stanie gry (zapamiętując też deltę `rent_delta`) i obowiązuje przy najbliższej płatności miesięcznej.
4. **Pozostałe rozliczenia tury (w tej kolejności):**
   * **Sprawdzenie bankructw:** Jeśli `bankruptcy_risk` spółki przekroczy próg krytyczny (np. `>= 0.85`), spółka ogłasza bankructwo (cena spada do `0`, handel zablokowany, gracz otrzymuje komunikat).
   * **Wypłata dywidend:** Dla każdej aktywnej spółki posiadanej w portfelu dolicz do gotówki gracza `shares * dividend_per_share` (jeśli włączony modyfikator dywidend — domyślnie `True` w MVP).
   * **Aktualizacja `price_history`:** Dopisz aktualne ceny wszystkich spółek dla tego tygodnia do tablicy `price_history` zasilającej wykres giełdowy.
   * **Rozliczenie czynszu:** Gdy `week % 4 == 0` (i włączony jest tryb kosztów życia — domyślnie `True` w MVP), odejmij `monthly_rent` od gotówki gracza i zapisz zdarzenie rozliczenia w podsumowaniu tury.
   * **Zapis snapshotu tury:** Zapisz podsumowanie stanu portfela i wydarzeń do `weekly_snapshots` na potrzeby analizy końcowej.
5. **Generacja podsumowania AI:** Wywołaj `ai_service.generate_week_summary(...)` z listą `triggered_consequences` (w tym `source_week`) i zmianami cen, aby wygenerować 2-minutową mikro-lekcję podkreślającą efekt opóźnienia rynkowego.
6. **Zakończenie gry i analiza ruchów:** Jeśli zakończono ostatni tydzień (Week 6) lub gotówka spadła poniżej zera po opłaceniu czynszu (utrata płynności), oznacz sesję jako `is_game_over = True` i udostępnij szczegółową analizę ruchów przez `GET /api/sessions/{session_id}/final-analysis` (wywołującą `ai_service.generate_final_analysis(...)` z pełnym `action_log` i trybem fallback, który algorytmicznie ocenia dywersyfikację, płynność przed czynszem, reakcję na sygnały opóźnione oraz unikanie bankrutujących spółek).

---

# 4. SZCZEGÓŁOWY ZAKRES FUNKCJONALNY FRONTENDU (REACT + HTML/CSS, UI PO ANGIELSKU)

### A. Ekran startowy (`Onboarding.jsx`)

* Przejrzyste powitanie w grze **Finance Quest** (uniwersalne, bez wyboru grup wiekowych).
* Przełącznik trybu **High Readability Mode** (większa czcionka, wysoki kontrast).
* Wybór trybu gry: aktywny **Single Investor** oraz wyszarzony placeholder z etykietą `"Coming Soon (Phase 2)"` dla trybu **CEO**.
* Sekcja **Gameplay Modifiers (Yes/No)**: `Enable Dividends` (domyślnie `Yes`), `Enable Living Costs / Monthly Rent` (domyślnie `Yes`) — przesyłane przy starcie sesji i obsługiwane przez silnik.

### B. Główny widok gry (Tryb Single Investor)

* **Pasek statusu (`HudBar.jsx`):**
  * Aktualny tydzień (np. `Week 2 / 6`), dostępna gotówka (`Cash`), wartość posiadanych akcji (`Stocks`), całkowita wartość portfela (`Net Worth`), przełącznik `High Readability`.
  * **Dynamiczny wskaźnik czynszu na HUD:** Pokazuje aktualny miesięczny czynsz oraz odliczanie do płatności (co 4 tygodnie, `week % 4 == 0`, np. `Rent due in 2 weeks`). Jeśli wydarzenie zmieniło wysokość czynszu, wyraźnie zaznacz zmianę przy liczniku (np. strzałka w górę i podświetlenie **`Rent: $480 (+$80)`**), aby gracz nie został zaskoczony przed końcem miesiąca.
* **Wykres giełdowy (`StockChart.jsx`):**
  * Czytelny, lekki wykres liniowy w czystym SVG pokazujący `price_history` wszystkich spółek (z legendą, możliwością wyróżnienia wybranej spółki i oznaczeniem tygodni), pozwalający graczowi obserwować skutki wydarzeń natychmiastowych i opóźnionych.
* **Dwustronne karty firm (`CompanyCard.jsx` – efekt 3D Flip Card w czystym CSS):**
  * **Przód karty:** Nazwa firmy, branża, główny produkt, aktualna cena 1 akcji (ze wskaźnikiem % zmiany od poprzedniej tury), dywidenda na akcję (`Dividend/share`), wskaźnik ryzyka bankructwa (`Low` / `Elevated` / `Critical`), liczba posiadanych akcji, przycisk `"Details (Flip)"` oraz przycisk `"Buy / Sell"`.
  * **Tył karty:** Dłuższy opis firmy, fikcyjny kraj działalności, nazwisko właściciela, krótki opis obecnej kondycji firmy oraz przycisk powrotu na przód.
* **Mechanika zakupu i sprzedaży akcji (`TradeModal.jsx`):**
  * Zakładki/przełącznik **Buy** i **Sell**.
  * Gracz wpisuje liczbę akcji (`0` do `X`).
  * **Auto-clamping (Frontend + Backend):** Dla zakupu wartość automatycznie ogranicza się do `Math.floor(cash / share_price)` (oraz `>= 0`); dla sprzedaży ogranicza się do liczby posiadanych akcji.
  * **Przycisk `"Max"`:** Jednym kliknięciem wpisuje maksymalną możliwą liczbę akcji do kupienia lub sprzedania.
* **Panel boczny z wiadomościami (`NewsSidebar.jsx`):**
  * Wyświetla bieżące wydarzenia z tygodnia (`title` i `description`).
  * **KRYTYCZNE:** Backend NIE przesyła w trakcie trwania tury pól `is_noise`, `effects`, dokładnych procentów ani `delay_weeks` — gracz musi sam wydedukować związek przyczynowo-skutkowy na podstawie opisu.
* **Koło ratunkowe – „Investment Advisor” (`AdvisorWidget.jsx`):**
  * Dostępne w ograniczonej liczbie (np. 1 raz na tydzień lub 3 razy na 6-tygodniową grę).
  * **Mechanika ryzyka (brak 100% gwarancji):** Backend losuje z określonym prawdopodobieństwem (np. **70% trafna / 30% błędna**). Przy trafnym losowaniu doradca (AI) korzysta z realnego kontekstu wydarzeń (w tym zaplanowanych w kolejce efektów), przy błędnym — opiera się na szumie informacyjnym (`is_noise`) lub mylnej interpretacji.
  * UI wyświetla jasne ostrzeżenie edukacyjne: *"Remember: even experts make mistakes — advisor hints are not 100% guaranteed."*
* **Podsumowanie tury (`WeekSummaryModal.jsx`) z sekcją `"What Just Hit the Market"`:**
  * **Wyraźny podział na dwa bloki:**
    1. **`"What Just Hit the Market"`** – lista zrealizowanych konsekwencji (`triggered_consequences`), z wyraźnym wizualnym rozróżnieniem efektów natychmiastowych (`"Immediate Effect"`) od opóźnionych — przy każdym efekcie opóźnionym wyświetlaj wyraźny badge, np. **`"Effect from Week 1"`** wraz z tekstem `consequence_text`, aby gracz połączył przeszły news z ruchem na wykresie.
    2. **Financial Recap & Market Lag Lesson** – tabela zmian cen spółek, wypłacone dywidendy, ewentualna płatność czynszu (`week % 4 == 0`), zdemaskowane zmyłki z zakończonej tury oraz **2-minutowa mikro-lekcja z Gemini API** tłumacząca mechanizm opóźnienia rynkowego (market lag).
* **Ekran Podsumowania Gry i Analizy Ruchów (`GameOverScreen.jsx`):**
  * Wyświetlany po zakończeniu 6. tygodnia (lub przy utracie płynności na czynsz).
  * **Główne metryki:** Końcowy kapitał (`Final Net Worth`), zwrot z inwestycji (`ROI %`), suma zarobionych dywidend, zapłacony czynsz, końcowy wykres giełdowy oraz oś czasu transakcji gracza (`Your Trade History`).
  * **Sekcja „Move Analysis & Financial Coaching” (zasilana przez Gemini API / inteligentny Fallback):**
    * Wyświetla etykietę źródła (`AI Coach` / `Smart Offline Analysis`) i podsumowanie stylu inwestycyjnego gracza.
    * **What You Did Well (`strengths`):** lista dobrych decyzji z odniesieniem do konkretnych ruchów gracza.
    * **What You Could Change (`improvements`):** konkretne, przyjazne podpowiedzi edukacyjne pokazujące, jakie decyzje mogły poprawić wynik (np. wykorzystanie opóźnionego sygnału, wcześniejsza dywersyfikacja, utrzymanie poduszki gotówkowej na czynsz).
    * **Practical Investing Tips (`actionable_tips`):** 3–4 zwięzłe karty z poradami finansowymi do zapamiętania na przyszłość.
  * Przycisk `"Play Again"`.

---

# 5. SKALOWALNOŚĆ POD ROZBUDOWĘ (ETAP 2 – TYLKO ARCHITEKTURA I TYPY)

Przygotuj czyste typy Pydantic, enumy i szkieletowe interfejsy (z komentarzami `# DAY-2 HOOK`) bez pełnej logiki biznesowej dla:

1. **Tryb CEO (`GameMode.CEO`):** Model `AdvisorProposal` (2 propozycje inwestycyjne od wyspecjalizowanych doradców, np. CFO vs CTO) oraz `CEODecision` (`invest_first`, `invest_second`, `invest_both`, `invest_none`) + szkielet metody w `game_engine.py`.
2. **Dodatkowe instrumenty finansowe:** Enum `InstrumentType` (`STOCK`, `BOND`, `LOAN`, `TAX`, `BUDGET_ALLOCATION`) w modelu pozycji portfela (MVP używa `STOCK`).
3. **Silnik rekomendacji scenariuszy:** Abstrakcyjny serwis `ScenarioRecommender` w `backend/app/services/recommender.py` z metodą `recommend_scenario(risk_score: float, past_roi: float | None = None) -> str`, zwracającą w MVP domyślny scenariusz z `game_data.json`.

---

# 6. WYMAGANIA CO DO `backend/data/game_data.json` (MINIMUM 6 TYGODNI, PO ANGIELSKU)

Wygeneruj kompletny, spójny i bogaty plik `game_data.json` (wszystkie teksty po angielsku) obejmujący **6 pełnych tygodni rozgrywki**:

* **Parametry startowe:** Gotówka startowa `$2000.0` (aby umożliwić dywersyfikację i opłacenie czynszu w Week 4), początkowy `monthly_rent`: `$400.0`.
* **4 fikcyjne spółki z różnych branż** (m.in. branża `"food"` — np. sieć restauracji/gastronomii, `"energy"`, `"tech"`, `"medtech"`), każda z pełnymi danymi na przód i tył karty, `dividend_per_share` oraz początkowym `bankruptcy_risk`.
* **Konkretne, obowiązkowe wątki rozpisane w 6 tygodniach** (po 2 główne wydarzenia rynkowe + 1 zmyłka `is_noise: true` na każdy tydzień):
  1. **Efekt opóźniony na akcje (branża `"food"`):** W Week 1 pojawiają się wiadomości o spadku cen mięsa i surowców rolnych (`delay_weeks: 2`, `target_type: "stock_price"`, `target_id: "food"`) -> dopiero w Week 3 rosną akcje firmy gastronomicznej z komunikatem `consequence_text`.
  2. **Efekt na czynsz (`"rent"`):** W Week 2 rząd ogłasza podwyżkę akcyzy na energię (`delay_weeks: 1`, `target_type: "rent"`, `target_id: "global"`, `change_type: "flat"`, `value: 80`) -> od Week 3 czynsz rośnie z `$400` do `$480`, co widać na HUD i gracz odczuwa finansowo przy płatności w Week 4.
  3. **Natychmiastowa katastrofa (`delay_weeks: 0`):** W jednym z tygodni (np. Week 3 lub Week 4) dochodzi do pożaru fabryki jednej ze spółek -> dwa powiązane efekty z `delay_weeks: 0`: nagły spadek akcji tej spółki (`stock_price`, np. `-0.35`) ORAZ skokowy wzrost `bankruptcy_risk`.
  4. **Efekt na dywidendy (`"dividend"`):** Wydarzenie (np. rekordowy kwartał lub nowy podatek od zysków kapitałowych) zmieniające wysokość `dividend_per_share` wybranej spółki (natychmiastowo lub z 1-tygodniowym opóźnieniem).
  5. Pozostałe tygodnie (Week 5 i Week 6) domykają otwarte wątki opóźnione i testują zarządzanie portfelem w końcówce rozgrywki.
* Gotowe, uniwersalne teksty fallbackowe po angielsku (bez podziału na wiek) uwzględniające opis efektu opóźnienia rynkowego.

---

# 7. DOKUMENTACJA (`README.md` PO ANGIELSKU)

Stwórz dopracowany plik `README.md` (w języku angielskim) gotowy na GitHuba zawierający:

1. Opis projektu **Finance Quest** i jego wartości dla konkursu *„Innovations for all generations”* (nacisk na uniwersalny design, prosty język i tryb High Readability).
2. Listę zaimplementowanych funkcji MVP (kolejka efektów opóźnionych, wykres giełdowy SVG, czynsz, dywidendy, końcowa analiza ruchów z coachingiem edukacyjnym, tryb High Readability) oraz roadmapę Day 2 (Tryb CEO, obligacje/kredyty, silnik rekomendacji).
3. **Schemat architektury w składni Mermaid** (`flowchart`) wyraźnie pokazujący połączenie:
   `React (Vite + SVG Chart + HUD + Post-Game Coach) <-> FastAPI (Simulation Engine + Pending Effects Queue + Action Log + SessionStore) <-> game_data.json <-> Google AI Studio (Gemini API / Fallback)`.
4. Opis przepływu danych w pojedynczej turze (ze wskazaniem kolejności kroków w `POST /api/sessions/{session_id}/next-week` oraz generacji analizy końcowej).
5. Instrukcję uruchomienia lokalnego krok po kroku (Backend: `venv`, `requirements.txt`, `.env`, `uvicorn`; Frontend: `npm install`, `npm run dev`) oraz informację o 100% działaniu w trybie Fallback AI bez klucza API.

---

# 8. WYMAGANY FORMAT TWOJEJ ODPOWIEDZI

Wygeneruj odpowiedź ściśle według poniższej kolejności, podając **kompletną, gotową do uruchomienia zawartość każdego pliku** (każdy plik poprzedź jego dokładną ścieżką jako nagłówkiem):

1. **Kompletna struktura katalogów** (drzewo ASCII, wyraźnie rozdzielone `backend/` i `frontend/`, **bez żadnego pliku LICENSE**).
2. **Backend (`backend/`)**:
   * `backend/requirements.txt`
   * `backend/.env.example`
   * `backend/data/game_data.json` (kompletne 6 tygodni po angielsku ze wszystkimi typami efektów)
   * `backend/app/models/schemas.py` (modele MVP, kolejka `pending_effects`, `triggered_consequences`, `action_log`, `FinalAnalysisResponse` + typy Day 2)
   * `backend/app/services/data_loader.py`
   * `backend/app/services/session_store.py`
   * `backend/app/services/ai_service.py` (Gemini API + inteligentny fallback dla: 1. mikro-lekcji o market lag, 2. doradcy inwestycyjnego, 3. końcowej analizy ruchów i tipów edukacyjnych)
   * `backend/app/services/game_engine.py` (kolejka efektów opóźnionych, `next_week`, rejestrowanie `action_log` i `weekly_snapshots`, bankructwa, dywidendy, czynsz co 4 tyg., clamping kupna/sprzedaży, doradca, hooki Day 2)
   * `backend/app/services/recommender.py` (szkielet Day 2)
   * `backend/app/api/routes.py` (kompletne endpointy REST, w tym `GET /api/sessions/{session_id}/final-analysis`)
   * `backend/app/main.py` (inicjalizacja FastAPI + CORS)
3. **Frontend (`frontend/`)**:
   * `frontend/package.json` (bez pola `license`)
   * `frontend/vite.config.js`
   * `frontend/index.html`
   * `frontend/src/styles/main.css` (czysty CSS, zmienne trybu domyślnego i High Readability, 3D Flip Card, wykres SVG, badge opóźnionych skutków, podświetlenie zmiany czynszu, sekcja końcowej analizy)
   * `frontend/src/api/client.js`
   * `frontend/src/components/Onboarding.jsx` (uniwersalny start bez wyboru wieku, tryb CEO jako placeholder, modyfikatory, High Readability toggle)
   * `frontend/src/components/HudBar.jsx` (Cash, Stocks, Net Worth, High Readability toggle, dynamiczny wskaźnik czynszu ze strzałką/deltą i licznikiem do płatności)
   * `frontend/src/components/StockChart.jsx` (czysty wykres liniowy SVG z `price_history`)
   * `frontend/src/components/CompanyCard.jsx` (dwustronna karta 3D flip z ryzykiem bankructwa i dywidendą)
   * `frontend/src/components/TradeModal.jsx` (zakup i sprzedaż akcji z auto-clampingiem i przyciskiem `"Max"`)
   * `frontend/src/components/NewsSidebar.jsx` (wyłącznie tytuł i opis, bez zdradzania `delay_weeks` ani `is_noise`)
   * `frontend/src/components/AdvisorWidget.jsx`
   * `frontend/src/components/WeekSummaryModal.jsx` (sekcja `"What Just Hit the Market"` z badge’ami np. `"Effect from Week 1"` + mikro-lekcja AI o market lag)
   * `frontend/src/components/GameOverScreen.jsx` (końcowe statystyki, historia ruchów oraz pełny panel **Move Analysis & Financial Coaching**: mocne strony, sugestie co zmienić i praktyczne tipy)
   * `frontend/src/App.jsx` oraz `frontend/src/main.jsx`
4. **Dokumentacja (`README.md`)** (po angielsku) ze schematem Mermaid.
5. **Krótka checklista testowa (6 kroków)** weryfikująca: efekt opóźniony między Week 1 a Week 3, podwyżkę czynszu w Week 3 i jego rozliczenie w Week 4, natychmiastowy pożar fabryki, tryb High Readability oraz wygenerowanie spersonalizowanej analizy ruchów i tipów na ekranie końcowym.