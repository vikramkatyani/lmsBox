using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using ScormBulkUploadFunction.Services;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices(services =>
    {
        services.AddApplicationInsightsTelemetryWorkerService();
        services.ConfigureFunctionsApplicationInsights();
        
        // Register services
        services.AddScoped<IGoogleSheetsService, GoogleSheetsService>();
        services.AddScoped<IGoogleDriveService, GoogleDriveService>();
        services.AddScoped<IScormProcessingService, ScormProcessingService>();
        services.AddScoped<IAzureBlobStorageService, AzureBlobStorageService>();
        services.AddScoped<IDatabaseService, DatabaseService>();
        
        // Add HTTP client
        services.AddHttpClient();
    })
    .Build();

host.Run();
