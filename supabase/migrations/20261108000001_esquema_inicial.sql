-- Esquema inicial del teleprompter de La Garetto.
--
-- La app es offline-first: la notebook guarda todo en IndexedDB y el show
-- funciona sin internet. Supabase es el respaldo y el punto de sincronización
-- entre equipos (notebook del operador, celular de Gabi, etc.).
--
-- Sincronización:
--   * Los ids los genera el cliente (uuid), así se puede crear offline.
--   * client_updated_at: cuándo se editó en el equipo. Gana la edición más
--     nueva (last-write-wins); un trigger descarta escrituras más viejas.
--   * updated_at: lo pone el servidor. Es el cursor para traer cambios
--     ("dame todo lo modificado después de X").
--   * deleted_at: borrado lógico, para que el borrado también se sincronice.
--
-- Una sola cuenta para toda la banda: cada fila pertenece a owner = auth.uid().

-- ---------------------------------------------------------------------------
-- Funciones de soporte
-- ---------------------------------------------------------------------------

create or replace function public.tp_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Descarta un UPDATE si trae una edición más vieja que la guardada.
-- Devolver NULL en un trigger BEFORE UPDATE omite la fila sin error,
-- así un upsert desde un equipo desactualizado no pisa datos nuevos.
create or replace function public.tp_keep_newest()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.client_updated_at < old.client_updated_at then
    return null;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Canciones
-- ---------------------------------------------------------------------------
-- sections guarda la letra completa, en orden:
-- [
--   { "id": "...", "label": "Coro", "kind": "coro",
--     "lines": [ { "id": "...", "text": "Mandale baile", "cues": ["x2"] } ] }
-- ]
-- cues posibles: "silencio", "corte", "x2", "solo".

create table public.songs (
  id                uuid primary key default gen_random_uuid(),
  owner             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title             text not null check (char_length(title) between 1 and 200),
  artist            text check (char_length(artist) <= 200),
  kind              text not null default 'cuarteto'
                      check (kind in ('propia', 'cuarteto', 'cumbia', 'cover', 'otro')),
  sections          jsonb not null default '[]'::jsonb
                      check (jsonb_typeof(sections) = 'array'),
  speed             numeric(3, 2) not null default 1.00 check (speed between 0.25 and 4.00),
  advance_mode      text check (advance_mode in ('linea', 'parte')),
  duration_seconds  integer check (duration_seconds between 0 and 3600),
  notes             text check (char_length(notes) <= 5000),
  client_updated_at timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

comment on column public.songs.advance_mode is
  'Modo de avance guardado para esta canción. NULL = usa el que esté elegido en la consola.';

create index songs_owner_updated_idx on public.songs (owner, updated_at);

create trigger songs_keep_newest
  before update on public.songs
  for each row execute function public.tp_keep_newest();

create trigger songs_touch_updated_at
  before insert or update on public.songs
  for each row execute function public.tp_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Setlists
-- ---------------------------------------------------------------------------
-- items guarda el orden del show:
-- [
--   { "type": "song", "songId": "..." },
--   { "type": "enganchado", "id": "...", "name": "Cumbias pa' arrancar",
--     "songIds": ["...", "...", "..."] }
-- ]

create table public.setlists (
  id                uuid primary key default gen_random_uuid(),
  owner             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 200),
  show_date         date,
  items             jsonb not null default '[]'::jsonb
                      check (jsonb_typeof(items) = 'array'),
  client_updated_at timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create index setlists_owner_updated_idx on public.setlists (owner, updated_at);

create trigger setlists_keep_newest
  before update on public.setlists
  for each row execute function public.tp_keep_newest();

create trigger setlists_touch_updated_at
  before insert or update on public.setlists
  for each row execute function public.tp_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Ajustes compartidos de la banda (una fila por cuenta)
-- ---------------------------------------------------------------------------
-- El montaje del monitor (rotación, espejo, márgenes) NO va acá: depende de
-- cada equipo y se guarda solo en la notebook.

create table public.band_settings (
  owner             uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  theme             jsonb not null default '{}'::jsonb check (jsonb_typeof(theme) = 'object'),
  quick_messages    jsonb not null default
                      '["Repetí el coro", "Más lento", "Último coro", "Cortamos acá", "Enganchamos"]'::jsonb
                      check (jsonb_typeof(quick_messages) = 'array'),
  default_advance   text not null default 'linea' check (default_advance in ('linea', 'parte')),
  client_updated_at timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger band_settings_keep_newest
  before update on public.band_settings
  for each row execute function public.tp_keep_newest();

create trigger band_settings_touch_updated_at
  before insert or update on public.band_settings
  for each row execute function public.tp_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Seguridad: cada cuenta ve y toca solo lo suyo
-- ---------------------------------------------------------------------------
-- La anon key va a estar en GitHub Pages (es pública por diseño), así que
-- RLS es lo que protege las letras.

alter table public.songs enable row level security;
alter table public.setlists enable row level security;
alter table public.band_settings enable row level security;

create policy "songs: dueño" on public.songs
  for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

create policy "setlists: dueño" on public.setlists
  for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

create policy "band_settings: dueño" on public.band_settings
  for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

revoke all on public.songs, public.setlists, public.band_settings from anon;
grant select, insert, update, delete on public.songs, public.setlists, public.band_settings to authenticated;
