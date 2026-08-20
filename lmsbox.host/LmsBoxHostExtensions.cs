using lmsBox.Server.Configuration;
using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OAuth;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using lmsBox.Server.Controllers;
using lmsBox.Server.Data;
using lmsBox.Server.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace lmsbox.host;

public static class LmsBoxHostExtensions
{
    public static WebApplicationBuilder AddLmsBoxHost(this WebApplicationBuilder builder)
    {
        var aiConnectionString = builder.Configuration["ApplicationInsights:ConnectionString"];
        if (!string.IsNullOrWhiteSpace(aiConnectionString))
        {
            Environment.SetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING", aiConnectionString);
        }

        builder.Services.AddApplicationInsightsTelemetry();

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
            loggerCfg = loggerCfg.Enrich.WithProperty("AzureLogAnalytics", "Disabled");
        }

        Log.Logger = loggerCfg.CreateLogger();
        builder.Host.UseSerilog();

        var conn = builder.Configuration.GetConnectionString("DefaultConnection");
        builder.Services.AddDbContext<ApplicationDbContext>(options =>
            options.UseSqlServer(conn, b => b.MigrationsAssembly("lmsbox.infrastructure")));

        builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
        {
            options.Password.RequireDigit = false;
            options.Password.RequireUppercase = false;
            options.Password.RequireLowercase = false;
            options.Password.RequireNonAlphanumeric = false;
            options.Password.RequiredLength = 6;
            options.User.RequireUniqueEmail = false;
        })
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddDefaultTokenProviders();

        var jwtSection = builder.Configuration.GetSection("Jwt");
        var key = Encoding.UTF8.GetBytes(jwtSection["Key"] ?? "dev-secret-change-me-please-0123456789");
        var authBuilder = builder.Services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options =>
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

            options.Events = new JwtBearerEvents
            {
                OnAuthenticationFailed = context =>
                {
                    var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<LmsBoxHostBootstrap>>();
                    logger.LogWarning("JWT Authentication failed: {Error} | Path: {Path}",
                        context.Exception.Message,
                        context.Request.Path);

                    if (context.Exception is SecurityTokenExpiredException expired)
                    {
                        logger.LogWarning("Token expired. ValidTo: {ValidTo}, UtcNow: {UtcNow}",
                            expired.Expires,
                            DateTime.UtcNow);
                    }

                    return Task.CompletedTask;
                },
                OnTokenValidated = context =>
                {
                    var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<LmsBoxHostBootstrap>>();
                    var userId = context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                              ?? context.Principal?.FindFirst("sub")?.Value;
                    var roles = string.Join(",", context.Principal?.FindAll(System.Security.Claims.ClaimTypes.Role).Select(c => c.Value) ?? Array.Empty<string>());

                    logger.LogInformation("JWT Token validated | User: {UserId} | Roles: {Roles} | Path: {Path}",
                        userId,
                        roles,
                        context.Request.Path);
                    return Task.CompletedTask;
                }
            };
        });

        ConfigureExternalAuth(builder, authBuilder);

        builder.Services.AddControllers()
            .AddApplicationPart(typeof(AdminAutomationController).Assembly)
            .AddJsonOptions(options =>
            {
                options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            })
            .ConfigureApiBehaviorOptions(options =>
            {
                options.InvalidModelStateResponseFactory = context =>
                {
                    var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<LmsBoxHostBootstrap>>();
                    var errors = context.ModelState
                        .Where(e => e.Value?.Errors.Count > 0)
                        .Select(e => new { Field = e.Key, Errors = e.Value!.Errors.Select(x => x.ErrorMessage).ToArray() })
                        .ToList();

                    logger.LogWarning("Model validation failed: {Errors}", JsonSerializer.Serialize(errors));

                    return new BadRequestObjectResult(new
                    {
                        message = "Validation failed",
                        errors
                    });
                };
            });

        builder.Services.Configure<Microsoft.AspNetCore.Server.Kestrel.Core.KestrelServerOptions>(options =>
        {
            options.Limits.MaxRequestBodySize = 100 * 1024 * 1024;
        });

        builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
        {
            options.MultipartBodyLengthLimit = 100 * 1024 * 1024;
        });

        builder.Services.AddResponseCompression(options =>
        {
            options.EnableForHttps = true;
            options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProvider>();
            options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProvider>();
        });

        builder.Services.AddResponseCaching();
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
        builder.Services.AddScoped<TenantResolver>();
        builder.Services.AddScoped<TenantUserLookup>();
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddScoped<TenantBrandingAssetService>();
        builder.Services.AddHttpClient();
        builder.Services.AddScoped<IEmailService, EmailService>();
        builder.Services.AddScoped<IAzureBlobService, AzureBlobService>();
        builder.Services.AddScoped<IStorageQuotaService, StorageQuotaService>();
        builder.Services.AddScoped<IAuditLogService, AuditLogService>();
        builder.Services.AddScoped<ICertificateService, CertificateServiceStub>();
        builder.Services.AddScoped<IAIAssistantService, AIAssistantService>();
        builder.Services.AddScoped<IInteractiveBlockPromptService, InteractiveBlockPromptService>();
        builder.Services.AddScoped<IInteractiveBlockTemplateService, InteractiveBlockTemplateService>();
        builder.Services.AddScoped<IInteractiveBlockDisplayService, InteractiveBlockDisplayService>();
        builder.Services.AddScoped<IEngagementTrackingService, EngagementTrackingService>();
        builder.Services.Configure<QuizFeatureOptions>(
            builder.Configuration.GetSection(QuizFeatureOptions.SectionName));
        builder.Services.AddSingleton<IQuizFeatureService, QuizFeatureService>();
        builder.Services.AddScoped<IAdminActivityTracker, AdminActivityTracker>();
        builder.Services.AddScoped<IActivityLogQueryService, ActivityLogQueryService>();

        var useInProcessAutomationWorker = builder.Configuration.GetValue("Automation:UseInProcessWorker", true);
        if (useInProcessAutomationWorker)
        {
            builder.Services.AddHostedService<AutomationDispatchWorker>();
        }

        return builder;
    }

    public static WebApplication UseLmsBoxHost(this WebApplication app)
    {
        app.UseSerilogRequestLogging();
        app.UseResponseCompression();
        app.UseResponseCaching();

        if (app.Environment.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
            app.UseSwagger();
            app.UseSwaggerUI();
        }
        else
        {
            app.UseExceptionHandler(errorApp =>
            {
                errorApp.Run(async context =>
                {
                    var feature = context.Features.Get<IExceptionHandlerFeature>();
                    var ex = feature?.Error;
                    var correlationId = Activity.Current?.Id ?? context.TraceIdentifier;

                    Log.ForContext("CorrelationId", correlationId)
                       .Error(ex, "Unhandled exception while processing request {Method} {Path}",
                           context.Request?.Method, context.Request?.Path);

                    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                    context.Response.ContentType = "application/json";

                    var payload = JsonSerializer.Serialize(new { error = "An unexpected error occurred.", correlationId });
                    await context.Response.WriteAsync(payload);
                });
            });
        }

        app.UseCors("LocalDevClient");

        if (!app.Environment.IsDevelopment())
        {
            app.UseHttpsRedirection();
        }

        app.UseAuthentication();
        app.UseAuthorization();

        app.UseDefaultFiles();
        app.UseStaticFiles(new StaticFileOptions
        {
            OnPrepareResponse = ctx =>
            {
                if (ctx.File.Name.StartsWith("scorm-player", StringComparison.OrdinalIgnoreCase))
                {
                    ctx.Context.Response.Headers.Append("Cache-Control", "no-cache, no-store, must-revalidate");
                    ctx.Context.Response.Headers.Append("Pragma", "no-cache");
                    ctx.Context.Response.Headers.Append("Expires", "0");
                }
            }
        });

        app.MapControllers();
        app.MapFallbackToFile("/index.html");

        using (var scope = app.Services.CreateScope())
        {
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<LmsBoxHostBootstrap>>();
            try
            {
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var pending = db.Database.GetPendingMigrations().ToList();
                if (pending.Count > 0)
                {
                    logger.LogWarning(
                        "Applying {Count} pending EF migrations: {Migrations}",
                        pending.Count,
                        string.Join(", ", pending));
                }

                db.Database.Migrate();
                logger.LogInformation("Database migrated successfully.");
            }
            catch (Exception ex)
            {
                logger.LogCritical(
                    ex,
                    "Database migration failed. App will continue starting so diagnostics remain available. Fix the schema, then restart.");
            }

            try
            {
                // BIFA is a product tenant, not local-only. Create it (with local CSS/theme)
                // on every environment if missing. Development also reseeds branding.
                DbSeeder.SeedBifaTenantAsync(
                    app.Services,
                    overwriteBranding: app.Environment.IsDevelopment()).GetAwaiter().GetResult();
                logger.LogInformation("BIFA tenant seed completed.");

                if (app.Environment.IsDevelopment())
                {
                    DbSeeder.SeedAsync(scope.ServiceProvider).GetAwaiter().GetResult();
                    logger.LogInformation("Development seeding completed.");
                }
            }
            catch (Exception ex)
            {
                logger.LogCritical(ex, "BIFA / development seed failed. App will continue starting.");
            }
        }

        return app;
    }

    private static void ConfigureExternalAuth(WebApplicationBuilder builder, AuthenticationBuilder authBuilder)
    {
        var googleSection = builder.Configuration.GetSection("Authentication:Google");
        var googleClientId = googleSection["ClientId"];
        var googleClientSecret = googleSection["ClientSecret"];
        if (!string.IsNullOrWhiteSpace(googleClientId) && !string.IsNullOrWhiteSpace(googleClientSecret))
        {
            authBuilder.AddGoogle("Google", options =>
            {
                options.SignInScheme = IdentityConstants.ExternalScheme;
                options.ClientId = googleClientId;
                options.ClientSecret = googleClientSecret;
                options.Events = new OAuthEvents
                {
                    OnRemoteFailure = context => HandleExternalAuthFailure(context, "Google")
                };
            });
        }

        var microsoftSection = builder.Configuration.GetSection("Authentication:Microsoft");
        var microsoftClientId = microsoftSection["ClientId"];
        var microsoftClientSecret = microsoftSection["ClientSecret"];
        var microsoftTenantId = microsoftSection["TenantId"];
        if (!string.IsNullOrWhiteSpace(microsoftClientId) && !string.IsNullOrWhiteSpace(microsoftClientSecret))
        {
            authBuilder.AddMicrosoftAccount("Microsoft", options =>
            {
                options.SignInScheme = IdentityConstants.ExternalScheme;
                options.ClientId = microsoftClientId;
                options.ClientSecret = microsoftClientSecret;
                if (!string.IsNullOrWhiteSpace(microsoftTenantId))
                {
                    options.AuthorizationEndpoint = $"https://login.microsoftonline.com/{microsoftTenantId}/oauth2/v2.0/authorize";
                    options.TokenEndpoint = $"https://login.microsoftonline.com/{microsoftTenantId}/oauth2/v2.0/token";
                }

                options.Events = new OAuthEvents
                {
                    OnRemoteFailure = context => HandleExternalAuthFailure(context, "Microsoft")
                };
            });
        }
    }

    private static Task HandleExternalAuthFailure(RemoteFailureContext context, string provider)
    {
        var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<LmsBoxHostBootstrap>>();
        var frontendBaseUrl = context.HttpContext.RequestServices.GetRequiredService<IConfiguration>()["LoginLink:FrontendBaseUrl"];
        if (string.IsNullOrWhiteSpace(frontendBaseUrl))
        {
            frontendBaseUrl = $"{context.Request.Scheme}://{context.Request.Host}";
        }

        logger.LogError(context.Failure, "{Provider} external login remote failure. Error={Error}", provider, context.Failure?.Message);

        string? tenantCode = null;
        context.Properties?.Items.TryGetValue("tenant_code", out tenantCode);
        var path = string.IsNullOrWhiteSpace(tenantCode)
            ? "/login"
            : TenantPortalUrl.TenantLoginPath(tenantCode);

        context.HandleResponse();
        context.Response.Redirect($"{frontendBaseUrl.TrimEnd('/')}{path}#authError=external_failed");
        return Task.CompletedTask;
    }
}
