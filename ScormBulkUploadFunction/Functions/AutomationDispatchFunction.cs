using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using ScormBulkUploadFunction.Services;

namespace ScormBulkUploadFunction.Functions;

public class AutomationDispatchFunction
{
    private readonly ILogger<AutomationDispatchFunction> _logger;
    private readonly IAutomationDispatchService _dispatchService;

    public AutomationDispatchFunction(
        ILogger<AutomationDispatchFunction> logger,
        IAutomationDispatchService dispatchService)
    {
        _logger = logger;
        _dispatchService = dispatchService;
    }

    [Function("ProcessAutomationDispatches")]
    public async Task Run([TimerTrigger("*/30 * * * * *")] TimerInfo timer)
    {
        var startedAt = DateTime.UtcNow;
        _logger.LogInformation("Automation dispatch function triggered at {StartedAt}", startedAt);

        var result = await _dispatchService.ProcessPendingDispatchesAsync();

        _logger.LogInformation(
            "Automation dispatch cycle completed in {DurationMs}ms. Picked={Picked}, Sent={Sent}, Failed={Failed}",
            (DateTime.UtcNow - startedAt).TotalMilliseconds,
            result.PickedCount,
            result.SentCount,
            result.FailedCount);
    }
}
