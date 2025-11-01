using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using System.Collections.Generic;

namespace lmsBox.Server.Data;
public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var provider = scope.ServiceProvider;
        var logger = provider.GetRequiredService<ILoggerFactory>().CreateLogger("DbSeeder");

        var db = provider.GetRequiredService<ApplicationDbContext>();
        var userManager = provider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = provider.GetRequiredService<RoleManager<IdentityRole>>();

        // Ensure simple lookups exist
        if (!db.Organisations.Any())
        {
            var org = new Organisation { Name = "lmsBox-DevOrg", Description = "Development organisation" };
            db.Organisations.Add(org);
            await db.SaveChangesAsync();
        }

        var organisation = db.Organisations.First();

        // Ensure Identity roles
        var roles = new[] { "SuperAdmin", "OrgAdmin", "Learner" };
        foreach (var r in roles)
        {
            if (!await roleManager.RoleExistsAsync(r))
            {
                var res = await roleManager.CreateAsync(new IdentityRole(r));
                if (!res.Succeeded) logger.LogWarning("Failed to create role {Role}: {Errors}", r, string.Join(",", res.Errors.Select(e => e.Description)));
            }
        }

        // Create admin user
        var adminEmail = "admin@dev.local";
        var admin = await userManager.FindByEmailAsync(adminEmail);
        if (admin == null)
        {
            admin = new ApplicationUser
            {
                UserName = "admin@dev.local",
                Email = adminEmail,
                EmailConfirmed = true,
                FirstName = "Org",
                LastName = "Admin",
                OrganisationID = organisation.Id,
                CreatedBy = "system",
                ActivatedBy = "system",
                DeactivatedBy = "system"
            };
            var createAdmin = await userManager.CreateAsync(admin, "P@ssw0rd1!");
            if (!createAdmin.Succeeded) logger.LogWarning("Admin creation failed: {Errors}", string.Join(",", createAdmin.Errors.Select(e => e.Description)));
            else await userManager.AddToRoleAsync(admin, "OrgAdmin");
        }

        // Create a learner user
        var learnerEmail = "19vaibhav90@gmail.com";
        var learner = await userManager.FindByEmailAsync(learnerEmail);
        if (learner == null)
        {
            learner = new ApplicationUser
            {
                UserName = learnerEmail,
                Email = learnerEmail,
                EmailConfirmed = true,
                FirstName = "Test",
                LastName = "Learner",
                OrganisationID = organisation.Id,
                CreatedBy = admin.Id,
                ActivatedBy = admin.Id,
                DeactivatedBy = admin.Id
            };
            var createLearner = await userManager.CreateAsync(learner, "P@ssw0rd1!");
            if (!createLearner.Succeeded) logger.LogWarning("Learner creation failed: {Errors}", string.Join(",", createLearner.Errors.Select(e => e.Description)));
            else await userManager.AddToRoleAsync(learner, "Learner");
        }

        // Create multiple realistic courses with lessons
        await SeedCoursesAsync(db, admin, organisation, logger);

        // Create learning groups and assign courses
        await SeedLearningGroupsAsync(db, admin, learner, organisation, logger);

        // Create learner progress data
        await SeedLearnerProgressAsync(db, learner, logger);

        logger.LogInformation("Seeding completed.");
    }

    private static async Task SeedCoursesAsync(ApplicationDbContext db, ApplicationUser admin, Organisation organisation, ILogger logger)
    {
        var courses = new[]
        {
            new { 
                Title = "Cyber Security Essentials for UK Businesses (Level 1)", 
                Description = "Essential cybersecurity knowledge for modern businesses. Learn to protect your organization from digital threats, understand compliance requirements, and implement security best practices.",
                Lessons = new[]
                {
                    "Introduction to Cybersecurity",
                    "Understanding Common Threats",
                    "Password Security and Authentication",
                    "Email Security and Phishing",
                    "Network Security Basics",
                    "Data Protection and GDPR",
                    "Incident Response Planning",
                    "Security Assessment"
                }
            },
            new { 
                Title = "Effective Workplace Communication: Speak, Listen, Lead", 
                Description = "Master the art of professional communication. Develop skills in verbal and written communication, active listening, and leadership communication strategies.",
                Lessons = new[]
                {
                    "Fundamentals of Professional Communication",
                    "Verbal Communication Techniques",
                    "Written Communication Excellence",
                    "Active Listening Skills",
                    "Non-Verbal Communication",
                    "Difficult Conversations",
                    "Team Communication",
                    "Leadership Communication"
                }
            },
            new { 
                Title = "Employee Engagement Through Transparent Communication", 
                Description = "Learn how transparent communication drives employee engagement, builds trust, and creates a positive workplace culture.",
                Lessons = new[]
                {
                    "The Power of Transparency",
                    "Building Trust Through Communication",
                    "Creating Open Dialogue",
                    "Feedback Culture Development",
                    "Managing Change Communication",
                    "Crisis Communication"
                }
            },
            new { 
                Title = "GDPR Compliance & Data Handling Best Practices", 
                Description = "Comprehensive guide to GDPR compliance, data protection principles, and best practices for handling personal data in your organization.",
                Lessons = new[]
                {
                    "Introduction to GDPR",
                    "Data Protection Principles",
                    "Lawful Basis for Processing",
                    "Individual Rights",
                    "Data Subject Requests",
                    "Data Breach Management",
                    "Privacy by Design",
                    "Documentation and Records"
                }
            },
            new { 
                Title = "Project Management Fundamentals", 
                Description = "Essential project management skills for delivering successful projects. Learn planning, execution, monitoring, and closure techniques.",
                Lessons = new[]
                {
                    "Project Management Overview",
                    "Project Planning and Scope",
                    "Time Management and Scheduling",
                    "Resource Management",
                    "Risk Management",
                    "Quality Management",
                    "Communication Planning",
                    "Project Closure"
                }
            },
            new { 
                Title = "Leadership Development Program", 
                Description = "Develop essential leadership skills including emotional intelligence, team management, decision-making, and strategic thinking.",
                Lessons = new[]
                {
                    "Leadership Fundamentals",
                    "Emotional Intelligence",
                    "Team Building and Management",
                    "Decision Making Processes",
                    "Conflict Resolution",
                    "Performance Management",
                    "Strategic Thinking",
                    "Leading Change"
                }
            },
            new { 
                Title = "Health & Safety in the Workplace", 
                Description = "Essential health and safety training covering risk assessment, accident prevention, emergency procedures, and legal compliance.",
                Lessons = new[]
                {
                    "Health & Safety Fundamentals",
                    "Risk Assessment Techniques",
                    "Accident Prevention",
                    "Emergency Procedures",
                    "Personal Protective Equipment",
                    "Workplace Ergonomics",
                    "Legal Compliance",
                    "Safety Culture Development"
                }
            },
            new { 
                Title = "Digital Marketing Essentials", 
                Description = "Master digital marketing fundamentals including SEO, social media marketing, email campaigns, and analytics.",
                Lessons = new[]
                {
                    "Digital Marketing Overview",
                    "SEO Fundamentals",
                    "Social Media Marketing",
                    "Email Marketing",
                    "Content Marketing",
                    "PPC Advertising",
                    "Analytics and Measurement",
                    "Marketing Strategy"
                }
            }
        };

        foreach (var courseData in courses)
        {
            if (!db.Courses.Any(c => c.Title == courseData.Title))
            {
                var course = new Course
                {
                    Title = courseData.Title,
                    Description = courseData.Description,
                    OrganisationId = organisation.Id,
                    CreatedByUserId = admin.Id,
                    CreatedAt = DateTime.UtcNow.AddDays(-Random.Shared.Next(1, 90))
                };
                db.Courses.Add(course);
                await db.SaveChangesAsync();

                // Add lessons for this course
                for (int i = 0; i < courseData.Lessons.Length; i++)
                {
                    var lesson = new Lesson
                    {
                        CourseId = course.Id,
                        Title = courseData.Lessons[i],
                        Content = $"Content for {courseData.Lessons[i]}. This lesson covers important concepts and practical applications.",
                        Ordinal = i + 1,
                        CreatedByUserId = admin.Id,
                        CreatedAt = DateTime.UtcNow.AddDays(-Random.Shared.Next(1, 60))
                    };
                    db.Lessons.Add(lesson);
                }
                await db.SaveChangesAsync();
                logger.LogInformation("Created course: {CourseTitle} with {LessonCount} lessons", courseData.Title, courseData.Lessons.Length);
            }
        }
    }

    private static async Task SeedLearningGroupsAsync(ApplicationDbContext db, ApplicationUser admin, ApplicationUser learner, Organisation organisation, ILogger logger)
    {
        var groups = new[]
        {
            new { Name = "Management Team", Description = "Senior management and team leaders" },
            new { Name = "New Employees", Description = "Recent hires and onboarding group" },
            new { Name = "IT Department", Description = "Information technology staff" },
            new { Name = "Sales Team", Description = "Sales and business development" },
            new { Name = "All Staff", Description = "Organization-wide mandatory training group" }
        };

        var allCourses = db.Courses.ToList();

        foreach (var groupData in groups)
        {
            if (!db.LearningGroups.Any(g => g.Name == groupData.Name))
            {
                var group = new LearningGroup
                {
                    Name = groupData.Name,
                    Description = groupData.Description,
                    OrganisationId = organisation.Id,
                    CreatedByUserId = admin.Id,
                    CreatedAt = DateTime.UtcNow.AddDays(-Random.Shared.Next(1, 30))
                };
                db.LearningGroups.Add(group);
                await db.SaveChangesAsync();

                // Assign courses to groups based on group type
                var coursesToAssign = groupData.Name switch
                {
                    "Management Team" => allCourses.Where(c => c.Title.Contains("Leadership") || c.Title.Contains("Communication")).ToList(),
                    "New Employees" => allCourses.Where(c => c.Title.Contains("Health & Safety") || c.Title.Contains("GDPR") || c.Title.Contains("Cyber Security")).ToList(),
                    "IT Department" => allCourses.Where(c => c.Title.Contains("Cyber Security") || c.Title.Contains("GDPR")).ToList(),
                    "Sales Team" => allCourses.Where(c => c.Title.Contains("Digital Marketing") || c.Title.Contains("Communication")).ToList(),
                    "All Staff" => allCourses.Where(c => c.Title.Contains("Health & Safety") || c.Title.Contains("GDPR")).ToList(),
                    _ => new List<Course>()
                };

                foreach (var course in coursesToAssign)
                {
                    db.GroupCourses.Add(new GroupCourse
                    {
                        LearningGroupId = group.Id,
                        CourseId = course.Id,
                        AssignedAt = DateTime.UtcNow.AddDays(-Random.Shared.Next(1, 20))
                    });
                }

                // Add learner to multiple groups
                if (groupData.Name == "All Staff" || groupData.Name == "New Employees")
                {
                    db.LearnerGroups.Add(new LearnerGroup
                    {
                        UserId = learner.Id,
                        LearningGroupId = group.Id,
                        JoinedAt = DateTime.UtcNow.AddDays(-Random.Shared.Next(1, 15)),
                        IsActive = true
                    });
                }

                await db.SaveChangesAsync();
                logger.LogInformation("Created learning group: {GroupName} with {CourseCount} courses", groupData.Name, coursesToAssign.Count());
            }
        }
    }

    private static async Task SeedLearnerProgressAsync(ApplicationDbContext db, ApplicationUser learner, ILogger logger)
    {
        // Get courses assigned to the learner through groups
        var learnerCourses = db.GroupCourses
            .Where(gc => gc.LearningGroup.LearnerGroups.Any(lg => lg.UserId == learner.Id && lg.IsActive))
            .Select(gc => gc.Course)
            .Distinct()
            .ToList();

        foreach (var course in learnerCourses)
        {
            // Create course-level progress
            if (!db.LearnerProgresses.Any(lp => lp.UserId == learner.Id && lp.CourseId == course.Id && lp.LessonId == null))
            {
                var courseProgress = Random.Shared.Next(0, 101);
                var isCompleted = courseProgress == 100;

                db.LearnerProgresses.Add(new LearnerProgress
                {
                    UserId = learner.Id,
                    CourseId = course.Id,
                    LessonId = null,
                    ProgressPercent = courseProgress,
                    Completed = isCompleted,
                    CompletedAt = isCompleted ? DateTime.UtcNow.AddDays(-Random.Shared.Next(1, 30)) : null
                });

                // Create lesson-level progress
                var lessons = db.Lessons.Where(l => l.CourseId == course.Id).OrderBy(l => l.Ordinal).ToList();
                var completedLessons = (int)Math.Floor(lessons.Count * (courseProgress / 100.0));

                for (int i = 0; i < lessons.Count; i++)
                {
                    var lesson = lessons[i];
                    var lessonCompleted = i < completedLessons;
                    var lessonProgress = lessonCompleted ? 100 : (i == completedLessons ? Random.Shared.Next(0, 100) : 0);

                    db.LearnerProgresses.Add(new LearnerProgress
                    {
                        UserId = learner.Id,
                        CourseId = course.Id,
                        LessonId = lesson.Id,
                        ProgressPercent = lessonProgress,
                        Completed = lessonCompleted,
                        CompletedAt = lessonCompleted ? DateTime.UtcNow.AddDays(-Random.Shared.Next(1, 45)) : null
                    });
                }
            }
        }

        await db.SaveChangesAsync();
        logger.LogInformation("Created progress data for {CourseCount} courses", learnerCourses.Count);
    }
}