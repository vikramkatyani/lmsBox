using lmsbox.domain.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace lmsbox.infrastructure.Data.Configurations
{
    public class UserEngagementConfiguration : IEntityTypeConfiguration<UserEngagement>
    {
        public void Configure(EntityTypeBuilder<UserEngagement> builder)
        {
            builder.ToTable("UserEngagements");
            
            builder.HasKey(e => e.Id);
            
            builder.Property(e => e.EventType)
                .IsRequired()
                .HasMaxLength(50);
            
            builder.Property(e => e.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");
            
            builder.Property(e => e.Metadata)
                .HasMaxLength(2000);
            
            // Indexes for performance
            builder.HasIndex(e => new { e.OrganisationId, e.CreatedAt });
            builder.HasIndex(e => new { e.UserId, e.CreatedAt });
            builder.HasIndex(e => e.EventType);
            
            // Relationships
            builder.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            
            builder.HasOne(e => e.Organisation)
                .WithMany()
                .HasForeignKey(e => e.OrganisationId)
                .OnDelete(DeleteBehavior.Cascade);
            
            builder.HasOne(e => e.Course)
                .WithMany()
                .HasForeignKey(e => e.CourseId)
                .OnDelete(DeleteBehavior.NoAction);
            
            builder.HasOne(e => e.Lesson)
                .WithMany()
                .HasForeignKey(e => e.LessonId)
                .OnDelete(DeleteBehavior.NoAction);
        }
    }
}
