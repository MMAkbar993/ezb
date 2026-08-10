# Concord Deal Platform — Design System

Investment-bank navy + gold aesthetic. Consistent across the full application
(dashboard shell, tooling modules, CIM/BOV/Recast reports, and the public
marketplace).

## Color Tokens (`app/globals.css`)

| Token          | Value      | Usage                                              |
|----------------|------------|----------------------------------------------------|
| `--navy`       | `#1a1a2e`  | Primary backgrounds, headings, table headers       |
| `--navy-2`     | `#16213e`  | Gradient secondary (sidebar bottom)                |
| `--navy-3`     | `#0f3460`  | Accent depth / avatar gradients                    |
| `--gold`       | `#c9a84c`  | Primary accent, buttons, active states, CTA        |
| `--gold-light` | `#e0c97e`  | Highlight on dark backgrounds                      |
| `--gold-dark`  | `#a8872f`  | Section titles, emphasis text, borders             |
| `--cream`      | `#fbfaf6`  | Card surfaces                                      |
| `--paper`      | `#f7f6f2`  | Page background                                    |
| `--line`       | `#e5e0d3`  | Hairlines / borders                                |
| `--text`       | `#2b2b3a`  | Body copy                                          |
| `--muted`      | `#7a7a8a`  | Secondary text, captions                           |

## Typography

- **Primary:** Georgia / serif — used for headings, buttons, data, and all
  report + document output (investment-bank feel).
- **Body:** Georgia, `--text` color, `-webkit-font-smoothing: antialiased`.
- **Labels:** `--section-title` helper (11–13px, uppercase, `--gold-dark`,
  letter-spaced) for eyebrow/section headings.

## Components

### Buttons
- `.btn-primary` — gold gradient, navy text. Main CTA.
- `.btn-navy` — navy fill, white text. Secondary / save.
- `.btn-ghost` — outline. Tertiary.
- `.btn-danger` — red outline. Destructive.

### Surfaces
- `.card` — cream, `--line` border, 10px radius, soft shadow.
- `.kpi` — stat card with a 4px gold left border (value in Georgia 30px).

### Forms
- `.input`, `.textarea`, `.select` — 6px radius, white, gold focus ring
  (`0 0 0 3px rgba(201,168,76,0.16)`).
- `.label` — 13px, navy, bold.

### Tables
- `.table` — navy header underline, optional row hover on gold.
- `.table-scroll` — wrap for horizontal scroll on narrow screens.

### Overlays
- `.modal-backdrop` / `.modal` / `.modal-head` (navy) / `.modal-body` / `.modal-foot`.
- `.toast` system (`components/ui/Toast.tsx`).

### Layout helpers
- `.grid-2 / .grid-3 / .grid-4` — responsive grids.
- `.stack`, `.row`, `.row-between`, `.wrap`.
- `.muted`, `.gold`.

## Report / Document Aesthetic (CIM · BOV · Recast)

- **Cover page:** full navy field, a thin gold rule across the width, gold
  title, white subtitle, gold "CONFIDENTIAL" marker.
- **Section headings:** navy block with gold-light text.
- **A tasteful faint CONFIDENTIAL watermark** on CIM previews.
- **PDF export** via `lib/pdfExport.ts` (`exportCimToPdf`, `exportBovToPdf`,
  `exportRecastToPdf`) — jsPDF, same palette, multi-page support.
- **Charts:** Recharts, gold (`#a8872f`) + navy (`#1a1a2e`) series.

## Public Marketplace

Same navy/gold language but on a white/cream field for a modern, light feel:
navy hero gradients with gold accent text, white cards, gold CTAs.
See `components/public/*`.
