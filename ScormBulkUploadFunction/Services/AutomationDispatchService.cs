using lmsbox.infrastructure.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ScormBulkUploadFunction.Services;

public class AutomationDispatchService : IAutomationDispatchService
{
    private const int BatchSize = 50;
    private static readonly Regex TemplateVariableRegex = new(@"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", RegexOptions.Compiled);

    private readonly string _connectionString;
    private readonly IAutomationEmailSender _emailSender;
    private readonly ILogger<AutomationDispatchService> _logger;
    private readonly ApplicationDbContext _dbContext;

    public AutomationDispatchService(
        IConfiguration configuration,
        IAutomationEmailSender emailSender,
        ILogger<AutomationDispatchService> logger,
        ApplicationDbContext dbContext)
    {
        _connectionString = configuration["SqlConnectionString"]
            ?? throw new InvalidOperationException("SqlConnectionString is not configured for automation dispatch function.");
        _emailSender = emailSender;
        _logger = logger;
        _dbContext = dbContext;
    }

    public async Task<AutomationDispatchCycleResult> ProcessPendingDispatchesAsync()
    {
        await QueueNotificationDispatchesAsync();
        await QueueReminderDispatchesAsync();

        var result = new AutomationDispatchCycleResult();
        var nowUtc = DateTime.UtcNow;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        var pendingDispatches = await ClaimPendingDispatchesAsync(connection, nowUtc);
        result.PickedCount = pendingDispatches.Count;

        if (pendingDispatches.Count == 0)
        {
            return result;
        }

        foreach (var dispatch in pendingDispatches)
        {
            try
            {
                await _emailSender.SendAsync(dispatch.RecipientEmail, dispatch.SubjectSnapshot, dispatch.BodySnapshot);
                await MarkSentAsync(connection, dispatch.Id);
                result.SentCount += 1;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed sending automation dispatch {DispatchId}", dispatch.Id);
                await MarkFailedOrRetryAsync(connection, dispatch.Id, dispatch.Attempts, ex.Message);
                result.FailedCount += 1;
            }
        }

        return result;
    }

    private async Task QueueNotificationDispatchesAsync()
    {
        var tasks = await _dbContext.AutomationTasks
            .AsNoTracking()
            .Where(t => t.Status == "Published" && t.Type == "Notification")
            .OrderBy(t => t.Id)
            .Take(100)
            .ToListAsync();

        if (!tasks.Any()) return;

        foreach (var task in tasks)
        {
            try
            {
                var pathwayIds = await ResolveTargetPathwayIds(task);
                if (!pathwayIds.Any()) continue;

                var publishedAtUtc = task.PublishedAtUtc ?? task.CreatedAtUtc;
                var assignments = await _dbContext.LearnerPathwayProgresses
                    .AsNoTracking()
                    .Where(lp => lp.EnrolledAt >= publishedAtUtc && pathwayIds.Contains(lp.LearningPathwayId))
                    .Join(
                        _dbContext.LearningPathways.AsNoTracking(),
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
                    .ToListAsync();

                if (!assignments.Any()) continue;

                var candidateUserIds = assignments.Select(a => a.UserId).Distinct().ToList();
                var recipients = await _dbContext.Users
                    .AsNoTracking()
                    .Where(u => candidateUserIds.Contains(u.Id) &&
                                u.OrganisationID == task.OrganisationId &&
                                u.ActiveStatus != 0 &&
                                !string.IsNullOrWhiteSpace(u.Email))
                    .Select(u => new { u.Id, Email = u.Email!, u.FirstName, u.LastName })
                    .ToDictionaryAsync(u => u.Id, u => new { u.Email, u.FirstName, u.LastName });

                if (!recipients.Any()) continue;

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
                        var scheduledForUtc = ResolveNotificationSchedule(task);
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
                        var scheduledForUtc = ResolveNotificationSchedule(task);
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

                await AddDispatchesIfNotExists(dispatches);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to queue notification dispatches for task {TaskId}", task.Id);
            }
        }
    }

    private async Task QueueReminderDispatchesAsync()
    {
        var tasks = await _dbContext.AutomationTasks
            .AsNoTracking()
            .Where(t => t.Status == "Published" && t.Type == "Reminder")
            .OrderBy(t => t.Id)
            .Take(100)
            .ToListAsync();

        if (!tasks.Any()) return;

        var nowUtc = DateTime.UtcNow;

        foreach (var task in tasks)
        {
            if (!task.DaysAfterAssignment.HasValue || task.DaysAfterAssignment.Value <= 0) continue;

            try
            {
                var pathwayIds = await ResolveTargetPathwayIds(task);
                if (!pathwayIds.Any()) continue;

                var assignments = await _dbContext.LearnerPathwayProgresses
                    .AsNoTracking()
                    .Where(lp => pathwayIds.Contains(lp.LearningPathwayId))
                    .Join(
                        _dbContext.LearningPathways.AsNoTracking(),
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
                    .ToListAsync();

                if (!assignments.Any()) continue;

                var dueAssignments = assignments
                    .Where(a => a.AssignedAtUtc.AddDays(task.DaysAfterAssignment!.Value) <= nowUtc)
                    .ToList();

                if (!dueAssignments.Any()) continue;

                var userIds = dueAssignments.Select(a => a.UserId).Distinct().ToList();
                var recipients = await _dbContext.Users
                    .AsNoTracking()
                    .Where(u => userIds.Contains(u.Id) &&
                                u.OrganisationID == task.OrganisationId &&
                                u.ActiveStatus != 0 &&
                                !string.IsNullOrWhiteSpace(u.Email))
                    .Select(u => new { u.Id, Email = u.Email!, u.FirstName, u.LastName })
                    .ToDictionaryAsync(u => u.Id, u => new { u.Email, u.FirstName, u.LastName });

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

                await AddDispatchesIfNotExists(dispatches);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to queue reminder dispatches for task {TaskId}", task.Id);
            }
        }
    }

    private async Task<List<string>> ResolveTargetPathwayIds(lmsbox.domain.Models.AutomationTask task)
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

        return await _dbContext.PathwayCourses
            .AsNoTracking()
            .Where(pc => courseIds.Contains(pc.CourseId))
            .Select(pc => pc.LearningPathwayId)
            .Distinct()
            .ToListAsync();
    }

    private async Task AddDispatchesIfNotExists(List<lmsbox.domain.Models.AutomationDispatch> dispatches)
    {
        if (!dispatches.Any()) return;

        var keys = dispatches.Select(d => d.IdempotencyKey).Distinct().ToList();
        var existingKeys = await _dbContext.AutomationDispatches
            .AsNoTracking()
            .Where(d => keys.Contains(d.IdempotencyKey))
            .Select(d => d.IdempotencyKey)
            .ToListAsync();

        var existingSet = new HashSet<string>(existingKeys);
        var toInsert = dispatches.Where(d => !existingSet.Contains(d.IdempotencyKey)).ToList();

        if (!toInsert.Any()) return;

        _dbContext.AutomationDispatches.AddRange(toInsert);
        await _dbContext.SaveChangesAsync();
    }

    public async Task<AutomationDispatchHealthSummary> GetHealthSummaryAsync()
    {
        const string summarySql = @"
SELECT
    SUM(CASE WHEN d.Status = 'Pending' THEN 1 ELSE 0 END) AS PendingCount,
    SUM(CASE WHEN d.Status = 'Pending' AND d.ScheduledForUtc <= SYSUTCDATETIME() THEN 1 ELSE 0 END) AS DueNowCount,
    SUM(CASE WHEN d.Status = 'Processing' THEN 1 ELSE 0 END) AS ProcessingCount,
    SUM(CASE WHEN d.Status = 'Failed' THEN 1 ELSE 0 END) AS FailedCount,
    SUM(CASE WHEN d.Status = 'Sent' AND d.SentAtUtc >= DATEADD(HOUR, -24, SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS SentLast24Hours,
    SUM(CASE WHEN d.Status = 'Failed' AND d.UpdatedAtUtc >= DATEADD(HOUR, -24, SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS FailedLast24Hours,
    MIN(CASE WHEN d.Status = 'Pending' THEN d.ScheduledForUtc END) AS NextScheduledForUtc
FROM AutomationDispatches d
INNER JOIN AutomationTasks t ON t.Id = d.AutomationTaskId
WHERE t.Status = 'Published';";

        const string typeBreakdownSql = @"
SELECT
    t.Type,
    SUM(CASE WHEN d.Status = 'Pending' THEN 1 ELSE 0 END) AS PendingCount,
    SUM(CASE WHEN d.Status = 'Pending' AND d.ScheduledForUtc <= SYSUTCDATETIME() THEN 1 ELSE 0 END) AS DueNowCount,
    SUM(CASE WHEN d.Status = 'Processing' THEN 1 ELSE 0 END) AS ProcessingCount,
    SUM(CASE WHEN d.Status = 'Failed' THEN 1 ELSE 0 END) AS FailedCount,
    SUM(CASE WHEN d.Status = 'Sent' AND d.SentAtUtc >= DATEADD(HOUR, -24, SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS SentLast24Hours
FROM AutomationDispatches d
INNER JOIN AutomationTasks t ON t.Id = d.AutomationTaskId
WHERE t.Status = 'Published'
GROUP BY t.Type
ORDER BY t.Type;";

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        await using var command = new SqlCommand(summarySql, connection);
        await using var reader = await command.ExecuteReaderAsync();

        if (!await reader.ReadAsync())
        {
            return new AutomationDispatchHealthSummary { GeneratedAtUtc = DateTime.UtcNow };
        }

        var summary = new AutomationDispatchHealthSummary
        {
            GeneratedAtUtc = DateTime.UtcNow,
            PendingCount = reader.IsDBNull(0) ? 0 : reader.GetInt32(0),
            DueNowCount = reader.IsDBNull(1) ? 0 : reader.GetInt32(1),
            ProcessingCount = reader.IsDBNull(2) ? 0 : reader.GetInt32(2),
            FailedCount = reader.IsDBNull(3) ? 0 : reader.GetInt32(3),
            SentLast24Hours = reader.IsDBNull(4) ? 0 : reader.GetInt32(4),
            FailedLast24Hours = reader.IsDBNull(5) ? 0 : reader.GetInt32(5),
            NextScheduledForUtc = reader.IsDBNull(6) ? null : reader.GetDateTime(6)
        };

        await reader.CloseAsync();

        await using var breakdownCommand = new SqlCommand(typeBreakdownSql, connection);
        await using var breakdownReader = await breakdownCommand.ExecuteReaderAsync();
        while (await breakdownReader.ReadAsync())
        {
            summary.TypeBreakdown.Add(new AutomationDispatchTypeHealth
            {
                Type = breakdownReader.IsDBNull(0) ? "Unknown" : breakdownReader.GetString(0),
                PendingCount = breakdownReader.IsDBNull(1) ? 0 : breakdownReader.GetInt32(1),
                DueNowCount = breakdownReader.IsDBNull(2) ? 0 : breakdownReader.GetInt32(2),
                ProcessingCount = breakdownReader.IsDBNull(3) ? 0 : breakdownReader.GetInt32(3),
                FailedCount = breakdownReader.IsDBNull(4) ? 0 : breakdownReader.GetInt32(4),
                SentLast24Hours = breakdownReader.IsDBNull(5) ? 0 : breakdownReader.GetInt32(5)
            });
        }

        return summary;
    }

    private async Task<List<PendingDispatch>> ClaimPendingDispatchesAsync(SqlConnection connection, DateTime nowUtc)
    {
        const string sql = @"
;WITH cte AS (
    SELECT TOP (@batchSize) d.Id
    FROM AutomationDispatches d WITH (UPDLOCK, READPAST, ROWLOCK)
    INNER JOIN AutomationTasks t ON t.Id = d.AutomationTaskId
    LEFT JOIN AspNetUsers u ON u.Id = d.UserId
    WHERE d.Status = 'Pending'
      AND d.ScheduledForUtc <= @nowUtc
      AND t.Status = 'Published'
      AND (
           d.UserId IS NULL
           OR (u.Id IS NOT NULL AND u.ActiveStatus <> 0)
      )
    ORDER BY d.ScheduledForUtc, d.Id
)
UPDATE d
SET d.Status = 'Processing',
    d.UpdatedAtUtc = @nowUtc
OUTPUT INSERTED.Id, INSERTED.RecipientEmail, INSERTED.SubjectSnapshot, INSERTED.BodySnapshot, INSERTED.Attempts
FROM AutomationDispatches d
INNER JOIN cte ON cte.Id = d.Id;";

        var items = new List<PendingDispatch>();
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@batchSize", BatchSize);
        command.Parameters.AddWithValue("@nowUtc", nowUtc);

        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            items.Add(new PendingDispatch
            {
                Id = reader.GetInt64(0),
                RecipientEmail = reader.GetString(1),
                SubjectSnapshot = reader.GetString(2),
                BodySnapshot = reader.GetString(3),
                Attempts = reader.GetInt32(4)
            });
        }

        return items;
    }

    private static async Task MarkSentAsync(SqlConnection connection, long dispatchId)
    {
        const string sql = @"
UPDATE AutomationDispatches
SET Status = 'Sent',
    SentAtUtc = @nowUtc,
    UpdatedAtUtc = @nowUtc
WHERE Id = @id;";

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@id", dispatchId);
        command.Parameters.AddWithValue("@nowUtc", DateTime.UtcNow);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task MarkFailedOrRetryAsync(SqlConnection connection, long dispatchId, int attemptsBeforeSend, string error)
    {
        var attempts = attemptsBeforeSend + 1;
        var nowUtc = DateTime.UtcNow;

        if (attempts >= 3)
        {
            const string failSql = @"
UPDATE AutomationDispatches
SET Status = 'Failed',
    Attempts = @attempts,
    LastError = @lastError,
    UpdatedAtUtc = @nowUtc
WHERE Id = @id;";

            await using var command = new SqlCommand(failSql, connection);
            command.Parameters.AddWithValue("@id", dispatchId);
            command.Parameters.AddWithValue("@attempts", attempts);
            command.Parameters.AddWithValue("@lastError", Truncate(error, 2000));
            command.Parameters.AddWithValue("@nowUtc", nowUtc);
            await command.ExecuteNonQueryAsync();
            return;
        }

        var retryAt = nowUtc.AddMinutes(Math.Pow(2, attempts));

        const string retrySql = @"
UPDATE AutomationDispatches
SET Status = 'Pending',
    Attempts = @attempts,
    LastError = @lastError,
    ScheduledForUtc = @scheduledForUtc,
    UpdatedAtUtc = @nowUtc
WHERE Id = @id;";

        await using var retryCommand = new SqlCommand(retrySql, connection);
        retryCommand.Parameters.AddWithValue("@id", dispatchId);
        retryCommand.Parameters.AddWithValue("@attempts", attempts);
        retryCommand.Parameters.AddWithValue("@lastError", Truncate(error, 2000));
        retryCommand.Parameters.AddWithValue("@scheduledForUtc", retryAt);
        retryCommand.Parameters.AddWithValue("@nowUtc", nowUtc);
        await retryCommand.ExecuteNonQueryAsync();
    }

    private static DateTime ResolveNotificationSchedule(lmsbox.domain.Models.AutomationTask task)
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

    private static string Truncate(string value, int maxLength)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        return value.Length <= maxLength ? value : value[..maxLength];
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

    private sealed class PendingDispatch
    {
        public long Id { get; set; }
        public string RecipientEmail { get; set; } = string.Empty;
        public string SubjectSnapshot { get; set; } = string.Empty;
        public string BodySnapshot { get; set; } = string.Empty;
        public int Attempts { get; set; }
    }
}
