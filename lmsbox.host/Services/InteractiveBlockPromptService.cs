using System.Globalization;
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
            GetHeroSchema(),
            GetCardsSchema(),
            GetRevealSchema(),
            GetFlipSchema(),
            GetRememberSchema(),
            GetWarningSchema(),
            GetTimelineSchema(),
            GetReflectionSchema(),
            GetHotspotSchema(),
            GetProcessSchema(),
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
            "hero" => GetHeroSchema(),
            "cards" => GetCardsSchema(),
            "reveal" => GetRevealSchema(),
            "flip" => GetFlipSchema(),
            "remember" => GetRememberSchema(),
            "warning" => GetWarningSchema(),
            "timeline" => GetTimelineSchema(),
            "reflection" => GetReflectionSchema(),
            "hotspot" => GetHotspotSchema(),
            "process" => GetProcessSchema(),
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
            case "hero":
                ValidateHero(root);
                break;
            case "cards":
                ValidateCards(root);
                break;
            case "reveal":
                ValidateReveal(root);
                break;
            case "flip":
                ValidateFlip(root);
                break;
            case "remember":
                ValidateRemember(root);
                break;
            case "warning":
                ValidateWarning(root);
                break;
            case "timeline":
                ValidateTimeline(root);
                break;
            case "reflection":
                ValidateReflection(root);
                break;
            case "hotspot":
                ValidateHotspot(root);
                break;
            case "process":
                ValidateProcess(root);
                break;
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
            "hero" => throw new ArgumentException("Hero blocks use a fixed template and do not support AI HTML generation."),
            "cards" => throw new ArgumentException("Information cards blocks use a fixed template and do not support AI HTML generation."),
            "reveal" => throw new ArgumentException("Click reveal blocks use a fixed template and do not support AI HTML generation."),
            "flip" => throw new ArgumentException("Flip card blocks use a fixed template and do not support AI HTML generation."),
            "remember" => throw new ArgumentException("Remember blocks use a fixed template and do not support AI HTML generation."),
            "warning" => throw new ArgumentException("Warning blocks use a fixed template and do not support AI HTML generation."),
            "timeline" => throw new ArgumentException("Timeline blocks use a fixed template and do not support AI HTML generation."),
            "reflection" => throw new ArgumentException("Reflection blocks use a fixed template and do not support AI HTML generation."),
            "hotspot" => throw new ArgumentException("Hotspot blocks use a fixed template and do not support AI HTML generation."),
            "process" => throw new ArgumentException("Process flow blocks use a fixed template and do not support AI HTML generation."),
            "text" => throw new ArgumentException("Text blocks use a fixed template and do not support AI HTML generation."),
            "video" => throw new ArgumentException("Video blocks use a fixed template and do not support AI HTML generation."),
            _ => throw new ArgumentException($"Unsupported block type: {blockType}")
        };
    }

    private static InteractiveBlockTypeSchema GetHeroSchema()
    {
        return new InteractiveBlockTypeSchema
        {
            Type = "hero",
            Label = "Hero",
            Description = "Lesson introduction banner with kicker, title, intro, optional meta pills, and optional background image. Completes automatically when shown.",
            Fields = new List<InteractiveBlockFormField>
            {
                new()
                {
                    Name = "kicker",
                    Label = "Kicker",
                    FieldType = "text",
                    Required = false,
                    HelpText = "Optional short label above the title (e.g. Module introduction)."
                },
                new()
                {
                    Name = "title",
                    Label = "Title",
                    FieldType = "text",
                    Required = true,
                    HelpText = "Main hero heading shown to learners."
                },
                new()
                {
                    Name = "intro",
                    Label = "Intro",
                    FieldType = "textarea",
                    Required = false,
                    HelpText = "Optional supporting sentence under the title."
                },
                new()
                {
                    Name = "metaPills",
                    Label = "Meta pills",
                    FieldType = "string-list",
                    Required = false,
                    HelpText = "Optional short labels shown under the intro (e.g. duration, format)."
                },
                new()
                {
                    Name = "backgroundImageUrl",
                    Label = "Background image",
                    FieldType = "image",
                    Required = false,
                    HelpText = "Optional background image URL, or upload an image when editing the block."
                }
            }
        };
    }

    private static void ValidateHero(JsonObject root)
    {
        var kicker = root["kicker"]?.GetValue<string>();
        if (!string.IsNullOrWhiteSpace(kicker) &&
            kicker.Trim().Length > InteractiveLessonConstants.MaxHeroKickerLength)
        {
            throw new ArgumentException(
                $"Kicker must be at most {InteractiveLessonConstants.MaxHeroKickerLength} characters.");
        }

        var title = root["title"]?.GetValue<string>();
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Title is required.");
        }

        if (title.Trim().Length > InteractiveLessonConstants.MaxHeroTitleLength)
        {
            throw new ArgumentException(
                $"Title must be at most {InteractiveLessonConstants.MaxHeroTitleLength} characters.");
        }

        var intro = root["intro"]?.GetValue<string>();
        if (!string.IsNullOrWhiteSpace(intro) &&
            intro.Trim().Length > InteractiveLessonConstants.MaxHeroIntroLength)
        {
            throw new ArgumentException(
                $"Intro must be at most {InteractiveLessonConstants.MaxHeroIntroLength} characters.");
        }

        if (root["metaPills"] is JsonArray pills)
        {
            var nonEmptyCount = 0;
            for (var i = 0; i < pills.Count; i++)
            {
                var pill = pills[i]?.GetValue<string>()?.Trim();
                if (string.IsNullOrWhiteSpace(pill))
                {
                    continue;
                }

                nonEmptyCount++;
                if (pill.Length > InteractiveLessonConstants.MaxHeroMetaPillLength)
                {
                    throw new ArgumentException(
                        $"Meta pill {i + 1} must be at most {InteractiveLessonConstants.MaxHeroMetaPillLength} characters.");
                }
            }

            if (nonEmptyCount > InteractiveLessonConstants.MaxHeroMetaPills)
            {
                throw new ArgumentException(
                    $"A hero can have at most {InteractiveLessonConstants.MaxHeroMetaPills} meta pills.");
            }
        }

        var imageUrl = root["backgroundImageUrl"]?.GetValue<string>()?.Trim();
        if (!string.IsNullOrWhiteSpace(imageUrl))
        {
            if (imageUrl.Length > InteractiveLessonConstants.MaxHeroBackgroundImageUrlLength)
            {
                throw new ArgumentException(
                    $"Background image URL must be at most {InteractiveLessonConstants.MaxHeroBackgroundImageUrlLength} characters.");
            }

            if (!Uri.TryCreate(imageUrl, UriKind.Absolute, out var uri) ||
                (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                throw new ArgumentException("Background image URL must be a valid http or https URL.");
            }
        }
    }

    private static InteractiveBlockTypeSchema GetCardsSchema()
    {
        return new InteractiveBlockTypeSchema
        {
            Type = "cards",
            Label = "Information cards",
            Description = "A grid of information cards with label, title, and body. Completes automatically when shown.",
            Fields = new List<InteractiveBlockFormField>
            {
                new()
                {
                    Name = "cards",
                    Label = "Cards",
                    FieldType = "card-list",
                    Required = true,
                    HelpText = "Add cards with an optional label, title, body, and style variant (default, accent, or warn)."
                }
            }
        };
    }

    private static void ValidateCards(JsonObject root)
    {
        if (root["cards"] is not JsonArray cards || cards.Count == 0)
        {
            throw new ArgumentException("At least one card is required.");
        }

        if (cards.Count > InteractiveLessonConstants.MaxCardsPerBlock)
        {
            throw new ArgumentException(
                $"An information cards block can have at most {InteractiveLessonConstants.MaxCardsPerBlock} cards.");
        }

        for (var i = 0; i < cards.Count; i++)
        {
            var card = cards[i] as JsonObject;
            var label = card?["label"]?.GetValue<string>();
            if (!string.IsNullOrWhiteSpace(label) &&
                label.Trim().Length > InteractiveLessonConstants.MaxCardLabelLength)
            {
                throw new ArgumentException(
                    $"Card {i + 1} label must be at most {InteractiveLessonConstants.MaxCardLabelLength} characters.");
            }

            var title = card?["title"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(title))
            {
                throw new ArgumentException($"Card {i + 1} title is required.");
            }

            if (title.Trim().Length > InteractiveLessonConstants.MaxCardTitleLength)
            {
                throw new ArgumentException(
                    $"Card {i + 1} title must be at most {InteractiveLessonConstants.MaxCardTitleLength} characters.");
            }

            var body = card?["body"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(body))
            {
                throw new ArgumentException($"Card {i + 1} body is required.");
            }

            if (body.Trim().Length > InteractiveLessonConstants.MaxCardBodyLength)
            {
                throw new ArgumentException(
                    $"Card {i + 1} body must be at most {InteractiveLessonConstants.MaxCardBodyLength} characters.");
            }

            var variant = card?["variant"]?.GetValue<string>()?.Trim().ToLowerInvariant() ?? "default";
            if (variant is not ("default" or "accent" or "warn"))
            {
                throw new ArgumentException($"Card {i + 1} has an invalid style variant.");
            }
        }
    }

    private static InteractiveBlockTypeSchema GetRevealSchema()
    {
        return new InteractiveBlockTypeSchema
        {
            Type = "reveal",
            Label = "Click reveal",
            Description = "Hidden content learners open one panel at a time. Completes after every panel has been revealed.",
            Fields = new List<InteractiveBlockFormField>
            {
                new()
                {
                    Name = "items",
                    Label = "Reveal panels",
                    FieldType = "reveal-item-list",
                    Required = true,
                    HelpText = "Add panels with a title, hidden body, optional prompt label, and style variant (default or warn)."
                },
                new()
                {
                    Name = "hint",
                    Label = "Hint",
                    FieldType = "text",
                    Required = false,
                    HelpText = "Optional nudge shown under the panels (e.g. Select the card to reveal the answer)."
                }
            }
        };
    }

    private static void ValidateReveal(JsonObject root)
    {
        if (root["items"] is not JsonArray items || items.Count == 0)
        {
            throw new ArgumentException("At least one reveal panel is required.");
        }

        if (items.Count > InteractiveLessonConstants.MaxRevealItems)
        {
            throw new ArgumentException(
                $"A click reveal block can have at most {InteractiveLessonConstants.MaxRevealItems} panels.");
        }

        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i] as JsonObject;

            RequireText(
                item?["title"],
                $"Reveal panel {i + 1} title",
                InteractiveLessonConstants.MaxRevealTitleLength);

            RequireText(
                item?["body"],
                $"Reveal panel {i + 1} body",
                InteractiveLessonConstants.MaxRevealBodyLength);

            LimitOptionalText(
                item?["label"],
                $"Reveal panel {i + 1} label",
                InteractiveLessonConstants.MaxRevealLabelLength);

            var variant = item?["variant"]?.GetValue<string>()?.Trim().ToLowerInvariant() ?? "default";
            if (variant is not ("default" or "warn"))
            {
                throw new ArgumentException($"Reveal panel {i + 1} has an invalid style variant.");
            }
        }

        LimitOptionalText(root["hint"], "Hint", InteractiveLessonConstants.MaxRevealHintLength);
    }

    private static InteractiveBlockTypeSchema GetFlipSchema()
    {
        return new InteractiveBlockTypeSchema
        {
            Type = "flip",
            Label = "Flip cards",
            Description = "Two-sided cards learners flip to see the answer. Completes after every card has been flipped.",
            Fields = new List<InteractiveBlockFormField>
            {
                new()
                {
                    Name = "cards",
                    Label = "Flip cards",
                    FieldType = "flip-card-list",
                    Required = true,
                    HelpText = "Add cards with a front title and back body, plus optional hint labels for each side."
                }
            }
        };
    }

    private static void ValidateFlip(JsonObject root)
    {
        if (root["cards"] is not JsonArray cards || cards.Count == 0)
        {
            throw new ArgumentException("At least one flip card is required.");
        }

        if (cards.Count > InteractiveLessonConstants.MaxFlipCards)
        {
            throw new ArgumentException(
                $"A flip cards block can have at most {InteractiveLessonConstants.MaxFlipCards} cards.");
        }

        for (var i = 0; i < cards.Count; i++)
        {
            var card = cards[i] as JsonObject;

            RequireText(
                card?["frontTitle"],
                $"Flip card {i + 1} front title",
                InteractiveLessonConstants.MaxFlipFrontTitleLength);

            RequireText(
                card?["backBody"],
                $"Flip card {i + 1} back body",
                InteractiveLessonConstants.MaxFlipBackBodyLength);

            LimitOptionalText(
                card?["frontHint"],
                $"Flip card {i + 1} front hint",
                InteractiveLessonConstants.MaxFlipHintLength);

            LimitOptionalText(
                card?["backHint"],
                $"Flip card {i + 1} back hint",
                InteractiveLessonConstants.MaxFlipHintLength);
        }
    }

    private static InteractiveBlockTypeSchema GetRememberSchema()
    {
        return new InteractiveBlockTypeSchema
        {
            Type = "remember",
            Label = "Remember box",
            Description = "A highlighted takeaway learners should carry forward. Completes automatically when shown.",
            Fields = new List<InteractiveBlockFormField>
            {
                new()
                {
                    Name = "label",
                    Label = "Label",
                    FieldType = "text",
                    Required = false,
                    DefaultValue = "Remember",
                    HelpText = "Optional label above the message. Defaults to Remember."
                },
                new()
                {
                    Name = "body",
                    Label = "Message",
                    FieldType = "textarea",
                    Required = true,
                    HelpText = "The key point learners should remember."
                }
            }
        };
    }

    private static void ValidateRemember(JsonObject root)
    {
        LimitOptionalText(root["label"], "Label", InteractiveLessonConstants.MaxRememberLabelLength);
        RequireText(root["body"], "Message", InteractiveLessonConstants.MaxRememberBodyLength);
    }

    private static InteractiveBlockTypeSchema GetWarningSchema()
    {
        return new InteractiveBlockTypeSchema
        {
            Type = "warning",
            Label = "Warning box",
            Description = "A cautionary callout for limits, exclusions, or common mistakes. Completes automatically when shown.",
            Fields = new List<InteractiveBlockFormField>
            {
                new()
                {
                    Name = "label",
                    Label = "Label",
                    FieldType = "text",
                    Required = false,
                    DefaultValue = "Warning",
                    HelpText = "Optional label above the message. Defaults to Warning."
                },
                new()
                {
                    Name = "body",
                    Label = "Message",
                    FieldType = "textarea",
                    Required = true,
                    HelpText = "The caution learners need to be aware of."
                }
            }
        };
    }

    private static void ValidateWarning(JsonObject root)
    {
        LimitOptionalText(root["label"], "Label", InteractiveLessonConstants.MaxWarningLabelLength);
        RequireText(root["body"], "Message", InteractiveLessonConstants.MaxWarningBodyLength);
    }

    private static InteractiveBlockTypeSchema GetTimelineSchema()
    {
        return new InteractiveBlockTypeSchema
        {
            Type = "timeline",
            Label = "Timeline",
            Description = "Numbered stages learners expand in sequence. Completes after every stage has been expanded.",
            Fields = new List<InteractiveBlockFormField>
            {
                new()
                {
                    Name = "stages",
                    Label = "Stages",
                    FieldType = "timeline-stage-list",
                    Required = true,
                    HelpText = "Add stages with a title and body. Stages are numbered automatically."
                },
                new()
                {
                    Name = "hint",
                    Label = "Hint",
                    FieldType = "text",
                    Required = false,
                    DefaultValue = "Select a stage to expand it",
                    HelpText = "Optional nudge shown above the timeline."
                }
            }
        };
    }

    private static void ValidateTimeline(JsonObject root)
    {
        if (root["stages"] is not JsonArray stages || stages.Count == 0)
        {
            throw new ArgumentException("At least one stage is required.");
        }

        if (stages.Count > InteractiveLessonConstants.MaxTimelineStages)
        {
            throw new ArgumentException(
                $"A timeline can have at most {InteractiveLessonConstants.MaxTimelineStages} stages.");
        }

        for (var i = 0; i < stages.Count; i++)
        {
            var stage = stages[i] as JsonObject;

            RequireText(
                stage?["title"],
                $"Stage {i + 1} title",
                InteractiveLessonConstants.MaxTimelineTitleLength);

            RequireText(
                stage?["body"],
                $"Stage {i + 1} body",
                InteractiveLessonConstants.MaxTimelineBodyLength);
        }

        LimitOptionalText(root["hint"], "Hint", InteractiveLessonConstants.MaxTimelineHintLength);
    }

    private static InteractiveBlockTypeSchema GetReflectionSchema()
    {
        return new InteractiveBlockTypeSchema
        {
            Type = "reflection",
            Label = "Reflection panel",
            Description = "An open prompt learners answer in their own words. Completes when they save a non-empty reflection.",
            Fields = new List<InteractiveBlockFormField>
            {
                new()
                {
                    Name = "label",
                    Label = "Label",
                    FieldType = "text",
                    Required = false,
                    DefaultValue = "Your reflection",
                    HelpText = "Optional label above the question. Defaults to Your reflection."
                },
                new()
                {
                    Name = "title",
                    Label = "Question",
                    FieldType = "text",
                    Required = true,
                    HelpText = "The reflection question learners answer."
                },
                new()
                {
                    Name = "prompt",
                    Label = "Prompt",
                    FieldType = "textarea",
                    Required = false,
                    HelpText = "Optional supporting sentence (e.g. There is no right answer here)."
                },
                new()
                {
                    Name = "placeholder",
                    Label = "Placeholder",
                    FieldType = "text",
                    Required = false,
                    DefaultValue = "Write a few sentences…",
                    HelpText = "Optional placeholder text shown inside the empty answer box."
                }
            }
        };
    }

    private static void ValidateReflection(JsonObject root)
    {
        LimitOptionalText(root["label"], "Label", InteractiveLessonConstants.MaxReflectionLabelLength);
        RequireText(root["title"], "Question", InteractiveLessonConstants.MaxReflectionTitleLength);
        LimitOptionalText(root["prompt"], "Prompt", InteractiveLessonConstants.MaxReflectionPromptLength);
        LimitOptionalText(
            root["placeholder"],
            "Placeholder",
            InteractiveLessonConstants.MaxReflectionPlaceholderLength);
    }

    private static InteractiveBlockTypeSchema GetHotspotSchema()
    {
        return new InteractiveBlockTypeSchema
        {
            Type = "hotspot",
            Label = "Hotspot diagram",
            Description = "An image with numbered pins learners open to read detail. Completes after every pin has been opened.",
            Fields = new List<InteractiveBlockFormField>
            {
                new()
                {
                    Name = "imageUrl",
                    Label = "Diagram image",
                    FieldType = "image",
                    Required = true,
                    HelpText = "The background image, or upload an image when editing the block."
                },
                new()
                {
                    Name = "imageAlt",
                    Label = "Image description",
                    FieldType = "text",
                    Required = false,
                    HelpText = "Alternative text describing the diagram for screen readers."
                },
                new()
                {
                    Name = "pins",
                    Label = "Pins",
                    FieldType = "hotspot-pin-list",
                    Required = true,
                    HelpText = "Add pins with a title, body, and position as a percentage from the top and left of the image."
                }
            }
        };
    }

    private static void ValidateHotspot(JsonObject root)
    {
        var imageUrl = root["imageUrl"]?.GetValue<string>()?.Trim();
        if (string.IsNullOrWhiteSpace(imageUrl))
        {
            throw new ArgumentException("Diagram image is required.");
        }

        if (imageUrl.Length > InteractiveLessonConstants.MaxHotspotImageUrlLength)
        {
            throw new ArgumentException(
                $"Diagram image URL must be at most {InteractiveLessonConstants.MaxHotspotImageUrlLength} characters.");
        }

        if (!Uri.TryCreate(imageUrl, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw new ArgumentException("Diagram image URL must be a valid http or https URL.");
        }

        LimitOptionalText(
            root["imageAlt"],
            "Image description",
            InteractiveLessonConstants.MaxHotspotImageAltLength);

        if (root["pins"] is not JsonArray pins || pins.Count == 0)
        {
            throw new ArgumentException("At least one pin is required.");
        }

        if (pins.Count > InteractiveLessonConstants.MaxHotspotPins)
        {
            throw new ArgumentException(
                $"A hotspot diagram can have at most {InteractiveLessonConstants.MaxHotspotPins} pins.");
        }

        for (var i = 0; i < pins.Count; i++)
        {
            var pin = pins[i] as JsonObject;

            RequireText(
                pin?["title"],
                $"Pin {i + 1} title",
                InteractiveLessonConstants.MaxHotspotPinTitleLength);

            RequireText(
                pin?["body"],
                $"Pin {i + 1} body",
                InteractiveLessonConstants.MaxHotspotPinBodyLength);

            if (!TryReadPercent(pin?["topPercent"], out _))
            {
                throw new ArgumentException($"Pin {i + 1} top position must be a number between 0 and 100.");
            }

            if (!TryReadPercent(pin?["leftPercent"], out _))
            {
                throw new ArgumentException($"Pin {i + 1} left position must be a number between 0 and 100.");
            }
        }
    }

    private static InteractiveBlockTypeSchema GetProcessSchema()
    {
        return new InteractiveBlockTypeSchema
        {
            Type = "process",
            Label = "Process flow",
            Description = "A staged sequence learners step through one reveal at a time. Completes after the final step.",
            Fields = new List<InteractiveBlockFormField>
            {
                new()
                {
                    Name = "steps",
                    Label = "Steps",
                    FieldType = "process-step-list",
                    Required = true,
                    HelpText = "Add steps with a title and body. Steps are revealed one at a time."
                },
                new()
                {
                    Name = "nodes",
                    Label = "Stage labels",
                    FieldType = "process-node-list",
                    Required = false,
                    HelpText = "Optional short labels for the diagram above the steps. Add one per step, or leave empty to derive them from the step titles."
                },
                new()
                {
                    Name = "startButtonLabel",
                    Label = "Start button label",
                    FieldType = "text",
                    Required = false,
                    DefaultValue = "Start the sequence",
                    HelpText = "Optional label for the button that reveals the first step."
                },
                new()
                {
                    Name = "finishMessage",
                    Label = "Finish message",
                    FieldType = "textarea",
                    Required = false,
                    HelpText = "Optional takeaway shown once the learner has finished every step."
                }
            }
        };
    }

    private static void ValidateProcess(JsonObject root)
    {
        if (root["steps"] is not JsonArray steps || steps.Count == 0)
        {
            throw new ArgumentException("At least one step is required.");
        }

        if (steps.Count > InteractiveLessonConstants.MaxProcessSteps)
        {
            throw new ArgumentException(
                $"A process flow can have at most {InteractiveLessonConstants.MaxProcessSteps} steps.");
        }

        for (var i = 0; i < steps.Count; i++)
        {
            var step = steps[i] as JsonObject;

            RequireText(
                step?["title"],
                $"Step {i + 1} title",
                InteractiveLessonConstants.MaxProcessStepTitleLength);

            RequireText(
                step?["body"],
                $"Step {i + 1} body",
                InteractiveLessonConstants.MaxProcessStepBodyLength);
        }

        if (root["nodes"] is JsonArray nodes)
        {
            var labels = new List<string>();
            for (var i = 0; i < nodes.Count; i++)
            {
                var label = ReadNodeLabel(nodes[i]);
                if (string.IsNullOrWhiteSpace(label))
                {
                    continue;
                }

                if (label.Length > InteractiveLessonConstants.MaxProcessNodeLabelLength)
                {
                    throw new ArgumentException(
                        $"Stage label {i + 1} must be at most {InteractiveLessonConstants.MaxProcessNodeLabelLength} characters.");
                }

                labels.Add(label);
            }

            if (labels.Count > 0 && labels.Count != steps.Count)
            {
                throw new ArgumentException(
                    "Add one stage label per step, or leave the stage labels empty to derive them from the step titles.");
            }

            if (labels.Count > InteractiveLessonConstants.MaxProcessNodes)
            {
                throw new ArgumentException(
                    $"A process flow can have at most {InteractiveLessonConstants.MaxProcessNodes} stage labels.");
            }
        }

        LimitOptionalText(
            root["startButtonLabel"],
            "Start button label",
            InteractiveLessonConstants.MaxProcessButtonLabelLength);

        LimitOptionalText(
            root["finishMessage"],
            "Finish message",
            InteractiveLessonConstants.MaxProcessFinishMessageLength);
    }

    /// <summary>Stage labels accept either a plain string or an object with a "label" property.</summary>
    internal static string ReadNodeLabel(JsonNode? node)
    {
        return node is JsonObject obj ? ReadText(obj["label"]) : ReadText(node);
    }

    internal static bool TryReadPercent(JsonNode? node, out double percent)
    {
        percent = 0;

        if (node is not JsonValue value)
        {
            return false;
        }

        if (value.TryGetValue<double>(out var number))
        {
            percent = number;
        }
        else if (value.TryGetValue<string>(out var text)
                 && double.TryParse(
                     text.Trim().TrimEnd('%'),
                     NumberStyles.Float,
                     CultureInfo.InvariantCulture,
                     out var parsed))
        {
            percent = parsed;
        }
        else
        {
            return false;
        }

        return !double.IsNaN(percent) && !double.IsInfinity(percent) && percent is >= 0 and <= 100;
    }

    private static void RequireText(JsonNode? node, string fieldLabel, int maxLength)
    {
        var value = ReadText(node);
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"{fieldLabel} is required.");
        }

        if (value.Length > maxLength)
        {
            throw new ArgumentException($"{fieldLabel} must be at most {maxLength} characters.");
        }
    }

    private static void LimitOptionalText(JsonNode? node, string fieldLabel, int maxLength)
    {
        var value = ReadText(node);
        if (value.Length > maxLength)
        {
            throw new ArgumentException($"{fieldLabel} must be at most {maxLength} characters.");
        }
    }

    private static string ReadText(JsonNode? node)
        => node is JsonValue value && value.TryGetValue<string>(out var text) ? text.Trim() : "";

    private static InteractiveBlockTypeSchema GetQuestionnaireSchema()
    {
        return new InteractiveBlockTypeSchema
        {
            Type = "questionnaire",
            Label = "Questionnaire",
            Description = "Knowledge-check questions in the LMSbox question style. Completes when every question is answered.",
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
                    Name = "bodyHtml",
                    Label = "Text content",
                    FieldType = "richtext",
                    Required = true,
                    HelpText = "Formatted body content for learners. Supports headings, lists, and links."
                },
                new()
                {
                    Name = "body",
                    Label = "Text content (plain)",
                    FieldType = "textarea",
                    Required = false,
                    HelpText = "Plain text version of the body, kept in sync with the formatted content."
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

        var bodyHtml = root["bodyHtml"]?.GetValue<string>();
        var body = root["body"]?.GetValue<string>();

        // Blocks authored before the rich text editor only carry the plain text body.
        if (string.IsNullOrWhiteSpace(bodyHtml))
        {
            if (string.IsNullOrWhiteSpace(body))
            {
                throw new ArgumentException("Text content is required.");
            }

            if (body.Trim().Length > InteractiveLessonConstants.MaxTextBodyLength)
            {
                throw new ArgumentException(
                    $"Text content must be at most {InteractiveLessonConstants.MaxTextBodyLength} characters.");
            }

            return;
        }

        if (bodyHtml.Length > InteractiveLessonConstants.MaxTextBodyHtmlLength)
        {
            throw new ArgumentException("Text content is too long. Please shorten the formatted content.");
        }

        var characters = InteractiveRichTextSanitizer.CountCharacters(bodyHtml);
        if (characters == 0)
        {
            throw new ArgumentException("Text content is required.");
        }

        if (characters > InteractiveLessonConstants.MaxTextBodyLength)
        {
            throw new ArgumentException(
                $"Text content must be at most {InteractiveLessonConstants.MaxTextBodyLength} characters.");
        }

        if (InteractiveRichTextSanitizer.TryFindUnsupportedLink(bodyHtml, out var href))
        {
            throw new ArgumentException(
                $"Link \"{href}\" is not supported. Links must be a full http, https, or mailto address.");
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
                    HelpText = "Direct MP4/WebM URL, YouTube/Vimeo link, or upload a video file when saving the block."
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
