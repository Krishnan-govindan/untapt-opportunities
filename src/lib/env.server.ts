import { config as loadEnv } from "dotenv";

let loaded = false;

function ensureEnvLoaded() {
  if (loaded) return;
  loadEnv({ path: ".env", override: true });
  loaded = true;
}

export function serverEnv(name: string): string | undefined {
  ensureEnvLoaded();
  return process.env[name];
}

export function missingServerEnv(names: string[]): string[] {
  ensureEnvLoaded();
  return names.filter((name) => !process.env[name]);
}
