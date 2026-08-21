using System.Security.Claims;
using System.Text;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using lmsbox.domain.Models;

namespace lmsBox.Server.Services;

public static class JwtTokenHelper
{
    public const string TenantIdClaimType = "tenant_id";
    public const string TenantCodeClaimType = "tenant_code";
    public const string OrganisationIdClaimType = "organisation_id";

    public static void AddTenancyClaims(ICollection<Claim> claims, ApplicationUser user, string? tenantCode = null)
    {
        if (user.TenantId.HasValue)
        {
            claims.Add(new Claim(TenantIdClaimType, user.TenantId.Value.ToString()));
        }

        if (!string.IsNullOrWhiteSpace(tenantCode))
        {
            claims.Add(new Claim(TenantCodeClaimType, tenantCode.Trim().ToLowerInvariant()));
        }

        if (user.OrganisationID.HasValue)
        {
            claims.Add(new Claim(OrganisationIdClaimType, user.OrganisationID.Value.ToString()));
        }
    }

    public static string CreateToken(
        IConfiguration configuration,
        ApplicationUser user,
        IEnumerable<string> roles,
        TimeSpan? lifetime = null)
    {
        var jwtSection = configuration.GetSection("Jwt");
        var key = Encoding.UTF8.GetBytes(jwtSection["Key"] ?? "dev-secret-change-me-please-0123456789");

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(ClaimTypes.Email, user.Email ?? string.Empty),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        if (!string.IsNullOrWhiteSpace(user.FirstName))
        {
            claims.Add(new Claim(ClaimTypes.Name, user.FirstName));
            var name = user.FirstName;
            if (!string.IsNullOrWhiteSpace(user.LastName))
            {
                name = $"{user.FirstName} {user.LastName}";
            }
            claims.Add(new Claim("name", name));
        }

        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        AddTenancyClaims(claims, user);

        var expires = DateTime.UtcNow.Add(lifetime ?? TimeSpan.FromHours(8));
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = expires,
            Issuer = jwtSection["Issuer"],
            Audience = jwtSection["Audience"],
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key),
                SecurityAlgorithms.HmacSha256Signature)
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        return tokenHandler.WriteToken(tokenHandler.CreateToken(tokenDescriptor));
    }
}
