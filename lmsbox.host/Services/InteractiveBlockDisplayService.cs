using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using lmsbox.domain.Models;

namespace lmsBox.Server.Services;

public interface IInteractiveBlockDisplayService
{
    Task<string?> GetDisplayHtmlAsync(InteractiveBlock block);
    Task<string> SignMediaUrlsInPayloadAsync(string blockType, string formPayloadJson);
}

public class InteractiveBlockDisplayService : IInteractiveBlockDisplayService
{
    private static readonly Regex BlobUrlInHtmlRegex = new(
        @"https://[a-z0-9\-]+\.blob\.core\.windows\.net/[^\s""'<>]+",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly IInteractiveBlockTemplateService _templateService;
    private readonly IAzureBlobService _blobService;
    private readonly ILogger<InteractiveBlockDisplayService> _logger;

    public InteractiveBlockDisplayService(
        IInteractiveBlockTemplateService templateService,
        IAzureBlobService blobService,
        ILogger<InteractiveBlockDisplayService> logger)
    {
        _templateService = templateService;
        _blobService = blobService;
        _logger = logger;
    }

    public async Task<string?> GetDisplayHtmlAsync(InteractiveBlock block)
    {
        if (_templateService.SupportsTemplate(block.BlockType)
            && !string.IsNullOrWhiteSpace(block.FormPayloadJson))
        {
            try
            {
                var payload = await SignMediaUrlsInPayloadAsync(block.BlockType, block.FormPayloadJson);
                var (html, _) = _templateService.Render(
                    block.BlockType,
                    block.Id,
                    payload);
                return html;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Failed to render template for block {BlockId} ({BlockType}); falling back to stored HTML.",
                    block.Id,
                    block.BlockType);
            }
        }

        var stored = !string.IsNullOrWhiteSpace(block.EditedHtml)
            ? block.EditedHtml
            : block.GeneratedHtml;

        if (string.IsNullOrWhiteSpace(stored))
        {
            return stored;
        }

        return await SignBlobUrlsInHtmlAsync(stored);
    }

    public async Task<string> SignMediaUrlsInPayloadAsync(string blockType, string formPayloadJson)
    {
        if (string.IsNullOrWhiteSpace(formPayloadJson) || !_blobService.IsConfigured())
        {
            return formPayloadJson;
        }

        JsonObject? root;
        try
        {
            root = JsonNode.Parse(formPayloadJson) as JsonObject;
        }
        catch
        {
            return formPayloadJson;
        }

        if (root == null)
        {
            return formPayloadJson;
        }

        var type = blockType?.Trim().ToLowerInvariant() ?? "";

        if (type == "video")
        {
            await SignJsonStringPropertyAsync(root, "videoUrl");
        }
        else if (type == "hero")
        {
            await SignJsonStringPropertyAsync(root, "backgroundImageUrl");
        }
        else if (type == "hotspot")
        {
            await SignJsonStringPropertyAsync(root, "imageUrl");
        }
        else if (type == "carousel" && root["slides"] is JsonArray slides)
        {
            foreach (var node in slides)
            {
                if (node is JsonObject slide)
                {
                    await SignJsonStringPropertyAsync(slide, "imageUrl");
                }
            }
        }

        return root.ToJsonString();
    }

    private async Task SignJsonStringPropertyAsync(JsonObject obj, string propertyName)
    {
        var value = obj[propertyName]?.GetValue<string>()?.Trim();
        if (string.IsNullOrWhiteSpace(value) || !IsAzureBlobUrl(value))
        {
            return;
        }

        try
        {
            obj[propertyName] = await _blobService.GetSasUrlAsync(value, 24);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to generate SAS URL for interactive block media {Property}", propertyName);
        }
    }

    private async Task<string> SignBlobUrlsInHtmlAsync(string html)
    {
        if (!_blobService.IsConfigured() || string.IsNullOrWhiteSpace(html))
        {
            return html;
        }

        var matches = BlobUrlInHtmlRegex.Matches(html);
        if (matches.Count == 0)
        {
            return html;
        }

        var replacements = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (Match match in matches)
        {
            var url = match.Value;
            // Strip trailing punctuation that isn't part of the URL path/query
            url = url.TrimEnd(')', ']', '.', ',', ';');
            if (replacements.ContainsKey(url) || !IsAzureBlobUrl(url))
            {
                continue;
            }

            // Skip URLs that already have a SAS token
            if (url.Contains("sig=", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            try
            {
                replacements[url] = await _blobService.GetSasUrlAsync(url, 24);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to generate SAS URL for HTML blob reference");
            }
        }

        foreach (var (original, signed) in replacements)
        {
            html = html.Replace(original, signed, StringComparison.Ordinal);
        }

        return html;
    }

    private static bool IsAzureBlobUrl(string url)
        => url.Contains("blob.core.windows.net", StringComparison.OrdinalIgnoreCase);
}
