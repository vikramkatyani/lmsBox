# Course Enrollment Report - Logic, Formulas, and Validation

## Scope
This document describes the current implementation logic for:
- Report: Course Enrollment Report
- URL: /admin/reports/course-enrollment
- API (combined, backward-compatible): /api/admin/reports/course-enrollment
- API (summary): /api/admin/reports/course-enrollment/summary
- API (course table): /api/admin/reports/course-enrollment/courses

## Source Files
- Backend: lmsBox.Server/Controllers/AdminReportsController.cs
- Frontend page: lmsbox.client/src/pages/CourseEnrollmentReport.jsx
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
- category (optional; exact match, all ignored)
- sortBy (optional; supported: courseTitle, category, status, totalEnrollments, activeEnrollments, completedEnrollments, completionRate, dropoffRate, popularity, createdAt)
- sortDirection (optional; asc|desc, default = desc)

Behavior:
- Date values are accepted and echoed in header filters.
- Organisation scoping is applied for OrgAdmin users.
- Summary/charts use summary API response.
- Course details table is server-paginated and server-sorted.
- On table sort/page/search/category changes, only the table API is called (summary is not reloaded).

## Data Sources
Per report request, backend loads:
- Courses from Courses table (org-scoped when applicable)
- Course-level learner progress rows from LearnerProgresses where LessonId is null

Aggregation flow:
1. Fetch scoped courses.
2. Aggregate learner progress by CourseId in SQL.
3. Merge course metadata with aggregated counts in API memory.
4. Build summary, category breakdown, top-10, and popularity distributions.

## Per-Course Metrics
For each course:
- totalEnrollments = count(LearnerProgress rows for course where LessonId is null)
- activeEnrollments = count(Completed = false and ProgressPercent > 0)
- completedEnrollments = count(Completed = true)
- droppedEnrollments = count(Completed = false and ProgressPercent = 0)
- completionRate = round((completedEnrollments / totalEnrollments) * 100, 2), else 0
- dropoffRate = round((droppedEnrollments / totalEnrollments) * 100, 2), else 0
- popularity =
  - High when totalEnrollments > 50
  - Medium when totalEnrollments > 20
  - Low otherwise

## Summary Card Formulas
Summary is computed across all scoped courses:
- totalCourses = count(courses)
- totalEnrollments = sum(totalEnrollments)
- activeEnrollments = sum(activeEnrollments)
- completedEnrollments = sum(completedEnrollments)
- averageEnrollmentPerCourse = round(avg(totalEnrollments), 2)
- averageDropoffRate = round(avg(dropoffRate), 2)
- averageCompletionRate = round(avg(completionRate), 2)
- mostPopularCourse = course title with highest totalEnrollments (tie-break by title)
- leastPopularCourse = course title with lowest totalEnrollments (tie-break by title)

## Chart and Breakdown Logic
Top 10 Courses by Enrollment:
- Sort all scoped courses by totalEnrollments desc, then courseTitle asc
- Take first 10
- Series 1 = totalEnrollments
- Series 2 = completedEnrollments

Enrollments by Category (doughnut):
- Group courses by category (fallback: Uncategorized)
- Value = sum(totalEnrollments) per category

Popularity Distribution (doughnut):
- High = count(courses where popularity = High)
- Medium = count(courses where popularity = Medium)
- Low = count(courses where popularity = Low)

## Frontend Labels and Data Mapping
Summary cards:
- Total Courses -> summary.totalCourses
- Total Enrollments -> summary.totalEnrollments
- Active Enrollments -> summary.activeEnrollments
- Completion Rate -> summary.averageCompletionRate
- Dropoff (caption) -> summary.averageDropoffRate

Course table columns:
- Course -> courseTitle
- Category -> category
- Status -> status
- Enrollments -> totalEnrollments
- Active -> activeEnrollments
- Completed -> completedEnrollments
- Completion Rate -> completionRate
- Dropoff Rate -> dropoffRate
- Popularity -> popularity

## Table Pagination and Sorting
Pagination response fields:
- pageNumber
- pageSize
- totalCourses
- totalPages
- hasPreviousPage
- hasNextPage

Sorting behavior:
- Clicking a column header toggles asc/desc.
- Sort icon states:
  - Neutral icon when inactive column
  - Up arrow for asc
  - Down arrow for desc

Important UX behavior:
- Sort, page, search, and category changes refresh only the course table endpoint.
- Summary cards and chart data remain stable until filter apply or manual refresh path.

## Validation Checklist
1. Open /admin/reports/course-enrollment and capture API calls.
2. Verify split-call pattern:
   - Initial load calls /course-enrollment/summary and /course-enrollment/courses.
   - Sorting table calls only /course-enrollment/courses.
3. Verify summary formulas:
   - totalEnrollments equals sum of per-course totalEnrollments across scoped courses.
   - averageCompletionRate equals rounded average of per-course completionRate.
4. Verify row-level formulas:
   - completionRate and dropoffRate match definitions.
   - popularity thresholds map correctly at >50 and >20.
5. Verify server pagination:
   - courses.length <= pageSize
   - pagination.totalCourses reflects filtered table set
   - next/previous updates pageNumber and rows
6. Verify search and category behavior:
   - search matches course title/category
   - category filter narrows rows without altering summary cards

## Live Test Evidence (Current Environment)
Validated with authenticated API calls:
- /api/admin/reports/course-enrollment/summary returned summary payload successfully.
- /api/admin/reports/course-enrollment/courses?pageNumber=1&pageSize=5&sortBy=completionRate&sortDirection=desc returned 5 rows with pagination metadata.
- Asc/desc sort check:
  - desc first-row completionRate = 100
  - asc first-row completionRate = 0

Sample observed values:
- summary.totalCourses = 25
- summary.totalEnrollments = 23
- pagination.totalCourses = 25
- pagination.totalPages (pageSize=5) = 5

## Performance Analysis at Large Scale
Scenario considered:
- 50,000 users
- 50 courses
- 10 lessons per course

Potential data volume:
- Course-level learner progress rows used by this report: 50,000 * 50 = 2,500,000 rows
- Lesson-level rows may be 25,000,000, but this report excludes them by filtering LessonId is null

Current behavior impact:
- SQL handles grouping by CourseId over course-level rows.
- API memory materializes only course list plus per-course aggregate map.
- Table pagination/sorting/search/category operate on already-built course row set.

Expected bottlenecks at scale:
1. SQL aggregation on LearnerProgresses (CourseId group-by) for large tenants.
2. Repeated summary refresh under high concurrency.
3. Sort/search pressure if course catalog size grows far beyond current assumptions.

Why this implementation scales better than prior version:
- Removed full LearnerProgress row materialization in report API memory.
- Added split endpoints so frequent table interactions do not recompute summary/charts.
- Reduced client payload for table interactions via pagination.

Production optimization path:
1. Add/verify index on LearnerProgresses for (CourseId, LessonId, Completed, ProgressPercent).
2. Add short TTL cache (1-5 min) for summary endpoint per tenant/filter tuple.
3. Optionally maintain pre-aggregated course enrollment snapshot for very large tenants.
4. Add benchmark automation profile in CI for this endpoint pair.

## Benchmark Matrix (Executed)
Matrix run performed on the current dataset with:
- sortBy = totalEnrollments
- sortDirection = desc
- iterations = 12 per profile
- pageSize in {25, 50, 100}
- concurrency in {1, 2, 4}

Courses endpoint latency summary (ms):
- pageSize 25, concurrency 1: avg 196.08, p95 222
- pageSize 25, concurrency 2: avg 212.67, p95 278
- pageSize 25, concurrency 4: avg 217.25, p95 239
- pageSize 50, concurrency 1: avg 187.33, p95 203
- pageSize 50, concurrency 2: avg 497.25, p95 1035 (single outlier profile)
- pageSize 50, concurrency 4: avg 250.58, p95 380
- pageSize 100, concurrency 1: avg 193.33, p95 214
- pageSize 100, concurrency 2: avg 209.08, p95 283
- pageSize 100, concurrency 4: avg 290.92, p95 354

Summary endpoint was stable across the same matrix:
- Typical average: about 193-311ms
- Typical p95: about 204-398ms

Interpretation:
- The course table endpoint remains sub-300ms average in most profiles.
- Tail latency increases under higher concurrency, especially around 4 concurrent requests.
- One run (pageSize 50, concurrency 2) produced a high outlier and should be rechecked in a larger repeated test batch.

## Recommended Defaults
Based on current measurements and UX balance:
1. Default pageSize: 50
2. Default sort: totalEnrollments desc
3. Recommended client-side request concurrency target for this page: 2 or lower (avoid unnecessary parallel refreshes)
4. For highest stability under mixed tenant load: pageSize 25 is safest for p95 consistency

Operational recommendation:
- Keep current split summary/table endpoint pattern and add periodic benchmark checks with a larger iteration count (for example 30-50) before production release gates.

## References (Line Anchors)
- Sort normalization: lmsBox.Server/Controllers/AdminReportsController.cs:658
- Enrollment aggregation builder: lmsBox.Server/Controllers/AdminReportsController.cs:720
- Summary endpoint: lmsBox.Server/Controllers/AdminReportsController.cs:873
- Courses endpoint: lmsBox.Server/Controllers/AdminReportsController.cs:931
- Combined endpoint: lmsBox.Server/Controllers/AdminReportsController.cs:993
- Frontend summary/table split loading: lmsbox.client/src/pages/CourseEnrollmentReport.jsx:61
- Frontend table fetch with paging/sort/filter: lmsbox.client/src/pages/CourseEnrollmentReport.jsx:81
- Frontend sortable headers and icons: lmsbox.client/src/pages/CourseEnrollmentReport.jsx:546
- Service API wrappers: lmsbox.client/src/services/reports.js:119
