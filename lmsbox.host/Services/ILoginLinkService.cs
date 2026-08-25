using System.Threading.Tasks;
using lmsbox.domain.Models;
using Microsoft.AspNetCore.Http;

namespace lmsBox.Server.Services
{
    public class LoginLinkCreateResult
    {
        public required string Url { get; set; }
        public int ExpiryMinutes { get; set; }
        public int ExpiryDays { get; set; }
    }

    public interface ILoginLinkService
    {
        Task<bool> CreateAndSendLoginLinkAsync(ApplicationUser user, string? tenantCode = null);
        Task<LoginLinkCreateResult?> CreateAdminLoginLinkAsync(ApplicationUser user, HttpRequest? request = null);
        Task<LoginLinkToken?> ValidateAndConsumeTokenAsync(string token);
        Task<LoginLinkToken?> FindTokenAsync(string token);
    }
}
