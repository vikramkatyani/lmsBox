using lmsbox.domain.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace lmsbox.infrastructure.Data.Configurations;

public class RetainedContentBlobConfiguration : IEntityTypeConfiguration<RetainedContentBlob>
{
    public void Configure(EntityTypeBuilder<RetainedContentBlob> builder)
    {
        builder.ToTable("RetainedContentBlobs");
        builder.HasKey(b => b.Id);

        builder.Property(b => b.OwnerType).IsRequired().HasMaxLength(64);
        builder.Property(b => b.OwnerId).IsRequired().HasMaxLength(128);
        builder.Property(b => b.BlobUrl).IsRequired();
        builder.Property(b => b.Container).IsRequired().HasMaxLength(128);
        builder.Property(b => b.BlobName).IsRequired().HasMaxLength(1024);
        builder.Property(b => b.StorageType).IsRequired().HasMaxLength(32);
        builder.Property(b => b.RetainedAt).HasDefaultValueSql("GETUTCDATE()");

        builder.HasIndex(b => new { b.OwnerType, b.OwnerId });
    }
}
