# Enterprise Business Brokerage CRM — Full Developer Handoff Document

**Prepared for:** Software Developer (new hire / contractor)
**Prepared by:** Rabin Timsina — EZ Business Advisors LLC
**Date:** 2026-08-09
**Confidentiality:** Sensitive. This document contains access to a production system with confidential client financial data. Treat all contents as NDA-protected and do not share with anyone else.

---

## 1. Overview

A custom enterprise CRM for a business brokerage firm ("Concord Deal Platform"). The system manages business listings, buyer/seller leads, deal pipeline, financial documents, AI-assisted valuation (BOV/CIM/Recast/BLI), document management, deal tracking, training, marketing, and client portals. It includes a functional AI agent hub and a full financial intelligence system. The application is **mostly built and functional** but is **not fully working** — there are known blockers that define the primary scope of work.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 / Next.js 14.2 (App Router) |
| **Backend / Database** | Supabase (PostgreSQL) + Row Level Security |
| **Auth** | Supabase Auth |
| **AI** | Anthropic Claude (`claude-sonnet-4-5`) via server-side routes |
| **Hosting** | Vercel (production) |
| **Language** | TypeScript 5.9 |
| **Styling** | Tailwind CSS |
| **Key libs** | @supabase/supabase-js, @anthropic-ai/sdk, recharts, jspdf, qrcode, papaparse, pdf-parse, @dnd-kit, nodemailer, @cosmstack/blackshield, websecure-ez |

---

## 3. Application Architecture & Module Map

### 3.1 Core CRM Modules (app routes)
| Route | Purpose |
|-------|---------|
| `/listings` | Business listings (5 industries, full realistic financials, buyer auto-matching) |
| `/leads` | Buyer + seller leads, lead status funnel, convert to deals, activity tracking |
| `/pipeline` | Deal pipeline: LOI → Under Contract → Due Diligence → Closing → Closed |
| `/dashboard` | Dashboard stats, sales funnel, activity feed, AI agent hub |
| `/documents` | Document management: upload/categorize/preview/delete (storage bucket `documents`) |
| `/financial-files` | Financial files system (Recast/BOV/CIM/BLI generation) |
| `/recast`, `/bov`, `/cim`, `/bli` | Financial valuation document builders |
| `/due-diligence` | Due diligence workspace + Data Room |
| `/training` | Training center: 10 modules, 30 lessons, 30 quiz questions, certificates |
| `/legal` | Legal docs system (fillable, signatures, audit, compliance) |
| `/marketing` | Marketing materials + per-broker branding |
| `/card` | Business cards (photos, back text, QR contact saving) |
| `/portal` | Client portal (NDA signing etc.) |
| `/qr` | QR certificates (jsPDF/QR/templates) |
| `/onboarding` | Agent onboarding checklist, certificates, broker roster |
| `/agencies` / `/agency` | Agency management, per-broker accounts |
| `/billing`, `/trial` | Billing + free trial system with agency control |
| `/admin` | Admin console |
| `/share` | Public share pages |

### 3.2 Backend / Services (lib)
```
lib/ai/            AI agent hub + auto-generation
lib/claude/        Claude client, prompts, context loading (4 agent kinds: lead|training|document|support)
lib/financial/     recast.ts deterministic SDE/EBITDA engine + financial_extractor
lib/bov.ts         Investment-bank quality BOV generator (12 sections)
lib/cim.ts, lib/bli.ts
lib/pipeline.ts    Deal pipeline + status normalization
lib/leads2.ts, lib/sellerLeads.ts
lib/listings.ts    Listings + buyer matching
lib/documents.ts   Document CRUD
lib/dueDiligence.ts
lib/training.ts, lib/onboarding.ts
lib/marketing.ts, lib/branding.ts
lib/card.ts, lib/qr.ts, lib/vcard.ts
lib/clientPortal.ts, lib/compliance.ts
lib/email.ts       Nodemailer wrapper
lib/trial.ts, lib/billing.ts, lib/agencies.ts
lib/realtime.ts, lib/search.ts, lib/analytics.ts, lib/dashboard.ts
lib/zip.ts, lib/pdfExport.ts, lib/financialFiles.ts
```

### 3.3 AI System
- **4 agents:** Lead, Training, Document, Support — each with a system prompt + legal compliance guardrail
- **Model:** `claude-sonnet-4-5`, reads `ANTHROPIC_API_KEY` server-side
- **Context loading:** pulls real listings/leads/training docs from Supabase (lib/claude/context.ts)
- **Valuation rule (important):** AI does **narrative only** — all SDE/EBITDA arithmetic is computed deterministically in code via `lib/financial/recast.ts` (parses `12.5k`/`1.2M`, itemizes add-backs, excludes unsupported ones). This prevents the model from inventing add-backs.

### 3.4 Database / Schema (sql/)
Migration files in `/sql` — these are the source of truth for the DB:
- `01_schema_base.sql` — base schema + RLS
- `02_security_hardening.sql` — RLS/ownership fixes (NEEDS RUNNING)
- `FIX_ALL_2026_08_03.sql` — creates missing tables (NEEDS RUNNING)
- `financial_files_schema.sql`, `financial_auto_generation.sql`
- `data_room_schema.sql`, `multi_tenant_schema.sql`
- `training_schema.sql`, `workflow_schema.sql`, `marketing_schema.sql`, `social_schema.sql`
- `document_compliance_realestate_schema.sql`, `client_portal_schema.sql`
- Plus: `full_schema.sql`, `phase2_schema.sql`, `rls_enable.sql`, `seed.sql`, `RUN_ALL.sql`

---

## 4. Access & Credentials

> **⚠️ FILL IN THE `[PLACEHOLDER]` FIELDS BEFORE FORWARDING TO THE DEVELOPER.**

### 4.1 Source Code (GitHub)
- **Repo URL:** https://github.com/timsinarabin96-cell/EZBusinessadvisors.git
- **Branch:** `main`
- **Developer GitHub username:** `[DEV GITHUB USERNAME]`
- **Personal Access Token (PAT) for clone/push:** `[GITHUB PAT — Settings → Developer settings → Tokens (classic), scope: repo]`

### 4.2 Production Application
- **Live URL:** https://ezbusinessadvisors.vercel.app
- **Dev login email:** `[DEV LOGIN EMAIL — use a SEPARATE developer account, see §6]`
- **Dev password:** `[DEV PASSWORD — NOT the owner's password]`

### 4.3 Database (Supabase)
- **Project ref:** `urwnucdjmoavbdddrhsh`
- **Dashboard URL:** https://supabase.com/dashboard/project/urwnucdjmoavbdddrhsh
- **Dev DB credentials:** `[CREATE A RESTRICTED DEV ROLE, OR PROVIDE OWNER ACCESS AT YOUR DISCRETION]`

### 4.4 API / Service Keys
- **Supabase Service-Role Key:** NOT included here for security. Provide directly to the dev only after agreeing on data handling/NDA.
- **ANTHROPIC_API_KEY (Claude):** Server-side in `.env.local`. Relevant only if the dev works on AI routes.

---

## 5. Current Status & Known Blockers (Primary Scope)

The app has been tested end-to-end. **These are the tasks to complete:**

### B1. Missing Database Tables (BLOCKER) ⬅ highest priority
Two tables **do not exist** in the live Supabase DB and fully block features:
- **`lead_activities`** — lead notes/activities (code fails soft)
- **`financial_documents`** — blocks the ENTIRE Financial Files + Recast/BOV/CIM/BLI features

The idempotent migration already exists:
- **File:** `sql/FIX_ALL_2026_08_03.sql`
- **Run:** Supabase → Project `urwnucdjmoavbdddrhsh` → **SQL Editor** → paste → **Run**

### B2. Schema / Code Mismatches
Six were fixed in live code (commit `386cf43`); residual ones may remain after B1. Align frontend code with the actual DB schema:
- Step-1 legal docs: `listing_documents` has **no `file_name` column**; category/status/party_type allow-lists too strict
- Deal pipeline: `deals_status_check` only accepts `letter_of_intent|under_contract|due_diligence|closing|closed` (app used `loi`/`pending`)
- Seller lead statuses: only `new|contacted|closed`
- Doc uploads: `party_type` is NOT NULL + categories must be Title-Case
- AI doc agent + dashboard activity referenced non-existent `file_name`/`title` columns

### B3. Security Hardening (Apply SQL)
**File:** `sql/02_security_hardening.sql` — run in Supabase SQL Editor. Fixes:
- Open UPDATE hole on `buyer_leads` (`using(true) with check(true)`)
- Lead/activity read policies letting any agent read all agents' data (add ownership scoping)

### B4. Verify End-to-End After Fixes
- **Financial Files** (upload/access financial documents) — must work after B1
- **Lead activities** — must work after B1
- **Listings, leads, deals** — no errors, full CRUD
- `npm run build` must pass

---

## 6. Security & Process Notes (IMPORTANT)

1. **Never use the owner's personal admin password.** Create a dedicated developer account in Supabase Auth so access can be revoked independently.
2. **Service-role key = full DB admin.** Do not commit it, do not add it to this doc, do not share it outside a direct agreed handoff.
3. **All client financial data is confidential and under NDA.** Do not copy, export, back up, or reuse it.
4. **Deployment:** Pushing to `main` auto-deploys on Vercel. The repo is currently **3 commits ahead of `origin/main`** (security-hardening + data-room schema + audit tooling) — these **have not been pushed**. A working PAT is required before the dev can clone/push.
5. Untracked files to review: `sql/data_room_schema.sql`, `sql/harden_financial_documents_rls.sql`, `audit.sh`, `bash` — confirm scope with the owner.
6. **Known pre-existing build note:** local `next build` only fails on prerendering `/signup` (no real Supabase env locally); passes on Vercel. Also a non-fatal warning on relative `/api/training` during SSR (fine at runtime).

---

## 7. Deliverables

- [ ] Run `sql/FIX_ALL_2026_08_03.sql`; confirm `lead_activities` + `financial_documents` tables exist
- [ ] Run `sql/02_security_hardening.sql`; confirm RLS fixes applied
- [ ] Fix all remaining schema/code mismatches
- [ ] Verify **Financial Files** and **lead activities** work end-to-end
- [ ] Verify listings, leads, deals function without errors
- [ ] `npm run build` passes
- [ ] Push all commits to `main` so the live site updates

**Nice to have (confirm scope with owner):**
- Clean up remaining UI gaps
- Deployment/maintenance notes
- Restricted dev-role setup for the DB

---

## 8. Contact

- **Name:** Rabin Timsina
- **Email:** rtimsina@ezbusinessadvisors.com

---

## 9. Appendix — Recent Commit History

| Commit | Description |
|--------|-------------|
| `6e55743` | Financial Intelligence System — Claude reads any financial document |
| `1632bd6` | One-click auto-generation pipeline (Recast/BOV/CIM/BLI) |
| `520d04d` | 10+ page investment-bank-quality BOV with all 12 sections |
| `7c2cf43` | Listings: stamp agent_id from authenticated user on create |
| `386cf43` | Fix platform live-schema mismatches (full broker CRM test) |
| `955620c` | Complete financial documents system |
| `6930969` | AI agent hub + agent chat console |
| `ddac8b6` | Fix Training Center render (decouple RLS-affected fetches) |
| `4768f38` | Environment variables |
| `dc35f48` | Buyer-lead financials + business-type capture + auto-matching |
| `3788571` | Free trial system with agency control |
| `fe5a236` | Business card system (photos, back text, QR) |
| `79c98d0` | Forgot Password, Training Center, Onboarding, AI Agents |
| `7f8492f` | Marketing materials + per-broker branding |
| `6514bd1` | Document/Compliance/Real-Estate system + AI legal guardrails |
| `920065f` | Agent Onboarding & Training System + QR certificates |

**Test helpers (committed):** `broker-test.cjs`, `broker-walk.cjs` (full end-to-end broker walkthrough scripts)
