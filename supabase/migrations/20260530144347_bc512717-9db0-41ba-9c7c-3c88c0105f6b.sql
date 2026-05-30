-- Enum de papéis
create type public.app_role as enum ('admin', 'user');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

-- has_role security definer
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  )
$$;

-- Policies profiles
create policy "Own profile select" on public.profiles
for select to authenticated using (id = auth.uid());

create policy "Admin profile select" on public.profiles
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "Own profile update" on public.profiles
for update to authenticated using (id = auth.uid());

create policy "Admin profile update" on public.profiles
for update to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Policies user_roles
create policy "Own roles select" on public.user_roles
for select to authenticated using (user_id = auth.uid());

create policy "Admin roles select" on public.user_roles
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.tg_set_updated_at();

-- Auto profile + first user becomes admin
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first boolean;
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );

  select count(*) = 0 into is_first from public.user_roles;
  if is_first then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'user');
  end if;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();