/**
 * Сравнение Cypher output между старой и новой реализациями
 */

// СТАРЫЕ реализации (template strings)
import {
  userCurrentContextQuery as oldUserCurrentContextQuery,
  userCurrentContextIdQuery as oldUserCurrentContextIdQuery
} from '../src/core/search-query-builder.js';

import {
  SET_GOAL_QUERY,
  GET_USER_GOAL_QUERY,
  DELETE_GOAL_QUERY
} from '../src/core/goals-query-builder.js';

// НОВЫЕ реализации (cypher-builder)
import {
  userCurrentContextQuery as newUserCurrentContextQuery,
  userCurrentContextIdQuery as newUserCurrentContextIdQuery
} from '../src/cypher/queries/search.js';

import {
  setGoalQuery as newSetGoalQuery,
  getUserGoalQuery as newGetUserGoalQuery,
  deleteGoalQuery as newDeleteGoalQuery
} from '../src/cypher/queries/goals.js';

function normalize(cypher: string): string {
  return cypher
    .replace(/\s+/g, ' ')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')')
    .replace(/\[ /g, '[')
    .replace(/ \]/g, ']')
    .trim();
}

function compareCypher(
  name: string,
  oldValue: string | (() => string),
  newFn: () => any
): boolean {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log('='.repeat(60));

  const oldCypher = typeof oldValue === 'string' ? oldValue : oldValue();
  const newQuery = newFn();
  const newCypher = newQuery.build().cypher;

  console.log('\n--- OLD CYPHER (template string) ---');
  console.log(oldCypher);

  console.log('\n--- NEW CYPHER (cypher-builder) ---');
  console.log(newCypher);

  const oldNormalized = normalize(oldCypher);
  const newNormalized = normalize(newCypher);

  if (oldNormalized === newNormalized) {
    console.log('\n✅ IDENTICAL (после нормализации)');
    return true;
  } else {
    console.log('\n⚠️  DIFFERENT');
    console.log(`\nOld length: ${oldNormalized.length}`);
    console.log(`New length: ${newNormalized.length}`);

    // Find first difference
    for (let i = 0; i < Math.min(oldNormalized.length, newNormalized.length); i++) {
      if (oldNormalized[i] !== newNormalized[i]) {
        const start = Math.max(0, i - 30);
        const end = Math.min(oldNormalized.length, i + 40);
        console.log(`\nFirst difference at position ${i}:`);
        console.log(`Old: ...${oldNormalized.substring(start, end)}...`);
        console.log(`New: ...${newNormalized.substring(start, end)}...`);
        break;
      }
    }

    return false;
  }
}

console.log('🔍 Comparing Cypher Implementations (Old Template Strings vs New Cypher-Builder)\n');

const results = [
  compareCypher('userCurrentContextQuery', oldUserCurrentContextQuery, newUserCurrentContextQuery),
  compareCypher('userCurrentContextIdQuery', oldUserCurrentContextIdQuery, newUserCurrentContextIdQuery),
  compareCypher('setGoalQuery', SET_GOAL_QUERY, newSetGoalQuery),
  compareCypher('getUserGoalQuery', GET_USER_GOAL_QUERY, newGetUserGoalQuery),
  compareCypher('deleteGoalQuery', DELETE_GOAL_QUERY, newDeleteGoalQuery)
];

console.log(`\n${'='.repeat(60)}`);
console.log('SUMMARY');
console.log('='.repeat(60));
console.log(`Passed: ${results.filter(r => r).length}/${results.length}`);
console.log(`Failed: ${results.filter(r => !r).length}/${results.length}`);

if (results.every(r => r)) {
  console.log('\n✅ All queries are IDENTICAL!');
  process.exit(0);
} else {
  console.log('\n❌ Some queries DIFFER - review and fix required');
  process.exit(1);
}
