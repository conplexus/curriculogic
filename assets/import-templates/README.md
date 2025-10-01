# LMS Curriculum Import Templates

This directory contains CSV and XLSX templates designed to help pilot institutions transform their Learning Management System (LMS) data from Canvas, D2L (Desire2Learn), or similar systems for import into CurricuLogic.

## Files

- **lms-curriculum-import-template.csv** - CSV template with example data
- **lms-curriculum-import-template.xlsx** - Excel version of the template (same structure)

## Template Structure

The template is designed to match typical LMS export structures while capturing curriculum mapping data. Each row represents a mapping between an assignment and a learning outcome.

### Column Definitions

#### Program & Course Information (Required)

| Column | Description | Example | Notes |
|--------|-------------|---------|-------|
| **ProgramCode** | Unique identifier for the academic program | PHARMD | Used to organize courses by program |
| **CourseCode** | Course identifier (typically department + number) | PHAR-501 | Should match your institution's course codes |
| **CourseTitle** | Full course name | Pharmaceutical Sciences I | Descriptive title for the course |
| **CourseTerm** | Academic term | Fall, Spring, Summer | Standard term labels |
| **CourseYear** | Academic year | 2024 | Four-digit year |
| **CourseCredits** | Credit hours | 3 | Integer or decimal (e.g., 3.5) |

#### Section & LMS Identifiers (Recommended)

| Column | Description | Example | Notes |
|--------|-------------|---------|-------|
| **SectionNumber** | Section number for the course | 001, 002 | Use if multiple sections exist |
| **LMSCourseID** | Canvas/D2L course ID | 12345 | Found in LMS course URL or export |
| **LMSSectionID** | Canvas/D2L section ID | 12345-001 | Unique identifier for each section |

#### Assignment Information (Required)

| Column | Description | Example | Notes |
|--------|-------------|---------|-------|
| **AssignmentTitle** | Name of the assessment/assignment | Midterm Exam 1 | As it appears in your LMS |
| **AssignmentType** | Type of assessment | Exam, Quiz, OSCE, Assignment, Practical | Standardize across your data |
| **AssignmentID** | Unique identifier for the assignment | EXAM-501-001 | Custom ID or use LMS assignment ID |
| **AdministeredAt** | Date assessment was given | 2024-10-15 | Format: YYYY-MM-DD (ISO 8601) |

#### Learning Outcome Mapping (Required)

| Column | Description | Example | Notes |
|--------|-------------|---------|-------|
| **OutcomeCode** | Unique identifier for the learning outcome | OBJ-1.1 | Use your institution's outcome numbering |
| **OutcomeTitle** | Short title/summary of the outcome | Apply pharmacokinetic principles | Keep concise (under 100 chars) |
| **OutcomeDescription** | Full description of the learning outcome | Students will apply pharmacokinetic principles to calculate drug dosing and predict drug concentrations in the body | Complete competency statement |
| **MappingWeight** | Strength of the mapping (0.0-1.0) | 1.0, 0.8, 0.5 | Use 1.0 for primary alignment, lower values for partial alignment |

#### Performance Metrics (Required - FERPA-Safe Aggregates Only)

| Column | Description | Example | Notes |
|--------|-------------|---------|-------|
| **TotalStudents** | Number of students who took the assessment | 85 | Count only, no individual identifiers |
| **AvgAssignmentScore** | Average score as percentage | 78.5 | Range: 0-100 |
| **MaxPoints** | Maximum possible points | 100 | Used to calculate percentages |

## Data Preparation Guidelines

### 1. Exporting from Canvas

Canvas Grade Export includes assignment-level data. To prepare your data:

1. **Export Gradebook**: Go to Grades → Export → Export Entire Gradebook (CSV)
2. **Assignment Details**: Use the Canvas Analytics API or Assignment Details export to get assignment metadata
3. **Learning Outcomes**: Export from Outcomes → Export if using Canvas Outcomes
4. **Anonymization**: 
   - Remove all student names, IDs, and email addresses
   - Calculate aggregate statistics (mean, count) before removing individual rows
   - Keep only one row per assignment-outcome mapping with aggregate scores

**Canvas Field Mappings:**
- `LMSCourseID` ← Canvas course ID (from URL: canvas.institution.edu/courses/`12345`)
- `LMSSectionID` ← Section ID if using Canvas sections
- `AssignmentID` ← Canvas assignment ID or create custom identifier
- `AvgAssignmentScore` ← Calculate average from individual student scores
- `TotalStudents` ← Count of students with submissions (exclude missing/excused)

### 2. Exporting from D2L (Desire2Learn/Brightspace)

D2L provides grade exports and outcome alignment data:

1. **Gradebook Export**: Grades → Export to Excel
2. **Competencies**: Competencies → Export Competency Data (if using D2L Competencies)
3. **Assignment Details**: Assignments → View All → Export or use Brightspace Data API
4. **Anonymization**:
   - Remove `OrgDefinedId`, `Username`, and all personally identifiable columns
   - Aggregate scores by assignment before import
   - Retain only class-level statistics

**D2L Field Mappings:**
- `LMSCourseID` ← Org Unit ID (Course)
- `LMSSectionID` ← Org Unit ID (Section) if applicable
- `AssignmentID` ← D2L Assessment ID or custom identifier
- `AvgAssignmentScore` ← Calculate from Class Average or individual student data
- `TotalStudents` ← Count from number of submissions

### 3. Mapping Assignments to Outcomes

If your LMS does not have formal outcome alignments:

1. **Identify Learning Outcomes**: Gather from syllabi, course catalogs, or accreditation documents
2. **Manual Mapping**: Faculty/instructional designers should map each assignment to relevant outcomes
3. **Mapping Weight**: 
   - Use `1.0` when an assignment directly assesses the outcome
   - Use `0.5-0.9` when the assignment partially assesses the outcome
   - Use `0.3-0.4` for tangential relationships
   - Assignments can map to multiple outcomes with different weights

### 4. Data Anonymization Best Practices

**FERPA Compliance Requirements:**

✅ **DO Include:**
- Course and program identifiers (codes, titles)
- Assignment names and types
- Learning outcome descriptions
- Aggregate performance metrics (class average, total count)
- Academic dates (terms, years, assessment dates)

❌ **DO NOT Include:**
- Student names, usernames, or IDs
- Individual student scores or grades
- Email addresses or contact information
- Demographic information
- IP addresses or access logs
- Any data that can identify individual students

**Calculating Aggregate Scores:**

Before removing individual student data, calculate:

```
AvgAssignmentScore = (Sum of all student scores / Number of students) 
                     × (100 / MaxPoints)
```

If your LMS provides percentage scores directly, use those. Otherwise convert raw scores to percentages.

**Small Class Sizes (<10 students):**

For very small classes, even aggregate data might be identifiable. Consider:
- Combining multiple sections
- Using ranges instead of exact averages (e.g., 75-80%)
- Suppressing data for very small cohorts (consult your IRB/privacy office)

### 5. Multi-Section Courses

When a course has multiple sections:

- Create separate rows for each section-assignment-outcome combination
- Use the `SectionNumber` field to distinguish sections
- Include different `LMSSectionID` values if sections have separate LMS entries
- This allows tracking performance differences between sections

### 6. Example Workflow

1. **Export raw data from LMS** (with individual student records)
2. **Calculate aggregates** per assignment (mean score, student count)
3. **Remove PII** (delete student name/ID columns)
4. **Map to outcomes** (add outcome codes, descriptions, weights)
5. **Format data** to match template structure
6. **Validate** (check date formats, ensure all required fields are present)
7. **Import** into CurricuLogic

## Example Data

The template includes realistic examples from a PharmD curriculum:

### Courses
- **PHAR-501**: Pharmaceutical Sciences I (Fall 2024)
  - Exams, Quizzes, Final
  - Outcomes: Pharmacokinetics, Drug Interactions
- **PHAR-502**: Clinical Skills I (Fall 2024, 2 sections)
  - OSCE, Practical, Case Presentations
  - Outcomes: Patient Counseling, Medication History

### Outcomes
- **OBJ-1.1**: Apply pharmacokinetic principles
- **OBJ-1.2**: Evaluate drug-drug interactions
- **OBJ-2.1**: Demonstrate patient counseling skills
- **OBJ-2.2**: Perform medication history interviews

## Import Instructions

### Using the CSV Template

1. **Download** `lms-curriculum-import-template.csv`
2. **Open** in Excel, Google Sheets, or a text editor
3. **Replace** example rows with your curriculum data
4. **Keep** the header row exactly as shown
5. **Save** as CSV (UTF-8 encoding recommended)
6. **Import** via the CurricuLogic admin interface

### Using the XLSX Template

1. **Download** `lms-curriculum-import-template.xlsx`
2. **Open** in Microsoft Excel, LibreOffice, or Google Sheets
3. **Fill in** your data in the provided columns
4. **Do not** modify column names or order
5. **Export/Save** as CSV when ready to import, OR
6. **Upload** the XLSX file directly if the platform supports it

### Data Validation Checklist

Before importing, verify:

- [ ] All required columns are present with correct spelling
- [ ] No student PII (names, IDs, emails) is included
- [ ] Dates are in YYYY-MM-DD format
- [ ] Scores are aggregated (class averages, not individual)
- [ ] Outcome codes are consistent across rows
- [ ] Mapping weights are between 0.0 and 1.0
- [ ] TotalStudents counts match expected class sizes
- [ ] LMS IDs are correct (if using)
- [ ] No empty required fields

### Common Issues

**Issue**: Import fails with "Missing required column"
- **Solution**: Check header row matches template exactly (case-sensitive)

**Issue**: Dates not recognized
- **Solution**: Use YYYY-MM-DD format (e.g., 2024-10-15, not 10/15/2024)

**Issue**: Duplicate course/assignment combinations
- **Solution**: Each assignment-outcome pair should be one row; same assignment can appear multiple times if mapped to different outcomes

**Issue**: Scores outside valid range
- **Solution**: AvgAssignmentScore should be 0-100 (percentage), MaxPoints can be any positive number

## Integration with Existing Assessment Import

This template is designed to work alongside the existing assessment import feature (`/admin/assessments`). 

**Differences:**
- **Assessment Import**: Question-level performance (Correct/Incorrect/Blank counts per question)
- **LMS Import**: Assignment-level performance with outcome mappings

**Complementary Use:**
- Use LMS Import for overall curriculum mapping and course-level outcomes
- Use Assessment Import for detailed item analysis on specific exams
- Both maintain FERPA compliance through aggregate-only data

## Support

For questions about the template or import process:
1. Check this README first
2. Review example data in the template
3. Contact your CurricuLogic administrator
4. Consult institutional IT/LMS support for export questions

## Version History

- **v1.0** (2024): Initial LMS import template with Canvas/D2L compatibility
