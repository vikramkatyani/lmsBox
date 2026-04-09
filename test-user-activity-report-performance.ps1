param(
    [string]$BaseUrl = "http://localhost:5132",
    [string]$Token = "",
    [int]$Iterations = 20,
    [int]$PageSize = 100,
    [int]$MinDaysDormant = 30,
    [int]$Concurrency = 4,
    [switch]$IncludeCombined
)

if ([string]::IsNullOrWhiteSpace($Token)) {
    Write-Host "Token is required. Pass -Token '<jwt>'" -ForegroundColor Yellow
    exit 1
}

$headers = @{ Authorization = "Bearer $Token" }

function Invoke-ReportRequest {
    param(
        [string]$Url,
        [hashtable]$Headers
    )

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        Invoke-RestMethod -Uri $Url -Headers $Headers -Method Get | Out-Null
        $sw.Stop()
        return [pscustomobject]@{ Success = $true; DurationMs = $sw.ElapsedMilliseconds; Url = $Url }
    }
    catch {
        $sw.Stop()
        return [pscustomobject]@{ Success = $false; DurationMs = $sw.ElapsedMilliseconds; Url = $Url; Error = $_.Exception.Message }
    }
}

function Run-Benchmark {
    param(
        [string]$Name,
        [string]$Url,
        [hashtable]$Headers,
        [int]$Iterations,
        [int]$Concurrency
    )

    Write-Host "Running $Name benchmark..." -ForegroundColor Cyan

    $jobs = @()
    for ($i = 1; $i -le $Iterations; $i++) {
        while (($jobs | Where-Object { $_.State -eq 'Running' }).Count -ge $Concurrency) {
            Start-Sleep -Milliseconds 100
            $jobs = $jobs | Where-Object { $_.State -eq 'Running' -or $_.State -eq 'Completed' -or $_.State -eq 'Failed' }
        }

        $jobs += Start-Job -ScriptBlock {
            param($u, $h)
            $sw = [System.Diagnostics.Stopwatch]::StartNew()
            try {
                Invoke-RestMethod -Uri $u -Headers $h -Method Get | Out-Null
                $sw.Stop()
                [pscustomobject]@{ Success = $true; DurationMs = $sw.ElapsedMilliseconds }
            }
            catch {
                $sw.Stop()
                [pscustomobject]@{ Success = $false; DurationMs = $sw.ElapsedMilliseconds; Error = $_.Exception.Message }
            }
        } -ArgumentList $Url, $Headers
    }

    $results = $jobs | Receive-Job -Wait -AutoRemoveJob
    $ok = $results | Where-Object { $_.Success }
    $fail = $results | Where-Object { -not $_.Success }

    if ($ok.Count -eq 0) {
        Write-Host "No successful requests for $Name" -ForegroundColor Red
        if ($fail.Count -gt 0) {
            Write-Host "Sample error: $($fail[0].Error)" -ForegroundColor Red
        }
        return
    }

    $durations = $ok | Select-Object -ExpandProperty DurationMs | Sort-Object
    $count = $durations.Count

    $p50Index = [Math]::Floor(($count - 1) * 0.50)
    $p95Index = [Math]::Floor(($count - 1) * 0.95)
    $p99Index = [Math]::Floor(($count - 1) * 0.99)

    $avg = [Math]::Round((($durations | Measure-Object -Average).Average), 2)
    $min = ($durations | Select-Object -First 1)
    $max = ($durations | Select-Object -Last 1)
    $p50 = $durations[$p50Index]
    $p95 = $durations[$p95Index]
    $p99 = $durations[$p99Index]

    Write-Host "" 
    Write-Host "[$Name]" -ForegroundColor Green
    Write-Host "  Success: $($ok.Count) / $Iterations"
    Write-Host "  Failed : $($fail.Count)"
    Write-Host "  Min    : ${min}ms"
    Write-Host "  Avg    : ${avg}ms"
    Write-Host "  P50    : ${p50}ms"
    Write-Host "  P95    : ${p95}ms"
    Write-Host "  P99    : ${p99}ms"
    Write-Host "  Max    : ${max}ms"
}

$summaryUrl = "$BaseUrl/api/admin/reports/user-activity/summary?minDaysDormant=$MinDaysDormant"
$usersUrl = "$BaseUrl/api/admin/reports/user-activity/users?minDaysDormant=$MinDaysDormant&pageNumber=1&pageSize=$PageSize&sortBy=engagement&sortDirection=desc"
$combinedUrl = "$BaseUrl/api/admin/reports/user-activity?minDaysDormant=$MinDaysDormant&pageNumber=1&pageSize=$PageSize&sortBy=engagement&sortDirection=desc"

Run-Benchmark -Name "User Activity Summary" -Url $summaryUrl -Headers $headers -Iterations $Iterations -Concurrency $Concurrency
Run-Benchmark -Name "User Activity Users" -Url $usersUrl -Headers $headers -Iterations $Iterations -Concurrency $Concurrency

if ($IncludeCombined) {
    Run-Benchmark -Name "User Activity Combined" -Url $combinedUrl -Headers $headers -Iterations $Iterations -Concurrency $Concurrency
}

Write-Host "" 
Write-Host "Done." -ForegroundColor Cyan
