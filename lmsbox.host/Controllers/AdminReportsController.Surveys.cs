using lmsbox.domain.Models;
using lmsBox.Server.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace lmsBox.Server.Controllers;

public partial class AdminReportsController
{
    #region Survey Report

    private bool CanViewRestrictedSurveyResponses() => User.IsInRole("SuperAdmin");

    private bool AreSurveyResponsesAnonymous() =>
        User.IsInRole("OrgAdmin") || User.IsInRole("Admin");

    private static bool IsRestrictedSurveyQuestion(SurveyQuestion question) =>
        string.Equals(question.ResponseVisibility, SurveyQuestionResponseVisibility.SuperAdminOnly, StringComparison.OrdinalIgnoreCase);

    private IEnumerable<SurveyQuestion> FilterSurveyQuestionsForReportViewer(IEnumerable<SurveyQuestion> questions)
    {
        if (CanViewRestrictedSurveyResponses())
            return questions;

        return questions.Where(q => !IsRestrictedSurveyQuestion(q));
    }

    private IQueryable<SurveyQuestion> ApplySurveyQuestionVisibilityFilter(IQueryable<SurveyQuestion> query)
    {
        if (CanViewRestrictedSurveyResponses())
            return query;

        return query.Where(q => q.ResponseVisibility != SurveyQuestionResponseVisibility.SuperAdminOnly);
    }

    private IQueryable<SurveyQuestionResponse> ApplySurveyQuestionResponseVisibilityFilter(
        IQueryable<SurveyQuestionResponse> query)
    {
        if (CanViewRestrictedSurveyResponses())
            return query;

        return query.Where(qr =>
            qr.SurveyQuestion != null
            && qr.SurveyQuestion.ResponseVisibility != SurveyQuestionResponseVisibility.SuperAdminOnly);
    }

    private IQueryable<SurveyResponse> BuildScopedSurveyResponsesQuery(AdminUserScope scope)
    {
        var query =
            from sr in _context.SurveyResponses.AsNoTracking()
            join user in _context.Users.AsNoTracking() on sr.UserId equals user.Id
            join course in _context.Courses.AsNoTracking() on sr.CourseId equals course.Id into courseJoin
            from course in courseJoin.DefaultIfEmpty()
            where !scope.OrganisationId.HasValue
                || (user.OrganisationID == scope.OrganisationId
                    && (sr.CourseId == null
                        || (!course.IsDeleted
                            && course.OrganisationId == scope.OrganisationId)))
            select sr;

        return query;
    }

    private IQueryable<SurveyResponse> ApplySurveyResponseFilters(
        IQueryable<SurveyResponse> query,
        long surveyId,
        string? courseId,
        string? surveyType,
        DateTime? startDate,
        DateTime? endDate,
        string? search)
    {
        query = query.Where(sr => sr.SurveyId == surveyId);

        if (!string.IsNullOrWhiteSpace(courseId))
            query = query.Where(sr => sr.CourseId == courseId);

        if (!string.IsNullOrWhiteSpace(surveyType))
            query = query.Where(sr => sr.SurveyType == surveyType);

        if (startDate.HasValue)
            query = query.Where(sr => sr.SubmittedAt >= startDate.Value);

        if (endDate.HasValue)
        {
            var endExclusive = endDate.Value.Date.AddDays(1);
            query = query.Where(sr => sr.SubmittedAt < endExclusive);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            if (AreSurveyResponsesAnonymous())
            {
                query = query.Where(sr =>
                    _context.Courses.Any(c => c.Id == sr.CourseId && c.Title.ToLower().Contains(term)));
            }
            else
            {
                query = query.Where(sr =>
                    _context.Users.Any(u => u.Id == sr.UserId
                        && ((u.FirstName ?? string.Empty) + " " + (u.LastName ?? string.Empty)).ToLower().Contains(term)
                        || (u.Email ?? string.Empty).ToLower().Contains(term))
                    || _context.Courses.Any(c => c.Id == sr.CourseId && c.Title.ToLower().Contains(term)));
            }
        }

        return query;
    }

    private async Task<Course?> GetAccessibleCourseForSurveyReportAsync(string courseId, AdminUserScope scope)
    {
        if (string.IsNullOrWhiteSpace(courseId))
            return null;

        var course = await _context.Courses.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == courseId && !c.IsDeleted);
        if (course == null)
            return null;

        if (!scope.OrganisationId.HasValue)
            return course;

        var orgId = scope.OrganisationId.Value;
        if (course.OrganisationId == orgId)
            return course;

        return null;
    }

    private static bool IsSurveyLinkedToCourse(Course course, long surveyId, string? surveyType)
    {
        if (course.PreCourseSurveyId == surveyId && (string.IsNullOrWhiteSpace(surveyType) || surveyType == "PreCourse"))
            return true;
        if (course.PostCourseSurveyId == surveyId && (string.IsNullOrWhiteSpace(surveyType) || surveyType == "PostCourse"))
            return true;
        return false;
    }

    private sealed class SurveyResponseMeta
    {
        public string UserName { get; set; } = string.Empty;
        public string? UserEmail { get; set; }
        public DateTime SubmittedAt { get; set; }
    }

    private static List<object> BuildQuestionAnalytics(
        IEnumerable<SurveyQuestion> questions,
        List<SurveyQuestionResponse> questionResponses,
        IReadOnlyDictionary<long, SurveyResponseMeta> responseMetaById,
        bool anonymizeRespondents)
    {
        return questions.OrderBy(q => q.OrderIndex).Select(question =>
        {
            var responses = questionResponses.Where(qr => qr.SurveyQuestionId == question.Id).ToList();
            var totalResponses = responses.Count;
            object? analysisData = null;

            switch (question.QuestionType)
            {
                case "Rating":
                    var ratingValues = responses
                        .Where(r => r.RatingValue.HasValue)
                        .Select(r => r.RatingValue!.Value)
                        .ToList();
                    var ratingCount = ratingValues.Count;
                    analysisData = new
                    {
                        averageRating = ratingCount > 0 ? Math.Round(ratingValues.Average(), 2) : 0,
                        totalResponses = ratingCount,
                        minRating = question.MinRating,
                        maxRating = question.MaxRating,
                        distribution = ratingValues
                            .GroupBy(v => v)
                            .OrderBy(g => g.Key)
                            .Select(g => new
                            {
                                rating = g.Key,
                                count = g.Count(),
                                percentage = ratingCount > 0 ? Math.Round(g.Count() * 100.0 / ratingCount, 1) : 0
                            })
                            .ToList()
                    };
                    break;

                case "SingleChoice":
                case "MultipleChoice":
                    var optionCounts = new Dictionary<string, int>();
                    foreach (var response in responses)
                    {
                        List<string>? selectedOptions = null;
                        if (!string.IsNullOrEmpty(response.SelectedOptions))
                            selectedOptions = JsonSerializer.Deserialize<List<string>>(response.SelectedOptions);

                        if (selectedOptions == null)
                            continue;

                        foreach (var option in selectedOptions)
                        {
                            if (!optionCounts.ContainsKey(option))
                                optionCounts[option] = 0;
                            optionCounts[option]++;
                        }
                    }

                    analysisData = new
                    {
                        totalResponses,
                        optionDistribution = optionCounts
                            .Select(kv => new
                            {
                                option = kv.Key,
                                count = kv.Value,
                                percentage = totalResponses > 0 ? Math.Round(kv.Value * 100.0 / totalResponses, 1) : 0
                            })
                            .OrderByDescending(x => x.count)
                            .ToList()
                    };
                    break;

                case "YesNo":
                    var yesCount = responses.Count(r => string.Equals(r.AnswerText, "yes", StringComparison.OrdinalIgnoreCase));
                    var noCount = responses.Count(r => string.Equals(r.AnswerText, "no", StringComparison.OrdinalIgnoreCase));
                    analysisData = new
                    {
                        totalResponses,
                        yesCount,
                        noCount,
                        yesPercentage = totalResponses > 0 ? Math.Round(yesCount * 100.0 / totalResponses, 1) : 0,
                        noPercentage = totalResponses > 0 ? Math.Round(noCount * 100.0 / totalResponses, 1) : 0
                    };
                    break;

                case "Text":
                    analysisData = new
                    {
                        totalResponses,
                        textAnswers = responses
                            .Where(r => !string.IsNullOrWhiteSpace(r.AnswerText))
                            .OrderByDescending(r =>
                            {
                                responseMetaById.TryGetValue(r.SurveyResponseId, out var meta);
                                return meta?.SubmittedAt ?? r.AnsweredAt;
                            })
                            .Select(r =>
                            {
                                responseMetaById.TryGetValue(r.SurveyResponseId, out var meta);
                                var submittedAt = meta?.SubmittedAt ?? r.AnsweredAt;
                                if (anonymizeRespondents)
                                {
                                    return (object)new
                                    {
                                        submittedAt,
                                        text = r.AnswerText
                                    };
                                }

                                return new
                                {
                                    userName = meta?.UserName ?? "Unknown User",
                                    userEmail = meta?.UserEmail,
                                    submittedAt,
                                    text = r.AnswerText
                                };
                            })
                            .ToList()
                    };
                    break;
            }

            return (object)new
            {
                questionId = question.Id,
                questionText = question.QuestionText,
                questionType = question.QuestionType,
                isRequired = question.IsRequired,
                orderIndex = question.OrderIndex,
                analysis = analysisData
            };
        }).ToList();
    }

    private async Task<bool> CanAccessSurveyForReportAsync(long surveyId, AdminUserScope scope)
    {
        var surveyExists = await _context.Surveys.AsNoTracking()
            .AnyAsync(s => s.Id == surveyId && !s.IsDeleted);
        if (!surveyExists)
            return false;

        if (!scope.OrganisationId.HasValue)
            return true;

        var orgId = scope.OrganisationId.Value;

        var ownedByOrg = await _context.Surveys.AsNoTracking()
            .AnyAsync(s => s.Id == surveyId && !s.IsDeleted && s.OrganisationId == orgId);
        if (ownedByOrg)
            return true;

        var usedOnVisibleCourse = await _context.Courses.AsNoTracking()
            .AnyAsync(c => !c.IsDeleted
                && (c.PreCourseSurveyId == surveyId || c.PostCourseSurveyId == surveyId)
                && c.OrganisationId == orgId);
        if (usedOnVisibleCourse)
            return true;

        return await BuildScopedSurveyResponsesQuery(scope).AnyAsync(sr => sr.SurveyId == surveyId);
    }

    [HttpGet("surveys/overview")]
    public async Task<IActionResult> GetSurveyReportOverview(
        [FromQuery] string? search,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string? sortBy = "courseTitle",
        [FromQuery] string? sortDirection = "asc")
    {
        try
        {
            pageNumber = Math.Max(pageNumber, 1);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var scope = await GetUserScope();
            var rows = await BuildSurveyOverviewRowsAsync(scope, search);

            var descending = string.Equals(sortDirection, "desc", StringComparison.OrdinalIgnoreCase);
            var sorted = (sortBy ?? "courseTitle").Trim().ToLowerInvariant() switch
            {
                "surveytitle" => descending
                    ? rows.OrderByDescending(r => r.SurveyTitle).ThenBy(r => r.CourseTitle)
                    : rows.OrderBy(r => r.SurveyTitle).ThenBy(r => r.CourseTitle),
                "surveytype" => descending
                    ? rows.OrderByDescending(r => r.SurveyType).ThenBy(r => r.CourseTitle)
                    : rows.OrderBy(r => r.SurveyType).ThenBy(r => r.CourseTitle),
                "responsecount" or "attempts" => descending
                    ? rows.OrderByDescending(r => r.ResponseCount).ThenBy(r => r.CourseTitle)
                    : rows.OrderBy(r => r.ResponseCount).ThenBy(r => r.CourseTitle),
                _ => descending
                    ? rows.OrderByDescending(r => r.CourseTitle).ThenBy(r => r.SurveyType)
                    : rows.OrderBy(r => r.CourseTitle).ThenBy(r => r.SurveyType)
            };

            var materialized = sorted.ToList();
            var totalRows = materialized.Count;
            var totalPages = totalRows == 0 ? 1 : (int)Math.Ceiling(totalRows / (double)pageSize);
            var paged = materialized.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToList();

            var summary = new
            {
                linkedSurveys = totalRows,
                coursesWithSurveys = materialized.Select(r => r.CourseId).Distinct().Count(),
                totalResponses = materialized.Sum(r => r.ResponseCount),
                uniqueRespondents = await CountUniqueSurveyRespondentsAsync(scope, materialized),
                preCourseSurveys = materialized.Count(r => r.SurveyType == "PreCourse"),
                postCourseSurveys = materialized.Count(r => r.SurveyType == "PostCourse")
            };

            return Ok(new
            {
                organization = await ResolveOrganizationName(scope.OrganisationId),
                generatedAt = DateTime.UtcNow,
                summary,
                items = paged,
                pagination = new
                {
                    pageNumber,
                    pageSize,
                    totalItems = totalRows,
                    totalPages,
                    hasPreviousPage = pageNumber > 1,
                    hasNextPage = pageNumber < totalPages
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating survey report overview");
            return StatusCode(500, new { error = "Failed to generate survey report overview", details = ex.Message });
        }
    }

    private sealed class SurveyReportOverviewRow
    {
        public string CourseId { get; set; } = string.Empty;
        public string CourseTitle { get; set; } = string.Empty;
        public string? CourseCategory { get; set; }
        public long SurveyId { get; set; }
        public string SurveyTitle { get; set; } = string.Empty;
        public string SurveyType { get; set; } = string.Empty;
        public string TypeLabel { get; set; } = string.Empty;
        public int QuestionCount { get; set; }
        public int ResponseCount { get; set; }
    }

    private async Task<List<SurveyReportOverviewRow>> BuildSurveyOverviewRowsAsync(AdminUserScope scope, string? search)
    {
        var coursesQuery = _context.Courses.AsNoTracking()
            .Where(c => !c.IsDeleted && (c.PreCourseSurveyId != null || c.PostCourseSurveyId != null));

        if (scope.OrganisationId.HasValue)
        {
            var orgId = scope.OrganisationId.Value;
            coursesQuery = coursesQuery.Where(c => c.OrganisationId == orgId);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            coursesQuery = coursesQuery.Where(c =>
                c.Title.ToLower().Contains(term)
                || (c.PreCourseSurveyId != null && _context.Surveys.Any(s =>
                    s.Id == c.PreCourseSurveyId && !s.IsDeleted && s.Title.ToLower().Contains(term)))
                || (c.PostCourseSurveyId != null && _context.Surveys.Any(s =>
                    s.Id == c.PostCourseSurveyId && !s.IsDeleted && s.Title.ToLower().Contains(term))));
        }

        var courses = await coursesQuery.OrderBy(c => c.Title).ToListAsync();
        if (courses.Count == 0)
            return new List<SurveyReportOverviewRow>();

        var surveyIds = courses
            .SelectMany(c => new[] { c.PreCourseSurveyId, c.PostCourseSurveyId })
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var surveys = surveyIds.Count == 0
            ? new Dictionary<long, Survey>()
            : await _context.Surveys.AsNoTracking()
                .Where(s => surveyIds.Contains(s.Id) && !s.IsDeleted)
                .ToDictionaryAsync(s => s.Id);

        var questionCounts = surveyIds.Count == 0
            ? new Dictionary<long, int>()
            : await ApplySurveyQuestionVisibilityFilter(_context.SurveyQuestions.AsNoTracking()
                .Where(q => surveyIds.Contains(q.SurveyId)))
                .GroupBy(q => q.SurveyId)
                .Select(g => new { SurveyId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.SurveyId, x => x.Count);

        var courseIds = courses.Select(c => c.Id).ToList();
        var responseCounts = await BuildScopedSurveyResponsesQuery(scope)
            .Where(sr => sr.CourseId != null && courseIds.Contains(sr.CourseId))
            .GroupBy(sr => new { sr.CourseId, sr.SurveyId, sr.SurveyType })
            .Select(g => new
            {
                g.Key.CourseId,
                g.Key.SurveyId,
                g.Key.SurveyType,
                Count = g.Count()
            })
            .ToListAsync();

        var countLookup = responseCounts.ToDictionary(
            x => $"{x.CourseId}|{x.SurveyId}|{x.SurveyType}",
            x => x.Count);

        var rows = new List<SurveyReportOverviewRow>();
        foreach (var course in courses)
        {
            void AddRow(long? surveyId, string surveyType, string typeLabel)
            {
                if (!surveyId.HasValue || !surveys.TryGetValue(surveyId.Value, out var survey))
                    return;

                var key = $"{course.Id}|{survey.Id}|{surveyType}";
                rows.Add(new SurveyReportOverviewRow
                {
                    CourseId = course.Id,
                    CourseTitle = course.Title,
                    CourseCategory = course.Category,
                    SurveyId = survey.Id,
                    SurveyTitle = survey.Title,
                    SurveyType = surveyType,
                    TypeLabel = typeLabel,
                    QuestionCount = questionCounts.GetValueOrDefault(survey.Id),
                    ResponseCount = countLookup.GetValueOrDefault(key)
                });
            }

            AddRow(course.PreCourseSurveyId, "PreCourse", "Pre-course");
            AddRow(course.PostCourseSurveyId, "PostCourse", "Post-course");
        }

        return rows;
    }

    private async Task<int> CountUniqueSurveyRespondentsAsync(
        AdminUserScope scope,
        IReadOnlyList<SurveyReportOverviewRow> rows)
    {
        if (rows.Count == 0)
            return 0;

        var courseIds = rows.Select(r => r.CourseId).Distinct().ToList();
        var surveyIds = rows.Select(r => r.SurveyId).Distinct().ToList();

        return await BuildScopedSurveyResponsesQuery(scope)
            .Where(sr => sr.CourseId != null
                && courseIds.Contains(sr.CourseId)
                && surveyIds.Contains(sr.SurveyId))
            .Select(sr => sr.UserId)
            .Distinct()
            .CountAsync();
    }

    [HttpGet("surveys/courses")]
    public async Task<IActionResult> GetSurveyReportCoursesList([FromQuery] string? search)
    {
        try
        {
            var scope = await GetUserScope();
            var coursesQuery = _context.Courses.AsNoTracking()
                .Where(c => !c.IsDeleted && (c.PreCourseSurveyId != null || c.PostCourseSurveyId != null));

            if (scope.OrganisationId.HasValue)
            {
                var orgId = scope.OrganisationId.Value;
                coursesQuery = coursesQuery.Where(c => c.OrganisationId == orgId);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                coursesQuery = coursesQuery.Where(c => c.Title.ToLower().Contains(term));
            }

            var courses = await coursesQuery
                .OrderBy(c => c.Title)
                .Select(c => new
                {
                    c.Id,
                    c.Title,
                    c.Category,
                    c.Status,
                    hasPreSurvey = c.PreCourseSurveyId != null,
                    hasPostSurvey = c.PostCourseSurveyId != null
                })
                .ToListAsync();

            return Ok(new
            {
                organization = await ResolveOrganizationName(scope.OrganisationId),
                generatedAt = DateTime.UtcNow,
                courses
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating survey report course list");
            return StatusCode(500, new { error = "Failed to generate survey report course list", details = ex.Message });
        }
    }

    [HttpGet("surveys/courses/{courseId}/linked-surveys")]
    public async Task<IActionResult> GetCourseLinkedSurveys(string courseId)
    {
        try
        {
            var scope = await GetUserScope();
            var course = await GetAccessibleCourseForSurveyReportAsync(courseId, scope);
            if (course == null)
                return NotFound(new { error = "Course not found" });

            var linked = new List<object>();

            async Task AddLinkedSurveyAsync(long? surveyId, string surveyType, string typeLabel)
            {
                if (!surveyId.HasValue)
                    return;

                var survey = await _context.Surveys.AsNoTracking()
                    .FirstOrDefaultAsync(s => s.Id == surveyId.Value && !s.IsDeleted);
                if (survey == null)
                    return;

                var responseCount = await ApplySurveyResponseFilters(
                        BuildScopedSurveyResponsesQuery(scope),
                        survey.Id,
                        courseId,
                        surveyType,
                        null,
                        null,
                        null)
                    .CountAsync();

                var questionCount = await ApplySurveyQuestionVisibilityFilter(
                        _context.SurveyQuestions.AsNoTracking().Where(q => q.SurveyId == survey.Id))
                    .CountAsync();

                linked.Add(new
                {
                    surveyId = survey.Id,
                    surveyTitle = survey.Title,
                    surveyDescription = survey.Description,
                    surveyType,
                    typeLabel,
                    label = $"{typeLabel}: {survey.Title}",
                    questionCount,
                    responseCount
                });
            }

            await AddLinkedSurveyAsync(course.PreCourseSurveyId, "PreCourse", "Pre-course");
            await AddLinkedSurveyAsync(course.PostCourseSurveyId, "PostCourse", "Post-course");

            return Ok(new
            {
                courseId = course.Id,
                courseTitle = course.Title,
                courseCategory = course.Category,
                organization = await ResolveOrganizationName(scope.OrganisationId),
                generatedAt = DateTime.UtcNow,
                linkedSurveys = linked
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating linked surveys for course {CourseId}", courseId);
            return StatusCode(500, new { error = "Failed to generate linked surveys", details = ex.Message });
        }
    }

    [HttpGet("surveys")]
    public async Task<IActionResult> GetSurveyReportSurveys()
    {
        try
        {
            var scope = await GetUserScope();
            var orgName = await ResolveOrganizationName(scope.OrganisationId);

            var surveysQuery = _context.Surveys.AsNoTracking().Where(s => !s.IsDeleted);

            if (scope.OrganisationId.HasValue)
            {
                var orgId = scope.OrganisationId.Value;
                var visibleCourseSurveyIds = _context.Courses.AsNoTracking()
                    .Where(c => !c.IsDeleted
                        && c.OrganisationId == orgId
                        && (c.PreCourseSurveyId != null || c.PostCourseSurveyId != null))
                    .Select(c => new { c.PreCourseSurveyId, c.PostCourseSurveyId });

                var surveyIdsFromCourses = await visibleCourseSurveyIds
                    .SelectMany(c => new[] { c.PreCourseSurveyId, c.PostCourseSurveyId })
                    .Where(id => id != null)
                    .Select(id => id!.Value)
                    .Distinct()
                    .ToListAsync();

                var surveyIdsFromResponses = await BuildScopedSurveyResponsesQuery(scope)
                    .Select(sr => sr.SurveyId)
                    .Distinct()
                    .ToListAsync();

                var allowedSurveyIds = surveyIdsFromCourses
                    .Concat(surveyIdsFromResponses)
                    .Distinct()
                    .ToHashSet();

                surveysQuery = surveysQuery.Where(s =>
                    s.OrganisationId == orgId || allowedSurveyIds.Contains(s.Id));
            }

            var surveys = await surveysQuery
                .OrderByDescending(s => s.UpdatedAt ?? s.CreatedAt)
                .Select(s => new
                {
                    s.Id,
                    s.Title,
                    s.Description,
                    s.Status,
                    QuestionCount = ApplySurveyQuestionVisibilityFilter(
                        _context.SurveyQuestions.Where(q => q.SurveyId == s.Id)).Count(),
                    s.CreatedAt,
                    s.UpdatedAt
                })
                .ToListAsync();

            var surveyIds = surveys.Select(s => s.Id).ToList();
            var responseCounts = surveyIds.Count == 0
                ? new Dictionary<long, int>()
                : await BuildScopedSurveyResponsesQuery(scope)
                    .Where(sr => surveyIds.Contains(sr.SurveyId))
                    .GroupBy(sr => sr.SurveyId)
                    .Select(g => new { SurveyId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.SurveyId, x => x.Count);

            return Ok(new
            {
                organization = orgName,
                generatedAt = DateTime.UtcNow,
                surveys = surveys.Select(s => new
                {
                    s.Id,
                    s.Title,
                    s.Description,
                    s.Status,
                    s.QuestionCount,
                    responseCount = responseCounts.GetValueOrDefault(s.Id, 0),
                    s.CreatedAt,
                    s.UpdatedAt
                }).ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating survey report survey list");
            return StatusCode(500, new { error = "Failed to generate survey list", details = ex.Message });
        }
    }

    [HttpGet("surveys/{surveyId:long}/courses")]
    public async Task<IActionResult> GetSurveyReportCourses(long surveyId)
    {
        try
        {
            var scope = await GetUserScope();
            if (!await CanAccessSurveyForReportAsync(surveyId, scope))
                return NotFound(new { error = "Survey not found" });

            var coursesQuery = _context.Courses.AsNoTracking()
                .Where(c => !c.IsDeleted
                    && (c.PreCourseSurveyId == surveyId || c.PostCourseSurveyId == surveyId));

            if (scope.OrganisationId.HasValue)
            {
                var orgId = scope.OrganisationId.Value;
                coursesQuery = coursesQuery.Where(c => c.OrganisationId == orgId);
            }

            var courses = await coursesQuery
                .OrderBy(c => c.Title)
                .Select(c => new
                {
                    c.Id,
                    c.Title,
                    c.Category,
                    hasPreSurvey = c.PreCourseSurveyId == surveyId,
                    hasPostSurvey = c.PostCourseSurveyId == surveyId
                })
                .ToListAsync();

            return Ok(new { courses });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating survey report courses for survey {SurveyId}", surveyId);
            return StatusCode(500, new { error = "Failed to generate survey courses", details = ex.Message });
        }
    }

    [HttpGet("surveys/{surveyId:long}/summary")]
    public async Task<IActionResult> GetSurveyReportSummary(
        long surveyId,
        [FromQuery] string? courseId,
        [FromQuery] string? surveyType,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        try
        {
            var scope = await GetUserScope();
            if (!await CanAccessSurveyForReportAsync(surveyId, scope))
                return NotFound(new { error = "Survey not found" });

            var survey = await _context.Surveys.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == surveyId && !s.IsDeleted);
            if (survey == null)
                return NotFound(new { error = "Survey not found" });

            Course? course = null;
            if (!string.IsNullOrWhiteSpace(courseId))
            {
                course = await GetAccessibleCourseForSurveyReportAsync(courseId, scope);
                if (course == null)
                    return NotFound(new { error = "Course not found" });
                if (!IsSurveyLinkedToCourse(course, surveyId, surveyType))
                    return BadRequest(new { error = "Survey is not linked to the selected course" });
            }

            var responsesQuery = ApplySurveyResponseFilters(
                BuildScopedSurveyResponsesQuery(scope),
                surveyId,
                courseId,
                surveyType,
                startDate,
                endDate,
                search: null);

            var totalResponses = await responsesQuery.CountAsync();
            var uniqueRespondents = await responsesQuery.Select(sr => sr.UserId).Distinct().CountAsync();
            var responsesAreAnonymous = AreSurveyResponsesAnonymous();

            return Ok(new
            {
                surveyId = survey.Id,
                surveyTitle = survey.Title,
                surveyDescription = survey.Description,
                surveyStatus = survey.Status,
                surveyType,
                surveyTypeLabel = surveyType == "PreCourse" ? "Pre-course" : surveyType == "PostCourse" ? "Post-course" : null,
                courseId = course?.Id,
                courseTitle = course?.Title,
                organization = await ResolveOrganizationName(scope.OrganisationId),
                generatedAt = DateTime.UtcNow,
                responsesAreAnonymous,
                summary = new
                {
                    totalResponses,
                    uniqueRespondents
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating survey report summary for survey {SurveyId}", surveyId);
            return StatusCode(500, new { error = "Failed to generate survey summary", details = ex.Message });
        }
    }

    [HttpGet("surveys/{surveyId:long}/analytics")]
    public async Task<IActionResult> GetSurveyReportAnalytics(
        long surveyId,
        [FromQuery] string? courseId,
        [FromQuery] string? surveyType,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        try
        {
            var scope = await GetUserScope();
            if (!await CanAccessSurveyForReportAsync(surveyId, scope))
                return NotFound(new { error = "Survey not found" });

            var survey = await _context.Surveys.AsNoTracking()
                .Include(s => s.Questions)
                .FirstOrDefaultAsync(s => s.Id == surveyId && !s.IsDeleted);
            if (survey == null)
                return NotFound(new { error = "Survey not found" });

            Course? course = null;
            if (!string.IsNullOrWhiteSpace(courseId))
            {
                course = await GetAccessibleCourseForSurveyReportAsync(courseId, scope);
                if (course == null)
                    return NotFound(new { error = "Course not found" });
                if (!IsSurveyLinkedToCourse(course, surveyId, surveyType))
                    return BadRequest(new { error = "Survey is not linked to the selected course" });
            }

            var filteredResponses = await ApplySurveyResponseFilters(
                BuildScopedSurveyResponsesQuery(scope),
                surveyId,
                courseId,
                surveyType,
                startDate,
                endDate,
                search: null)
                .Include(sr => sr.User)
                .ToListAsync();

            var responseMetaById = filteredResponses.ToDictionary(
                sr => sr.Id,
                sr => new SurveyResponseMeta
                {
                    UserName = $"{sr.User?.FirstName} {sr.User?.LastName}".Trim() is { Length: > 0 } name
                        ? name
                        : "Unknown User",
                    UserEmail = sr.User?.Email,
                    SubmittedAt = sr.SubmittedAt
                });

            var filteredResponseIds = filteredResponses.Select(sr => sr.Id).ToList();
            var questionResponses = filteredResponseIds.Count == 0
                ? new List<SurveyQuestionResponse>()
                : await ApplySurveyQuestionResponseVisibilityFilter(
                        _context.SurveyQuestionResponses.AsNoTracking()
                            .Include(qr => qr.SurveyQuestion)
                            .Where(qr => qr.SurveyQuestion != null
                                && qr.SurveyQuestion.SurveyId == surveyId
                                && filteredResponseIds.Contains(qr.SurveyResponseId)))
                    .ToListAsync();

            var analytics = BuildQuestionAnalytics(
                FilterSurveyQuestionsForReportViewer(survey.Questions ?? Enumerable.Empty<SurveyQuestion>()),
                questionResponses,
                responseMetaById,
                AreSurveyResponsesAnonymous());

            return Ok(new
            {
                surveyId = survey.Id,
                surveyTitle = survey.Title,
                surveyType,
                surveyTypeLabel = surveyType == "PreCourse" ? "Pre-course" : surveyType == "PostCourse" ? "Post-course" : null,
                courseId = course?.Id,
                courseTitle = course?.Title,
                organization = await ResolveOrganizationName(scope.OrganisationId),
                generatedAt = DateTime.UtcNow,
                responsesAreAnonymous = AreSurveyResponsesAnonymous(),
                totalResponses = filteredResponses.Count,
                questionAnalytics = analytics
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating survey report analytics for survey {SurveyId}", surveyId);
            return StatusCode(500, new { error = "Failed to generate survey analytics", details = ex.Message });
        }
    }

    [HttpGet("surveys/{surveyId:long}/responses")]
    public async Task<IActionResult> GetSurveyReportResponses(
        long surveyId,
        [FromQuery] string? courseId,
        [FromQuery] string? surveyType,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? search,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? sortBy = "submittedAt",
        [FromQuery] string? sortDirection = "desc")
    {
        try
        {
            pageNumber = Math.Max(pageNumber, 1);
            pageSize = Math.Clamp(pageSize, 1, 500);

            var scope = await GetUserScope();
            if (!await CanAccessSurveyForReportAsync(surveyId, scope))
                return NotFound(new { error = "Survey not found" });

            if (!string.IsNullOrWhiteSpace(courseId))
            {
                var course = await GetAccessibleCourseForSurveyReportAsync(courseId, scope);
                if (course == null)
                    return NotFound(new { error = "Course not found" });
                if (!IsSurveyLinkedToCourse(course, surveyId, surveyType))
                    return BadRequest(new { error = "Survey is not linked to the selected course" });
            }

            var responsesQuery = ApplySurveyResponseFilters(
                BuildScopedSurveyResponsesQuery(scope),
                surveyId,
                courseId,
                surveyType,
                startDate,
                endDate,
                search);

            var totalRows = await responsesQuery.CountAsync();
            var totalPages = totalRows == 0 ? 1 : (int)Math.Ceiling(totalRows / (double)pageSize);

            var normalizedSortBy = (sortBy ?? "submittedAt").Trim().ToLowerInvariant();
            var descending = !string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase);
            var responsesAreAnonymous = AreSurveyResponsesAnonymous();
            if (responsesAreAnonymous && normalizedSortBy == "username")
                normalizedSortBy = "submittedat";

            var joinedQuery =
                from sr in responsesQuery
                join user in _context.Users.AsNoTracking() on sr.UserId equals user.Id into userJoin
                from user in userJoin.DefaultIfEmpty()
                join course in _context.Courses.AsNoTracking() on sr.CourseId equals course.Id into courseJoin
                from course in courseJoin.DefaultIfEmpty()
                select new
                {
                    sr,
                    userName = ((user.FirstName ?? string.Empty) + " " + (user.LastName ?? string.Empty)).Trim(),
                    userEmail = user.Email,
                    courseName = course != null ? course.Title : string.Empty
                };

            var orderedQuery = normalizedSortBy switch
            {
                "username" => descending
                    ? joinedQuery.OrderByDescending(x => x.userName)
                    : joinedQuery.OrderBy(x => x.userName),
                "coursename" => descending
                    ? joinedQuery.OrderByDescending(x => x.courseName)
                    : joinedQuery.OrderBy(x => x.courseName),
                "surveytype" => descending
                    ? joinedQuery.OrderByDescending(x => x.sr.SurveyType)
                    : joinedQuery.OrderBy(x => x.sr.SurveyType),
                _ => descending
                    ? joinedQuery.OrderByDescending(x => x.sr.SubmittedAt)
                    : joinedQuery.OrderBy(x => x.sr.SubmittedAt)
            };

            var page = await orderedQuery
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var responseIds = page.Select(x => x.sr.Id).ToList();
            var questionResponses = responseIds.Count == 0
                ? new List<SurveyQuestionResponse>()
                : await ApplySurveyQuestionResponseVisibilityFilter(
                        _context.SurveyQuestionResponses.AsNoTracking()
                            .Include(qr => qr.SurveyQuestion)
                            .Where(qr => responseIds.Contains(qr.SurveyResponseId)))
                    .ToListAsync();

            var answersByResponseId = questionResponses
                .GroupBy(qr => qr.SurveyResponseId)
                .ToDictionary(g => g.Key, g => g.ToList());

            var rows = page.Select(x =>
            {
                answersByResponseId.TryGetValue(x.sr.Id, out var answers);
                return new
                {
                    responseId = x.sr.Id,
                    userName = responsesAreAnonymous
                        ? "Anonymous"
                        : (string.IsNullOrWhiteSpace(x.userName) ? "Unknown User" : x.userName),
                    userEmail = responsesAreAnonymous ? null : x.userEmail,
                    courseName = string.IsNullOrWhiteSpace(x.courseName) ? null : x.courseName,
                    courseId = x.sr.CourseId,
                    surveyType = x.sr.SurveyType,
                    submittedAt = x.sr.SubmittedAt,
                    answers = (answers ?? new List<SurveyQuestionResponse>())
                        .OrderBy(qr => qr.SurveyQuestion?.OrderIndex ?? 0)
                        .Select(qr => new
                        {
                            questionId = qr.SurveyQuestionId,
                            questionText = qr.SurveyQuestion?.QuestionText,
                            questionType = qr.SurveyQuestion?.QuestionType,
                            answerText = qr.AnswerText,
                            selectedOptions = string.IsNullOrEmpty(qr.SelectedOptions)
                                ? new List<string>()
                                : JsonSerializer.Deserialize<List<string>>(qr.SelectedOptions),
                            ratingValue = qr.RatingValue
                        })
                        .ToList()
                };
            }).ToList();

            return Ok(new
            {
                responsesAreAnonymous,
                responses = rows,
                pagination = new
                {
                    pageNumber,
                    pageSize,
                    totalResponses = totalRows,
                    totalPages,
                    hasPreviousPage = pageNumber > 1,
                    hasNextPage = pageNumber < totalPages
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating survey report responses for survey {SurveyId}", surveyId);
            return StatusCode(500, new { error = "Failed to generate survey responses", details = ex.Message });
        }
    }

    #endregion
}
