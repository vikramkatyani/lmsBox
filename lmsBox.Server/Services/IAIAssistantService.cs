using lmsBox.Server.Models;

namespace lmsBox.Server.Services;

public interface IAIAssistantService
{
    Task<string> GenerateCourseOutlineAsync(string topic, string? level, string? duration);
    Task<string> GenerateLessonContentAsync(string lessonTitle, string? context);
    Task<string> GenerateQuizQuestionsAsync(string topic, int questionCount, string? difficulty);
    Task<string> ImproveContentAsync(string content, string improvementType);
    Task<string> ChatAsync(string message, string? context);
}
