using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using System.Collections.Generic;
using lmsbox.domain.Utils;

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

        // Create SuperAdmin user (no organisation)
        var superAdminEmail = "superadmin@lmsbox.system";
        var superAdmin = await userManager.FindByEmailAsync(superAdminEmail);
        if (superAdmin == null)
        {
            superAdmin = new ApplicationUser
            {
                UserName = superAdminEmail,
                Email = superAdminEmail,
                EmailConfirmed = true,
                FirstName = "Super",
                LastName = "Admin",
                OrganisationID = null, // SuperAdmin has no organisation
                CreatedBy = "system",
                ActivatedBy = "system",
                DeactivatedBy = "system",
                ActiveStatus = 1,
                ActivatedOn = DateTime.UtcNow,
                CreatedOn = DateTime.UtcNow
            };
            var createSuperAdmin = await userManager.CreateAsync(superAdmin, "SuperAdmin@123");
            if (!createSuperAdmin.Succeeded)
            {
                logger.LogWarning("SuperAdmin creation failed: {Errors}", string.Join(",", createSuperAdmin.Errors.Select(e => e.Description)));
            }
            else
            {
                await userManager.AddToRoleAsync(superAdmin, "SuperAdmin");
                logger.LogInformation("SuperAdmin user created: {Email}", superAdminEmail);
            }
        }
        else
        {
            logger.LogInformation("SuperAdmin user already exists: {Email}", superAdminEmail);
        }

        // Create admin user for organisation
        var adminEmail = "admin@dev.local";
        var admin = await userManager.FindByEmailAsync(adminEmail);
        if (admin == null)
        {
            admin = new ApplicationUser
            {
                UserName = "admin@dev.local",
                Email = adminEmail,
                EmailConfirmed = true,
                FirstName = "Admin",
                LastName = "User",
                OrganisationID = organisation.Id,
                CreatedBy = "system",
                ActivatedBy = "system",
                DeactivatedBy = "system",
                ActiveStatus = 1,
                ActivatedOn = DateTime.UtcNow,
                CreatedOn = DateTime.UtcNow
            };
            var createAdmin = await userManager.CreateAsync(admin, "P@ssw0rd1!");
            if (!createAdmin.Succeeded) 
            {
                logger.LogWarning("Admin creation failed: {Errors}", string.Join(",", createAdmin.Errors.Select(e => e.Description)));
            }
            else 
            {
                await userManager.AddToRoleAsync(admin, "OrgAdmin");
                logger.LogInformation("Admin user created: {Email}", adminEmail);
            }
        }
        else
        {
            logger.LogInformation("Admin user already exists: {Email}", adminEmail);
        }

        // Skip creating courses, pathways, learners, and progress data

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
                    Id = ShortGuid.Generate(),
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

    private static async Task SeedLearningPathwaysAsync(ApplicationDbContext db, ApplicationUser admin, ApplicationUser learner, Organisation organisation, ILogger logger)
    {
        var pathways = new[]
        {
            new { Name = "Management Development Program", Description = "Comprehensive training for senior management and team leaders", Courses = new[] { "Leadership", "Communication" } },
            new { Name = "New Employee Onboarding", Description = "Essential training for recent hires", Courses = new[] { "Health & Safety", "GDPR", "Cyber Security" } },
            new { Name = "IT Professional Certification", Description = "Technical training for IT staff", Courses = new[] { "Cyber Security", "GDPR" } },
            new { Name = "Sales Excellence Program", Description = "Skills development for sales team", Courses = new[] { "Digital Marketing", "Communication" } },
            new { Name = "Mandatory Compliance Training", Description = "Organization-wide required training", Courses = new[] { "Health & Safety", "GDPR" } }
        };

        var allCourses = db.Courses.ToList();

        foreach (var pathwayData in pathways)
        {
            if (!db.LearningPathways.Any(lp => lp.Title == pathwayData.Name))
            {
                var pathway = new LearningPathway
                {
                    Id = ShortGuid.Generate(),
                    Title = pathwayData.Name,
                    Description = pathwayData.Description,
                    ShortDescription = pathwayData.Description,
                    Category = "Professional Development",
                    IsActive = true,
                    EstimatedDurationHours = 10,
                    DifficultyLevel = "Intermediate",
                    OrganisationId = organisation.Id,
                    CreatedByUserId = admin.Id,
                    CreatedAt = DateTime.UtcNow.AddDays(-Random.Shared.Next(1, 30))
                };
                db.LearningPathways.Add(pathway);
                await db.SaveChangesAsync();

                // Assign courses to pathway based on keywords
                var coursesToAssign = allCourses.Where(c => 
                    pathwayData.Courses.Any(keyword => c.Title.Contains(keyword))
                ).ToList();

                int sequenceOrder = 1;
                foreach (var course in coursesToAssign)
                {
                    db.PathwayCourses.Add(new PathwayCourse
                    {
                        LearningPathwayId = pathway.Id,
                        CourseId = course.Id,
                        SequenceOrder = sequenceOrder++,
                        IsMandatory = true,
                        AddedAt = DateTime.UtcNow.AddDays(-Random.Shared.Next(1, 20))
                    });
                }

                // Enroll learner in specific pathways
                if (pathwayData.Name.Contains("Mandatory") || pathwayData.Name.Contains("Onboarding"))
                {
                    db.LearnerPathwayProgresses.Add(new LearnerPathwayProgress
                    {
                        UserId = learner.Id,
                        LearningPathwayId = pathway.Id,
                        TotalCourses = coursesToAssign.Count,
                        CompletedCourses = 0,
                        ProgressPercent = 0,
                        IsCompleted = false,
                        EnrolledAt = DateTime.UtcNow.AddDays(-Random.Shared.Next(1, 15))
                    });
                }

                await db.SaveChangesAsync();
                logger.LogInformation("Created learning pathway: {PathwayName} with {CourseCount} courses", pathwayData.Name, coursesToAssign.Count);
            }
        }
    }

    private static async Task SeedLearnerProgressAsync(ApplicationDbContext db, ApplicationUser learner, ILogger logger)
    {
        // Get courses assigned to the learner through pathways
        var learnerPathways = db.LearnerPathwayProgresses
            .Where(lpp => lpp.UserId == learner.Id)
            .Select(lpp => lpp.LearningPathwayId)
            .ToList();

        var learnerCourses = db.PathwayCourses
            .Where(pc => learnerPathways.Contains(pc.LearningPathwayId))
            .Select(pc => pc.Course)
            .Distinct()
            .ToList();

        foreach (var course in learnerCourses)
        {
            if (course == null) continue;

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