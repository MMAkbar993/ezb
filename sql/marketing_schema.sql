-- =============================================================================
-- Marketing Materials Management System
-- -----------------------------------------------------------------------------
-- Brokers design, customize, and order marketing materials (business cards,
-- banners, brochures, envelopes, flyers, postcards, signage, promo items,
-- apparel, stationery) from a single storefront. AI design generation is
-- seeded by the broker's saved brand (lib/branding.ts).
--
-- Idempotent — safe to run repeatedly in the Supabase SQL editor.
-- =============================================================================

-- ---- product catalog --------------------------------------------------------
create table if not exists public.marketing_products (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  category       text not null,                 -- business_cards | banners | brochures | envelopes | flyers | postcards | signage | promo | apparel | stationery
  description    text,
  base_price     numeric(10,2) not null default 0,
  image_url      text,
  is_active      boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

-- ---- product variants (size, finish, material, etc.) ------------------------
create table if not exists public.marketing_product_variants (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid references public.marketing_products(id) on delete cascade,
  name             text not null,               -- e.g. "2x3.5 Standard", "Premium Matte"
  variant_type     text not null default 'size', -- size | finish | material | color | style
  price_adjustment numeric(10,2) not null default 0,
  sort_order       int not null default 0
);

-- ---- saved designs ----------------------------------------------------------
create table if not exists public.marketing_designs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles(id) on delete cascade,
  product_id       uuid references public.marketing_products(id) on delete set null,
  design_name      text,
  design_data      jsonb not null default '{}'::jsonb,  -- full studio state (brand + text + layout + qr)
  front_image_url  text,
  back_image_url   text,
  preview_url      text,
  is_ai_generated  boolean not null default false,
  created_at       timestamptz not null default now()
);

-- ---- orders ----------------------------------------------------------------
create table if not exists public.marketing_orders (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.profiles(id) on delete cascade,
  design_id           uuid references public.marketing_designs(id) on delete set null,
  product_id          uuid references public.marketing_products(id) on delete set null,
  quantity            int not null default 1,
  variant_selections  jsonb not null default '{}'::jsonb,   -- { variantId: count, ... } or total-driven
  shipping_address    jsonb not null default '{}'::jsonb,   -- { name, line1, line2, city, state, zip, country }
  status              text not null default 'draft',        -- draft | pending | paid | processing | shipped | delivered | cancelled
  order_total         numeric(10,2) not null default 0,
  currency            text not null default 'usd',
  tracking_number     text,
  stripe_session_id   text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---- design templates -------------------------------------------------------
create table if not exists public.marketing_templates (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  category       text not null,
  description    text,
  preview_image  text,
  design_data    jsonb not null default '{}'::jsonb,  -- studio state template
  is_premium     boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ---- AI design generations --------------------------------------------------
create table if not exists public.marketing_ai_designs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete cascade,
  prompt       text,
  design_data  jsonb not null default '{}'::jsonb,
  preview_url  text,
  used         boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---- indexes ----------------------------------------------------------------
create index if not exists idx_marketing_products_category on public.marketing_products (category);
create index if not exists idx_marketing_variants_product on public.marketing_product_variants (product_id);
create index if not exists idx_marketing_designs_user on public.marketing_designs (user_id);
create index if not exists idx_marketing_orders_user on public.marketing_orders (user_id);
create index if not exists idx_marketing_ai_user on public.marketing_ai_designs (user_id);

-- ---- RLS (append to existing RLS setup; if not yet enabled, listed anyway) ----
alter table public.marketing_products  enable row level security;
alter table public.marketing_product_variants enable row level security;
alter table public.marketing_designs   enable row level security;
alter table public.marketing_orders    enable row level security;
alter table public.marketing_templates enable row level security;
alter table public.marketing_ai_designs enable row level security;

drop policy if exists marketing_products_read on public.marketing_products;
create policy marketing_products_read on public.marketing_products for select using (is_active = true or true);

drop policy if exists marketing_variants_read on public.marketing_product_variants;
create policy marketing_variants_read on public.marketing_product_variants for select using (true);

drop policy if exists marketing_templates_read on public.marketing_templates;
create policy marketing_templates_read on public.marketing_templates for select using (true);

-- designs: owner full access
drop policy if exists marketing_designs_owner on public.marketing_designs;
create policy marketing_designs_owner on public.marketing_designs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- orders: owner full access
drop policy if exists marketing_orders_owner on public.marketing_orders;
create policy marketing_orders_owner on public.marketing_orders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ai designs: owner full access
drop policy if exists marketing_ai_owner on public.marketing_ai_designs;
create policy marketing_ai_owner on public.marketing_ai_designs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---- seed catalog (idempotent) ----------------------------------------------
insert into public.marketing_products (name, category, description, base_price, image_url, sort_order)
select * from (values
  ('Business Cards — Standard', 'business_cards', 'Premium 14pt card stock with matte or gloss finish. Full-color both sides.', 24.99, 'https://urwnucdjmoavbdddrhsh.supabase.co/storage/v1/object/public/profile_images/marketing/business-cards.svg', 10),
  ('Business Cards — Kraft',   'business_cards', 'Eco-friendly kraft stock for a warm, handcrafted feel.', 29.99, 'https://urwnucdjmoavbdddrhsh.supabase.co/storage/v1/object/public/profile_images/marketing/business-cards.svg', 11),
  ('Roll-Up Banner',            'banners',       '33" x 79" retractable banner with stand and carry case.', 149.00, null, 20),
  ('Vinyl Banner',              'banners',       'Heavy-duty vinyl banner with grommets, indoor/outdoor.', 89.00, null, 21),
  ('B2B Brochure — Tri-Fold',   'brochures',     'Tri-fold 8.5x11 on 100lb gloss text.', 0.29, null, 30),
  ('Postcard — 5x7',            'postcards',     'Thick 14pt postcard, UV coated, full color.', 0.49, null, 40),
  ('Door Hanger',               'flyers',        'Die-cut door hanger, 14pt with perforation.', 0.39, null, 50),
  ('Yard Sign — 18x24',         'signage',       'Corrugated plastic yard sign with stakes.', 12.99, null, 60),
  ('Brokerage Pen',             'promo',         'Custom imprint ballpoint pen, navy ink.', 1.49, null, 70),
  ('Car Magnet — 12x18',        'promo',         'Weatherproof magnetic car sign.', 24.99, null, 71),
  ('Breathable Polo',           'apparel',       'Cotton polo with embroidered logo.', 34.99, null, 80),
  ('Embroidered Hat',           'apparel',       'Structured cap with front embroidery.', 22.99, null, 81),
  ('Letterhead + Envelope',     'stationery',    'Matching letterhead and #10 envelope set.', 0.35, null, 90),
  ('Thank-You Note Card',       'stationery',    'A2 note cards with matching envelopes.', 1.10, null, 91)
) as v(name, category, description, base_price, image_url, sort_order)
where not exists (select 1 from public.marketing_products where name = v.name);

-- A few stock variants so the customization flow has options out of the box.
insert into public.marketing_product_variants (product_id, name, variant_type, price_adjustment, sort_order)
select p.id, v.name, v.variant_type, v.adjust, v.so from public.marketing_products p
cross join (values
  ('Business Cards — Standard', 'Standard 14pt', 'finish', 0, 1),
  ('Business Cards — Standard', 'Premium Matte', 'finish', 8.00, 2),
  ('Business Cards — Standard', 'Spot UV Gloss', 'finish', 12.00, 3),
  ('Roll-Up Banner',            'Standard 33x79', 'size', 0, 1),
  ('Roll-Up Banner',            'Large 35x86',   'size', 20.00, 2),
  ('B2B Brochure — Tri-Fold',   '100lb Gloss',   'material', 0, 1),
  ('B2B Brochure — Tri-Fold',   '100lb Uncoated','material', -0.02, 2),
  ('Breathable Polo',           'M', 'size', 0, 1),
  ('Breathable Polo',           'L', 'size', 0, 2),
  ('Breathable Polo',           'XL', 'size', 2.00, 3),
  ('Embroidered Hat',           'Navy', 'color', 0, 1),
  ('Embroidered Hat',           'Charcoal', 'color', 0, 2)
) as v(name, variant_type, adjust, so)
where p.name = v.name
  and not exists (
    select 1 from public.marketing_product_variants x
    where x.product_id = p.id and x.name = v.name
  );
