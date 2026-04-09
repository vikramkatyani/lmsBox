param(
    [string]$BaseUrl = "http://localhost:5132",
    [string]$Token = "",
    [int]$Iterations = 20,
    [int]$PageSize = 100,
    [int]$Concurrency = 4,
    [string]$SortBy = "engagementScore",
    [string]$SortDirection = "desc"
)

if ([string]::IsNullOrWhiteSpace($Token)) {
    Write-Host "Token is required. Pass -Token '<jwt>'" -ForegroundColor Yellow
    exit 1
}

$headers = @{ Authorization = "Bearer $Token" }

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

$fromDate = [DateTime]::UtcNow.AddDays(-30).ToString("o")
$toDate = [DateTime]::UtcNow.ToString("o")

$overviewUrl = "$BaseUrl/api/EngagementAnalytics/overview?fromDate=$fromDate&toDate=$toDate"
$dailyUrl = "$BaseUrl/api/EngagementAnalytics/daily-scores?fromDate=$fromDate&toDate=$toDate"
$eventUrl = "$BaseUrl/api/EngagementAnalytics/event-breakdown?fromDate=$fromDate&toDate=$toDate"
$tableUrl = "$BaseUrl/api/EngagementAnalytics/top-users-table?fromDate=$fromDate&toDate=$toDate&pageNumber=1&pageSize=$PageSize&sortBy=$SortBy&sortDirection=$SortDirection"

Run-Benchmark -Name "Engagement Overview" -Url $overviewUrl -Headers $headers -Iterations $Iterations -Concurrency $Concurrency
Run-Benchmark -Name "Engagement Daily Scores" -Url $dailyUrl -Headers $headers -Iterations $Iterations -Concurrency $Concurrency
Run-Benchmark -Name "Engagement Event Breakdown" -Url $eventUrl -Headers $headers -Iterations $Iterations -Concurrency $Concurrency
Run-Benchmark -Name "Engagement Top Users Table" -Url $tableUrl -Headers $headers -Iterations $Iterations -Concurrency $Concurrency

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
