using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260727181000_AddFavoriteReportIdsToApplicationUser")]
    public partial class AddFavoriteReportIdsToApplicationUser : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.AspNetUsers', 'FavoriteReportIds') IS NULL
BEGIN
    ALTER TABLE dbo.AspNetUsers ADD FavoriteReportIds nvarchar(max) NULL;
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.AspNetUsers', 'FavoriteReportIds') IS NOT NULL
    ALTER TABLE dbo.AspNetUsers DROP COLUMN FavoriteReportIds;
");
        }
    }
}
