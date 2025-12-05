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
            try
            {
                _chatClient = new ChatClient("gpt-4o", new ApiKeyCredential(apiKey));
                _logger.LogInformation("OpenAI ChatClient initialized successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to initialize OpenAI ChatClient");
                _chatClient = null!;
            }
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
            var systemPrompt = "You are an expert course designer. Generate a comprehensive course outline in JSON format. Use British English spelling and terminology throughout.";
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
            _logger.LogWarning("Attempted to generate lesson content but ChatClient is null");
            throw new InvalidOperationException("OpenAI API key is not configured. AI Assistant features are unavailable.");
        }

        try
        {
            _logger.LogInformation("Generating lesson content for: {LessonTitle}", lessonTitle);
            
            var systemPrompt = "You are an expert educator. Generate engaging lesson content as well-formatted HTML. Use British English spelling and terminology throughout.";
            var userPrompt = $@"Create detailed HTML content for a lesson titled: '{lessonTitle}'.
{(string.IsNullOrEmpty(context) ? "" : $"Additional context: {context}")}

Generate comprehensive lesson content with the following structure:

1. INTRODUCTION section with h2 heading
2. MAIN CONTENT with h3 subheadings and organized lists
3. KEY TAKEAWAYS with bullet points
4. ACTIVITIES/EXERCISES section

Format the response as clean, semantic HTML with:
- Use <h2> for section headings
- Use <h3> for subsection headings
- Use <p> for paragraphs
- Use <ul> and <li> for bullet points
- Use <ol> and <li> for numbered lists
- Use <strong> for emphasis
- Use <code> for code snippets if needed
- Add appropriate spacing with margins

Return ONLY the HTML content (no <html>, <head>, or <body> tags - just the content divs).
Include inline styles for better formatting (fonts, colors, spacing).";

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(systemPrompt),
                new UserChatMessage(userPrompt)
            };

            _logger.LogDebug("Calling OpenAI API...");
            var response = await _chatClient.CompleteChatAsync(messages);
            _logger.LogInformation("Successfully generated lesson content");
            
            var content = response.Value.Content[0].Text;
            
            // Remove markdown code block wrappers if present
            if (content.StartsWith("```html"))
            {
                content = content.Substring(7); // Remove ```html
            }
            else if (content.StartsWith("```"))
            {
                content = content.Substring(3); // Remove ```
            }
            
            if (content.EndsWith("```"))
            {
                content = content.Substring(0, content.Length - 3); // Remove trailing ```
            }
            
            return content.Trim();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating lesson content for: {LessonTitle}", lessonTitle);
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
            var systemPrompt = "You are an expert at creating educational quiz questions. Generate questions in JSON format. Use British English spelling and terminology throughout.";
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
            var systemPrompt = "You are an expert editor and content improver. Use British English spelling and terminology throughout.";
            var userPrompt = improvementType.ToLower() switch
            {
                "grammar" => $"Improve the grammar and spelling of this content while preserving its meaning. Use British English spelling:\n\n{content}",
                "clarity" => $"Improve the clarity and readability of this content using British English:\n\n{content}",
                "engagement" => $"Make this content more engaging and interesting using British English:\n\n{content}",
                "simplify" => $"Simplify this content to make it easier to understand, using British English:\n\n{content}",
                _ => $"Improve this content using British English:\n\n{content}"
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

Be concise, helpful, and practical in your responses. Use British English spelling and terminology throughout (e.g., 'organise' not 'organize', 'colour' not 'color', 'learnt' not 'learned').";

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

    public async Task<string> LearnerCourseQueryAsync(string question, string courseTitle, string? lessonTitle, string? additionalContext)
    {
        if (_chatClient == null)
        {
            throw new InvalidOperationException("OpenAI API key is not configured. AI Assistant features are unavailable.");
        }

        try
        {
            _logger.LogInformation("Processing learner query for course: {CourseTitle}, lesson: {LessonTitle}", courseTitle, lessonTitle ?? "N/A");

            var systemPrompt = @"You are a helpful AI learning assistant for students taking online courses. 
Your role is to:
- Answer questions about course content and concepts
- Clarify difficult topics and provide explanations
- Offer study tips and learning strategies
- Help with understanding lesson materials
- Provide additional context and examples to enhance learning

CRITICAL RULES - YOU MUST FOLLOW THESE STRICTLY:
1. ONLY answer questions that are directly related to the course content and lesson material provided below
2. If a question is NOT about the specific course/lesson content, politely redirect the learner: 'I can only help with questions about this specific course and lesson content. Please ask about the topics covered in your current lesson.'
3. DO NOT answer general knowledge questions, current events, or topics outside the course scope

IMPORTANT:
- Use British English spelling and terminology throughout (e.g., 'organise' not 'organize', 'colour' not 'color', 'learnt' not 'learned', 'summarise' not 'summarize')
- Be encouraging, patient, and supportive
- Keep answers clear, concise, and easy to understand
- Break down complex concepts into simpler parts
- Do NOT provide direct answers to quiz or assessment questions
- Instead, guide learners to understand the concepts so they can answer themselves
- Focus on helping learners understand 'why' and 'how', not just 'what'";

            var contextInfo = $"Course: {courseTitle}";
            if (!string.IsNullOrEmpty(lessonTitle))
            {
                contextInfo += $"\nLesson: {lessonTitle}";
            }
            if (!string.IsNullOrEmpty(additionalContext))
            {
                contextInfo += $"\nAdditional context: {additionalContext}";
            }

            var userPrompt = $"{contextInfo}\n\nLearner's question: {question}";

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(systemPrompt),
                new UserChatMessage(userPrompt)
            };

            var response = await _chatClient.CompleteChatAsync(messages);
            _logger.LogInformation("Successfully processed learner query");
            return response.Value.Content[0].Text;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing learner course query");
            throw;
        }
    }
}
