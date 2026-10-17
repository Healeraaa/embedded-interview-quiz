create table if not exists public.quiz_sync (
  user_id uuid primary key
    references auth.users(id) on delete cascade
    default auth.uid(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.quiz_sync enable row level security;

revoke all on table public.quiz_sync from anon, authenticated;
grant select, insert, update, delete on table public.quiz_sync to authenticated;

drop policy if exists "Users can view own quiz data" on public.quiz_sync;
create policy "Users can view own quiz data"
  on public.quiz_sync for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own quiz data" on public.quiz_sync;
create policy "Users can create own quiz data"
  on public.quiz_sync for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own quiz data" on public.quiz_sync;
create policy "Users can update own quiz data"
  on public.quiz_sync for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own quiz data" on public.quiz_sync;
create policy "Users can delete own quiz data"
  on public.quiz_sync for delete to authenticated
  using ((select auth.uid()) = user_id);
