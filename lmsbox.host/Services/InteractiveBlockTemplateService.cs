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
        "flowchart",
        "carousel",
        "accordion",
        "tabs",
        "questionnaire",
        "ordering",
        "text",
        "video",
        "audio"
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

    private const string DownArrowSvg =
        """<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>""";

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
            "flowchart" => RenderFlowchart(blockId, formPayloadJson),
            "carousel" => RenderCarousel(blockId, formPayloadJson),
            "accordion" => RenderAccordion(blockId, formPayloadJson),
            "tabs" => RenderTabs(blockId, formPayloadJson),
            "questionnaire" => RenderQuestionnaire(blockId, formPayloadJson),
            "ordering" => RenderOrdering(blockId, formPayloadJson),
            "text" => RenderText(blockId, formPayloadJson),
            "video" => RenderVideo(blockId, formPayloadJson),
            "audio" => RenderAudio(blockId, formPayloadJson),
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
            var icon = InteractiveBlockIcons.Resolve(
                ReadText(item?["icon"]),
                isWarn ? TriangleSvg : ShieldSvg);
            var imageHtml = RenderOptionalImage(
                ReadText(item?["imageUrl"]),
                "lms-block-media",
                title);

            itemsMarkup.Append(
                $"""
                <section class="lms-reveal{(isWarn ? " lms-reveal--warn" : "")}" data-reveal-item>
                  <button class="lms-reveal__trigger" type="button" id="{triggerId}" aria-expanded="false" aria-controls="{bodyId}">
                    <span class="lms-reveal__icon" aria-hidden="true">{icon}</span>
                    <span style="flex:1">
                      <span class="lms-reveal__label">{HtmlEncode(label)}</span>
                      <h2 class="lms-reveal__title">{HtmlEncode(title)}</h2>
                    </span>
                    <span class="lms-plus" aria-hidden="true">{PlusSvg}</span>
                  </button>
                  <div class="lms-reveal__body" id="{bodyId}" role="region" aria-labelledby="{triggerId}">
                    <div class="lms-reveal__inner">{imageHtml}{RenderParagraphs(body)}</div>
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
            ("{{LEAD_HTML}}", RenderBlockLead(root)),
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
            var backBodyHtml = ReadText(card?["backBodyHtml"]);
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
                      {RenderRichOrPlain(backBodyHtml, backBody, "lms-flip__body")}
                    </div>
                  </div>
                </button>
                """);
        }

        var gridClass = cardsArray.Count == 1 ? "lms-stack" : "lms-grid-2";

        var html = FillTemplate(
            "flip.html",
            blockId,
            ("{{LEAD_HTML}}", RenderBlockLead(root)),
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
            ("{{BODY_HTML}}", RenderRichOrPlain(ReadText(root["bodyHtml"]), body)));

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
            ("{{LEAD_HTML}}", RenderBlockLead(root)),
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
            var pinImageHtml = RenderOptionalImage(
                ReadText(pin?["imageUrl"]),
                "lms-hotspot__panel-image",
                title);

            InteractiveBlockPromptService.TryReadPercent(pin?["topPercent"], out var top);
            InteractiveBlockPromptService.TryReadPercent(pin?["leftPercent"], out var left);

            pinsMarkup.Append(
                $"""
                <button class="lms-hotspot__pin" type="button" style="top:{FormatPercent(top)}%;left:{FormatPercent(left)}%" aria-controls="{panelId}" aria-expanded="false" aria-label="Hotspot {number}: {HtmlEncodeAttribute(title)}">{number}</button>
                """);

            panelsMarkup.Append(
                $"""
                <div id="{panelId}" class="lms-hotspot__panel" role="dialog" aria-label="Hotspot {number}: {HtmlEncodeAttribute(title)}" hidden>
                  <button class="lms-hotspot__close" type="button" data-hotspot-close aria-label="Close">×</button>
                  <h3 class="lms-hotspot__panel-title">{HtmlEncode(title)}</h3>
                  {pinImageHtml}{RenderParagraphs(body, "lms-hotspot__panel-body")}
                </div>
                """);
        }

        var html = FillTemplate(
            "hotspot.html",
            blockId,
            ("{{LEAD_HTML}}", RenderBlockLead(root, inset: true)),
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
            var imageHtml = RenderOptionalImage(
                ReadText(step?["imageUrl"]),
                "lms-block-media",
                title);
            stepTitles.Add(title);

            stepsMarkup.Append(
                $"""
                <div class="lms-process__step" data-step="{i + 1}">
                  <span class="lms-process__num">{i + 1}</span>
                  <div>
                    <h3>{HtmlEncode(title)}</h3>
                    {imageHtml}
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

            var fallbackIcon = i == nodeLabels.Count - 1
                ? CheckNodeSvg
                : i == 0 ? DocumentNodeSvg : PanelNodeSvg;
            var iconKey = i < stepsArray.Count
                ? ReadText((stepsArray[i] as JsonObject)?["icon"])
                : "";
            if (string.IsNullOrWhiteSpace(iconKey) && root["nodes"] is JsonArray iconNodes && i < iconNodes.Count)
            {
                iconKey = ReadNodeIcon(iconNodes[i]);
            }
            var icon = InteractiveBlockIcons.Resolve(iconKey, fallbackIcon);

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
            ("{{LEAD_HTML}}", RenderBlockLead(root, inset: true)),
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
            ("{{LEAD_HTML}}", RenderBlockLead(root, inset: true)),
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
            var bodyHtml = ReadText(panel?["bodyHtml"]);
            var triggerId = $"lmsbox-accordion-trigger-{blockId}-{i}";
            var bodyId = $"lmsbox-accordion-body-{blockId}-{i}";
            var iconHtml = "";
            var iconSvg = InteractiveBlockIcons.ResolveCustom(ReadText(panel?["icon"]));
            if (iconSvg != null)
            {
                iconHtml = $"""<span class="lms-accordion__icon" aria-hidden="true">{iconSvg}</span>""";
            }
            var imageHtml = RenderOptionalImage(
                ReadText(panel?["imageUrl"]),
                "lms-block-media",
                title);

            panelsMarkup.Append(
                $"""
                <div class="lms-accordion__item" data-accordion-item>
                  <button class="lms-accordion__trigger" type="button" id="{triggerId}" aria-expanded="false" aria-controls="{bodyId}">
                    {iconHtml}
                    <h3 class="lms-accordion__title">{HtmlEncode(title)}</h3>
                    <span class="lms-plus lms-plus--sm" aria-hidden="true">{PlusSvg}</span>
                  </button>
                  <div class="lms-accordion__body" id="{bodyId}" role="region" aria-labelledby="{triggerId}">
                    <div class="lms-accordion__inner">{imageHtml}{RenderRichOrPlain(bodyHtml, body)}</div>
                  </div>
                </div>
                """);
        }

        var html = FillTemplate(
            "accordion.html",
            blockId,
            ("{{LEAD_HTML}}", RenderBlockLead(root)),
            ("{{PANELS_HTML}}", panelsMarkup.ToString()));

        var completionRule = JsonSerializer.Serialize(new
        {
            type = "accordion",
            requireAllPanelsExpanded = true
        });

        return (html, completionRule);
    }

    private (string Html, string CompletionRuleJson) RenderTabs(long blockId, string formPayloadJson)
    {
        var root = JsonNode.Parse(formPayloadJson) as JsonObject
            ?? throw new ArgumentException("Invalid form payload JSON.");

        var panelsArray = root["panels"] as JsonArray
            ?? throw new ArgumentException("At least one tab is required.");

        var tabsMarkup = new StringBuilder();
        var panelsMarkup = new StringBuilder();

        for (var i = 0; i < panelsArray.Count; i++)
        {
            var panel = panelsArray[i] as JsonObject;
            var title = ReadText(panel?["title"]);
            var body = ReadText(panel?["body"]);
            var tabId = $"lmsbox-tab-{blockId}-{i}";
            var panelId = $"lmsbox-tab-panel-{blockId}-{i}";
            var selected = i == 0;
            var iconHtml = "";
            var iconSvg = InteractiveBlockIcons.ResolveCustom(ReadText(panel?["icon"]));
            if (iconSvg != null)
            {
                iconHtml = $"""<span class="lms-tabs__icon" aria-hidden="true">{iconSvg}</span>""";
            }
            var imageHtml = RenderOptionalImage(
                ReadText(panel?["imageUrl"]),
                "lms-block-media",
                title);

            tabsMarkup.Append(
                $"""
                <button class="lms-tabs__tab{(selected ? " is-on" : "")}" type="button" role="tab" id="{tabId}" aria-controls="{panelId}" aria-selected="{(selected ? "true" : "false")}" tabindex="{(selected ? "0" : "-1")}">
                  {iconHtml}
                  <span>{HtmlEncode(title)}</span>
                </button>
                """);

            panelsMarkup.Append(
                $"""
                <article class="lms-tabs__panel{(selected ? " is-on" : "")}" role="tabpanel" id="{panelId}" aria-labelledby="{tabId}" {(selected ? "" : "hidden")}>
                  {imageHtml}{RenderParagraphs(body)}
                </article>
                """);
        }

        var html = FillTemplate(
            "tabs.html",
            blockId,
            ("{{HEADING_HTML}}", RenderOptionalHeading(ReadText(root["heading"]), "lms-tabs__heading")),
            ("{{INTRO_HTML}}", RenderOptionalIntro(ReadText(root["intro"]), "lms-tabs__intro")),
            ("{{TABS_HTML}}", tabsMarkup.ToString()),
            ("{{PANELS_HTML}}", panelsMarkup.ToString()));

        var completionRule = JsonSerializer.Serialize(new
        {
            type = "tabs",
            requireAllTabsViewed = true
        });

        return (html, completionRule);
    }

    private (string Html, string CompletionRuleJson) RenderFlowchart(long blockId, string formPayloadJson)
    {
        var root = JsonNode.Parse(formPayloadJson) as JsonObject
            ?? throw new ArgumentException("Invalid form payload JSON.");

        var nodesArray = root["nodes"] as JsonArray
            ?? throw new ArgumentException("At least one stage is required.");

        var nodesMarkup = new StringBuilder();

        for (var i = 0; i < nodesArray.Count; i++)
        {
            var node = nodesArray[i] as JsonObject;
            var title = ReadText(node?["title"]);
            var body = ReadText(node?["body"]);
            var variant = NormaliseFlowchartVariant(ReadText(node?["variant"]), i, nodesArray.Count);
            var isFirst = i == 0;
            var isLast = i == nodesArray.Count - 1;
            var fallbackIcon = variant switch
            {
                "start" => DocumentNodeSvg,
                "end" => CheckNodeSvg,
                "decision" => TriangleSvg,
                _ => PanelNodeSvg
            };
            var icon = InteractiveBlockIcons.Resolve(ReadText(node?["icon"]), fallbackIcon);
            var imageHtml = RenderOptionalImage(
                ReadText(node?["imageUrl"]),
                "lms-block-media",
                title);
            var nextControl = isLast
                ? ""
                : $"""
                  <button type="button" class="lms-flowchart__next" data-flowchart-next aria-label="Open the next step"{(isFirst ? "" : " hidden")}>
                    {DownArrowSvg}
                  </button>
                  <span class="lms-flowchart__connector" aria-hidden="true"></span>
                  """;

            nodesMarkup.Append(
                $"""
                <li class="lms-flowchart__item{(isFirst ? " is-open is-latest" : "")}" data-flowchart-node data-variant="{variant}"{(isFirst ? "" : " hidden")}>
                  <div class="lms-flowchart__card">
                    <div class="lms-flowchart__node">
                      <span class="lms-flowchart__shape" aria-hidden="true">{icon}</span>
                      <h3 class="lms-flowchart__title">{HtmlEncode(title)}</h3>
                    </div>
                    <div class="lms-flowchart__panel" data-flowchart-panel>
                      {imageHtml}{RenderParagraphs(body)}
                    </div>
                  </div>
                  {nextControl}
                </li>
                """);
        }

        var hint = ReadText(root["hint"]);
        var hintHtml = string.IsNullOrWhiteSpace(hint)
            ? ""
            : $"""<p class="lms-flowchart__hint">{HtmlEncode(hint)}</p>""";

        var html = FillTemplate(
            "flowchart.html",
            blockId,
            ("{{HEADING_HTML}}", RenderOptionalHeading(ReadText(root["heading"]), "lms-flowchart__heading")),
            ("{{INTRO_HTML}}", RenderOptionalIntro(ReadText(root["intro"]), "lms-flowchart__intro")),
            ("{{HINT_HTML}}", hintHtml),
            ("{{NODES_HTML}}", nodesMarkup.ToString()));

        var completionRule = JsonSerializer.Serialize(new
        {
            type = "flowchart",
            requireAllNodesOpened = true
        });

        return (html, completionRule);
    }

    private (string Html, string CompletionRuleJson) RenderOrdering(long blockId, string formPayloadJson)
    {
        var root = JsonNode.Parse(formPayloadJson) as JsonObject
            ?? throw new ArgumentException("Invalid form payload JSON.");

        var itemsArray = root["items"] as JsonArray
            ?? throw new ArgumentException("At least two items are required.");

        var items = new List<object>();
        foreach (var node in itemsArray)
        {
            var item = node as JsonObject;
            items.Add(new { text = ReadText(item?["text"]) });
        }

        var payload = new
        {
            items,
            correctFeedback = ReadText(root["correctFeedback"]),
            incorrectFeedback = ReadText(root["incorrectFeedback"])
        };

        var instruction = ReadText(root["instruction"]);
        var hint = ReadText(root["hint"]);
        var instructionHtml = string.IsNullOrWhiteSpace(instruction)
            ? ""
            : RenderParagraphs(instruction, "lms-ordering__heading");
        var hintHtml = string.IsNullOrWhiteSpace(hint)
            ? ""
            : $"""<p class="lms-ordering__hint">{HtmlEncode(hint)}</p>""";

        var html = FillTemplate(
            "ordering.html",
            blockId,
            ("{{HEADING_HTML}}", RenderOptionalHeading(ReadText(root["heading"]), "lms-ordering__title")),
            ("{{INSTRUCTION_HTML}}", instructionHtml),
            ("{{HINT_HTML}}", hintHtml),
            ("{{ORDERING_JSON}}", EscapeForScriptJson(JsonSerializer.Serialize(payload, CamelCaseJson))));

        var completionRule = JsonSerializer.Serialize(new
        {
            type = "ordering",
            requireCheckSubmitted = true
        });

        return (html, completionRule);
    }

    private static string NormaliseFlowchartVariant(string variant, int index, int count)
    {
        var value = variant.Trim().ToLowerInvariant();
        return value switch
        {
            "start" or "step" or "decision" or "end" => value,
            _ when index == 0 => "start",
            _ when count > 1 && index == count - 1 => "end",
            _ => "step"
        };
    }

    private static string RenderOptionalHeading(string heading, string className)
        => string.IsNullOrWhiteSpace(heading)
            ? ""
            : $"""<h2 class="{className}">{System.Net.WebUtility.HtmlEncode(heading)}</h2>""";

    private static string RenderOptionalIntro(string intro, string className)
        => string.IsNullOrWhiteSpace(intro)
            ? ""
            : $"""<p class="{className}">{HtmlEncode(intro)}</p>""";

    /// <summary>
    /// Optional learner-facing title and introduction. Empty values render nothing.
    /// Inset leads sit inside an existing white card; the default lead joins the card below it.
    /// </summary>
    private static string RenderBlockLead(JsonObject root, bool inset = false)
    {
        var heading = RenderOptionalHeading(ReadText(root["heading"]), "lmsbox-block-lead__heading");
        var intro = RenderOptionalIntro(ReadText(root["intro"]), "lmsbox-block-lead__intro");
        if (heading.Length == 0 && intro.Length == 0)
        {
            return "";
        }

        var classes = inset ? "lmsbox-block-lead lmsbox-block-lead--inset" : "lmsbox-block-lead";
        return $"""<div class="{classes}">{heading}{intro}</div>""";
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
                text = ReadText(q?["text"]),
                type,
                options,
                correctFeedback = ReadText(q?["correctFeedback"]),
                incorrectFeedback = ReadText(q?["incorrectFeedback"]),
                imageUrl = ReadText(q?["imageUrl"])
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
            ("{{LEAD_HTML}}", RenderBlockLead(root)),
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

    private (string Html, string CompletionRuleJson) RenderAudio(long blockId, string formPayloadJson)
    {
        var root = JsonNode.Parse(formPayloadJson) as JsonObject
            ?? throw new ArgumentException("Invalid form payload JSON.");

        var title = root["title"]?.GetValue<string>()?.Trim() ?? "";
        var description = root["description"]?.GetValue<string>()?.Trim() ?? "";
        var audioUrl = root["audioUrl"]?.GetValue<string>()?.Trim() ?? "";

        if (string.IsNullOrWhiteSpace(audioUrl))
        {
            throw new ArgumentException("Audio URL is required before generating this block.");
        }

        if (!Uri.TryCreate(audioUrl, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw new ArgumentException("Audio URL must be a valid http or https URL.");
        }

        var html = FillTemplate(
            "audio.html",
            blockId,
            ("{{TITLE}}", HtmlEncode(title)),
            ("{{DESCRIPTION}}", HtmlEncode(description)),
            ("{{AUDIO_SRC}}", HtmlEncodeAttribute(audioUrl)));

        var completionRule = JsonSerializer.Serialize(new
        {
            type = "audio",
            requirePlayedToEnd = true
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
                  referrerpolicy="strict-origin-when-cross-origin"
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
        string? hash = GetQueryValue(uri.Query, "h");
        var videoIndex = -1;

        if (host.Equals("player.vimeo.com", StringComparison.OrdinalIgnoreCase)
            && parts.Length >= 2
            && parts[0].Equals("video", StringComparison.OrdinalIgnoreCase))
        {
            videoId = parts[1];
            videoIndex = 1;
        }
        else
        {
            for (var i = 0; i < parts.Length; i++)
            {
                if (parts[i].All(char.IsDigit) && parts[i].Length >= 5)
                {
                    videoIndex = i;
                    videoId = parts[i];
                }
            }
        }

        if (videoIndex >= 0 && videoIndex + 1 < parts.Length && LooksLikeVimeoHash(parts[videoIndex + 1]))
        {
            hash ??= parts[videoIndex + 1];
        }

        if (string.IsNullOrWhiteSpace(videoId) || !videoId.All(char.IsDigit))
        {
            return false;
        }

        var query = "title=0&byline=0&portrait=0&dnt=1&api=1";
        if (!string.IsNullOrWhiteSpace(hash))
        {
            query += $"&h={Uri.EscapeDataString(hash)}";
        }

        embedUrl = $"https://player.vimeo.com/video/{videoId}?{query}";
        return true;
    }

    private static bool LooksLikeVimeoHash(string value)
        => value.Length is >= 6 and <= 24
           && value.Any(char.IsLetter)
           && value.All(char.IsLetterOrDigit);

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

    private static string ReadNodeIcon(JsonNode? node)
        => node is JsonObject obj ? ReadText(obj["icon"]) : "";

    private static string RenderOptionalImage(string url, string className, string alt)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return "";
        }

        return $"""<img class="{className}" src="{HtmlEncodeAttribute(url)}" alt="{HtmlEncodeAttribute(alt)}" />""";
    }

    /// <summary>
    /// Uses sanitized rich text when the author saved HTML, and plain paragraphs otherwise
    /// so blocks created before the editor still render.
    /// </summary>
    private static string RenderRichOrPlain(string? html, string plain, string? className = null)
    {
        if (InteractiveRichTextSanitizer.HasVisibleContent(html))
        {
            var sanitized = InteractiveRichTextSanitizer.Sanitize(html);
            if (string.IsNullOrWhiteSpace(className))
            {
                return sanitized;
            }

            return $"""<div class="{className}">{sanitized}</div>""";
        }

        return RenderParagraphs(plain, className);
    }

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
