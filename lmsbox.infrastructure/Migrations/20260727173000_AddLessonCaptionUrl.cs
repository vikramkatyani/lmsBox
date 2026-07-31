using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260727173000_AddLessonCaptionUrl")]
    public partial class AddLessonCaptionUrl : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.Lessons', 'CaptionUrl') IS NULL
BEGIN
    ALTER TABLE dbo.Lessons ADD CaptionUrl nvarchar(max) NULL;
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.Lessons', 'CaptionUrl') IS NOT NULL
    ALTER TABLE dbo.Lessons DROP COLUMN CaptionUrl;
");
        }
    }
}
