// Generate 25 JSON files with 2 users each (50 users total)
// All users have creation_reason: ['market_demand']

import { writeFileSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = 'data/trails/users';

function pad(num, size) {
  let s = String(num);
  while (s.length < size) s = '0' + s;
  return s;
}

for (let globalIdx = 1; globalIdx <= 50; globalIdx++) {
  // ULID format: 26 chars total, use 01JAL + 21 chars padding
  const userId = `usr_01JAL${pad(globalIdx, 21)}`;
  const ctxCurrentId = `ctx_01JAL${pad(globalIdx * 2 - 1, 21)}`;
  const ctxFutureId = `ctx_01JAL${pad(globalIdx * 2, 21)}`;

  const user = {
    user_id: userId,
    contexts: [
      {
        context_id: ctxCurrentId,
        created_at: "2023-01-01T00:00:00Z",
        creation_reason: ["started_working"],
        position: "Junior",
        industry: "IT",
        company_size: "100-500",
        domains: ["backend"],
        skills: ["javascript"],
        work_type: "office",
        team_size: 5,
        country_code: "RU",
        city_name: "Moscow",
        birth_year: 1990 + globalIdx,
        citizenships: ["RU"],
        previous_context_id: null,
        next_context_id: ctxFutureId
      },
      {
        context_id: ctxFutureId,
        created_at: "2024-01-01T00:00:00Z",
        creation_reason: ["market_demand"],
        position: "Middle",
        industry: "IT",
        company_size: "100-500",
        domains: ["backend"],
        skills: ["javascript", "typescript"],
        work_type: "office",
        team_size: 5,
        country_code: "RU",
        city_name: "Moscow",
        birth_year: 1990 + globalIdx,
        citizenships: ["RU"],
        previous_context_id: ctxCurrentId,
        next_context_id: null
      }
    ],
    trails: []
  };

  const filename = `user_large_dataset_${pad(globalIdx, 2)}.json`;
  const filepath = join(OUTPUT_DIR, filename);

  writeFileSync(filepath, JSON.stringify(user, null, 2), 'utf-8');
  console.log(`✅ Created ${filename}`);
}

console.log(`\n🎯 Total: 50 users across 25 files`);
