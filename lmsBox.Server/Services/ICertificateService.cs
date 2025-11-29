namespace lmsBox.Server.Services;

/// <summary>
/// Certificate service interface - Currently disabled (PDF generation on hold)
/// </summary>
public interface ICertificateService
{
    Task<string> GetCertificateUrlAsync(string userId, string courseId);
    Task<string> GenerateAndSaveCertificateAsync(string userId, string courseId);
}
