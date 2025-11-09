/**
 * Exploratory analysis of Kaggle 54k Resume Dataset
 *
 * Purpose: Understand dataset structure and quality WITHOUT parsing all data
 * Output: Statistics, top companies/locations, sample trajectories
 *
 * Usage:
 *   npm run explore:kaggle
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dataset directory
const DATA_DIR = path.join(__dirname, '..', 'data', 'kaggle-resumes');

// CSV file paths
const FILES = {
  people: path.join(DATA_DIR, 'people.csv'),
  experience: path.join(DATA_DIR, 'experience.csv'),
  education: path.join(DATA_DIR, 'education.csv'),
  personSkills: path.join(DATA_DIR, 'person_skills.csv'),
  skills: path.join(DATA_DIR, 'skills.csv'),
  abilities: path.join(DATA_DIR, 'abilities.csv'),
};

interface ExperienceRow {
  person_id: string;
  title: string;
  firm: string;
  start_date: string;
  end_date: string;
  location: string;
}

interface PersonRow {
  person_id: string;
  name: string;
  email: string;
  phone: string;
  linkedin: string;
}

interface PersonSkillRow {
  person_id: string;
  skill_id: string;
}

async function main() {
  console.log('📊 Kaggle Resume Dataset - Exploratory Analysis\n');
  console.log('=' .repeat(60));

  // Check files exist
  console.log('\n🔍 Checking files...\n');
  for (const [name, filePath] of Object.entries(FILES)) {
    const exists = fs.existsSync(filePath);
    const size = exists ? (fs.statSync(filePath).size / 1024 / 1024).toFixed(2) : 'N/A';
    console.log(`  ${exists ? '✅' : '❌'} ${name.padEnd(15)} ${exists ? size + ' MB' : 'NOT FOUND'}`);

    if (!exists && (name === 'people' || name === 'experience')) {
      console.error(`\n❌ ERROR: Required file not found: ${filePath}`);
      console.error(`Please download dataset first. See docs/HOW_TO_DOWNLOAD_KAGGLE_DATASET.md\n`);
      process.exit(1);
    }
  }

  console.log('\n' + '='.repeat(60));

  // Load people
  console.log('\n📋 Loading people.csv...');
  const peopleContent = fs.readFileSync(FILES.people, 'utf-8');
  const people: PersonRow[] = parse(peopleContent, { columns: true, skip_empty_lines: true });
  console.log(`   Total people: ${people.length.toLocaleString()}`);

  // Load experiences
  console.log('\n💼 Loading experience.csv...');
  const experienceContent = fs.readFileSync(FILES.experience, 'utf-8');
  const experiences: ExperienceRow[] = parse(experienceContent, { columns: true, skip_empty_lines: true });
  console.log(`   Total job experiences: ${experiences.length.toLocaleString()}`);

  // Load person_skills (if exists)
  let personSkills: PersonSkillRow[] = [];
  if (fs.existsSync(FILES.personSkills)) {
    console.log('\n🎯 Loading person_skills.csv...');
    const personSkillsContent = fs.readFileSync(FILES.personSkills, 'utf-8');
    personSkills = parse(personSkillsContent, { columns: true, skip_empty_lines: true });
    console.log(`   Total skill mappings: ${personSkills.length.toLocaleString()}`);
  }

  console.log('\n' + '='.repeat(60));

  // Group experiences by person_id
  console.log('\n🔗 Analyzing career trajectories...\n');
  const experiencesByPerson = new Map<string, ExperienceRow[]>();
  for (const exp of experiences) {
    if (!experiencesByPerson.has(exp.person_id)) {
      experiencesByPerson.set(exp.person_id, []);
    }
    experiencesByPerson.get(exp.person_id)!.push(exp);
  }

  // Calculate trajectory statistics
  const trajectoryLengths = Array.from(experiencesByPerson.values()).map(exps => exps.length);
  const avgTrajectoryLength = trajectoryLengths.reduce((a, b) => a + b, 0) / trajectoryLengths.length;

  const peopleWith1Job = trajectoryLengths.filter(len => len === 1).length;
  const peopleWith2Jobs = trajectoryLengths.filter(len => len === 2).length;
  const peopleWith3PlusJobs = trajectoryLengths.filter(len => len >= 3).length;
  const peopleWith5PlusJobs = trajectoryLengths.filter(len => len >= 5).length;

  console.log(`  People with job history: ${experiencesByPerson.size.toLocaleString()}`);
  console.log(`  Average jobs per person: ${avgTrajectoryLength.toFixed(2)}`);
  console.log(`  \n  Distribution:`);
  console.log(`    1 job:     ${peopleWith1Job.toLocaleString().padStart(6)} people (${(peopleWith1Job/experiencesByPerson.size*100).toFixed(1)}%)`);
  console.log(`    2 jobs:    ${peopleWith2Jobs.toLocaleString().padStart(6)} people (${(peopleWith2Jobs/experiencesByPerson.size*100).toFixed(1)}%)`);
  console.log(`    3+ jobs:   ${peopleWith3PlusJobs.toLocaleString().padStart(6)} people (${(peopleWith3PlusJobs/experiencesByPerson.size*100).toFixed(1)}%) ⭐ Good for MVP`);
  console.log(`    5+ jobs:   ${peopleWith5PlusJobs.toLocaleString().padStart(6)} people (${(peopleWith5PlusJobs/experiencesByPerson.size*100).toFixed(1)}%)`);

  console.log('\n' + '='.repeat(60));

  // Top companies
  console.log('\n🏢 Top 20 Companies (by job count):\n');
  const companyCount = new Map<string, number>();
  for (const exp of experiences) {
    if (!exp.firm || exp.firm.trim() === '') continue;
    const firm = exp.firm.trim();
    companyCount.set(firm, (companyCount.get(firm) || 0) + 1);
  }
  const topCompanies = Array.from(companyCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  topCompanies.forEach(([firm, count], idx) => {
    console.log(`  ${(idx+1).toString().padStart(2)}. ${firm.substring(0, 40).padEnd(40)} ${count.toString().padStart(5)} jobs`);
  });

  console.log('\n' + '='.repeat(60));

  // Location distribution
  console.log('\n🌍 Top 20 Locations (by job count):\n');
  const locationCount = new Map<string, number>();
  for (const exp of experiences) {
    if (!exp.location || exp.location.trim() === '') continue;
    const loc = exp.location.trim();
    locationCount.set(loc, (locationCount.get(loc) || 0) + 1);
  }
  const topLocations = Array.from(locationCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  topLocations.forEach(([location, count], idx) => {
    console.log(`  ${(idx+1).toString().padStart(2)}. ${location.substring(0, 40).padEnd(40)} ${count.toString().padStart(5)} jobs`);
  });

  console.log('\n' + '='.repeat(60));

  // Sample trajectories (people with 3+ jobs)
  console.log('\n📝 Sample Career Trajectories (2 examples with 3+ jobs):\n');
  const candidatesFor3Plus = Array.from(experiencesByPerson.entries())
    .filter(([_, exps]) => exps.length >= 3)
    .slice(0, 2); // Take first 2

  for (const [personId, exps] of candidatesFor3Plus) {
    // Sort by start_date (assuming MM/YYYY format)
    const sortedExps = exps.sort((a, b) => {
      const dateA = parseDate(a.start_date);
      const dateB = parseDate(b.start_date);
      return dateA.getTime() - dateB.getTime();
    });

    console.log(`  Person ID: ${personId} (${sortedExps.length} jobs)\n`);

    sortedExps.forEach((exp, idx) => {
      console.log(`    ${idx + 1}. ${exp.title}`);
      console.log(`       Company:  ${exp.firm}`);
      console.log(`       Location: ${exp.location}`);
      console.log(`       Period:   ${exp.start_date} → ${exp.end_date || 'Present'}`);
      console.log('');
    });

    console.log('  ' + '-'.repeat(58) + '\n');
  }

  console.log('=' .repeat(60));

  // Data quality check
  console.log('\n✅ Data Quality Assessment:\n');

  const missingTitle = experiences.filter(e => !e.title || e.title.trim() === '').length;
  const missingFirm = experiences.filter(e => !e.firm || e.firm.trim() === '').length;
  const missingLocation = experiences.filter(e => !e.location || e.location.trim() === '').length;
  const missingStartDate = experiences.filter(e => !e.start_date || e.start_date.trim() === '').length;

  console.log(`  Title missing:      ${missingTitle.toLocaleString().padStart(6)} / ${experiences.length.toLocaleString()} (${(missingTitle/experiences.length*100).toFixed(2)}%)`);
  console.log(`  Company missing:    ${missingFirm.toLocaleString().padStart(6)} / ${experiences.length.toLocaleString()} (${(missingFirm/experiences.length*100).toFixed(2)}%)`);
  console.log(`  Location missing:   ${missingLocation.toLocaleString().padStart(6)} / ${experiences.length.toLocaleString()} (${(missingLocation/experiences.length*100).toFixed(2)}%)`);
  console.log(`  Start date missing: ${missingStartDate.toLocaleString().padStart(6)} / ${experiences.length.toLocaleString()} (${(missingStartDate/experiences.length*100).toFixed(2)}%)`);

  console.log('\n' + '='.repeat(60));

  // Recommendations
  console.log('\n💡 Recommendations for MVP:\n');
  console.log(`  ✅ Target extraction: ${peopleWith3PlusJobs.toLocaleString()} people with 3+ jobs`);
  console.log(`  ✅ Estimated contexts: ${(peopleWith3PlusJobs * 3.5).toLocaleString()} (avg 3.5 jobs per person)`);
  console.log(`  ✅ Quality: ${((1 - missingTitle/experiences.length) * 100).toFixed(1)}% have complete titles`);
  console.log(`  ⚠️  Location parsing needed for ~${((missingLocation/experiences.length) * 100).toFixed(1)}% records`);
  console.log(`\n  🎯 Suggested extraction: 300-500 people → 1,000-2,000 contexts\n`);

  console.log('=' .repeat(60));
  console.log('\n✨ Analysis complete! Next steps:');
  console.log('   1. Review sample trajectories above');
  console.log('   2. Check if top companies/locations match expectations');
  console.log('   3. Proceed with LLM parser design\n');
}

/**
 * Parse date from MM/YYYY or YYYY format
 */
function parseDate(dateStr: string): Date {
  if (!dateStr || dateStr.toLowerCase() === 'present') {
    return new Date();
  }

  // Try MM/YYYY format
  const mmYyyyMatch = dateStr.match(/^(\d{2})\/(\d{4})$/);
  if (mmYyyyMatch) {
    const [, month, year] = mmYyyyMatch;
    return new Date(parseInt(year), parseInt(month) - 1, 1);
  }

  // Try YYYY format
  const yyyyMatch = dateStr.match(/^(\d{4})$/);
  if (yyyyMatch) {
    return new Date(parseInt(yyyyMatch[1]), 0, 1);
  }

  // Fallback: try to parse as-is
  return new Date(dateStr);
}

// Run
main().catch(console.error);
