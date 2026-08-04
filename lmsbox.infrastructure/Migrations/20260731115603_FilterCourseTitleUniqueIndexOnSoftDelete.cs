using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FilterCourseTitleUniqueIndexOnSoftDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Conditional so production does not 500.30 when the legacy unique index is
            // missing, already filtered, or a previous attempt partially applied.
            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_Course_OrganisationId_Title'
      AND object_id = OBJECT_ID(N'dbo.Courses')
)
BEGIN
    DROP INDEX [UX_Course_OrganisationId_Title] ON [dbo].[Courses];
END

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_Course_OrganisationId_Title'
      AND object_id = OBJECT_ID(N'dbo.Courses')
)
BEGIN
    CREATE UNIQUE INDEX [UX_Course_OrganisationId_Title]
        ON [dbo].[Courses] ([OrganisationId], [Title])
        WHERE [IsDeleted] = 0;
END
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_Course_OrganisationId_Title'
      AND object_id = OBJECT_ID(N'dbo.Courses')
)
BEGIN
    DROP INDEX [UX_Course_OrganisationId_Title] ON [dbo].[Courses];
END

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_Course_OrganisationId_Title'
      AND object_id = OBJECT_ID(N'dbo.Courses')
)
BEGIN
    CREATE UNIQUE INDEX [UX_Course_OrganisationId_Title]
        ON [dbo].[Courses] ([OrganisationId], [Title]);
END
");
        }
    }
}
