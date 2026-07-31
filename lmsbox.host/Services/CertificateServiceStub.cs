namespace lmsBox.Server.Services;

/// <summary>
/// Stub implementation of ICertificateService when certificate generation is disabled
/// </summary>
public class CertificateServiceStub : ICertificateService
{
    public Task<string> GetCertificateUrlAsync(string userId, string courseId)
    {
        // Return empty string when certificate service is disabled
        return Task.FromResult(string.Empty);
    }

    public Task<string> GenerateAndSaveCertificateAsync(string userId, string courseId)
    {
        // Return empty string when certificate service is disabled
        return Task.FromResult(string.Empty);
    }
}
