import type { Client } from "pg";

// Compare against the last generated value, never overwrite custom officer copy.
export async function syncGeneratedDefault(client: Client, key: string, value: string, legacy: string) {
  const marker = `generatedDefault:${key}`;
  const previous = await client.query<{ value: string }>(
    "select value from portal_settings where key = $1", [marker]
  );
  await client.query(
    "update portal_settings set value = $2, updated_at = now() where key = $1 and value = $3 and value is distinct from $2",
    [key, value, previous.rows[0]?.value ?? legacy]
  );
  await client.query(
    "insert into portal_settings (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value",
    [marker, value]
  );
}
