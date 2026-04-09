# User Progress Report - Logic, Formulas, and Validation

## Scope
This document describes the current implementation logic for:
- Report: User Progress Report
- URL: /admin/reports/user-progress
- API: /api/admin/reports/user-progress

## Source Files
- Backend: lmsBox.Server/Controllers/AdminReportsController.cs
- Frontend page: lmsbox.client/src/pages/UserProgressReport.jsx
- Frontend service: lmsbox.client/src/services/reports.js

## Request Inputs
The API accepts:
- startDate (optional)
- endDate (optional)
- pageNumber (optional, default = 1)
- pageSize (optional, default = 50, max = 500)
- search (optional; matches user name and email)
- sortBy (optional; supported: name, enrolled, completed, inProgress, overallProgress, avgTime, velocity)
- sortDirection (optional; asc|desc, default = asc)

Current behavior:
- If startDate is not provided, backend sets header start to now minus 3 months.
- If endDate is not provided, backend sets header end to now.
- Organisation scoping is applied for OrgAdmin users.
- Date filters are passed and returned in header metadata.
- User details table is server-paginated.
- User search is server-side.
- Sorting is applied server-side before pagination.

## Important Current Behavior
Although startDate and endDate are accepted, the current implementation does not filter users or learner progress by date.

This means:
- Summary and table values are computed from all scoped users and their full learner progress history.
- Date values currently affect report header metadata only.

## Pagination and Sorting
The users list in response is page-scoped and sorted by request inputs.

Pagination response fields:
- pageNumber
- pageSize
- totalUsers
- totalPages
- hasPreviousPage
- hasNextPage

Sort mapping for table columns:
- User -> sortBy=name
- Enrolled -> sortBy=enrolled
- Completed -> sortBy=completed
- In Progress -> sortBy=inProgress
- Overall Progress -> sortBy=overallProgress
- Avg Time (Days) -> sortBy=avgTime
- Velocity -> sortBy=velocity

Search behavior:
- search matches full name (first + last) and email.

## Data Sources
Per report request, backend loads:
- Users from AspNetUsers (scoped by organisation when applicable)
- Learner progress rows from LearnerProgresses for those user IDs

Progress rows are aggregated by UserId in SQL and joined to scoped users.

## Per-User Metrics
For each user:
- coursesEnrolled = count of learner progress rows
- coursesCompleted = count where Completed = true
- coursesInProgress = count where Completed = false and ProgressPercent > 0
- overallProgress = average ProgressPercent, rounded to 2 decimals
- totalTimeSpentMinutes = sum(TotalTimeSpentSeconds) / 60, rounded to 2 decimals
- totalTimeSpentHours = sum(TotalTimeSpentSeconds) / 3600, rounded to 2 decimals
- averageTimePerCourse = totalTimeSpentMinutes / coursesEnrolled, rounded to 2 decimals (0 if coursesEnrolled = 0)
- lastAccessedAt = max(LastAccessedAt) over the user's learner progress rows

### Learning Velocity Formula
monthsSinceCreated = max(1, (UtcNow - user.createdOn).Days / 30)

learningVelocity = round(coursesCompleted / monthsSinceCreated, 2)

Interpretation:
- Unit is courses per month.
- A minimum denominator of 1 month is enforced.

### Average Completion Time Formula
For each completed learner progress row with CompletedAt:
- completionAgeDays = (UtcNow - CompletedAt).Days

averageCompletionTime = abs(round(average(completionAgeDays), 1))

Important note:
- This is currently age since completion, not true duration-to-complete.

## Summary Card Formulas
Summary object is computed from the per-user result list:
- totalLearners = count(result users)
- averageProgress = round(average(overallProgress), 2)
- averageCompletionTime = round(average(averageCompletionTime), 2)
- averageLearningVelocity = round(average(learningVelocity), 2)
- totalEnrollments = sum(coursesEnrolled)
- totalCompletions = sum(coursesCompleted)
- totalTimeSpentHours = round(sum(totalTimeSpentHours), 2)
- averageTimeSpentPerLearnerHours = round(average(totalTimeSpentHours), 2)
- averageTimePerCourseMinutes = round(average(averageTimePerCourse), 2)

## Frontend Data Labels and Mapping
Summary cards on page map to backend summary fields:
- Total Learners -> summary.totalLearners
- Total Completions -> summary.totalCompletions
- Avg Progress -> summary.averageProgress + "%"
- Avg Completion -> summary.averageCompletionTime + "d"
- Avg Velocity -> summary.averageLearningVelocity (courses/month)

User details table columns map to backend user fields:
- Enrolled -> coursesEnrolled
- Completed -> coursesCompleted
- In Progress -> coursesInProgress
- Overall Progress -> overallProgress (progress bar + percent label)
- Avg Time (Days) -> averageCompletionTime
- Velocity -> learningVelocity (displayed as c/m)

## Chart Logic
### Top 10 Learners by Completions
- Sort current page users by coursesCompleted descending
- Take first 10 from current page
- X-axis label = first name token from user name
- Y-axis value = coursesCompleted

### Progress Distribution
Buckets based on overallProgress:
- 0-25%: overallProgress <= 25 (current page users)
- 26-50%: overallProgress > 25 and <= 50 (current page users)
- 51-75%: overallProgress > 50 and <= 75 (current page users)
- 76-100%: overallProgress > 75 (current page users)

## Progress Label Styling Thresholds
For per-user progress badges and bars:
- >= 75 -> high band (blue theme)
- >= 50 and < 75 -> medium-high band (green theme)
- >= 25 and < 50 -> medium-low band (yellow theme)
- < 25 -> low band (red theme)

## Validation Checklist
1. Open report page and capture API response from /api/admin/reports/user-progress.
2. Verify summary values against users array:
   - totalLearners equals pagination.totalUsers
   - totalCompletions equals total across scoped users (not just current page)
   - totalEnrollments equals total across scoped users (not just current page)
   - averageProgress equals rounded average across scoped users (not just current page)
3. Verify row-level metrics:
   - overallProgress equals rounded average of learner progress percent for that user
   - coursesInProgress counts only rows where Completed = false and ProgressPercent > 0
   - averageTimePerCourse is 0 when coursesEnrolled = 0
4. Verify chart buckets:
   - each current-page user belongs to exactly one progress distribution bucket
   - top-10 chart uses highest coursesCompleted values from current page
5. Verify org scoping:
   - OrgAdmin sees only organisation users
   - SuperAdmin/Admin can see all org users
6. Verify date-filter behavior as currently implemented:
   - startDate/endDate appear in header.filters
   - summary and users counts remain unchanged unless underlying data changes (current behavior)

## Known Implementation Notes
- User progress report performs grouped aggregation in SQL and materializes only requested page rows.
- startDate/endDate are currently metadata-only in this report and do not filter data.
- averageCompletionTime metric reflects age since completion date, not elapsed time to complete a course.
- Users array is paginated and sorted server-side.
- Search filtering is applied server-side.

## Performance Analysis at Large Scale
Scenario considered:
- 50,000 users
- 50 courses
- 10 lessons per course

Potential learner progress volume (if one row per user-lesson):
- 50,000 * 50 * 10 = 25,000,000 LearnerProgresses rows

Current endpoint behavior impact:
- API performs per-user aggregation in SQL (no full learner-progress row materialization in API memory).
- Search filtering is applied in SQL at the users query layer.
- Pagination and sorting are applied in SQL before page materialization.
- Summary metrics are aggregated in SQL across scoped users.

Expected risks under this scale:
- Heavy database CPU/IO pressure for grouped aggregates across very large progress volumes.
- Slower responses under high concurrency without caching or pre-aggregation.
- Potential latency spikes when requesting expensive sort orders repeatedly.

Estimated bottleneck order:
1. SQL grouping of LearnerProgresses by user.
2. SQL join/projection over scoped users.
3. SQL sorting for requested column under high cardinality.

Recommended optimization path for production scale:
1. Add summary caching (short TTL, e.g., 1-5 minutes) for repeated dashboard/report refreshes.
2. Consider pre-aggregated user progress snapshot table for heavy tenants.
3. Add asynchronous background refresh for aggregate snapshots.
4. Add targeted indexes based on real query plans under production traffic.
5. Add report endpoint benchmark automation in CI for regression detection.

Practical expectation after this iteration:
- UX improved due to smaller page payload and sortable columns.
- API memory profile improved significantly versus full in-memory progress materialization.
- Database-side aggregation remains the main scaling cost for very large tenants.

## Benchmark Script
File:
- test-user-progress-report-performance.ps1

Example usage:
- .\test-user-progress-report-performance.ps1 -Token "<jwt>" -Iterations 20 -PageSize 100 -SortBy overallProgress -SortDirection desc -Concurrency 4
- .\test-user-progress-report-performance.ps1 -Token "<jwt>" -Iterations 20 -PageSize 50 -Search "vaibhav" -Concurrency 4

## References (Line Anchors)
- User progress endpoint: lmsBox.Server/Controllers/AdminReportsController.cs:426
- Users query with org scope: lmsBox.Server/Controllers/AdminReportsController.cs:473
- Progress grouped SQL query: lmsBox.Server/Controllers/AdminReportsController.cs:486
- Learning velocity formula: lmsBox.Server/Controllers/AdminReportsController.cs:521
- Average completion time formula: lmsBox.Server/Controllers/AdminReportsController.cs:520
- Summary formulas: lmsBox.Server/Controllers/AdminReportsController.cs:571
- Frontend summary cards: lmsbox.client/src/pages/UserProgressReport.jsx:339
- Frontend charts and buckets: lmsbox.client/src/pages/UserProgressReport.jsx:146