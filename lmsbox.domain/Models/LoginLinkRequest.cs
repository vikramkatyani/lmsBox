namespace lmsbox.domain.Models
{
    public class LoginLinkRequest
    {
        public required string Email { get; set; }

        // Optional: token returned by client-side reCAPTCHA execution
        public string? RecaptchaToken { get; set; }

        /// <summary>Tenant code from /t/{code}/login. Required for tenant user login.</summary>
        public string? TenantCode { get; set; }
    }
    public class VerifyLoginLinkRequest
    {
        public string Token { get; set; } = string.Empty;

        /// <summary>When set, the token must belong to a user of this tenant.</summary>
        public string? TenantCode { get; set; }
    }
}