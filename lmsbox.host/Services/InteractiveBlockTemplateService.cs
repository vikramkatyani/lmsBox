using System.Globalization;
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
        "hero",
        "cards",
        "reveal",
        "flip",
        "remember",
        "warning",
        "timeline",
        "reflection",
        "hotspot",
        "process",
        "carousel",
        "accordion",
        "questionnaire",
        "text",
        "video"
    };

    private const string PlusSvg =
        """<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>""";

    private const string ShieldSvg =
        """<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z"/></svg>""";

    private const string TriangleSvg =
        """<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>""";

    private const string BulbSvg =
        """<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 1.9V16h5.2v-.2c0-.7.3-1.4.9-1.9A6 6 0 0 0 12 3z"/></svg>""";

    private const string ArrowSvg =
        """<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg>""";

    private const string DocumentNodeSvg =
        """<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 19V5h10v14"/><path d="M14 8h4l2 3v8h-6z"/></svg>""";

    private const string PanelNodeSvg =
        """<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12h8M8 8h5"/></svg>""";

    private const string CheckNodeSvg =
        """<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12l5 5L20 7"/></svg>""";

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
            "hero" => RenderHero(blockId, formPayloadJson),
            "cards" => RenderCards(blockId, formPayloadJson),
            "reveal" => RenderReveal(blockId, formPayloadJson),
            "flip" => RenderFlip(blockId, formPayloadJson),
            "remember" => RenderCallout(blockId, formPayloadJson, "remember"),
            "warning" => RenderCallout(blockId, formPayloadJson, "warning"),
            "timeline" => RenderTimeline(blockId, formPayloadJson),
            "reflection" => RenderReflection(blockId, formPayloadJson),
            "hotspot" => RenderHotspot(blockId, formPayloadJson),
            "process" => RenderProcess(blockId, formPayloadJson),
            "carousel" => RenderCarousel(blockId, formPayloadJson),
            "accordion" => RenderAccordion(blockId, formPayloadJson),
            "questionnaire" => RenderQuestionnaire(blockId, formPayloadJson),
            "text" => RenderText(blockId, formPayloadJson),
            "video" => RenderVideo(blockId, formPayloadJson),
            _ => throw new ArgumentException($"No fixed template for block type: {blockType}")
        };
    }

    private (string Html, string CompletionRuleJson) RenderHero(long blockId, string formPayloadJson)
    {
        var root = JsonNode.Parse(formPayloadJson) as JsonObject
            ?? throw new ArgumentException("Invalid form payload JSON.");

        var kicker = root["kicker"]?.GetValue<string>()?.Trim() ?? "";
        var title = root["title"]?.GetValue<string>()?.Trim() ?? "";
        var intro = root["intro"]?.GetValue<string>()?.Trim() ?? "";
        var backgroundImageUrl = root["backgroundImageUrl"]?.GetValue<string>()?.Trim() ?? "";

        var pills = new List<string>();
        if (root["metaPills"] is JsonArray pillsArray)
        {
            foreach (var node in pillsArray)
            {
                var pill = node?.GetValue<string>()?.Trim();
                if (!string.IsNullOrWhiteSpace(pill))
                {
                    pills.Add(pill);
                }
            }
        }

        var hasImage = !string.IsNullOrWhiteSpace(backgroundImageUrl);
        var heroClass = hasImage ? "lms-hero" : "lms-hero lms-hero--simple";

        var mediaHtml = hasImage
            ? $"""<img class="lms-hero__media" src="{HtmlEncodeAttribute(backgroundImageUrl)}" alt=""><div class="lms-hero__scrim" aria-hidden="true"></div>"""
            : "";

        var kickerHtml = string.IsNullOrWhiteSpace(kicker)
            ? ""
            : $"""<div class="lms-hero__kicker">{HtmlEncode(kicker)}</div>""";

        var introHtml = string.IsNullOrWhiteSpace(intro)
            ? ""
            : $"""<p class="lms-hero__intro">{HtmlEncode(intro)}</p>""";

        var metaHtml = "";
        if (pills.Count > 0)
        {
            var pillsMarkup = new StringBuilder();
            foreach (var pill in pills)
            {
                pillsMarkup.Append($"""<span class="lms-pill">{HtmlEncode(pill)}</span>""");
            }

            metaHtml = $"""<div class="lms-hero__meta">{pillsMarkup}</div>""";
        }

        var html = FillTemplate(
            "hero.html",
            blockId,
            ("{{HERO_CLASS}}", heroClass),
            ("{{MEDIA_HTML}}", mediaHtml),
            ("{{KICKER_HTML}}", kickerHtml),
            ("{{TITLE}}", HtmlEncode(title)),
            ("{{INTRO_HTML}}", introHtml),
            ("{{META_HTML}}", metaHtml));

        var completionRule = JsonSerializer.Serialize(new
        {
            type = "hero",
            autoCompleteOnView = true
        });

        return (html, completionRule);
    }

    private (string Html, string CompletionRuleJson) RenderCards(long blockId, string formPayloadJson)
    {
        var root = JsonNode.Parse(formPayloadJson) as JsonObject
            ?? throw new ArgumentException("Invalid form payload JSON.");

        var cardsArray = root["cards"] as JsonArray
            ?? throw new ArgumentException("At least one card is required.");

        var cardsMarkup = new StringBuilder();
        foreach (var node in cardsArray)
        {
            var card = node as JsonObject;
            var label = card?["label"]?.GetValue<string>()?.Trim() ?? "";
            var title = card?["title"]?.GetValue<string>()?.Trim() ?? "";
            var body = card?["body"]?.GetValue<string>()?.Trim() ?? "";
            var variant = card?["variant"]?.GetValue<string>()?.Trim().ToLowerInvariant() ?? "default";

            var variantClass = variant switch
            {
                "accent" => " lms-card--accent",
                "warn" => " lms-card--warn",
                _ => ""
            };

            var labelHtml = string.IsNullOrWhiteSpace(label)
                ? ""
                : $"""<div class="lms-card__label">{HtmlEncode(label)}</div>""";

            cardsMarkup.Append(
                $"""
                <article class="lms-card lms-card-hover{variantClass}">
                  {labelHtml}
                  <h3 class="lms-card__title">{HtmlEncode(title)}</h3>
                  <p class="lms-card__body">{HtmlEncode(body)}</p>
                </article>
                """);
        }

        var gridClass = cardsArray.Count switch
        {
            1 => "lms-stack",
            2 => "lms-grid-2",
            _ => "lms-grid-3"
        };

        var html = FillTemplate(
            "cards.html",
            blockId,
            ("{{GRID_CLASS}}", gridClass),
            ("{{CARDS_HTML}}", cardsMarkup.ToString()));

        var completionRule = JsonSerializer.Serialize(new
        {
            type = "cards",
            autoCompleteOnView = true
        });

        return (html, completionRule);
    }

    private (string Html, string CompletionRuleJson) RenderReveal(long blockId, string formPayloadJson)
    {
        var root = JsonNode.Parse(formPayloadJson) as JsonObject
            ?? throw new ArgumentException("Invalid form payload JSON.");

        var itemsArray = root["items"] as JsonArray
            ?? throw new ArgumentException("At least one reveal panel is required.");

        var itemsMarkup = new StringBuilder();
        for (var i = 0; i < itemsArray.Count; i++)
        {
            var item = itemsArray[i] as JsonObject;
            var title = ReadText(item?["title"]);
            var body = ReadText(item?["body"]);
            var label = ReadText(item?["label"]);
            var variant = ReadText(item?["variant"]).ToLowerInvariant();

            if (string.IsNullOrWhiteSpace(label))
            {
                label = "Click to reveal";
            }

            var isWarn = variant == "warn";
            var triggerId = $"lmsbox-reveal-trigger-{blockId}-{i}";
            var bodyId = $"lmsbox-reveal-body-{blockId}-{i}";

            itemsMarkup.Append(
                $"""
                <section class="lms-reveal{(isWarn ? " lms-reveal--warn" : "")}" data-reveal-item>
                  <button class="lms-reveal__trigger" type="button" id="{triggerId}" aria-expanded="false" aria-controls="{bodyId}">
                    <span class="lms-reveal__icon" aria-hidden="true">{(isWarn ? TriangleSvg : ShieldSvg)}</span>
                    <span style="flex:1">
                      <span class="lms-reveal__label">{HtmlEncode(label)}</span>
                      <h2 class="lms-reveal__title">{HtmlEncode(title)}</h2>
                    </span>
                    <span class="lms-plus" aria-hidden="true">{PlusSvg}</span>
                  </button>
                  <div class="lms-reveal__body" id="{bodyId}" role="region" aria-labelledby="{triggerId}">
                    <div class="lms-reveal__inner">{RenderParagraphs(body)}</div>
                  </div>
                </section>
                """);
        }

        var hint = ReadText(root["hint"]);
        var hintHtml = string.IsNullOrWhiteSpace(hint)
            ? ""
            : $"""<p class="lms-hint" data-reveal-hint><span class="lms-hint__pulse" aria-hidden="true"></span>{HtmlEncode(hint)}</p>""";

        var html = FillTemplate(
            "reveal.html",
            blockId,
            ("{{ITEMS_HTML}}", itemsMarkup.ToString()),
            ("{{HINT_HTML}}", hintHtml));

        var completionRule = JsonSerializer.Serialize(new
        {
            type = "reveal",
            requireAllItemsRevealed = true
        });

        return (html, completionRule);
    }

    private (string Html, string CompletionRuleJson) RenderFlip(long blockId, string formPayloadJson)
    {
        var root = JsonNode.Parse(formPayloadJson) as JsonObject
            ?? throw new ArgumentException("Invalid form payload JSON.");

        var cardsArray = root["cards"] as JsonArray
            ?? throw new ArgumentException("At least one flip card is required.");

        var cardsMarkup = new StringBuilder();
        foreach (var node in cardsArray)
        {
            var card = node as JsonObject;
            var frontTitle = ReadText(card?["frontTitle"]);
            var backBody = ReadText(card?["backBody"]);
            var frontHint = ReadText(card?["frontHint"]);
            var backHint = ReadText(card?["backHint"]);

            if (string.IsNullOrWhiteSpace(frontHint))
            {
                frontHint = "Tap to flip";
            }

            if (string.IsNullOrWhiteSpace(backHint))
            {
                backHint = "Definition";
            }

            cardsMarkup.Append(
                $"""
                <button class="lms-flip" type="button" data-flip-card aria-pressed="false" aria-label="Flip card: {HtmlEncodeAttribute(frontTitle)}">
                  <div class="lms-flip__inner">
                    <div class="lms-flip__face lms-flip__front">
                      <span class="lms-flip__hint">{HtmlEncode(frontHint)}</span>
                      <h3 class="lms-flip__title">{HtmlEncode(frontTitle)}</h3>
                    </div>
                    <div class="lms-flip__face lms-flip__back">
                      <span class="lms-flip__hint">{HtmlEncode(backHint)}</span>
                      {RenderParagraphs(backBody, "lms-flip__body")}
                    </div>
                  </div>
                </button>
                """);
        }

        var gridClass = cardsArray.Count == 1 ? "lms-stack" : "lms-grid-2";

        var html = FillTemplate(
            "flip.html",
            blockId,
            ("{{GRID_CLASS}}", gridClass),
            ("{{CARDS_HTML}}", cardsMarkup.ToString()));

        var completionRule = JsonSerializer.Serialize(new
        {
            type = "flip",
            requireAllCardsFlipped = true
        });

        return (html, completionRule);
    }

    private (string Html, string CompletionRuleJson) RenderCallout(long blockId, string formPayloadJson, string kind)
    {
        var root = JsonNode.Parse(formPayloadJson) as JsonObject
            ?? throw new ArgumentException("Invalid form payload JSON.");

        var defaultLabel = kind == "warning" ? "Warning" : "Remember";
        var label = ReadText(root["label"]);
        if (string.IsNullOrWhiteSpace(label))
        {
            label = defaultLabel;
        }

        var body = ReadText(root["body"]);

        var html = FillTemplate(
            $"{kind}.html",
            blockId,
            ("{{LABEL}}", HtmlEncode(label)),
            ("{{BODY_HTML}}", RenderParagraphs(body)));

        var completionRule = JsonSerializer.Serialize(new
        {
            type = kind,
            autoCompleteOnView = true
        });

        return (html, completionRule);
    }

    private (string Html, string CompletionRuleJson) RenderTimeline(long blockId, string formPayloadJson)
    {
        var root = JsonNode.Parse(formPayloadJson) as JsonObject
            ?? throw new ArgumentException("Invalid form payload JSON.");

        var stagesArray = root["stages"] as JsonArray
            ?? throw new ArgumentException("At least one stage is required.");

        var stagesMarkup = new StringBuilder();
        for (var i = 0; i < stagesArray.Count; i++)
        {
            var stage = stagesArray[i] as JsonObject;
            var title = ReadText(stage?["title"]);
            var body = ReadText(stage?["body"]);
            var triggerId = $"lmsbox-timeline-trigger-{blockId}-{i}";
            var bodyId = $"lmsbox-timeline-body-{blockId}-{i}";

            stagesMarkup.Append(
                $"""
                <div class="lms-timeline__item" data-timeline-item>
                  <button class="lms-timeline__trigger" type="button" id="{triggerId}" aria-expanded="false" aria-controls="{bodyId}">
                    <span class="lms-timeline__num">{i + 1}</span>
                    <h3 class="lms-timeline__title">{HtmlEncode(title)}</h3>
                    <span class="lms-plus lms-plus--xs" aria-hidden="true">{PlusSvg}</span>
                  </button>
                  <div class="lms-timeline__body" id="{bodyId}" role="region" aria-labelledby="{triggerId}">
                    <div class="lms-timeline__inner">{RenderParagraphs(body)}</div>
                  </div>
                </div>
                """);
        }

        var hint = ReadText(root["hint"]);
        if (string.IsNullOrWhiteSpace(hint))
        {
            hint = "Select a stage to expand it";
        }

        var hintHtml =
            $"""<p class="lms-hint" data-timeline-hint><span class="lms-hint__pulse" aria-hidden="true"></span>{HtmlEncode(hint)}</p>""";

        var html = FillTemplate(
            "timeline.html",
            blockId,
            ("{{STAGES_HTML}}", stagesMarkup.ToString()),
            ("{{HINT_HTML}}", hintHtml));

        var completionRule = JsonSerializer.Serialize(new
        {
            type = "timeline",
            requireAllStagesExpanded = true
        });

        return (html, completionRule);
    }

    private (string Html, string CompletionRuleJson) RenderReflection(long blockId, string formPayloadJson)
    {
        var root = JsonNode.Parse(formPayloadJson) as JsonObject
            ?? throw new ArgumentException("Invalid form payload JSON.");

        var label = ReadText(root["label"]);
        if (string.IsNullOrWhiteSpace(label))
        {
            label = "Your reflection";
        }

        var title = ReadText(root["title"]);
        var prompt = ReadText(root["prompt"]);
        var placeholder = ReadText(root["placeholder"]);
        if (string.IsNullOrWhiteSpace(placeholder))
        {
            placeholder = "Write a few sentences…";
        }

        var promptHtml = string.IsNullOrWhiteSpace(prompt)
            ? ""
            : RenderParagraphs(prompt, "lms-reflection__prompt");

        var html = FillTemplate(
            "reflection.html",
            blockId,
            ("{{LABEL}}", HtmlEncode(label)),
            ("{{TITLE}}", HtmlEncode(title)),
            ("{{PROMPT_HTML}}", promptHtml),
            ("{{PLACEHOLDER}}", HtmlEncodeAttribute(placeholder)));

        var completionRule = JsonSerializer.Serialize(new
        {
            type = "reflection",
            requireSavedReflection = true
        });

        return (html, completionRule);
    }

    private (string Html, string CompletionRuleJson) RenderHotspot(long blockId, string formPayloadJson)
    {
        var root = JsonNode.Parse(formPayloadJson) as JsonObject
            ?? throw new ArgumentException("Invalid form payload JSON.");

        var imageUrl = ReadText(root["imageUrl"]);
        if (string.IsNullOrWhiteSpace(imageUrl))
        {
            throw new ArgumentException("Diagram image is required before generating this block.");
        }

        var imageAlt = ReadText(root["imageAlt"]);

        var pinsArray = root["pins"] as JsonArray
            ?? throw new ArgumentException("At least one pin is required.");

        var pinsMarkup = new StringBuilder();
        var panelsMarkup = new StringBuilder();

        for (var i = 0; i < pinsArray.Count; i++)
        {
            var pin = pinsArray[i] as JsonObject;
            var title = ReadText(pin?["title"]);
            var body = ReadText(pin?["body"]);
            var number = i + 1;
            var panelId = $"lmsbox-hotspot-panel-{blockId}-{number}";

            InteractiveBlockPromptService.TryReadPercent(pin?["topPercent"], out var top);
            InteractiveBlockPromptService.TryReadPercent(pin?["leftPercent"], out var left);

            pinsMarkup.Append(
                $"""
                <button class="lms-hotspot__pin" type="button" style="top:{FormatPercent(top)}%;left:{FormatPercent(left)}%" aria-controls="{panelId}" aria-expanded="false" aria-label="Hotspot {number}: {HtmlEncodeAttribute(title)}">{number}</button>
                """);

            panelsMarkup.Append(
                $"""
                <div id="{panelId}" class="lms-hotspot__panel" role="dialog" aria-label="Hotspot {number}: {HtmlEncodeAttribute(title)}" hidden>
                  <h3 class="lms-hotspot__panel-title">{HtmlEncode(title)}</h3>
                  {RenderParagraphs(body, "lms-hotspot__panel-body")}
                </div>
                """);
        }

        var html = FillTemplate(
            "hotspot.html",
            blockId,
            ("{{IMAGE_URL}}", HtmlEncodeAttribute(imageUrl)),
            ("{{IMAGE_ALT}}", HtmlEncodeAttribute(imageAlt)),
            ("{{PINS_HTML}}", pinsMarkup.ToString()),
            ("{{PANELS_HTML}}", panelsMarkup.ToString()));

        var completionRule = JsonSerializer.Serialize(new
        {
            type = "hotspot",
            requireAllPinsOpened = true
        });

        return (html, completionRule);
    }

    private (string Html, string CompletionRuleJson) RenderProcess(long blockId, string formPayloadJson)
    {
        var root = JsonNode.Parse(formPayloadJson) as JsonObject
            ?? throw new ArgumentException("Invalid form payload JSON.");

        var stepsArray = root["steps"] as JsonArray
            ?? throw new ArgumentException("At least one step is required.");

        var stepTitles = new List<string>();
        var stepsMarkup = new StringBuilder();

        for (var i = 0; i < stepsArray.Count; i++)
        {
            var step = stepsArray[i] as JsonObject;
            var title = ReadText(step?["title"]);
            var body = ReadText(step?["body"]);
            stepTitles.Add(title);

            stepsMarkup.Append(
                $"""
                <div class="lms-process__step" data-step="{i + 1}">
                  <span class="lms-process__num">{i + 1}</span>
                  <div>
                    <h3>{HtmlEncode(title)}</h3>
                    {RenderParagraphs(body)}
                  </div>
                </div>
                """);
        }

        var nodeLabels = new List<string>();
        if (root["nodes"] is JsonArray nodesArray)
        {
            foreach (var node in nodesArray)
            {
                var label = InteractiveBlockPromptService.ReadNodeLabel(node);
                if (!string.IsNullOrWhiteSpace(label))
                {
                    nodeLabels.Add(label);
                }
            }
        }

        if (nodeLabels.Count != stepTitles.Count)
        {
            // Fall back to labels derived from the step titles so the diagram always
            // lines up with the steps the learner reveals.
            nodeLabels = stepTitles
                .Select((title, index) => string.IsNullOrWhiteSpace(title)
                    ? $"Step {index + 1}"
                    : Truncate(title, InteractiveLessonConstants.MaxProcessNodeLabelLength))
                .ToList();
        }

        var nodesMarkup = new StringBuilder();
        for (var i = 0; i < nodeLabels.Count; i++)
        {
            if (i > 0)
            {
                nodesMarkup.Append($"""<span class="lms-process__arrow" aria-hidden="true">{ArrowSvg}</span>""");
            }

            var icon = i == nodeLabels.Count - 1
                ? CheckNodeSvg
                : i == 0 ? DocumentNodeSvg : PanelNodeSvg;

            nodesMarkup.Append(
                $"""
                <div class="lms-process__node" data-node="{i + 1}">
                  <span class="lms-process__disc" aria-hidden="true">{icon}</span>
                  <span class="lms-process__lab">{HtmlEncode(nodeLabels[i])}</span>
                </div>
                """);
        }

        var startLabel = ReadText(root["startButtonLabel"]);
        if (string.IsNullOrWhiteSpace(startLabel))
        {
            startLabel = "Start the sequence";
        }

        var finishMessage = ReadText(root["finishMessage"]);
        var finishHtml = string.IsNullOrWhiteSpace(finishMessage)
            ? """<div data-process-finish hidden></div>"""
            : $"""
              <div data-process-finish hidden>
                <aside class="lms-remember">
                  <span class="lms-remember__icon" aria-hidden="true">{BulbSvg}</span>
                  <div>
                    <div class="lms-remember__label">Remember</div>
                    {RenderParagraphs(finishMessage)}
                  </div>
                </aside>
              </div>
              """;

        var html = FillTemplate(
            "process.html",
            blockId,
            ("{{NODES_HTML}}", nodesMarkup.ToString()),
            ("{{STEPS_HTML}}", stepsMarkup.ToString()),
            ("{{START_LABEL}}", HtmlEncodeAttribute(startLabel)),
            ("{{FINISH_HTML}}", finishHtml));

        var completionRule = JsonSerializer.Serialize(new
        {
            type = "process",
            requireAllStepsCompleted = true
        });

        return (html, completionRule);
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

        var panelsMarkup = new StringBuilder();
        for (var i = 0; i < panelsArray.Count; i++)
        {
            var panel = panelsArray[i] as JsonObject;
            var title = ReadText(panel?["title"]);
            var body = ReadText(panel?["body"]);
            var triggerId = $"lmsbox-accordion-trigger-{blockId}-{i}";
            var bodyId = $"lmsbox-accordion-body-{blockId}-{i}";

            panelsMarkup.Append(
                $"""
                <div class="lms-accordion__item" data-accordion-item>
                  <button class="lms-accordion__trigger" type="button" id="{triggerId}" aria-expanded="false" aria-controls="{bodyId}">
                    <h3 class="lms-accordion__title">{HtmlEncode(title)}</h3>
                    <span class="lms-plus lms-plus--sm" aria-hidden="true">{PlusSvg}</span>
                  </button>
                  <div class="lms-accordion__body" id="{bodyId}" role="region" aria-labelledby="{triggerId}">
                    <div class="lms-accordion__inner">{RenderParagraphs(body)}</div>
                  </div>
                </div>
                """);
        }

        var html = FillTemplate(
            "accordion.html",
            blockId,
            ("{{PANELS_HTML}}", panelsMarkup.ToString()));

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
        var bodyHtml = root["bodyHtml"]?.GetValue<string>() ?? "";
        var showContinue = root["showContinueButton"]?.GetValue<bool>() ?? true;

        // Blocks authored before the rich text editor only carry plain text, which the
        // template renders with preserved line breaks.
        var isRichBody = InteractiveRichTextSanitizer.HasVisibleContent(bodyHtml);
        var renderedBody = isRichBody
            ? InteractiveRichTextSanitizer.Sanitize(bodyHtml)
            : HtmlEncode(body);

        var html = FillTemplate(
            "text.html",
            blockId,
            ("{{HEADING}}", HtmlEncode(heading)),
            ("{{SUBHEADING}}", HtmlEncode(subheading)),
            ("{{BODY}}", renderedBody),
            ("{{BODY_FORMAT}}", isRichBody ? "rich" : "plain"),
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

        var (playerKind, playerHtml) = BuildVideoPlayerMarkup(videoUrl);

        var html = FillTemplate(
            "video.html",
            blockId,
            ("{{TITLE}}", HtmlEncode(title)),
            ("{{DESCRIPTION}}", HtmlEncode(description)),
            ("{{PLAYER_KIND}}", playerKind),
            ("{{PLAYER_HTML}}", playerHtml));

        var completionRule = JsonSerializer.Serialize(new
        {
            type = "video",
            requireWatchedToEnd = playerKind == "file",
            playerKind
        });

        return (html, completionRule);
    }

    private static (string PlayerKind, string PlayerHtml) BuildVideoPlayerMarkup(string videoUrl)
    {
        if (TryGetYouTubeEmbedUrl(videoUrl, out var youtubeEmbed))
        {
            var src = HtmlEncodeAttribute(youtubeEmbed);
            return ("youtube",
                $"""
                <iframe
                  class="lmsbox-video__embed"
                  data-video-embed
                  src="{src}"
                  title="YouTube video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowfullscreen
                  referrerpolicy="strict-origin-when-cross-origin"
                ></iframe>
                """);
        }

        if (TryGetVimeoEmbedUrl(videoUrl, out var vimeoEmbed))
        {
            var src = HtmlEncodeAttribute(vimeoEmbed);
            return ("vimeo",
                $"""
                <iframe
                  class="lmsbox-video__embed"
                  data-video-embed
                  src="{src}"
                  title="Vimeo video"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowfullscreen
                ></iframe>
                """);
        }

        var fileSrc = HtmlEncodeAttribute(videoUrl);
        return ("file",
            $"""
            <video
              class="lmsbox-video__player"
              data-video-player
              controls
              playsinline
              preload="metadata"
              controlsList="nodownload"
              src="{fileSrc}"
            >
              Your browser does not support embedded video.
            </video>
            """);
    }

    private static bool TryGetYouTubeEmbedUrl(string videoUrl, out string embedUrl)
    {
        embedUrl = "";
        if (!Uri.TryCreate(videoUrl, UriKind.Absolute, out var uri))
        {
            return false;
        }

        var host = uri.Host.Replace("www.", "", StringComparison.OrdinalIgnoreCase);
        string? videoId = null;

        if (host.Equals("youtu.be", StringComparison.OrdinalIgnoreCase))
        {
            videoId = uri.AbsolutePath.Trim('/').Split('/')[0];
        }
        else if (host.Equals("youtube.com", StringComparison.OrdinalIgnoreCase)
                 || host.Equals("m.youtube.com", StringComparison.OrdinalIgnoreCase)
                 || host.Equals("youtube-nocookie.com", StringComparison.OrdinalIgnoreCase))
        {
            videoId = GetQueryValue(uri.Query, "v");
            if (string.IsNullOrWhiteSpace(videoId))
            {
                var parts = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length >= 2 &&
                    (parts[0].Equals("embed", StringComparison.OrdinalIgnoreCase)
                     || parts[0].Equals("shorts", StringComparison.OrdinalIgnoreCase)
                     || parts[0].Equals("live", StringComparison.OrdinalIgnoreCase)
                     || parts[0].Equals("v", StringComparison.OrdinalIgnoreCase)))
                {
                    videoId = parts[1];
                }
            }
        }

        if (string.IsNullOrWhiteSpace(videoId))
        {
            return false;
        }

        // Strip common junk from IDs
        videoId = videoId.Split('?', '&')[0];
        if (videoId.Length < 6)
        {
            return false;
        }

        embedUrl = $"https://www.youtube.com/embed/{videoId}?rel=0&modestbranding=1&enablejsapi=1&playsinline=1";
        return true;
    }

    private static bool TryGetVimeoEmbedUrl(string videoUrl, out string embedUrl)
    {
        embedUrl = "";
        if (!Uri.TryCreate(videoUrl, UriKind.Absolute, out var uri))
        {
            return false;
        }

        var host = uri.Host.Replace("www.", "", StringComparison.OrdinalIgnoreCase);
        if (!host.Equals("vimeo.com", StringComparison.OrdinalIgnoreCase)
            && !host.Equals("player.vimeo.com", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var parts = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        string? videoId = null;
        if (host.Equals("player.vimeo.com", StringComparison.OrdinalIgnoreCase)
            && parts.Length >= 2
            && parts[0].Equals("video", StringComparison.OrdinalIgnoreCase))
        {
            videoId = parts[1];
        }
        else if (parts.Length >= 1)
        {
            // vimeo.com/123456789 or vimeo.com/channels/x/123456789
            videoId = parts.LastOrDefault(p => p.All(char.IsDigit));
        }

        if (string.IsNullOrWhiteSpace(videoId) || !videoId.All(char.IsDigit))
        {
            return false;
        }

        embedUrl = $"https://player.vimeo.com/video/{videoId}?title=0&byline=0&portrait=0";
        return true;
    }

    private static string? GetQueryValue(string query, string key)
    {
        if (string.IsNullOrEmpty(query))
        {
            return null;
        }

        var trimmed = query.TrimStart('?');
        foreach (var part in trimmed.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var pair = part.Split('=', 2);
            if (pair.Length == 0)
            {
                continue;
            }

            var name = Uri.UnescapeDataString(pair[0]);
            if (!name.Equals(key, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            return pair.Length > 1 ? Uri.UnescapeDataString(pair[1]) : "";
        }

        return null;
    }

    private static string ReadText(JsonNode? node)
        => node is JsonValue value && value.TryGetValue<string>(out var text) ? text.Trim() : "";

    /// <summary>Wraps plain text in paragraphs so authored line breaks survive rendering.</summary>
    private static string RenderParagraphs(string text, string? className = null)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return "";
        }

        var classAttribute = string.IsNullOrWhiteSpace(className) ? "" : $""" class="{className}" """.TrimEnd();
        var builder = new StringBuilder();

        foreach (var line in text.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n'))
        {
            var trimmed = line.Trim();
            if (trimmed.Length == 0)
            {
                continue;
            }

            builder.Append($"<p{classAttribute}>{HtmlEncode(trimmed)}</p>");
        }

        return builder.ToString();
    }

    private static string FormatPercent(double value)
        => Math.Clamp(value, 0, 100).ToString("0.###", CultureInfo.InvariantCulture);

    private static string Truncate(string value, int maxLength)
        => value.Length <= maxLength ? value : value[..Math.Max(0, maxLength - 1)].TrimEnd() + "…";

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
