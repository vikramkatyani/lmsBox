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
using QuestPDF.Infrastructure;

// Configure QuestPDF Community License
QuestPDF.Settings.License = LicenseType.Community;

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
        ClockSkew = TimeSpan.FromMinutes(5)
    };
    
    options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
    {
        OnAuthenticationFailed = context =>
        {
            var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
            logger.LogWarning("❌ JWT Authentication failed: {Error} | Path: {Path} | Exception: {Exception}", 
                context.Exception.Message, 
                context.Request.Path,
                context.Exception.GetType().Name);
            
            if (context.Exception is SecurityTokenExpiredException)
            {
                logger.LogWarning("🕐 Token expired. ValidTo: {ValidTo}, UtcNow: {UtcNow}", 
                    ((SecurityTokenExpiredException)context.Exception).Expires,
                    DateTime.UtcNow);
            }
            
            return Task.CompletedTask;
        },
        OnTokenValidated = context =>
        {
            var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
            var userId = context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                      ?? context.Principal?.FindFirst("sub")?.Value;
            var roles = string.Join(",", context.Principal?.FindAll(System.Security.Claims.ClaimTypes.Role).Select(c => c.Value) ?? Array.Empty<string>());
            
            // Log all claims for debugging
            var allClaims = string.Join(" | ", context.Principal?.Claims.Select(c => $"{c.Type}={c.Value}") ?? Array.Empty<string>());
            
            logger.LogInformation("✅ JWT Token validated | User: {UserId} | Roles: {Roles} | Path: {Path}", 
                userId, 
                roles,
                context.Request.Path);
            logger.LogDebug("📋 All Claims: {Claims}", allClaims);
            return Task.CompletedTask;
        },
        OnMessageReceived = context =>
        {
            var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
            var hasAuth = context.Request.Headers.ContainsKey("Authorization");
            var authValue = hasAuth ? context.Request.Headers["Authorization"].ToString() : "none";
            var tokenPreview = authValue.StartsWith("Bearer ") ? authValue.Substring(7, Math.Min(20, authValue.Length - 7)) + "..." : authValue;
            
            logger.LogDebug("📨 Auth Header Received | Has: {HasAuth} | Preview: {TokenPreview} | Path: {Path}", 
                hasAuth, 
                tokenPreview,
                context.Request.Path);
            return Task.CompletedTask;
        }
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

// Email service registration (uses SendGrid like LoginLinkService)
builder.Services.AddScoped<lmsBox.Server.Services.IEmailService, lmsBox.Server.Services.EmailService>();

// Azure Blob Storage service registration
builder.Services.AddScoped<lmsBox.Server.Services.IAzureBlobService, lmsBox.Server.Services.AzureBlobService>();

// Audit Log service registration
builder.Services.AddScoped<lmsBox.Server.Services.IAuditLogService, lmsBox.Server.Services.AuditLogService>();

// Certificate service registration
builder.Services.AddScoped<lmsBox.Server.Services.ICertificateService, lmsBox.Server.Services.CertificateService>();

// AI Assistant service registration
builder.Services.AddScoped<lmsBox.Server.Services.IAIAssistantService, lmsBox.Server.Services.AIAssistantService>();

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

app.UseCors("LocalDevClient");

// Only use HTTPS redirection in production to avoid losing Authorization headers during redirect
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseAuthentication();
app.UseAuthorization();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();

// Fallback to index.html for client-side routing
app.MapFallbackToFile("/index.html");

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
