# User Activity Report - Logic, Formulas, and Validation

## Scope
This document describes the current implementation logic for:
- Report: User Activity Report
- URL: /admin/reports/user-activity
- API (combined, backward-compatible): /api/admin/reports/user-activity
- API (summary): /api/admin/reports/user-activity/summary
- API (users list): /api/admin/reports/user-activity/users

## Source Files
- Backend: lmsBox.Server/Controllers/AdminReportsController.cs
- Frontend page: lmsbox.client/src/pages/UserActivityReport.jsx
- Frontend service: lmsbox.client/src/services/reports.js

## Request Inputs
The users-list API accepts:
- startDate (optional)
- endDate (optional)
- minDaysDormant (optional, default = 30)
- pageNumber (optional, default = 1)
- pageSize (optional, default = 50, max = 500)
- search (optional; matches name, email, status)
- sortBy (optional; default = engagement)
- sortDirection (optional; asc|desc, default = desc)

The summary API accepts:
- startDate (optional)
- endDate (optional)
- minDaysDormant (optional, default = 30)

Behavior:
- If both startDate and endDate are not provided, backend uses all-time (no date filter).
- If either startDate or endDate is provided, date filtering is applied.
- Idle threshold uses minDaysDormant.
- User detail rows are paginated using pageNumber/pageSize.

## Data Fetch Pattern
Frontend now uses split calls:
- Summary cards and charts from /user-activity/summary
- User table rows from /user-activity/users

This avoids reloading summary payload on every table page change.

Search behavior:
- Search input is debounced (~350ms) before calling users API.

## User Status Mapping
User status is derived from Users.ActiveStatus:
- ActiveStatus = 1 -> Active
- ActiveStatus = 0 -> Inactive
- Otherwise -> Suspended

## Per-User Base Metrics
For each user, progress data is aggregated from LearnerProgresses grouped by UserId:
- totalEnrollments = count of learner progress rows
- completedCourses = count where Completed = true
- inProgressCourses = count where Completed = false and ProgressPercent > 0
- avgProgress = average of ProgressPercent
- lastActivityDate = max(LastAccessedAt) fallback max(CompletedAt) fallback current UTC
- totalTimeSpentMinutes = sum(TotalTimeSpentSeconds) / 60

Derived:
- daysSinceLastActivity = (UtcNow - lastActivityDate).Days

## Engagement Score Formula
Current backend formula:

baseScore = avgProgress * 0.5
completionBonus = min(completedCourses, 10) * 5
enrollmentBonus = min(totalEnrollments, 5) * 10
recencyPenalty = min(daysSinceLastActivity, 50)
engagementScore = max(0, round(baseScore + completionBonus + enrollmentBonus - recencyPenalty, 2))

Interpretation:
- avgProgress contributes up to 50 points.
- completions contribute up to 50 points.
- enrollments contribute up to 50 points.
- recency penalty subtracts up to 50 points.
- final score is floor-capped at 0.

## Idle (Dormant) Logic
A user is marked idle (isDormant = true) when:

daysSinceLastActivity > minDaysDormant

Important:
- Idle is a recency flag, not a status enum.
- A user can be Active and Idle simultaneously in summary charts.

## Summary Card Formulas
- Total Users = count(result users)
- Active Users = count(status == Active)
- Idle Users = count(isDormant == true)
- Avg Engagement = round(average(engagementScore), 2)

## Engagement Distribution
Buckets:
- High: engagementScore >= 70
- Moderate: engagementScore >= 40 and < 70
- Low: engagementScore < 40

## User Status Distribution
Chart labels:
- Active
- Inactive
- Suspended
- Idle

Data values:
- Active = count(status == Active)
- Inactive = count(status == Inactive)
- Suspended = count(status == Suspended)
- Idle = count(isDormant == true)

Note: These are not mutually exclusive because Idle overlaps with status categories.

## User Details Table Logic
Columns and meaning:
- Engagement: numeric engagementScore plus label
  - High if score >= 70
  - Moderate if score >= 40 and < 70
  - Low if score < 40
- Avg Progress: averageProgress = round(avgProgress, 2)
- Idle:
  - Yes if isDormant is true
  - No otherwise

## Date Range Filter Logic
After per-user metrics are built:
- If no date filter is provided, all scoped users are included (all-time).
- If a date filter is provided, users are included when:
- createdOn is within [start, end]
OR
- lastActivityDate is within [start, end]

This is an OR condition, not AND.

## Validation Checklist
1. Open report page and capture API response from /api/admin/reports/user-activity.
2. Verify summary values against users array:
   - totalUsers equals users.length
   - activeUsers equals count of users with status Active
   - dormantUsers equals count of users with isDormant true
   - averageEngagementScore equals rounded average of engagementScore
3. Verify engagement buckets:
   - highlyEngagedUsers equals count(score >= 70)
   - moderatelyEngagedUsers equals count(40 <= score < 70)
   - lowEngagementUsers equals count(score < 40)
4. Verify row-level values:
   - Idle badge matches daysSinceLastActivity > minDaysDormant
   - Engagement label matches thresholds
   - Avg Progress equals averageProgress field from API
5. Verify filter behavior:
   - user appears when either createdOn OR lastActivityDate is in selected range.
6. Verify pagination behavior:
   - response includes pagination block
   - users array length <= pageSize
   - next/previous page navigation updates users list without changing summary totals

## Pagination Response
API response now includes a pagination object:
- pageNumber
- pageSize
- totalUsers
- totalPages
- hasPreviousPage
- hasNextPage

## Users Sorting Options
Supported sortBy values for users list API:
- engagement
- name
- email
- status
- lastActivity
- enrollments
- completions
- avgProgress
- idle
- createdOn

Sort safeguards:
- Invalid sortBy values are normalized to engagement.
- Invalid sortDirection values are normalized to desc.

## Performance Preparation
Added backend indexes for report path:
- LearnerProgresses(UserId, LastAccessedAt, CompletedAt)
- LearnerProgresses(UserId, Completed, ProgressPercent)
- AspNetUsers(OrganisationID, ActiveStatus, CreatedOn)

Migration file:
- lmsbox.infrastructure/Migrations/20260406104054_AddUserActivityReportIndexes.cs

Quick benchmark script:
- test-user-activity-report-performance.ps1

Example usage:
- .\test-user-activity-report-performance.ps1 -Token "<jwt>" -Iterations 20 -PageSize 100 -Concurrency 4
- Add -IncludeCombined to compare old combined endpoint latency.

## Known Implementation Notes
- Aggregations use LearnerProgresses rows grouped by user.
- Enrollment/completion/progress calculations are based on those grouped rows.
- Because Idle is independent from account status, status distribution totals can exceed total users when summed.

## References (Line Anchors)
- User activity endpoint: lmsBox.Server/Controllers/AdminReportsController.cs:37
- minDaysDormant default: lmsBox.Server/Controllers/AdminReportsController.cs:41
- Engagement formula: lmsBox.Server/Controllers/AdminReportsController.cs:103
- Idle condition: lmsBox.Server/Controllers/AdminReportsController.cs:109
- Summary formulas: lmsBox.Server/Controllers/AdminReportsController.cs:139
- Chart labels and badges: lmsbox.client/src/pages/UserActivityReport.jsx:94
