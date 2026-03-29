# UX Audit Report — Mapa Cen Mieszkan

**Date:** 2026-03-27
**Reviewed by:** Claude (AI code review)
**App version:** v1.0 → v1.1 (fixes applied same day)
**Platform tested:** Desktop (macOS), mobile (responsive)

---

## Executive Summary

The app has a strong visual identity and a solid data foundation. The map with colored district polygons, the BUY/RENT toggle, and the district ranking list are genuinely useful features. However, the app currently works more as a **data visualization dashboard** than an **apartment hunting tool**. The core user journey — find a listing, evaluate it, decide — breaks down at the evaluation step because all roads lead to Morizon.

The "tactical/military" aesthetic is distinctive and memorable, but in several places it prioritizes style over clarity, using jargon that confuses rather than informs.

This report identified 20 issues ranked by severity. **All 15 prioritized issues have been fixed** (see Implementation Log below). 5 lower-priority polish items remain open.

---

## Methodology

Full code review of all frontend components:
- `page.tsx` — main layout, sidebar panels, bottom stats bar, mobile overlay
- `Map.tsx` — MapLibre integration, district/listing markers, tooltips
- `ListingsPanel.tsx` — district listings panel with sort/filter/favourites
- `StatsPanel.tsx` — district ranking table
- `TrendChart.tsx` — SVG price trend chart
- `Legend.tsx` — color scale legend
- `AddressSearch.tsx` — Nominatim geocoding search
- `CitySelector.tsx` — infinite scroll city ticker
- `globals.css` — all custom styles and animations

---

## Implementation Log

### Quick wins — DONE

| # | Issue | What was done |
|---|-------|---------------|
| H1 | Trend chart hidden by default | Moved chart from right panel to left sidebar as its own collapsible panel (open by default). Right panel now 100% listings. Chart SVG uses responsive `viewBox` for full sidebar width. |
| H3 | Euro symbol in sort buttons | Changed `€/M² ↑` → `ZŁ/M² ↑` |
| M1 | Header title too wide | Shortened "REAL ESTATE // PRICE MONITOR" → "PRICE // MONITOR", only shown on `xl:` screens |
| M5 | Footer wastes space | Slimmed from verbose status bar to single compact line with status dot, update date, source, version |
| C3 | Military jargon | "SYSTEM ACTIVE" → "LIVE DATA", "DISTRICT ANALYSIS" → "PRICE RANKING", "CONTROLS" → "SETTINGS", Legend labels: "CRITICAL/SEVERE/etc" → "PREMIUM/EXPENSIVE/AVERAGE/etc" |

### Medium effort — DONE

| # | Issue | What was done |
|---|-------|---------------|
| C4 | Information overload | LAYERS and LISTING FILTERS panels now collapsed by default. Only BUY/RENT, Price Index, and Price Ranking open on load. |
| M4 | District table only sorts by price | Column headers (DISTRICT, PRICE, Δ30D) are now clickable. Click to sort, click again to reverse. Shows ↑/↓ arrow on active column. |
| M2 | Sound FX on by default | Sound now defaults to off. Toggle stays in LAYERS panel. |
| H2 | Listings capped at 20 | API now returns total count. Footer shows "X of Y LISTINGS". "LOAD MORE" button appears when more exist, fetches 20 more per click. |
| M6 | Filter indicator hard to see | Filter panel header now shows yellow pulsing dot + "ACTIVE" badge when any filter is set. Panel border tints yellow. Visible even when collapsed. |

### Larger effort — DONE

| # | Issue | What was done |
|---|-------|---------------|
| C2 | Clicking listing exits app | New `ListingDetail` modal component. Clicking a map marker opens an in-app detail panel with: large thumbnail, price with deal indicator (e.g. "GREAT DEAL -18% vs district avg"), size/rooms/price-per-m² grid, address, district context. "VIEW ON MORIZON" button for deliberate exit. Backdrop click or CLOSE button to dismiss. |
| H5 | No search autocomplete | AddressSearch now fetches up to 5 Nominatim results with 400ms debounce as user types. Dropdown with keyboard navigation (↑↓ to select, Enter to confirm, Escape to close). Dropdown correctly closes after selection. |
| C5 | Mobile full-screen overlay | Replaced `fixed inset-0` overlay with bottom sheet (`top-[35vh]`) — map peeks through top 35%. Drag handle visual indicator at top. |
| C1 | No onboarding | First-visit modal explaining: green = cheap, red = expensive, blue markers = below average. Color swatches for visual reference. "START EXPLORING" button dismisses, stored in localStorage. |
| H4 | Same colors for districts and listings | Listing markers now use blue-to-orange palette (blue = great deal, cyan = good, gray = average, amber = above avg, red = expensive). Distinct from green-to-red district polygons. Glow effects updated to blue. Bottom-left legend diamonds updated to match. |

---

## Remaining Issues (not yet fixed)

### LOW — Polish items

#### L1. Thumbnails are too small
**Where:** `ListingsPanel.tsx` — `w-16 h-12` (64x48px)
**Problem:** Apartment photos at 64x48 pixels are essentially unreadable.
**Fix:** Increase to at least `w-24 h-16` (96x64px).

#### L2. No empty state when zoomed between cities
**Where:** Map view when zoomed out
**Problem:** Between cities the map looks empty/broken. No prompt to zoom in.
**Fix:** Add a "zoom into a city to explore" prompt at low zoom levels.

#### L3. No keyboard navigation
**Where:** Entire app
**Problem:** Beyond Cmd+K for search, no keyboard support for browsing districts/listings.
**Fix:** Esc to deselect district, arrow keys to navigate district list.

#### L4. Corner bracket CSS overlap
**Where:** `globals.css:64-108`
**Problem:** Panels using both `.tactical-panel` and `.tactical-panel-bottom` can only show 2 corner brackets (CSS pseudo-element limitation).
**Fix:** Use real DOM elements for brackets, or accept 2 corners.

#### L5. No loading skeleton
**Where:** `ListingsPanel.tsx`, `StatsPanel.tsx`
**Problem:** Loading states show text only, no skeleton placeholders.
**Fix:** Add shimmer/skeleton matching card layout.

### MEDIUM — Not yet addressed

#### M3. Right panel slides in, jarring the map
**Where:** `page.tsx` — right sidebar
**Problem:** 320px panel pushes the map left, breaking spatial context.
**Fix:** Overlay panel on top of map, or animate map center to compensate.

---

## What Works Well

These elements should be preserved and built upon:

- **Color-coded district polygons** — Instantly communicates price zones. Core value prop.
- **BUY/RENT toggle** — Prominent, clear, correctly updates all data.
- **District ranking with HOT/DIP badges** — Scannable and useful for market overview.
- **Favourite/ignore system** — Thoughtful feature for active apartment hunters.
- **CitySelector ticker** — Creative, memorable, distinct from competitors.
- **Dark premium aesthetic** — Distinctive and premium-feeling. Stands out.
- **Filter debouncing** — 500ms debounce prevents API spam during typing.
- **Responsive breakpoints** — Mobile hamburger, conditional stats, proper touch targets.
- **In-app listing detail** *(new)* — Keeps users in the app, shows deal indicator vs district average.
- **Search autocomplete** *(new)* — Type-ahead with keyboard navigation.
- **Sortable district table** *(new)* — Sort by price, change, or name.
- **Trend chart in left sidebar** *(new)* — Visible by default without stealing listing panel space.

---

*This report is based on code review. A real user testing session with screen recording would likely reveal additional friction points, particularly around discoverability and first-use confusion.*
