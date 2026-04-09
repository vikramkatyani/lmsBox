using lmsbox.domain.Models;
using lmsbox.infrastructure.Data.Configurations;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace lmsbox.infrastructure.Data
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        // Core Entities
        public DbSet<Organisation> Organisations { get; set; } = null!;

        // Role & Access
        // Add the 'new' keyword to explicitly hide the inherited member.
        public new DbSet<UserRole> UserRoles { get; set; } = null!;

        // Course Management
        public DbSet<Course> Courses { get; set; } = null!;
        public DbSet<CourseCategory> CourseCategories { get; set; } = null!;
        public DbSet<Lesson> Lessons { get; set; } = null!;
        public DbSet<Quiz> Quizzes { get; set; } = null!;
        public DbSet<QuizQuestion> QuizQuestions { get; set; } = null!;
        public DbSet<QuizQuestionOption> QuizQuestionOptions { get; set; } = null!;

        // Learner Grouping
        public DbSet<LearningGroup> LearningGroups { get; set; } = null!;
        public DbSet<LearnerGroup> LearnerGroups { get; set; } = null!;
        public DbSet<GroupCourse> GroupCourses { get; set; } = null!;

        // Course Assignment & Progress
        public DbSet<CourseAssignment> CourseAssignments { get; set; } = null!;
        public DbSet<LearnerProgress> LearnerProgresses { get; set; } = null!;

        // Feedback & Engagement
        public DbSet<Feedback> Feedbacks { get; set; } = null!;
        public DbSet<Badge> Badges { get; set; } = null!;

        // Audit & Logs
        public DbSet<AuditLog> AuditLogs { get; set; } = null!;

        // Login Link Tokens
        public DbSet<LoginLinkToken> LoginLinkTokens { get; set; } = null!;

        // Revoked JWTs (logout blacklist)
        public DbSet<RevokedToken> RevokedTokens { get; set; } = null!;

        // Learning Pathways
        public DbSet<LearningPathway> LearningPathways { get; set; } = null!;
        public DbSet<PathwayCourse> PathwayCourses { get; set; } = null!;
        public DbSet<LearnerPathwayProgress> LearnerPathwayProgresses { get; set; } = null!;

        // Global Library Content (Super Admin managed)
        public DbSet<GlobalLibraryContent> GlobalLibraryContents { get; set; } = null!;

        // Surveys
        public DbSet<Survey> Surveys { get; set; } = null!;
        public DbSet<SurveyQuestion> SurveyQuestions { get; set; } = null!;
        public DbSet<SurveyResponse> SurveyResponses { get; set; } = null!;
        public DbSet<SurveyQuestionResponse> SurveyQuestionResponses { get; set; } = null!;

        // Engagement Tracking
        public DbSet<UserEngagement> UserEngagements { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);
            // Additional EF configuration (indexes, FK constraints) lives here.
            builder.ApplyConfiguration(new CourseConfiguration());
            builder.ApplyConfiguration(new LessonConfiguration());
            builder.ApplyConfiguration(new CourseAssignmentConfiguration());
            builder.ApplyConfiguration(new LearningGroupConfiguration());
            builder.ApplyConfiguration(new LearningPathwayConfiguration());
            builder.ApplyConfiguration(new PathwayCourseConfiguration());
            builder.ApplyConfiguration(new LearnerPathwayProgressConfiguration());
            builder.ApplyConfiguration(new SurveyConfiguration());
            builder.ApplyConfiguration(new SurveyResponseConfiguration());
            builder.ApplyConfiguration(new SurveyQuestionConfiguration());
            builder.ApplyConfiguration(new SurveyQuestionResponseConfiguration());
            builder.ApplyConfiguration(new UserEngagementConfiguration());

            // Optional: keep revoked tokens short-lived and index expiry for cleanup queries
            builder.Entity<RevokedToken>()
                   .HasIndex(r => r.ExpiresAt);
            
            // Prevent duplicate progress records - unique constraint on UserId, CourseId, LessonId combination
            builder.Entity<LearnerProgress>()
                   .HasIndex(lp => new { lp.UserId, lp.CourseId, lp.LessonId })
                   .IsUnique();
            
            // Index for certificate queries
            builder.Entity<LearnerProgress>()
                   .HasIndex(lp => lp.CertificateIssuedAt);
            
            // Index for certificate ID lookups
            builder.Entity<LearnerProgress>()
                   .HasIndex(lp => lp.CertificateId);

            // User activity report performance indexes
            builder.Entity<LearnerProgress>()
                   .HasIndex(lp => new { lp.UserId, lp.LastAccessedAt, lp.CompletedAt });

            builder.Entity<LearnerProgress>()
                   .HasIndex(lp => new { lp.UserId, lp.Completed, lp.ProgressPercent });

            // User-course progress report indexes (course-level progress rows only)
            builder.Entity<LearnerProgress>()
                   .HasIndex(lp => new { lp.CourseId, lp.Completed, lp.ProgressPercent, lp.CompletedAt })
                   .HasFilter("[LessonId] IS NULL AND [CourseId] IS NOT NULL");

            builder.Entity<LearnerProgress>()
                   .HasIndex(lp => new { lp.Completed, lp.ProgressPercent, lp.LastAccessedAt, lp.StartedAt, lp.CompletedAt })
                   .HasFilter("[LessonId] IS NULL AND [CourseId] IS NOT NULL");

            // Content usage report indexes (course-level progress rows only)
            builder.Entity<LearnerProgress>()
                   .HasIndex(lp => new { lp.CourseId, lp.LessonId, lp.LastAccessedAt, lp.CompletedAt, lp.StartedAt })
                   .HasFilter("[LessonId] IS NULL AND [CourseId] IS NOT NULL");

            builder.Entity<LearnerProgress>()
                   .HasIndex(lp => new { lp.CourseId, lp.LessonId, lp.UserId, lp.Completed, lp.ProgressPercent })
                   .HasFilter("[LessonId] IS NULL AND [CourseId] IS NOT NULL");

            builder.Entity<ApplicationUser>()
                   .HasIndex(u => new { u.OrganisationID, u.ActiveStatus, u.CreatedOn });
            
            // Unique constraint for course category names (case-insensitive)
            builder.Entity<CourseCategory>()
                   .HasIndex(cc => cc.Name)
                   .IsUnique();
        }
    }
}
