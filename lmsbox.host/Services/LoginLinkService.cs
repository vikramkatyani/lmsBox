using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using SendGrid;
using SendGrid.Helpers.Mail;

namespace lmsBox.Server.Services
{
    public class LoginLinkService : ILoginLinkService
    {
        private readonly ApplicationDbContext _db;
        private readonly IConfiguration _config;
        private readonly ILogger<LoginLinkService> _logger;
        private readonly IEmailService _emailService;

        public LoginLinkService(ApplicationDbContext db, IConfiguration config, ILogger<LoginLinkService> logger, IEmailService emailService)
        {
            _db = db;
            _config = config;
            _logger = logger;
            _emailService = emailService;
        }

        // Return bool to avoid returning the raw link/token to callers.
        public async Task<bool> CreateAndSendLoginLinkAsync(ApplicationUser user, string? tenantCode = null)
        {
            // Check if user is active (ActiveStatus = 1)
            if (user.ActiveStatus != 1)
            {
                _logger.LogWarning("Login link requested for inactive user {UserId} with ActiveStatus {ActiveStatus}", user.Id, user.ActiveStatus);
                return false;
            }

            var now = DateTime.UtcNow;

            // Expire any existing active tokens for this user (single-active-token enforcement)
            var activeTokens = await _db.LoginLinkTokens
                .Where(x => x.UserId == user.Id && x.UsedAt == null && x.ExpiresAt > now)
                .ToListAsync();

            if (activeTokens.Count > 0)
            {
                foreach (var t in activeTokens)
                {
                    t.ExpiresAt = now; // expire immediately
                }
                _db.LoginLinkTokens.UpdateRange(activeTokens);
            }

            // generate secure token (hex)
            var bytes = RandomNumberGenerator.GetBytes(32);
            var token = Convert.ToHexString(bytes);

            // hash token before storing
            var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

            var expiryMinutes = int.TryParse(_config["LoginLink:ExpiryMinutes"], out var m) ? m : 15;
            var expiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes);

            var ml = new LoginLinkToken
            {
                UserId = user.Id,
                TokenHash = tokenHash,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = expiresAt,
                SentAt = null,
                SendFailedCount = 0,
                LastSendError = null
            };

            _db.LoginLinkTokens.Add(ml);
            await _db.SaveChangesAsync();

            // build URL to include the raw token encoded in base64url
            var frontendBase = TenantPortalUrl.ResolveFrontendBase(_config, null);
            var encoded = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
            if (string.IsNullOrWhiteSpace(tenantCode) && user.TenantId.HasValue)
            {
                tenantCode = await _db.Tenants
                    .Where(t => t.Id == user.TenantId.Value)
                    .Select(t => t.Code)
                    .FirstOrDefaultAsync();
            }

            var link = string.IsNullOrWhiteSpace(tenantCode)
                ? $"{frontendBase}/verify-login?token={encoded}"
                : TenantPortalUrl.BuildVerifyUrl(frontendBase, tenantCode, encoded);

            // send email using the new template-based email service
            try
            {
                bool sent = false;
                string? error = null;

                if (user.OrganisationID.HasValue)
                {
                    // Use the new template-based email
                    try
                    {
                        await _emailService.SendLoginLinkEmailAsync(
                            user.Email!,
                            link,
                            expiryMinutes,
                            user.OrganisationID.Value.ToString(),
                            user.FirstName);
                        sent = true;
                    }
                    catch (Exception emailEx)
                    {
                        _logger.LogError(emailEx, "Failed to send login link via EmailService");
                        error = emailEx.Message;
                        sent = false;
                    }
                }
                else
                {
                    // Fallback to old method if user has no organization
                    _logger.LogWarning("User {UserId} has no organization, using fallback email method", user.Id);
                    var (oldSent, oldError) = await SendEmailAsync(user.Email!, "Your sign-in link", $"Click to sign in: {link}", $"<p>Click to sign in: <a href=\"{link}\">{link}</a></p>");
                    sent = oldSent;
                    error = oldError;
                }

                if (sent)
                {
                    ml.SentAt = DateTime.UtcNow;
                }
                else
                {
                    ml.SendFailedCount += 1;
                    ml.LastSendError = error;
                }

                _db.LoginLinkTokens.Update(ml);
                await _db.SaveChangesAsync();

                return sent;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send login link to {Email}", user.Email);

                ml.SendFailedCount += 1;
                ml.LastSendError = ex.Message;
                _db.LoginLinkTokens.Update(ml);
                await _db.SaveChangesAsync();

                return false;
            }
        }

        // Ensure the return type of ValidateAndConsumeTokenAsync matches the interface (Task<LoginLinkToken?>).
        public async Task<LoginLinkToken?> ValidateAndConsumeTokenAsync(string token)
        {
            // token is expected to be raw hex or base64url-encoded raw token. Try to decode base64url first.
            string raw;
            try
            {
                var bytes = WebEncoders.Base64UrlDecode(token);
                raw = Encoding.UTF8.GetString(bytes);
            }
            catch
            {
                // not base64url, assume token is raw hex
                raw = token;
            }

            var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));

            var now = DateTime.UtcNow;

            var record = await _db.LoginLinkTokens
                .Where(x => x.TokenHash == tokenHash)
                .Where(x => x.ExpiresAt > now)
                .Where(x => x.UsedAt == null)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync();

            if (record == null) return null;

            // mark consumed
            record.UsedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return record;
        }

        private async Task<(bool Success, string? Error)> SendEmailAsync(string toEmail, string subject, string plainTextContent, string htmlContent = "")
        {
            var apiKey = _config["SendGrid:ApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                _logger.LogWarning("SendGrid API key not configured. Login link to {Email}: {Content}", toEmail, plainTextContent);
                return (false, "sendgrid-api-key-missing");
            }

            var fromEmail = _config["SendGrid:FromEmail"] ?? _config["Smtp:From"] ?? "no-reply@example.com";
            var fromName = _config["SendGrid:FromName"] ?? "No Reply";

            var client = new SendGridClient(apiKey);
            var from = new EmailAddress(fromEmail, fromName);
            var to = new EmailAddress(toEmail);
            var msg = MailHelper.CreateSingleEmail(from, to, subject, plainTextContent, string.IsNullOrWhiteSpace(htmlContent) ? plainTextContent : htmlContent);

            var response = await client.SendEmailAsync(msg);
            if ((int)response.StatusCode >= 400)
            {
                var body = response.Body != null ? await response.Body.ReadAsStringAsync() : string.Empty;
                _logger.LogWarning("SendGrid returned non-success status {StatusCode} sending to {Email}. Response: {ResponseBody}", (int)response.StatusCode, toEmail, body);
                return (false, body);
            }

            return (true, null);
        }
    }
}