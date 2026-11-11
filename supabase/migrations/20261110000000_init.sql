-- Roomieva · initial schema
-- Normalised tables, constraints, indexes, row level security, and the
-- security-definer functions that carry out privileged actions.
--
-- Conventions
--   * Every table has RLS enabled. Anything not explicitly allowed is denied.
--   * Clients never set trust-bearing columns (verification flags, is_admin,
--     listing status beyond a few safe transitions). Triggers enforce this.
--   * Multi-row or cross-user operations go through functions, which re-check
--     who is calling.

create extension if not exists pgcrypto;

/* ───────────────────────── helpers ───────────────────────── */

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

/* ───────────────────────── people ────────────────────────── */

create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  display_name          text not null default '' check (char_length(display_name) <= 40),
  avatar_url            text,
  city                  text not null default 'Bengaluru',
  occupation            text not null default '' check (char_length(occupation) <= 60),
  stage                 text not null default 'professional' check (stage in ('professional', 'student', 'intern')),
  bio                   text not null default '' check (char_length(bio) <= 400),
  intent                text not null default 'seeking' check (intent in ('seeking', 'listing', 'both')),
  budget_min            integer not null default 12000 check (budget_min >= 0),
  budget_max            integer not null default 25000 check (budget_max >= budget_min),
  move_in_by            date,
  preferred_localities  text[] not null default '{}' check (cardinality(preferred_localities) <= 5),
  -- Verification levels are separate facts. None implies another; none is proof of identity.
  email_verified        boolean not null default false,
  phone_verified        boolean not null default false,
  institution_verified  boolean not null default false,
  is_admin              boolean not null default false,
  is_demo               boolean not null default false,
  onboarded             boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index profiles_discovery_idx on public.profiles (city, intent) where onboarded;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- Email and phone live apart from the public profile and are only ever read
-- by their owner, or handed over by shared_contact() after mutual consent.
create table public.private_contacts (
  user_id  uuid primary key references public.profiles (id) on delete cascade,
  email    text not null,
  phone    text
);

create table public.institution_domains (
  domain text primary key
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Users may edit their own profile, but never their own trust flags.
create or replace function public.protect_profile_flags() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and coalesce(current_setting('saha.trusted', true), '') <> '1' then
    new.email_verified := old.email_verified;
    new.phone_verified := old.phone_verified;
    new.institution_verified := old.institution_verified;
    new.is_admin := old.is_admin;
    new.is_demo := old.is_demo;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile_flags();

-- Keep profile + contact rows in step with auth.users.
create or replace function public.sync_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  confirmed boolean := new.email_confirmed_at is not null;
  v_domain text := lower(split_part(coalesce(new.email, ''), '@', 2));
  recognised boolean := exists (
    select 1 from public.institution_domains d where v_domain = d.domain or v_domain like '%.' || d.domain
  );
begin
  perform set_config('saha.trusted', '1', true);
  insert into public.profiles (id, email_verified, institution_verified)
  values (new.id, confirmed, confirmed and recognised)
  on conflict (id) do update
    set email_verified = excluded.email_verified,
        institution_verified = excluded.institution_verified;
  insert into public.private_contacts (user_id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (user_id) do update set email = excluded.email;
  return new;
end $$;
create trigger on_auth_user_changed
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.sync_auth_user();

create table public.lifestyle_preferences (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  -- Option index on each question's spectrum. NULL = not answered or skipped.
  sleep        smallint check (sleep between 0 and 2),
  cleanliness  smallint check (cleanliness between 0 and 2),
  food         smallint check (food between 0 and 2),
  cooking      smallint check (cooking between 0 and 2),
  smoking      smallint check (smoking between 0 and 2),
  drinking     smallint check (drinking between 0 and 2),
  guests       smallint check (guests between 0 and 2),
  noise        smallint check (noise between 0 and 2),
  wfh          smallint check (wfh between 0 and 2),
  social       smallint check (social between 0 and 2),
  expenses     smallint check (expenses between 0 and 2),
  ac           smallint check (ac between 0 and 2),
  -- { "<question>": "flexible" | "important" | "dealbreaker" }
  importance   jsonb not null default '{}'::jsonb,
  -- Questions the person chose to skip (as opposed to not having reached).
  skipped      text[] not null default '{}',
  updated_at   timestamptz not null default now()
);
create trigger lifestyle_touch before update on public.lifestyle_preferences for each row execute function public.touch_updated_at();

create table public.user_blocks (
  blocker_id  uuid not null references public.profiles (id) on delete cascade,
  blocked_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

/* ───────────────────────── homes ─────────────────────────── */

create table public.properties (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  city           text not null default 'Bengaluru',
  locality       text not null default '',
  -- Deliberately imprecise public coordinates (neighbourhood centre + offset).
  approx_lat     double precision not null default 0,
  approx_lng     double precision not null default 0,
  property_type  text not null default 'apartment' check (property_type in ('apartment', 'gated_society', 'independent_house', 'builder_floor')),
  bedrooms       smallint not null default 1 check (bedrooms between 1 and 8),
  bathrooms      smallint not null default 1 check (bathrooms between 1 and 8),
  furnishing     text not null default 'semi' check (furnishing in ('furnished', 'semi', 'unfurnished')),
  amenities      text[] not null default '{}',
  house_rules    text[] not null default '{}',
  description    text not null default '' check (char_length(description) <= 1500),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index properties_owner_idx on public.properties (owner_id);
create index properties_place_idx on public.properties (city, locality);
create trigger properties_touch before update on public.properties for each row execute function public.touch_updated_at();

-- The exact address is its own table so RLS can keep it to the owner and moderators.
create table public.property_addresses (
  property_id  uuid primary key references public.properties (id) on delete cascade,
  address      text not null check (char_length(address) <= 240)
);

create table public.listings (
  id                 uuid primary key default gen_random_uuid(),
  property_id        uuid not null references public.properties (id) on delete cascade,
  lister_id          uuid not null references public.profiles (id) on delete cascade,
  title              text not null default '' check (char_length(title) <= 80),
  room_type          text not null default 'private' check (room_type in ('private', 'shared', 'entire')),
  rent               integer not null default 0 check (rent >= 0 and rent <= 300000),
  deposit            integer not null default 0 check (deposit >= 0),
  brokerage          integer not null default 0 check (brokerage >= 0),
  available_from     date,
  occupant_count     smallint not null default 0 check (occupant_count between 0 and 12),
  occupant_summary   text not null default '' check (char_length(occupant_summary) <= 300),
  lister_lives_here  boolean not null default false,
  status             text not null default 'draft' check (status in ('draft', 'active', 'paused', 'occupied', 'under_review', 'removed')),
  review_reason      text,
  verification       text not null default 'none' check (verification in ('none', 'reviewed', 'property_verified')),
  -- Normalised "same room?" key, maintained by trigger. See listing_fingerprint().
  fingerprint        text not null default '',
  published_at       timestamptz,
  last_confirmed_at  timestamptz,
  is_demo            boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (deposit <= greatest(rent, 1) * 12)
);
create index listings_discovery_idx on public.listings (status, last_confirmed_at desc);
create index listings_lister_idx on public.listings (lister_id);
create index listings_property_idx on public.listings (property_id);
create index listings_fingerprint_idx on public.listings (fingerprint) where status in ('active', 'under_review');
create index listings_rent_idx on public.listings (rent) where status = 'active';
create trigger listings_touch before update on public.listings for each row execute function public.touch_updated_at();

create table public.listing_photos (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings (id) on delete cascade,
  url           text not null,
  alt           text not null default '',
  position      smallint not null default 0,
  -- SHA-256 of the uploaded bytes; lets us spot the same photo on two listings.
  content_hash  text not null default '',
  unique (listing_id, position)
);
create index listing_photos_hash_idx on public.listing_photos (content_hash) where content_hash <> '';

create table public.listing_refresh_history (
  id            bigint generated always as identity primary key,
  listing_id    uuid not null references public.listings (id) on delete cascade,
  confirmed_by  uuid not null references public.profiles (id) on delete cascade,
  confirmed_at  timestamptz not null default now()
);
create index listing_refresh_listing_idx on public.listing_refresh_history (listing_id, confirmed_at desc);

create table public.saved_listings (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  listing_id  uuid not null references public.listings (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create or replace function public.listing_fingerprint(l public.listings) returns text
language sql stable set search_path = public as $$
  select concat_ws('|',
    regexp_replace(lower(p.city), '[^a-z0-9]+', ' ', 'g'),
    regexp_replace(lower(p.locality), '[^a-z0-9]+', ' ', 'g'),
    p.bedrooms, p.bathrooms, l.room_type, p.furnishing, round(l.rent / 1000.0))
  from public.properties p where p.id = l.property_id;
$$;

-- What a lister may and may not change on their own listing.
create or replace function public.guard_listing() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  trusted boolean := auth.uid() is null or public.is_admin() or coalesce(current_setting('saha.trusted', true), '') = '1';
begin
  new.fingerprint := coalesce(public.listing_fingerprint(new), '');
  if trusted then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.verification := 'none';
    new.review_reason := null;
    new.published_at := null;
    new.last_confirmed_at := null;
    new.is_demo := false;
    return new;
  end if;

  new.lister_id := old.lister_id;
  new.property_id := old.property_id;
  new.review_reason := old.review_reason;
  new.published_at := old.published_at;
  new.last_confirmed_at := old.last_confirmed_at;
  new.is_demo := old.is_demo;

  if old.status in ('under_review', 'removed') then
    raise exception 'This listing is with a moderator and cannot be changed right now.' using errcode = '42501';
  end if;

  -- A moderator's review covers the content they read. Editing it clears the badge.
  if (new.title, new.rent, new.deposit, new.room_type) is distinct from (old.title, old.rent, old.deposit, old.room_type) then
    new.verification := 'none';
  else
    new.verification := old.verification;
  end if;

  -- Listers can pause, or mark filled. Going live (again) runs through publish_listing().
  if new.status <> old.status and not (
       (old.status = 'active' and new.status in ('paused', 'occupied'))
    or (old.status = 'paused' and new.status = 'occupied')
  ) then
    raise exception 'That status change is not allowed here.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger listings_guard before insert or update on public.listings for each row execute function public.guard_listing();

-- Editing the property under a reviewed listing also clears the review.
create or replace function public.property_edit_clears_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and (new.locality, new.description, new.bedrooms) is distinct from (old.locality, old.description, old.bedrooms) then
    perform set_config('saha.trusted', '1', true);
    update public.listings set verification = 'none' where property_id = new.id and verification <> 'none';
    perform set_config('saha.trusted', '', true);
  end if;
  return new;
end $$;
create trigger properties_review_reset after update on public.properties for each row execute function public.property_edit_clears_review();

/* ───────────────────────── conversations ─────────────────── */

create table public.conversations (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid references public.listings (id) on delete set null,
  requester_id     uuid not null references public.profiles (id) on delete cascade,
  recipient_id     uuid not null references public.profiles (id) on delete cascade,
  status           text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz not null default now(),
  check (requester_id <> recipient_id)
);
-- One thread per pair per listing (and one general thread per pair), whichever way round it started.
create unique index conversations_pair_idx on public.conversations (
  least(requester_id, recipient_id), greatest(requester_id, recipient_id),
  coalesce(listing_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
create index conversations_recipient_idx on public.conversations (recipient_id, status);
create index conversations_requester_idx on public.conversations (requester_id);

create table public.conversation_members (
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  last_read_at     timestamptz not null default 'epoch',
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  sender_id        uuid not null references public.profiles (id) on delete cascade,
  body             text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at       timestamptz not null default now()
);
create index messages_thread_idx on public.messages (conversation_id, created_at);

create table public.contact_sharing_consents (
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  created_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create or replace function public.is_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members where conversation_id = c and user_id = auth.uid());
$$;

create or replace function public.bump_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_members set last_read_at = new.created_at
    where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end $$;
create trigger messages_bump after insert on public.messages for each row execute function public.bump_conversation();

/* ───────────────────────── trust & safety ────────────────── */

create table public.verification_records (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles (id) on delete cascade,
  listing_id   uuid references public.listings (id) on delete cascade,
  kind         text not null check (kind in ('email', 'phone', 'institution', 'listing_review', 'property')),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- A note about what was checked. Never raw identity documents.
  note         text not null default '',
  reviewed_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  check (user_id is not null or listing_id is not null)
);
create index verification_user_idx on public.verification_records (user_id);
create index verification_listing_idx on public.verification_records (listing_id);

create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.profiles (id) on delete cascade,
  target_type  text not null check (target_type in ('listing', 'user', 'conversation')),
  target_id    uuid not null,
  reason       text not null check (char_length(reason) between 1 and 120),
  details      text not null default '' check (char_length(details) <= 1000),
  status       text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at   timestamptz not null default now()
);
create unique index reports_one_open_idx on public.reports (reporter_id, target_id) where status = 'open';
create index reports_target_idx on public.reports (target_type, target_id) where status = 'open';

create table public.moderation_actions (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid not null references public.profiles (id) on delete cascade,
  target_type  text not null check (target_type in ('listing', 'user', 'conversation')),
  target_id    uuid not null,
  action       text not null,
  note         text not null default '',
  created_at   timestamptz not null default now()
);
create index moderation_actions_recent_idx on public.moderation_actions (created_at desc);

-- Three independent open reports take a listing out of search until someone looks.
create or replace function public.reports_auto_hold() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.target_type = 'listing' and (
    select count(distinct reporter_id) from public.reports
    where target_type = 'listing' and target_id = new.target_id and status = 'open'
  ) >= 3 then
    perform set_config('saha.trusted', '1', true);
    update public.listings set status = 'under_review', review_reason = 'Reported by several people'
      where id = new.target_id and status = 'active';
    perform set_config('saha.trusted', '', true);
  end if;
  return new;
end $$;
create trigger reports_hold after insert on public.reports for each row execute function public.reports_auto_hold();

/* ───────────────────────── functions (RPC) ───────────────── */

-- Configurable staleness window, in days.
create or replace function public.stale_after_days() returns integer language sql immutable as $$ select 21 $$;

create or replace function public.is_discoverable(l public.listings) returns boolean
language sql stable as $$
  select l.status = 'active'
     and coalesce(l.last_confirmed_at, l.published_at) > now() - make_interval(days => public.stale_after_days());
$$;

-- Publish or re-publish. Validates completeness and checks for duplicates;
-- suspected duplicates are held for a moderator instead of going live.
create or replace function public.publish_listing(p_listing uuid) returns public.listings
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  p public.properties;
  photo_count integer;
  reason text;
begin
  select * into l from public.listings where id = p_listing for update;
  if l.id is null or l.lister_id <> auth.uid() then
    raise exception 'Listing not found.' using errcode = '42501';
  end if;
  if l.status in ('under_review', 'removed') then
    raise exception 'This listing is with a moderator and cannot be changed right now.' using errcode = '42501';
  end if;
  if not (select onboarded from public.profiles where id = auth.uid()) then
    raise exception 'Finish setting up your profile before publishing.' using errcode = '42501';
  end if;
  select * into p from public.properties where id = l.property_id;
  select count(*) into photo_count from public.listing_photos where listing_id = l.id;

  if char_length(btrim(l.title)) < 12 then raise exception 'Give it a title of at least 12 characters.' using errcode = '22023'; end if;
  if char_length(btrim(p.description)) < 60 then raise exception 'Describe the home in at least 60 characters.' using errcode = '22023'; end if;
  if p.locality = '' then raise exception 'Choose a locality.' using errcode = '22023'; end if;
  if l.rent < 3000 then raise exception 'Rent should be at least ₹3,000.' using errcode = '22023'; end if;
  if l.available_from is null then raise exception 'Pick the date it is available from.' using errcode = '22023'; end if;
  if photo_count < 3 then raise exception 'Add at least 3 photos of the actual home.' using errcode = '22023'; end if;
  if not exists (select 1 from public.property_addresses a where a.property_id = p.id and char_length(btrim(a.address)) >= 8) then
    raise exception 'Add the full address. Only you and moderators see it.' using errcode = '22023';
  end if;
  if l.room_type <> 'entire' and char_length(btrim(l.occupant_summary)) < 10 then
    raise exception 'Say a little about who lives there now.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.listing_photos mine
    join public.listing_photos theirs on theirs.content_hash = mine.content_hash and theirs.listing_id <> mine.listing_id
    join public.listings o on o.id = theirs.listing_id and o.status in ('active', 'under_review')
    where mine.listing_id = l.id and mine.content_hash <> ''
  ) then
    reason := 'Shares a photo with another live listing';
  elsif exists (
    select 1 from public.listings o
    where o.id <> l.id and o.status in ('active', 'under_review') and o.fingerprint = l.fingerprint
      and (o.lister_id = l.lister_id or lower(btrim(o.title)) = lower(btrim(l.title)))
  ) then
    reason := 'Same details as another live listing';
  end if;

  perform set_config('saha.trusted', '1', true);
  update public.listings set
    status = case when reason is null then 'active' else 'under_review' end,
    review_reason = reason,
    published_at = coalesce(published_at, now()),
    last_confirmed_at = now()
  where id = l.id
  returning * into l;
  insert into public.listing_refresh_history (listing_id, confirmed_by) values (l.id, auth.uid());
  perform set_config('saha.trusted', '', true);
  return l;
end $$;

-- "Yes, this room is still available."
create or replace function public.confirm_listing_available(p_listing uuid) returns public.listings
language plpgsql security definer set search_path = public as $$
declare l public.listings;
begin
  perform set_config('saha.trusted', '1', true);
  update public.listings set last_confirmed_at = now()
    where id = p_listing and lister_id = auth.uid() and status = 'active'
    returning * into l;
  perform set_config('saha.trusted', '', true);
  if l.id is null then
    raise exception 'Only your own live listings can be reconfirmed.' using errcode = '42501';
  end if;
  insert into public.listing_refresh_history (listing_id, confirmed_by) values (l.id, auth.uid());
  return l;
end $$;

-- A first message is a request. It creates the thread, both memberships and the message together.
create or replace function public.start_conversation(p_to uuid, p_listing uuid, p_body text) returns public.conversations
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  c public.conversations;
  l public.listings;
begin
  if me is null then raise exception 'Please log in to continue.' using errcode = '42501'; end if;
  if p_to = me then raise exception 'You cannot message yourself.' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'Write a message of up to 2,000 characters.' using errcode = '22023';
  end if;
  if not coalesce((select onboarded from public.profiles where id = me), false) then
    raise exception 'Finish setting up your profile before messaging.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_to) then
    raise exception 'That person is not on Roomieva any more.' using errcode = '22023';
  end if;
  if public.is_blocked(me, p_to) then
    raise exception 'You cannot message this person.' using errcode = '42501';
  end if;
  if p_listing is not null then
    select * into l from public.listings where id = p_listing;
    if l.id is null or not public.is_discoverable(l) then
      raise exception 'This home is not taking messages right now.' using errcode = '22023';
    end if;
  end if;
  begin
    insert into public.conversations (listing_id, requester_id, recipient_id)
    values (p_listing, me, p_to) returning * into c;
  exception when unique_violation then
    raise exception 'You already have a conversation about this. Find it in Messages.' using errcode = '23505';
  end;
  insert into public.conversation_members (conversation_id, user_id) values (c.id, me), (c.id, p_to);
  insert into public.messages (conversation_id, sender_id, body) values (c.id, me, btrim(p_body));
  return c;
end $$;

create or replace function public.respond_to_request(p_conversation uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
    set status = case when p_accept then 'accepted' else 'declined' end
    where id = p_conversation and recipient_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'This request has already been answered, or is not yours to answer.' using errcode = '42501';
  end if;
end $$;

create or replace function public.mark_read(p_conversation uuid) returns void
language sql security definer set search_path = public as $$
  update public.conversation_members set last_read_at = now()
  where conversation_id = p_conversation and user_id = auth.uid();
$$;

-- Hands over the other person's contact details only when both have agreed.
create or replace function public.shared_contact(p_conversation uuid) returns table (email text, phone text)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  other uuid;
begin
  select case when requester_id = me then recipient_id else requester_id end into other
  from public.conversations
  where id = p_conversation and status = 'accepted' and me in (requester_id, recipient_id);
  if other is null or public.is_blocked(me, other) then return; end if;
  if (select count(*) from public.contact_sharing_consents where conversation_id = p_conversation and user_id in (me, other)) < 2 then
    return;
  end if;
  return query select pc.email, pc.phone from public.private_contacts pc where pc.user_id = other;
end $$;

-- Blocking someone also withdraws contact details you agreed to share with them.
create or replace function public.block_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user = auth.uid() then raise exception 'You cannot block yourself.' using errcode = '22023'; end if;
  insert into public.user_blocks (blocker_id, blocked_id) values (auth.uid(), p_user) on conflict do nothing;
  delete from public.contact_sharing_consents s
    using public.conversations c
    where s.conversation_id = c.id and s.user_id = auth.uid()
      and p_user in (c.requester_id, c.recipient_id) and auth.uid() in (c.requester_id, c.recipient_id);
end $$;

create or replace function public.admin_resolve_listing(p_listing uuid, p_decision text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only moderators can do that.' using errcode = '42501'; end if;
  if p_decision not in ('approve', 'mark_reviewed', 'remove') then raise exception 'Unknown decision.' using errcode = '22023'; end if;
  if p_decision = 'remove' then
    update public.listings set status = 'removed' where id = p_listing;
    update public.reports set status = 'actioned' where target_type = 'listing' and target_id = p_listing and status = 'open';
  else
    update public.listings set
      status = case when status = 'under_review' then 'active' else status end,
      review_reason = null,
      last_confirmed_at = coalesce(last_confirmed_at, now()),
      verification = case when p_decision = 'mark_reviewed' and verification = 'none' then 'reviewed' else verification end
    where id = p_listing;
    update public.reports set status = 'dismissed' where target_type = 'listing' and target_id = p_listing and status = 'open';
    if p_decision = 'mark_reviewed' then
      insert into public.verification_records (listing_id, kind, status, note, reviewed_by)
      values (p_listing, 'listing_review', 'approved', coalesce(p_note, ''), auth.uid());
    end if;
  end if;
  insert into public.moderation_actions (admin_id, target_type, target_id, action, note)
  values (auth.uid(), 'listing', p_listing, p_decision, coalesce(p_note, ''));
end $$;

create or replace function public.admin_resolve_report(p_report uuid, p_status text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.reports;
begin
  if not public.is_admin() then raise exception 'Only moderators can do that.' using errcode = '42501'; end if;
  if p_status not in ('actioned', 'dismissed') then raise exception 'Unknown status.' using errcode = '22023'; end if;
  update public.reports set status = p_status where id = p_report returning * into r;
  if r.id is null then raise exception 'Report not found.' using errcode = '22023'; end if;
  insert into public.moderation_actions (admin_id, target_type, target_id, action, note)
  values (auth.uid(), r.target_type, r.target_id, 'report_' || p_status, coalesce(p_note, ''));
end $$;

/* ───────────────────────── row level security ────────────── */

alter table public.profiles                  enable row level security;
alter table public.private_contacts          enable row level security;
alter table public.institution_domains       enable row level security;
alter table public.lifestyle_preferences     enable row level security;
alter table public.user_blocks               enable row level security;
alter table public.properties                enable row level security;
alter table public.property_addresses        enable row level security;
alter table public.listings                  enable row level security;
alter table public.listing_photos            enable row level security;
alter table public.listing_refresh_history   enable row level security;
alter table public.saved_listings            enable row level security;
alter table public.conversations             enable row level security;
alter table public.conversation_members      enable row level security;
alter table public.messages                  enable row level security;
alter table public.contact_sharing_consents  enable row level security;
alter table public.verification_records      enable row level security;
alter table public.reports                   enable row level security;
alter table public.moderation_actions        enable row level security;

-- profiles: public card data is readable; only you edit yours.
create policy profiles_read on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- private contacts: owner only. Everyone else goes through shared_contact().
create policy contacts_own on public.private_contacts for select using (user_id = auth.uid());
-- No client write policy: email mirrors auth.users, and a phone number is only stored by a real OTP flow.

create policy institution_domains_read on public.institution_domains for select using (true);

-- lifestyle answers: visible to signed-in members (needed to compute a match), never to the open web.
create policy lifestyle_read on public.lifestyle_preferences for select to authenticated using (true);
create policy lifestyle_insert_own on public.lifestyle_preferences for insert to authenticated with check (user_id = auth.uid());
create policy lifestyle_update_own on public.lifestyle_preferences for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- blocks: you see and manage only the blocks you made.
create policy blocks_read_own on public.user_blocks for select using (blocker_id = auth.uid());
create policy blocks_delete_own on public.user_blocks for delete using (blocker_id = auth.uid());

-- properties: readable when attached to a publicly visible listing, or yours.
create policy properties_read on public.properties for select using (
  owner_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.listings l where l.property_id = properties.id and l.status in ('active', 'occupied', 'paused'))
);
create policy properties_insert_own on public.properties for insert to authenticated with check (owner_id = auth.uid());
create policy properties_update_own on public.properties for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy properties_delete_own on public.properties for delete using (owner_id = auth.uid());

-- addresses: owner and moderators only. Never public.
create policy addresses_read on public.property_addresses for select using (
  public.is_admin() or exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
);
create policy addresses_insert on public.property_addresses for insert with check (
  exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
);
create policy addresses_update on public.property_addresses for update using (
  exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
);

-- listings: drafts, held and removed listings are private to the lister and moderators.
create policy listings_read on public.listings for select using (
  status in ('active', 'occupied', 'paused') or lister_id = auth.uid() or public.is_admin()
);
create policy listings_insert_own on public.listings for insert to authenticated with check (
  lister_id = auth.uid() and exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
);
create policy listings_update_own on public.listings for update using (lister_id = auth.uid()) with check (lister_id = auth.uid());
create policy listings_delete_own on public.listings for delete using (lister_id = auth.uid());

create policy photos_read on public.listing_photos for select using (
  exists (select 1 from public.listings l where l.id = listing_id)
);
create policy photos_write_own on public.listing_photos for all using (
  exists (select 1 from public.listings l where l.id = listing_id and l.lister_id = auth.uid())
) with check (
  exists (select 1 from public.listings l where l.id = listing_id and l.lister_id = auth.uid())
);

create policy refresh_read on public.listing_refresh_history for select using (
  public.is_admin() or exists (select 1 from public.listings l where l.id = listing_id and l.lister_id = auth.uid())
);

create policy saved_own on public.saved_listings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- conversations: members only. Created and answered through functions.
create policy conversations_read on public.conversations for select using (auth.uid() in (requester_id, recipient_id));
create policy members_read on public.conversation_members for select using (public.is_member(conversation_id));

create policy messages_read on public.messages for select using (public.is_member(conversation_id));
-- You can write only as yourself, only in an accepted thread you belong to, and not across a block.
create policy messages_send on public.messages for insert to authenticated with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and c.status = 'accepted'
      and auth.uid() in (c.requester_id, c.recipient_id)
      and not public.is_blocked(c.requester_id, c.recipient_id)
  )
);

create policy consents_read on public.contact_sharing_consents for select using (public.is_member(conversation_id));
create policy consents_insert on public.contact_sharing_consents for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from public.conversations c where c.id = conversation_id and c.status = 'accepted' and auth.uid() in (c.requester_id, c.recipient_id))
);
create policy consents_delete on public.contact_sharing_consents for delete using (user_id = auth.uid());

create policy verification_read on public.verification_records for select using (user_id = auth.uid() or public.is_admin());

-- reports: anyone signed in can file; only the reporter and moderators can read.
create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid() and status = 'open');
create policy reports_read on public.reports for select using (reporter_id = auth.uid() or public.is_admin());

create policy moderation_read on public.moderation_actions for select using (public.is_admin());

/* ───────────────────────── grants ────────────────────────── */

revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_admin(), public.is_blocked(uuid, uuid), public.is_member(uuid),
  public.is_discoverable(public.listings), public.stale_after_days(), public.listing_fingerprint(public.listings)
  to anon, authenticated;
grant execute on function
  public.publish_listing(uuid), public.confirm_listing_available(uuid),
  public.start_conversation(uuid, uuid, text), public.respond_to_request(uuid, boolean),
  public.mark_read(uuid), public.shared_contact(uuid), public.block_user(uuid),
  public.admin_resolve_listing(uuid, text, text), public.admin_resolve_report(uuid, text, text)
  to authenticated;

/* ───────────────────────── storage ───────────────────────── */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "listing photos are public" on storage.objects for select using (bucket_id = 'listing-photos');
-- Uploads go into a folder named after the uploader's user id.
create policy "upload own listing photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own listing photos" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

/* ───────────────────────── realtime ──────────────────────── */

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;

/* ───────────────────────── reference data ────────────────── */

insert into public.institution_domains (domain) values
  ('iisc.ac.in'), ('iimb.ac.in'), ('iiitb.ac.in'), ('christuniversity.in'), ('pes.edu'), ('rvce.edu.in'),
  ('infosys.com'), ('wipro.com'), ('flipkart.com'), ('swiggy.in'), ('razorpay.com')
on conflict do nothing;
