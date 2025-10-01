```markdown
# Import template for CurricuLogic (Canvas/D2L friendly)

This folder contains CSV and XLSX import templates tailored to typical LMS exports (Canvas, D2L/Brightspace). Use these templates to prepare data for CurricuLogic imports.

## Files
- curriculogic-lms-import-template.csv — flat CSV combining program, course, section, assignment, and outcome mapping rows.

## Required columns (MVP)
- program_id — stable identifier for the program (e.g., WNEU-P1)
- program_name — human-friendly program name
- academic_year — academic year string (e.g., 2025-2026)
- course_code — course identifier (PHRM-101)
- course_title — course title

## Recommended columns
- course_description — short description
- section_id — internal section id (optional)
- lms_course_id — LMS course ID (Canvas/D2L)
- lms_section_code — LMS section code
- lms_term — term label (Fall 2025)
- assignment_id — unique assignment id in your dataset
- assignment_title — assignment/exam title
- assignment_type — Exam, Assignment, Clinical Exam, etc.
- points_possible — numeric points for assignment
- avg_assignment_score — optional aggregate score (avoid student-level rows)
- outcome_id — unique id for outcome/objective (OUT-001)
- outcome_code — outcome short code (CAPE-1)
- outcome_description — text for the outcome
- mapping_strength — 1=Supporting,2=Important,3=Core
- mapping_notes — free text notes on mapping

## Notes and guidance
- Multiple rows may represent the same course mapped to different outcomes or assignments — importer should dedupe by program_id/course_code/outcome_id/assignment_id.
- For pilot safety, avoid including student-level identifiers (student_id, email, name). If your LMS export contains student rows, compute assignment-level aggregates (average, % passing) before importing, or anonymize IDs.
- Canvas exports: map course_id → lms_course_id, course_code → course_code, course_name → course_title. Use the gradebook or report exports to compute assignment aggregates.
- D2L exports: map OrgUnit/Offering ID → lms_course_id, code → course_code.

## Import steps (MVP)
1. Download CSV/XLSX from this folder and open in Excel/Google Sheets.
2. Replace sample rows with your program's data keeping required columns.
3. Save as CSV (UTF-8) and upload via the CurricuLogic import page.

## Anonymization tips
- If student-level data is supplied, generate one-way hashes of student IDs with a per-institution salt (SHA256) before importing.
- Prefer aggregated assignment-level statistics to avoid PII/FERPA concerns.

## Contact
If you need help mapping your LMS export to this template, email hello@conplexus.com for onboarding assistance.
```