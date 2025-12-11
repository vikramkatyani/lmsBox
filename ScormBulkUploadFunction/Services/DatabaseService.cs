using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ScormBulkUploadFunction.Models;

namespace ScormBulkUploadFunction.Services;

public class DatabaseService : IDatabaseService
{
    private readonly ILogger<DatabaseService> _logger;
    private readonly string _connectionString;

    public DatabaseService(ILogger<DatabaseService> logger, IConfiguration configuration)
    {
        _logger = logger;
        _connectionString = configuration["SqlConnectionString"] 
            ?? throw new InvalidOperationException("SQL connection string not configured");
    }

    public async Task<long> SaveGlobalLibraryContentAsync(GlobalLibraryContent content)
    {
        try
        {
            const string sql = @"
                INSERT INTO GlobalLibraryContents 
                (Title, Description, ContentType, AzureBlobPath, FileName, FileSizeBytes, 
                 MimeType, Category, Tags, ThumbnailUrl, UploadedOn, UploadedBy, IsActive)
                VALUES 
                (@Title, @Description, @ContentType, @AzureBlobPath, @FileName, @FileSizeBytes,
                 @MimeType, @Category, @Tags, @ThumbnailUrl, @UploadedOn, @UploadedBy, @IsActive);
                SELECT CAST(SCOPE_IDENTITY() as bigint);";

            using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync();

            using var command = new SqlCommand(sql, connection);
            command.Parameters.AddWithValue("@Title", content.Title);
            command.Parameters.AddWithValue("@Description", (object?)content.Description ?? DBNull.Value);
            command.Parameters.AddWithValue("@ContentType", content.ContentType);
            command.Parameters.AddWithValue("@AzureBlobPath", content.AzureBlobPath);
            command.Parameters.AddWithValue("@FileName", content.FileName);
            command.Parameters.AddWithValue("@FileSizeBytes", content.FileSizeBytes);
            command.Parameters.AddWithValue("@MimeType", content.MimeType);
            command.Parameters.AddWithValue("@Category", (object?)content.Category ?? DBNull.Value);
            command.Parameters.AddWithValue("@Tags", (object?)content.Tags ?? DBNull.Value);
            command.Parameters.AddWithValue("@ThumbnailUrl", (object?)content.ThumbnailUrl ?? DBNull.Value);
            command.Parameters.AddWithValue("@UploadedOn", content.UploadedOn);
            command.Parameters.AddWithValue("@UploadedBy", (object?)content.UploadedBy ?? DBNull.Value);
            command.Parameters.AddWithValue("@IsActive", content.IsActive);

            var id = (long)(await command.ExecuteScalarAsync() ?? 0L);

            _logger.LogInformation("Saved global library content: ID={Id}, Title={Title}", id, content.Title);

            return id;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save global library content to database");
            throw;
        }
    }
}
