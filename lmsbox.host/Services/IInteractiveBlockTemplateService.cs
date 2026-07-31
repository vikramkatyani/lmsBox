namespace lmsBox.Server.Services;

public interface IInteractiveBlockTemplateService
{
    bool SupportsTemplate(string blockType);

    /// <summary>
    /// Fills a fixed HTML template from structured form payload.
    /// Returns HTML fragment and completion rule JSON.
    /// </summary>
    (string Html, string CompletionRuleJson) Render(string blockType, long blockId, string formPayloadJson);
}
