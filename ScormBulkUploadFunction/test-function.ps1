# Test SCORM Bulk Upload Function

param(
    [Parameter(Mandatory=$true)]
    [string]$FunctionUrl,
    
    [Parameter(Mandatory=$true)]
    [string]$AuthKey,
    
    [Parameter(Mandatory=$true)]
    [string]$SpreadsheetId,
    
    [Parameter(Mandatory=$false)]
    [string]$SheetName = "Sheet1",
    
    [Parameter(Mandatory=$false)]
    [int]$StartRow = 2,
    
    [Parameter(Mandatory=$false)]
    [int]$EndRow = 2,
    
    [Parameter(Mandatory=$false)]
    [bool]$UpdateSheetStatus = $true
)

Write-Host "[TEST] Testing SCORM Bulk Upload Function..." -ForegroundColor Cyan

$headers = @{
    "X-Auth-Key" = $AuthKey
    "Content-Type" = "application/json"
}

$body = @{
    spreadsheetId = $SpreadsheetId
    sheetName = $SheetName
    startRow = $StartRow
    endRow = $EndRow
    updateSheetStatus = $UpdateSheetStatus
} | ConvertTo-Json

Write-Host "`n[REQUEST] Request Details:" -ForegroundColor Yellow
Write-Host "  URL: $FunctionUrl" -ForegroundColor Gray
Write-Host "  Spreadsheet: $SpreadsheetId" -ForegroundColor Gray
Write-Host "  Sheet: $SheetName" -ForegroundColor Gray
Write-Host "  Rows: $StartRow - $EndRow" -ForegroundColor Gray

Write-Host "`n[SENDING] Sending request..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod `
        -Uri $FunctionUrl `
        -Method Post `
        -Headers $headers `
        -Body $body `
        -TimeoutSec 1800  # 30 minutes
    
    Write-Host "`n[SUCCESS] Request completed!" -ForegroundColor Green
    
    Write-Host "`n[RESULTS] Results:" -ForegroundColor Cyan
    Write-Host "  Total Rows: $($response.totalRows)" -ForegroundColor White
    Write-Host "  Success: $($response.successCount)" -ForegroundColor Green
    Write-Host "  Failed: $($response.failureCount)" -ForegroundColor Red
    Write-Host "  Duration: $($response.duration)" -ForegroundColor White
    
    if ($response.results -and $response.results.Count -gt 0) {
        Write-Host "`n[DETAILS] Detailed Results:" -ForegroundColor Cyan
        foreach ($result in $response.results) {
            $statusColor = if ($result.status -eq "Success") { "Green" } else { "Red" }
            Write-Host "  Row $($result.rowNumber): $($result.title)" -ForegroundColor White
            Write-Host "    Status: $($result.status)" -ForegroundColor $statusColor
            
            if ($result.status -eq "Success") {
                Write-Host "    ID: $($result.contentId)" -ForegroundColor Gray
                Write-Host "    Files: $($result.fileCount)" -ForegroundColor Gray
                Write-Host "    Size: $([math]::Round($result.fileSizeBytes / 1MB, 2)) MB" -ForegroundColor Gray
                Write-Host "    URL: $($result.launchUrl)" -ForegroundColor Gray
            } else {
                Write-Host "    Error: $($result.errorMessage)" -ForegroundColor Red
            }
            Write-Host ""
        }
    }
    
    # Save full response to file
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $outputFile = "bulk-upload-result-$timestamp.json"
    $response | ConvertTo-Json -Depth 10 | Out-File $outputFile
    Write-Host "[SAVED] Full response saved to: $outputFile" -ForegroundColor Cyan
    
} catch {
    Write-Host "`n[ERROR] Request failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
        Write-Host "Status Code: $statusCode" -ForegroundColor Red
        
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response Body: $responseBody" -ForegroundColor Red
        } catch {
            # Ignore
        }
    }
    
    exit 1
}

Write-Host "`n[DONE] Test completed!" -ForegroundColor Green
