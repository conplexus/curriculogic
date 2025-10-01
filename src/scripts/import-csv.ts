import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

type RawRow = { [k: string]: string };

function validateRow(row: RawRow) {
  const required = ['program_id','program_name','academic_year','course_code','course_title'];
  const missing = required.filter(r => !row[r] || row[r].trim() === '');
  return missing;
}

function normalizeRow(row: RawRow) {
  return {
    programId: row.program_id?.trim() || null,
    programName: row.program_name?.trim() || null,
    academicYear: row.academic_year?.trim() || null,
    courseCode: row.course_code?.trim() || null,
    courseTitle: row.course_title?.trim() || null,
    courseDescription: row.course_description?.trim() || null,
    sectionId: row.section_id?.trim() || null,
    lmsCourseId: row.lms_course_id?.trim() || null,
    assignmentId: row.assignment_id?.trim() || null,
    assignmentTitle: row.assignment_title?.trim() || null,
    pointsPossible: row.points_possible ? Number(row.points_possible) : null,
    avgAssignmentScore: row.avg_assignment_score ? Number(row.avg_assignment_score) : null,
    outcomeId: row.outcome_id?.trim() || null,
    outcomeCode: row.outcome_code?.trim() || null,
    mappingStrength: row.mapping_strength ? Number(row.mapping_strength) : null,
    mappingNotes: row.mapping_notes?.trim() || null,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: ts-node import-csv.ts <path-to-csv>');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), args[0]);
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const records: RawRow[] = parse(raw, { columns: true, skip_empty_lines: true });

  const preview = [] as any[];
  const errors: { row: number; missing: string[] }[] = [];

  records.forEach((r, i) => {
    const missing = validateRow(r);
    if (missing.length) {
      errors.push({ row: i + 1, missing });
    } else {
      preview.push(normalizeRow(r));
    }
  });

  console.log('Preview JSON (first 10 rows):');
  console.log(JSON.stringify(preview.slice(0, 10), null, 2));
  if (errors.length) {
    console.error('Validation errors:');
    console.error(JSON.stringify(errors, null, 2));
    process.exit(2);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});