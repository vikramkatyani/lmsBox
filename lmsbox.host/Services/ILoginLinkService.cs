using System.Threading.Tasks;
using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;

namespace lmsBox.Server.Services
{
    public interface ILoginLinkService
    {
        Task<bool> CreateAndSendLoginLinkAsync(ApplicationUser user, string? tenantCode = null);
        Task<LoginLinkToken?> ValidateAndConsumeTokenAsync(string token);
        Task<LoginLinkToken?> FindTokenAsync(string token);
    }
}