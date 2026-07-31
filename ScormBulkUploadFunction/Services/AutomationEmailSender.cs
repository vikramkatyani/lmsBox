using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SendGrid;
using SendGrid.Helpers.Mail;

namespace ScormBulkUploadFunction.Services;

public class AutomationEmailSender : IAutomationEmailSender
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<AutomationEmailSender> _logger;

    public AutomationEmailSender(IConfiguration configuration, ILogger<AutomationEmailSender> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendAsync(string to, string subject, string htmlBody)
    {
        var apiKey = _configuration["SendGrid:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("SendGrid API key is not configured in function settings.");
        }

        var fromEmail = _configuration["SendGrid:FromEmail"] ?? "notification@lmsbox.co.uk";
        var fromName = _configuration["SendGrid:FromName"] ?? "lmsbox";

        var client = new SendGridClient(apiKey);
        var message = MailHelper.CreateSingleEmail(
            new EmailAddress(fromEmail, fromName),
            new EmailAddress(to),
            subject,
            htmlBody,
            htmlBody);

        var response = await client.SendEmailAsync(message);
        if ((int)response.StatusCode >= 400)
        {
            var body = response.Body != null ? await response.Body.ReadAsStringAsync() : string.Empty;
            _logger.LogWarning("SendGrid returned {StatusCode} for {Email}. Body: {ResponseBody}", (int)response.StatusCode, to, body);
            throw new InvalidOperationException($"SendGrid error {(int)response.StatusCode}");
        }
    }
}
