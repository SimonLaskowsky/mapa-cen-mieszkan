# Mapa Cen Mieszkań

Interaktywna mapa cen nieruchomości w Polsce z danymi agregowanymi z portali ogłoszeniowych.

## Features

- Heat map cen za m² w dzielnicach
- Historia cen (trendy)
- Alerty o spadkach cen
- Porównanie dzielnic

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **Mapy:** MapLibre GL JS
- **Database:** Supabase (PostgreSQL)
- **Scraping:** Playwright + GitHub Actions

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Run scraper manually
pnpm scrape
```

## Architecture

See [CLAUDE.md](./CLAUDE.md) for detailed architecture documentation.

## License

MIT
