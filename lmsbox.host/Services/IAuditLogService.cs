namespace lmsBox.Server.Services;

public interface IAuditLogService
{
    Task LogUserLogin(string userId, string userName, string email);
    Task LogUserCreation(string performedByUserId, string performedByName, string createdUserId, string createdUserName, string createdUserEmail);
    Task LogCourseCreation(string userId, string userName, string courseId, string courseTitle);
    Task LogCourseUpdate(string userId, string userName, string courseId, string courseTitle);
    Task LogCourseDelete(string userId, string userName, string courseId, string courseTitle, string details);
    Task LogLessonCreation(string userId, string userName, string lessonId, string lessonTitle, string courseId, string courseTitle);
    Task LogLessonUpdate(string userId, string userName, string lessonId, string lessonTitle);
    Task LogLessonDelete(string userId, string userName, string lessonId, string lessonTitle);
    Task LogPathwayCreation(string userId, string userName, string pathwayId, string pathwayName);
    Task LogPathwayUpdate(string userId, string userName, string pathwayId, string pathwayName);
    Task LogPathwayDelete(string userId, string userName, string pathwayId, string pathwayName);
    Task LogCourseToPathwayMapping(string userId, string userName, string pathwayId, string pathwayName, string courseId, string courseTitle);
    Task LogCourseFromPathwayRemoval(string userId, string userName, string pathwayId, string pathwayName, string courseId, string courseTitle);
    Task LogLearnerToPathwayMapping(string userId, string userName, string pathwayId, string pathwayName, string learnerId, string learnerName);
    Task LogLearnerFromPathwayRemoval(string userId, string userName, string pathwayId, string pathwayName, string learnerId, string learnerName);
    Task LogLessonCompletion(string userId, string userName, string lessonId, string lessonTitle, string courseId, string courseTitle);
    Task LogCourseCompletion(string userId, string userName, string courseId, string courseTitle);
    Task LogCertificateIssuance(string userId, string userName, string courseId, string courseTitle, string certificateId);
    Task LogSurveyCreation(string userId, string userName, string surveyId, string surveyTitle);
    Task LogSurveyUpdate(string userId, string userName, string surveyId, string surveyTitle);
    Task LogSurveyDelete(string userId, string userName, string surveyId, string surveyTitle);
    Task LogContentPreview(string userId, string userName, string contentId, string contentTitle, string contentType);
    Task LogCustomAction(string action, string performedBy, string? details = null);
}
