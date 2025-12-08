# Learner Welcome Email Enhancement

## Overview
Enhanced the learner welcome email to conditionally display assigned courses from learning pathways when a new user is created with pathway assignments.

## Changes Made

### 1. EmailService Interface & Implementation
**File**: `lmsBox.Server/Services/EmailService.cs`

**Changed signature** of `SendLearnerRegistrationEmailAsync`:
```csharp
// Before
Task SendLearnerRegistrationEmailAsync(string userEmail, string portalUrl, string organisationId, string? firstName = null, bool hasCourses = false);

// After
Task SendLearnerRegistrationEmailAsync(string userEmail, string portalUrl, string organisationId, string? firstName = null, List<string>? courseNames = null);
```

**Implementation enhancements**:
- Now accepts `List<string>? courseNames` parameter instead of `bool hasCourses`
- Generates HTML list of courses: `<li>Course Title</li>`
- Adds to template data:
  - `HasCourses`: Boolean flag (true if courses are provided)
  - `CourseListHtml`: Generated HTML list items
  - `CourseCount`: Number of unique courses assigned

### 2. Email Template
**File**: `lmsBox.Server/EmailTemplates/LearnerRegistrationEmail.html`

**Added conditional section**:
- **If courses assigned**: Shows "You have been assigned the following courses:" with course list
- **If no courses**: Shows original message about courses being assigned later by admin

**Template logic**:
```html
{{#if HasCourses}}
<div class="info-box">
    <strong>You have been assigned the following courses:</strong>
    <ul>
        {{{CourseListHtml}}}
    </ul>
    <p>Login to start learning and track your progress!</p>
</div>
{{else}}
<div class="info-box">
    <strong>When you log in for the first time:</strong>
    <ul>
        <li>You'll be asked to enter your name to complete your profile.</li>
        <li>Courses may or may not be assigned to you yet...</li>
    </ul>
</div>
{{/if}}
```

### 3. AdminUsersController Refactoring
**File**: `lmsBox.Server/Controllers/AdminUsersController.cs`

**Key workflow changes**:

1. **For Admin users**: Send registration email immediately (unchanged)

2. **For Learner users**: 
   - **Deferred email sending** until after pathway assignment
   - Extract unique course titles from assigned pathways
   - Pass course list to email service

**Implementation flow**:
```csharp
// 1. Create user
var user = new ApplicationUser { ... };
await _userManager.CreateAsync(user);

// 2. For admins, send email immediately
if (roleToAssign != "Learner") {
    await _emailService.SendUserRegistrationNotificationAsync(...);
}

// 3. Assign pathways and get course list
List<string>? assignedCourseNames = null;
if (request.GroupIds != null && request.GroupIds.Any()) {
    // Create pathway assignments
    foreach (var pathwayId in request.GroupIds) {
        _context.LearnerPathwayProgresses.Add(new LearnerPathwayProgress { ... });
    }
    await _context.SaveChangesAsync();
    
    // Query pathways and extract unique course titles
    var pathways = await _context.LearningPathways
        .Where(p => request.GroupIds.Contains(p.Id))
        .Include(p => p.PathwayCourses)
            .ThenInclude(pc => pc.Course)
        .ToListAsync();
    
    assignedCourseNames = pathways
        .SelectMany(p => p.PathwayCourses.Select(pc => pc.Course!.Title))
        .Distinct()
        .ToList();
}

// 4. Send learner email with course list
if (roleToAssign == "Learner" && user.OrganisationID.HasValue) {
    await _emailService.SendLearnerRegistrationEmailAsync(
        user.Email,
        portalUrl,
        user.OrganisationID.Value.ToString(),
        user.FirstName,
        assignedCourseNames  // <-- Course list passed here
    );
}
```

## Removed Functionality

**Pathway assignment email** (`SendPathwayAssignmentEmailAsync`) is **no longer sent** during user creation because:
- The welcome email now includes the course list
- Sending two emails was redundant
- The pathway assignment email is still available for **future** pathway assignments (not during initial user creation)

## Testing Scenarios

### Scenario 1: Learner Created With Pathways
**Input**: Create learner with 2 learning pathways containing 5 unique courses

**Expected Email**:
```
Hello [FirstName],

You've been added to the [BrandName] Learning Portal...

[Access LMS Portal Button]

┌────────────────────────────────────────┐
│ You have been assigned the following  │
│ courses:                               │
│  • Introduction to Safety              │
│  • Advanced Workplace Safety           │
│  • Emergency Procedures                │
│  • Fire Safety Basics                  │
│  • First Aid Fundamentals              │
│                                        │
│ Login to start learning and track     │
│ your progress!                         │
└────────────────────────────────────────┘
```

### Scenario 2: Learner Created Without Pathways
**Input**: Create learner without pathway assignments

**Expected Email**:
```
Hello [FirstName],

You've been added to the [BrandName] Learning Portal...

[Access LMS Portal Button]

┌────────────────────────────────────────┐
│ When you log in for the first time:   │
│  • You'll be asked to enter your name │
│  • Courses may or may not be assigned │
│    to you yet. Contact admin.         │
└────────────────────────────────────────┘
```

### Scenario 3: Admin Created
**Input**: Create OrgAdmin or SuperAdmin user

**Expected**: Sends standard admin registration email (unchanged behavior)

## Benefits

1. **Better user experience**: New learners immediately know what courses they have access to
2. **Reduced email spam**: One welcome email instead of two
3. **Clearer onboarding**: Sets expectations from the start
4. **Dynamic content**: Email adapts based on whether pathways are assigned

## Database Queries

The course list extraction uses an efficient query:
```csharp
var pathways = await _context.LearningPathways
    .Where(p => request.GroupIds.Contains(p.Id))
    .Include(p => p.PathwayCourses)
        .ThenInclude(pc => pc.Course)
    .ToListAsync();
```

- Single database roundtrip
- Eager loading with `Include` prevents N+1 queries
- `Distinct()` ensures unique course titles even if courses appear in multiple pathways

## Future Enhancements

Possible improvements:
1. **Plain text version**: Update `LearnerRegistrationEmail.txt` with same conditional logic
2. **Course descriptions**: Include brief course descriptions in email
3. **Pathway grouping**: Show courses grouped by pathway instead of flat list
4. **Due dates**: If pathways have deadlines, show them in email
5. **Progress links**: Include direct links to each course

## Backwards Compatibility

✅ **Fully backwards compatible**:
- Optional `courseNames` parameter defaults to `null`
- Template handles both `HasCourses = true` and `false` cases
- Existing email sending code will work without modifications (shows "no courses" message)
