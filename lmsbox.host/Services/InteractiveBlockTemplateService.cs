using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace lmsBox.Server.Services;

public class InteractiveBlockTemplateService : IInteractiveBlockTemplateService
{
    private static readonly JsonSerializerOptions CamelCaseJson = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    private static readonly HashSet<string> TemplateBlockTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "carousel",
        "accordion",
        "questionnaire",
        "text",
        "video"
    };

    private readonly IInteractiveBlockPromptService _promptService;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<InteractiveBlockTemplateService> _logger;

    public InteractiveBlockTemplateService(
        IInteractiveBlockPromptService promptService,
        IWebHostEnvironment environment,
        ILogger<InteractiveBlockTemplateService> logger)
    {
        _promptService = promptService;
        _environment = environment;
        _logger = logger;
    }

    public bool SupportsTemplate(string blockType)
        => !string.IsNullOrWhiteSpace(blockType) && TemplateBlockTypes.Contains(blockType);

    public (string Html, string CompletionRuleJson) Render(string blockType, long blockId, string formPayloadJson)
    {
        if (!SupportsTemplate(blockType))
        {
            throw new ArgumentException($"No fixed template for block type: {blockType}");
        }

        _promptService.ValidateFormPayload(blockType, formPayloadJson);

        return blockType.ToLowerInvariant() switch
        {
            "carousel" => RenderCarousel(blockId, formPayloadJson),
            "accordion" => RenderAccordion(blockId, formPayloadJson),
            "questionnaire" => RenderQuestionnaire(blockId, formPayloadJson),
            "text" => RenderText(blockId, formPayloadJson),
            "video" => RenderVideo(blockId, formPayloadJson),
            _ => throw new ArgumentException($"No fixed template for block type: {blockType}")
        };
    }

    private (string Html, string CompletionRuleJson) RenderCarousel(long blockId, string formPayloadJson)
    {
        var root = JsonNode.Parse(formPayloadJson) as JsonObject
            ?? throw new ArgumentException("Invalid form payload JSON.");

        var slidesArray = root["slides"] as JsonArray
            ?? throw new ArgumentException("At least one slide is required.");

        var slides = new List<object>();
        foreach (var node in slidesArray)
        {
            var slide = node as JsonObject;
            slides.Add(new
            {
                title = slide?["title"]?.GetValue<string>()?.Trim() ?? "",
                body = slide?["body"]?.GetValue<string>()?.Trim() ?? "",
                imageUrl = slide?["imageUrl"]?.GetValue<string>()?.Trim() ?? ""
            });
        }

        var html = FillTemplate(
            "carousel.html",
            blockId,
            ("{{SLIDES_JSON}}", EscapeForScriptJson(JsonSerializer.Serialize(slides, CamelCaseJson))));

        var completionRule = JsonSerializer.Serialize(new
        {
            type = "carousel",
            requireAllSlidesViewed = true
        });

        return (html, completionRule);
    }

    private (string Html, string CompletionRuleJson) RenderAccordion(long blockId, string formPayloadJson)
    {
        var root = JsonNode.Parse(formPayloadJson) as JsonObject
            ?? throw new ArgumentException("Invalid form payload JSON.");

        var panelsArray = root["panels"] as JsonArray
            ?? throw new ArgumentException("At least one panel is required.");

        var panels = new List<object>();
        foreach (var node in panelsArray)
        {
            var panel = node as JsonObject;
            panels.Add(new
            {
                title = panel?["title"]?.GetValue<string>()?.Trim() ?? "",
                body = panel?["body"]?.GetValue<string>()?.Trim() ?? ""
            });
        }

        var html = FillTemplate(
            "accordion.html",
            blockId,
            ("{{PANELS_JSON}}", EscapeForScriptJson(JsonSerializer.Serialize(panels, CamelCaseJson))));

        var completionRule = JsonSerializer.Serialize(new
        {
            type = "accordion",
            requireAllPanelsExpanded = true
        });

        return (html, completionRule);
    }

    private (string Html, string CompletionRuleJson) RenderQuestionnaire(long blockId, string formPayloadJson)
    {
        var root = JsonNode.Parse(formPayloadJson) as JsonObject
            ?? throw new ArgumentException("Invalid form payload JSON.");

        var questionsArray = root["questions"] as JsonArray
            ?? throw new ArgumentException("At least one question is required.");

        var showFeedback = root["showFeedbackPerQuestion"]?.GetValue<bool>() ?? true;
        var questions = new List<object>();

        foreach (var node in questionsArray)
        {
            var q = node as JsonObject;
            var type = q?["type"]?.GetValue<string>()?.Trim().ToLowerInvariant() ?? "single";
            var options = new List<object>();

            if (q?["options"] is JsonArray optionsArray)
            {
                foreach (var optNode in optionsArray)
                {
                    var opt = optNode as JsonObject;
                    options.Add(new
                    {
                        text = opt?["text"]?.GetValue<string>()?.Trim() ?? "",
                        isCorrect = opt?["isCorrect"]?.GetValue<bool>() ?? false
                    });
                }
            }

            questions.Add(new
            {
                text = q?["text"]?.GetValue<string>()?.Trim() ?? "",
                type,
                options
            });
        }

        var payload = new
        {
            showFeedbackPerQuestion = showFeedback,
            questions
        };

        var html = FillTemplate(
            "questionnaire.html",
            blockId,
            ("{{QUESTIONNAIRE_JSON}}", EscapeForScriptJson(JsonSerializer.Serialize(payload, CamelCaseJson))));

        var completionRule = JsonSerializer.Serialize(new
        {
            type = "questionnaire",
            requireAllAnswered = true
        });

        return (html, completionRule);
    }

    private (string Html, string CompletionRuleJson) RenderText(long blockId, string formPayloadJson)
    {
        var root = JsonNode.Parse(formPayloadJson) as JsonObject
            ?? throw new ArgumentException("Invalid form payload JSON.");

        var heading = root["heading"]?.GetValue<string>()?.Trim() ?? "";
        var subheading = root["subheading"]?.GetValue<string>()?.Trim() ?? "";
        var body = root["body"]?.GetValue<string>()?.Trim() ?? "";
        var showContinue = root["showContinueButton"]?.GetValue<bool>() ?? true;

        var html = FillTemplate(
            "text.html",
            blockId,
            ("{{HEADING}}", HtmlEncode(heading)),
            ("{{SUBHEADING}}", HtmlEncode(subheading)),
            ("{{BODY}}", HtmlEncode(body)),
            ("{{SHOW_CONTINUE}}", showContinue ? "1" : "0"));

        var completionRule = JsonSerializer.Serialize(new
        {
            type = "text",
            requireContinue = showContinue
        });

        return (html, completionRule);
    }

    private (string Html, string CompletionRuleJson) RenderVideo(long blockId, string formPayloadJson)
    {
        var root = JsonNode.Parse(formPayloadJson) as JsonObject
            ?? throw new ArgumentException("Invalid form payload JSON.");

        var title = root["title"]?.GetValue<string>()?.Trim() ?? "";
        var description = root["description"]?.GetValue<string>()?.Trim()
            ?? root["caption"]?.GetValue<string>()?.Trim()
            ?? "";
        var videoUrl = root["videoUrl"]?.GetValue<string>()?.Trim() ?? "";

        if (string.IsNullOrWhiteSpace(videoUrl))
        {
            throw new ArgumentException("Video URL is required before generating this block.");
        }

        if (!Uri.TryCreate(videoUrl, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw new ArgumentException("Video URL must be a valid http or https URL.");
        }

        var html = FillTemplate(
            "video.html",
            blockId,
            ("{{TITLE}}", HtmlEncode(title)),
            ("{{DESCRIPTION}}", HtmlEncode(description)),
            ("{{VIDEO_URL}}", HtmlEncodeAttribute(videoUrl)));

        var completionRule = JsonSerializer.Serialize(new
        {
            type = "video",
            requireWatchedToEnd = true
        });

        return (html, completionRule);
    }

    private static string HtmlEncode(string value)
        => System.Net.WebUtility.HtmlEncode(value);

    private static string HtmlEncodeAttribute(string value)
        => System.Net.WebUtility.HtmlEncode(value).Replace("\"", "&quot;", StringComparison.Ordinal);

    private string FillTemplate(string fileName, long blockId, params (string Placeholder, string Value)[] replacements)
    {
        var html = LoadTemplate(fileName)
            .Replace("{{BLOCK_ID}}", blockId.ToString(), StringComparison.Ordinal);

        foreach (var (placeholder, value) in replacements)
        {
            html = html.Replace(placeholder, value, StringComparison.Ordinal);
        }

        return html;
    }

    private static string EscapeForScriptJson(string json)
        => json.Replace("<", "\\u003c").Replace(">", "\\u003e").Replace("&", "\\u0026");

    private string LoadTemplate(string fileName)
    {
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "Templates", "InteractiveBlocks", fileName),
            Path.Combine(_environment.ContentRootPath, "Templates", "InteractiveBlocks", fileName),
            Path.Combine(Directory.GetCurrentDirectory(), "Templates", "InteractiveBlocks", fileName)
        };

        foreach (var path in candidates)
        {
            if (File.Exists(path))
            {
                return File.ReadAllText(path, Encoding.UTF8);
            }
        }

        var assembly = typeof(InteractiveBlockTemplateService).Assembly;
        var resourceName = assembly.GetManifestResourceNames()
            .FirstOrDefault(n =>
                n.EndsWith($"Templates.InteractiveBlocks.{fileName}", StringComparison.OrdinalIgnoreCase)
                || n.EndsWith($"InteractiveBlocks.{fileName}", StringComparison.OrdinalIgnoreCase));

        if (resourceName != null)
        {
            using var stream = assembly.GetManifestResourceStream(resourceName);
            if (stream != null)
            {
                using var reader = new StreamReader(stream, Encoding.UTF8);
                return reader.ReadToEnd();
            }
        }

        _logger.LogError(
            "Interactive block template '{FileName}' not found. Searched paths: {Paths}. Resources: {Resources}",
            fileName,
            string.Join("; ", candidates),
            string.Join(", ", assembly.GetManifestResourceNames()));

        throw new FileNotFoundException(
            $"Interactive block template '{fileName}' was not found.",
            fileName);
    }
}
