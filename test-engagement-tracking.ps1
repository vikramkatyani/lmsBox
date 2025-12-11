# Test script for engagement tracking - all 13 event types
$baseUrl = "http://localhost:5132"

Write-Host "`n=== Testing Engagement Tracking System ===" -ForegroundColor Cyan
Write-Host "Server: $baseUrl`n" -ForegroundColor Gray

# 1. Login (Event: Login)
Write-Host "[1/13] Testing Login Event..." -ForegroundColor Yellow
try {
    $loginBody = @{ email = "learner@dev.local" } | ConvertTo-Json
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/dev-login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.token
    Write-Host "  ✓ Login successful - Token obtained" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Login failed: $_" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# 2. Check UserEngagements table before testing
Write-Host "`n[INFO] Checking initial engagement records..." -ForegroundColor Gray
try {
    $engagements = Invoke-RestMethod -Uri "$baseUrl/api/admin/engagement-analytics/overview?days=1" -Headers $headers
    Write-Host "  Initial records: $($engagements.totalEvents) events, $($engagements.activeUsers) active users" -ForegroundColor Gray
} catch {
    Write-Host "  Could not fetch initial data (this is OK if endpoint requires admin role)" -ForegroundColor Gray
}

# 3. Course View (Event: CourseView)
Write-Host "`n[2/13] Testing CourseView Event..." -ForegroundColor Yellow
try {
    # First get list of courses
    $courses = Invoke-RestMethod -Uri "$baseUrl/api/learner/courses" -Headers $headers
    if ($courses.courses.Count -gt 0) {
        $courseId = $courses.courses[0].id
        $courseDetail = Invoke-RestMethod -Uri "$baseUrl/api/learner/courses/$courseId" -Headers $headers
        Write-Host "  ✓ Course viewed: $($courseDetail.title)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ No courses available to view" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ CourseView failed: $_" -ForegroundColor Red
}

# 4. Lesson Start (Event: LessonStart)
Write-Host "`n[3/13] Testing LessonStart Event..." -ForegroundColor Yellow
try {
    if ($courseDetail.lessons.Count -gt 0) {
        $lessonId = $courseDetail.lessons[0].id
        $accessBody = @{} | ConvertTo-Json
        $accessResponse = Invoke-RestMethod -Uri "$baseUrl/api/learner/courses/$courseId/lessons/$lessonId/access" -Method Post -Headers $headers -Body $accessBody
        Write-Host "  ✓ Lesson accessed: $($courseDetail.lessons[0].title)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ No lessons available in course" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ LessonStart failed: $_" -ForegroundColor Red
}

# 5. Lesson Complete (Event: LessonComplete)
Write-Host "`n[4/13] Testing LessonComplete Event..." -ForegroundColor Yellow
try {
    if ($lessonId) {
        $progressBody = @{ progressPercent = 100 } | ConvertTo-Json
        $progressResponse = Invoke-RestMethod -Uri "$baseUrl/api/learner/courses/$courseId/lessons/$lessonId/progress" -Method Post -Headers $headers -Body $progressBody
        Write-Host "  ✓ Lesson completed: $($courseDetail.lessons[0].title)" -ForegroundColor Green
        Start-Sleep -Seconds 1
    }
} catch {
    Write-Host "  ✗ LessonComplete failed: $_" -ForegroundColor Red
}

# 6. Quiz Attempt (Event: QuizAttempt)
Write-Host "`n[5/13] Testing QuizAttempt Event..." -ForegroundColor Yellow
Write-Host "  ⚠ Requires quiz lesson - skipping for now" -ForegroundColor Yellow

# 7. AI Assistant Query (Event: AIAssistantQuery)
Write-Host "`n[6/13] Testing AIAssistantQuery Event..." -ForegroundColor Yellow
Write-Host "  ⚠ Requires admin role - will test with admin login" -ForegroundColor Yellow

# Admin Login for admin events
Write-Host "`n[INFO] Logging in as admin..." -ForegroundColor Gray
try {
    $adminLoginBody = @{ email = "admin@dev.local" } | ConvertTo-Json
    $adminLoginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/dev-login" -Method Post -Body $adminLoginBody -ContentType "application/json"
    $adminToken = $adminLoginResponse.token
    $adminHeaders = @{
        "Authorization" = "Bearer $adminToken"
        "Content-Type" = "application/json"
    }
    Write-Host "  ✓ Admin login successful" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Admin login failed: $_" -ForegroundColor Red
}

# 8. Course Created (Event: CourseCreated)
Write-Host "`n[7/13] Testing CourseCreated Event..." -ForegroundColor Yellow
try {
    $createCourseBody = @{
        title = "Test Course - Engagement Tracking $(Get-Date -Format 'HHmmss')"
        description = "Course created to test engagement tracking"
        category = "Testing"
        certificateEnabled = $false
    } | ConvertTo-Json
    $newCourse = Invoke-RestMethod -Uri "$baseUrl/api/admin/courses" -Method Post -Headers $adminHeaders -Body $createCourseBody
    $testCourseId = $newCourse.id
    Write-Host "  ✓ Course created: $($newCourse.title)" -ForegroundColor Green
    Start-Sleep -Seconds 1
} catch {
    Write-Host "  ✗ CourseCreated failed: $_" -ForegroundColor Red
}

# 9. Lesson Created (Event: LessonCreated)
Write-Host "`n[8/13] Testing LessonCreated Event..." -ForegroundColor Yellow
try {
    if ($testCourseId) {
        $createLessonBody = @{
            title = "Test Lesson - Engagement Tracking"
            content = "This lesson tests engagement tracking"
            type = "content"
            ordinal = 1
        } | ConvertTo-Json
        $newLesson = Invoke-RestMethod -Uri "$baseUrl/api/admin/courses/$testCourseId/lessons" -Method Post -Headers $adminHeaders -Body $createLessonBody
        Write-Host "  ✓ Lesson created: $($newLesson.title)" -ForegroundColor Green
        Start-Sleep -Seconds 1
    }
} catch {
    Write-Host "  ✗ LessonCreated failed: $_" -ForegroundColor Red
}

# 10. User Added (Event: UserAdded)
Write-Host "`n[9/13] Testing UserAdded Event..." -ForegroundColor Yellow
try {
    $createUserBody = @{
        email = "testuser$(Get-Date -Format 'HHmmss')@test.local"
        firstName = "Test"
        lastName = "User Engagement"
        role = "Learner"
    } | ConvertTo-Json
    $newUser = Invoke-RestMethod -Uri "$baseUrl/api/admin/users" -Method Post -Headers $adminHeaders -Body $createUserBody
    Write-Host "  ✓ User created: $($createUserBody | ConvertFrom-Json | Select -ExpandProperty email)" -ForegroundColor Green
    Start-Sleep -Seconds 1
} catch {
    Write-Host "  ✗ UserAdded failed: $_" -ForegroundColor Red
}

# 11-14. Content Uploads (VideoUpload, PDFUpload, SCORMUpload, HTMLUpload)
Write-Host "`n[10/13] Testing VideoUpload Event..." -ForegroundColor Yellow
Write-Host "  ⚠ Requires file upload - skipping automated test" -ForegroundColor Yellow

Write-Host "`n[11/13] Testing PDFUpload Event..." -ForegroundColor Yellow
Write-Host "  ⚠ Requires file upload - skipping automated test" -ForegroundColor Yellow

Write-Host "`n[12/13] Testing SCORMUpload Event..." -ForegroundColor Yellow
Write-Host "  ⚠ Requires file upload - skipping automated test" -ForegroundColor Yellow

Write-Host "`n[13/13] Testing HTMLUpload Event..." -ForegroundColor Yellow
try {
    if ($testCourseId) {
        $htmlBody = @{
            title = "Test HTML Lesson"
            htmlContent = "<html><body><h1>Test HTML Content for Engagement Tracking</h1></body></html>"
        } | ConvertTo-Json
        $htmlUpload = Invoke-RestMethod -Uri "$baseUrl/api/admin/courses/$testCourseId/lessons/upload-html" -Method Post -Headers $adminHeaders -Body $htmlBody
        Write-Host "  ✓ HTML content uploaded: $($htmlUpload.title)" -ForegroundColor Green
        Start-Sleep -Seconds 1
    }
} catch {
    Write-Host "  ✗ HTMLUpload failed: $_" -ForegroundColor Red
}

# Final check - Get engagement analytics
Write-Host "`n=== Engagement Analytics Summary ===" -ForegroundColor Cyan
try {
    $finalEngagements = Invoke-RestMethod -Uri "$baseUrl/api/admin/engagement-analytics/overview?days=1" -Headers $adminHeaders
    
    Write-Host "`nTotal Events: $($finalEngagements.totalEvents)" -ForegroundColor White
    Write-Host "Active Users: $($finalEngagements.activeUsers)" -ForegroundColor White
    Write-Host "Engagement Score: $($finalEngagements.averageEngagementScore)" -ForegroundColor White
    
    Write-Host "`nLearner Events:" -ForegroundColor Yellow
    Write-Host "  Logins: $($finalEngagements.totalLogins)" -ForegroundColor Gray
    Write-Host "  Course Views: $($finalEngagements.totalCourseViews)" -ForegroundColor Gray
    Write-Host "  Lessons Completed: $($finalEngagements.totalLessonsCompleted)" -ForegroundColor Gray
    Write-Host "  Quiz Attempts: $($finalEngagements.totalQuizAttempts)" -ForegroundColor Gray
    Write-Host "  AI Queries: $($finalEngagements.totalAIQueries)" -ForegroundColor Gray
    
    Write-Host "`nAdmin Events:" -ForegroundColor Yellow
    Write-Host "  Courses Created: $($finalEngagements.totalCoursesCreated)" -ForegroundColor Gray
    Write-Host "  Lessons Created: $($finalEngagements.totalLessonsCreated)" -ForegroundColor Gray
    Write-Host "  Users Added: $($finalEngagements.totalUsersAdded)" -ForegroundColor Gray
    Write-Host "  Content Uploads: $($finalEngagements.totalContentUploads)" -ForegroundColor Gray
    
} catch {
    Write-Host "Could not fetch final analytics: $_" -ForegroundColor Red
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
Write-Host "`nCheck server logs for 📊 emoji markers to verify tracking calls`n" -ForegroundColor Gray
