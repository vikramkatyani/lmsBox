# Test script for LMS Admin API with JWT authentication
# This script demonstrates how to authenticate and call the admin courses API

$BaseUrl = "http://localhost:5132"
$AdminEmail = "admin@dev.local"

Write-Host "=== LMS Admin API Test Script ===" -ForegroundColor Green
Write-Host "Base URL: $BaseUrl" -ForegroundColor Yellow
Write-Host "Admin Email: $AdminEmail" -ForegroundColor Yellow
Write-Host ""

# Step 1: Request login link
Write-Host "Step 1: Requesting login link..." -ForegroundColor Cyan
try {
    $loginRequest = @{
        email = $AdminEmail
    }
    
    $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method Post -Body ($loginRequest | ConvertTo-Json) -ContentType "application/json"
    Write-Host "✅ Login link requested successfully" -ForegroundColor Green
    Write-Host "Response: $($loginResponse.message)" -ForegroundColor White
    Write-Host ""
    
    Write-Host "🔍 CHECK THE SERVER CONSOLE LOGS for the login token!" -ForegroundColor Yellow
    Write-Host "Look for a log entry with the login token or link." -ForegroundColor Yellow
    Write-Host ""
    
    # Step 2: Prompt for token
    $token = Read-Host "Enter the login token from the server logs"
    
    if ([string]::IsNullOrWhiteSpace($token)) {
        Write-Host "❌ No token provided. Exiting." -ForegroundColor Red
        exit 1
    }
    
    # Step 3: Verify login link to get JWT
    Write-Host "Step 2: Verifying login token to get JWT..." -ForegroundColor Cyan
    
    $verifyRequest = @{
        token = $token.Trim()
    }
    
    $jwtResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/verify-login-link" -Method Post -Body ($verifyRequest | ConvertTo-Json) -ContentType "application/json"
    
    $jwtToken = $jwtResponse.token
    $expires = $jwtResponse.expires
    
    Write-Host "✅ JWT token obtained successfully" -ForegroundColor Green
    Write-Host "Token expires: $expires" -ForegroundColor White
    Write-Host ""
    
    # Step 4: Call admin courses API
    Write-Host "Step 3: Calling admin courses API..." -ForegroundColor Cyan
    
    $headers = @{
        "Authorization" = "Bearer $jwtToken"
        "Accept" = "application/json"
    }
    
    $coursesResponse = Invoke-RestMethod -Uri "$BaseUrl/api/admin/courses?sort=updated_desc" -Method Get -Headers $headers
    
    Write-Host "✅ Admin courses API called successfully" -ForegroundColor Green
    Write-Host "Total courses: $($coursesResponse.total)" -ForegroundColor White
    Write-Host ""
    
    # Display course information
    Write-Host "📚 Course List:" -ForegroundColor Cyan
    foreach ($course in $coursesResponse.items) {
        Write-Host "  - ID: $($course.id)" -ForegroundColor Yellow
        Write-Host "    Title: $($course.title)" -ForegroundColor White
        Write-Host "    Status: $($course.status)" -ForegroundColor Gray
        Write-Host "    Lessons: $($course.lessonCount)" -ForegroundColor Gray
        Write-Host ""
    }
    
    Write-Host "🎉 Test completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your JWT token for manual testing:" -ForegroundColor Yellow
    Write-Host $jwtToken -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $responseText = $reader.ReadToEnd()
        Write-Host "Response: $responseText" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "📝 Manual testing with curl:" -ForegroundColor Yellow
Write-Host "curl -H 'Authorization: Bearer YOUR_TOKEN_HERE' 'http://localhost:5132/api/admin/courses?sort=updated_desc'" -ForegroundColor Gray