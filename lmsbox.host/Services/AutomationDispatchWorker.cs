using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace lmsBox.Server.Services;

public class AutomationDispatchWorker : BackgroundService
{
    private static readonly Regex TemplateVariableRegex = new(@"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", RegexOptions.Compiled);

    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<AutomationDispatchWorker> _logger;

    public AutomationDispatchWorker(IServiceProvider serviceProvider, ILogger<AutomationDispatchWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Automation dispatch worker started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await QueueNotificationDispatches(stoppingToken);
                await QueueReminderDispatches(stoppingToken);
                await ProcessPendingDispatches(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Automation dispatch worker cycle failed");
            }

            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }

        _logger.LogInformation("Automation dispatch worker stopped");
    }

    private async Task QueueNotificationDispatches(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var tasks = await context.AutomationTasks
            .AsNoTracking()
            .Where(t => t.Status == "Published" && t.Type == "Notification")
            .OrderBy(t => t.Id)
            .Take(100)
            .ToListAsync(stoppingToken);

        if (!tasks.Any()) return;

        foreach (var task in tasks)
        {
            if (stoppingToken.IsCancellationRequested) break;

            try
            {
                var pathwayIds = await ResolveTargetPathwayIds(context, task, stoppingToken);
                if (!pathwayIds.Any())
                {
                    continue;
                }

                var publishedAtUtc = task.PublishedAtUtc ?? task.CreatedAtUtc;
                var assignments = await context.LearnerPathwayProgresses
                    .AsNoTracking()
                    .Where(lp => lp.EnrolledAt >= publishedAtUtc && pathwayIds.Contains(lp.LearningPathwayId))
                    .Join(
                        context.LearningPathways.AsNoTracking(),
                        lp => lp.LearningPathwayId,
                        p => p.Id,
                        (lp, p) => new
                        {
                            lp.UserId,
                            lp.EnrolledAt,
                            lp.IsCompleted,
                            lp.CompletedAt,
                            PathwayId = lp.LearningPathwayId,
                            PathwayProgressPercent = lp.ProgressPercent,
                            PathwayName = p.Title
                        })
                    .Distinct()
                    .ToListAsync(stoppingToken);

                if (!assignments.Any())
                {
                    continue;
                }

                var candidateUserIds = assignments.Select(a => a.UserId).Distinct().ToList();
                var recipients = await context.Users
                    .AsNoTracking()
                    .Where(u => candidateUserIds.Contains(u.Id) &&
                                u.OrganisationID == task.OrganisationId &&
                                u.ActiveStatus != 0 &&
                                !string.IsNullOrWhiteSpace(u.Email))
                    .Select(u => new { u.Id, Email = u.Email!, u.FirstName, u.LastName })
                    .ToDictionaryAsync(u => u.Id, u => new { u.Email, u.FirstName, u.LastName }, stoppingToken);

                if (!recipients.Any())
                {
                    continue;
                }

                var dispatches = new List<lmsbox.domain.Models.AutomationDispatch>();

                foreach (var assignment in assignments)
                {
                    if (!recipients.TryGetValue(assignment.UserId, out var recipient))
                    {
                        continue;
                    }

                    var variables = BuildTemplateVariables(
                        recipient.FirstName,
                        recipient.LastName,
                        assignment.EnrolledAt,
                        assignment.PathwayName,
                        ResolvePathwayStatus(assignment.IsCompleted, assignment.PathwayProgressPercent));
                    var subjectSnapshot = RenderTemplate(task.EmailSubject, variables);
                    var bodySnapshot = RenderTemplate(task.EmailBodyHtml, variables);

                    if (string.Equals(task.EventKey, "LearningPathwayAssignment", StringComparison.OrdinalIgnoreCase))
                    {
                        var scheduledForUtc = ResolveNotificationSchedule(task, assignment.EnrolledAt);
                        var idempotencyKey = $"task:{task.Id}:event:assignment:user:{assignment.UserId}:pathway:{assignment.PathwayId}:assigned:{assignment.EnrolledAt:yyyyMMddHHmmss}";

                        dispatches.Add(new lmsbox.domain.Models.AutomationDispatch
                        {
                            AutomationTaskId = task.Id,
                            OrganisationId = task.OrganisationId,
                            UserId = assignment.UserId,
                            RecipientEmail = recipient.Email,
                            SubjectSnapshot = subjectSnapshot,
                            BodySnapshot = bodySnapshot,
                            ScheduledForUtc = scheduledForUtc,
                            Status = "Pending",
                            Attempts = 0,
                            IdempotencyKey = idempotencyKey,
                            CreatedAtUtc = DateTime.UtcNow,
                            UpdatedAtUtc = DateTime.UtcNow
                        });
                    }

                    if (string.Equals(task.EventKey, "LearningPathwayCompletion", StringComparison.OrdinalIgnoreCase) &&
                        assignment.IsCompleted &&
                        assignment.CompletedAt.HasValue)
                    {
                        var scheduledForUtc = ResolveNotificationSchedule(task, assignment.CompletedAt.Value);
                        var idempotencyKey = $"task:{task.Id}:event:completion:user:{assignment.UserId}:pathway:{assignment.PathwayId}:completed:{assignment.CompletedAt.Value:yyyyMMddHHmmss}";

                        dispatches.Add(new lmsbox.domain.Models.AutomationDispatch
                        {
                            AutomationTaskId = task.Id,
                            OrganisationId = task.OrganisationId,
                            UserId = assignment.UserId,
                            RecipientEmail = recipient.Email,
                            SubjectSnapshot = subjectSnapshot,
                            BodySnapshot = bodySnapshot,
                            ScheduledForUtc = scheduledForUtc,
                            Status = "Pending",
                            Attempts = 0,
                            IdempotencyKey = idempotencyKey,
                            CreatedAtUtc = DateTime.UtcNow,
                            UpdatedAtUtc = DateTime.UtcNow
                        });
                    }
                }

                await AddDispatchesIfNotExists(context, dispatches, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to queue notification dispatches for task {TaskId}", task.Id);
            }
        }
    }

    private async Task QueueReminderDispatches(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var tasks = await context.AutomationTasks
            .AsNoTracking()
            .Where(t => t.Status == "Published" && t.Type == "Reminder")
            .OrderBy(t => t.Id)
            .Take(100)
            .ToListAsync(stoppingToken);

        if (!tasks.Any()) return;

        var nowUtc = DateTime.UtcNow;

        foreach (var task in tasks)
        {
            if (stoppingToken.IsCancellationRequested) break;
            if (!task.DaysAfterAssignment.HasValue || task.DaysAfterAssignment.Value <= 0) continue;

            try
            {
                var pathwayIds = await ResolveTargetPathwayIds(context, task, stoppingToken);
                if (!pathwayIds.Any()) continue;

                var assignments = await context.LearnerPathwayProgresses
                    .AsNoTracking()
                    .Where(lp => pathwayIds.Contains(lp.LearningPathwayId))
                    .Join(
                        context.LearningPathways.AsNoTracking(),
                        lp => lp.LearningPathwayId,
                        p => p.Id,
                        (lp, p) => new
                        {
                            lp.UserId,
                            AssignedAtUtc = lp.EnrolledAt,
                            PathwayId = lp.LearningPathwayId,
                            PathwayProgressPercent = lp.ProgressPercent,
                            PathwayCompleted = lp.IsCompleted,
                            PathwayName = p.Title
                        })
                    .Distinct()
                    .ToListAsync(stoppingToken);

                if (!assignments.Any()) continue;

                var dueAssignments = assignments
                    .Where(a => a.AssignedAtUtc.AddDays(task.DaysAfterAssignment!.Value) <= nowUtc)
                    .ToList();

                if (!dueAssignments.Any()) continue;

                var userIds = dueAssignments.Select(a => a.UserId).Distinct().ToList();
                var recipients = await context.Users
                    .AsNoTracking()
                    .Where(u => userIds.Contains(u.Id) &&
                                u.OrganisationID == task.OrganisationId &&
                                u.ActiveStatus != 0 &&
                                !string.IsNullOrWhiteSpace(u.Email))
                    .Select(u => new { u.Id, Email = u.Email!, u.FirstName, u.LastName })
                    .ToDictionaryAsync(u => u.Id, u => new { u.Email, u.FirstName, u.LastName }, stoppingToken);

                if (!recipients.Any()) continue;

                var dispatches = new List<lmsbox.domain.Models.AutomationDispatch>();
                var scheduledForUtc = ResolveStandardDailyScheduleUtc(nowUtc);

                foreach (var assignment in dueAssignments)
                {
                    if (!recipients.TryGetValue(assignment.UserId, out var recipient))
                    {
                        continue;
                    }

                    var matches = task.EventKey switch
                    {
                        "NotStarted" => !assignment.PathwayCompleted && assignment.PathwayProgressPercent <= 0,
                        "InProgress" => !assignment.PathwayCompleted && assignment.PathwayProgressPercent > 0,
                        "NotCompleted" => !assignment.PathwayCompleted,
                        _ => false
                    };

                    if (!matches)
                    {
                        continue;
                    }

                    var pathwayStatus = task.EventKey switch
                    {
                        "NotStarted" => "Not Started",
                        "InProgress" => "In Progress",
                        "NotCompleted" => "Not Completed",
                        _ => ResolvePathwayStatus(assignment.PathwayCompleted, assignment.PathwayProgressPercent)
                    };

                    var variables = BuildTemplateVariables(
                        recipient.FirstName,
                        recipient.LastName,
                        assignment.AssignedAtUtc,
                        assignment.PathwayName,
                        pathwayStatus);
                    var subjectSnapshot = RenderTemplate(task.EmailSubject, variables);
                    var bodySnapshot = RenderTemplate(task.EmailBodyHtml, variables);

                    var idempotencyKey = $"task:{task.Id}:reminder:{task.EventKey}:user:{assignment.UserId}:pathway:{assignment.PathwayId}:day:{assignment.AssignedAtUtc.AddDays(task.DaysAfterAssignment.Value):yyyyMMdd}";
                    dispatches.Add(new lmsbox.domain.Models.AutomationDispatch
                    {
                        AutomationTaskId = task.Id,
                        OrganisationId = task.OrganisationId,
                        UserId = assignment.UserId,
                        RecipientEmail = recipient.Email,
                        SubjectSnapshot = subjectSnapshot,
                        BodySnapshot = bodySnapshot,
                        ScheduledForUtc = scheduledForUtc,
                        Status = "Pending",
                        Attempts = 0,
                        IdempotencyKey = idempotencyKey,
                        CreatedAtUtc = DateTime.UtcNow,
                        UpdatedAtUtc = DateTime.UtcNow
                    });
                }

                await AddDispatchesIfNotExists(context, dispatches, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to queue reminder dispatches for task {TaskId}", task.Id);
            }
        }
    }

    private static DateTime ResolveNotificationSchedule(lmsbox.domain.Models.AutomationTask task, DateTime referenceUtc)
    {
        if (string.Equals(task.ScheduleMode, "StandardNotification", StringComparison.OrdinalIgnoreCase))
        {
            return ResolveStandardDailyScheduleUtc();
        }

        return DateTime.UtcNow;
    }

    private static DateTime ResolveStandardDailyScheduleUtc(DateTime? referenceUtc = null)
    {
        var now = referenceUtc ?? DateTime.UtcNow;
        var nextRun = new DateTime(now.Year, now.Month, now.Day, 8, 45, 0, DateTimeKind.Utc);
        if (now >= nextRun)
        {
            nextRun = nextRun.AddDays(1);
        }

        return nextRun;
    }

    private static async Task<List<string>> ResolveTargetPathwayIds(ApplicationDbContext context, lmsbox.domain.Models.AutomationTask task, CancellationToken stoppingToken)
    {
        var pathwayIds = ParseArray(task.AudienceFilterJson);
        if (pathwayIds.Any())
        {
            return pathwayIds;
        }

        var courseIds = ParseArray(task.CourseFilterJson);
        if (!courseIds.Any())
        {
            return new List<string>();
        }

        return await context.PathwayCourses
            .AsNoTracking()
            .Where(pc => courseIds.Contains(pc.CourseId))
            .Select(pc => pc.LearningPathwayId)
            .Distinct()
            .ToListAsync(stoppingToken);
    }

    private static async Task AddDispatchesIfNotExists(ApplicationDbContext context, List<lmsbox.domain.Models.AutomationDispatch> dispatches, CancellationToken stoppingToken)
    {
        if (!dispatches.Any()) return;

        var keys = dispatches.Select(d => d.IdempotencyKey).Distinct().ToList();
        var existingKeys = await context.AutomationDispatches
            .AsNoTracking()
            .Where(d => keys.Contains(d.IdempotencyKey))
            .Select(d => d.IdempotencyKey)
            .ToListAsync(stoppingToken);

        var existingSet = new HashSet<string>(existingKeys);
        var toInsert = dispatches.Where(d => !existingSet.Contains(d.IdempotencyKey)).ToList();

        if (!toInsert.Any()) return;

        context.AutomationDispatches.AddRange(toInsert);
        await context.SaveChangesAsync(stoppingToken);
    }

    private static List<string> ParseArray(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new List<string>();
        try
        {
            var values = JsonSerializer.Deserialize<List<string>>(json);
            return values?.Where(v => !string.IsNullOrWhiteSpace(v)).Distinct().ToList() ?? new List<string>();
        }
        catch
        {
            return new List<string>();
        }
    }

    private static Dictionary<string, string> BuildTemplateVariables(
        string firstName,
        string? lastName,
        DateTime assignmentDateUtc,
        string pathwayName,
        string pathwayStatus)
    {
        var fullName = string.Join(" ", new[] { firstName?.Trim(), lastName?.Trim() }
            .Where(v => !string.IsNullOrWhiteSpace(v)));

        var assignmentDate = assignmentDateUtc.ToString("yyyy-MM-dd");
        var recipientName = string.IsNullOrWhiteSpace(fullName) ? "Learner" : fullName;

        return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["recipient_name"] = recipientName,
            ["assignment_date"] = assignmentDate,
            ["pathway_assignment_date"] = assignmentDate,
            ["pathway_status"] = pathwayStatus,
            ["current_pathway_status"] = pathwayStatus,
            ["pathway_name"] = pathwayName
        };
    }

    private static string ResolvePathwayStatus(bool isCompleted, int progressPercent)
    {
        if (isCompleted) return "Completed";
        if (progressPercent > 0) return "In Progress";
        return "Not Started";
    }

    private static string RenderTemplate(string? template, IReadOnlyDictionary<string, string> variables)
    {
        if (string.IsNullOrEmpty(template)) return string.Empty;

        return TemplateVariableRegex.Replace(template, match =>
        {
            var key = match.Groups[1].Value;
            return variables.TryGetValue(key, out var value) ? value : match.Value;
        });
    }

    private async Task ProcessPendingDispatches(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();

        var nowUtc = DateTime.UtcNow;
        var pending = await context.AutomationDispatches
            .Where(d =>
                d.Status == "Pending" &&
                d.ScheduledForUtc <= nowUtc &&
                d.AutomationTask != null &&
                d.AutomationTask.Status == "Published" &&
                d.User != null &&
                d.User.ActiveStatus != 0)
            .OrderBy(d => d.ScheduledForUtc)
            .ThenBy(d => d.Id)
            .Take(50)
            .ToListAsync(stoppingToken);

        if (!pending.Any()) return;

        foreach (var dispatch in pending)
        {
            if (stoppingToken.IsCancellationRequested) break;

            try
            {
                dispatch.Status = "Processing";
                dispatch.UpdatedAtUtc = DateTime.UtcNow;
                await context.SaveChangesAsync(stoppingToken);

                await emailService.SendEmailAsync(
                    dispatch.RecipientEmail,
                    dispatch.SubjectSnapshot,
                    dispatch.BodySnapshot);

                dispatch.Status = "Sent";
                dispatch.SentAtUtc = DateTime.UtcNow;
                dispatch.UpdatedAtUtc = DateTime.UtcNow;
                await context.SaveChangesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                dispatch.Attempts += 1;
                dispatch.LastError = ex.Message;
                dispatch.UpdatedAtUtc = DateTime.UtcNow;

                if (dispatch.Attempts >= 3)
                {
                    dispatch.Status = "Failed";
                }
                else
                {
                    dispatch.Status = "Pending";
                    dispatch.ScheduledForUtc = DateTime.UtcNow.AddMinutes(Math.Pow(2, dispatch.Attempts));
                }

                await context.SaveChangesAsync(stoppingToken);
                _logger.LogError(ex, "Failed sending automation dispatch {DispatchId}", dispatch.Id);
            }
        }
    }
}
