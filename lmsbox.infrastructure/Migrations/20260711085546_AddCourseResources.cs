using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCourseResources : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[CourseResources]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[CourseResources] (
        [Id] bigint NOT NULL IDENTITY(1,1),
        [CourseId] nvarchar(450) NOT NULL,
        [Title] nvarchar(500) NOT NULL,
        [Description] nvarchar(max) NULL,
        [Ordinal] int NOT NULL,
        [Type] nvarchar(20) NOT NULL,
        [VideoUrl] nvarchar(max) NULL,
        [DocumentUrl] nvarchar(max) NULL,
        [HtmlContent] nvarchar(max) NULL,
        [HtmlUrl] nvarchar(max) NULL,
        [ThumbnailUrl] nvarchar(max) NULL,
        [CreatedByUserId] nvarchar(450) NOT NULL,
        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_CourseResources_CreatedAt] DEFAULT (GETUTCDATE()),
        CONSTRAINT [PK_CourseResources] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_CourseResources_AspNetUsers_CreatedByUserId]
            FOREIGN KEY ([CreatedByUserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_CourseResources_Courses_CourseId]
            FOREIGN KEY ([CourseId]) REFERENCES [dbo].[Courses] ([Id]) ON DELETE CASCADE
    );
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_CourseResources_CourseId'
      AND object_id = OBJECT_ID(N'dbo.CourseResources')
)
    CREATE INDEX [IX_CourseResources_CourseId] ON [dbo].[CourseResources] ([CourseId]);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_CourseResources_CreatedByUserId'
      AND object_id = OBJECT_ID(N'dbo.CourseResources')
)
    CREATE INDEX [IX_CourseResources_CreatedByUserId] ON [dbo].[CourseResources] ([CreatedByUserId]);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[CourseResources]', N'U') IS NOT NULL
    DROP TABLE [dbo].[CourseResources];
");
        }
    }
}
