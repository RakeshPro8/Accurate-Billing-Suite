---
name: BillPro Theme
description: Dark PyQt terminal theme applied globally via CSS variables.
---

## Design
PyQt-inspired dark terminal palette applied as the default (only) theme via `:root` CSS variables in `artifacts/billing-app/src/index.css`.

## Key Color Values (HSL format used by Tailwind/shadcn)
- `--background`: 240 35% 5% (near-black deep navy)
- `--card`: 240 30% 8% (slightly lighter surface)
- `--sidebar`: 240 40% 4% (deepest dark)
- `--primary`: 173 100% 45% (neon teal #00e5c8)
- `--primary-foreground`: 240 40% 4% (dark on neon button)
- `--foreground`: 214 25% 88% (cool light text)
- `--muted-foreground`: 214 15% 48% (dimmed labels)
- `--border`: 240 25% 14%

## Font
Monospaced font stack: `'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace` — applied via `--app-font-sans`.

**Why:** PyQt/terminal aesthetic calls for monospaced; adds to the professional POS terminal feel without requiring font imports (system fallbacks work fine).
