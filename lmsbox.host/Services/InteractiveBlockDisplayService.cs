using lmsbox.domain.Models;

namespace lmsBox.Server.Services;

public interface IInteractiveBlockDisplayService
{
    string? GetDisplayHtml(InteractiveBlock block);
}

public class InteractiveBlockDisplayService : IInteractiveBlockDisplayService
{
    private readonly IInteractiveBlockTemplateService _templateService;
    private readonly ILogger<InteractiveBlockDisplayService> _logger;

    public InteractiveBlockDisplayService(
        IInteractiveBlockTemplateService templateService,
        ILogger<InteractiveBlockDisplayService> logger)
    {
        _templateService = templateService;
        _logger = logger;
    }

    public string? GetDisplayHtml(InteractiveBlock block)
    {
        if (_templateService.SupportsTemplate(block.BlockType)
            && !string.IsNullOrWhiteSpace(block.FormPayloadJson))
        {
            try
            {
                var (html, _) = _templateService.Render(
                    block.BlockType,
                    block.Id,
                    block.FormPayloadJson);
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

        return !string.IsNullOrWhiteSpace(block.EditedHtml)
            ? block.EditedHtml
            : block.GeneratedHtml;
    }
}
