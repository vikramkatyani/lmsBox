# Start Azure Function Locally

Write-Host "[INFO] Starting Azure Functions runtime..." -ForegroundColor Cyan
Write-Host "[INFO] This will keep running until you press Ctrl+C" -ForegroundColor Yellow
Write-Host ""

# Check if func command exists
try {
    $funcVersion = func --version 2>&1
    Write-Host "[OK] Azure Functions Core Tools version: $funcVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Azure Functions Core Tools not found!" -ForegroundColor Red
    Write-Host "[INFO] Install with: npm install -g azure-functions-core-tools@4" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[INFO] Function will be available at:" -ForegroundColor Cyan
Write-Host "  http://localhost:7071/api/bulk-upload/scorm" -ForegroundColor White
Write-Host ""
Write-Host "[INFO] Press Ctrl+C to stop the function" -ForegroundColor Yellow
Write-Host ""
Write-Host "=" * 80 -ForegroundColor Gray
Write-Host ""

# Start the function
func start
