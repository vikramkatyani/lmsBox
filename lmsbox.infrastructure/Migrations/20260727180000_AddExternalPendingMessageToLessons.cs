using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260727180000_AddExternalPendingMessageToLessons")]
    public partial class AddExternalPendingMessageToLessons : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.Lessons', 'ExternalPendingMessage') IS NULL
BEGIN
    ALTER TABLE dbo.Lessons ADD ExternalPendingMessage nvarchar(2000) NULL;
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.Lessons', 'ExternalPendingMessage') IS NOT NULL
    ALTER TABLE dbo.Lessons DROP COLUMN ExternalPendingMessage;
");
        }
    }
}
