import type { Client } from "pg";

/** Schema and fixture catalog for Crafting & Gathering Milestone 1.
 * The fixture names intentionally do not represent live FFXIV recipes. */
export async function ensureCraftingTables(client: Client) {
  await client.query(`
    create table if not exists portal_crafting_items (
      id bigserial primary key,
      external_key text not null unique,
      name text not null,
      icon_url text,
      can_be_hq boolean not null default false,
      is_raw boolean not null default false,
      source_kind text not null default 'development_fixture',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table if not exists portal_crafting_recipes (
      id bigserial primary key,
      output_item_id bigint not null references portal_crafting_items(id) on delete cascade,
      output_quantity integer not null check (output_quantity > 0),
      preferred boolean not null default false,
      source_kind text not null default 'development_fixture',
      created_at timestamptz not null default now()
    );
    create unique index if not exists portal_crafting_recipes_preferred_output_idx
      on portal_crafting_recipes(output_item_id) where preferred;
    create table if not exists portal_crafting_recipe_ingredients (
      recipe_id bigint not null references portal_crafting_recipes(id) on delete cascade,
      item_id bigint not null references portal_crafting_items(id),
      quantity integer not null check (quantity > 0),
      primary key (recipe_id, item_id)
    );

    create table if not exists portal_crafting_workshop_templates (
      id bigserial primary key,
      external_key text not null unique,
      name text not null,
      category text not null,
      description text,
      is_development_fixture boolean not null default true,
      active boolean not null default true,
      created_at timestamptz not null default now()
    );
    create table if not exists portal_crafting_workshop_template_phases (
      id bigserial primary key,
      template_id bigint not null references portal_crafting_workshop_templates(id) on delete cascade,
      phase_number integer not null check (phase_number > 0),
      title text not null,
      description text,
      unique (template_id, phase_number)
    );
    create table if not exists portal_crafting_workshop_template_materials (
      id bigserial primary key,
      template_phase_id bigint not null references portal_crafting_workshop_template_phases(id) on delete cascade,
      item_id bigint not null references portal_crafting_items(id),
      base_quantity integer not null check (base_quantity > 0),
      workshop_batch_quantity integer not null default 1 check (workshop_batch_quantity > 0),
      base_batch_count integer not null default 1 check (base_batch_count > 0),
      sort_order integer not null default 0,
      unique (template_phase_id, item_id)
    );

    create table if not exists portal_crafting_projects (
      id bigserial primary key,
      project_type text not null check (project_type in ('standard_request', 'workshop_project')),
      template_id bigint references portal_crafting_workshop_templates(id),
      title text not null,
      status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'cancelled', 'archived')),
      lead_character_id bigint references portal_characters(id),
      created_by_character_id bigint references portal_characters(id),
      created_by_discord_user_id text,
      notes text,
      due_at timestamptz,
      current_phase_number integer,
      completed_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists portal_crafting_projects_status_idx on portal_crafting_projects(status, created_at desc);
    create table if not exists portal_crafting_project_discord_posts (
      project_id bigint primary key references portal_crafting_projects(id) on delete cascade,
      target_channel_kind text not null check (target_channel_kind in ('crafting', 'test')),
      guild_id text,
      channel_id text,
      message_id text,
      completion_message_id text,
      completion_announced_at timestamptz,
      last_project_status text,
      posted_by_character_id bigint references portal_characters(id),
      posted_by_discord_user_id text,
      last_refreshed_at timestamptz,
      last_error text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table if not exists portal_crafting_project_phases (
      id bigserial primary key,
      project_id bigint not null references portal_crafting_projects(id) on delete cascade,
      template_phase_id bigint references portal_crafting_workshop_template_phases(id),
      phase_number integer not null,
      title text not null,
      description text,
      status text not null default 'provisional' check (status in ('provisional', 'active', 'ready', 'completed')),
      progress_result text not null default 'normal' check (progress_result in ('normal', 'excellent', 'outstanding')),
      activated_at timestamptz,
      completed_at timestamptz,
      unique (project_id, phase_number)
    );
    create table if not exists portal_crafting_project_materials (
      id bigserial primary key,
      project_phase_id bigint not null references portal_crafting_project_phases(id) on delete cascade,
      item_id bigint not null references portal_crafting_items(id),
      base_quantity integer not null check (base_quantity > 0),
      actual_quantity integer not null check (actual_quantity >= 0),
      workshop_batch_quantity integer not null default 1 check (workshop_batch_quantity > 0),
      base_batch_count integer not null default 1 check (base_batch_count > 0),
      reduced_batch_count integer not null default 0 check (reduced_batch_count >= 0),
      sort_order integer not null default 0,
      unique (project_phase_id, item_id)
    );
    create table if not exists portal_crafting_project_recipe_overrides (
      project_id bigint not null references portal_crafting_projects(id) on delete cascade,
      item_id bigint not null references portal_crafting_items(id),
      recipe_id bigint not null references portal_crafting_recipes(id),
      primary key (project_id, item_id)
    );
    create table if not exists portal_crafting_contributions (
      id bigserial primary key,
      project_id bigint not null references portal_crafting_projects(id) on delete cascade,
      project_phase_id bigint not null references portal_crafting_project_phases(id) on delete cascade,
      project_material_id bigint references portal_crafting_project_materials(id),
      item_id bigint not null references portal_crafting_items(id),
      contributor_character_id bigint not null references portal_characters(id),
      contributor_discord_user_id text not null,
      contributor_name_snapshot text not null,
      quantity integer not null check (quantity > 0),
      quality text not null default 'not_applicable' check (quality in ('nq', 'hq', 'not_applicable')),
      source text not null default 'portal' check (source in ('portal', 'discord', 'officer_correction')),
      note text,
      reversed_at timestamptz,
      reversed_by_character_id bigint references portal_characters(id),
      reversal_reason text,
      created_at timestamptz not null default now()
    );
    create index if not exists portal_crafting_contributions_phase_item_idx
      on portal_crafting_contributions(project_phase_id, item_id) where reversed_at is null;
    create table if not exists portal_crafting_claims (
      id bigserial primary key,
      project_id bigint not null references portal_crafting_projects(id) on delete cascade,
      project_phase_id bigint not null references portal_crafting_project_phases(id) on delete cascade,
      project_material_id bigint references portal_crafting_project_materials(id),
      item_id bigint not null references portal_crafting_items(id),
      claimant_character_id bigint not null references portal_characters(id),
      claimant_discord_user_id text not null,
      claimant_name_snapshot text not null,
      quantity integer not null check (quantity > 0),
      status text not null default 'active' check (status in ('active', 'completed', 'released', 'cancelled')),
      created_at timestamptz not null default now(),
      completed_at timestamptz,
      released_at timestamptz
    );
    create index if not exists portal_crafting_claims_active_phase_item_idx
      on portal_crafting_claims(project_phase_id, item_id) where status = 'active';
    create table if not exists portal_crafting_activity (
      id bigserial primary key,
      project_id bigint not null references portal_crafting_projects(id) on delete cascade,
      project_phase_id bigint references portal_crafting_project_phases(id) on delete cascade,
      action_type text not null,
      actor_character_id bigint references portal_characters(id),
      actor_discord_user_id text,
      actor_name_snapshot text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create index if not exists portal_crafting_activity_project_idx on portal_crafting_activity(project_id, created_at desc);
  `);

  await client.query(`
    alter table portal_crafting_project_discord_posts
      add column if not exists completion_message_id text,
      add column if not exists completion_announced_at timestamptz,
      add column if not exists last_project_status text;
  `);
  /* Live XIVAPI catalog fields are added separately so existing fixture
     installations upgrade safely without replacing any project data. */
  await client.query(`
    alter table portal_crafting_workshop_templates
      add column if not exists source_kind text not null default 'development_fixture',
      add column if not exists xivapi_id integer,
      add column if not exists last_synced_at timestamptz;
    create unique index if not exists portal_crafting_workshop_templates_xivapi_id_idx
      on portal_crafting_workshop_templates(xivapi_id) where xivapi_id is not null;
  `);

  await client.query(`
    alter table portal_crafting_items
      add column if not exists xivapi_id integer,
      add column if not exists item_category text,
      add column if not exists level_equip integer,
      add column if not exists item_level integer,
      add column if not exists acquisition_data jsonb,
      add column if not exists last_synced_at timestamptz;
    create unique index if not exists portal_crafting_items_xivapi_id_idx
      on portal_crafting_items(xivapi_id) where xivapi_id is not null;

    alter table portal_crafting_recipes
      add column if not exists xivapi_id integer,
      add column if not exists craft_job text,
      add column if not exists recipe_level integer,
      add column if not exists class_job_level integer,
      add column if not exists durability integer,
      add column if not exists difficulty integer,
      add column if not exists quality integer,
      add column if not exists conditions_flag integer,
      add column if not exists progress_divider integer,
      add column if not exists quality_divider integer,
      add column if not exists progress_modifier integer,
      add column if not exists quality_modifier integer,
      add column if not exists required_craftsmanship integer,
      add column if not exists required_control integer,
      add column if not exists required_quality integer,
      add column if not exists stars integer,
      add column if not exists can_hq boolean not null default false,
      add column if not exists is_expert boolean not null default false,
      add column if not exists is_collectable boolean not null default false,
      add column if not exists last_synced_at timestamptz;
    create unique index if not exists portal_crafting_recipes_xivapi_id_idx
      on portal_crafting_recipes(xivapi_id) where xivapi_id is not null;

    create table if not exists portal_crafting_consumables (
      id bigserial primary key,
      item_id bigint not null references portal_crafting_items(id) on delete cascade,
      item_food_xivapi_id integer not null,
      consumable_type text not null check (consumable_type in ('food', 'medicine')),
      bonuses jsonb not null default '[]'::jsonb,
      last_synced_at timestamptz not null default now(),
      unique (item_id, item_food_xivapi_id)
    );
    create index if not exists portal_crafting_consumables_type_idx on portal_crafting_consumables(consumable_type);

    create table if not exists portal_crafter_profiles (
      discord_user_id text not null,
      craft_job text not null check (craft_job in ('Carpenter','Blacksmith','Armorer','Goldsmith','Leatherworker','Weaver','Alchemist','Culinarian')),
      level integer not null check (level between 1 and 100),
      craftsmanship integer not null check (craftsmanship between 0 and 99999),
      control integer not null check (control between 0 and 99999),
      cp integer not null check (cp between 0 and 9999),
      specialist boolean not null default false,
      preferred_food_item_id bigint references portal_crafting_items(id) on delete set null,
      preferred_food_hq boolean not null default true,
      preferred_medicine_item_id bigint references portal_crafting_items(id) on delete set null,
      preferred_medicine_hq boolean not null default true,
      updated_at timestamptz not null default now(),
      primary key (discord_user_id, craft_job)
    );

    create table if not exists portal_crafting_item_sources (
      id bigserial primary key,
      item_id bigint not null references portal_crafting_items(id) on delete cascade,
      external_key text not null unique,
      source_type text not null check (source_type in ('gathering', 'vendor', 'other')),
      source_name text,
      location_name text,
      details jsonb not null default '{}'::jsonb,
      source_kind text not null default 'xivapi',
      last_synced_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists portal_crafting_item_sources_item_idx
      on portal_crafting_item_sources(item_id, source_type);
  `);

  await seedDevelopmentFixture(client);
}

async function seedDevelopmentFixture(client: Client) {
  const items = [
    ["fixture_ore", "Development Iron Ore", false, true],
    ["fixture_catalyst", "Development Catalyst", true, true],
    ["fixture_crystal", "Development Fire Crystal", false, true],
    ["fixture_ingot", "Development Frame Ingot", true, false],
    ["fixture_lumber", "Development Treated Lumber", true, true],
    ["fixture_plate", "Development Hull Plate", true, false],
    ["fixture_sealant", "Development Sealant", false, true]
  ];
  for (const [key, name, canBeHq, isRaw] of items) {
    await client.query(`insert into portal_crafting_items (external_key, name, can_be_hq, is_raw)
      values ($1, $2, $3, $4) on conflict (external_key) do update
      set name = excluded.name, can_be_hq = excluded.can_be_hq, is_raw = excluded.is_raw, updated_at = now();`, [key, name, canBeHq, isRaw]);
  }
  const itemRows = await client.query<{ id: number; external_key: string }>(`select id::int, external_key from portal_crafting_items where external_key like 'fixture_%';`);
  const id = new Map(itemRows.rows.map((row) => [row.external_key, row.id]));

  const recipe = await client.query<{ id: number }>(`insert into portal_crafting_recipes (output_item_id, output_quantity, preferred)
    values ($1, 1, true) on conflict do nothing returning id::int;`, [id.get("fixture_ingot")]);
  const recipeId = recipe.rows[0]?.id ?? Number((await client.query<{ id: number }>(`select id::int from portal_crafting_recipes where output_item_id = $1 and preferred = true limit 1;`, [id.get("fixture_ingot")])).rows[0].id);
  for (const [itemKey, quantity] of [["fixture_ore", 2], ["fixture_catalyst", 1], ["fixture_crystal", 4]] as const) {
    await client.query(`insert into portal_crafting_recipe_ingredients (recipe_id, item_id, quantity) values ($1,$2,$3)
      on conflict (recipe_id, item_id) do update set quantity = excluded.quantity;`, [recipeId, id.get(itemKey), quantity]);
  }

  const template = await client.query<{ id: number }>(`insert into portal_crafting_workshop_templates (external_key, name, category, description)
    values ('development_fixture_workshop_frame', 'Development Fixture — Workshop Frame', 'Development fixture',
    'Clearly labeled synthetic data for safely testing workshop planning. It is not live FFXIV recipe data.')
    on conflict (external_key) do update set name = excluded.name, description = excluded.description returning id::int;`);
  const templateId = template.rows[0]?.id ?? Number((await client.query<{ id: number }>(`select id::int from portal_crafting_workshop_templates where external_key = 'development_fixture_workshop_frame';`)).rows[0].id);
  const phases = [
    [1, "Phase 1 — Frame Materials", "Prepare the fixture frame materials."],
    [2, "Phase 2 — Hull Assembly", "Prepare the fixture hull materials."],
    [3, "Phase 3 — Final Seal", "Prepare the final fixture seal."]
  ] as const;
  for (const [phaseNumber, title, description] of phases) {
    await client.query(`insert into portal_crafting_workshop_template_phases (template_id, phase_number, title, description)
      values ($1,$2,$3,$4) on conflict (template_id, phase_number) do update set title=excluded.title, description=excluded.description;`, [templateId, phaseNumber, title, description]);
  }
  const phaseRows = await client.query<{ id: number; phase_number: number }>(`select id::int, phase_number from portal_crafting_workshop_template_phases where template_id = $1;`, [templateId]);
  const phaseId = new Map(phaseRows.rows.map((row) => [row.phase_number, row.id]));
  const materials = [
    [1, "fixture_ingot", 12, 3, 4, 10],
    [1, "fixture_lumber", 8, 2, 4, 20],
    [2, "fixture_plate", 9, 3, 3, 10],
    [2, "fixture_lumber", 6, 2, 3, 20],
    [3, "fixture_sealant", 5, 1, 5, 10]
  ] as const;
  for (const [phaseNumber, itemKey, baseQuantity, batchQuantity, batchCount, sortOrder] of materials) {
    await client.query(`insert into portal_crafting_workshop_template_materials
      (template_phase_id,item_id,base_quantity,workshop_batch_quantity,base_batch_count,sort_order)
      values ($1,$2,$3,$4,$5,$6)
      on conflict (template_phase_id,item_id) do update set base_quantity=excluded.base_quantity, workshop_batch_quantity=excluded.workshop_batch_quantity, base_batch_count=excluded.base_batch_count, sort_order=excluded.sort_order;`,
      [phaseId.get(phaseNumber), id.get(itemKey), baseQuantity, batchQuantity, batchCount, sortOrder]);
  }
}
