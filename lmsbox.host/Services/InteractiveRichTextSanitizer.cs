using System.Text;
using System.Text.RegularExpressions;
using AngleSharp.Dom;
using AngleSharp.Html.Dom;
using AngleSharp.Html.Parser;
using Ganss.Xss;

namespace lmsBox.Server.Services;

/// <summary>
/// Allow-list sanitizer for admin authored rich text in interactive lesson blocks.
/// Block HTML is rendered inside an iframe that keeps the application origin, so any
/// scriptable markup surviving this step would execute with the learner's session.
/// </summary>
public static class InteractiveRichTextSanitizer
{
    private static readonly string[] AllowedTags =
    [
        "p", "br", "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup",
        "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "code", "pre", "hr", "span", "a",
        "table", "caption", "colgroup", "col", "thead", "tbody", "tfoot", "tr", "th", "td"
    ];

    private static readonly string[] AllowedAttributes =
    [
        "href", "title", "style", "start", "target", "rel",
        // Table geometry. "colwidth" is non-standard but the editor needs it to restore
        // column widths when the block is opened again.
        "colspan", "rowspan", "colwidth", "scope"
    ];

    /// <summary>Upper bound for authored column widths, so a stray value cannot blow out the layout.</summary>
    private const int MaxWidthPixels = 2000;

    private static readonly HashSet<string> CellScopes = new(StringComparer.OrdinalIgnoreCase)
    {
        "row", "col", "rowgroup", "colgroup"
    };

    private static readonly Regex PixelWidth = new(@"^(\d{1,5})(?:\.\d+)?px$", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex ColumnWidths = new(@"^\d{1,5}(,\d{1,5})*$", RegexOptions.Compiled);

    /// <summary>
    /// Font sizes offered by the editor, keyed by every spelling we accept on input.
    /// The floor is 14px so authored text cannot drop below the WCAG baseline.
    /// </summary>
    private static readonly Dictionary<string, string> FontSizes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["14px"] = "0.875rem",
        ["0.875rem"] = "0.875rem",
        ["16px"] = "1rem",
        ["1rem"] = "1rem",
        ["18px"] = "1.125rem",
        ["1.125rem"] = "1.125rem",
        ["20px"] = "1.25rem",
        ["1.25rem"] = "1.25rem"
    };

    private static readonly HashSet<string> TextAlignments = new(StringComparer.OrdinalIgnoreCase)
    {
        "left", "center", "right", "justify"
    };

    private static readonly HashSet<string> BlockTags = new(StringComparer.OrdinalIgnoreCase)
    {
        "p", "br", "div", "h1", "h2", "h3", "h4", "h5", "h6",
        "ul", "ol", "li", "blockquote", "pre", "hr", "table", "tr", "caption"
    };

    /// <summary>Table cells sit on one line, separated so neighbouring values do not run together.</summary>
    private static readonly HashSet<string> CellTags = new(StringComparer.OrdinalIgnoreCase)
    {
        "th", "td"
    };

    /// <summary>
    /// Elements dropped with their contents. Unknown containers are unwrapped instead, but the
    /// text inside these carries code or metadata rather than lesson content.
    /// </summary>
    private const string StrippedSelector =
        "script, style, noscript, template, iframe, object, embed, svg, math, " +
        "link, meta, title, input, select, textarea, button";

    /// <summary>Heading levels outside the allow-list, mapped so pasted structure survives.</summary>
    private static readonly Dictionary<string, string> HeadingReplacements = new(StringComparer.OrdinalIgnoreCase)
    {
        ["h1"] = "h2",
        ["h5"] = "h4",
        ["h6"] = "h4"
    };

    private static readonly Regex AnyWhitespace = new(@"\s+", RegexOptions.Compiled);
    private static readonly Regex InlineWhitespace = new(@"[^\S\n]+", RegexOptions.Compiled);
    private static readonly Regex PaddedNewline = new(@" *\n *", RegexOptions.Compiled);
    private static readonly Regex RepeatedNewlines = new(@"\n{3,}", RegexOptions.Compiled);

    // HtmlSanitizer is not documented as thread safe, and block rendering runs on request threads.
    private static readonly ThreadLocal<HtmlSanitizer> Sanitizer = new(CreateSanitizer);

    /// <summary>Strips everything outside the allow-list and forces links to open safely.</summary>
    public static string Sanitize(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return string.Empty;
        }

        var prepared = ParseBody(html)?.InnerHtml ?? string.Empty;
        var sanitized = Sanitizer.Value!.Sanitize(prepared);

        var document = new HtmlParser().ParseDocument($"<body>{sanitized}</body>");
        if (document.Body is null)
        {
            return sanitized.Trim();
        }

        ShapeTables(document, document.Body);
        return document.Body.InnerHtml.Trim();
    }

    /// <summary>
    /// Adds the header scopes screen readers need and wraps each table in a focusable
    /// scroll container so wide tables stay reachable on narrow screens.
    /// </summary>
    private static void ShapeTables(IDocument document, IElement body)
    {
        foreach (var table in body.QuerySelectorAll("table").ToArray())
        {
            var rows = table.QuerySelectorAll("tr");
            for (var rowIndex = 0; rowIndex < rows.Length; rowIndex++)
            {
                var cells = rows[rowIndex].Children;
                for (var cellIndex = 0; cellIndex < cells.Length; cellIndex++)
                {
                    var cell = cells[cellIndex];
                    if (!cell.LocalName.Equals("th", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    // A header in the first column of a later row labels that row; everything
                    // else (including the top-left corner cell) labels its column.
                    cell.SetAttribute("scope", rowIndex > 0 && cellIndex == 0 ? "row" : "col");
                }
            }

            var wrapper = document.CreateElement("div");
            wrapper.SetAttribute("class", "lmsbox-text__table");
            wrapper.SetAttribute("role", "region");
            wrapper.SetAttribute("aria-label", "Table");
            wrapper.SetAttribute("tabindex", "0");

            table.Replace(wrapper);
            wrapper.AppendChild(table);
        }
    }

    /// <summary>Flattens rich text to plain text for emptiness and length checks.</summary>
    public static string ToPlainText(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return string.Empty;
        }

        var builder = new StringBuilder();
        AppendText(ParseBody(html), builder);

        var text = InlineWhitespace.Replace(builder.ToString(), " ");
        text = PaddedNewline.Replace(text, "\n");
        text = RepeatedNewlines.Replace(text, "\n\n");
        return text.Trim();
    }

    /// <summary>
    /// Counts visible characters the way the editor's counter does: text only, with no
    /// separator between blocks. Keeping the two in step means the server never rejects a
    /// body the editor allowed the author to type.
    /// </summary>
    public static int CountCharacters(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return 0;
        }

        var builder = new StringBuilder();
        AppendRawText(ParseBody(html), builder);

        return AnyWhitespace.Replace(builder.ToString(), " ").Trim().Length;
    }

    public static bool HasVisibleContent(string? html)
        => CountCharacters(html) > 0;

    /// <summary>
    /// Returns the first link the sanitizer would strip, so callers can fail the save
    /// with a message instead of silently dropping the author's link.
    /// </summary>
    public static bool TryFindUnsupportedLink(string? html, out string href)
    {
        href = string.Empty;
        if (string.IsNullOrWhiteSpace(html))
        {
            return false;
        }

        var body = ParseBody(html);
        if (body is null)
        {
            return false;
        }

        foreach (var anchor in body.QuerySelectorAll("a"))
        {
            var value = anchor.GetAttribute("href");
            if (!IsSupportedLink(value))
            {
                href = string.IsNullOrWhiteSpace(value) ? "(empty)" : value!.Trim();
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// Parses a fragment and normalizes it before the allow-list pass: code bearing elements go
    /// away entirely, and out of range heading levels are folded into the supported ones.
    /// </summary>
    private static IElement? ParseBody(string html)
    {
        var document = new HtmlParser().ParseDocument($"<body>{html}</body>");
        var body = document.Body;
        if (body is null)
        {
            return null;
        }

        foreach (var element in body.QuerySelectorAll(StrippedSelector).ToArray())
        {
            element.Remove();
        }

        foreach (var heading in body.QuerySelectorAll("h1, h5, h6").ToArray())
        {
            var replacement = document.CreateElement(HeadingReplacements[heading.LocalName]);
            replacement.InnerHtml = heading.InnerHtml;
            heading.Replace(replacement);
        }

        return body;
    }

    private static HtmlSanitizer CreateSanitizer()
    {
        var sanitizer = new HtmlSanitizer();

        sanitizer.AllowedTags.Clear();
        foreach (var tag in AllowedTags)
        {
            sanitizer.AllowedTags.Add(tag);
        }

        sanitizer.AllowedAttributes.Clear();
        foreach (var attribute in AllowedAttributes)
        {
            sanitizer.AllowedAttributes.Add(attribute);
        }

        sanitizer.AllowedCssProperties.Clear();
        sanitizer.AllowedCssProperties.Add("text-align");
        sanitizer.AllowedCssProperties.Add("font-size");
        // Column widths from the table resize handles.
        sanitizer.AllowedCssProperties.Add("width");
        sanitizer.AllowedCssProperties.Add("min-width");

        sanitizer.AllowedSchemes.Clear();
        sanitizer.AllowedSchemes.Add("http");
        sanitizer.AllowedSchemes.Add("https");
        sanitizer.AllowedSchemes.Add("mailto");

        sanitizer.AllowedAtRules.Clear();
        sanitizer.AllowDataAttributes = false;

        // Unwrap unknown containers (common when pasting from Word or a web page)
        // rather than discarding the text they hold.
        sanitizer.KeepChildNodes = true;

        sanitizer.PostProcessNode += (_, e) =>
        {
            if (e.Node is not IElement element)
            {
                return;
            }

            NormalizeStyle(element);
            NormalizeTableAttributes(element);

            if (element is IHtmlAnchorElement anchor)
            {
                NormalizeAnchor(anchor);
            }
        };

        return sanitizer;
    }

    private static void NormalizeStyle(IElement element)
    {
        var declarations = element.GetAttribute("style");
        if (string.IsNullOrWhiteSpace(declarations))
        {
            return;
        }

        var kept = new List<string>();
        foreach (var declaration in declarations.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var separator = declaration.IndexOf(':');
            if (separator <= 0)
            {
                continue;
            }

            var property = declaration[..separator].Trim();
            var value = declaration[(separator + 1)..].Trim();

            if (property.Equals("text-align", StringComparison.OrdinalIgnoreCase) && TextAlignments.Contains(value))
            {
                kept.Add($"text-align: {value.ToLowerInvariant()}");
            }
            else if (property.Equals("font-size", StringComparison.OrdinalIgnoreCase) && FontSizes.TryGetValue(value, out var size))
            {
                kept.Add($"font-size: {size}");
            }
            else if ((property.Equals("width", StringComparison.OrdinalIgnoreCase)
                    || property.Equals("min-width", StringComparison.OrdinalIgnoreCase))
                && TryReadPixelWidth(value, out var pixels))
            {
                kept.Add($"{property.ToLowerInvariant()}: {pixels}px");
            }
        }

        if (kept.Count == 0)
        {
            element.RemoveAttribute("style");
        }
        else
        {
            element.SetAttribute("style", string.Join("; ", kept));
        }
    }

    private static bool TryReadPixelWidth(string value, out int pixels)
    {
        pixels = 0;
        var match = PixelWidth.Match(value);
        if (!match.Success || !int.TryParse(match.Groups[1].Value, out var parsed) || parsed <= 0)
        {
            return false;
        }

        pixels = Math.Min(parsed, MaxWidthPixels);
        return true;
    }

    /// <summary>Drops table geometry attributes that carry values the table model would not produce.</summary>
    private static void NormalizeTableAttributes(IElement element)
    {
        foreach (var name in new[] { "colspan", "rowspan" })
        {
            var value = element.GetAttribute(name);
            if (value is null)
            {
                continue;
            }

            if (!int.TryParse(value, out var span) || span < 1 || span > 100)
            {
                element.RemoveAttribute(name);
            }
        }

        var colwidth = element.GetAttribute("colwidth");
        if (colwidth is not null && !ColumnWidths.IsMatch(colwidth))
        {
            element.RemoveAttribute("colwidth");
        }

        var scope = element.GetAttribute("scope");
        if (scope is not null && !CellScopes.Contains(scope))
        {
            element.RemoveAttribute("scope");
        }
    }

    private static void NormalizeAnchor(IHtmlAnchorElement anchor)
    {
        if (!IsSupportedLink(anchor.GetAttribute("href")))
        {
            anchor.RemoveAttribute("href");
            anchor.RemoveAttribute("target");
            anchor.RemoveAttribute("rel");
            return;
        }

        // The block lives in an iframe, so in-place navigation would replace the lesson.
        anchor.SetAttribute("target", "_blank");
        anchor.SetAttribute("rel", "noopener noreferrer nofollow");
    }

    private static bool IsSupportedLink(string? href)
    {
        if (string.IsNullOrWhiteSpace(href))
        {
            return false;
        }

        if (!Uri.TryCreate(href.Trim(), UriKind.Absolute, out var uri))
        {
            return false;
        }

        return uri.Scheme == Uri.UriSchemeHttp
            || uri.Scheme == Uri.UriSchemeHttps
            || uri.Scheme == Uri.UriSchemeMailto;
    }

    private static void AppendRawText(INode? node, StringBuilder builder)
    {
        if (node is null)
        {
            return;
        }

        foreach (var child in node.ChildNodes)
        {
            switch (child)
            {
                case IText text:
                    builder.Append(text.Data);
                    break;

                case IElement element:
                    AppendRawText(element, builder);
                    break;
            }
        }
    }

    private static void AppendText(INode? node, StringBuilder builder)
    {
        if (node is null)
        {
            return;
        }

        foreach (var child in node.ChildNodes)
        {
            switch (child)
            {
                case IText text:
                    builder.Append(text.Data);
                    break;

                case IElement element:
                    var separator = BlockTags.Contains(element.LocalName)
                        ? '\n'
                        : CellTags.Contains(element.LocalName)
                            ? ' '
                            : '\0';

                    if (separator != '\0')
                    {
                        builder.Append(separator);
                    }

                    AppendText(element, builder);

                    if (separator != '\0')
                    {
                        builder.Append(separator);
                    }

                    break;
            }
        }
    }
}
