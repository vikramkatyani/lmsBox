param(
    [string]$BaseUrl = "http://localhost:5132",
    [string]$Token = "",
    [int]$Iterations = 20,
    [int]$PageSize = 100,
    [string]$SortBy = "overallProgress",
    [string]$SortDirection = "desc",
    [string]$Search = "",
    [int]$Concurrency = 4
)

if ([string]::IsNullOrWhiteSpace($Token)) {
    Write-Host "Token is required. Pass -Token '<jwt>'" -ForegroundColor Yellow
    exit 1
}

$headers = @{ Authorization = "Bearer $Token" }

function Invoke-BenchmarkRequest {
    param(
        [string]$Url,
        [hashtable]$Headers
    )

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        Invoke-RestMethod -Uri $Url -Headers $Headers -Method Get | Out-Null
        $sw.Stop()
        return [pscustomobject]@{ Success = $true; DurationMs = $sw.ElapsedMilliseconds }
    }
    catch {
        $sw.Stop()
        return [pscustomobject]@{ Success = $false; DurationMs = $sw.ElapsedMilliseconds; Error = $_.Exception.Message }
    }
}

$searchPart = ""
if (-not [string]::IsNullOrWhiteSpace($Search)) {
    $searchPart = "&search=$([uri]::EscapeDataString($Search))"
}

$url = "$BaseUrl/api/admin/reports/user-progress?pageNumber=1&pageSize=$PageSize&sortBy=$SortBy&sortDirection=$SortDirection$searchPart"

Write-Host "Benchmark URL: $url" -ForegroundColor Cyan
Write-Host "Iterations: $Iterations, Concurrency: $Concurrency" -ForegroundColor Cyan

$jobs = New-Object System.Collections.ArrayList
for ($i = 1; $i -le $Iterations; $i++) {
    while (($jobs | Where-Object { $_.State -eq 'Running' }).Count -ge $Concurrency) {
        $completed = Wait-Job -Job $jobs -Any
        if ($completed) {
            $filteredJobs = @($jobs | Where-Object { $_.State -eq 'Running' -or $_.State -eq 'Completed' -or $_.State -eq 'Failed' })
            $jobs = New-Object System.Collections.ArrayList
            foreach ($job in $filteredJobs) {
                [void]$jobs.Add($job)
            }
        }
    }

    [void]$jobs.Add((Start-Job -ScriptBlock {
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
    } -ArgumentList $url, $headers))
}

$results = $jobs | Receive-Job -Wait -AutoRemoveJob
$ok = $results | Where-Object { $_.Success }
$fail = $results | Where-Object { -not $_.Success }

if ($ok.Count -eq 0) {
    Write-Host "No successful requests." -ForegroundColor Red
    if ($fail.Count -gt 0) {
        Write-Host "Sample error: $($fail[0].Error)" -ForegroundColor Red
    }
    exit 1
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
Write-Host "[User Progress Report]" -ForegroundColor Green
Write-Host "  Success: $($ok.Count) / $Iterations"
Write-Host "  Failed : $($fail.Count)"
Write-Host "  Min    : ${min}ms"
Write-Host "  Avg    : ${avg}ms"
Write-Host "  P50    : ${p50}ms"
Write-Host "  P95    : ${p95}ms"
Write-Host "  P99    : ${p99}ms"
Write-Host "  Max    : ${max}ms"
