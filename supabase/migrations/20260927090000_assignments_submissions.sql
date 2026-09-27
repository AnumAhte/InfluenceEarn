-- =============================================================================
-- Phase 4: work assignments, task submissions and advertiser reviews.
--
-- * Selecting an applicant creates exactly one assignment (reward + deadline
--   snapshot). The creator submits proof for every campaign task in one
--   submission; the campaign owner approves or rejects it.
-- * Proof rules come from campaign_task_type_rules. Links must be https URLs on
--   the task platform's own domain. Screenshots are never required.
-- * Approved = ready for payout. Admins are notified; releasing money is phase 5
--   (payout_pending / paid are reserved states with no transitions yet).
-- * All writes go through SECURITY DEFINER functions; clients can only read.
-- =============================================================================

create type public.assignment_status as enum (
  'in_progress',
  'submitted',
  'revision_requested',
  'approved',
  'rejected',
  -- Deadline passed without an approved submission (set when the campaign is completed).
  'expired',
  -- Reserved for phase 5 (payout release). No transitions exist yet.
  'payout_pending',
  'paid'
);

create type public.review_decision as enum ('approved', 'rejected');

-- -----------------------------------------------------------------------------
-- Campaign lifecycle additions: allow completing straight from in_progress.
-- (Mirrored in src/domain/campaigns/state-machine.ts.)
-- -----------------------------------------------------------------------------
create or replace function public.campaign_transition_allowed(
  _from public.campaign_status,
  _to public.campaign_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (_from, _to) in (
    ('draft'::public.campaign_status, 'funding_required'::public.campaign_status),
    ('draft', 'cancelled'),
    ('funding_required', 'draft'),
    ('funding_required', 'published'),
    ('funding_required', 'cancelled'),
    ('published', 'applications_open'),
    ('applications_open', 'selection_in_progress'),
    ('selection_in_progress', 'in_progress'),
    ('in_progress', 'review_pending'),
    ('in_progress', 'completed'),
    ('review_pending', 'in_progress'),
    ('review_pending', 'completed')
  );
$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.campaign_assignments (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.campaigns (id) on delete restrict,
  application_id uuid not null unique references public.campaign_applications (id) on delete restrict,
  creator_id     uuid not null references public.profiles (id) on delete restrict,
  status         public.assignment_status not null default 'in_progress',
  reward_cents   bigint not null check (reward_cents > 0),
  due_at         timestamptz not null,
  attempt_count  smallint not null default 0 check (attempt_count >= 0),
  max_attempts   smallint not null default 3 check (max_attempts between 1 and 10),
  submitted_at   timestamptz,
  decided_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (campaign_id, creator_id)
);

create index campaign_assignments_campaign_status_idx on public.campaign_assignments (campaign_id, status, updated_at desc);
create index campaign_assignments_creator_status_idx on public.campaign_assignments (creator_id, status, due_at);
-- Admin "ready for payout" queue.
create index campaign_assignments_approved_idx on public.campaign_assignments (decided_at) where status = 'approved';

create trigger campaign_assignments_set_updated_at
  before update on public.campaign_assignments
  for each row execute function public.set_updated_at();

create table public.task_submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.campaign_assignments (id) on delete restrict,
  attempt       smallint not null check (attempt >= 1),
  note          text check (note is null or char_length(note) <= 1000),
  submitted_at  timestamptz not null default now(),
  unique (assignment_id, attempt)
);

create index task_submissions_assignment_idx on public.task_submissions (assignment_id, attempt desc);

create table public.task_submission_items (
  submission_id    uuid not null references public.task_submissions (id) on delete cascade,
  campaign_task_id uuid not null references public.campaign_tasks (id) on delete restrict,
  proof_url        text check (proof_url is null or (proof_url ~* '^https://' and char_length(proof_url) <= 2048)),
  comment_text     text check (comment_text is null or char_length(comment_text) between 1 and 2200),
  primary key (submission_id, campaign_task_id)
);

create table public.task_reviews (
  id                 uuid primary key default gen_random_uuid(),
  submission_id      uuid not null unique references public.task_submissions (id) on delete restrict,
  decision           public.review_decision not null,
  reason             text check (reason is null or char_length(reason) between 3 and 1000),
  allow_resubmission boolean not null default false,
  reviewer_id        uuid not null references public.profiles (id) on delete restrict,
  created_at         timestamptz not null default now(),
  constraint task_reviews_reason_required check (decision = 'approved' or reason is not null)
);

-- -----------------------------------------------------------------------------
-- Proof validation (single source of truth; mirrored in src/domain/tasks/proof.ts)
-- -----------------------------------------------------------------------------
create or replace function public.proof_url_matches_platform(_platform public.social_platform, _url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case _platform
    when 'instagram' then _url ~* '^https://([a-z0-9-]+\.)*instagram\.com/[^\s]+$'
    when 'tiktok'    then _url ~* '^https://([a-z0-9-]+\.)*tiktok\.com/[^\s]+$'
    when 'facebook'  then _url ~* '^https://([a-z0-9-]+\.)*(facebook\.com|fb\.watch)/[^\s]+$'
    when 'youtube'   then _url ~* '^https://(([a-z0-9-]+\.)*youtube\.com|youtu\.be)/[^\s]+$'
  end;
$$;

-- -----------------------------------------------------------------------------
-- Status-change side effects
-- -----------------------------------------------------------------------------
-- Keeps the campaign in review_pending while any submission awaits review, and
-- back in in_progress when none do. Only applies once work has started.
create or replace function public._sync_campaign_review_state(_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.campaign_status;
  v_waiting boolean;
begin
  select status into v_status from public.campaigns where id = _campaign_id for update;
  if v_status not in ('in_progress', 'review_pending') then
    return;
  end if;
  select exists (
    select 1 from public.campaign_assignments where campaign_id = _campaign_id and status = 'submitted'
  ) into v_waiting;
  if v_waiting and v_status = 'in_progress' then
    update public.campaigns set status = 'review_pending' where id = _campaign_id;
  elsif not v_waiting and v_status = 'review_pending' then
    update public.campaigns set status = 'in_progress' where id = _campaign_id;
  end if;
end;
$$;

revoke all on function public._sync_campaign_review_state(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Assignment on selection (replaces the phase 3 function; same checks plus the insert)
-- -----------------------------------------------------------------------------
create or replace function public.decide_application(p_application_id uuid, p_action text)
returns public.application_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  a public.campaign_applications%rowtype;
  c public.campaigns%rowtype;
  v_next public.application_status;
  v_selected integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into a from public.campaign_applications where id = p_application_id;
  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;
  select * into c from public.campaigns where id = a.campaign_id for update;
  if c.owner_id is distinct from v_uid then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;
  select * into a from public.campaign_applications where id = p_application_id for update;

  if c.status not in ('applications_open', 'selection_in_progress', 'in_progress', 'review_pending') then
    raise exception 'selection_closed' using errcode = 'P0001';
  end if;

  v_next := case p_action
    when 'shortlist' then 'shortlisted'
    when 'unshortlist' then 'pending'
    when 'select' then 'selected'
    when 'reject' then 'rejected'
    when 'reconsider' then 'pending'
  end::public.application_status;

  if v_next is null then
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  if a.status = v_next then
    return v_next;
  end if;
  if not public.application_transition_allowed(a.status, v_next)
     or (p_action = 'unshortlist' and a.status <> 'shortlisted')
     or (p_action = 'reconsider' and a.status <> 'rejected') then
    raise exception 'invalid_application_transition: % -> %', a.status, v_next using errcode = 'P0001';
  end if;

  if v_next = 'selected' then
    select count(*) into v_selected
    from public.campaign_applications where campaign_id = c.id and status = 'selected';
    if v_selected >= c.creators_required then
      raise exception 'selection_full' using errcode = 'P0001',
        detail = json_build_object('selected', v_selected, 'required', c.creators_required)::text;
    end if;
  end if;

  update public.campaign_applications set status = v_next, decided_by = v_uid where id = a.id;

  if v_next = 'selected' then
    insert into public.campaign_assignments (campaign_id, application_id, creator_id, reward_cents, due_at)
    values (c.id, a.id, a.creator_id, c.payment_per_creator_cents, c.task_deadline);

    perform public._notify(
      a.creator_id, 'application_selected', 'You were selected',
      'You were selected for "' || c.title || '". Complete the task and submit your proof by '
        || to_char(c.task_deadline at time zone 'UTC', 'DD Mon YYYY') || ' (UTC).',
      '/tasks',
      jsonb_build_object('campaign_id', c.id, 'application_id', a.id)
    );
  end if;

  return v_next;
end;
$$;

-- Backfill: any application selected before this migration gets its assignment.
insert into public.campaign_assignments (campaign_id, application_id, creator_id, reward_cents, due_at)
select a.campaign_id, a.id, a.creator_id, c.payment_per_creator_cents, c.task_deadline
from public.campaign_applications a
join public.campaigns c on c.id = a.campaign_id
where a.status = 'selected'
  and not exists (select 1 from public.campaign_assignments x where x.application_id = a.id);

-- -----------------------------------------------------------------------------
-- Creator: submit completion
-- -----------------------------------------------------------------------------
-- p_items: [{ "task_id": uuid, "url": text|null, "comment_text": text|null }, ...]
-- Must contain exactly one entry per campaign task.
create or replace function public.submit_task_completion(p_assignment_id uuid, p_items jsonb, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  asg public.campaign_assignments%rowtype;
  c public.campaigns%rowtype;
  t record;
  v_item jsonb;
  v_url text;
  v_comment text;
  v_submission uuid;
  v_task_count integer;
  v_item_count integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into asg from public.campaign_assignments where id = p_assignment_id for update;
  if not found or asg.creator_id <> v_uid then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;
  select * into c from public.campaigns where id = asg.campaign_id;

  if asg.status not in ('in_progress', 'revision_requested') then
    raise exception 'submission_not_allowed: %', asg.status using errcode = 'P0001';
  end if;
  if c.status in ('cancelled', 'completed') then
    raise exception 'submission_not_allowed: campaign_%', c.status using errcode = 'P0001';
  end if;
  if now() > asg.due_at then
    raise exception 'deadline_passed' using errcode = 'P0001';
  end if;
  if asg.attempt_count >= asg.max_attempts then
    raise exception 'attempts_exhausted' using errcode = 'P0001';
  end if;
  if p_note is not null and char_length(p_note) > 1000 then
    raise exception 'note_too_long' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array' then
    raise exception 'invalid_proof: items' using errcode = '22023';
  end if;

  select count(*) into v_task_count from public.campaign_tasks where campaign_id = c.id;
  select count(distinct (i ->> 'task_id')) into v_item_count from jsonb_array_elements(p_items) i;
  if v_item_count <> jsonb_array_length(p_items) or v_item_count <> v_task_count then
    raise exception 'invalid_proof: task_count' using errcode = '22023';
  end if;

  -- Validate every task against its proof rule.
  for t in
    select ct.id, ct.platform, r.proof_url, r.requires_comment_text
    from public.campaign_tasks ct
    join public.campaign_task_type_rules r on r.task_type = ct.task_type
    where ct.campaign_id = c.id
  loop
    select i into v_item from jsonb_array_elements(p_items) i where i ->> 'task_id' = t.id::text;
    if v_item is null then
      raise exception 'invalid_proof: missing_task %', t.id using errcode = '22023';
    end if;
    v_url := nullif(btrim(coalesce(v_item ->> 'url', '')), '');
    v_comment := nullif(btrim(coalesce(v_item ->> 'comment_text', '')), '');

    if t.proof_url = 'required' and v_url is null then
      raise exception 'invalid_proof: url_required %', t.id using errcode = '22023';
    end if;
    -- Tasks with no proof link (e.g. follow) ignore any link sent; it is not stored.
    if v_url is not null and t.proof_url <> 'none' and not public.proof_url_matches_platform(t.platform, v_url) then
      raise exception 'invalid_proof: url_platform %', t.id using errcode = '22023';
    end if;
    if t.requires_comment_text and v_comment is null then
      raise exception 'invalid_proof: comment_required %', t.id using errcode = '22023';
    end if;
    v_item := null;
  end loop;

  insert into public.task_submissions (assignment_id, attempt, note)
  values (asg.id, asg.attempt_count + 1, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_submission;

  insert into public.task_submission_items (submission_id, campaign_task_id, proof_url, comment_text)
  select v_submission, (i ->> 'task_id')::uuid,
         case when r.proof_url = 'none' then null else nullif(btrim(coalesce(i ->> 'url', '')), '') end,
         case when r.requires_comment_text then nullif(btrim(coalesce(i ->> 'comment_text', '')), '') else null end
  from jsonb_array_elements(p_items) i
  join public.campaign_tasks ct on ct.id = (i ->> 'task_id')::uuid and ct.campaign_id = c.id
  join public.campaign_task_type_rules r on r.task_type = ct.task_type;

  update public.campaign_assignments
  set status = 'submitted', attempt_count = attempt_count + 1, submitted_at = now()
  where id = asg.id;

  perform public._sync_campaign_review_state(c.id);

  perform public._notify(
    c.owner_id, 'task_submitted', 'Work submitted for review',
    coalesce((select creator_name from public.campaign_applications where id = asg.application_id), 'A creator')
      || ' submitted their work for "' || c.title || '".',
    '/campaigns/' || c.id::text || '/submissions',
    jsonb_build_object('campaign_id', c.id, 'assignment_id', asg.id, 'submission_id', v_submission)
  );

  return v_submission;
end;
$$;

revoke all on function public.submit_task_completion(uuid, jsonb, text) from public, anon;
grant execute on function public.submit_task_completion(uuid, jsonb, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Advertiser: review the latest submission
-- -----------------------------------------------------------------------------
create or replace function public.review_task_submission(
  p_submission_id uuid,
  p_decision public.review_decision,
  p_reason text default null,
  p_allow_resubmission boolean default false
)
returns public.assignment_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  s public.task_submissions%rowtype;
  asg public.campaign_assignments%rowtype;
  c public.campaigns%rowtype;
  v_next public.assignment_status;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_admin record;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into s from public.task_submissions where id = p_submission_id;
  if not found then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;
  select * into asg from public.campaign_assignments where id = s.assignment_id for update;
  select * into c from public.campaigns where id = asg.campaign_id;
  if c.owner_id is distinct from v_uid then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;

  if asg.status <> 'submitted' or s.attempt <> asg.attempt_count
     or exists (select 1 from public.task_reviews where submission_id = s.id) then
    raise exception 'review_not_allowed: %', asg.status using errcode = 'P0001';
  end if;

  if p_decision = 'rejected' and (v_reason is null or char_length(v_reason) < 3) then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  if p_decision = 'approved' then
    v_next := 'approved';
  elsif p_allow_resubmission and asg.attempt_count < asg.max_attempts and now() <= asg.due_at then
    v_next := 'revision_requested';
  else
    v_next := 'rejected';
  end if;

  insert into public.task_reviews (submission_id, decision, reason, allow_resubmission, reviewer_id)
  values (s.id, p_decision,
          -- Approvals may carry an optional note; drop it if too short to be meaningful.
          case when p_decision = 'approved' and char_length(coalesce(v_reason, '')) < 3 then null else left(v_reason, 1000) end,
          v_next = 'revision_requested', v_uid);

  update public.campaign_assignments set status = v_next, decided_at = now() where id = asg.id;

  perform public._sync_campaign_review_state(c.id);

  if v_next = 'approved' then
    perform public._notify(
      asg.creator_id, 'task_approved', 'Your work was approved',
      'Your work for "' || c.title || '" was approved. The agency will release your payment.',
      '/tasks/' || asg.id::text,
      jsonb_build_object('campaign_id', c.id, 'assignment_id', asg.id)
    );
    for v_admin in select ur.user_id from public.user_roles ur where ur.role = 'admin' loop
      perform public._notify(
        v_admin.user_id, 'payout_ready', 'Ready for payout',
        'An advertiser approved work on "' || c.title || '". It is ready for payout review.',
        '/admin',
        jsonb_build_object('campaign_id', c.id, 'assignment_id', asg.id)
      );
    end loop;
  elsif v_next = 'revision_requested' then
    perform public._notify(
      asg.creator_id, 'task_rejected', 'Changes requested',
      'The advertiser asked for changes on "' || c.title || '": ' || left(v_reason, 300),
      '/tasks/' || asg.id::text,
      jsonb_build_object('campaign_id', c.id, 'assignment_id', asg.id)
    );
  else
    perform public._notify(
      asg.creator_id, 'task_rejected', 'Submission rejected',
      'Your submission for "' || c.title || '" was rejected: ' || left(v_reason, 300),
      '/tasks/' || asg.id::text,
      jsonb_build_object('campaign_id', c.id, 'assignment_id', asg.id)
    );
  end if;

  return v_next;
end;
$$;

revoke all on function public.review_task_submission(uuid, public.review_decision, text, boolean) from public, anon;
grant execute on function public.review_task_submission(uuid, public.review_decision, text, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Advertiser: campaign lifecycle
-- -----------------------------------------------------------------------------
-- selection_in_progress → in_progress (needs at least one selected creator)
create or replace function public.start_campaign_work(p_campaign_id uuid)
returns public.campaign_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.campaign_status;
begin
  select status into v_status from public.campaigns
  where id = p_campaign_id and owner_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'campaign_not_found' using errcode = 'P0002';
  end if;
  if v_status in ('in_progress', 'review_pending') then
    return v_status;
  end if;
  if v_status <> 'selection_in_progress' then
    raise exception 'invalid_campaign_transition: % -> in_progress', v_status using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.campaign_assignments where campaign_id = p_campaign_id) then
    raise exception 'no_selected_creators' using errcode = 'P0001';
  end if;
  update public.campaigns set status = 'in_progress' where id = p_campaign_id;
  perform public._sync_campaign_review_state(p_campaign_id);
  return (select status from public.campaigns where id = p_campaign_id);
end;
$$;

-- in_progress → completed once nothing is awaiting review and no creator can still
-- submit. Unfinished assignments past their deadline become 'expired'.
create or replace function public.complete_campaign(p_campaign_id uuid)
returns public.campaign_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.campaign_status;
begin
  select status into v_status from public.campaigns
  where id = p_campaign_id and owner_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'campaign_not_found' using errcode = 'P0002';
  end if;
  if v_status = 'completed' then
    return v_status;
  end if;
  if v_status not in ('in_progress', 'review_pending') then
    raise exception 'invalid_campaign_transition: % -> completed', v_status using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.campaign_assignments
    where campaign_id = p_campaign_id
      and (status = 'submitted' or (status in ('in_progress', 'revision_requested') and due_at >= now()))
  ) then
    raise exception 'work_outstanding' using errcode = 'P0001';
  end if;
  update public.campaign_assignments
  set status = 'expired', decided_at = now()
  where campaign_id = p_campaign_id and status in ('in_progress', 'revision_requested');
  update public.campaigns set status = 'completed' where id = p_campaign_id;
  return 'completed';
end;
$$;

revoke all on function public.start_campaign_work(uuid) from public, anon;
revoke all on function public.complete_campaign(uuid) from public, anon;
grant execute on function public.start_campaign_work(uuid) to authenticated;
grant execute on function public.complete_campaign(uuid) to authenticated;

-- Counts per assignment status for the owner's campaign (RLS applies).
create or replace function public.campaign_assignment_counts(p_campaign_id uuid)
returns table (status public.assignment_status, total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.status, count(*)::bigint
  from public.campaign_assignments a
  where a.campaign_id = p_campaign_id
  group by a.status;
$$;

revoke all on function public.campaign_assignment_counts(uuid) from public, anon;
grant execute on function public.campaign_assignment_counts(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Privileges + RLS: read-only for clients
-- -----------------------------------------------------------------------------
revoke all on public.campaign_assignments, public.task_submissions, public.task_submission_items,
  public.task_reviews from anon, authenticated;
grant select on public.campaign_assignments, public.task_submissions, public.task_submission_items,
  public.task_reviews to authenticated;

alter table public.campaign_assignments enable row level security;
alter table public.task_submissions enable row level security;
alter table public.task_submission_items enable row level security;
alter table public.task_reviews enable row level security;

create or replace function public.can_view_assignment(_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_assignments a
    where a.id = _assignment_id
      and (a.creator_id = (select auth.uid()) or public.is_campaign_owner(a.campaign_id) or public.is_admin())
  );
$$;

revoke all on function public.can_view_assignment(uuid) from public, anon;
grant execute on function public.can_view_assignment(uuid) to authenticated;

create or replace function public.can_view_submission(_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.task_submissions s
    where s.id = _submission_id and public.can_view_assignment(s.assignment_id)
  );
$$;

revoke all on function public.can_view_submission(uuid) from public, anon;
grant execute on function public.can_view_submission(uuid) to authenticated;

create policy "campaign_assignments: creator, owner and admin read" on public.campaign_assignments
  for select to authenticated using (public.can_view_assignment(id));
create policy "task_submissions: visible with assignment" on public.task_submissions
  for select to authenticated using (public.can_view_assignment(assignment_id));
create policy "task_submission_items: visible with submission" on public.task_submission_items
  for select to authenticated using (public.can_view_submission(submission_id));
create policy "task_reviews: visible with submission" on public.task_reviews
  for select to authenticated using (public.can_view_submission(submission_id));
