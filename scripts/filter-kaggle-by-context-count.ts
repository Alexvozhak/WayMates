/**
 * Filter Kaggle IT professionals by context count
 *
 * From 14,997 IT candidates, finds those with substantial career histories
 * (more than 10 job contexts)
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';

const EXPERIENCE_FILE = 'kaggle/04_experience.csv';
const IT_CANDIDATES_FILE = 'kaggle-final-it-candidates.txt';
const OUTPUT_FILE = 'kaggle-high-context-candidates.txt';
const MIN_CONTEXTS = 10;

interface ExperienceRow {
  person_id: string;
  job_title: string;
  company: string;
  location: string;
  start_date: string;
  end_date: string;
}

console.log('📊 Filtering Kaggle IT Professionals by Context Count\n');
console.log(`Source: ${EXPERIENCE_FILE}`);
console.log(`IT candidates: ${IT_CANDIDATES_FILE}`);
console.log(`Minimum contexts: ${MIN_CONTEXTS}\n`);

// Load IT candidate IDs
console.log('⏳ Loading IT candidate list...');
const itCandidatesJson = JSON.parse(fs.readFileSync(IT_CANDIDATES_FILE, 'utf-8'));
const itCandidateIds = new Set(itCandidatesJson.candidate_ids);
console.log(`✅ Loaded ${itCandidateIds.size.toLocaleString()} IT candidate IDs\n`);

// Load experience data
console.log('⏳ Loading experience data...');
const csvContent = fs.readFileSync(EXPERIENCE_FILE, 'utf-8');
const experiences = parse(csvContent, {
  columns: true,
  skip_empty_lines: true
}) as ExperienceRow[];
console.log(`✅ Loaded ${experiences.length.toLocaleString()} job records\n`);

// Count contexts per IT candidate
console.log('🔍 Counting contexts per IT candidate...');
const contextCounts = new Map<string, number>();

for (const exp of experiences) {
  const personId = exp.person_id;

  // Only count IT candidates
  if (itCandidateIds.has(personId)) {
    contextCounts.set(personId, (contextCounts.get(personId) || 0) + 1);
  }
}

console.log(`✅ Analyzed ${contextCounts.size.toLocaleString()} IT candidates\n`);

// Filter candidates with >MIN_CONTEXTS
const highContextCandidates = Array.from(contextCounts.entries())
  .filter(([_, count]) => count > MIN_CONTEXTS)
  .sort((a, b) => b[1] - a[1]); // Sort by context count DESC

console.log('📈 Results:\n');

// Calculate statistics
const allCounts = Array.from(contextCounts.values()).sort((a, b) => b - a);
const total = allCounts.length;

console.log(`Total IT candidates analyzed: ${total.toLocaleString()}`);
console.log(`With >${MIN_CONTEXTS} contexts: ${highContextCandidates.length.toLocaleString()} (${(highContextCandidates.length / total * 100).toFixed(1)}%)`);

if (allCounts.length > 0) {
  const maxContexts = Math.max(...allCounts);
  const avgContexts = allCounts.reduce((sum, c) => sum + c, 0) / allCounts.length;
  const medianContexts = allCounts[Math.floor(allCounts.length / 2)];

  console.log(`\nOverall statistics:`);
  console.log(`  Max contexts: ${maxContexts}`);
  console.log(`  Mean contexts: ${avgContexts.toFixed(2)}`);
  console.log(`  Median contexts: ${medianContexts}`);
}

if (highContextCandidates.length > 0) {
  const counts = highContextCandidates.map(([_, count]) => count);
  const maxContexts = Math.max(...counts);
  const minContexts = Math.min(...counts);
  const avgContexts = counts.reduce((sum, c) => sum + c, 0) / counts.length;
  const totalContexts = counts.reduce((sum, c) => sum + c, 0);

  console.log(`\nHigh-context candidates stats:`);
  console.log(`  Max contexts: ${maxContexts}`);
  console.log(`  Min contexts: ${minContexts}`);
  console.log(`  Avg contexts: ${avgContexts.toFixed(2)}`);
  console.log(`  Total contexts: ${totalContexts.toLocaleString()}`);

  console.log(`\nTop 20 candidates by context count:`);
  highContextCandidates.slice(0, 20).forEach(([id, count], idx) => {
    console.log(`  ${(idx + 1).toString().padStart(2)}. ID ${id.padEnd(6)}: ${count} contexts`);
  });
}

// Distribution analysis
console.log(`\n📊 Context Distribution (all ${total.toLocaleString()} IT candidates):\n`);

const distribution = {
  '1-3': allCounts.filter(c => c >= 1 && c <= 3).length,
  '4-6': allCounts.filter(c => c >= 4 && c <= 6).length,
  '7-10': allCounts.filter(c => c >= 7 && c <= 10).length,
  '11-15': allCounts.filter(c => c >= 11 && c <= 15).length,
  '16-20': allCounts.filter(c => c >= 16 && c <= 20).length,
  '21+': allCounts.filter(c => c >= 21).length
};

for (const [range, count] of Object.entries(distribution)) {
  const pct = (count / total * 100).toFixed(1);
  const bar = '█'.repeat(Math.floor(pct / 2));
  console.log(`  ${range.padEnd(6)}: ${count.toString().padStart(5)} (${pct.padStart(5)}%) ${bar}`);
}

// Save to file
if (highContextCandidates.length > 0) {
  const output = highContextCandidates.map(([id]) => id).join('\n');
  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`\n✅ Saved ${highContextCandidates.length.toLocaleString()} candidate IDs to ${OUTPUT_FILE}`);

  // Calculate total contexts for cold start
  const totalContexts = highContextCandidates.reduce((sum, [_, count]) => sum + count, 0);
  console.log(`\n📦 Cold Start Dataset:`);
  console.log(`  Candidates: ${highContextCandidates.length.toLocaleString()}`);
  console.log(`  Total contexts: ${totalContexts.toLocaleString()}`);
  console.log(`  Avg contexts/person: ${(totalContexts / highContextCandidates.length).toFixed(2)}`);
} else {
  console.log(`\n⚠️  No candidates found with >${MIN_CONTEXTS} contexts`);
  console.log(`Consider lowering the threshold (current: ${MIN_CONTEXTS})`);
}

console.log('\n✅ Analysis complete');
