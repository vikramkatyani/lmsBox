using OpenAI.Chat;
using System.ClientModel;
using System.Text.Json;

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

    public async Task<string> GenerateInteractiveBlockHtmlAsync(string prompt)
    {
        if (_chatClient == null)
        {
            throw new InvalidOperationException("OpenAI API key is not configured. AI Assistant features are unavailable.");
        }

        try
        {
            var systemPrompt = "You are an expert instructional designer and front-end developer. Generate accessible, mobile-friendly interactive learning HTML fragments for an LMS. Use British English.";
            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(systemPrompt),
                new UserChatMessage(prompt)
            };

            var response = await _chatClient.CompleteChatAsync(messages);
            var content = response.Value.Content[0].Text;

            if (content.StartsWith("```html"))
            {
                content = content.Substring(7);
            }
            else if (content.StartsWith("```"))
            {
                content = content.Substring(3);
            }

            if (content.EndsWith("```"))
            {
                content = content.Substring(0, content.Length - 3);
            }

            return content.Trim();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating interactive block HTML");
            throw;
        }
    }

    public async Task<IReadOnlyList<GeneratedQuestionnaireQuestion>> GenerateQuestionnaireMcqsAsync(
        string contentDescription,
        int questionCount)
    {
        if (_chatClient == null)
        {
            throw new InvalidOperationException("OpenAI API key is not configured. AI Assistant features are unavailable.");
        }

        if (string.IsNullOrWhiteSpace(contentDescription))
        {
            throw new ArgumentException("Content description is required.");
        }

        if (questionCount < 1 || questionCount > InteractiveLessonConstants.EffectiveMaxAiQuestionnaireQuestions)
        {
            throw new ArgumentException(
                $"Question count must be between 1 and {InteractiveLessonConstants.EffectiveMaxAiQuestionnaireQuestions}.");
        }

        try
        {
            var systemPrompt =
                "You are an expert instructional designer. Create clear multiple-choice questions for workplace learning questionnaires. Use British English.";
            var userPrompt = $$"""
Based on this content description, create exactly {{questionCount}} multiple-choice questions (single correct answer each):

{{contentDescription.Trim()}}

Return ONLY a JSON array with this structure (no markdown, no commentary):
[
  {
    "question": "Question text",
    "options": [
      { "text": "Option A", "isCorrect": false },
      { "text": "Option B", "isCorrect": true },
      { "text": "Option C", "isCorrect": false },
      { "text": "Option D", "isCorrect": false }
    ]
  }
]

Rules:
- Each question must have exactly 4 options.
- Each question must have exactly one option with isCorrect true.
- Questions must be relevant to the content description.
- Avoid trick questions; keep language plain and professional.
""";

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(systemPrompt),
                new UserChatMessage(userPrompt)
            };

            var response = await _chatClient.CompleteChatAsync(messages);
            var raw = StripMarkdownCodeFence(response.Value.Content[0].Text);
            return ParseGeneratedQuestionnaireMcqs(raw, questionCount);
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating questionnaire MCQs");
            throw;
        }
    }

    private static string StripMarkdownCodeFence(string content)
    {
        content = content.Trim();
        if (content.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
        {
            content = content[7..];
        }
        else if (content.StartsWith("```"))
        {
            content = content[3..];
        }

        if (content.EndsWith("```"))
        {
            content = content[..^3];
        }

        return content.Trim();
    }

    private static IReadOnlyList<GeneratedQuestionnaireQuestion> ParseGeneratedQuestionnaireMcqs(
        string rawJson,
        int expectedCount)
    {
        using var document = JsonDocument.Parse(rawJson);
        if (document.RootElement.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidOperationException("AI response was not a JSON array.");
        }

        var results = new List<GeneratedQuestionnaireQuestion>();
        foreach (var item in document.RootElement.EnumerateArray())
        {
            var text = item.TryGetProperty("question", out var questionEl)
                ? questionEl.GetString()
                : item.TryGetProperty("text", out var textEl) ? textEl.GetString() : null;

            if (string.IsNullOrWhiteSpace(text))
            {
                continue;
            }

            if (!item.TryGetProperty("options", out var optionsEl) || optionsEl.ValueKind != JsonValueKind.Array)
            {
                throw new InvalidOperationException("Each generated question must include options.");
            }

            var options = new List<GeneratedQuestionnaireOption>();
            foreach (var optionEl in optionsEl.EnumerateArray())
            {
                var optionText = optionEl.TryGetProperty("text", out var optionTextEl)
                    ? optionTextEl.GetString()
                    : null;
                if (string.IsNullOrWhiteSpace(optionText))
                {
                    continue;
                }

                var isCorrect = optionEl.TryGetProperty("isCorrect", out var isCorrectEl) && isCorrectEl.GetBoolean();
                options.Add(new GeneratedQuestionnaireOption
                {
                    Text = optionText.Trim(),
                    IsCorrect = isCorrect
                });
            }

            if (options.Count < 2)
            {
                throw new InvalidOperationException("Each generated question must have at least two options.");
            }

            if (options.Count(o => o.IsCorrect) != 1)
            {
                var firstIndex = options.FindIndex(o => o.IsCorrect);
                for (var i = 0; i < options.Count; i++)
                {
                    options[i].IsCorrect = i == Math.Max(0, firstIndex);
                }
                if (options.All(o => !o.IsCorrect))
                {
                    options[0].IsCorrect = true;
                }
            }

            results.Add(new GeneratedQuestionnaireQuestion
            {
                Text = text.Trim(),
                Type = "single",
                Options = options
            });
        }

        if (results.Count == 0)
        {
            throw new InvalidOperationException("AI did not return any valid questions.");
        }

        if (results.Count > expectedCount)
        {
            results = results.Take(expectedCount).ToList();
        }

        return results;
    }

    public async Task<IReadOnlyList<GeneratedCarouselSlide>> GenerateCarouselSlidesAsync(
        string contentDescription,
        int slideCount)
    {
        if (_chatClient == null)
        {
            throw new InvalidOperationException("OpenAI API key is not configured. AI Assistant features are unavailable.");
        }

        if (string.IsNullOrWhiteSpace(contentDescription))
        {
            throw new ArgumentException("Content description is required.");
        }

        if (slideCount < 1 || slideCount > InteractiveLessonConstants.MaxAiCarouselSlides)
        {
            throw new ArgumentException(
                $"Slide count must be between 1 and {InteractiveLessonConstants.MaxAiCarouselSlides}.");
        }

        try
        {
            var systemPrompt =
                "You are an expert instructional designer. Create concise carousel slides for workplace learning. Use British English.";
            var userPrompt = $$"""
Based on this content description, create exactly {{slideCount}} carousel slides:

{{contentDescription.Trim()}}

Return ONLY a JSON array with this structure (no markdown, no commentary):
[
  {
    "title": "Slide title",
    "body": "2-4 sentences of learner-facing content for this slide."
  }
]

Rules:
- Each slide must have a clear title and substantive body text.
- Spread the learning content logically across all slides in sequence.
- Keep language plain, professional, and suitable for adults in the workplace.
- Do not include image URLs; text only.
- Avoid repeating the same points across slides.
""";

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(systemPrompt),
                new UserChatMessage(userPrompt)
            };

            var response = await _chatClient.CompleteChatAsync(messages);
            var raw = StripMarkdownCodeFence(response.Value.Content[0].Text);
            return ParseGeneratedCarouselSlides(raw, slideCount);
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating carousel slides");
            throw;
        }
    }

    private static IReadOnlyList<GeneratedCarouselSlide> ParseGeneratedCarouselSlides(
        string rawJson,
        int expectedCount)
    {
        using var document = JsonDocument.Parse(rawJson);
        if (document.RootElement.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidOperationException("AI response was not a JSON array.");
        }

        var results = new List<GeneratedCarouselSlide>();
        foreach (var item in document.RootElement.EnumerateArray())
        {
            var title = item.TryGetProperty("title", out var titleEl) ? titleEl.GetString() : null;
            var body = item.TryGetProperty("body", out var bodyEl)
                ? bodyEl.GetString()
                : item.TryGetProperty("content", out var contentEl) ? contentEl.GetString() : null;

            if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(body))
            {
                continue;
            }

            results.Add(new GeneratedCarouselSlide
            {
                Title = title.Trim(),
                Body = body.Trim(),
                ImageUrl = string.Empty
            });
        }

        if (results.Count == 0)
        {
            throw new InvalidOperationException("AI did not return any valid slides.");
        }

        if (results.Count > expectedCount)
        {
            results = results.Take(expectedCount).ToList();
        }

        return results;
    }

    public async Task<IReadOnlyList<GeneratedAccordionPanel>> GenerateAccordionPanelsAsync(
        string contentDescription,
        int panelCount)
    {
        if (_chatClient == null)
        {
            throw new InvalidOperationException("OpenAI API key is not configured. AI Assistant features are unavailable.");
        }

        if (string.IsNullOrWhiteSpace(contentDescription))
        {
            throw new ArgumentException("Content description is required.");
        }

        if (panelCount < 1 || panelCount > InteractiveLessonConstants.MaxAiAccordionPanels)
        {
            throw new ArgumentException(
                $"Panel count must be between 1 and {InteractiveLessonConstants.MaxAiAccordionPanels}.");
        }

        try
        {
            var systemPrompt =
                "You are an expert instructional designer. Create clear accordion panels for workplace learning. Use British English.";
            var userPrompt = $$"""
Based on this content description, create exactly {{panelCount}} accordion panels:

{{contentDescription.Trim()}}

Return ONLY a JSON array with this structure (no markdown, no commentary):
[
  {
    "title": "Panel heading",
    "body": "2-4 sentences of learner-facing content for this panel."
  }
]

Rules:
- Each panel must have a concise title and substantive body text.
- Organise the learning content logically from first panel to last.
- Keep language plain, professional, and suitable for adults in the workplace.
- Avoid repeating the same points across panels.
""";

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(systemPrompt),
                new UserChatMessage(userPrompt)
            };

            var response = await _chatClient.CompleteChatAsync(messages);
            var raw = StripMarkdownCodeFence(response.Value.Content[0].Text);
            return ParseGeneratedAccordionPanels(raw, panelCount);
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating accordion panels");
            throw;
        }
    }

    private static IReadOnlyList<GeneratedAccordionPanel> ParseGeneratedAccordionPanels(
        string rawJson,
        int expectedCount)
    {
        using var document = JsonDocument.Parse(rawJson);
        if (document.RootElement.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidOperationException("AI response was not a JSON array.");
        }

        var results = new List<GeneratedAccordionPanel>();
        foreach (var item in document.RootElement.EnumerateArray())
        {
            var title = item.TryGetProperty("title", out var titleEl) ? titleEl.GetString() : null;
            var body = item.TryGetProperty("body", out var bodyEl)
                ? bodyEl.GetString()
                : item.TryGetProperty("content", out var contentEl) ? contentEl.GetString() : null;

            if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(body))
            {
                continue;
            }

            results.Add(new GeneratedAccordionPanel
            {
                Title = title.Trim(),
                Body = body.Trim()
            });
        }

        if (results.Count == 0)
        {
            throw new InvalidOperationException("AI did not return any valid panels.");
        }

        if (results.Count > expectedCount)
        {
            results = results.Take(expectedCount).ToList();
        }

        return results;
    }
}
