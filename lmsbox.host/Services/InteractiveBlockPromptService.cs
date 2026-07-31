using System.Text.Json;
using System.Text.Json.Nodes;

namespace lmsBox.Server.Services;

public class InteractiveBlockPromptService : IInteractiveBlockPromptService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    private const string ThemeGuardrails = """
You MUST follow these LMSBOX design and technical rules:
- Use British English spelling.
- Colour palette (WCAG AA): primary navy #1b365d, text #0f172a, secondary text #334155, surfaces #f8fafc, borders #64748b, success #14532d, error #991b1b, on-primary white #ffffff.
- Do not use light grey (#64748b or lighter) for body or supporting content text. Secondary text must be at least #334155 on white/light backgrounds.
- Focus indicators must use a 3px solid #1b365d outline (or equivalent ≥3:1 contrast), not mint alone.
- Font sizes: body and interactive labels ≥16px (1rem); secondary status text ≥14px (0.875rem); headings ≥1.25rem. Line-height for body text ≥1.5.
- Font stack: system-ui, -apple-system, Segoe UI, Roboto, sans-serif.
- All interactions must work on touch devices (min 44px tap targets). No hover-only interactions.
- Return a single self-contained HTML fragment (no <html>, <head>, or <body> tags).
- Include inline <style> scoped to a root wrapper with class "lmsbox-interactive-block".
- Include inline <script> that runs on DOMContentLoaded.
- When completion criteria are met, call:
  window.parent.postMessage({ type: 'interactive-block-complete', blockId: BLOCK_ID }, '*');
  Replace BLOCK_ID with the numeric block id provided.
- Do not use external CDN scripts or stylesheets.
- Ensure accessible labels, focus states, and colour contrast meeting WCAG 2.2 AA (normal text ≥4.5:1, large text ≥3:1).
- Layout context: this block is embedded in a continuous vertical lesson page with other blocks above/below it. Do NOT create a page chrome, sidebar, block menu, or navigation between blocks.
- Do NOT wrap the root ".lmsbox-interactive-block" in a card, panel, or bordered box. No outer border, outline, box-shadow, or card-like background frame around the whole block.
- The root wrapper must use transparent or unobtrusive background (no full-bleed bordered container). Inner elements (inputs, buttons, accordion headers) may use subtle borders where needed for interaction.
- Prefer full-width content that sits flush in the lesson page without decorative outer framing.
""";

    public IReadOnlyList<InteractiveBlockTypeSchema> GetAvailableBlockTypes()
    {
        return new[]
        {
            GetQuestionnaireSchema(),
            GetCarouselSchema(),
            GetAccordionSchema(),
            GetTextSchema(),
            GetVideoSchema()
        };
    }

    public InteractiveBlockTypeSchema? GetBlockTypeSchema(string blockType)
    {
        return blockType.ToLowerInvariant() switch
        {
            "questionnaire" => GetQuestionnaireSchema(),
            "carousel" => GetCarouselSchema(),
            "accordion" => GetAccordionSchema(),
            "text" => GetTextSchema(),
            "video" => GetVideoSchema(),
            _ => null
        };
    }

    public void ValidateFormPayload(string blockType, string formPayloadJson)
    {
        if (string.IsNullOrWhiteSpace(formPayloadJson))
        {
            throw new ArgumentException("Form payload is required.");
        }

        var root = JsonNode.Parse(formPayloadJson) as JsonObject
            ?? throw new ArgumentException("Invalid form payload JSON.");

        switch (blockType.ToLowerInvariant())
        {
            case "questionnaire":
                ValidateQuestionnaire(root);
                break;
            case "carousel":
                ValidateCarousel(root);
                break;
            case "accordion":
                ValidateAccordion(root);
                break;
            case "text":
                ValidateText(root);
                break;
            case "video":
                ValidateVideo(root);
                break;
            default:
                throw new ArgumentException($"Unsupported block type: {blockType}");
        }
    }

    public (string CompletionRuleJson, string Prompt) BuildGenerationPrompt(
        string blockType,
        string blockTitle,
        string formPayloadJson,
        string? mediaAssetsJson)
    {
        ValidateFormPayload(blockType, formPayloadJson);

        return blockType.ToLowerInvariant() switch
        {
            "questionnaire" => BuildQuestionnairePrompt(blockTitle, formPayloadJson, mediaAssetsJson),
            "carousel" => BuildCarouselPrompt(blockTitle, formPayloadJson, mediaAssetsJson),
            "accordion" => BuildAccordionPrompt(blockTitle, formPayloadJson, mediaAssetsJson),
            "text" => throw new ArgumentException("Text blocks use a fixed template and do not support AI HTML generation."),
            "video" => throw new ArgumentException("Video blocks use a fixed template and do not support AI HTML generation."),
            _ => throw new ArgumentException($"Unsupported block type: {blockType}")
        };
    }

    private static InteractiveBlockTypeSchema GetQuestionnaireSchema()
    {
        return new InteractiveBlockTypeSchema
        {
            Type = "questionnaire",
            Label = "Questionnaire",
            Description = "A set of questions learners must answer to complete the block.",
            Fields = new List<InteractiveBlockFormField>
            {
                new()
                {
                    Name = "contentDescription",
                    Label = "Content description",
                    FieldType = "textarea",
                    Required = true,
                    HelpText = "Describe what learners should learn and the tone of the questions."
                },
                new()
                {
                    Name = "showFeedbackPerQuestion",
                    Label = "Show feedback after each question",
                    FieldType = "checkbox",
                    Required = false,
                    DefaultValue = true
                },
                new()
                {
                    Name = "questions",
                    Label = "Questions",
                    FieldType = "question-list",
                    Required = true,
                    HelpText = "Add one question per block. Types: single choice, multiple choice, or short text."
                }
            }
        };
    }

    private static void ValidateQuestionnaire(JsonObject root)
    {
        var description = root["contentDescription"]?.GetValue<string>();
        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Content description is required.");
        }

        if (root["questions"] is not JsonArray questions || questions.Count == 0)
        {
            throw new ArgumentException("At least one question is required.");
        }

        if (questions.Count > InteractiveLessonConstants.QuestionnaireQuestionsPerBlock)
        {
            throw new ArgumentException(
                $"A questionnaire can have at most {InteractiveLessonConstants.QuestionnaireQuestionsPerBlock} question(s).");
        }

        for (var i = 0; i < questions.Count; i++)
        {
            var q = questions[i] as JsonObject;
            var text = q?["text"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(text))
            {
                throw new ArgumentException($"Question {i + 1} text is required.");
            }

            var type = q?["type"]?.GetValue<string>()?.ToLowerInvariant() ?? "single";
            if (type is not ("single" or "multiple" or "text"))
            {
                throw new ArgumentException($"Question {i + 1} has an invalid type.");
            }

            if (type is "single" or "multiple")
            {
                if (q?["options"] is not JsonArray options || options.Count < 2)
                {
                    throw new ArgumentException($"Question {i + 1} must have at least two options.");
                }
            }
        }
    }

    private static (string CompletionRuleJson, string Prompt) BuildQuestionnairePrompt(
        string blockTitle,
        string formPayloadJson,
        string? mediaAssetsJson)
    {
        var completionRule = JsonSerializer.Serialize(new
        {
            type = "questionnaire",
            requireAllAnswered = true
        });

        var prompt = $"""
Create an interactive questionnaire block titled "{blockTitle}".

{ThemeGuardrails}

Block type: questionnaire
Completion rule: learner must answer every question before the block is marked complete.

Form data (use exactly as content source):
{formPayloadJson}

Media assets (optional images to embed):
{(string.IsNullOrWhiteSpace(mediaAssetsJson) ? "[]" : mediaAssetsJson)}

Requirements:
1. Render each question clearly with numbering.
2. For single-choice use radio buttons; multiple-choice use checkboxes; text questions use a text input or textarea.
3. If showFeedbackPerQuestion is true, reveal brief feedback after the learner submits each question.
4. Track answered state in JavaScript; when ALL questions are answered, post the completion message to the parent window.
5. Include a visible progress indicator (e.g. "3 of 5 answered").
6. Add a primary "Check answers" or "Continue" button where appropriate.
7. Use the LMSBOX theme colours in buttons and headings.
8. Do not add an outer border, card, or boxed container around the questionnaire — content should sit flush on the page.

Return ONLY the HTML fragment.
""";

        return (completionRule, prompt);
    }

    private static InteractiveBlockTypeSchema GetCarouselSchema()
    {
        return new InteractiveBlockTypeSchema
        {
            Type = "carousel",
            Label = "Carousel",
            Description = "Swipeable slides learners navigate to explore content. Complete after viewing all slides.",
            Fields = new List<InteractiveBlockFormField>
            {
                new()
                {
                    Name = "contentDescription",
                    Label = "Content description",
                    FieldType = "textarea",
                    Required = true,
                    HelpText = "Describe the learning purpose and tone for this carousel."
                },
                new()
                {
                    Name = "slides",
                    Label = "Slides",
                    FieldType = "slide-list",
                    Required = true,
                    HelpText = "Add slides with a title, body text, and optional image."
                }
            }
        };
    }

    private static void ValidateCarousel(JsonObject root)
    {
        var description = root["contentDescription"]?.GetValue<string>();
        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Content description is required.");
        }

        if (root["slides"] is not JsonArray slides || slides.Count == 0)
        {
            throw new ArgumentException("At least one slide is required.");
        }

        if (slides.Count > InteractiveLessonConstants.MaxCarouselSlides)
        {
            throw new ArgumentException(
                $"A carousel can have at most {InteractiveLessonConstants.MaxCarouselSlides} slides.");
        }

        for (var i = 0; i < slides.Count; i++)
        {
            var slide = slides[i] as JsonObject;
            var title = slide?["title"]?.GetValue<string>();
            var body = slide?["body"]?.GetValue<string>();

            if (string.IsNullOrWhiteSpace(title))
            {
                throw new ArgumentException($"Slide {i + 1} title is required.");
            }

            if (string.IsNullOrWhiteSpace(body))
            {
                throw new ArgumentException($"Slide {i + 1} body is required.");
            }
        }
    }

    private static (string CompletionRuleJson, string Prompt) BuildCarouselPrompt(
        string blockTitle,
        string formPayloadJson,
        string? mediaAssetsJson)
    {
        var completionRule = JsonSerializer.Serialize(new
        {
            type = "carousel",
            requireAllSlidesViewed = true
        });

        var prompt = $"""
Create an interactive carousel block titled "{blockTitle}".

{ThemeGuardrails}

Block type: carousel
Completion rule: learner must view every slide before the block is marked complete.

Form data (use exactly as content source):
{formPayloadJson}

Media assets (optional supplementary images):
{(string.IsNullOrWhiteSpace(mediaAssetsJson) ? "[]" : mediaAssetsJson)}

Requirements:
1. Display one slide at a time with large touch-friendly Previous and Next buttons (min 44px height).
2. Include dot or step indicators showing current position (e.g. "2 of 5").
3. Mark a slide as viewed when the learner navigates to it (including the first slide on load).
4. Track viewed slide indices in JavaScript; when ALL slides have been viewed, post the completion message to the parent window.
5. If a slide has imageUrl, display the image responsively above or beside the text with alt text from the slide title.
6. Use smooth transitions between slides where possible without relying on hover-only controls.
7. On the final slide, show a clear "Finish" or "Complete" affordance after the learner has seen all slides.
8. Use LMSBOX theme colours for buttons, headings, and active indicators.
9. Do not add an outer border, card, or boxed container around the carousel — content should sit flush on the page.

Return ONLY the HTML fragment.
""";

        return (completionRule, prompt);
    }

    private static InteractiveBlockTypeSchema GetAccordionSchema()
    {
        return new InteractiveBlockTypeSchema
        {
            Type = "accordion",
            Label = "Accordion",
            Description = "Expandable sections learners open to explore content. Complete after expanding every panel.",
            Fields = new List<InteractiveBlockFormField>
            {
                new()
                {
                    Name = "contentDescription",
                    Label = "Content description",
                    FieldType = "textarea",
                    Required = true,
                    HelpText = "Describe the learning purpose and tone for this accordion."
                },
                new()
                {
                    Name = "panels",
                    Label = "Panels",
                    FieldType = "panel-list",
                    Required = true,
                    HelpText = "Add panels with a title and body text."
                }
            }
        };
    }

    private static void ValidateAccordion(JsonObject root)
    {
        var description = root["contentDescription"]?.GetValue<string>();
        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Content description is required.");
        }

        if (root["panels"] is not JsonArray panels || panels.Count == 0)
        {
            throw new ArgumentException("At least one panel is required.");
        }

        if (panels.Count > InteractiveLessonConstants.MaxAccordionPanels)
        {
            throw new ArgumentException(
                $"An accordion can have at most {InteractiveLessonConstants.MaxAccordionPanels} panels.");
        }

        for (var i = 0; i < panels.Count; i++)
        {
            var panel = panels[i] as JsonObject;
            var title = panel?["title"]?.GetValue<string>();
            var body = panel?["body"]?.GetValue<string>();

            if (string.IsNullOrWhiteSpace(title))
            {
                throw new ArgumentException($"Panel {i + 1} title is required.");
            }

            if (string.IsNullOrWhiteSpace(body))
            {
                throw new ArgumentException($"Panel {i + 1} body is required.");
            }
        }
    }

    private static (string CompletionRuleJson, string Prompt) BuildAccordionPrompt(
        string blockTitle,
        string formPayloadJson,
        string? mediaAssetsJson)
    {
        var completionRule = JsonSerializer.Serialize(new
        {
            type = "accordion",
            requireAllPanelsExpanded = true
        });

        var prompt = $"""
Create an interactive accordion block titled "{blockTitle}".

{ThemeGuardrails}

Block type: accordion
Completion rule: learner must expand every panel at least once before the block is marked complete.

Form data (use exactly as content source):
{formPayloadJson}

Media assets (optional supplementary images):
{(string.IsNullOrWhiteSpace(mediaAssetsJson) ? "[]" : mediaAssetsJson)}

Requirements:
1. Render each panel as a collapsible section with a large touch-friendly header button (min 44px height).
2. Only one panel may be open at a time, or allow multiple — choose whichever gives the clearest UX for the content.
3. Include a visible chevron or plus/minus icon on each header to indicate expand/collapse state.
4. Track expanded panel indices in JavaScript; when ALL panels have been expanded at least once, post the completion message to the parent window.
5. Include a progress indicator (e.g. "3 of 5 panels viewed").
6. Use smooth expand/collapse transitions without relying on hover-only controls.
7. Ensure keyboard accessibility: headers are focusable and respond to Enter/Space.
8. Use LMSBOX theme colours for headers and active/open states. Panel headers may use a subtle divider, but do not wrap the whole accordion in an outer bordered card.
9. Do not add an outer border, card, or boxed container around the accordion — content should sit flush on the page.

Return ONLY the HTML fragment.
""";

        return (completionRule, prompt);
    }

    private static InteractiveBlockTypeSchema GetTextSchema()
    {
        return new InteractiveBlockTypeSchema
        {
            Type = "text",
            Label = "Text",
            Description = "Heading, optional subheading, and body text. Uses a fixed layout.",
            Fields = new List<InteractiveBlockFormField>
            {
                new()
                {
                    Name = "heading",
                    Label = "Heading",
                    FieldType = "text",
                    Required = false,
                    HelpText = "Optional main heading shown to learners."
                },
                new()
                {
                    Name = "subheading",
                    Label = "Subheading",
                    FieldType = "text",
                    Required = false,
                    HelpText = "Optional supporting line under the heading."
                },
                new()
                {
                    Name = "body",
                    Label = "Text content",
                    FieldType = "textarea",
                    Required = true,
                    HelpText = "Main body text for learners."
                },
                new()
                {
                    Name = "showContinueButton",
                    Label = "Show Continue button",
                    FieldType = "checkbox",
                    Required = false,
                    DefaultValue = true,
                    HelpText = "When enabled, learners must tap Continue to complete the block. When disabled, the block completes automatically when shown."
                }
            }
        };
    }

    private static void ValidateText(JsonObject root)
    {
        var heading = root["heading"]?.GetValue<string>();
        if (!string.IsNullOrWhiteSpace(heading) &&
            heading.Trim().Length > InteractiveLessonConstants.MaxTextHeadingLength)
        {
            throw new ArgumentException(
                $"Heading must be at most {InteractiveLessonConstants.MaxTextHeadingLength} characters.");
        }

        var subheading = root["subheading"]?.GetValue<string>();
        if (!string.IsNullOrWhiteSpace(subheading) &&
            subheading.Trim().Length > InteractiveLessonConstants.MaxTextSubheadingLength)
        {
            throw new ArgumentException(
                $"Subheading must be at most {InteractiveLessonConstants.MaxTextSubheadingLength} characters.");
        }

        var body = root["body"]?.GetValue<string>();
        if (string.IsNullOrWhiteSpace(body))
        {
            throw new ArgumentException("Text content is required.");
        }

        if (body.Trim().Length > InteractiveLessonConstants.MaxTextBodyLength)
        {
            throw new ArgumentException(
                $"Text content must be at most {InteractiveLessonConstants.MaxTextBodyLength} characters.");
        }
    }

    private static InteractiveBlockTypeSchema GetVideoSchema()
    {
        return new InteractiveBlockTypeSchema
        {
            Type = "video",
            Label = "Video",
            Description = "Embed a video with optional title and description. Uses a fixed layout.",
            Fields = new List<InteractiveBlockFormField>
            {
                new()
                {
                    Name = "title",
                    Label = "Title",
                    FieldType = "text",
                    Required = false,
                    HelpText = "Optional title shown above the video."
                },
                new()
                {
                    Name = "videoUrl",
                    Label = "Video URL",
                    FieldType = "text",
                    Required = true,
                    HelpText = "Direct video file URL, or choose a video file to upload when saving the block."
                },
                new()
                {
                    Name = "description",
                    Label = "Description",
                    FieldType = "textarea",
                    Required = false,
                    HelpText = "Optional description text shown under the video."
                }
            }
        };
    }

    private static void ValidateVideo(JsonObject root)
    {
        var title = root["title"]?.GetValue<string>();
        if (!string.IsNullOrWhiteSpace(title) &&
            title.Trim().Length > InteractiveLessonConstants.MaxVideoTitleLength)
        {
            throw new ArgumentException(
                $"Title must be at most {InteractiveLessonConstants.MaxVideoTitleLength} characters.");
        }

        var description = root["description"]?.GetValue<string>()
            ?? root["caption"]?.GetValue<string>();
        if (!string.IsNullOrWhiteSpace(description) &&
            description.Trim().Length > InteractiveLessonConstants.MaxVideoDescriptionLength)
        {
            throw new ArgumentException(
                $"Description must be at most {InteractiveLessonConstants.MaxVideoDescriptionLength} characters.");
        }

        var videoUrl = root["videoUrl"]?.GetValue<string>()?.Trim();
        if (string.IsNullOrWhiteSpace(videoUrl))
        {
            // Allow draft save before upload; generate/render still requires a URL.
            return;
        }

        if (videoUrl.Length > InteractiveLessonConstants.MaxVideoUrlLength)
        {
            throw new ArgumentException(
                $"Video URL must be at most {InteractiveLessonConstants.MaxVideoUrlLength} characters.");
        }

        if (!Uri.TryCreate(videoUrl, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw new ArgumentException("Video URL must be a valid http or https URL.");
        }
    }
}
