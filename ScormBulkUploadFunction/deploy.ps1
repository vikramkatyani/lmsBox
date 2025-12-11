# Deploy SCORM Bulk Upload Function to Azure

param(
    [Parameter(Mandatory=$true)]
    [string]$FunctionAppName,
    
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName,
    
    [Parameter(Mandatory=$false)]
    [string]$GoogleServiceAccountJsonPath,
    
    [Parameter(Mandatory=$false)]
    [string]$GoogleSpreadsheetId,
    
    [Parameter(Mandatory=$false)]
    [string]$SqlConnectionString,
    
    [Parameter(Mandatory=$false)]
    [string]$AzureStorageConnectionString,
    
    [Parameter(Mandatory=$false)]
    [string]$BulkUploadAuthKey
)

Write-Host "🚀 Deploying SCORM Bulk Upload Function..." -ForegroundColor Cyan

# Build the function
Write-Host "📦 Building function..." -ForegroundColor Yellow
Push-Location $PSScriptRoot
try {
    dotnet restore
    dotnet build --configuration Release
    
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
    
    Write-Host "✅ Build successful" -ForegroundColor Green
    
    # Publish the function
    Write-Host "📤 Publishing to Azure..." -ForegroundColor Yellow
    func azure functionapp publish $FunctionAppName --csharp
    
    if ($LASTEXITCODE -ne 0) {
        throw "Publish failed"
    }
    
    Write-Host "✅ Function published successfully" -ForegroundColor Green
    
    # Configure app settings if provided
    if ($GoogleServiceAccountJsonPath -or $GoogleSpreadsheetId -or $SqlConnectionString -or $AzureStorageConnectionString -or $BulkUploadAuthKey) {
        Write-Host "⚙️  Configuring app settings..." -ForegroundColor Yellow
        
        $settings = @()
        
        if ($GoogleServiceAccountJsonPath -and (Test-Path $GoogleServiceAccountJsonPath)) {
            $jsonContent = Get-Content $GoogleServiceAccountJsonPath -Raw
            $settings += "GoogleServiceAccountJson='$jsonContent'"
            Write-Host "  ✓ Google Service Account configured" -ForegroundColor Gray
        }
        
        if ($GoogleSpreadsheetId) {
            $settings += "GoogleSpreadsheetId=$GoogleSpreadsheetId"
            Write-Host "  ✓ Google Spreadsheet ID configured" -ForegroundColor Gray
        }
        
        if ($SqlConnectionString) {
            $settings += "SqlConnectionString='$SqlConnectionString'"
            Write-Host "  ✓ SQL Connection String configured" -ForegroundColor Gray
        }
        
        if ($AzureStorageConnectionString) {
            $settings += "AzureStorageConnectionString='$AzureStorageConnectionString'"
            Write-Host "  ✓ Azure Storage Connection String configured" -ForegroundColor Gray
        }
        
        if ($BulkUploadAuthKey) {
            $settings += "BulkUploadAuthKey=$BulkUploadAuthKey"
            Write-Host "  ✓ Auth Key configured" -ForegroundColor Gray
        }
        
        if ($settings.Count -gt 0) {
            $settingsString = $settings -join " "
            az functionapp config appsettings set `
                --name $FunctionAppName `
                --resource-group $ResourceGroupName `
                --settings $settingsString
            
            Write-Host "✅ App settings configured" -ForegroundColor Green
        }
    }
    
    # Get function URL
    Write-Host "`n📋 Function Details:" -ForegroundColor Cyan
    $functionUrl = az functionapp function show `
        --name $FunctionAppName `
        --resource-group $ResourceGroupName `
        --function-name BulkUploadScorm `
        --query "invokeUrlTemplate" `
        --output tsv
    
    Write-Host "  Function URL: $functionUrl" -ForegroundColor White
    Write-Host "  Resource Group: $ResourceGroupName" -ForegroundColor White
    Write-Host "  Function App: $FunctionAppName" -ForegroundColor White
    
    Write-Host "`n✨ Deployment completed successfully!" -ForegroundColor Green
    Write-Host "`n📚 Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Verify app settings in Azure Portal" -ForegroundColor White
    Write-Host "  2. Test with a single row: startRow=2, endRow=2" -ForegroundColor White
    Write-Host "  3. Run bulk upload for all rows" -ForegroundColor White
    Write-Host "  4. Monitor in Application Insights" -ForegroundColor White
    
} catch {
    Write-Host "❌ Deployment failed: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}
