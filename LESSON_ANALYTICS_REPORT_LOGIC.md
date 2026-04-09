# Lesson Analytics Report - Logic, Formulas, and Validation

## Scope
This document describes the current implementation logic for:
- Report: Lesson Analytics Report
- URL: /admin/reports/lesson-analytics
- API (combined, backward-compatible): /api/admin/reports/lesson-analytics
- API (summary): /api/admin/reports/lesson-analytics/summary
- API (lessons table): /api/admin/reports/lesson-analytics/lessons

## Source Files
- Backend: lmsBox.Server/Controllers/AdminReportsController.cs
- Frontend page: lmsbox.client/src/pages/LessonAnalyticsReport.jsx
- Frontend service: lmsbox.client/src/services/reports.js

## Request Inputs
Summary API accepts:
- courseId (optional)
- lessonType (optional)
- startDate (optional)
- endDate (optional)

Lessons-table API accepts:
- courseId (optional)
- lessonType (optional)
- startDate (optional)
- endDate (optional)
- pageNumber (optional, default = 1)
- pageSize (optional, default = 50, max = 500)
- search (optional; matches lesson title, course title, lesson type)
- engagement (optional; High|Medium|Low|Very Low, all ignored)
- sortBy (optional; supported: lessonTitle, courseTitle, lessonType, order, duration, totalEnrollments, completions, inProgress, notStarted, completionRate, averageProgress, engagementLevel, difficulty)
- sortDirection (optional; asc|desc, default = desc)

Current behavior:
- Summary cards/charts load from summary API.
- Table rows load from lessons API with server pagination/sorting/filtering.
- Sorting, paging, search, engagement filter trigger table API only.
- Summary API is reloaded only on top filter apply (course/lesson type/date).

## Data Sources
Backend uses:
- Lessons table (scoped by organization when applicable)
- Course table for lesson course title and org scoping
- LearnerProgresses rows where LessonId is not null and in scoped lessons

Date filtering for lesson progress rows:
- startDate filter keeps rows where:
  - LastAccessedAt >= startDate, or
  - CompletedAt >= startDate, or
  - both LastAccessedAt and CompletedAt are null
- endDate filter keeps rows where:
  - LastAccessedAt <= endDate, or
  - CompletedAt <= endDate, or
  - both LastAccessedAt and CompletedAt are null

## Per-Lesson Metrics
For each lesson:
- totalEnrollments = count(progress rows)
- completions = count(Completed = true)
- inProgress = count(Completed = false and ProgressPercent > 0)
- notStarted = count(ProgressPercent = 0)
- completionRate = round((completions / totalEnrollments) * 100, 2), else 0
- averageProgress = round(avg(ProgressPercent), 2), else 0
- totalTimeSpentHours = round(sum(TotalTimeSpentSeconds) / 3600, 2)
- averageTimeSpentMinutes = round((sum(TotalTimeSpentSeconds) / 60) / totalEnrollments, 2), else 0
- videoBookmarkUsagePercent (video lessons only) = round((count(VideoTimestamp > 0) / totalEnrollments) * 100, 2), else 0
- lastAccessedAt = latest LastAccessedAt from lesson progress rows
- daysSinceLastAccess = (UtcNow - lastAccessedAt).Days, else null
- engagementLevel:
  - High if completionRate >= 75
  - Medium if completionRate >= 50 and < 75
  - Low if completionRate >= 25 and < 50
  - Very Low if completionRate < 25
- difficulty:
  - Easy if completionRate >= 75 and averageProgress >= 80
  - Moderate if completionRate >= 50 and averageProgress >= 60
  - Challenging if completionRate >= 25
  - Very Challenging otherwise
- isPopular = totalEnrollments > 10 and completionRate >= 60

## Summary Card Formulas
Summary across all scoped lessons:
- totalLessons = count(lessons)
- totalEnrollments = sum(totalEnrollments)
- totalCompletions = sum(completions)
- averageCompletionRate = round(avg(completionRate), 2)
- averageProgress = round(avg(averageProgress), 2)
- totalTimeSpentHours = sum(totalTimeSpentHours)
- averageTimePerLessonMinutes = round(avg(averageTimeSpentMinutes), 2)
- mostPopularLesson = highest totalEnrollments (tie by first in ordered result)
- highestCompletionLesson = highest completionRate
- lowestCompletionLesson = lowest completionRate
- mostTimeConsuming = highest averageTimeSpentMinutes
- videoLessonsWithBookmarks = count(lessonType == video and videoBookmarkUsagePercent > 0)
- popularLessonsCount = count(isPopular == true)
- problematicLessonsCount = count(completionRate < 25)

## Chart and Breakdown Logic
Top 10 Lessons by Completion Rate:
- sort by completionRate desc, then lessonTitle asc
- take first 10
- chart value: completionRate

Lessons by Type:
- group by lessonType
- value: count

Engagement Distribution:
- group by engagementLevel
- value: count and percentage over total lessons

Difficulty Distribution:
- group by difficulty
- value: count and percentage over total lessons

Type Breakdown:
- group by lessonType
- count
- totalEnrollments sum
- averageCompletionRate avg
- averageProgress avg
- totalTimeSpentHours sum
- averageTimeSpentMinutes avg

Popular and Problematic Lists:
- popularLessons: isPopular == true, first 5
- problematicLessons: completionRate < 25, ordered asc by completionRate, first 5

## Frontend Labels and Mapping
Summary cards:
- Total Lessons -> summary.totalLessons
- Avg Completion Rate -> summary.averageCompletionRate + "%"
- Total Enrollments -> summary.totalEnrollments
- Avg Progress -> summary.averageProgress + "%"

Table columns:
- Lesson -> lessonTitle (+ order and duration subtitle)
- Course -> courseTitle
- Type -> lessonType
- Enrollments -> totalEnrollments
- Completions -> completions
- Completion Rate -> completionRate
- Engagement -> engagementLevel
- Difficulty -> difficulty

## Pagination and Sorting
Lessons table pagination response:
- pageNumber
- pageSize
- totalLessons
- totalPages
- hasPreviousPage
- hasNextPage

Sort icon behavior:
- neutral icon for inactive column
- up arrow for asc
- down arrow for desc

Table-only reload behavior:
- sort/page/search/engagement changes call only /lesson-analytics/lessons
- summary/charts remain unchanged until top filter apply

## Validation Checklist
1. Open /admin/reports/lesson-analytics and inspect network calls.
2. Verify split call pattern:
   - initial load calls /lesson-analytics/summary and /lesson-analytics/lessons
   - clicking sortable table headers calls only /lesson-analytics/lessons
3. Verify formulas:
   - completionRate = completions / totalEnrollments * 100 (2 decimals)
   - engagement and difficulty buckets match thresholds
4. Verify pagination:
   - lessons.length <= pageSize
   - pagination.totalLessons matches filtered table result
5. Verify chart consistency:
   - top-10 list sorted by completionRate
   - engagement and difficulty counts match scoped dataset
6. Verify org scoping:
   - OrgAdmin sees only their organization
   - SuperAdmin/Admin can see all scoped data

## Live Validation Evidence (Current Environment)
Validated with authenticated API calls:
- /api/admin/reports/lesson-analytics/summary returned success payload.
- /api/admin/reports/lesson-analytics/lessons?pageNumber=1&pageSize=5&sortBy=completionRate&sortDirection=desc returned paginated rows.
- sort direction check:
  - desc first-row completionRate = 100
  - asc first-row completionRate = 0

Observed sample values:
- summary.totalLessons = 72
- summary.averageCompletionRate = 32.41
- pagination.totalLessons = 72
- lessons page row count (pageSize=5) = 5

## Performance Analysis at Large Scale
Scenario considered:
- 50,000 users
- 50 courses
- 10 lessons per course

Potential data volume:
- lesson-level progress rows used by this report: 50,000 * 50 * 10 = 25,000,000 rows
- table rows in lesson analytics: up to 50 * 10 = 500 lesson aggregates

Current endpoint behavior impact:
- backend builds per-lesson aggregates from lesson-level progress rows.
- summary and charts compute over full scoped lesson aggregate set.
- lessons table applies search/filter/sort/pagination after aggregate row build.

Expected bottlenecks:
1. SQL filtering/materialization pressure on very large LearnerProgresses.
2. Per-lesson aggregation cost under concurrency.
3. Repeated summary reloads without caching.

Recommended optimization path:
1. Add/verify indexes on LearnerProgresses for LessonId/Completed/LastAccessedAt/CompletedAt/ProgressPercent.
2. Add short TTL cache for summary endpoint by tenant+filter key.
3. Consider pre-aggregated lesson analytics snapshot for very large tenants.
4. Add CI benchmark guardrails for p95/p99.

## Benchmark Script
File:
- test-lesson-analytics-report-performance.ps1

Example usage:
- .\test-lesson-analytics-report-performance.ps1 -Token "<jwt>" -Iterations 20 -PageSize 50 -SortBy completionRate -SortDirection desc -Concurrency 4
- .\test-lesson-analytics-report-performance.ps1 -Token "<jwt>" -Iterations 20 -PageSize 100 -SortBy averageProgress -SortDirection desc -Concurrency 4
- .\test-lesson-analytics-report-performance.ps1 -Token "<jwt>" -Iterations 20 -PageSize 50 -Search "safety" -Concurrency 4

## Benchmark Results (Executed)
Profile A (pageSize 50, sort completionRate desc, concurrency 4):
- Summary: avg 275.25ms, p95 384ms, max 523ms
- Lessons: avg 902.15ms, p95 3232ms, max 3386ms

Profile B (pageSize 100, sort averageProgress desc, concurrency 4):
- Summary: avg 245.45ms, p95 312ms, max 335ms
- Lessons: avg 272.3ms, p95 528ms, max 582ms

Profile C (pageSize 50, search=safety, concurrency 4):
- Summary: avg 232.75ms, p95 269ms, max 279ms
- Lessons: avg 235.6ms, p95 264ms, max 285ms

Interpretation:
- Summary endpoint remained stable around ~230-275ms average in tested profiles.
- Lessons endpoint is generally stable (~236-272ms average), but one heavy-tail profile produced high p95/p99 outliers.
- Search-filtered workload showed improved and consistent tails.

## References (Line Anchors)
- Sort normalization: lmsBox.Server/Controllers/AdminReportsController.cs:1664
- Lesson data builder: lmsBox.Server/Controllers/AdminReportsController.cs:1809
- Summary endpoint: lmsBox.Server/Controllers/AdminReportsController.cs:1941
- Lessons endpoint: lmsBox.Server/Controllers/AdminReportsController.cs:2021
- Combined endpoint: lmsBox.Server/Controllers/AdminReportsController.cs:2083
- Frontend split loading: lmsbox.client/src/pages/LessonAnalyticsReport.jsx:60
- Frontend table loader: lmsbox.client/src/pages/LessonAnalyticsReport.jsx:73
- Frontend sortable headers/icons: lmsbox.client/src/pages/LessonAnalyticsReport.jsx:606
- Service wrappers: lmsbox.client/src/services/reports.js:253
