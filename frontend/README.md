# Rowszein's Delight: frontend

React 19 + TypeScript + Vite app for the online shop (`/`) and the management app behind sign-in. See the [project README](../README.md) for what the system does and the [Windows development guide](../docs/LOCAL_DEVELOPMENT.md) for starting the backend.

## Commands

```cmd
npm ci                 # install exactly what package-lock.json lists
npm run dev            # dev server; /api is proxied to Django on port 8000
npm run build          # type-check, then production build into dist/
npm run lint           # ESLint
```

## Where things live

| Path | What it holds |
| --- | --- |
| `src/index.css` | Design tokens (colour, type, spacing, radii, motion) and shared component classes |
| `src/styles/` | Shared form and level-bar styles |
| `src/layouts/` | Owner shell (sidebar, top bar) and the sign-in layout |
| `src/pages/` | One file per page; page-specific parts and styles in a folder of the same topic |
| `src/pages/shop/` | The public online shop |
| `src/hooks/`, `src/services/` | Data fetching (TanStack Query hooks) and API calls |
| `src/lib/` | Small helpers: permissions, dates, flavours, stock status |

Deployment is on Vercel with `frontend` as the root directory; `vercel.json` sends `/api` to the backend and every other path to the app.
