using ScormBulkUploadFunction.Models;

namespace ScormBulkUploadFunction.Services;

public interface IDatabaseService
{
    Task<long> SaveGlobalLibraryContentAsync(GlobalLibraryContent content);
}
