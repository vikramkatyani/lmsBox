using lmsbox.host;
using Serilog;

var builder = WebApplication.CreateBuilder(args);
builder.AddLmsBoxHost();

var app = builder.Build();
app.UseLmsBoxHost();

try
{
    Log.Information("Starting lmsBox web host");
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
