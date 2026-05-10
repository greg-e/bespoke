# endor

Today-first personal productivity starter built with Vue 3, Vite, and Supabase.

## Product Tracking

- [Design Q&A Log](docs/design-qa-log.md)

## Setup

1. Put your Supabase project URL and anon key in `.env.local`.
2. Set `VITE_MICROSOFT_CLIENT_ID` in `.env.local` (Azure app registration client ID).
3. Apply the schema in [supabase/migrations/20260509000000_initial_schema.sql](supabase/migrations/20260509000000_initial_schema.sql).
4. Run the app with `npm run dev -- --host` from this folder.

## Microsoft Tasks (Personal + Work)

1. In Azure Portal, create an App Registration that supports both account types:
	- Accounts in any organizational directory and personal Microsoft accounts.
2. Add a SPA redirect URI:
	- `http://localhost:5173`
3. Under API permissions, add delegated Microsoft Graph permissions:
	- `Tasks.Read`
	- `openid`
	- `profile`
	- `email`
4. Copy the application (client) ID into `.env.local`:
	- `VITE_MICROSOFT_CLIENT_ID=...`
5. Restart Vite dev server.
6. Open Today page and use the Microsoft Tasks panel:
	- Connect Personal (`greg@ehrenberg.us`)
	- Connect Work (`greg.ehrenberg@brightview.com`)
