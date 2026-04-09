# Time Tracking & Engagement Report - Logic, Formulas, and Validation

## Scope
This document describes the current implementation logic for:
- Report: Time Tracking & Engagement Report
- URL: /admin/reports/time-tracking
- API (combined, backward-compatible): /api/admin/reports/time-tracking
- API (summary): /api/admin/reports/time-tracking/summary
- API (table): /api/admin/reports/time-tracking/table

## Source Files
- Backend: lmsBox.Server/Controllers/AdminReportsController.cs
- Frontend page: lmsbox.client/src/pages/TimeTrackingReport.jsx
- Frontend service: lmsbox.client/src/services/reports.js

## Request Inputs
Summary API accepts:
- userId (optional)
- courseId (optional)
- startDate (optional)
- endDate (optional)

Table API accepts:
- table (optional; users|courses|lessons|daily, default users)
- userId (optional)
- courseId (optional)
- startDate (optional)
- endDate (optional)
- pageNumber (optional, default = 1)
- pageSize (optional, default = 50, max = 500)
- sortBy (optional; normalized per table)
- sortDirection (optional; asc|desc, default = desc)

Current behavior:
- Summary cards/charts/insights load from summary API.
- Active tab table rows load from table API with server-side pagination and sorting.
- Sorting, paging, and tab changes trigger only table API calls.
- Summary API is reloaded only on top filter apply.

## Data Sources
Backend uses:
- LearnerProgresses where TotalTimeSpentSeconds > 0
- Includes User, Course, Lesson navigation properties
- Organisation filtering applied for OrgAdmin users through report scoping

Date filtering on progress rows:
- keeps rows where LastAccessedAt exists and is between start and end dates

## Aggregation Formulas
### User-level analytics
Grouped by (UserId, FirstName, LastName, Email):
- totalTimeSpentHours = round(sum(TotalTimeSpentSeconds) / 3600, 2)
- coursesAccessed = distinct count of CourseId
- lessonsAccessed = count where LessonId != null
- lastActivityDate = max(LastAccessedAt)
- averageSessionMinutes = round(avg(TotalTimeSpentSeconds) / 60, 2)
- activeDays = distinct count of LastAccessedAt.Date

### Course-level analytics
Grouped by (CourseId, CourseTitle):
- totalTimeSpentHours = round(sum(TotalTimeSpentSeconds) / 3600, 2)
- uniqueLearners = distinct count of UserId
- averageTimePerLearnerMinutes = round((sum(TotalTimeSpentSeconds) / 60) / uniqueLearners, 2)
- totalLessons = count where LessonId != null
- completedLessons = count where LessonId != null and Completed = true

### Lesson-level analytics
Grouped by (LessonId, LessonTitle, LessonType, CourseId, CourseTitle):
- totalTimeSpentHours = round(sum(TotalTimeSpentSeconds) / 3600, 2)
- uniqueLearners = distinct count of UserId
- averageTimePerLearnerMinutes = round((sum(TotalTimeSpentSeconds) / 60) / uniqueLearners, 2)
- completions = count where Completed = true
- completionRate = round((completions / totalRowsInLessonGroup) * 100, 2)
- videoBookmarkCount = count where VideoTimestamp > 0
- lastAccessedAt = max(LastAccessedAt)

### Daily breakdown
Grouped by LastAccessedAt.Date:
- totalTimeSpentHours = round(sum(TotalTimeSpentSeconds) / 3600, 2)
- uniqueLearners = distinct count of UserId
- lessonsAccessed = count where LessonId != null
- coursesAccessed = distinct count of CourseId

### Time by lesson type
Grouped by Lesson.Type:
- totalTimeSpentHours = round(sum(TotalTimeSpentSeconds) / 3600, 2)
- lessonCount = distinct count of LessonId
- averageTimePerLessonMinutes = round((sum(TotalTimeSpentSeconds) / 60) / lessonCount, 2)

## Summary Formulas
Summary object values:
- totalTimeSpentHours = round(sum(all scoped progress seconds) / 3600, 2)
- totalUniqueLearners = distinct count of UserId
- totalCoursesAccessed = distinct count of CourseId
- totalLessonsAccessed = count where LessonId != null
- averageTimePerLearnerHours = round(avg(user.totalTimeSpentHours), 2)
- averageTimePerCourseHours = round(avg(course.totalTimeSpentHours), 2)
- averageTimePerLessonMinutes = round(avg(lesson.averageTimePerLearnerMinutes), 2)
- mostActiveDay = day with highest daily totalTimeSpentHours
- mostTimeConsuming = courseTitle with highest course totalTimeSpentHours
- peakActivityHours = highest daily totalTimeSpentHours

## Sorting and Pagination
Sort keys are normalized by table type:
- users: userName, email, totalTimeSpentHours, coursesAccessed, lessonsAccessed, averageSessionMinutes, activeDays, lastActivityDate
- courses: courseTitle, totalTimeSpentHours, uniqueLearners, averageTimePerLearnerMinutes, totalLessons, completedLessons
- lessons: lessonTitle, lessonType, courseTitle, totalTimeSpentHours, uniqueLearners, averageTimePerLearnerMinutes, completions, completionRate, videoBookmarkCount, lastAccessedAt
- daily: date, totalTimeSpentHours, uniqueLearners, lessonsAccessed, coursesAccessed

Pagination response:
- pageNumber
- pageSize
- totalRows
- totalPages
- hasPreviousPage
- hasNextPage

## Frontend Behavior
- Initial load:
  - calls summary endpoint
  - if table tab selected, calls table endpoint for that tab
- Top filter apply:
  - reloads summary endpoint
  - reloads current table endpoint
- Table interactions (tab/sort/page):
  - call only table endpoint
  - summary cards/charts remain unchanged

Sort icon behavior:
- inactive columns show neutral sort icon
- active column shows ascending arrow for asc and descending arrow for desc

## Validation Checklist
1. Open /admin/reports/time-tracking and inspect network calls.
2. Verify initial summary call to /time-tracking/summary.
3. Switch to users/courses/lessons/daily tabs and verify /time-tracking/table calls.
4. Click sortable headers and verify only table endpoint is called.
5. Navigate table pages and verify only table endpoint is called.
6. Apply date filters and verify summary + current table are both reloaded.

## Live Validation Evidence (Current Environment)
Validated with authenticated SuperAdmin calls:
- /api/admin/reports/time-tracking/summary returned success payload.
- /api/admin/reports/time-tracking/table?table=users&pageNumber=1&pageSize=10 returned paginated rows.
- /api/admin/reports/time-tracking/table?table=courses&pageNumber=1&pageSize=10 returned paginated rows.

Observed sample values:
- summary.totalTimeSpentHours = 9.97
- summary.totalUniqueLearners = 2
- users table rows = 2 (totalRows = 2)
- courses table rows = 6 (totalRows = 6)

## Performance Analysis at Large Scale
Scenario considered:
- 50,000 users
- 50 courses
- 10 lessons per course

Upper-bound interaction volume:
- potential progress cardinality up to 50,000 * 50 * 10 = 25,000,000 learner-lesson records
- report aggregate row counts remain relatively small after grouping:
  - users table up to 50,000 rows
  - courses table up to 50 rows
  - lessons table up to 500 rows
  - daily rows depend on date range

Current bottleneck profile:
1. Query materialization can become expensive under broad date ranges.
2. In-memory grouping/aggregation cost grows with scoped progress row volume.
3. High concurrency can amplify GC and CPU pressure.

Expected behavior with split endpoints:
- table-only interactions avoid summary/chart recomputation on every sort/page action.
- perceived UI responsiveness improves because only active table data is refreshed.
- backend still performs full scoped aggregation per request today; split endpoints improve UX first, not full computational complexity.

Recommended optimization path for very large tenants:
1. Add/verify SQL indexes on LearnerProgresses:
   - (LastAccessedAt)
   - (UserId, LastAccessedAt)
   - (CourseId, LastAccessedAt)
   - (LessonId, LastAccessedAt)
2. Introduce short-lived cache for summary payload keyed by org + date range + filters.
3. Consider pre-aggregated daily/user/course/lesson snapshots for large organizations.
4. Add benchmark guardrails in CI using p95/p99 thresholds.

## Benchmark Script
File:
- test-time-tracking-report-performance.ps1

Example usage:
- .\test-time-tracking-report-performance.ps1 -Token "<jwt>" -Iterations 20 -Concurrency 4 -Table users -PageSize 50 -SortBy totalTimeSpentHours -SortDirection desc
- .\test-time-tracking-report-performance.ps1 -Token "<jwt>" -Iterations 20 -Concurrency 4 -Table lessons -PageSize 100 -SortBy completionRate -SortDirection desc
- .\test-time-tracking-report-performance.ps1 -Token "<jwt>" -Iterations 20 -Concurrency 4 -Table daily -SortBy date -SortDirection desc

## Benchmark Results (Executed)
Profile A (table=users, pageSize 50, sort totalTimeSpentHours desc, concurrency 4, iterations 20):
- Summary: avg 230.3ms, p95 303ms, max 333ms
- Table(users): avg 241.25ms, p95 285ms, max 303ms
- Combined: avg 225.05ms, p95 281ms, max 369ms

Interpretation:
- In this environment, summary/table/combined calls were all stable and sub-400ms max.
- Split endpoints primarily improve UI update granularity (table-only refresh), reducing unnecessary page-level redraws.
- At large-scale data volumes, additional database/index/caching optimizations are recommended to keep p95 under target SLOs.
