# User-Course Progress Report - Logic, Formulas, and Validation

## Scope
This document describes the current implementation logic for:
- Report: User-Course Progress Report
- URL: /admin/reports/user-course-progress
- API (combined, backward-compatible): /api/admin/reports/user-course-progress
- API (summary): /api/admin/reports/user-course-progress/summary
- API (records list): /api/admin/reports/user-course-progress/records

## Source Files
- Backend: lmsBox.Server/Controllers/AdminReportsController.cs
- Frontend page: lmsbox.client/src/pages/UserCourseProgressReport.jsx
- Frontend service: lmsbox.client/src/services/reports.js

## Request Inputs
The records API accepts:
- search (optional; matches user name, email, course title, category)
- courseId (optional)
- status (optional; Completed | In Progress | Not Started)
- startDate (optional)
- endDate (optional)
- pageNumber (optional, default = 1)
- pageSize (optional, default = 50, max = 500)
- sortBy (optional, default = progressPercent)
- sortDirection (optional; asc|desc, default = desc)

The summary API accepts:
- search (optional)
- courseId (optional)
- status (optional)
- startDate (optional)
- endDate (optional)

## Data Fetch Pattern
Frontend uses split calls:
- Summary cards/charts/top lists from /user-course-progress/summary
- Table rows from /user-course-progress/records

Behavior:
- Applying filters refreshes summary and table.
- Sorting and pagination refresh table only.

## Base Dataset Definition
Base rows are course-level progress rows only:
- LearnerProgresses where LessonId == null and CourseId != null
- Joined to Users and Courses
- Scoped to organization for OrgAdmin users

Each row emits:
- userId, userName, email
- courseId, courseTitle, courseCategory
- progressPercent, completed, completedAt
- lastActivityAt
- daysToComplete (completed rows with startedAt/completedAt)
- daysSinceLastActivity
- isStale
- status
- performance

## Core Row Formulas
Status:
- Completed if completed == true
- In Progress if completed == false and progressPercent > 0
- Not Started if completed == false and progressPercent == 0

Stale flag:
- isStale = (completed == false) and (progressPercent < 50)

Days since last activity:
- daysSinceLastActivity = DATEDIFF(day, lastActivityAtFallback, UtcNow)
- lastActivityAtFallback = LastAccessedAt ?? CompletedAt ?? StartedAt ?? Course.CreatedAt

Performance label (completed rows):
- Excellent: daysToComplete <= 7
- Good: 8-14
- Average: 15-30
- Slow: > 30
- N/A for non-completed rows or missing dates

## Date Filter Logic
Date filters apply to completed-date window only for completed records:
- Include non-completed rows regardless of completion date.
- Include completed rows only when completedAt falls in selected range.

## Summary Metrics
Summary cards:
- totalUsers = users count in org scope
- totalCourses = courses count in org scope
- totalEnrollments = count(base rows)
- totalCompleted = count(completed == true)
- totalInProgress = count(completed == false and progressPercent > 0)
- totalNotStarted = count(completed == false and progressPercent == 0)
- averageProgressPercent = round(avg(progressPercent), 2)
- overallCompletionRate = round((totalCompleted / totalEnrollments) * 100, 2)
- staleEnrollmentsCount = count(isStale == true)
- activeUsers = distinct userId count in base rows
- averageCoursesPerUser = round(totalEnrollments / totalUsers, 2)

Status distribution:
- Completed count + percentage
- In Progress count + percentage
- Not Started count + percentage

Performance distribution:
- Excellent count
- Good count
- Average count
- Slow count

## Table and Sorting
Supported sortBy values:
- userName
- email
- courseTitle
- courseCategory
- progressPercent
- status
- performance
- completedAt
- daysToComplete
- daysSinceLastActivity
- isStale

Sort normalization:
- Unknown sortBy -> progressPercent
- Unknown sortDirection -> desc

Pagination response fields:
- pageNumber
- pageSize
- totalRows
- totalPages
- hasPreviousPage
- hasNextPage

## Validation Checklist
1. Open report page and check network calls:
- /summary returns cards + chart data
- /records returns only table rows with pagination
2. Confirm sort behavior:
- clicking a column toggles asc/desc
- only /records is called on sort change
3. Confirm paging behavior:
- table updates and summary remains stable
- page and page size change only call /records
4. Confirm formulas:
- status mapping matches progress/completed state
- stale count equals rows where !completed and progress < 50
- completion rate matches totalCompleted / totalEnrollments
5. Confirm filters:
- filter apply updates both summary and table
- course/status/search/date filters are respected

## Performance Notes (Large Scale)
Target scenario: 50,000 users, 50 courses, 10 lessons/course.

Implementation choices for scale:
- Server-side filtering/sorting/paging for table endpoint.
- SQL-side aggregation for summary calculations.
- AsNoTracking on report queries.
- Split endpoints avoid recalculating summary for each table interaction.
- Combined endpoint kept for compatibility; UI uses split endpoints by default.

Implemented DB indexes for this report path:
- LearnerProgresses(CourseId, Completed, ProgressPercent, CompletedAt) filtered by LessonId IS NULL AND CourseId IS NOT NULL
- LearnerProgresses(Completed, ProgressPercent, LastAccessedAt, StartedAt, CompletedAt) filtered by LessonId IS NULL AND CourseId IS NOT NULL

Migration applied:
- 20260407095525_AddUserCourseProgressReportIndexes

Benchmark snapshot after index deployment (30 iterations, concurrency 4, pageSize 100):
- Summary endpoint: avg 477.83ms, p50 359ms, p95 1179ms, p99 1330ms
- Records endpoint: avg 252.03ms, p50 234ms, p95 322ms, p99 369ms
- Combined endpoint: avg 348.6ms, p50 342ms, p95 426ms, p99 442ms

## Benchmark Script
- test-user-course-progress-report-performance.ps1

Example:
- .\test-user-course-progress-report-performance.ps1 -Token "<jwt>" -Iterations 20 -PageSize 100 -Concurrency 4 -IncludeCombined
