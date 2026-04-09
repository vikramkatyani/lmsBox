param(
    [string]$BaseUrl = "http://localhost:5132",
    [string]$Token = "",
    [int]$Iterations = 20,
    [int]$PageSize = 50,
    [string]$SortBy = "usageScore",
    [string]$SortDirection = "desc",
    [string]$Category = "",
    [string]$Search = "",
    [string]$Engagement = "",
    [int]$Concurrency = 4,
    [switch]$IncludeCombined
)

if ([string]::IsNullOrWhiteSpace($Token)) {
    Write-Host "Token is required. Pass -Token '<jwt>'" -ForegroundColor Yellow
    exit 1
}

$headers = @{ Authorization = "Bearer $Token" }

function Invoke-Benchmark {
    param(
        [string]$Name,
        [string]$Url,
        [hashtable]$Headers,
        [int]$Iterations,
        [int]$Concurrency
    )

    Write-Host "Running $Name benchmark..." -ForegroundColor Cyan

    $jobs = New-Object System.Collections.ArrayList
    for ($i = 1; $i -le $Iterations; $i++) {
        while (($jobs | Where-Object { $_.State -eq 'Running' }).Count -ge $Concurrency) {
            $null = Wait-Job -Job $jobs -Any
            $filteredJobs = @($jobs | Where-Object { $_.State -eq 'Running' -or $_.State -eq 'Completed' -or $_.State -eq 'Failed' })
            $jobs = New-Object System.Collections.ArrayList
            foreach ($job in $filteredJobs) {
                [void]$jobs.Add($job)
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
        } -ArgumentList $Url, $Headers))
    }

    $results = $jobs | Receive-Job -Wait -AutoRemoveJob
    $ok = $results | Where-Object { $_.Success }
    $fail = $results | Where-Object { -not $_.Success }

    if ($ok.Count -eq 0) {
        Write-Host "No successful requests for $Name." -ForegroundColor Red
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

$parts = @()
if (-not [string]::IsNullOrWhiteSpace($Category)) {
    $parts += "category=$([uri]::EscapeDataString($Category))"
}
if (-not [string]::IsNullOrWhiteSpace($Search)) {
    $parts += "search=$([uri]::EscapeDataString($Search))"
}
if (-not [string]::IsNullOrWhiteSpace($Engagement)) {
    $parts += "engagement=$([uri]::EscapeDataString($Engagement))"
}

$commonQuery = ""
if ($parts.Count -gt 0) {
    $commonQuery = ($parts -join '&')
}

$summaryUrl = "$BaseUrl/api/admin/reports/content-usage/summary"
if (-not [string]::IsNullOrWhiteSpace($commonQuery)) {
    $summaryUrl = "$summaryUrl?$commonQuery"
}

$contentQuery = @("pageNumber=1", "pageSize=$PageSize", "sortBy=$SortBy", "sortDirection=$SortDirection")
if (-not [string]::IsNullOrWhiteSpace($commonQuery)) {
    $contentQuery += $parts
}
$contentUrl = "$BaseUrl/api/admin/reports/content-usage/content?$($contentQuery -join '&')"
$combinedUrl = "$BaseUrl/api/admin/reports/content-usage?$($contentQuery -join '&')"

Write-Host "Summary URL : $summaryUrl" -ForegroundColor DarkGray
Write-Host "Content URL : $contentUrl" -ForegroundColor DarkGray
Write-Host "Iterations  : $Iterations" -ForegroundColor DarkGray
Write-Host "Concurrency : $Concurrency" -ForegroundColor DarkGray

Invoke-Benchmark -Name "Content Usage Summary" -Url $summaryUrl -Headers $headers -Iterations $Iterations -Concurrency $Concurrency
Invoke-Benchmark -Name "Content Usage Content" -Url $contentUrl -Headers $headers -Iterations $Iterations -Concurrency $Concurrency

if ($IncludeCombined) {
    Invoke-Benchmark -Name "Content Usage Combined" -Url $combinedUrl -Headers $headers -Iterations $Iterations -Concurrency $Concurrency
}

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
