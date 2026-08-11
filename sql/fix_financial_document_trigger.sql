-- =============================================================================
-- Fix: update_financial_document_status() trigger selects deals.name, which
-- doesn't exist — the live `deals` table's column is `title`. Confirmed via
-- pg_get_functiondef 2026-08-12. This is why every financial_documents
-- insert with a real deal_id failed with "column \"name\" does not exist".
--
-- Every other part of the function (listing_name lookup, file_kind
-- detection, category auto-tagging) is left exactly as it was — only the
-- one broken line is corrected.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

create or replace function public.update_financial_document_status()
returns trigger
language plpgsql
as $function$
BEGIN
  -- Auto-set deal_name if not provided
  IF NEW.deal_name IS NULL AND NEW.deal_id IS NOT NULL THEN
    SELECT title INTO NEW.deal_name FROM public.deals WHERE id = NEW.deal_id;
  END IF;

  -- Auto-set listing_name if not provided
  IF NEW.listing_name IS NULL AND NEW.listing_id IS NOT NULL THEN
    SELECT business_name INTO NEW.listing_name FROM public.listings WHERE id = NEW.listing_id;
  END IF;

  -- Auto-set file_kind based on mime_type
  IF NEW.mime_type IS NOT NULL THEN
    IF NEW.mime_type LIKE '%pdf%' THEN
      NEW.file_kind := 'pdf';
    ELSIF NEW.mime_type LIKE '%excel%' OR NEW.mime_type LIKE '%spreadsheet%' THEN
      NEW.file_kind := 'excel';
    ELSIF NEW.mime_type LIKE '%word%' OR NEW.mime_type LIKE '%document%' THEN
      NEW.file_kind := 'word';
    ELSIF NEW.mime_type LIKE '%image%' THEN
      NEW.file_kind := 'image';
    END IF;
  END IF;

  -- Auto-tag category if not set
  IF NEW.category = 'other' AND NEW.file_name IS NOT NULL THEN
    NEW.category := public.auto_tag_financial_category(NEW.file_name);
  END IF;

  RETURN NEW;
END;
$function$
;

-- =============================================================================
-- DONE.
-- =============================================================================
