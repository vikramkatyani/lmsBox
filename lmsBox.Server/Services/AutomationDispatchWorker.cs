using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace lmsBox.Server.Services;

public class AutomationDispatchWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<AutomationDispatchWorker> _logger;

    public AutomationDispatchWorker(IServiceProvider serviceProvider, ILogger<AutomationDispatchWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Automation dispatch worker started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessPendingDispatches(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Automation dispatch worker cycle failed");
            }

            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }

        _logger.LogInformation("Automation dispatch worker stopped");
    }

    private async Task ProcessPendingDispatches(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();

        var nowUtc = DateTime.UtcNow;
        var pending = await context.AutomationDispatches
            .Where(d =>
                d.Status == "Pending" &&
                d.ScheduledForUtc <= nowUtc &&
                d.AutomationTask != null &&
                d.AutomationTask.Status == "Published")
            .OrderBy(d => d.ScheduledForUtc)
            .ThenBy(d => d.Id)
            .Take(50)
            .ToListAsync(stoppingToken);

        if (!pending.Any()) return;

        foreach (var dispatch in pending)
        {
            if (stoppingToken.IsCancellationRequested) break;

            try
            {
                dispatch.Status = "Processing";
                dispatch.UpdatedAtUtc = DateTime.UtcNow;
                await context.SaveChangesAsync(stoppingToken);

                await emailService.SendEmailAsync(
                    dispatch.RecipientEmail,
                    dispatch.SubjectSnapshot,
                    dispatch.BodySnapshot);

                dispatch.Status = "Sent";
                dispatch.SentAtUtc = DateTime.UtcNow;
                dispatch.UpdatedAtUtc = DateTime.UtcNow;
                await context.SaveChangesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                dispatch.Attempts += 1;
                dispatch.LastError = ex.Message;
                dispatch.UpdatedAtUtc = DateTime.UtcNow;

                if (dispatch.Attempts >= 3)
                {
                    dispatch.Status = "Failed";
                }
                else
                {
                    dispatch.Status = "Pending";
                    dispatch.ScheduledForUtc = DateTime.UtcNow.AddMinutes(Math.Pow(2, dispatch.Attempts));
                }

                await context.SaveChangesAsync(stoppingToken);
                _logger.LogError(ex, "Failed sending automation dispatch {DispatchId}", dispatch.Id);
            }
        }
    }
}
