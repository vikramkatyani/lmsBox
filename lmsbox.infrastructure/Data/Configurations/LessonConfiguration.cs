using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using lmsbox.domain.Models;

namespace lmsbox.infrastructure.Data.Configurations;
public class LessonConfiguration : IEntityTypeConfiguration<Lesson>
{
    public void Configure(EntityTypeBuilder<Lesson> builder)
    {
        builder.ToTable("Lessons");
        builder.HasKey(l => l.Id);

        builder.Property(l => l.Title).IsRequired().HasMaxLength(500);
        builder.Property(l => l.ExternalPendingMessage).HasMaxLength(2000);
        builder.Property(l => l.ScormVersion).HasMaxLength(20);
        builder.Property(l => l.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

        // Keep Course -> Lessons cascade (single path)
        builder.HasOne(l => l.Course)
               .WithMany(c => c.Lessons)
               .HasForeignKey(l => l.CourseId);

        // Break the user cascade path: do NOT cascade deletes from AspNetUsers
        builder.HasOne(l => l.CreatedByUser)
               .WithMany()
               .HasForeignKey(l => l.CreatedByUserId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}