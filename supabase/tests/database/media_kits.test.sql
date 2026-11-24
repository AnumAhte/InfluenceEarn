-- Phase 6: creator media kits (table + storage policies). Run with: npx supabase test db
-- The "advertiser the creator applied to" case and file deletion (Storage API only) are covered
-- end-to-end in marketplace-phase6.mjs.
begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('c1000000-0000-0000-0000-000000000001', 'kit-creator@test.local', '{"full_name":"Kit Creator"}', 'authenticated', 'authenticated'),
  ('c1000000-0000-0000-0000-000000000002', 'kit-stranger@test.local', '{"full_name":"Kit Stranger"}', 'authenticated', 'authenticated'),
  ('c1000000-0000-0000-0000-000000000003', 'kit-admin@test.local', '{"full_name":"Kit Admin"}', 'authenticated', 'authenticated');
insert into public.user_roles (user_id, role) values ('c1000000-0000-0000-0000-000000000003', 'admin');

select is((select public from storage.buckets where id = 'media-kits'), false, 'the media-kits bucket is private');
select is((select allowed_mime_types from storage.buckets where id = 'media-kits'), array['application/pdf'], 'the bucket accepts PDFs only');

-- Objects (inserted as the owner of storage; policies are checked on read below)
insert into storage.objects (bucket_id, name, owner_id) values
  ('media-kits', 'c1000000-0000-0000-0000-000000000001/media-kit-1.pdf', 'c1000000-0000-0000-0000-000000000001'),
  ('media-kits', 'not-a-uuid/media-kit.pdf', null);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$ insert into public.creator_media_kits (user_id, path, file_name, size_bytes)
  values ('c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001/media-kit-1.pdf', 'kit.pdf', 1000) $$,
  'a creator can register their own media kit');
select throws_ok($$ insert into public.creator_media_kits (user_id, path, file_name, size_bytes)
  values ('c1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002/x.pdf', 'x.pdf', 1000) $$,
  '42501', null, 'a creator cannot register a media kit for someone else');
select throws_ok($$ update public.creator_media_kits set path = 'c1000000-0000-0000-0000-000000000002/x.pdf' $$,
  '23514', null, 'a media kit path must be inside the owner''s folder');
select is((select count(*)::int from storage.objects where bucket_id = 'media-kits'), 1, 'the creator sees only their own file');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('media-kits', 'c1000000-0000-0000-0000-000000000002/evil.pdf', 'c1000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'a creator cannot upload into another user''s folder');

select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.creator_media_kits), 0, 'a stranger cannot see the media kit record');
select is((select count(*)::int from storage.objects where bucket_id = 'media-kits'), 0, 'a stranger cannot read the file');
delete from public.creator_media_kits;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is((select count(*)::int from public.creator_media_kits), 1, 'a stranger cannot delete the record');
select is((select count(*)::int from storage.objects where bucket_id = 'media-kits' and name like 'c1%'), 1,
  'an admin can read the file');
select is(public.can_view_media_kit_folder('not-a-uuid'), false, 'a non-UUID folder is never readable (no cast error)');

reset role;
set local role anon;
select throws_ok($$ select * from public.creator_media_kits $$, '42501', null, 'anonymous users have no access');
reset role;
select ok(not has_function_privilege('anon', 'public.can_view_media_kit(uuid)', 'execute'), 'anonymous users cannot call the access check');

select * from finish();
rollback;
