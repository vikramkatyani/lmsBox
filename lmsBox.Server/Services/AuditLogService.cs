using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;

namespace lmsBox.Server.Services;

public class AuditLogService : IAuditLogService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AuditLogService> _logger;

    public AuditLogService(ApplicationDbContext context, ILogger<AuditLogService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task LogUserLogin(string userId, string userName, string email)
    {
        var auditLog = new AuditLog
        {
            Action = $"User Login: {userName}",
            PerformedBy = $"{userName} ({email})",
            PerformedAt = DateTime.UtcNow,
            Details = $"User ID: {userId}, Email: {email}"
        };
        
        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Logged user login for {UserId}", userId);
    }

    public async Task LogUserCreation(string performedByUserId, string performedByName, string createdUserId, string createdUserName, string createdUserEmail)
    {
        var auditLog = new AuditLog
        {
            Action = $"User Created: {createdUserName}",
            PerformedBy = performedByName,
            PerformedAt = DateTime.UtcNow,
            Details = $"Created User ID: {createdUserId}, Name: {createdUserName}, Email: {createdUserEmail}, Created By: {performedByUserId}"
        };
        
        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Logged user creation: {CreatedUserId} by {PerformedByUserId}", createdUserId, performedByUserId);
    }

    public async Task LogCourseCreation(string userId, string userName, string courseId, string courseTitle)
    {
        var auditLog = new AuditLog
        {
            Action = $"Course Created: {courseTitle}",
            PerformedBy = userName,
            PerformedAt = DateTime.UtcNow,
            Details = $"Course ID: {courseId}, Title: {courseTitle}, Created By User ID: {userId}"
        };
        
        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Logged course creation: {CourseId} by {UserId}", courseId, userId);
    }

    public async Task LogCourseUpdate(string userId, string userName, string courseId, string courseTitle)
    {
        var auditLog = new AuditLog
        {
            Action = $"Course Updated: {courseTitle}",
            PerformedBy = userName,
            PerformedAt = DateTime.UtcNow,
            Details = $"Course ID: {courseId}, Title: {courseTitle}, Updated By User ID: {userId}"
        };
        
        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Logged course update: {CourseId} by {UserId}", courseId, userId);
    }

    public async Task LogCourseDelete(string userId, string userName, string courseId, string courseTitle, string details)
    {
        var auditLog = new AuditLog
        {
            Action = $"Course Deleted: {courseTitle}",
            PerformedBy = userName,
            PerformedAt = DateTime.UtcNow,
            Details = details
        };
        
        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Logged course deletion: {CourseId} by {UserId}", courseId, userId);
    }

    public async Task LogLessonCreation(string userId, string userName, string lessonId, string lessonTitle, string courseId, string courseTitle)
    {
        var auditLog = new AuditLog
        {
            Action = $"Lesson Created: {lessonTitle}",
            PerformedBy = userName,
            PerformedAt = DateTime.UtcNow,
            Details = $"Lesson ID: {lessonId}, Title: {lessonTitle}, Course ID: {courseId}, Course: {courseTitle}, Created By User ID: {userId}"
        };
        
        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Logged lesson creation: {LessonId} in course {CourseId} by {UserId}", lessonId, courseId, userId);
    }

    public async Task LogLessonUpdate(string userId, string userName, string lessonId, string lessonTitle)
    {
        var auditLog = new AuditLog
        {
            Action = $"Lesson Updated: {lessonTitle}",
            PerformedBy = userName,
            PerformedAt = DateTime.UtcNow,
            Details = $"Lesson ID: {lessonId}, Title: {lessonTitle}, Updated By User ID: {userId}"
        };
        
        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Logged lesson update: {LessonId} by {UserId}", lessonId, userId);
    }

    public async Task LogLessonDelete(string userId, string userName, string lessonId, string lessonTitle)
    {
        var auditLog = new AuditLog
        {
            Action = $"Lesson Deleted: {lessonTitle}",
            PerformedBy = userName,
            PerformedAt = DateTime.UtcNow,
            Details = $"Lesson ID: {lessonId}, Title: {lessonTitle}, Deleted By User ID: {userId}"
        };
        
        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Logged lesson deletion: {LessonId} by {UserId}", lessonId, userId);
    }

    public async Task LogPathwayCreation(string userId, string userName, string pathwayId, string pathwayName)
    {
        var auditLog = new AuditLog
        {
            Action = $"Learning Pathway Created: {pathwayName}",
            PerformedBy = userName,
            PerformedAt = DateTime.UtcNow,
            Details = $"Pathway ID: {pathwayId}, Name: {pathwayName}, Created By User ID: {userId}"
        };
        
        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Logged pathway creation: {PathwayId} by {UserId}", pathwayId, userId);
    }

    public async Task LogPathwayUpdate(string userId, string userName, string pathwayId, string pathwayName)
    {
        var auditLog = new AuditLog
        {
            Action = $"Learning Pathway Updated: {pathwayName}",
            PerformedBy = userName,
            PerformedAt = DateTime.UtcNow,
            Details = $"Pathway ID: {pathwayId}, Name: {pathwayName}, Updated By User ID: {userId}"
        };
        
        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Logged pathway update: {PathwayId} by {UserId}", pathwayId, userId);
    }

    public async Task LogPathwayDelete(string userId, string userName, string pathwayId, string pathwayName)
    {
        var auditLog = new AuditLog
        {
            Action = $"Learning Pathway Deleted: {pathwayName}",
            PerformedBy = userName,
            PerformedAt = DateTime.UtcNow,
            Details = $"Pathway ID: {pathwayId}, Name: {pathwayName}, Deleted By User ID: {userId}"
        };
        
        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Logged pathway deletion: {PathwayId} by {UserId}", pathwayId, userId);
    }

    public async Task LogCourseToPathwayMapping(string userId, string userName, string pathwayId, string pathwayName, string courseId, string courseTitle)
    {
        var auditLog = new AuditLog
        {
            Action = $"Course Mapped to Pathway: {courseTitle} → {pathwayName}",
            PerformedBy = userName,
            PerformedAt = DateTime.UtcNow,
            Details = $"Course ID: {courseId}, Course: {courseTitle}, Pathway ID: {pathwayId}, Pathway: {pathwayName}, Mapped By User ID: {userId}"
        };
        
        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Logged course to pathway mapping: Course {CourseId} to Pathway {PathwayId} by {UserId}", courseId, pathwayId, userId);
    }

    public async Task LogCourseFromPathwayRemoval(string userId, string userName, string pathwayId, string pathwayName, string courseId, string courseTitle)
    {
        var auditLog = new AuditLog
        {
            Action = $"Course Removed from Pathway: {courseTitle} ← {pathwayName}",
            PerformedBy = userName,
            PerformedAt = DateTime.UtcNow,
            Details = $"Course ID: {courseId}, Course: {courseTitle}, Pathway ID: {pathwayId}, Pathway: {pathwayName}, Removed By User ID: {userId}"
        };
        
        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Logged course removal from pathway: Course {CourseId} from Pathway {PathwayId} by {UserId}", courseId, pathwayId, userId);
    }

    public async Task LogLearnerToPathwayMapping(string userId, string userName, string pathwayId, string pathwayName, string learnerId, string learnerName)
    {
        var auditLog = new AuditLog
        {
            Action = $"Learner Assigned to Pathway: {learnerName} → {pathwayName}",
            PerformedBy = userName,
            PerformedAt = DateTime.UtcNow,
            Details = $"Learner ID: {learnerId}, Learner: {learnerName}, Pathway ID: {pathwayId}, Pathway: {pathwayName}, Assigned By User ID: {userId}"
        };
        
        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Logged learner to pathway assignment: Learner {LearnerId} to Pathway {PathwayId} by {UserId}", learnerId, pathwayId, userId);
    }

    public async Task LogLearnerFromPathwayRemoval(string userId, string userName, string pathwayId, string pathwayName, string learnerId, string learnerName)
    {
        var auditLog = new AuditLog
        {
            Action = $"Learner Removed from Pathway: {learnerName} ← {pathwayName}",
            PerformedBy = userName,
            PerformedAt = DateTime.UtcNow,
            Details = $"Learner ID: {learnerId}, Learner: {learnerName}, Pathway ID: {pathwayId}, Pathway: {pathwayName}, Removed By User ID: {userId}"
        };
        
        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Logged learner removal from pathway: Learner {LearnerId} from Pathway {PathwayId} by {UserId}", learnerId, pathwayId, userId);
    }

    public async Task LogCustomAction(string action, string performedBy, string? details = null)
    {
        var auditLog = new AuditLog
        {
            Action = action,
            PerformedBy = performedBy,
            PerformedAt = DateTime.UtcNow,
            Details = details
        };
        
        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Logged custom action: {Action}", action);
    }
}
