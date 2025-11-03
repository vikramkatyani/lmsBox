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

            // Optional: keep revoked tokens short-lived and index expiry for cleanup queries
            builder.Entity<RevokedToken>()
                   .HasIndex(r => r.ExpiresAt);
        }
    }
}
