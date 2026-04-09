# Course Completion Report - Logic, Formulas, and Validation

## Scope
This document describes the current implementation logic for:
- Report: Course Completion Report
- URL: /admin/reports/course-completion
- API (combined, backward-compatible): /api/admin/reports/course-completion
- API (summary): /api/admin/reports/course-completion/summary
- API (course table): /api/admin/reports/course-completion/courses

## Source Files
- Backend: lmsBox.Server/Controllers/AdminReportsController.cs
- Frontend page: lmsbox.client/src/pages/CourseCompletionReport.jsx
- Frontend service: lmsbox.client/src/services/reports.js

## Request Inputs
Summary API accepts:
- startDate (optional)
- endDate (optional)

Course-table API accepts:
- startDate (optional)
- endDate (optional)
- pageNumber (optional, default = 1)
- pageSize (optional, default = 50, max = 500)
- search (optional; matches course title and category)
- category (optional; exact category match, all ignored)
- performance (optional; Excellent|Good|Fair|Poor, all ignored)
- sortBy (optional; supported: courseTitle, category, totalEnrollments, completedCount, inProgressCount, completionRate, averageCompletionTime, performance, createdAt)
- sortDirection (optional; asc|desc, default = desc)

Current behavior:
- Date range defaults to last 3 months when not provided.
- Organisation scoping is applied for OrgAdmin users.
- Summary/charts are loaded from summary API.
- Table rows are loaded from courses API with server pagination/sorting/filtering.
- Sorting and paging trigger table API only (summary payload is not reloaded).

## Data Sources
Per report request backend uses:
- Courses table (scoped by organisation when applicable)
- LearnerProgresses rows where LessonId is null and CourseId is in scoped courses

Date handling for completion metrics:
- Progress rows are included when:
  - CompletedAt is null (incomplete/no completion timestamp), or
  - CompletedAt is within [start, end]

Completion trends source:
- Last 30 days completed rows from scoped progress (independent of table pagination)

## Per-Course Metrics
For each course:
- totalEnrollments = count(progress rows)
- completedCount = count(Completed = true)
- incompleteCount = count(Completed = false)
- inProgressCount = count(Completed = false and ProgressPercent > 0)
- notStartedCount = count(Completed = false and ProgressPercent = 0)
- completionRate = round((completedCount / totalEnrollments) * 100, 2), else 0
- averageCompletionTime =
  - For completed rows with CompletedAt:
   - assignedAt is derived per learner-course as earliest effective assignment date:
      - effectiveAssignedAt = later of LearnerGroup.JoinedAt and GroupCourse.AssignedAt
      - assignedAt = min(effectiveAssignedAt) across learner's active group memberships for that course
   - daysToComplete = DateDiffDay(assignedAt, CompletedAt)
  - keep non-negative values only
  - averageCompletionTime = round(avg(daysToComplete), 1), else 0
- performance =
  - Excellent if completionRate >= 75
  - Good if completionRate >= 50 and < 75
  - Fair if completionRate >= 25 and < 50
  - Poor if completionRate < 25

## Summary Card Formulas
Summary is computed across all scoped courses:
- totalCourses = count(courses)
- averageCompletionRate = round(avg(completionRate), 2)
- averageCompletionTime = round(avg(averageCompletionTime where > 0, default 0), 2)
- totalCompletions = sum(completedCount)
- totalIncomplete = sum(incompleteCount)
- totalInProgress = sum(inProgressCount)
- bestPerforming = highest completionRate (tie-break by courseTitle)
- worstPerforming = lowest completionRate (tie-break by courseTitle)

Explanation of specific summary labels:
- Needs Improvement card:
   - UI label "Needs Improvement" maps to summary.worstPerforming.
   - worstPerforming is the course title with the lowest completionRate across scoped courses.
   - If multiple courses tie on completionRate, courseTitle ascending is used as tie-break.
- Avg Completion Time card:
   - UI shows summary.averageCompletionTime in days.
   - This is an average of per-course averageCompletionTime values where value > 0.
   - Per-course averageCompletionTime is based on completed enrollments only:
      - daysToComplete = DateDiffDay(assignedAt, learnerProgress.CompletedAt)
      - assignedAt is derived from learner-group membership and group-course assignment
      - negative values excluded
      - rounded to 1 decimal at course row level
   - Summary card then rounds to 2 decimals.
- In Progress with Incomplete caption:
   - In Progress value = summary.totalInProgress = sum(inProgressCount).
   - Incomplete caption = summary.totalIncomplete = sum(incompleteCount).
   - incompleteCount includes both in-progress and not-started enrollments.
   - notStarted = totalIncomplete - totalInProgress.

## Chart Logic
Top 10 Courses by Completion Rate:
- Sort all scoped courses by completionRate desc, then courseTitle asc
- Take first 10
- Chart value: completionRate

Completion Trends (Last 30 Days):
- Group completed progress rows by CompletedAt.Date over last 30 days
- Label = date formatted as MMM dd
- Value = count per day

Completions by Category:
- Group rows by category (fallback: Uncategorized)
- totalCompletions = sum(completedCount)
- averageCompletionRate = round(avg(completionRate), 2)

Performance Distribution:
- excellent = count(performance == Excellent)
- good = count(performance == Good)
- fair = count(performance == Fair)
- poor = count(performance == Poor)

Performance bucket logic used before distribution count:
- performance = Excellent when completionRate >= 75
- performance = Good when completionRate >= 50 and < 75
- performance = Fair when completionRate >= 25 and < 50
- performance = Poor when completionRate < 25

The Performance Distribution chart counts courses in each of these four buckets over the full scoped dataset (not only current table page).

## Frontend Labels and Mapping
Summary cards:
- Avg Completion Rate -> summary.averageCompletionRate + "%"
- Total Completions -> summary.totalCompletions
- In Progress -> summary.totalInProgress
- Incomplete (caption) -> summary.totalIncomplete
- Avg Completion Time -> summary.averageCompletionTime (days)

Meaning of "In Progress 1" and "Incomplete: 4" example:
- "In Progress 1" means there is 1 enrollment that has started (ProgressPercent > 0) but is not completed.
- "Incomplete: 4" means there are 4 enrollments not completed in total.
- Therefore, remaining not-started enrollments = 4 - 1 = 3.

Table columns:
- Course -> courseTitle
- Category -> category
- Enrolled -> totalEnrollments
- Completed -> completedCount
- In Progress -> inProgressCount
- Completion Rate -> completionRate
- Avg Time (days) -> averageCompletionTime
- Performance -> performance

## Pagination and Sorting
Pagination response fields:
- pageNumber
- pageSize
- totalCourses
- totalPages
- hasPreviousPage
- hasNextPage

Sort icon behavior:
- Neutral icon for non-active column
- Up arrow for asc
- Down arrow for desc

Table-only reload behavior:
- Sort/page/search/category/performance changes call only /course-completion/courses
- Summary/charts remain unchanged until top filter apply (date range)

## Validation Checklist
1. Open /admin/reports/course-completion and inspect network calls.
2. Verify split call pattern:
   - Initial load calls /course-completion/summary and /course-completion/courses.
   - Clicking sortable headers calls only /course-completion/courses.
3. Verify formulas:
   - completionRate equals completedCount / totalEnrollments * 100 (rounded 2)
   - performance bucket matches completionRate threshold
4. Verify pagination:
   - courses.length <= pageSize
   - pagination.totalCourses matches filtered table set
5. Verify chart consistency:
   - top-10 chart uses highest completionRate values
   - performance distribution counts align with summary scope
6. Verify org scoping:
   - OrgAdmin sees only their organisation
   - SuperAdmin/Admin can see all scoped data

## Live Validation Evidence (Current Environment)
Validated with authenticated API calls:
- /api/admin/reports/course-completion/summary returned success payload.
- /api/admin/reports/course-completion/courses?pageNumber=1&pageSize=5&sortBy=completionRate&sortDirection=desc returned paginated rows.
- sort direction check:
  - desc first-row completionRate = 100
  - asc first-row completionRate = 0

Observed sample values:
- summary.totalCourses = 25
- summary.averageCompletionRate = 22
- completionTrends points = 3
- pagination.totalCourses = 25

## Performance Analysis at Large Scale
Scenario considered:
- 50,000 users
- 50 courses
- 10 lessons per course

Potential data volume:
- Course-level progress rows used by this report: 50,000 * 50 = 2,500,000 rows
- Lesson-level rows may be 25,000,000 but are excluded here (LessonId is null filter)

Current endpoint behavior impact:
- Per-course completion metrics aggregate from course-level progress rows.
- Summary and trends are computed from scoped aggregate rows.
- Table API applies sorting/filtering/pagination after aggregate row construction.

Expected bottlenecks:
1. SQL grouping and counting over large LearnerProgresses dataset.
2. Completion trend grouping under concurrency.
3. Repeated summary refreshes without caching.

Recommended optimization path:
1. Add/verify indexes on LearnerProgresses for CourseId/LessonId/Completed/CompletedAt/ProgressPercent.
2. Add short TTL cache for summary endpoint (for repeated dashboard refresh patterns).
3. Consider pre-aggregated course completion snapshots for very large tenants.
4. Add benchmark checks in CI for p95/p99 guardrails.

## Benchmark Script
File:
- test-course-completion-report-performance.ps1

Example usage:
- .\test-course-completion-report-performance.ps1 -Token "<jwt>" -Iterations 20 -PageSize 50 -SortBy completionRate -SortDirection desc -Concurrency 4
- .\test-course-completion-report-performance.ps1 -Token "<jwt>" -Iterations 20 -PageSize 100 -SortBy averageCompletionTime -SortDirection desc -Concurrency 4
- .\test-course-completion-report-performance.ps1 -Token "<jwt>" -Iterations 20 -PageSize 50 -Search "safety" -Concurrency 4

## Benchmark Results (Executed)
Profile A (pageSize 50, sort completionRate desc, concurrency 4):
- Summary: avg 224.95ms, p95 261ms
- Courses: avg 267.85ms, p95 407ms

Profile B (pageSize 100, sort averageCompletionTime desc, concurrency 4):
- Summary: avg 479.25ms, p95 1126ms, max 2322ms
- Courses: avg 309.95ms, p95 592ms

Profile C (pageSize 50, search=safety, concurrency 4):
- Summary: avg 241.8ms, p95 298ms
- Courses: avg 237.2ms, p95 275ms

Interpretation:
- Courses endpoint generally remains sub-350ms average in tested profiles.
- Heavy sort/page combinations increase tail latency, especially for summary under concurrency.
- Search-filtered table workload was stable with better tail than heavy sort profile.

## References (Line Anchors)
- Sort normalization: lmsBox.Server/Controllers/AdminReportsController.cs:1116
- Completion data builder: lmsBox.Server/Controllers/AdminReportsController.cs:1182
- Summary endpoint: lmsBox.Server/Controllers/AdminReportsController.cs:1378
- Courses endpoint: lmsBox.Server/Controllers/AdminReportsController.cs:1439
- Combined endpoint: lmsBox.Server/Controllers/AdminReportsController.cs:1507
- Frontend split loading: lmsbox.client/src/pages/CourseCompletionReport.jsx:60
- Frontend table loader: lmsbox.client/src/pages/CourseCompletionReport.jsx:73
- Frontend sortable headers/icons: lmsbox.client/src/pages/CourseCompletionReport.jsx:595
- Service wrappers: lmsbox.client/src/services/reports.js:184
