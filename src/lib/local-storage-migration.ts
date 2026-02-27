/**
 * One-time localStorage key migration from "openacpui-*" to "harnss-*".
 *
 * Runs synchronously before any React hooks initialize so settings are
 * available under the new key prefix from the first render.
 */

const OLD_PREFIX = "openacpui-";
const NEW_PREFIX = "harnss-";
const MIGRATION_FLAG = "harnss-localstorage-migrated";

export function migrateLocalStorage(): void {
  // Already migrated — skip
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  let migrated = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(OLD_PREFIX)) continue;

    const newKey = NEW_PREFIX + key.slice(OLD_PREFIX.length);

    // Don't overwrite if the new key already exists (e.g. fresh install)
    if (localStorage.getItem(newKey) === null) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        localStorage.setItem(newKey, value);
        migrated++;
      }
    }
  }

  localStorage.setItem(MIGRATION_FLAG, new Date().toISOString());

  if (migrated > 0) {
    // eslint-disable-next-line no-console
    console.log(`[Harnss] Migrated ${migrated} localStorage keys from openacpui-* → harnss-*`);
  }
}
