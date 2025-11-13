using lmsbox.infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/admin/dashboard")]
[Authorize(Roles = "Admin,OrgAdmin,SuperAdmin")]
public class AdminDashboardController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    public AdminDashboardController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetDashboardStats()
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
                return Unauthorized();

            // Organisation filter for OrgAdmin
            long? orgId = null;
            if (User.IsInRole("OrgAdmin"))
                orgId = user.OrganisationID;

            // Execute all simple count queries in parallel using LINQ for better compatibility
            var coursesQuery = _context.Courses.AsNoTracking();
            if (orgId.HasValue)
                coursesQuery = coursesQuery.Where(c => c.OrganisationId == orgId);
            
            var usersQuery = _context.Users.AsNoTracking();
            if (orgId.HasValue)
                usersQuery = usersQuery.Where(u => u.OrganisationID == orgId);
            
            var pathwaysQuery = _context.LearningPathways.AsNoTracking();
            if (orgId.HasValue)
                pathwaysQuery = pathwaysQuery.Where(p => p.OrganisationId == orgId);
            
            var groupsQuery = _context.LearningGroups.AsNoTracking();
            if (orgId.HasValue)
                groupsQuery = groupsQuery.Where(g => g.OrganisationId == orgId);

            // Execute basic counts
            var totalCourses = await coursesQuery.CountAsync();
            var activeCourses = await coursesQuery.Where(c => c.Status == "Active").CountAsync();
            var archivedCourses = await coursesQuery.Where(c => c.Status == "Archived").CountAsync();
            
            var totalUsers = await usersQuery.CountAsync();
            var activeUsers = await usersQuery.Where(u => u.ActiveStatus == 1).CountAsync();
            var inactiveUsers = await usersQuery.Where(u => u.ActiveStatus == 0).CountAsync();
            var suspendedUsers = await usersQuery.Where(u => u.ActiveStatus == -1).CountAsync();
            
            var totalPathways = await pathwaysQuery.CountAsync();
            //var activePathways = await groupsQuery.Where(p => p.IsActive).CountAsync();
            
            //var totalGroups = await groupsQuery.CountAsync();

            //// Assignments (simpler query without navigation)
            //var assignmentsTotal = await _context.CourseAssignments.AsNoTracking().CountAsync();
            
            // Learning Progress (simpler queries)
            var totalEnrollments = await _context.LearnerProgresses.AsNoTracking().Where(lp => lp.LessonId > 0).CountAsync();
            var completedEnrollments = await _context.LearnerProgresses.AsNoTracking().Where(lp => lp.Completed).CountAsync();
            var inProgressEnrollments = await _context.LearnerProgresses.AsNoTracking()
                .Where(lp => !lp.Completed && lp.ProgressPercent > 0).CountAsync();
            
            //// Quizzes
            //var totalQuizzes = await _context.Quizzes.AsNoTracking().CountAsync();

            var assignmentsCompleted = 0;
            var assignmentsPending = 0;

            // Course completion history (last 12 months, month-wise)
            var today = DateTime.UtcNow.Date;
            var startMonth = new DateTime(today.Year, today.Month, 1).AddMonths(-11); // 12 months including current
            var endMonth = new DateTime(today.Year, today.Month, 1).AddMonths(1); // exclusive upper bound

            var monthlyCompletionsQuery = _context.LearnerProgresses
                .AsNoTracking()
                .Where(lp => lp.Completed && lp.CompletedAt.HasValue && lp.CompletedAt.Value >= startMonth && lp.CompletedAt.Value < endMonth);

            if (orgId.HasValue)
            {
                monthlyCompletionsQuery = monthlyCompletionsQuery.Where(lp => lp.User != null && lp.User.OrganisationID == orgId.Value);
            }

            var completionGroups = await monthlyCompletionsQuery
                .GroupBy(lp => new { Year = lp.CompletedAt!.Value.Year, Month = lp.CompletedAt!.Value.Month })
                .Select(g => new { g.Key.Year, g.Key.Month, Count = g.Count() })
                .ToListAsync();

            var completionHistory = new System.Collections.Generic.List<object>();
            for (int i = 0; i < 12; i++)
            {
                var dt = startMonth.AddMonths(i);
                var grp = completionGroups.FirstOrDefault(c => c.Year == dt.Year && c.Month == dt.Month);
                var count = grp?.Count ?? 0;
                completionHistory.Add(new { date = dt.ToString("MMM yyyy"), count });
            }

            // User registration history (last 12 months, month-wise)
            var userRegistrationsQuery = _context.Users
                .AsNoTracking()
                .Where(u => u.CreatedOn >= startMonth && u.CreatedOn < endMonth);
            
            if (orgId.HasValue)
                userRegistrationsQuery = userRegistrationsQuery.Where(u => u.OrganisationID == orgId);

            var registrationGroups = await userRegistrationsQuery
                .GroupBy(u => new { Year = u.CreatedOn.Year, Month = u.CreatedOn.Month })
                .Select(g => new { g.Key.Year, g.Key.Month, Count = g.Count() })
                .ToListAsync();

            var registrationHistory = new System.Collections.Generic.List<object>();
            for (int i = 0; i < 12; i++)
            {
                var dt = startMonth.AddMonths(i);
                var grp = registrationGroups.FirstOrDefault(r => r.Year == dt.Year && r.Month == dt.Month);
                var count = grp?.Count ?? 0;
                registrationHistory.Add(new { date = dt.ToString("MMM yyyy"), count });
            }

            // Recent activities - combine recent registrations and completions
            var recentActivitiesList = new System.Collections.Generic.List<object>();
            
            // Get recent user registrations (last 10)
            var recentUsersQuery = _context.Users.AsNoTracking()
                .OrderByDescending(u => u.CreatedOn)
                .Take(10);
            if (orgId.HasValue)
                recentUsersQuery = recentUsersQuery.Where(u => u.OrganisationID == orgId.Value).OrderByDescending(u => u.CreatedOn).Take(10);
                
            var recentUsers = await recentUsersQuery
                .Select(u => new { 
                    text = $"New user registered: {u.FirstName} {u.LastName}", 
                    date = u.CreatedOn.ToString("MMM dd, HH:mm"),
                    timestamp = u.CreatedOn
                })
                .ToListAsync();
            
            // Get recent course completions (last 10)
            var recentCompletionsQuery = _context.LearnerProgresses
                .AsNoTracking()
                .Where(lp => lp.Completed && lp.CompletedAt.HasValue)
                .OrderByDescending(lp => lp.CompletedAt)
                .Take(10);
                
            var recentCompletions = await recentCompletionsQuery
                .Include(lp => lp.User)
                .Include(lp => lp.Course)
                .Select(lp => new { 
                    text = $"{lp.User!.FirstName} {lp.User.LastName} completed {lp.Course!.Title}", 
                    date = lp.CompletedAt!.Value.ToString("MMM dd, HH:mm"),
                    timestamp = lp.CompletedAt.Value
                })
                .ToListAsync();
            
            // Combine and sort by timestamp
            recentActivitiesList.AddRange(recentUsers.Cast<object>());
            recentActivitiesList.AddRange(recentCompletions.Cast<object>());
            var recentActivities = recentActivitiesList
                .OrderByDescending(a => ((dynamic)a).timestamp)
                .Take(20)
                .Select(a => new { 
                    text = ((dynamic)a).text, 
                    date = ((dynamic)a).date 
                })
                .ToList();

            return Ok(new
            {
                totalCourses,
                activeCourses,
                archivedCourses,
                totalUsers,
                activeUsers,
                inactiveUsers,
                suspendedUsers,
                totalPathways,
                //activePathways,
                //assignmentsTotal,
                assignmentsCompleted,
                assignmentsPending,
                totalEnrollments,
                completedEnrollments,
                inProgressEnrollments,
                //totalQuizzes,
                //totalGroups,
                completionHistory,
                registrationHistory,
                recentActivities
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to load dashboard stats", details = ex.Message });
        }
    }
}
