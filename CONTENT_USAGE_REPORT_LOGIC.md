# Content Usage Report - Logic, Formulas, and Validation

## Scope
This document describes the current implementation logic for:
- Report: Content Usage Report
- URL: /admin/reports/content-usage
- API (combined, backward-compatible): /api/admin/reports/content-usage
- API (summary): /api/admin/reports/content-usage/summary
- API (content table): /api/admin/reports/content-usage/content

## Source Files
- Backend: lmsBox.Server/Controllers/AdminReportsController.cs
- Frontend page: lmsbox.client/src/pages/ContentUsageReport.jsx
- Frontend service: lmsbox.client/src/services/reports.js

## Request Inputs
The content-table API accepts:
- category (optional)
- startDate (optional)
- endDate (optional)
- search (optional; matches content title/category)
- engagement (optional; High|Medium|Low|None|all)
- pageNumber (optional, default = 1)
- pageSize (optional, default = 25, max = 500)
- sortBy (optional, default = usageScore)
- sortDirection (optional; asc|desc, default = desc)

The summary API accepts:
- category (optional)
- startDate (optional)
- endDate (optional)

## Data Fetch Pattern
Frontend now uses split calls:
- Summary cards/charts from /content-usage/summary
- Table rows from /content-usage/content

Behavior:
- Clicking column sort headers only reloads table data.
- Paging and page-size changes only reload table data.
- Main filter apply (category/date) reloads both summary and table.
- Table filter apply (search/engagement) reloads only table.

## Aggregation Basis
Report rows represent course-level content.

Per-course base metrics are computed from LearnerProgresses where:
- LessonId == null
- CourseId != null

Date filtering is applied to progress rows using OR over:
- LastAccessedAt
- CompletedAt
- StartedAt

## Per-Content Formulas
For each content row (course):
- accessCount = count(progress rows)
- uniqueUsers = count(distinct UserId)
- completions = count(progress rows where Completed = true)
- completionRate = accessCount > 0 ? round((completions / accessCount) * 100, 2) : 0
- averageProgress = round(avg(ProgressPercent), 2)
- lessonCount = count(Lessons where Lessons.CourseId == Course.Id)
- lastAccessDate = max(coalesce(LastAccessedAt, CompletedAt, StartedAt))
- daysSinceLastAccess = lastAccessDate exists ? floor((UtcNow - lastAccessDate).TotalDays) : null
- isUnused = accessCount == 0
- usageScore = accessCount + (uniqueUsers * 2) + (completions * 3)

## Engagement Label Logic
Engagement level is computed from accessCount:
- High: accessCount > 100
- Medium: accessCount > 30 and <= 100
- Low: accessCount > 0 and <= 30
- None: accessCount == 0

## Summary Card Formulas
- totalContent = count(all rows)
- totalAccesses = sum(accessCount)
- totalUniqueUsers = sum(uniqueUsers)
- unusedContent = count(isUnused == true)
- underutilizedContent = count(accessCount > 0 and accessCount < 10)
- highEngagement = count(engagementLevel == High)
- mediumEngagement = count(engagementLevel == Medium)
- lowEngagement = count(engagementLevel == Low)
- averageAccessPerContent = totalContent > 0 ? round(avg(accessCount), 2) : 0
- mostAccessedContent = title of row with highest accessCount
- leastAccessedContent = title of non-unused row with lowest accessCount

## Category Breakdown
Grouped by category:
- contentCount
- totalAccesses
- totalUsers
- averageEngagement (mean accessCount)
- unusedContent

## Table Sorting Options
Supported sortBy values:
- contentTitle
- category
- accessCount
- uniqueUsers
- completions
- completionRate
- averageProgress
- engagementLevel
- lessonCount
- lastAccessDate
- daysSinceLastAccess
- status (mapped to isUnused)
- createdAt
- usageScore

Sort safeguards:
- Unknown sortBy normalizes to usageScore.
- Unknown sortDirection normalizes to desc.

## Pagination Response
Content-table API response includes:
- pageNumber
- pageSize
- totalRows
- totalPages
- hasPreviousPage
- hasNextPage

## Validation Checklist
1. Open /admin/reports/content-usage and verify summary loads.
2. Verify table loads with pagination object from /content-usage/content.
3. Click each sortable header and confirm only table loader appears.
4. Change page and page size; verify summary values stay unchanged.
5. Apply category/date filters; verify both summary and table update.
6. Apply search/engagement table filters; verify only table updates.
7. Verify consistency:
   - summary.totalContent == content.pagination.totalRows when only summary filters are used.
   - combined.summary.totalContent matches summary endpoint totalContent.
8. Verify row-level formulas against sample rows (completionRate, usageScore, status).

## Performance Preparation
Added report-specific indexes for course-level progress rows:
- LearnerProgresses(CourseId, LessonId, LastAccessedAt, CompletedAt, StartedAt) with filter LessonId IS NULL AND CourseId IS NOT NULL
- LearnerProgresses(CourseId, LessonId, UserId, Completed, ProgressPercent) with same filter

Runtime caching optimization:
- Summary endpoint now uses in-memory cache with a 60-second TTL.
- Cache key scope: organization + category + startDate + endDate.
- This reduces repeated recomputation for dashboard refresh bursts and concurrent viewers.

Migration file:
- lmsbox.infrastructure/Migrations/20260407101905_AddContentUsageReportIndexes.cs

Benchmark script:
- test-content-usage-report-performance.ps1

Example benchmark command:
- .\test-content-usage-report-performance.ps1 -Token "<jwt>" -Iterations 30 -PageSize 100 -Concurrency 4 -IncludeCombined

## Latest Validation Snapshot
Smoke test (authenticated):
- summary.totalContent = 25
- content.pagination.totalRows = 25
- combined.summary.totalContent = 25
- Consistency checks passed.

Benchmark (30 iterations, concurrency 4, pageSize 100):
- Content Usage Summary: avg 384.1ms, p95 930ms
- Content Usage Content: avg 231.1ms, p95 281ms
- Content Usage Combined: avg 241.57ms, p95 308ms

Post-cache quick check (same process, back-to-back summary calls):
- First call: ~587.66ms
- Second call: ~33.21ms

## Notes
- The split API design ensures sort/page interactions do not trigger summary/charts recomputation.
- For the target scale (50,000 users, 50 courses, 10 lessons/course), server workload scales primarily with LearnerProgress aggregation, while payload remains bounded by course count for this report.
