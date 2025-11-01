using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using lmsBox.Server.Data;
using lmsBox.Server.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Serilog;
using Serilog.Events;
using Microsoft.AspNetCore.Diagnostics;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using System.Diagnostics;

var builder = WebApplication.CreateBuilder(args);

// Configure Application Insights (optional) - uses connection string from config / Azure App Setting
var aiConnectionString = builder.Configuration["ApplicationInsights:ConnectionString"];
if (!string.IsNullOrWhiteSpace(aiConnectionString))
{
    // Set environment variable that the AI SDK will read. This avoids using the deprecated AddApplicationInsightsTelemetry(string) overload.
    Environment.SetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING", aiConnectionString);
}

builder.Services.AddApplicationInsightsTelemetry();

// Configure Serilog early so startup logs are captured
var workspaceId = builder.Configuration["AzureLogAnalytics:WorkspaceId"];
var workspaceKey = builder.Configuration["AzureLogAnalytics:WorkspaceKey"];

var loggerCfg = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithMachineName()
    .Enrich.WithProcessId()
    .Enrich.WithThreadId()
    .WriteTo.Console();

if (!string.IsNullOrWhiteSpace(workspaceId) && !string.IsNullOrWhiteSpace(workspaceKey))
{
    loggerCfg = loggerCfg.WriteTo.AzureAnalytics(workspaceId, workspaceKey, logName: "AppLogs");
}
else
{
    // Optional: informational fallback so you can see startup without crashing
    loggerCfg = loggerCfg.Enrich.WithProperty("AzureLogAnalytics", "Disabled");
}

Log.Logger = loggerCfg.CreateLogger();

builder.Host.UseSerilog();

// Add this line before builder.Services.AddDbContext<ApplicationDbContext>(...)
var conn = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(conn, b => b.MigrationsAssembly("lmsbox.infrastructure")));

// Identity
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireLowercase = false;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequiredLength = 6;
})
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

// JWT authentication
var jwtSection = builder.Configuration.GetSection("Jwt");
var key = Encoding.UTF8.GetBytes(jwtSection["Key"] ?? "dev-secret-change-me-please-0123456789");
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = "JwtBearer";
    options.DefaultChallengeScheme = "JwtBearer";
})
.AddJwtBearer("JwtBearer", options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = true,
        ValidIssuer = jwtSection["Issuer"],
        ValidateAudience = true,
        ValidAudience = jwtSection["Audience"],
        ValidateLifetime = true,
        ClockSkew = System.TimeSpan.Zero
    };
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    });

// Add response compression for better performance
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProvider>();
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProvider>();
});

// Add response caching
builder.Services.AddResponseCaching();

// Add memory cache for better performance
builder.Services.AddMemoryCache();

var corsSection = builder.Configuration.GetSection("Cors");
var allowedOrigins = corsSection.GetValue<string[]>("AllowedOrigins") ?? Array.Empty<string>();
var allowCredentials = corsSection.GetValue<bool>("AllowCredentials");

builder.Services.AddCors(options =>
{
    options.AddPolicy("LocalDevClient", policy =>
    {
        if (allowedOrigins.Length == 0)
        {
            policy.AllowAnyOrigin()
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        }
        else
        {
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyHeader()
                  .AllowAnyMethod();

            if (allowCredentials)
            {
                policy.AllowCredentials();
            }
        }
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddScoped<ILoginLinkService, LoginLinkService>();
builder.Services.AddHttpClient();

var app = builder.Build();

// Serilog request logging - logs HTTP requests and responses
app.UseSerilogRequestLogging();

// Enable response compression
app.UseResponseCompression();

// Enable response caching
app.UseResponseCaching();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    // Global exception handler for production - logs unhandled exceptions and returns safe response
    app.UseExceptionHandler(errorApp =>
    {
        errorApp.Run(async context =>
        {
            var feature = context.Features.Get<IExceptionHandlerFeature>();
            var ex = feature?.Error;
            var correlationId = Activity.Current?.Id ?? context.TraceIdentifier;

            // Log using Serilog's static logger so it is captured by configured sinks immediately
            Log.ForContext("CorrelationId", correlationId)
               .Error(ex, "Unhandled exception while processing request {Method} {Path}", context.Request?.Method, context.Request?.Path);

            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json";

            var payload = JsonSerializer.Serialize(new { error = "An unexpected error occurred.", correlationId });
            await context.Response.WriteAsync(payload);
        });
    });
}

app.UseHttpsRedirection();
app.UseCors("LocalDevClient");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Dev convenience: apply pending EF Core migrations at startup
// apply migrations at startup but fail fast so app won't run with partial schema
using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Database.Migrate();
        logger.LogInformation("Database migrated successfully.");

        // Seed test data only in development
        if (app.Environment.IsDevelopment())
        {
            // DbSeeder.SeedAsync uses DI and async APIs; use GetAwaiter().GetResult() here in top-level Program
            lmsBox.Server.Data.DbSeeder.SeedAsync(scope.ServiceProvider).GetAwaiter().GetResult();
            logger.LogInformation("Development seeding completed.");
        }
    }
    catch (Exception ex)
    {
        logger.LogCritical(ex, "Database migration failed. Stopping application.");
        throw;
    }
}

try
{
    Log.Information("Starting web host");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Host terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
