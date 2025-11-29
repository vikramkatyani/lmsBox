using OpenAI.Chat;
using System.ClientModel;

namespace lmsBox.Server.Services;

public class AIAssistantService : IAIAssistantService
{
    private readonly ChatClient _chatClient;
    private readonly ILogger<AIAssistantService> _logger;

    public AIAssistantService(IConfiguration configuration, ILogger<AIAssistantService> logger)
    {
        _logger = logger;
        var apiKey = configuration["OpenAI:ApiKey"];
        
        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogWarning("OpenAI API key is not configured. AI Assistant features will be unavailable.");
            _chatClient = null!; // Will be checked in methods
        }
        else
        {
            _chatClient = new ChatClient("gpt-4o", new ApiKeyCredential(apiKey));
        }
    }

    public async Task<string> GenerateCourseOutlineAsync(string topic, string? level, string? duration)
    {
        if (_chatClient == null)
        {
            throw new InvalidOperationException("OpenAI API key is not configured. AI Assistant features are unavailable.");
        }

        try
        {
            var systemPrompt = "You are an expert course designer. Generate a comprehensive course outline in JSON format.";
            var userPrompt = $@"Create a detailed course outline for the topic: '{topic}'.
Level: {level ?? "Beginner"}
Duration: {duration ?? "Not specified"}

Return a JSON object with this structure:
{{
  ""title"": ""Course Title"",
  ""shortDescription"": ""Brief 1-2 sentence summary"",
  ""longDescription"": ""Detailed description (2-3 paragraphs) covering what students will learn, prerequisites, and outcomes"",
  ""tags"": [""tag1"", ""tag2"", ""tag3""],
  ""lessons"": [
    {{
      ""title"": ""Lesson 1 Title"",
      ""description"": ""What this lesson covers"",
      ""duration"": ""30 minutes""
    }}
  ]
}}

Make the descriptions engaging and informative. Include 5-10 lessons depending on the topic complexity. Add 3-5 relevant tags that categorize the course topic.";

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(systemPrompt),
                new UserChatMessage(userPrompt)
            };

            var response = await _chatClient.CompleteChatAsync(messages);
            return response.Value.Content[0].Text;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating course outline");
            throw;
        }
    }

    public async Task<string> GenerateLessonContentAsync(string lessonTitle, string? context)
    {
        if (_chatClient == null)
        {
            throw new InvalidOperationException("OpenAI API key is not configured. AI Assistant features are unavailable.");
        }

        try
        {
            var systemPrompt = "You are an expert educator. Generate engaging lesson content in well-formatted plain text with clear structure.";
            var userPrompt = $@"Create detailed content for a lesson titled: '{lessonTitle}'.
{(string.IsNullOrEmpty(context) ? "" : $"Additional context: {context}")}

Generate comprehensive lesson content with the following structure:

INTRODUCTION
[Brief introduction to the topic and what learners will achieve]

MAIN CONTENT
[Core concepts organized with clear headings and bullet points]
- Use numbered lists for sequential steps
- Use bullet points for key concepts
- Include practical examples where relevant

KEY TAKEAWAYS
- [List 3-5 main points learners should remember]

ACTIVITIES/EXERCISES
[Suggested practice activities or discussion questions]

Format the response as clean, readable text with clear headings, proper spacing, and organized bullet points.
Do NOT use HTML tags. Use plain text formatting only.";

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(systemPrompt),
                new UserChatMessage(userPrompt)
            };

            var response = await _chatClient.CompleteChatAsync(messages);
            return response.Value.Content[0].Text;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating lesson content");
            throw;
        }
    }

    public async Task<string> GenerateQuizQuestionsAsync(string topic, int questionCount, string? difficulty)
    {
        if (_chatClient == null)
        {
            throw new InvalidOperationException("OpenAI API key is not configured. AI Assistant features are unavailable.");
        }

        try
        {
            var systemPrompt = "You are an expert at creating educational quiz questions. Generate questions in JSON format.";
            var userPrompt = $@"Create {questionCount} multiple-choice quiz questions about: '{topic}'.
Difficulty: {difficulty ?? "Medium"}

Return a JSON array with this structure:
[
  {{
    ""question"": ""Question text"",
    ""options"": [
      {{""text"": ""Option 1"", ""isCorrect"": false}},
      {{""text"": ""Option 2"", ""isCorrect"": true}},
      {{""text"": ""Option 3"", ""isCorrect"": false}},
      {{""text"": ""Option 4"", ""isCorrect"": false}}
    ],
    ""explanation"": ""Why the correct answer is correct""
  }}
]

Ensure each question has exactly one correct answer and provide clear explanations.";

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(systemPrompt),
                new UserChatMessage(userPrompt)
            };

            var response = await _chatClient.CompleteChatAsync(messages);
            return response.Value.Content[0].Text;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating quiz questions");
            throw;
        }
    }

    public async Task<string> ImproveContentAsync(string content, string improvementType)
    {
        if (_chatClient == null)
        {
            throw new InvalidOperationException("OpenAI API key is not configured. AI Assistant features are unavailable.");
        }

        try
        {
            var systemPrompt = "You are an expert editor and content improver.";
            var userPrompt = improvementType.ToLower() switch
            {
                "grammar" => $"Improve the grammar and spelling of this content while preserving its meaning:\n\n{content}",
                "clarity" => $"Improve the clarity and readability of this content:\n\n{content}",
                "engagement" => $"Make this content more engaging and interesting:\n\n{content}",
                "simplify" => $"Simplify this content to make it easier to understand:\n\n{content}",
                _ => $"Improve this content:\n\n{content}"
            };

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(systemPrompt),
                new UserChatMessage(userPrompt)
            };

            var response = await _chatClient.CompleteChatAsync(messages);
            return response.Value.Content[0].Text;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error improving content");
            throw;
        }
    }

    public async Task<string> ChatAsync(string message, string? context)
    {
        if (_chatClient == null)
        {
            throw new InvalidOperationException("OpenAI API key is not configured. AI Assistant features are unavailable.");
        }

        try
        {
            var systemPrompt = @"You are a helpful AI assistant for an LMS (Learning Management System). 
You help course creators and administrators with:
- Creating course content
- Designing quizzes and assessments
- Improving lesson materials
- Answering questions about course design and pedagogy

Be concise, helpful, and practical in your responses.";

            var userPrompt = string.IsNullOrEmpty(context) 
                ? message 
                : $"Context: {context}\n\nQuestion: {message}";

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(systemPrompt),
                new UserChatMessage(userPrompt)
            };

            var response = await _chatClient.CompleteChatAsync(messages);
            return response.Value.Content[0].Text;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in chat");
            throw;
        }
    }
}
