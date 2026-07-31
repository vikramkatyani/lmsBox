using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260728120000_AddShowLessonNavigationToCourses")]
    public partial class AddShowLessonNavigationToCourses : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.Courses', 'ShowLessonNavigation') IS NULL
BEGIN
    ALTER TABLE dbo.Courses ADD ShowLessonNavigation bit NOT NULL
        CONSTRAINT DF_Courses_ShowLessonNavigation DEFAULT(0);
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.Courses', 'ShowLessonNavigation') IS NOT NULL
BEGIN
    DECLARE @df sysname;
    SELECT @df = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
    WHERE dc.parent_object_id = OBJECT_ID(N'dbo.Courses')
      AND c.name = 'ShowLessonNavigation';
    IF @df IS NOT NULL EXEC(N'ALTER TABLE dbo.Courses DROP CONSTRAINT [' + @df + N']');
    ALTER TABLE dbo.Courses DROP COLUMN ShowLessonNavigation;
END
");
        }
    }
}
