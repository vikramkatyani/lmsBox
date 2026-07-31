using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260727181100_SeedDefaultFavoriteReportsForAdmins")]
    public partial class SeedDefaultFavoriteReportsForAdmins : Migration
    {
        private const string DefaultFavoritesJson =
            @"[""user-progress"",""user-course-progress"",""time-tracking"",""engagement-analytics"",""course-enrollment"",""quiz-attempts"",""assessment-difficulty"",""survey-report"",""activity-logs""]";

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
UPDATE u
SET u.FavoriteReportIds = N'{DefaultFavoritesJson}'
FROM dbo.AspNetUsers u
INNER JOIN dbo.AspNetUserRoles ur ON ur.UserId = u.Id
INNER JOIN dbo.AspNetRoles r ON r.Id = ur.RoleId
WHERE u.FavoriteReportIds IS NULL
  AND r.Name IN (N'Admin', N'OrgAdmin', N'SuperAdmin');
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Irreversible data seed — leave favourites as-is on rollback.
        }
    }
}
