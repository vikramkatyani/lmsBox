using Microsoft.Extensions.Options;
using SendGrid;
using SendGrid.Helpers.Mail;

namespace lmsBox.Server.Services
{
    public interface IEmailService
    {
        Task SendUserRegistrationNotificationAsync(string userEmail, string firstName, string lastName, string role, string loginUrl);
        Task SendEmailAsync(string to, string subject, string htmlBody, string? textBody = null);
    }

    public class EmailService : IEmailService
    {
        private readonly IWebHostEnvironment _env;
        private readonly IConfiguration _config;
        private readonly ILogger<EmailService> _logger;

        public EmailService(
            IWebHostEnvironment env,
            IConfiguration config,
            ILogger<EmailService> logger)
        {
            _env = env;
            _config = config;
            _logger = logger;
        }

        public async Task SendUserRegistrationNotificationAsync(string userEmail, string firstName, string lastName, string role, string loginUrl)
        {
            try
            {
                var appName = _config["AppSettings:AppName"] ?? _config["SendGrid:FromName"] ?? "LMS Box";
                var organizationName = _config["AppSettings:OrganizationName"] ?? "Your Organization";
                var supportEmail = _config["AppSettings:SupportEmail"] ?? "support@example.com";
                var supportPhone = _config["AppSettings:SupportPhone"];
                var unsubscribeUrl = _config["AppSettings:UnsubscribeUrl"];

                var templateData = new Dictionary<string, object>
                {
                    {"AppName", appName},
                    {"FirstName", firstName},
                    {"LastName", lastName},
                    {"Email", userEmail},
                    {"Role", role},
                    {"RegistrationDate", DateTime.Now.ToString("MMMM dd, yyyy")},
                    {"LoginUrl", loginUrl},
                    {"SupportEmail", supportEmail},
                    {"SupportPhone", supportPhone},
                    {"OrganizationName", organizationName},
                    {"Year", DateTime.Now.Year},
                    {"UnsubscribeUrl", unsubscribeUrl},
                    {"IsAdmin", role.ToLower().Contains("admin")}
                };

                var htmlBody = await LoadAndProcessTemplate("UserRegistrationNotification.html", templateData);
                var textBody = await LoadAndProcessTemplate("UserRegistrationNotification.txt", templateData);

                var subject = $"Welcome to {appName} - Your Account is Ready!";

                await SendEmailAsync(userEmail, subject, htmlBody, textBody);

                _logger.LogInformation("User registration notification sent to {Email}", userEmail);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send user registration notification to {Email}", userEmail);
                throw;
            }
        }

        public async Task SendEmailAsync(string to, string subject, string htmlBody, string? textBody = null)
        {
            var apiKey = _config["SendGrid:ApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                _logger.LogWarning("SendGrid API key not configured. Email would be sent to: {Email} with subject: {Subject}", to, subject);
                return;
            }

            try
            {
                var fromEmail = _config["SendGrid:FromEmail"] ?? "no-reply@example.com";
                var fromName = _config["SendGrid:FromName"] ?? "LMS Box";

                var client = new SendGridClient(apiKey);
                var from = new EmailAddress(fromEmail, fromName);
                var toAddress = new EmailAddress(to);

                var msg = MailHelper.CreateSingleEmail(
                    from, 
                    toAddress, 
                    subject, 
                    textBody ?? htmlBody, 
                    htmlBody
                );

                var response = await client.SendEmailAsync(msg);
                
                if ((int)response.StatusCode >= 400)
                {
                    var body = response.Body != null ? await response.Body.ReadAsStringAsync() : string.Empty;
                    _logger.LogWarning("SendGrid returned non-success status {StatusCode} sending to {Email}. Response: {ResponseBody}", 
                        (int)response.StatusCode, to, body);
                    throw new Exception($"SendGrid error: {response.StatusCode}");
                }

                _logger.LogInformation("Email sent successfully to {Email}", to);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email to {Email}", to);
                throw;
            }
        }

        private async Task<string> LoadAndProcessTemplate(string templateName, Dictionary<string, object> data)
        {
            var templatePath = Path.Combine(_env.ContentRootPath, "EmailTemplates", templateName);
            
            if (!File.Exists(templatePath))
            {
                _logger.LogWarning("Email template not found: {TemplatePath}", templatePath);
                return string.Empty;
            }

            var template = await File.ReadAllTextAsync(templatePath);
            
            // Simple template processing (replace {{key}} with values)
            foreach (var item in data)
            {
                var placeholder = $"{{{{{item.Key}}}}}";
                template = template.Replace(placeholder, item.Value?.ToString() ?? string.Empty);
            }

            // Handle conditional blocks like {{#if IsAdmin}}...{{/if}}
            template = ProcessConditionalBlocks(template, data);

            return template;
        }

        private string ProcessConditionalBlocks(string template, Dictionary<string, object> data)
        {
            // Simple conditional processing for {{#if key}}...{{/if}} blocks
            var result = template;
            
            foreach (var item in data)
            {
                var ifPattern = $"{{{{#if {item.Key}}}}}";
                var endIfPattern = "{{/if}}";
                
                while (result.Contains(ifPattern))
                {
                    var startIndex = result.IndexOf(ifPattern);
                    var endIndex = result.IndexOf(endIfPattern, startIndex);
                    
                    if (startIndex >= 0 && endIndex >= 0)
                    {
                        var beforeBlock = result.Substring(0, startIndex);
                        var blockContent = result.Substring(startIndex + ifPattern.Length, endIndex - startIndex - ifPattern.Length);
                        var afterBlock = result.Substring(endIndex + endIfPattern.Length);
                        
                        // Check if condition is true
                        var shouldInclude = false;
                        if (item.Value is bool boolValue)
                        {
                            shouldInclude = boolValue;
                        }
                        else if (item.Value != null)
                        {
                            shouldInclude = !string.IsNullOrEmpty(item.Value.ToString());
                        }
                        
                        result = beforeBlock + (shouldInclude ? blockContent : string.Empty) + afterBlock;
                    }
                    else
                    {
                        break;
                    }
                }
            }
            
            return result;
        }
    }
}