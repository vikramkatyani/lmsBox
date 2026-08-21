using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using lmsBox.Server.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using SendGrid.Helpers.Mail;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IdentityModel.Tokens.Jwt;
using System.Net.Http;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace lmsBox.Server.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class LoginLinkController : ControllerBase
    {
        private readonly ILoginLinkService _loginLinkService;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ApplicationDbContext _db;
        private readonly TenantResolver _tenantResolver;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _config;
        private readonly ILogger<LoginLinkController> _logger;
        private readonly IEngagementTrackingService _engagementService;

        public LoginLinkController(
            ILoginLinkService loginLinkService,
            UserManager<ApplicationUser> userManager,
            ApplicationDbContext db,
            TenantResolver tenantResolver,
            IHttpClientFactory httpClientFactory,
            IConfiguration config,
            ILogger<LoginLinkController> logger,
            IEngagementTrackingService engagementService)
        {
            _loginLinkService = loginLinkService;
            _userManager = userManager;
            _db = db;
            _tenantResolver = tenantResolver;
            _httpClientFactory = httpClientFactory;
            _config = config;
            _logger = logger;
            _engagementService = engagementService;
        }

        // POST /auth/login
        [HttpPost("login")]
        public async Task<IActionResult> RequestLoginLink([FromBody] LoginLinkRequest request)
        {
            var correlationId = Activity.Current?.Id ?? HttpContext.TraceIdentifier;
            using (_logger.BeginScope(new Dictionary<string, object> { ["CorrelationId"] = correlationId, ["Email"] = request?.Email ?? string.Empty }))
            {
                _logger.LogInformation("RequestLoginLink started from {RemoteIp}", HttpContext.Connection.RemoteIpAddress);

                if (request is null || string.IsNullOrWhiteSpace(request.Email))
                {
                    _logger.LogWarning("RequestLoginLink bad request: missing email");
                    return BadRequest(new { message = "Email is required." });
                }

                // If Recaptcha secret is configured, validate token; if not configured, skip validation.
                var recaptchaSecret = _config["Recaptcha:SecretKey"];
                if (!string.IsNullOrWhiteSpace(recaptchaSecret))
                {
                    if (string.IsNullOrWhiteSpace(request.RecaptchaToken))
                    {
                        _logger.LogWarning("RequestLoginLink missing recaptcha token for {Email}", request.Email);
                        return BadRequest(new { message = "reCAPTCHA token is required." });
                    }

                    var verified = await VerifyRecaptchaAsync(request.RecaptchaToken, recaptchaSecret);
                    if (!verified.Success)
                    {
                        _logger.LogInformation("reCAPTCHA verify failed for {Email}: {Errors}", request.Email, verified.ErrorCodes);
                        return BadRequest(new { message = "Security check failed. Please try again." });
                    }
                }

                // Find user in this tenant only. Do not reveal existence to client.
                var tenant = await ResolveTenantAsync(request.TenantCode);
                if (tenant == null)
                {
                    _logger.LogWarning("RequestLoginLink missing tenant for {Email}", request.Email);
                    return BadRequest(new { message = "Use your organisation login URL (/t/{tenant-code}/login)." });
                }

                var user = await FindTenantUserAsync(request.Email, tenant.Id);
                if (user != null)
                {
                    try
                    {
                        var sent = await _loginLinkService.CreateAndSendLoginLinkAsync(user, tenant.Code);
                        if (!sent)
                        {
                            _logger.LogError("Login link was not emailed for user {UserId}", user.Id);
                            return StatusCode(500, new { message = "Failed to send login link. Please try again later." });
                        }

                        _logger.LogInformation("Login link created/sent for user {UserId}", user.Id);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to create/send login link for {Email}", request.Email);
                        // Don't leak internal details
                        return StatusCode(500, new { message = "Failed to send login link. Please try again later." });
                    }
                }

                // Always return success to avoid user enumeration
                _logger.LogInformation("RequestLoginLink completed for {Email}", request.Email);
                return Ok(new { message = "If an account exists for that email, a login link has been sent." });
            }
        }

        // POST /auth/verify-login-link
        [HttpPost("verify-login-link")]
        public async Task<IActionResult> VerifyLoginLink([FromBody] VerifyLoginLinkRequest request)
        {
            var correlationId = Activity.Current?.Id ?? HttpContext.TraceIdentifier;
            using (_logger.BeginScope(new Dictionary<string, object> { ["CorrelationId"] = correlationId }))
            {
                _logger.LogInformation("VerifyLoginLink started");

                if (request is null || string.IsNullOrWhiteSpace(request.Token))
                {
                    _logger.LogWarning("VerifyLoginLink bad request: missing token");
                    return BadRequest(new { message = "Token is required." });
                }

                try
                {
                    var record = await _loginLinkService.ValidateAndConsumeTokenAsync(request.Token);
                    if (record == null)
                    {
                        _logger.LogWarning("VerifyLoginLink invalid or expired token");
                        return await InvalidOrExpiredLoginLinkResult(request);
                    }

                    var user = await _userManager.FindByIdAsync(record.UserId);
                    if (user == null)
                    {
                        _logger.LogWarning("Login link validated for non-existent user id {UserId}", record.UserId);
                        return await InvalidOrExpiredLoginLinkResult(request);
                    }

                    if (!string.IsNullOrWhiteSpace(request.TenantCode))
                    {
                        var tenant = await _tenantResolver.ResolveByCodeAsync(request.TenantCode);
                        if (tenant == null || user.TenantId != tenant.Id)
                        {
                            _logger.LogWarning("Login link tenant mismatch for user {UserId}", user.Id);
                            return await InvalidOrExpiredLoginLinkResult(request, user);
                        }
                    }

                    if (!user.TenantId.HasValue)
                    {
                        return await InvalidOrExpiredLoginLinkResult(request, user);
                    }

                    var jwtSection = _config.GetSection("Jwt");
                    var keyBytes = Encoding.UTF8.GetBytes(jwtSection["Key"] ?? "dev-secret-change-me-please-0123456789");
                    var expiresMinutes = int.TryParse(_config["LoginLink:AuthTokenExpiryMinutes"], out var em) ? em : 60;
                    var now = DateTimeOffset.UtcNow;

                    var claims = new List<Claim>
                    {
                        new Claim(JwtRegisteredClaimNames.Sub, user.Id),
                        new Claim(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
                        new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
                    };

                    if (!string.IsNullOrWhiteSpace(user.FirstName) || !string.IsNullOrWhiteSpace(user.LastName))
                    {
                        var name = (user.FirstName ?? string.Empty).Trim();
                        if (!string.IsNullOrWhiteSpace(user.LastName)) name = string.IsNullOrWhiteSpace(name) ? user.LastName : name + " " + user.LastName;
                        claims.Add(new Claim("name", name));
                    }

                    var roles = await _userManager.GetRolesAsync(user);
                    foreach (var r in roles)
                    {
                        claims.Add(new Claim(ClaimTypes.Role, r));
                    }

                    var tenantCodeForToken = await TenantPortalUrl.GetTenantCodeAsync(_db, user.TenantId);
                    JwtTokenHelper.AddTenancyClaims(claims, user, tenantCodeForToken);

                    var creds = new SigningCredentials(new SymmetricSecurityKey(keyBytes), SecurityAlgorithms.HmacSha256);
                    var jwt = new JwtSecurityToken(
                        issuer: jwtSection["Issuer"],
                        audience: jwtSection["Audience"],
                        claims: claims,
                        notBefore: now.DateTime,
                        expires: now.AddMinutes(expiresMinutes).DateTime,
                        signingCredentials: creds
                    );

                    var tokenString = new JwtSecurityTokenHandler().WriteToken(jwt);

                    _logger.LogInformation("User {UserId} authenticated via login link. Roles={Roles}", user.Id, string.Join(',', roles));

                    await TryTrackLoginAsync(user);

                    return Ok(new
                    {
                        token = tokenString,
                        expires = now.AddMinutes(expiresMinutes).ToUnixTimeMilliseconds(),
                        tenantCode = tenantCodeForToken
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error verifying login link token.");
                    return StatusCode(500, new { message = "Failed to verify login link." });
                }
            }
        }

        // GET /auth/external/google
        // GET /auth/external/microsoft
        [HttpGet("external/{provider}")]
        [AllowAnonymous]
        public IActionResult ExternalLogin([FromRoute] string provider, [FromQuery] string? tenantCode)
        {
            var (scheme, configured) = ResolveExternalScheme(provider);
            if (scheme == null || !configured)
            {
                return BadRequest(new { message = "Requested external login provider is not available." });
            }

            var redirectUri = Url.Action(nameof(ExternalLoginCallback), "LoginLink")!;
            var properties = new AuthenticationProperties { RedirectUri = redirectUri };
            if (!string.IsNullOrWhiteSpace(tenantCode))
            {
                properties.Items["tenant_code"] = tenantCode.Trim();
            }

            return Challenge(properties, scheme);
        }

        // GET /auth/external/callback
        [HttpGet("external/callback")]
        [AllowAnonymous]
        public async Task<IActionResult> ExternalLoginCallback([FromQuery] string? remoteError = null)
        {
            try
            {
                if (!string.IsNullOrWhiteSpace(remoteError))
                {
                    _logger.LogWarning("External login failed at provider: {RemoteError}", remoteError);
                    return Redirect(BuildFrontendLoginRedirect("authError=external_denied"));
                }

                var externalResult = await HttpContext.AuthenticateAsync(IdentityConstants.ExternalScheme);
                if (!externalResult.Succeeded || externalResult.Principal == null)
                {
                    _logger.LogWarning("External login callback received without valid external principal");
                    return Redirect(BuildFrontendLoginRedirect("authError=external_failed"));
                }

                var email = externalResult.Principal.FindFirstValue(ClaimTypes.Email)
                            ?? externalResult.Principal.FindFirstValue("email")
                            ?? externalResult.Principal.FindFirstValue("preferred_username")
                            ?? externalResult.Principal.FindFirstValue("upn")
                            ?? externalResult.Principal.FindFirstValue(JwtRegisteredClaimNames.Email);

                if (string.IsNullOrWhiteSpace(email))
                {
                    _logger.LogWarning("External login callback did not include an email claim");
                    return Redirect(BuildFrontendLoginRedirect("authError=email_missing", GetTenantCodeFromProperties(externalResult.Properties)));
                }

                var tenantCode = GetTenantCodeFromProperties(externalResult.Properties);
                var tenant = await _tenantResolver.ResolveAsync(tenantCode, Request.Host.Value);
                if (tenant == null)
                {
                    _logger.LogWarning("External login rejected because tenant could not be resolved");
                    return Redirect(BuildFrontendLoginRedirect("authError=external_failed", tenantCode));
                }

                var user = await FindTenantUserAsync(email, tenant.Id);
                if (user == null)
                {
                    _logger.LogInformation("External login rejected for unregistered email {Email} in tenant {TenantCode}", email, tenant.Code);
                    return Redirect(BuildFrontendPathRedirect($"/t/{tenant.Code}/auth/email-not-registered"));
                }

                var (token, expiresUnixMs) = await CreateJwtTokenAsync(user);

                await TryTrackLoginAsync(user);

                await HttpContext.SignOutAsync(IdentityConstants.ExternalScheme);

                var fragment = $"token={Uri.EscapeDataString(token)}&expires={expiresUnixMs}";
                return Redirect(BuildFrontendLoginRedirect(fragment, tenant.Code));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unhandled error during external login callback");
                return Redirect(BuildFrontendLoginRedirect("authError=external_failed"));
            }
        }

        private async Task<(bool Success, string[] ErrorCodes)> VerifyRecaptchaAsync(string token, string secret)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                var content = new FormUrlEncodedContent(new[]
                {
                    new KeyValuePair<string, string>("secret", secret),
                    new KeyValuePair<string, string>("response", token)
                });

                var response = await client.PostAsync("https://www.google.com/recaptcha/api/siteverify", content);
                response.EnsureSuccessStatusCode();

                using var stream = await response.Content.ReadAsStreamAsync();
                var doc = await JsonSerializer.DeserializeAsync<JsonElement>(stream);

                var success = doc.TryGetProperty("success", out var s) && s.GetBoolean();
                var errors = Array.Empty<string>();
                if (doc.TryGetProperty("error-codes", out var ec) && ec.ValueKind == JsonValueKind.Array)
                {
                    var list = new List<string>();
                    foreach (var e in ec.EnumerateArray())
                    {
                        if (e.ValueKind == JsonValueKind.String) list.Add(e.GetString() ?? string.Empty);
                    }
                    errors = list.ToArray();
                }

                return (success, errors);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "reCAPTCHA verification request failed.");
                return (false, new[] { "verification-failed" });
            }
        }


        // POST /auth/logout
        // Revokes the currently-present JWT by recording its jti/token-hash so it can be rejected server-side.
        [HttpPost("logout")]
        [Authorize]
        public async Task<IActionResult> Logout()
        {
            var correlationId = Activity.Current?.Id ?? HttpContext.TraceIdentifier;
            using (_logger.BeginScope(new Dictionary<string, object> { ["CorrelationId"] = correlationId }))
            {
                _logger.LogInformation("Logout started for remote IP {RemoteIp}", HttpContext.Connection.RemoteIpAddress);

                try
                {
                    // Try to read the raw token from Authorization header (Bearer <token>)
                    string? token = null;
                    if (Request.Headers.TryGetValue("Authorization", out var ah))
                    {
                        var header = ah.ToString();
                        const string bearer = "Bearer ";
                        if (header.StartsWith(bearer, StringComparison.OrdinalIgnoreCase))
                        {
                            token = header.Substring(bearer.Length).Trim();
                        }
                    }

                    // Do not log the token itself. Log whether token was present.
                    _logger.LogInformation("Logout invoked. TokenPresent={HasToken}", !string.IsNullOrEmpty(token));

                    // For logout, we don't need reCAPTCHA verification
                    // Simply invalidate the session/token and return success
                    
                    _logger.LogInformation("Logout completed successfully");
                    return Ok(new { success = true, message = "Logged out successfully" });
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Logout request failed.");
                    return StatusCode(500, new { success = false, errors = new[] { "logout-failed" } });
                }
            }
        }

        // Development-only direct login endpoint (bypasses email verification)
        [HttpPost("dev-login")]
        public async Task<IActionResult> DevLogin([FromBody] DevLoginRequest request)
        {
            // Only allow in development environment
            if (!_config.GetValue<bool>("DevMode", false) && 
                !string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase))
            {
                return NotFound();
            }

            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest(new { message = "Email is required" });
            }

            try
            {
                var tenant = await ResolveTenantAsync(request.TenantCode);
                if (tenant == null)
                {
                    return BadRequest(new { message = "Tenant code is required. Use /t/{tenant-code}/login." });
                }

                var user = await FindTenantUserAsync(request.Email, tenant.Id);
                if (user == null)
                {
                    return BadRequest(new { message = "User not found" });
                }

                var (tokenString, expiresUnixMs) = await CreateJwtTokenAsync(user);
                var roles = await _userManager.GetRolesAsync(user);

                _logger.LogInformation("User {UserId} authenticated via dev-login. Roles={Roles}", user.Id, string.Join(',', roles));

                await TryTrackLoginAsync(user);

                return Ok(new
                {
                    token = tokenString,
                    expires = expiresUnixMs,
                    tenantCode = tenant.Code,
                    user = new
                    {
                        id = user.Id,
                        email = user.Email,
                        name = $"{user.FirstName} {user.LastName}".Trim(),
                        roles = roles
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during dev login for {Email}", request.Email);
                return StatusCode(500, new { message = "An error occurred during login" });
            }
        }

        private (string? Scheme, bool Configured) ResolveExternalScheme(string provider)
        {
            if (string.Equals(provider, "google", StringComparison.OrdinalIgnoreCase))
            {
                var configured = !string.IsNullOrWhiteSpace(_config["Authentication:Google:ClientId"]) &&
                                 !string.IsNullOrWhiteSpace(_config["Authentication:Google:ClientSecret"]);
                return ("Google", configured);
            }

            if (string.Equals(provider, "microsoft", StringComparison.OrdinalIgnoreCase))
            {
                var configured = !string.IsNullOrWhiteSpace(_config["Authentication:Microsoft:ClientId"]) &&
                                 !string.IsNullOrWhiteSpace(_config["Authentication:Microsoft:ClientSecret"]);
                return ("Microsoft", configured);
            }

            return (null, false);
        }

        private async Task<IActionResult> InvalidOrExpiredLoginLinkResult(
            VerifyLoginLinkRequest request,
            ApplicationUser? user = null)
        {
            var tenantCode = request.TenantCode;
            if (user == null)
            {
                var stale = await _loginLinkService.FindTokenAsync(request.Token);
                if (stale != null)
                {
                    user = await _userManager.FindByIdAsync(stale.UserId);
                }
            }

            if (string.IsNullOrWhiteSpace(tenantCode) && user?.TenantId != null)
            {
                tenantCode = await TenantPortalUrl.GetTenantCodeAsync(_db, user.TenantId);
            }

            var loginPath = string.IsNullOrWhiteSpace(tenantCode)
                ? "/login"
                : TenantPortalUrl.TenantLoginPath(tenantCode);

            return Unauthorized(new
            {
                message = "Invalid or expired token.",
                tenantCode,
                loginPath
            });
        }

        private async Task<Tenant?> ResolveTenantAsync(string? tenantCode)
        {
            var headerCode = Request.Headers["X-Tenant-Code"].FirstOrDefault();
            return await _tenantResolver.ResolveAsync(tenantCode ?? headerCode, Request.Host.Value);
        }

        private async Task<ApplicationUser?> FindTenantUserAsync(string email, long tenantId)
        {
            var normalized = _userManager.NormalizeEmail(email);
            return await _db.Users.FirstOrDefaultAsync(u =>
                u.NormalizedEmail == normalized && u.TenantId == tenantId);
        }

        private static string? GetTenantCodeFromProperties(AuthenticationProperties? properties)
        {
            if (properties?.Items != null && properties.Items.TryGetValue("tenant_code", out var code))
            {
                return code;
            }

            return null;
        }

        private string BuildFrontendLoginRedirect(string fragment, string? tenantCode = null)
        {
            var frontendBaseUrl = TenantPortalUrl.ResolveFrontendBase(_config, Request);
            var path = string.IsNullOrWhiteSpace(tenantCode)
                ? "/login"
                : TenantPortalUrl.TenantLoginPath(tenantCode);
            return $"{frontendBaseUrl}{path}#{fragment}";
        }

        private string BuildFrontendPathRedirect(string path)
        {
            var frontendBaseUrl = _config["LoginLink:FrontendBaseUrl"];
            if (string.IsNullOrWhiteSpace(frontendBaseUrl))
            {
                frontendBaseUrl = $"{Request.Scheme}://{Request.Host}";
            }

            var normalizedPath = path.StartsWith("/") ? path : "/" + path;
            return $"{frontendBaseUrl.TrimEnd('/')}{normalizedPath}";
        }

        private async Task<(string Token, long ExpiresUnixMs)> CreateJwtTokenAsync(ApplicationUser user)
        {
            var jwtSection = _config.GetSection("Jwt");
            var keyBytes = Encoding.UTF8.GetBytes(jwtSection["Key"] ?? "dev-secret-change-me-please-0123456789");
            var expiresMinutes = int.TryParse(_config["LoginLink:AuthTokenExpiryMinutes"], out var em)
                ? em
                : int.TryParse(jwtSection["ExpiryMinutes"], out var jm) ? jm : 60;
            var now = DateTimeOffset.UtcNow;

            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, user.Id),
                new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            if (!string.IsNullOrWhiteSpace(user.FirstName) || !string.IsNullOrWhiteSpace(user.LastName))
            {
                var name = (user.FirstName ?? string.Empty).Trim();
                if (!string.IsNullOrWhiteSpace(user.LastName))
                {
                    name = string.IsNullOrWhiteSpace(name) ? user.LastName : name + " " + user.LastName;
                }

                claims.Add(new Claim("name", name));
            }

            var roles = await _userManager.GetRolesAsync(user);
            foreach (var role in roles)
            {
                claims.Add(new Claim(ClaimTypes.Role, role));
            }

            JwtTokenHelper.AddTenancyClaims(
                claims,
                user,
                await TenantPortalUrl.GetTenantCodeAsync(_db, user.TenantId));

            var creds = new SigningCredentials(new SymmetricSecurityKey(keyBytes), SecurityAlgorithms.HmacSha256);
            var jwt = new JwtSecurityToken(
                issuer: jwtSection["Issuer"],
                audience: jwtSection["Audience"],
                claims: claims,
                notBefore: now.UtcDateTime,
                expires: now.AddMinutes(expiresMinutes).UtcDateTime,
                signingCredentials: creds
            );

            var tokenString = new JwtSecurityTokenHandler().WriteToken(jwt);
            return (tokenString, now.AddMinutes(expiresMinutes).ToUnixTimeMilliseconds());
        }

        private async Task TryTrackLoginAsync(ApplicationUser user)
        {
            if (!user.OrganisationID.HasValue)
            {
                return;
            }

            try
            {
                await _engagementService.TrackAsync(
                    user.Id,
                    user.OrganisationID.Value,
                    EngagementTrackingService.EVENT_LOGIN
                );
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Login succeeded but engagement tracking failed for user {UserId}", user.Id);
            }
        }
    }

    public class DevLoginRequest
    {
        public required string Email { get; set; }
        public string? TenantCode { get; set; }
    }
}