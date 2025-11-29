using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using lmsbox.domain.Models;
using iText.Kernel.Pdf;
using iText.Layout;
using iText.Layout.Element;
using iText.Layout.Properties;
using iText.Kernel.Colors;
using iText.Kernel.Font;
using iText.IO.Font.Constants;

namespace lmsBox.Server.Services
{
    public interface ICertificateService
    {
        Task<string> GenerateAndSaveCertificateAsync(string userId, string courseId);
        Task<string?> GetCertificateUrlAsync(string userId, string courseId);
        Task<byte[]> GenerateCertificatePdfAsync(string userId, string courseId);
        Task<string> GetCertificateIdAsync(string userId, string courseId);
    }

    public class CertificateService : ICertificateService
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<CertificateService> _logger;
        private readonly IAzureBlobService _blobService;
        private readonly IAuditLogService _auditLogService;

        public CertificateService(
            ApplicationDbContext context,
            IWebHostEnvironment env,
            ILogger<CertificateService> logger,
            IAzureBlobService blobService,
            IAuditLogService auditLogService)
        {
            _context = context;
            _env = env;
            _logger = logger;
            _blobService = blobService;
            _auditLogService = auditLogService;
        }

        public async Task<string> GetCertificateIdAsync(string userId, string courseId)
        {
            var progress = await _context.LearnerProgresses
                .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.CourseId == courseId && lp.Completed);

            if (progress == null || progress.CompletedAt == null)
            {
                throw new InvalidOperationException("Course not completed");
            }

            var userShort = userId.Substring(0, Math.Min(8, userId.Length));
            var timestamp = progress.CompletedAt.Value.ToString("yyMMddHHmmss");
            var courseShort = courseId.Substring(0, Math.Min(8, courseId.Length));
            return $"C-{courseShort}-{userShort}-{timestamp}";
        }

        public async Task<byte[]> GenerateCertificatePdfAsync(string userId, string courseId)
        {
            _logger.LogInformation("Generating certificate PDF for user {UserId}, course {CourseId}", userId, courseId);

            var user = await _context.Users
                .Include(u => u.Organisation)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                throw new NotFoundException("User not found");
            }

            var course = await _context.Courses
                .FirstOrDefaultAsync(c => c.Id == courseId);

            if (course == null)
            {
                throw new NotFoundException("Course not found");
            }

            if (!course.CertificateEnabled)
            {
                throw new InvalidOperationException("Certificate not enabled for this course");
            }

            var progress = await _context.LearnerProgresses
                .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId == null && lp.Completed);

            if (progress == null || !progress.Completed || progress.CompletedAt == null)
            {
                throw new InvalidOperationException("Course not completed");
            }

            var organization = user.Organisation;
            if (organization == null)
            {
                throw new InvalidOperationException("User has no organization");
            }

            var certificateId = await GetCertificateIdAsync(userId, courseId);
            var userName = $"{user.FirstName} {user.LastName}";
            var completionDate = progress.CompletedAt.Value.ToString("MMMM dd, yyyy");
            var brandName = organization.BrandName ?? organization.Name;

            using var stream = new MemoryStream();
            using (var writer = new PdfWriter(stream))
            {
                writer.SetCloseStream(false);
                using (var pdf = new PdfDocument(writer))
                {
                    var document = new Document(pdf, iText.Kernel.Geom.PageSize.A4.Rotate());
                    document.SetMargins(50, 50, 50, 50);

                    // Fonts
                    var titleFont = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_BOLD);
                    var normalFont = PdfFontFactory.CreateFont(StandardFonts.HELVETICA);
                    var italicFont = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_OBLIQUE);

                    // Border
                    document.Add(new Paragraph()
                        .SetBorder(new iText.Layout.Borders.SolidBorder(ColorConstants.DARK_GRAY, 3))
                        .SetPadding(40));

                    // Title
                    document.Add(new Paragraph("CERTIFICATE OF COMPLETION")
                        .SetFont(titleFont)
                        .SetFontSize(32)
                        .SetTextAlignment(TextAlignment.CENTER)
                        .SetMarginTop(40));

                    // Divider line
                    document.Add(new Paragraph("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                        .SetTextAlignment(TextAlignment.CENTER)
                        .SetFontColor(ColorConstants.DARK_GRAY)
                        .SetMarginTop(20)
                        .SetMarginBottom(30));

                    // "This is to certify that"
                    document.Add(new Paragraph("This is to certify that")
                        .SetFont(italicFont)
                        .SetFontSize(14)
                        .SetTextAlignment(TextAlignment.CENTER));

                    // User Name
                    document.Add(new Paragraph(userName)
                        .SetFont(titleFont)
                        .SetFontSize(28)
                        .SetTextAlignment(TextAlignment.CENTER)
                        .SetFontColor(new DeviceRgb(0, 51, 102))
                        .SetMarginTop(20)
                        .SetMarginBottom(20));

                    // "has successfully completed"
                    document.Add(new Paragraph("has successfully completed the course")
                        .SetFont(italicFont)
                        .SetFontSize(14)
                        .SetTextAlignment(TextAlignment.CENTER));

                    // Course Title
                    document.Add(new Paragraph(course.Title)
                        .SetFont(titleFont)
                        .SetFontSize(22)
                        .SetTextAlignment(TextAlignment.CENTER)
                        .SetMarginTop(20)
                        .SetMarginBottom(30));

                    // Completion Date
                    document.Add(new Paragraph($"Completed on {completionDate}")
                        .SetFont(normalFont)
                        .SetFontSize(12)
                        .SetTextAlignment(TextAlignment.CENTER)
                        .SetMarginBottom(40));

                    // Organization and Certificate ID
                    var table = new Table(2).UseAllAvailableWidth();
                    table.AddCell(new Cell()
                        .Add(new Paragraph(brandName)
                            .SetFont(titleFont)
                            .SetFontSize(14))
                        .Add(new Paragraph("Organization")
                            .SetFont(italicFont)
                            .SetFontSize(10))
                        .SetBorder(iText.Layout.Borders.Border.NO_BORDER)
                        .SetTextAlignment(TextAlignment.LEFT));

                    table.AddCell(new Cell()
                        .Add(new Paragraph($"Certificate ID: {certificateId}")
                            .SetFont(normalFont)
                            .SetFontSize(10))
                        .SetBorder(iText.Layout.Borders.Border.NO_BORDER)
                        .SetTextAlignment(TextAlignment.RIGHT));

                    document.Add(table.SetMarginTop(60));

                    document.Close();
                }
            }

            stream.Position = 0;
            return stream.ToArray();
        }

        public async Task<string?> GetCertificateUrlAsync(string userId, string courseId)
        {
            var progress = await _context.LearnerProgresses
                .Include(lp => lp.Course)
                .Include(lp => lp.User)
                .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId == null);

            if (progress == null || !progress.Completed)
            {
                return null;
            }

            if (!string.IsNullOrEmpty(progress.CertificateUrl))
            {
                return progress.CertificateUrl;
            }

            return null;
        }

        public async Task<string> GenerateAndSaveCertificateAsync(string userId, string courseId)
        {
            try
            {
                var progress = await _context.LearnerProgresses
                    .Include(lp => lp.Course)
                    .Include(lp => lp.User)
                    .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId == null);

                if (progress == null || !progress.Completed)
                {
                    throw new InvalidOperationException("Course not completed");
                }

                if (progress.Course != null && !progress.Course.CertificateEnabled)
                {
                    throw new InvalidOperationException("Certificates are not enabled for this course");
                }

                // Return existing certificate if valid
                if (!string.IsNullOrEmpty(progress.CertificateUrl) && 
                    !string.IsNullOrEmpty(progress.CertificateId) &&
                    progress.CertificateUrl.Contains($"/organisations/{progress.User?.OrganisationID}/certificates/"))
                {
                    _logger.LogInformation("Certificate already exists for user {UserId}, course {CourseId}", userId, courseId);
                    return progress.CertificateUrl;
                }

                // Clear old certificate data
                if (!string.IsNullOrEmpty(progress.CertificateUrl))
                {
                    _logger.LogWarning("Clearing invalid certificate for user {UserId}, course {CourseId}", userId, courseId);
                    progress.CertificateUrl = null;
                    progress.CertificateId = null;
                    progress.CertificateIssuedAt = null;
                    progress.CertificateIssuedBy = null;
                }

                // Generate certificate
                var pdfBytes = await GenerateCertificatePdfAsync(userId, courseId);
                var certificateId = await GetCertificateIdAsync(userId, courseId);
                var organisationId = progress.User?.OrganisationID;

                if (organisationId == null)
                {
                    throw new InvalidOperationException("User has no organization");
                }

                // Upload to Azure
                var fileName = $"certificate_{certificateId}.pdf";
                var orgIdString = organisationId.ToString()!;
                var folderPath = $"organisations/{orgIdString}";

                using var stream = new MemoryStream(pdfBytes);
                var blobUrl = await _blobService.UploadToCustomPathAsync(stream, fileName, folderPath, "application/pdf", "certificates");
                var certificateUrl = await _blobService.GetSasUrlAsync(blobUrl, expiryHours: 87600); // 10 years

                // Save to database
                progress.CertificateUrl = certificateUrl;
                progress.CertificateId = certificateId;
                progress.CertificateIssuedAt = DateTime.UtcNow;
                progress.CertificateIssuedBy = "System";
                await _context.SaveChangesAsync();

                // Log to audit
                var user = await _context.Users.FindAsync(userId);
                var course = await _context.Courses.FindAsync(courseId);
                if (user != null && course != null)
                {
                    await _auditLogService.LogCertificateIssuance(
                        userId, 
                        $"{user.FirstName} {user.LastName}", 
                        courseId, 
                        course.Title, 
                        certificateId
                    );
                }

                _logger.LogInformation("Certificate generated for user {UserId}, course {CourseId}", userId, courseId);
                return certificateUrl;
            }
            catch (InvalidOperationException)
            {
                throw;
            }
            catch (NotFoundException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating certificate for user {UserId}, course {CourseId}", userId, courseId);
                throw new InvalidOperationException($"Failed to generate certificate: {ex.Message}", ex);
            }
        }
    }

    public class NotFoundException : Exception
    {
        public NotFoundException(string message) : base(message) { }
    }
}
