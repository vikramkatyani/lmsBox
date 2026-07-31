using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.EntityFrameworkCore;
using lmsbox.infrastructure.Data;
using ScormBulkUploadFunction.Services;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices(services =>
    {
        services.AddDbContext<ApplicationDbContext>((sp, options) =>
        {
            var configuration = sp.GetRequiredService<Microsoft.Extensions.Configuration.IConfiguration>();
            var conn = configuration["SqlConnectionString"];
            options.UseSqlServer(conn, b => b.MigrationsAssembly("lmsbox.infrastructure"));
        });

        services.AddApplicationInsightsTelemetryWorkerService();
        services.ConfigureFunctionsApplicationInsights();
        
        // Register services
        services.AddScoped<IGoogleSheetsService, GoogleSheetsService>();
        services.AddScoped<IGoogleDriveService, GoogleDriveService>();
        services.AddScoped<IScormProcessingService, ScormProcessingService>();
        services.AddScoped<IAzureBlobStorageService, AzureBlobStorageService>();
        services.AddScoped<IDatabaseService, DatabaseService>();
        services.AddScoped<IAutomationDispatchService, AutomationDispatchService>();
        services.AddScoped<IAutomationEmailSender, AutomationEmailSender>();
        
        // Add HTTP client
        services.AddHttpClient();
    })
    .Build();

host.Run();
