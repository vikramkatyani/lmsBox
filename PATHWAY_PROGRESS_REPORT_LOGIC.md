# Pathway Progress Report - Logic, Formulas, and Validation

## Scope
This document describes the current implementation logic for:
- Report: Pathway Progress Report
- URL: /admin/reports/pathway-progress
- API (combined, backward-compatible): /api/admin/reports/pathway-progress
- API (summary): /api/admin/reports/pathway-progress/summary
- API (pathways list): /api/admin/reports/pathway-progress/pathways

## Source Files
- Backend: lmsBox.Server/Controllers/AdminReportsController.cs
- Frontend page: lmsbox.client/src/pages/PathwayProgressReport.jsx
- Frontend service: lmsbox.client/src/services/reports.js

## Request Inputs
The pathways-list API accepts:
- startDate (optional)
- endDate (optional)
- activeOnly (optional)
- pageNumber (optional, default = 1)
- pageSize (optional, default = 50, max = 500)
- search (optional; matches pathway title, description, engagement level)
- sortBy (optional; default = totalEnrollments)
- sortDirection (optional; asc|desc, default = desc)

The summary API accepts:
- startDate (optional)
- endDate (optional)
- activeOnly (optional)

Behavior:
- If startDate/endDate are not provided, pathway enrollment data is evaluated all-time.
- If activeOnly=true, only active pathways are included.
- Date filters are applied to pathway enrollment rows using EnrolledAt.

## Data Fetch Pattern
Frontend now uses split calls:
- Summary cards/charts from /pathway-progress/summary
- Pathways table rows from /pathway-progress/pathways

This prevents full report reload for table-only interactions:
- Sorting refreshes table rows only.
- Pagination refreshes table rows only.
- Search refreshes table rows only.

Filter apply behavior:
- Applying date/active filters refreshes summary and table.

## Base Aggregation Logic
For each pathway, data is built from LearnerPathwayProgress grouped by LearningPathwayId.

Per-pathway base metrics:
- totalEnrollments = count(*)
- completions = count(IsCompleted == true)
- inProgress = count(IsCompleted == false and ProgressPercent > 0)
- notStarted = count(ProgressPercent == 0)
- averageProgress = round(avg(ProgressPercent), 2)
- averageCompletionTime = round(avg(DateDiffDay(EnrolledAt, CompletedAt) for completed rows), 1)
- recentEnrollments = count(EnrolledAt >= UtcNow - 30 days)
- courseCount = count(PathwayCourses for pathway)

Derived metrics:
- completionRate = totalEnrollments > 0 ? round((completions / totalEnrollments) * 100, 2) : 0
- dropoutRate = totalEnrollments > 0 ? round(100 - completionRate, 2) : 0

## Engagement Level Rules
EngagementLevel is assigned per pathway:
- Excellent: totalEnrollments > 50 and completionRate >= 60
- Good: totalEnrollments > 20 and completionRate >= 40
- Fair: totalEnrollments > 0 and completionRate >= 20
- Poor: totalEnrollments > 0 and completionRate < 20
- No Data: totalEnrollments == 0

## Popular / Top / Struggling Rules
- isPopular = totalEnrollments > 20 and completionRate >= 50
- topPathways = pathways with enrollments, sorted by completionRate desc, top 5
- popularPathways = pathways where isPopular, sorted by totalEnrollments desc, top 5
- strugglingPathways = pathways with totalEnrollments > 5 and completionRate < 30, sorted by completionRate asc, top 5

## Summary Card Formulas
- totalPathways = count(pathways)
- activePathways = count(isActive == true)
- totalEnrollments = sum(totalEnrollments)
- totalCompletions = sum(completions)
- totalInProgress = sum(inProgress)
- averageCompletionRate = round(avg(completionRate), 2)
- averageCompletionTime = round(avg(averageCompletionTime where > 0), 2)
- mostSuccessfulPathway = pathwayTitle of max(completionRate)
- mostPopularPathway = pathwayTitle of max(totalEnrollments)
- pathwaysWithNoEnrollments = count(totalEnrollments == 0)

## Charts Logic
Completion trend (6 months):
- Source: completed pathway progress rows where CompletedAt >= UtcNow - 6 months
- Grouping: by CompletedAt year and month
- Value: completions count per month
- Label format: YYYY-MM

Engagement distribution:
- Group pathways by engagementLevel
- count = pathways in each level
- percentage = round((count / totalPathways) * 100, 2)

Top performers chart:
- Source: topPathways
- Metric: completionRate

## Sorting Options
Supported sortBy values for pathways list API:
- pathwayTitle
- isActive
- courseCount
- totalEnrollments
- completions
- inProgress
- notStarted
- completionRate
- averageProgress
- averageCompletionTime
- engagementLevel
- recentEnrollments

Sort safeguards:
- Invalid sortBy is normalized to totalEnrollments.
- Invalid sortDirection is normalized to desc.

## Pagination Response
Pathways API response includes:
- pageNumber
- pageSize
- totalPathways
- totalPages
- hasPreviousPage
- hasNextPage

## Validation Checklist
1. Open /admin/reports/pathway-progress and verify summary cards load.
2. Confirm table sorting icon appears on every column header and updates direction on click.
3. Confirm sorting updates only table rows (summary cards/charts do not reload).
4. Confirm pagination updates only table rows and page counts.
5. Confirm search filters table by title/description/engagement.
6. Verify completionRate formula on sample rows: completions / totalEnrollments * 100.
7. Verify engagement level thresholds against sample data.
8. Verify popular/struggling/top sections against table values.
9. Validate activeOnly filter limits to active pathways when enabled.
10. Validate date filters change enrollment/completion aggregates via EnrolledAt window.

## Performance Enhancements Implemented
- Split API design to avoid refetching heavy summary payload for table interactions.
- AsNoTracking used for read-only reporting queries.
- Aggregation pushed to SQL via GroupBy before in-memory projection.
- Table endpoint supports server-side pagination, sorting, and search.
- Completion trends query uses SQL-safe year/month grouping with in-memory label formatting.

## Benchmark Script
- test-pathway-progress-report-performance.ps1

Example usage:
- .\test-pathway-progress-report-performance.ps1 -Token "<jwt>" -Iterations 20 -PageSize 100 -Concurrency 4
- Add -IncludeCombined to compare combined endpoint latency.
