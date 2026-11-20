-- Menus de la semaine : stockage partagé de la famille.
-- À coller une fois dans Supabase > SQL Editor > New query, après avoir remplacé MOT_DE_PASSE_FAMILLE.
-- La table n'est lisible et modifiable QUE par les fonctions ci-dessous, qui vérifient le mot de passe famille.

create table if not exists public.kv (
  cle    text primary key,
  valeur jsonb,
  maj    timestamptz not null default clock_timestamp(),
  par    text
);
create index if not exists kv_maj on public.kv (maj);
alter table public.kv enable row level security;   -- aucune politique : accès direct interdit

create table if not exists public.secret (
  id int primary key default 1 check (id = 1),
  mdp_hash text not null
);
alter table public.secret enable row level security;

insert into public.secret (id, mdp_hash)
values (1, encode(sha256(convert_to('MOT_DE_PASSE_FAMILLE', 'UTF8')), 'hex'))
on conflict (id) do update set mdp_hash = excluded.mdp_hash;

create or replace function public.kv_verifier(mdp text) returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from secret where mdp_hash = encode(sha256(convert_to(mdp, 'UTF8')), 'hex'));
$$;

create or replace function public.kv_lire(mdp text, depuis timestamptz default null)
returns table (cle text, valeur jsonb, maj timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not kv_verifier(mdp) then raise exception 'mot de passe incorrect'; end if;
  return query select k.cle, k.valeur, k.maj from kv k where depuis is null or k.maj > depuis order by k.maj;
end $$;

create or replace function public.kv_ecrire(mdp text, entrees jsonb, par text default null)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare e jsonb;
begin
  if not kv_verifier(mdp) then raise exception 'mot de passe incorrect'; end if;
  for e in select * from jsonb_array_elements(entrees) loop
    insert into kv (cle, valeur, maj, par) values (e->>'cle', e->'valeur', clock_timestamp(), kv_ecrire.par)
    on conflict (cle) do update set valeur = excluded.valeur, maj = excluded.maj, par = excluded.par;
  end loop;
  return clock_timestamp();
end $$;

revoke all on function public.kv_verifier(text) from public;
revoke all on function public.kv_lire(text, timestamptz) from public;
revoke all on function public.kv_ecrire(text, jsonb, text) from public;
grant execute on function public.kv_verifier(text) to anon;
grant execute on function public.kv_lire(text, timestamptz) to anon;
grant execute on function public.kv_ecrire(text, jsonb, text) to anon;

-- Accès direct de Claude (scripts/donnees.mjs, clé secrète) : l'heure de mise à jour est posée par le serveur
-- pour que les téléphones voient aussi ces changements.
create or replace function public.kv_horodater() returns trigger language plpgsql as $$
begin new.maj := clock_timestamp(); return new; end $$;
drop trigger if exists kv_horodater on public.kv;
create trigger kv_horodater before insert or update on public.kv for each row execute function public.kv_horodater();
