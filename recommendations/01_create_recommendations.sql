create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  name text null,
  rating int not null,
  comment text not null,

  status text not null default 'pending', -- pending | approved | rejected
  approved_at timestamptz null,

  -- anti-spam / auditoria ligera
  ip_hash text null,
  user_agent text null
);

-- Validaciones a nivel DB
alter table public.recommendations
  add constraint rating_range check (rating between 1 and 5);

alter table public.recommendations
  add constraint comment_len check (char_length(comment) between 20 and 800);
