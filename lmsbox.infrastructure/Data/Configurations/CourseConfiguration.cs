using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using lmsbox.domain.Models;

namespace lmsbox.infrastructure.Data.Configurations;
public class CourseConfiguration : IEntityTypeConfiguration<Course>
{
    public void Configure(EntityTypeBuilder<Course> builder)
    {
        builder.ToTable("Courses");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Title)
               .IsRequired()
               .HasMaxLength(250);

        // Unique Title per Organisation
        builder.HasIndex(c => new { c.OrganisationId, c.Title })
               .IsUnique()
               .HasDatabaseName("UX_Course_OrganisationId_Title");

        // Organisation FK: business choice; use Restrict to avoid accidental cascade deletes of org -> many entities
        builder.HasOne(c => c.Organisation)
               .WithMany()
               .HasForeignKey(c => c.OrganisationId)
               .OnDelete(DeleteBehavior.Restrict);

        // CreatedByUser -> Course: DO NOT cascade (prevents multiple cascade paths)
        builder.HasOne(c => c.CreatedByUser)
               .WithMany()
               .HasForeignKey(c => c.CreatedByUserId)
               .OnDelete(DeleteBehavior.Restrict);

        // Survey relationships - optional foreign keys
        builder.HasOne(c => c.PreCourseSurvey)
               .WithMany()
               .HasForeignKey(c => c.PreCourseSurveyId)
               .OnDelete(DeleteBehavior.Restrict)
               .IsRequired(false);

        builder.HasOne(c => c.PostCourseSurvey)
               .WithMany()
               .HasForeignKey(c => c.PostCourseSurveyId)
               .OnDelete(DeleteBehavior.Restrict)
               .IsRequired(false);
    }
}