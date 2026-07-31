using lmsbox.domain.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace lmsbox.infrastructure.Data.Configurations;

public class CourseResourceConfiguration : IEntityTypeConfiguration<CourseResource>
{
    public void Configure(EntityTypeBuilder<CourseResource> builder)
    {
        builder.ToTable("CourseResources");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Title).IsRequired().HasMaxLength(500);
        builder.Property(r => r.Type).IsRequired().HasMaxLength(20);
        builder.Property(r => r.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

        builder.HasOne(r => r.Course)
               .WithMany(c => c.Resources)
               .HasForeignKey(r => r.CourseId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.CreatedByUser)
               .WithMany()
               .HasForeignKey(r => r.CreatedByUserId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}
