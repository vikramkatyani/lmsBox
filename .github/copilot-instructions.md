# LMS Box - AI Coding Agent Instructions

## Project Overview

LMS Box is a multi-tenant Learning Management System built with:
- **Backend**: .NET 9 Web API (ASP.NET Core)
- **Frontend**: React 19 + Vite + Tailwind CSS 4
- **Database**: SQL Server with EF Core 9
- **Storage**: Azure Blob Storage
- **Auth**: JWT + ASP.NET Identity

The system supports three user roles across multiple organizations: **SuperAdmin** (platform-wide), **OrgAdmin** (organization admins), and **Learner** (end users).

## Architecture

### Monorepo Structure
```
lmsBox/
├── lmsBox.Server/          # .NET 9 Web API + serves built React app
├── lmsbox.client/          # React + Vite frontend
├── lmsbox.domain/          # Domain models (shared entities)
└── lmsbox.infrastructure/  # EF Core DbContext, migrations, configurations
```

**Critical**: Migrations live in `lmsbox.infrastructure` but are run from `lmsBox.Server` as the startup project.

### Multi-Tenancy & Organization Filtering

All data is scoped by `OrganisationId` except SuperAdmin entities:
- **SuperAdmin users**: `OrganisationID = null` (can manage all orgs)
- **OrgAdmin/Learner**: Must have an `OrganisationID`
- Controllers check role and filter queries: `if (User.IsInRole("OrgAdmin")) query = query.Where(x => x.OrganisationId == user.OrganisationID)`

**Pattern in controllers**:
```csharp
[Authorize(Roles = "Admin,OrgAdmin,SuperAdmin")]
public async Task<IActionResult> GetCourses() {
    var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
    var query = _context.Courses.AsNoTracking();
    
    if (userRole == "OrgAdmin") {
        var orgId = user.OrganisationID;
        query = query.Where(c => c.OrganisationId == orgId);
    }
    // SuperAdmin sees everything
}
```

### Three-Layer Backend Architecture

1. **lmsbox.domain**: Plain POCOs (e.g., `Course`, `Lesson`, `ApplicationUser`)
2. **lmsbox.infrastructure**: `ApplicationDbContext`, `Configurations/`, migrations
3. **lmsBox.Server**: Controllers, Services (interfaces + implementations), Program.cs

Services are registered in `Program.cs` as scoped dependencies:
```csharp
builder.Services.AddScoped<IAzureBlobService, AzureBlobService>();
builder.Services.AddScoped<IAuditLogService, AuditLogService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IAIAssistantService, AIAssistantService>();
```

## Development Workflow

### Running the Application

**Backend**:
```powershell
cd lmsBox.Server
dotnet restore
dotnet ef database update --project ..\lmsbox.infrastructure  # Apply migrations
dotnet run  # Starts on http://localhost:5132
```

**Frontend** (separate terminal):
```powershell
cd lmsbox.client
npm ci
npm run dev  # Vite dev server with proxy to :5132
```

The Vite proxy (`vite.config.js`) forwards `/api/*` to `http://localhost:5132` to avoid CORS during development.

### Database Migrations

**Always run migrations from `lmsbox.infrastructure`**:
```powershell
cd lmsbox.infrastructure
dotnet ef migrations add MigrationName --startup-project ..\lmsBox.Server
dotnet ef database update --startup-project ..\lmsBox.Server
```

EF Core is configured in `Program.cs` with:
```csharp
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(conn, b => b.MigrationsAssembly("lmsbox.infrastructure")));
```

**On startup**, `Program.cs` auto-applies pending migrations and seeds data in Development:
```csharp
db.Database.Migrate();
if (app.Environment.IsDevelopment()) {
    DbSeeder.SeedAsync(scope.ServiceProvider).GetAwaiter().GetResult();
}
```

### Default Credentials (Development)

After seeding:
- **SuperAdmin**: `superadmin@lmsbox.system` / `SuperAdmin@123`
- **OrgAdmin**: `admin@dev.local` / (check `DbSeeder.cs`)

## Key Patterns & Conventions

### Authentication & Authorization

- **JWT tokens** stored in `localStorage` on frontend
- **Separate login endpoints**: `/api/SuperAdmin/login` vs regular `/api/loginlink/request`
- **Role-based auth**: `[Authorize(Roles = "OrgAdmin,SuperAdmin")]`
- **Claims**: `ClaimTypes.NameIdentifier` (userId), `ClaimTypes.Role`, `ClaimTypes.Email`

Frontend auth utility: `lmsbox.client/src/utils/auth.js` checks token expiration.

### API Client Pattern (Frontend)

All services import from `utils/api.js`:
```javascript
import api from '../utils/api';  // Pre-configured axios instance

export const adminCourseService = {
  async listCourses(params) {
    const response = await api.get('/api/admin/courses?...');
    return response.data;
  }
};
```

The `api` instance auto-injects `Authorization: Bearer <token>` from localStorage.

### Entity IDs

- **Courses, Lessons**: String IDs (e.g., `"course-123"`, `"lesson-456"`)
- **Everything else**: Long/bigint auto-incrementing IDs
- **Key attributes**: `[DatabaseGenerated(DatabaseGeneratedOption.None)]` for string IDs

### Soft Deletes

Courses and Lessons use soft delete:
```csharp
public bool IsDeleted { get; set; }
public DateTime? DeletedAt { get; set; }
public string? DeletedByUserId { get; set; }
```

Queries filter: `.Where(c => !c.IsDeleted)`

### Azure Blob Storage

- **Container**: `lmscontent`
- **Paths**:
  - `organisation/<orgId>/uicontent/` - Banners, favicons
  - `organisation/<orgId>/courses/<courseId>/` - Course content
  - `globallibrary/pdf/` and `globallibrary/video/` - SuperAdmin shared content
  - `organisation/<orgId>/scorm/` - SCORM packages

**Service**: `IAzureBlobService` provides `UploadFileAsync`, `GetSasUrlAsync`, `DeleteFileAsync`

### SCORM Content Delivery

SCORM packages are served via **ScormProxyController**:
- Proxies content from Azure Blob to avoid CORS
- **Conditional script injection**: Only injects SCORM API for legacy content without `scorm_api.js`
- **Native SCORM support** (recommended): Content with `scorm_api.js` uses `window.parent.API` provided by `scorm-player.html`
- Injection is skipped if HTML contains `scorm_api.js`, `var SCORM =`, or `window.SCORM =`

**How it works**:
```csharp
// Check if content has its own SCORM implementation
var hasOwnScormScript = htmlContent.Contains("scorm_api.js", StringComparison.OrdinalIgnoreCase) ||
                       htmlContent.Contains("var SCORM =", StringComparison.OrdinalIgnoreCase);

if (hasOwnScormScript) {
    return File(content, contentType); // Serve as-is
}
// Otherwise inject stub API for legacy content
```

See `SCORM_TESTING_GUIDE.md` for testing approaches.

### Progress Tracking

`LearnerProgress` table tracks both lesson and course progress:
- **Lesson progress**: `LessonId != null`
- **Course progress**: `LessonId == null`
- **Unique constraint**: `(UserId, CourseId, LessonId)`

Certificate issuance tracked via:
```csharp
progress.CertificateUrl = certificateUrl;
progress.CertificateId = certificateId;
progress.CertificateIssuedAt = DateTime.UtcNow;
```

**Important**: Completion checks use `if (!progress.Completed)` to prevent duplicate audit logs.

### Audit Logging

`AuditLogService` logs all critical actions:
```csharp
await _auditLogService.LogLessonCompletion(userId, userName, lessonId, lessonTitle, courseId, courseTitle);
await _auditLogService.LogCourseCompletion(userId, userName, courseId, courseTitle);
await _auditLogService.LogCertificateIssuance(userId, userName, courseId, courseTitle, certificateId);
```

Used for admin dashboard "Recent Activities" and compliance.

### AI Assistant Integration

OpenAI GPT-4o integration for course/quiz generation:
- **Config**: `appsettings.json` → `OpenAI:ApiKey`
- **Service**: `IAIAssistantService` with methods like `GenerateCourseOutlineAsync`, `GenerateLessonContentAsync`
- **Controller**: `AIAssistantController` (requires `OrgAdmin` or `SuperAdmin`)
- **Frontend**: `components/AIAssistant.jsx` appears on course/quiz editor pages

See `AI_ASSISTANT_SETUP.md` for API key setup.

## Frontend Structure

### Routing & Role-Based Pages

Routes in `App.jsx`:
- **SuperAdmin**: `/superadmin/login`, `/superadmin/dashboard`, `/superadmin/organisations/*`
- **OrgAdmin**: `/admin/*` - Dashboard, users, courses, reports
- **Learner**: `/courses/*`, `/profile`

Protected routes use `<ProtectedRoute>` or `<AdminRoute>` wrappers.

### State Management

No Redux/Context API for app state. Uses:
- **localStorage**: JWT token, user info
- **Component state**: `useState`, `useEffect`
- **React Router**: Navigation, params

### UI Components

- **Tailwind CSS 4**: Utility-first styling
- **Heroicons**: Icon library (`@heroicons/react`)
- **Toasts**: `react-hot-toast` for notifications
- **Charts**: `chart.js` + `react-chartjs-2` for reports

Common components in `lmsbox.client/src/components/`:
- `ProtectedRoute.jsx`, `AdminRoute.jsx` - Auth guards
- `Pagination.jsx` - Reusable pagination (used in list pages)
- `AIAssistant.jsx` - AI content generation modal

## Configuration Files

### Backend: `appsettings.json`

```json
{
  "ConnectionStrings": { "DefaultConnection": "..." },
  "Jwt": { "Key": "...", "Issuer": "lmsbox", "Audience": "lmsbox-audience" },
  "Cors": { "AllowedOrigins": ["http://localhost:5173"] },
  "AzureStorage": { "ConnectionString": "...", "ContainerName": "lmscontent" },
  "SendGrid": { "ApiKey": "...", "FromEmail": "..." },
  "OpenAI": { "ApiKey": "..." }
}
```

**Production**: Use environment variables or Azure App Settings (e.g., `Jwt__Key`).

### Frontend: Environment Variables

Currently uses `import.meta.env.VITE_API_BASE` (Vite convention) but development relies on Vite proxy, so this is typically unset during dev.

## Testing & Debugging

### Backend Logs

- **Serilog** configured in `Program.cs` with console, Application Insights, and Azure Log Analytics sinks
- **Structured logging**: `_logger.LogInformation("User {UserId} completed course {CourseId}", userId, courseId)`
- **JWT events**: Token validation failures logged in `Program.cs` JWT bearer events

### Frontend Debugging

- **Console logs**: SCORM API calls logged to browser console
- **Network tab**: Check `/api/*` requests (should proxy to `:5132`)
- **Toast notifications**: User-facing errors via `react-hot-toast`

### SCORM Testing

Test SCORM without database:
```
http://localhost:5132/api/scorm-test/player
```

Uses test content from `Assets/test/Ladder-Safety-SCORM/`. See `SCORM_TESTING_GUIDE.md`.

## Deployment

### Azure Resources

- **App Service**: Backend API (auto-deploys via GitHub Actions)
- **Static Web App**: React frontend
- **SQL Database**: Connection string in App Service settings
- **Blob Storage**: `lmscontent` container

See `DEPLOYMENT_GUIDE.md` for configuration scripts and troubleshooting.

### Build & Publish

**Backend**:
```powershell
dotnet publish -c Release -o ./publish
```

**Frontend**:
```powershell
npm run build  # Outputs to lmsbox.client/dist/
```

The backend serves the built frontend from `wwwroot/` (SPA fallback configured in `Program.cs`).

## Common Tasks

### Add a new entity

1. Create model in `lmsbox.domain/Models/`
2. Add `DbSet<Entity>` to `ApplicationDbContext.cs`
3. Create configuration in `lmsbox.infrastructure/Data/Configurations/` (optional)
4. Generate migration: `dotnet ef migrations add AddEntity --startup-project ..\lmsBox.Server`
5. Apply: `dotnet ef database update --startup-project ..\lmsBox.Server`

### Add a new API endpoint

1. Create controller in `lmsBox.Server/Controllers/` (inherit `ControllerBase`)
2. Add `[Authorize(Roles = "...")]` attribute
3. Check `OrganisationId` filtering for multi-tenancy
4. Create corresponding service method in `lmsbox.client/src/services/`

### Add a new service

1. Define interface in `lmsBox.Server/Services/IMyService.cs`
2. Implement in `lmsBox.Server/Services/MyService.cs`
3. Register in `Program.cs`: `builder.Services.AddScoped<IMyService, MyService>();`

## Important Documentation

- **SUPERADMIN_SETUP.md**: Multi-tenancy, organisation management, global library
- **SCORM_TESTING_GUIDE.md**: SCORM proxy, script injection vs window communication
- **ACTIVITY_TRACKING_IMPLEMENTATION.md**: Progress tracking, audit logs, completion logic
- **AI_ASSISTANT_SETUP.md**: OpenAI integration for content generation
- **DEPLOYMENT_GUIDE.md**: Azure deployment, configuration scripts

## Gotchas & Anti-Patterns

❌ **Don't** forget organisation filtering in OrgAdmin endpoints  
✅ **Always** check `if (userRole == "OrgAdmin") query = query.Where(...)`

❌ **Don't** run migrations from `lmsBox.Server` directory  
✅ **Always** use `--startup-project ..\lmsBox.Server` when in `lmsbox.infrastructure/`

❌ **Don't** create duplicate progress records  
✅ **Check** `if (!progress.Completed)` before marking complete and logging

❌ **Don't** hardcode API URLs in frontend services  
✅ **Use** the shared `api` instance from `utils/api.js`

❌ **Don't** expose secrets in `appsettings.json`  
✅ **Use** environment variables or Azure App Settings for production

❌ **Don't** use `AllowAnonymous` on endpoints that modify data  
✅ **Reserve** anonymous access for SCORM proxy and public login pages only
