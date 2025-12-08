# New Course Access Notifications

## Overview
Implemented comprehensive email notifications to inform learners whenever they gain access to new courses through learning pathways.

## Notification Scenarios

### ✅ Scenario 1: Course Added to Existing Learning Pathway
**When**: Admin adds new courses to a pathway that already has learners assigned
**Action**: All learners assigned to that pathway receive an email notification about the new courses
**Email**: "New Course Access" email with pathway context

**Implementation**: `AdminLearningPathwaysController.UpdateLearningPathway()`
- Detects newly added courses by comparing `existingCourseIds` vs `request.CourseIds`
- Queries all learners assigned to the pathway
- Sends `SendNewCourseAccessEmailAsync` to each learner

### ✅ Scenario 2: Learning Pathway Assigned to Existing Learner
**When**: Admin assigns an existing pathway to a learner who wasn't previously enrolled
**Action**: Learner receives an email about the pathway assignment with all included courses
**Email**: "Pathway Assignment" email listing all courses

**Implementation**: `AdminLearningPathwaysController.UpdateLearningPathway()` and `CreateLearningPathway()`
- Detects newly assigned users with `newUserIds = request.UserIds.Except(existingUserIds)`
- Sends `SendPathwayAssignmentEmailAsync` to newly assigned learners

### ✅ Scenario 3: New Learner Created with Pathway Assignment
**When**: Admin creates a new learner account and assigns learning pathways
**Action**: Learner receives welcome email that includes all assigned courses
**Email**: "Learner Registration" email with conditional course listing

**Implementation**: `AdminUsersController.CreateUser()`
- After creating user and assigning pathways
- Queries pathway courses
- Sends `SendLearnerRegistrationEmailAsync` with course list

### 📧 Bulk User Creation
**When**: Admin uses bulk user creation feature (CSV/email list import)
**Action**: Each newly created learner receives a welcome email
**Email**: "Learner Registration" email with conditional course listing

**Implementation**: `AdminUsersController.BulkCreateUsers()`
- Creates users in loop
- Assigns pathways if provided in request
- Queries pathway courses for each user
- Sends `SendLearnerRegistrationEmailAsync` with course list to each user
- Emails sent sequentially (not batched)

**Previous Issue**: Bulk creation was only sending pathway assignment email if pathways existed, and no email at all otherwise
**Fixed**: Now sends learner registration email to all bulk-created users, with courses if pathways assigned

## Email Templates

### 1. NewCourseAccessEmail.html (NEW)
**Purpose**: Notify learners about new courses added to their pathways
**Template Location**: `lmsBox.Server/EmailTemplates/NewCourseAccessEmail.html`

**Template Variables**:
- `{{BrandName}}`: Organization's brand name
- `{{FirstName}}`: Learner's first name
- `{{PathwayName}}`: Name of the pathway (optional)
- `{{CourseListHtml}}`: HTML list of course titles (`<li>` elements)
- `{{CourseCount}}`: Number of new courses
- `{{IsMultipleCourses}}`: Boolean flag (true if multiple courses)
- `{{PortalUrl}}`: Link to learning portal
- `{{SupportEmail}}`: Organization support email

**Features**:
- Conditional plural handling ("course" vs "courses")
- Green "NEW COURSE" badge
- Pathway context when applicable
- Responsive design

### 2. PathwayAssignmentEmail.html (EXISTING)
**Purpose**: Notify learners when assigned to a new pathway
**Template Location**: `lmsBox.Server/EmailTemplates/PathwayAssignmentEmail.html`

**Used for**: Initial pathway assignment to existing users

### 3. LearnerRegistrationEmail.html (UPDATED)
**Purpose**: Welcome new learners with account creation details
**Template Location**: `lmsBox.Server/EmailTemplates/LearnerRegistrationEmail.html`

**Updated to conditionally show**:
- Course list if pathways assigned during registration
- Generic message if no pathways assigned

## Email Service Methods

### SendNewCourseAccessEmailAsync (NEW)
```csharp
Task SendNewCourseAccessEmailAsync(
    string userEmail, 
    string organisationId, 
    string portalUrl, 
    List<string> courseNames, 
    string? pathwayName = null, 
    string? firstName = null
)
```

**Parameters**:
- `userEmail`: Recipient email address
- `organisationId`: Organization ID for branding
- `portalUrl`: Link to LMS portal
- `courseNames`: List of new course titles
- `pathwayName`: (Optional) Name of pathway courses were added to
- `firstName`: (Optional) Learner's first name for personalization

**Email Subject**:
- Single course: "New Course Available - {BrandName}"
- Multiple courses: "New Courses Available - {BrandName}"

### SendPathwayAssignmentEmailAsync (EXISTING)
Used for full pathway assignments (all courses at once)

### SendLearnerRegistrationEmailAsync (UPDATED)
Now accepts `List<string>? courseNames` instead of `bool hasCourses`

## Controller Changes

### AdminLearningPathwaysController.UpdateLearningPathway()

**New Logic for Detecting Course Additions**:
```csharp
// Track existing courses before update
var existingCourseIds = pathway.PathwayCourses.Select(pc => pc.CourseId).ToList();

// Identify newly added courses
var newCourseIds = request.CourseIds.Except(existingCourseIds).ToList();

// If new courses added and pathway has learners
if (newCourseIds.Any() && pathway.LearnerProgresses.Any())
{
    // Get course titles
    var newCourses = await _context.Courses
        .Where(c => newCourseIds.Contains(c.Id))
        .ToListAsync();
    var newCourseNames = newCourses.Select(c => c.Title).ToList();
    
    // Notify all assigned learners
    foreach (var user in assignedUsers)
    {
        await _emailService.SendNewCourseAccessEmailAsync(
            user.Email!,
            organisation!.Id.ToString(),
            portalUrl,
            newCourseNames,
            pathway.Title,  // Include pathway name for context
            user.FirstName
        );
    }
}
```

**Workflow**:
1. Load pathway with existing courses and learners
2. Update pathway basic properties (title, description)
3. **Detect new courses**: Compare `request.CourseIds` with existing
4. Update course list (remove old, add new)
5. Update learner assignments if changed
6. **Notify learners about new courses** (if any)
7. **Notify newly assigned learners** about pathway (if any)

### AdminUsersController.CreateUser()

**Updated Email Flow for Learners**:
```csharp
// 1. Create user
var user = new ApplicationUser { ... };

// 2. DON'T send email yet for learners

// 3. Assign pathways
foreach (var pathwayId in request.GroupIds) {
    _context.LearnerPathwayProgresses.Add(new LearnerPathwayProgress { ... });
}

// 4. Extract course names from pathways
var pathways = await _context.LearningPathways
    .Include(p => p.PathwayCourses).ThenInclude(pc => pc.Course)
    .ToListAsync();
var courseNames = pathways.SelectMany(p => p.PathwayCourses...).Distinct().ToList();

// 5. Send welcome email with course list
await _emailService.SendLearnerRegistrationEmailAsync(
    user.Email, portalUrl, orgId, firstName, courseNames
);
```

## Testing Scenarios

### Test 1: Add Course to Pathway with Learners
**Steps**:
1. Create pathway with Course A
2. Assign learner to pathway
3. Edit pathway, add Course B and Course C
4. Save changes

**Expected**:
- Learner receives "New Courses Available" email
- Email lists Course B and Course C
- Email mentions pathway name
- Email has "Start Learning" button

### Test 2: Assign Pathway to Existing Learner
**Steps**:
1. Create pathway with 3 courses
2. Create learner (no pathways)
3. Edit learner, assign pathway
4. Save changes

**Expected**:
- Learner receives "New Learning Pathway Assigned" email
- Email lists all 3 courses
- Email mentions pathway name
- Email has "Access Learning Portal" button

### Test 3: Create Learner with Pathways
**Steps**:
1. Create pathway with 4 courses
2. Create new learner account
3. Assign pathway during creation
4. Submit

**Expected**:
- Learner receives "Welcome to {BrandName} Learning Portal" email
- Email shows "You have been assigned the following courses:"
- Email lists all 4 courses
- Email has "Access LMS Portal" button

### Test 4: Bulk Create Learners with Pathways
**Steps**:
1. Create pathway with 3 courses
2. Use bulk user creation (CSV or email list)
3. Assign pathway to all new learners
4. Submit

**Expected**:
- Each learner receives "Welcome to {BrandName} Learning Portal" email
- Email shows assigned courses
- Email has "Access LMS Portal" button
- All emails sent in sequence (one per user)

### Test 5: Bulk Create Learners without Pathways
**Steps**:
1. Use bulk user creation
2. Do NOT assign any pathways
3. Submit

**Expected**:
- Each learner receives "Welcome to {BrandName} Learning Portal" email
- Email shows generic message: "Courses may or may not be assigned to you yet"
- Email prompts to contact administrator

### Test 6: Edit Pathway - Remove Course
**Steps**:
1. Pathway has Course A, B, C
2. Edit pathway, remove Course B
3. Save changes

**Expected**:
- **No email sent** (courses removed, not added)
- Learners can still see remaining courses in portal

### Test 7: Edit Pathway - Replace Courses
**Steps**:
1. Pathway has Course A, B
2. Edit pathway, change to Course B, C, D
3. Save changes

**Expected**:
- Learners receive email about **new courses only**: C and D
- Course B is not mentioned (already existed)

## Email Deduplication

The system intelligently handles different notification types:

| Scenario | Email Type | Sent To |
|----------|-----------|---------|
| New user + pathway | Learner Registration | New user only |
| Existing user + new pathway | Pathway Assignment | Newly assigned users |
| Existing pathway + new courses | New Course Access | All pathway members |
| Existing pathway + new users | Pathway Assignment | Newly added users |

**No duplicate emails**: If a user is newly assigned to a pathway, they get **Pathway Assignment** email (includes all courses). They don't also get "New Course Access" email.

## Logging

All email sends are logged for debugging:

```csharp
// Success
_logger.LogInformation("New course notification sent to {Email} for {CourseCount} new course(s) in pathway {PathwayId}", 
    user.Email, newCourseNames.Count, pathway.Id);

// Failure
_logger.LogError(emailEx, "Failed to send new course notification to {Email}", user.Email);
```

Check logs with:
```powershell
# View recent email logs
Get-Content logs/lmsbox-*.log | Select-String "course notification"
```

## Configuration

No additional configuration required. Uses existing email settings:

**appsettings.json**:
```json
{
  "SendGrid": {
    "ApiKey": "SG.xxx",
    "FromEmail": "noreply@lmsbox.com"
  },
  "AppSettings": {
    "AppName": "LMS Box",
    "SupportEmail": "support@lmsbox.com"
  }
}
```

Organization-specific branding is pulled from the `Organisations` table.

## Error Handling

Email failures **do not prevent** pathway/course updates:

```csharp
try
{
    await _emailService.SendNewCourseAccessEmailAsync(...);
}
catch (Exception emailEx)
{
    _logger.LogError(emailEx, "Failed to send notification");
    // Don't throw - course update still succeeds
}
```

This ensures admin operations complete even if email service is unavailable.

## Future Enhancements

Potential improvements:

1. **Batch Notifications**: If admin adds 10 courses at once, consider digest email instead of listing all
2. **Notification Preferences**: Allow learners to opt out of course notifications
3. **Digest Mode**: Daily/weekly summary of new courses instead of immediate emails
4. **Mobile Push**: Integrate with push notification service for mobile app
5. **Notification History**: Track which notifications were sent in database
6. **Undo Buffer**: Delay email for 5 minutes to allow admin to undo course addition
7. **Rich Previews**: Include course thumbnails and descriptions in email

## Database Impact

**No schema changes required**. Notifications use existing tables:
- `LearningPathways`
- `PathwayCourses`
- `LearnerPathwayProgresses`
- `Courses`
- `Users`
- `Organisations`

All notification logic is in application layer.

## Performance Considerations

**Bulk Operations**:
- If pathway has 100 learners and 5 new courses added, sends 100 emails
- Emails sent sequentially (not blocking database transaction)
- Consider background job queue for large learner counts

**Optimization**:
```csharp
// Current: Sequential
foreach (var user in assignedUsers) {
    await SendEmail(user);
}

// Potential: Parallel (future)
await Task.WhenAll(assignedUsers.Select(u => SendEmail(u)));
```

## Security

- ✅ Email addresses validated at user creation
- ✅ Only org admins can modify pathways
- ✅ Learners can only receive emails for their own organization
- ✅ No sensitive data in email (only course titles and pathway names)
- ✅ Portal URLs use HTTPS (Request.Scheme)

## Backwards Compatibility

✅ **Fully compatible** with existing code:
- New optional parameters use default values
- Existing pathway assignment flow unchanged
- Email templates gracefully handle missing data
- No breaking changes to API contracts
