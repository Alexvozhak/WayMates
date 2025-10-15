import { readFileSync } from "fs";
import { join } from "path";
import { StoryInput, StoryInputSchema } from "../../src/schemas-zod.js";
import { USER_KEYS, type UserKey } from "./user-keys.generated.js";

export { USER_KEYS, type UserKey };

// Directory containing curated user fixtures for tests
const USERS_DIR = join(process.cwd(), "data", "trails", "users");

export function loadTestData(userKey: UserKey): StoryInput {
  const filePath = join(USERS_DIR, `${userKey.toLowerCase()}.json`);
  const raw = JSON.parse(readFileSync(filePath, "utf-8"));
  return StoryInputSchema.parse(raw);
}

export function loadAllTestData(): StoryInput[] {
  return USER_KEYS.map(loadTestData);
}

export function loadUsers(keys: UserKey[]): StoryInput[] {
  return keys.map((k) => loadTestData(k));
}
