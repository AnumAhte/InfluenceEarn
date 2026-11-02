-- =============================================================================
-- Phase 6 — creator media kits (PDF)
--
-- One optional PDF per creator in the private `media-kits` bucket (<uid>/<file>.pdf, 4 MB).
-- Who can read it: the creator, admins, and advertisers who own a campaign the creator has
-- applied to (the same people who can already see that creator's application snapshot).
-- Files are served through short-lived signed URLs; nothing is public.
-- =============================================================================

create table public.creator_media_kits (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  path        text not null check (path like (user_id::text || '/%') and path like '%.pdf' and char_length(path) <= 200),
  file_name   text not null check (char_length(file_name) between 1 and 120),
  size_bytes  integer not null check (size_bytes between 1 and 4194304),
  uploaded_at timestamptz not null default now()
);

comment on table public.creator_media_kits is
  'Optional creator media kit (PDF). Readable by the creator, admins and advertisers the creator applied to.';

-- True when the signed-in user may see this creator's media kit.
create or replace function public.can_view_media_kit(_creator_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) = _creator_id
      or public.is_admin()
      or exists (
        select 1
        from public.campaign_applications a
        join public.campaigns c on c.id = a.campaign_id
        where a.creator_id = _creator_id and c.owner_id = (select auth.uid())
      );
$$;

revoke all on function public.can_view_media_kit(uuid) from public, anon;
grant execute on function public.can_view_media_kit(uuid) to authenticated;

-- Storage-policy wrapper: a folder name that isn't a UUID is never readable (and never cast).
create or replace function public.can_view_media_kit_folder(_folder text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if _folder is null or _folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.can_view_media_kit(_folder::uuid);
end;
$$;

revoke all on function public.can_view_media_kit_folder(text) from public, anon;
grant execute on function public.can_view_media_kit_folder(text) to authenticated;

revoke all on public.creator_media_kits from anon, authenticated;
grant select, delete on public.creator_media_kits to authenticated;
grant insert (user_id, path, file_name, size_bytes, uploaded_at),
      update (user_id, path, file_name, size_bytes, uploaded_at)
  on public.creator_media_kits to authenticated;

alter table public.creator_media_kits enable row level security;
create policy "creator_media_kits: viewers read" on public.creator_media_kits
  for select to authenticated using ((select public.can_view_media_kit(user_id)));
create policy "creator_media_kits: owner inserts" on public.creator_media_kits
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "creator_media_kits: owner updates" on public.creator_media_kits
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "creator_media_kits: owner deletes" on public.creator_media_kits
  for delete to authenticated using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Storage
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media-kits', 'media-kits', false, 4194304, array['application/pdf'])
on conflict (id) do nothing;

create policy "media-kits: viewers read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media-kits'
    and public.can_view_media_kit_folder((storage.foldername(name))[1])
  );

create policy "media-kits: owner uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media-kits' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "media-kits: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media-kits' and (storage.foldername(name))[1] = (select auth.uid())::text);
