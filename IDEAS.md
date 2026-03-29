# Feature Ideas

## 1. "What can I afford?" mode
User enters their budget (e.g. 600K PLN) and the map instantly grays out districts where the median is above their price range, highlights where they can realistically buy, and shows how many m2 they'd get in each district. This alone could make people share the app — "look what 500K gets you in Warsaw."

Could extend with mortgage calculator: "With 20% down and 7% rate, your monthly payment would be X PLN."

## 2. Commute overlay
"Show me apartments within 30min of [my office]." Use OSRM (free, self-hostable, like Nominatim) to calculate isochrones. The #1 question every apartment hunter has, and no Polish tool answers it visually on a map.

Modes: driving, public transit, cycling. Color-code districts by commute time instead of price.

## 3. Rich listing panel (click instead of hover)
Right now hovering shows a tiny tooltip. Clicking a listing marker should open a proper side panel with:
- Photo(s) carousel
- Full price breakdown (total, per m2, vs district average)
- Deal indicator: "12% below avg — good deal" or "18% above avg"
- Room layout, floor, building year if available
- Link to original listing
- "Save" / "Ignore" buttons

Goal: keep people IN the app instead of bouncing to Morizon immediately.

## 4. Price drop alerts / "watch this area"
Alert on price drops, not just "below average." Example: "This apartment in Mokotow dropped from 850K to 790K in 2 weeks." The kind of notification people actually open.

Already have `scraped_at` + `external_id` to detect repricing. Monetization: 3 free alerts, then 29 PLN/month.

## 5. Share a search / collaborate
Apartment hunting is usually done by couples/families. Encode current filters + map view + favorites into a shareable URL. "Hey look at this area, these are the ones I like."

Even just serializing state to URL params would be a start. Later: shared boards with comments.

## 6. Comparison mode
Pin 2-3 apartments and see them side-by-side: price, size, price/m2, district avg, photos, commute time. Simple table layout. Helps with the final decision stage.

## 7. "Only deals" filter
One-click filter to show only listings X% below district average (the green markers). Data already exists, just needs a UI toggle. This is the killer feature for bargain hunters.

## 8. Neighborhood context layer
Toggle overlays showing what's around each listing:
- Metro/tram stops + walking distance
- Parks and green areas
- Schools
- Grocery stores (Biedronka, Lidl, Zabka density)

Use OpenStreetMap POI data (free). Even just metro proximity would be huge.

## 9. Animated price history timelapse
Time-lapse of district colors changing over months. Viral potential — "Watch Warsaw prices change over the last 6 months." Great for social media / marketing content.

## 10. Price per m2 vs. transaction prices (RCN)
Already partially in the app. Make it a hero feature: "Mokotow asks 19,200 PLN/m2, transactions close at 16,800 PLN/m2 — you have 12% negotiation room." Nobody else visualizes this gap per district.
