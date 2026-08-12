// =============================================================================
// lib/storageBuckets.ts — shared storage bucket name constants.
// -----------------------------------------------------------------------------
// No 'use client' / 'use server' directive on purpose: this file must be
// importable identically from both client components and server-only code
// (Route Handlers). Previously FF_BUCKET was exported only from
// lib/financialFiles.ts, which is marked 'use client' — when a server-only
// module (lib/autoGenerate.ts) imported it, Next.js's RSC bundler replaced
// the client module's exports with an opaque client-reference object, so
// FF_BUCKET silently resolved to `{}` on the server. Every storage upload in
// the auto-generation pipeline then failed with a misleading
// "Bucket name invalid" error — this was the root cause of that
// previously-unresolved production bug, not a stale deployment.
// =============================================================================

// Private bucket — financial documents (tax returns, P&L, bank statements,
// generated Recast/BOV/CIM/BLI PDFs) must never be publicly downloadable.
// Access is always via a short-lived signed URL, never a stored permanent
// public URL.
export const FF_BUCKET = 'financial_docs'
