using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SyncPendingModelChanges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Earlier hand-written SQL migrations already apply ResponseVisibility, CaptionUrl,
            // ExternalPendingMessage, FavoriteReportIds, and AnnouncementReadReceipts.
            // This migration only syncs the remaining model gap and updates the EF snapshot.
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.Courses', 'RequireSequentialLessons') IS NULL
BEGIN
    ALTER TABLE dbo.Courses ADD RequireSequentialLessons bit NOT NULL
        CONSTRAINT DF_Courses_RequireSequentialLessons DEFAULT(0);
END
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.Courses', 'RequireSequentialLessons') IS NOT NULL
BEGIN
    DECLARE @df sysname;
    SELECT @df = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
    WHERE dc.parent_object_id = OBJECT_ID(N'dbo.Courses')
      AND c.name = 'RequireSequentialLessons';
    IF @df IS NOT NULL EXEC(N'ALTER TABLE dbo.Courses DROP CONSTRAINT [' + @df + N']');
    ALTER TABLE dbo.Courses DROP COLUMN RequireSequentialLessons;
END
");
        }
    }
}
