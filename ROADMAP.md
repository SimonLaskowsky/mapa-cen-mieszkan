# ROADMAP

Żywy dokument — priorytety, status, monetyzacja, konkurencja.
Ostatnia aktualizacja: 2026-04-22

> Nowe luźne pomysły lądują w [`IDEAS.md`](./IDEAS.md). Gdy pomysł dojrzeje do planu → przenosimy tutaj z priorytetem.

---

## Monetyzacja (plan)

- Freemium alerty — 3 darmowe, potem 29 zł/mc
- API dla agencji — 199 zł/mc
- Afiliacja kredyty hipoteczne — 500–2000 zł/lead
- Reklamy agencji nieruchomości

---

## Status

Legenda: ✅ zrobione · 🟡 w trakcie / częściowo · ⬜ TODO

### Krytyczne (okno konkurencyjne)

- ✅ **Ceny transakcyjne RCN vs ofertowe** — scraper `/scraper/src/rcn/`, migracja `006_add_rcn_district_stats.sql`, cron `monthly-rcn.yml`, merge w `/api/districts/geo`, wyświetlanie w `StatsPanel` z % różnicą. Źródło: geoportal.gov.pl/mapy/rejestr-cen-nieruchomosci
- ✅ **Sortowanie ogłoszeń** — `ListingsPanel.tsx`: ZŁ/M² ↑, PRICE ↑, NEW
- ✅ **Otodom scraper** (2026-04-22) — rewrite `scraper/src/scrapers/otodom.ts` używając `__NEXT_DATA__` payload. Dane bogatsze niż Morizon: GPS precyzyjne, rok budowy, typ budynku, typ ogrzewania, market primary/secondary, czynsz administracyjny, tagi (klimatyzacja/garaż). Test na Katowicach: 67 listingów z 2 stron przy 100% success rate. Podpięte do `src/index.ts` obok Morizona → szacunkowo **+140% więcej danych**. Fix przy okazji: `normalizeDistrict` + `getDistrictMappings` — polish-char stripping (ł→l) i collapse double-dashes
- ⬜ **Email capture** — formularz „Dostaj alerty o okazjach w [dzielnica]" zanim feature istnieje. Buduje listę przed monetyzacją. Resend / Mailchimp

### Wysoki priorytet (monetyzacja + wzrost)

- ⬜ **Historia zmian cen per ogłoszenie** — główna funkcja Zametr. Scraper ma już `scraped_at` + `external_id`. Wystarczy nie kasować starych wpisów, tylko archiwizować zmianę ceny. W karcie ogłoszenia: „Cena 14 dni temu: 850 000 zł → dziś 820 000 zł (−3,5%)"
- 🟡 **Yield jako tryb mapy (Investor View)** — yield jest liczony w API i wyświetlany w `StatsPanel` (card dzielnicy + city stats). Brakuje trybu mapy: heatmapa kolorowana wg gross yield % zamiast ceny. Toggle „Price / Yield" na warstwie kolorów. Żaden konsumencki tool w PL tego nie robi
- ⬜ **Alerty email „poniżej średniej"** — „Nowe ogłoszenie w Mokotowie 15% poniżej średniej dzielnicy". Dane już to wspierają (kolor markera = czy jest deal). Monetyzacja: 29 zł/mc
- ✅ **Więcej miast** — Gdańsk, Poznań, Łódź dodane (łącznie 7 miast: Warsaw, Kraków, Wrocław, Katowice, Gdańsk, Poznań, Łódź). Zametr ma 9 — dogonić resztę

### Średni priorytet (features + UX)

- ✅ **Thumbnails ogłoszeń** — w `ListingsPanel`
- ✅ **Ulubione / ignorowane ogłoszenia** — localStorage, filtrowanie, sortowanie z prymatem favs
- ⬜ **Prognozowanie trendów** — ekstrapolacja („w obecnym tempie dzielnica osiągnie X zł/m² w Q3")
- ⬜ **Animacja historii cen** — time-lapse zmiany kolorów dzielnic w czasie. Potencjał viralowy
- ⬜ **Porównywarka dzielnic** — pin 2–3 dzielnice side-by-side ze wszystkimi statystykami
- ⬜ **Filtr „tylko okazje"** — pokaż tylko ogłoszenia X% poniżej średniej dzielnicy (zielone markery). Dane są, brakuje UI

### Niski priorytet

- ⬜ Scoring jakości okolicy — szkoły, transport, tereny zielone (overlay)
- ⬜ Cena za m² vs czas dojazdu do centrum / wybranego miejsca pracy
- ⬜ PWA / mobile app
- ⬜ Płatności (Stripe)
- ⬜ API dla agencji (199 zł/mc)

---

## Konkurencja (stan na kwiecień 2026)

| Tool | Główna funkcja | Cena | Nasze przewagi vs nich |
|------|---------------|------|------------------------|
| **Zametr** (zametr.pl) | Historia zmian cen per ogłoszenie, alerty email, RCN | 49 zł jednorazowo | My: polygon heatmap dzielnic, sprzedaż/wynajem, yield per dzielnica. Oni: historia cen per ogłoszenie, 9 miast. UWAGA: w grudniu 2025 dodali mapę z overlay — sprawdzić czy mają polygon heatmap |
| **Otodom Analytics** | Pełna analityka, segmentacja popytu, heatmapy popytu | B2B tylko | Mają najlepsze dane, ale celowo blokują konsumentów. My możemy być ich darmową alternatywą |
| **SonarHome** | Wycena AVM pojedynczej nieruchomości (AI) | Bezpłatnie | My: analityka obszarów, nie nieruchomości. Nie konkurujemy bezpośrednio |
| **ceny.szybko.pl** | Podstawowe mapy cen z pinami | Bezpłatnie | My: polygon heatmap, trend 6M, filtry, ogłoszenia na mapie |
| **Cenatorium** | Ceny transakcyjne — baza B2B | B2B | Niekonkurencyjne, inny segment |
| **BestYieldFinder** | Rental yield per miasto/województwo | Bezpłatnie | My: per dzielnica, interaktywna mapa, dane na żywo |
| **RCN (geoportal.gov.pl)** | Oficjalny rejestr cen transakcyjnych | Bezpłatnie (od lut 2025) | Surowe dane, nieczytelne. My wizualizujemy per dzielnica ✅ |

**Nasza unikalna pozycja**: interaktywny polygon heatmap dzielnic + sprzedaż/wynajem + yield + RCN gap = unikalne w segmencie konsumenckim w Polsce.

---

## Jak aktualizować ten dokument

- Po ukończeniu zadania → zmień ⬜/🟡 na ✅ i dopisz datę oraz link do commita/PR jeśli warto
- Nowy pomysł → najpierw do `IDEAS.md`. Jak dojrzeje do priorytetu → przenosimy tutaj
- Zmiana priorytetu / skreślenie zadania → zostawiamy krótki powód przy pozycji
- Raz na miesiąc update daty na górze + review czy konkurencja się ruszyła
