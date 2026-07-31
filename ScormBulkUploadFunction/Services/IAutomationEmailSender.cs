namespace ScormBulkUploadFunction.Services;

public interface IAutomationEmailSender
{
    Task SendAsync(string to, string subject, string htmlBody);
}
