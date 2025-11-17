# Azure App Service Configuration Script for lmsBox
# Run this script after replacing the placeholder values with your actual Azure resource details

# ============================================================================
# REPLACE THESE VALUES WITH YOUR ACTUAL AZURE DETAILS
# ============================================================================

$resourceGroup = "atf-prod-core-infra-rg"
$appServiceName = "lmsbox"
$frontendUrl = "https://lmsbox-e0d2dqb4hwb8aqfp.uksouth-01.azurewebsites.net"

# Azure SQL Database connection string
# Get from: Azure Portal → SQL Database → Connection strings → ADO.NET
$sqlConnectionString = "Server=tcp:atf-prod-db.database.windows.net,1433;Initial Catalog=lmsbox;Persist Security Info=False;User ID=atf-db-admin;Password={your_password};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
# Example: "Server=tcp:yourserver.database.windows.net,1433;Initial Catalog=lmsbox;Persist Security Info=False;User ID=youradmin;Password=YourPassword;MultipleActiveResultSets=True;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

# Azure Storage connection string
# Get from: Azure Portal → Storage Account → Access keys → Connection string
$storageConnectionString = "YOUR_STORAGE_CONNECTION_STRING_HERE"
# Example: "DefaultEndpointsProtocol=https;AccountName=yourstorage;AccountKey=...;EndpointSuffix=core.windows.net"

# JWT Secret Key (generate a strong random string - at least 32 characters)
# You can generate one using: [System.Web.Security.Membership]::GeneratePassword(64,10)
$jwtKey = "k8vN9z!pL3@x#Q7r+Wm2^Yt6*Zb1&Xc9+Jd4!Hg7@Lp0^Vn3"

# Optional: SendGrid settings (leave empty if not using email)
$sendGridApiKey = "YOUR_SENDGRID_API_KEY_HERE"  # Your SendGrid API key
$sendGridFromEmail = "no-reply@yourdomain.com"
$sendGridFromName = "LMS Box"

# Optional: Application Insights connection string
$appInsightsConnectionString = ""

# ============================================================================
# DO NOT MODIFY BELOW THIS LINE
# ============================================================================

Write-Host "Configuring App Service: $appServiceName" -ForegroundColor Cyan
Write-Host "Resource Group: $resourceGroup" -ForegroundColor Cyan
Write-Host "Frontend URL: $frontendUrl" -ForegroundColor Cyan
Write-Host ""

# Validate required values
if ($resourceGroup -eq "<YOUR_RESOURCE_GROUP_NAME>") {
    Write-Host "ERROR: Please replace <YOUR_RESOURCE_GROUP_NAME> with your actual resource group name" -ForegroundColor Red
    exit 1
}

if ($sqlConnectionString -eq "<YOUR_SQL_CONNECTION_STRING>") {
    Write-Host "ERROR: Please replace <YOUR_SQL_CONNECTION_STRING> with your actual SQL connection string" -ForegroundColor Red
    exit 1
}

if ($storageConnectionString -eq "<YOUR_STORAGE_CONNECTION_STRING>") {
    Write-Host "ERROR: Please replace <YOUR_STORAGE_CONNECTION_STRING> with your actual storage connection string" -ForegroundColor Red
    exit 1
}

if ($jwtKey -eq "<GENERATE_A_STRONG_RANDOM_SECRET_KEY>") {
    Write-Host "ERROR: Please replace <GENERATE_A_STRONG_RANDOM_SECRET_KEY> with a strong random key" -ForegroundColor Red
    exit 1
}

Write-Host "Setting required App Service configuration..." -ForegroundColor Yellow

# Core settings
az webapp config appsettings set `
  --name $appServiceName `
  --resource-group $resourceGroup `
  --settings `
  ASPNETCORE_ENVIRONMENT="Production" `
  "ConnectionStrings__DefaultConnection=$sqlConnectionString" `
  "AzureStorage__ConnectionString=$storageConnectionString" `
  "AzureStorage__ContainerName=lms-content" `
  "Jwt__Key=$jwtKey" `
  "Jwt__Issuer=lmsbox" `
  "Jwt__Audience=lmsbox-audience" `
  "Jwt__ExpiryMinutes=60" `
  "Cors__AllowedOrigins__0=$frontendUrl" `
  "Cors__AllowCredentials=true" `
  "LoginLink__FrontendBaseUrl=$frontendUrl" `
  "LoginLink__ExpiryMinutes=15" `
  "LoginLink__AuthTokenExpiryMinutes=480" `
  "AppSettings__AppName=LMS Box" `
  "AppSettings__BaseUrl=$frontendUrl" `
  "AppSettings__SupportEmail=support@lmsbox.com"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Core settings configured successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to configure core settings" -ForegroundColor Red
    exit 1
}

# Optional: SendGrid settings
if ($sendGridApiKey -ne "") {
    Write-Host "Setting SendGrid configuration..." -ForegroundColor Yellow
    az webapp config appsettings set `
      --name $appServiceName `
      --resource-group $resourceGroup `
      --settings `
      "SendGrid__ApiKey=$sendGridApiKey" `
      "SendGrid__FromEmail=$sendGridFromEmail" `
      "SendGrid__FromName=$sendGridFromName"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ SendGrid settings configured!" -ForegroundColor Green
    }
}

# Optional: Application Insights
if ($appInsightsConnectionString -ne "") {
    Write-Host "Setting Application Insights configuration..." -ForegroundColor Yellow
    az webapp config appsettings set `
      --name $appServiceName `
      --resource-group $resourceGroup `
      --settings `
      "ApplicationInsights__ConnectionString=$appInsightsConnectionString"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Application Insights configured!" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "App Service configuration completed!" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Ensure your SQL Server firewall allows Azure services" -ForegroundColor White
Write-Host "2. Verify the storage container 'lms-content' exists" -ForegroundColor White
Write-Host "3. Restart the App Service to apply settings:" -ForegroundColor White
Write-Host "   az webapp restart --name $appServiceName --resource-group $resourceGroup" -ForegroundColor Cyan
Write-Host "4. Monitor deployment at: https://github.com/vikramkatyani/lmsBox/actions" -ForegroundColor White
Write-Host "5. Test API health: https://lmsbox.azurewebsites.net" -ForegroundColor White
Write-Host "6. Test frontend: $frontendUrl" -ForegroundColor White
Write-Host ""
