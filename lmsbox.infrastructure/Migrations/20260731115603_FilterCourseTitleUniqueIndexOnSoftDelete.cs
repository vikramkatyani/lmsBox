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
            // missing, already filtered, or duplicate active titles block a unique recreate.
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
AND NOT EXISTS (
    SELECT 1
    FROM dbo.Courses
    WHERE IsDeleted = 0
    GROUP BY OrganisationId, Title
    HAVING COUNT(*) > 1
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
AND NOT EXISTS (
    SELECT 1
    FROM dbo.Courses
    GROUP BY OrganisationId, Title
    HAVING COUNT(*) > 1
)
BEGIN
    CREATE UNIQUE INDEX [UX_Course_OrganisationId_Title]
        ON [dbo].[Courses] ([OrganisationId], [Title]);
END
");
        }
    }
}
