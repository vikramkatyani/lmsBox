using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using lmsbox.infrastructure.Data;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260929120000_AddCourseContentPolicyAcceptance")]
    public partial class AddCourseContentPolicyAcceptance : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.Courses', 'ContentPolicyAcceptedAt') IS NULL
BEGIN
    ALTER TABLE dbo.Courses ADD ContentPolicyAcceptedAt datetime2 NULL;
END
IF COL_LENGTH('dbo.Courses', 'ContentPolicyVersion') IS NULL
BEGIN
    ALTER TABLE dbo.Courses ADD ContentPolicyVersion nvarchar(32) NULL;
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.Courses', 'ContentPolicyVersion') IS NOT NULL
BEGIN
    ALTER TABLE dbo.Courses DROP COLUMN ContentPolicyVersion;
END
IF COL_LENGTH('dbo.Courses', 'ContentPolicyAcceptedAt') IS NOT NULL
BEGIN
    ALTER TABLE dbo.Courses DROP COLUMN ContentPolicyAcceptedAt;
END
");
        }
    }
}
