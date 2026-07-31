using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using ScormBulkUploadFunction.Services;
using System.Net;

namespace ScormBulkUploadFunction.Functions;

public class AutomationDispatchHealthFunction
{
    private readonly ILogger<AutomationDispatchHealthFunction> _logger;
    private readonly IAutomationDispatchService _dispatchService;

    public AutomationDispatchHealthFunction(
        ILogger<AutomationDispatchHealthFunction> logger,
        IAutomationDispatchService dispatchService)
    {
        _logger = logger;
        _dispatchService = dispatchService;
    }

    [Function("GetAutomationDispatchHealth")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "automation/dispatch-health")] HttpRequestData req)
    {
        _logger.LogInformation("Automation dispatch health endpoint requested");

        var summary = await _dispatchService.GetHealthSummaryAsync();

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(summary);
        return response;
    }
}
