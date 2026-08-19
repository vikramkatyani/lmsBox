using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantLoginHeroUrl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.Tenants', 'LoginHeroUrl') IS NULL
    ALTER TABLE [dbo].[Tenants] ADD [LoginHeroUrl] nvarchar(max) NULL;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.Tenants', 'LoginHeroUrl') IS NOT NULL
    ALTER TABLE [dbo].[Tenants] DROP COLUMN [LoginHeroUrl];
");
        }
    }
}
