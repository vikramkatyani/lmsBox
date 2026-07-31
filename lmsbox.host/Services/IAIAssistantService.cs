using lmsBox.Server.Models;

namespace lmsBox.Server.Services;

public interface IAIAssistantService
{
    Task<string> GenerateCourseOutlineAsync(string topic, string? level, string? duration);
    Task<string> GenerateLessonContentAsync(string lessonTitle, string? context);
    Task<string> GenerateQuizQuestionsAsync(string topic, int questionCount, string? difficulty);
    Task<string> ImproveContentAsync(string content, string improvementType);
    Task<string> ChatAsync(string message, string? context);
    Task<string> LearnerCourseQueryAsync(string question, string courseTitle, string? lessonTitle, string? additionalContext);
    Task<string> GenerateInteractiveBlockHtmlAsync(string prompt);
    Task<IReadOnlyList<GeneratedQuestionnaireQuestion>> GenerateQuestionnaireMcqsAsync(string contentDescription, int questionCount);
    Task<IReadOnlyList<GeneratedCarouselSlide>> GenerateCarouselSlidesAsync(string contentDescription, int slideCount);
    Task<IReadOnlyList<GeneratedAccordionPanel>> GenerateAccordionPanelsAsync(string contentDescription, int panelCount);
}

public class GeneratedQuestionnaireQuestion
{
    public string Text { get; set; } = null!;
    public string Type { get; set; } = "single";
    public List<GeneratedQuestionnaireOption> Options { get; set; } = new();
}

public class GeneratedQuestionnaireOption
{
    public string Text { get; set; } = null!;
    public bool IsCorrect { get; set; }
}

public class GeneratedCarouselSlide
{
    public string Title { get; set; } = null!;
    public string Body { get; set; } = null!;
    public string ImageUrl { get; set; } = string.Empty;
}

public class GeneratedAccordionPanel
{
    public string Title { get; set; } = null!;
    public string Body { get; set; } = null!;
}
