using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using lmsBox.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
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
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _config;
        private readonly ILogger<LoginLinkController> _logger;

        public LoginLinkController(
            ILoginLinkService loginLinkService,
            UserManager<ApplicationUser> userManager,
            IHttpClientFactory httpClientFactory,
            IConfiguration config,
            ILogger<LoginLinkController> logger)
        {
            _loginLinkService = loginLinkService;
            _userManager = userManager;
            _httpClientFactory = httpClientFactory;
            _config = config;
            _logger = logger;
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

                // Find user and send login link if user exists. Do not reveal existence to client.
                var user = await _userManager.FindByEmailAsync(request.Email);
                if (user != null)
                {
                    try
                    {
                        // call the service method (keeps original implementation name)
                        await _loginLinkService.CreateAndSendLoginLinkAsync(user);
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
                        return Unauthorized(new { message = "Invalid or expired token." });
                    }

                    var user = await _userManager.FindByIdAsync(record.UserId);
                    if (user == null)
                    {
                        _logger.LogWarning("Login link validated for non-existent user id {UserId}", record.UserId);
                        return Unauthorized(new { message = "Invalid token." });
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

                    return Ok(new
                    {
                        token = tokenString,
                        expires = now.AddMinutes(expiresMinutes).ToUnixTimeMilliseconds(),
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error verifying login link token.");
                    return StatusCode(500, new { message = "Failed to verify login link." });
                }
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
                var user = await _userManager.FindByEmailAsync(request.Email);
                if (user == null)
                {
                    return BadRequest(new { message = "User not found" });
                }

                // Generate JWT token directly (same logic as verify-login)
                var jwtSection = _config.GetSection("Jwt");
                var keyBytes = Encoding.UTF8.GetBytes(jwtSection["Key"]);
                var expiresMinutes = int.Parse(jwtSection["ExpiryMinutes"]);
                var now = DateTime.UtcNow;

                var claims = new List<Claim>
                {
                    new(ClaimTypes.NameIdentifier, user.Id),
                    new(ClaimTypes.Email, user.Email),
                    new("jti", Guid.NewGuid().ToString())
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

                var creds = new SigningCredentials(new SymmetricSecurityKey(keyBytes), SecurityAlgorithms.HmacSha256);
                var jwt = new JwtSecurityToken(
                    issuer: jwtSection["Issuer"],
                    audience: jwtSection["Audience"],
                    claims: claims,
                    notBefore: now,
                    expires: now.AddMinutes(expiresMinutes),
                    signingCredentials: creds
                );

                var tokenString = new JwtSecurityTokenHandler().WriteToken(jwt);

                _logger.LogInformation("User {UserId} authenticated via dev-login. Roles={Roles}", user.Id, string.Join(',', roles));

                return Ok(new
                {
                    token = tokenString,
                    expires = jwt.ValidTo,
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
    }

    public class DevLoginRequest
    {
        public required string Email { get; set; }
    }
}