# Engagement Analytics Report - Logic, Formulas, and Validation

## Scope
This document describes the current implementation logic for:
- Report: Engagement Analytics
- URL: /admin/analytics/engagement
- APIs:
  - /api/EngagementAnalytics/overview
  - /api/EngagementAnalytics/daily-scores
  - /api/EngagementAnalytics/event-breakdown
  - /api/EngagementAnalytics/top-users-table

## Source Files
- Backend controller: lmsBox.Server/Controllers/EngagementAnalyticsController.cs
- Backend service: lmsBox.Server/Services/EngagementTrackingService.cs
- Backend contract: lmsBox.Server/Services/IEngagementTrackingService.cs
- Frontend page: lmsbox.client/src/pages/EngagementAnalytics.jsx
- Frontend service: lmsbox.client/src/services/engagementAnalytics.js

## Request Inputs
Summary APIs (overview, daily-scores, event-breakdown) accept:
- fromDate (optional)
- toDate (optional)

Top users table API accepts:
- fromDate (optional)
- toDate (optional)
- pageNumber (optional, default = 1)
- pageSize (optional, default = 25, max = 500)
- sortBy (optional, default = engagementScore)
- sortDirection (optional, asc|desc, default = desc)

Behavior:
- If no fromDate/toDate are passed, backend defaults to last 30 days.
- If toDate < fromDate, top-users-table API returns 400.
- sortBy is normalized to a safe allow-list.

## Data Fetch Pattern (Frontend)
The page now uses split loading:
- Summary reloads only when date filter is applied.
  - overview + daily-scores + event-breakdown
- Top users table reloads for:
  - page change
  - page size change
  - sort column change
  - sort direction change
  - date filter apply

This prevents full-page reloads for table-only interactions.

## Engagement Formula Weights
Learner score:
- login = 1 point each
- course view = 2 points each
- lesson complete = 5 points each
- quiz attempt = 3 points each
- AI query = 1.5 points each

Admin score:
- course created = 10 points each
- lesson created = 5 points each
- user added = 3 points each
- content upload (video/pdf/scorm/html) = 2 points each

Total engagement score:
- engagementScore = learnerScore + adminScore

Average engagement score (overview):
- averageEngagementScore = totalWeightedScore / daysInRange

Average session duration (overview):
- averageSessionDuration = average(DurationSeconds) / 60

## Summary Cards and Data Labels
Primary cards:
- Active Users: distinct users with at least one engagement event in range
- Avg. Engagement Score: rounded averageEngagementScore
- Lessons Completed: count(EventType == LessonComplete)
- Avg. Session (min): rounded averageSessionDuration

Admin activity cards:
- Courses Created: count(EventType == CourseCreated)
- Lessons Created: count(EventType == LessonCreated)
- Content Uploads: count(VideoUpload|PDFUpload|SCORMUpload|HTMLUpload)
- Users Added: count(EventType == UserAdded)

Detailed statistics panel:
- Total Events: total engagement rows in range
- Total Logins: count(EventType == Login)
- Course Views: count(EventType == CourseView)
- Quiz Attempts: count(EventType == QuizAttempt)
- AI Queries: count(EventType == AIAssistantQuery)

## Daily Trend Chart Logic
Daily rows are grouped by UTC date.
For each day:
- learnerScore and adminScore are computed from the same event weights.
- engagementScore = learnerScore + adminScore.

Frontend fills any missing day between fromDate and toDate with zeros so chart labels stay continuous.

## Event Distribution Chart Logic
Data source:
- Group engagement rows by EventType for selected range.

Chart labels:
- Event type names are transformed from camel/pascal case to spaced words on UI.

## Top Users Table Logic
Top-users-table API groups events by UserId in selected range and computes:
- totalEvents
- lessonsCompleted
- coursesCreated
- loginDays = distinct login dates
- lastActivity = max(createdAt)
- engagementScore = learnerScore + adminScore

Activity role label per row:
- Both: adminScore > 0 and learnerScore > 0
- Admin: adminScore > learnerScore and not Both
- Learner: all other cases

## Top Users Sorting Options
Supported sortBy values:
- engagementScore
- name
- email
- role
- totalEvents
- loginDays
- lessonsCompleted
- coursesCreated
- lastActivity

Sort behavior:
- First click on a column sorts descending.
- Re-click toggles asc/desc.
- Sort icon in each header reflects active direction.

## Top Users Pagination Response
API returns:
- users[]
- pagination.pageNumber
- pagination.pageSize
- pagination.totalUsers
- pagination.totalPages
- pagination.hasPreviousPage
- pagination.hasNextPage

## Performance Enhancements Implemented
Backend query optimization:
- Replaced large in-memory ToList() aggregations with database-side GroupBy projections for:
  - overview
  - daily-scores
  - top-users-table
- Added AsNoTracking() to report read queries.
- Applied sorting and paging in SQL for top-users-table.

Existing useful indexes already present on UserEngagements:
- (OrganisationId, CreatedAt)
- (UserId, CreatedAt)
- (EventType)

These indexes support date-ranged organization filtering and event aggregations.

## Validation Checklist
1. Open report page and apply Last 30 Days.
2. Verify summary cards populate.
3. Verify daily line chart has continuous dates (including zero-value days).
4. Verify event distribution chart updates for selected range.
5. Verify table paging:
   - page changes update table rows only.
   - summary cards/charts stay unchanged.
6. Verify table sorting:
   - every column is sortable.
   - active column icon changes with direction.
   - sort updates table rows only.
7. Verify top-users-table API response includes users + pagination block.
8. Verify custom date apply updates both summary and table.

## Performance Benchmark Script
- Script: test-engagement-analytics-performance.ps1

Example:
- .\test-engagement-analytics-performance.ps1 -Token "<jwt>" -Iterations 20 -Concurrency 4 -PageSize 100

## Benchmark Results (Executed)
Run profile:
- iterations = 12
- concurrency = 4
- pageSize = 100
- sortBy = engagementScore desc

Observed latencies:
- Engagement Overview:
  - avg 241.75ms, p95 312ms, max 359ms
- Engagement Daily Scores:
  - avg 272.17ms, p95 409ms, max 568ms
- Engagement Event Breakdown:
  - avg 243.17ms, p95 297ms, max 329ms
- Engagement Top Users Table:
  - avg 1065ms, p50 262ms, p95 2698ms, max 2954ms

Interpretation:
- Summary/chart APIs are stable in this environment and mostly sub-400ms at p95.
- Top users table has strong median performance but high tail under concurrent requests.
- For very large tenants (50k users, 50 courses, 10 lessons each), the top-users grouped query is the primary optimization target.

Recommended next tuning for huge datasets:
1. Add covering index for top-users aggregation path, for example:
   - UserEngagements(OrganisationId, CreatedAt, UserId, EventType)
2. Introduce short TTL cache for table responses by (org, date range, sort, page).
3. Add scheduled pre-aggregation for engagement-per-user snapshots when tenant size crosses threshold.

## References (Line Anchors)
- Controller endpoints: lmsBox.Server/Controllers/EngagementAnalyticsController.cs
- Aggregation and table query logic: lmsBox.Server/Services/EngagementTrackingService.cs
- Table sorting/paging UI logic: lmsbox.client/src/pages/EngagementAnalytics.jsx
