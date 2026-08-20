using Microsoft.Extensions.Options;
using SendGrid;
using SendGrid.Helpers.Mail;
using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace lmsBox.Server.Services
{
    public interface IEmailService
    {
        Task SendUserRegistrationNotificationAsync(string userEmail, string firstName, string lastName, string role, string loginUrl);
        Task SendLoginLinkEmailAsync(string userEmail, string loginUrl, int expiryMinutes, string organisationId, string? firstName = null);
        Task SendLearnerRegistrationEmailAsync(string userEmail, string portalUrl, string organisationId, string? firstName = null, List<string>? courseNames = null);
        Task SendPathwayAssignmentEmailAsync(string userEmail, string organisationId, string portalUrl, List<string> pathwayNames, List<string> courseNames, string? firstName = null);
        Task SendNewCourseAccessEmailAsync(string userEmail, string organisationId, string portalUrl, List<string> courseNames, string? pathwayName = null, string? firstName = null);
        Task SendEmailAsync(string to, string subject, string htmlBody, string? textBody = null);
    }

    public class EmailService : IEmailService
    {
        private readonly IWebHostEnvironment _env;
        private readonly IConfiguration _config;
        private readonly ILogger<EmailService> _logger;
        private readonly ApplicationDbContext _context;

        public EmailService(
            IWebHostEnvironment env,
            IConfiguration config,
            ILogger<EmailService> logger,
            ApplicationDbContext context)
        {
            _env = env;
            _config = config;
            _logger = logger;
            _context = context;
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
                _logger.LogError("SendGrid API key is not configured. Cannot send email to {Email}", to);
                if (_env.IsDevelopment())
                {
                    _logger.LogWarning("Development: skipping SendGrid send to {Email} ({Subject})", to, subject);
                    return;
                }

                throw new InvalidOperationException("Email sending is not configured on this server.");
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
                templatePath = Path.Combine(AppContext.BaseDirectory, "EmailTemplates", templateName);
            }

            if (!File.Exists(templatePath))
            {
                _logger.LogWarning("Email template not found: {TemplateName}", templateName);
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
            // Simple conditional processing for {{#if key}}...{{else}}...{{/if}} blocks
            var result = template;
            
            foreach (var item in data)
            {
                var ifPattern = $"{{{{#if {item.Key}}}}}";
                var elsePattern = "{{else}}";
                var endIfPattern = "{{/if}}";
                
                while (result.Contains(ifPattern))
                {
                    var startIndex = result.IndexOf(ifPattern);
                    var endIndex = result.IndexOf(endIfPattern, startIndex);
                    
                    if (startIndex >= 0 && endIndex >= 0)
                    {
                        var beforeBlock = result.Substring(0, startIndex);
                        var fullBlock = result.Substring(startIndex + ifPattern.Length, endIndex - startIndex - ifPattern.Length);
                        var afterBlock = result.Substring(endIndex + endIfPattern.Length);
                        
                        // Check for else block
                        string trueContent;
                        string falseContent = string.Empty;
                        
                        var elseIndex = fullBlock.IndexOf(elsePattern);
                        if (elseIndex >= 0)
                        {
                            trueContent = fullBlock.Substring(0, elseIndex);
                            falseContent = fullBlock.Substring(elseIndex + elsePattern.Length);
                        }
                        else
                        {
                            trueContent = fullBlock;
                        }
                        
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
                        
                        result = beforeBlock + (shouldInclude ? trueContent : falseContent) + afterBlock;
                    }
                    else
                    {
                        break;
                    }
                }
            }
            
            return result;
        }

        public async Task SendLoginLinkEmailAsync(string userEmail, string loginUrl, int expiryMinutes, string organisationId, string? firstName = null)
        {
            try
            {
                // Fetch organization details from database
                var orgId = long.Parse(organisationId);
                var organisation = await _context.Organisations
                    .FirstOrDefaultAsync(o => o.Id == orgId);

                var brandName = organisation?.BrandName ?? _config["AppSettings:AppName"] ?? "LMS Box";
                var supportEmail = organisation?.SupportEmail ?? _config["AppSettings:SupportEmail"] ?? "support@example.com";

                var templateData = new Dictionary<string, object>
                {
                    {"BrandName", brandName},
                    {"FirstName", firstName ?? ""},
                    {"LoginUrl", loginUrl},
                    {"ExpiryMinutes", expiryMinutes},
                    {"SupportEmail", supportEmail},
                    {"Year", DateTime.Now.Year}
                };

                var htmlBody = await LoadAndProcessTemplate("LoginLinkEmail.html", templateData);
                var subject = $"Your Secure Login Link for {brandName} learning portal";

                await SendEmailAsync(userEmail, subject, htmlBody);

                _logger.LogInformation("Login link email sent to {Email}", userEmail);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send login link email to {Email}", userEmail);
                throw;
            }
        }

        public async Task SendLearnerRegistrationEmailAsync(string userEmail, string portalUrl, string organisationId, string? firstName = null, List<string>? courseNames = null)
        {
            try
            {
                // Fetch organization details from database
                var orgId = long.Parse(organisationId);
                var organisation = await _context.Organisations
                    .FirstOrDefaultAsync(o => o.Id == orgId);

                var brandName = organisation?.BrandName ?? _config["AppSettings:AppName"] ?? "LMS Box";
                var supportEmail = organisation?.SupportEmail ?? _config["AppSettings:SupportEmail"] ?? "support@example.com";

                // Generate course list HTML if courses are provided
                var hasCourses = courseNames != null && courseNames.Any();
                var courseListHtml = hasCourses ? string.Join("", courseNames!.Select(c => $"<li>{c}</li>")) : "";

                var templateData = new Dictionary<string, object>
                {
                    {"BrandName", brandName},
                    {"FirstName", firstName ?? ""},
                    {"Email", userEmail},
                    {"PortalUrl", portalUrl},
                    {"HasCourses", hasCourses},
                    {"CourseListHtml", courseListHtml},
                    {"CourseCount", hasCourses ? courseNames!.Count : 0},
                    {"SupportEmail", supportEmail},
                    {"Year", DateTime.Now.Year}
                };

                var htmlBody = await LoadAndProcessTemplate("LearnerRegistrationEmail.html", templateData);
                var subject = $"Welcome to {brandName} learning portal";

                await SendEmailAsync(userEmail, subject, htmlBody);

                _logger.LogInformation("Learner registration email sent to {Email}", userEmail);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send learner registration email to {Email}", userEmail);
                throw;
            }
        }

        public async Task SendPathwayAssignmentEmailAsync(string userEmail, string organisationId, string portalUrl, List<string> pathwayNames, List<string> courseNames, string? firstName = null)
        {
            try
            {
                // Fetch organization details from database
                var orgId = long.Parse(organisationId);
                var organisation = await _context.Organisations
                    .FirstOrDefaultAsync(o => o.Id == orgId);

                var brandName = organisation?.BrandName ?? _config["AppSettings:AppName"] ?? "LMS Box";
                var supportEmail = organisation?.SupportEmail ?? _config["AppSettings:SupportEmail"] ?? "support@example.com";

                // Generate course list HTML
                var courseListHtml = string.Join("", courseNames.Select(c => $"<li>{c}</li>"));
                var pathwayListText = string.Join(", ", pathwayNames);

                var templateData = new Dictionary<string, object>
                {
                    {"BrandName", brandName},
                    {"FirstName", firstName ?? ""},
                    {"PortalUrl", portalUrl},
                    {"PathwayNames", pathwayListText},
                    {"CourseListHtml", courseListHtml},
                    {"CourseCount", courseNames.Count},
                    {"SupportEmail", supportEmail},
                    {"Year", DateTime.Now.Year}
                };

                var htmlBody = await LoadAndProcessTemplate("PathwayAssignmentEmail.html", templateData);
                var pathwayText = pathwayNames.Count == 1 ? pathwayNames[0] : $"{pathwayNames.Count} learning pathways";
                var subject = $"New Learning Pathway Assigned - {brandName}";

                await SendEmailAsync(userEmail, subject, htmlBody);

                _logger.LogInformation("Pathway assignment email sent to {Email}", userEmail);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send pathway assignment email to {Email}", userEmail);
                throw;
            }
        }

        public async Task SendNewCourseAccessEmailAsync(string userEmail, string organisationId, string portalUrl, List<string> courseNames, string? pathwayName = null, string? firstName = null)
        {
            try
            {
                // Fetch organization details from database
                var orgId = long.Parse(organisationId);
                var organisation = await _context.Organisations
                    .FirstOrDefaultAsync(o => o.Id == orgId);

                var brandName = organisation?.BrandName ?? _config["AppSettings:AppName"] ?? "LMS Box";
                var supportEmail = organisation?.SupportEmail ?? _config["AppSettings:SupportEmail"] ?? "support@example.com";

                // Generate course list HTML
                var courseListHtml = string.Join("", courseNames.Select(c => $"<li>{c}</li>"));
                var isMultipleCourses = courseNames.Count > 1;

                var templateData = new Dictionary<string, object>
                {
                    {"BrandName", brandName},
                    {"FirstName", firstName ?? ""},
                    {"PortalUrl", portalUrl},
                    {"PathwayName", pathwayName ?? ""},
                    {"CourseListHtml", courseListHtml},
                    {"CourseCount", courseNames.Count},
                    {"IsMultipleCourses", isMultipleCourses},
                    {"SupportEmail", supportEmail},
                    {"Year", DateTime.Now.Year}
                };

                var htmlBody = await LoadAndProcessTemplate("NewCourseAccessEmail.html", templateData);
                var subject = isMultipleCourses 
                    ? $"New Courses Available - {brandName}" 
                    : $"New Course Available - {brandName}";

                await SendEmailAsync(userEmail, subject, htmlBody);

                _logger.LogInformation("New course access email sent to {Email} for {CourseCount} course(s)", userEmail, courseNames.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send new course access email to {Email}", userEmail);
                throw;
            }
        }
    }
}