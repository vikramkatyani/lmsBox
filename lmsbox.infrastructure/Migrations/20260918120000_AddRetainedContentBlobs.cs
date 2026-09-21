using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using lmsbox.infrastructure.Data;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260918120000_AddRetainedContentBlobs")]
    public partial class AddRetainedContentBlobs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[RetainedContentBlobs]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[RetainedContentBlobs] (
        [Id] bigint NOT NULL IDENTITY(1,1),
        [OwnerType] nvarchar(64) NOT NULL,
        [OwnerId] nvarchar(128) NOT NULL,
        [OrganisationId] bigint NULL,
        [BlobUrl] nvarchar(max) NOT NULL,
        [Container] nvarchar(128) NOT NULL,
        [BlobName] nvarchar(1024) NOT NULL,
        [IsPrefix] bit NOT NULL,
        [StorageType] nvarchar(32) NOT NULL,
        [RetainedAt] datetime2 NOT NULL CONSTRAINT [DF_RetainedContentBlobs_RetainedAt] DEFAULT (GETUTCDATE()),
        CONSTRAINT [PK_RetainedContentBlobs] PRIMARY KEY ([Id])
    );

    CREATE INDEX [IX_RetainedContentBlobs_OwnerType_OwnerId]
        ON [dbo].[RetainedContentBlobs] ([OwnerType], [OwnerId]);
END
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[RetainedContentBlobs]', N'U') IS NOT NULL
    DROP TABLE [dbo].[RetainedContentBlobs];
");
        }
    }
}
