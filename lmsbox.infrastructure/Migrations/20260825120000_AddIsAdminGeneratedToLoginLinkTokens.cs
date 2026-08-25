using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddIsAdminGeneratedToLoginLinkTokens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.LoginLinkTokens', 'IsAdminGenerated') IS NULL
    ALTER TABLE [dbo].[LoginLinkTokens] ADD [IsAdminGenerated] bit NOT NULL CONSTRAINT [DF_LoginLinkTokens_IsAdminGenerated] DEFAULT(0);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.LoginLinkTokens', 'IsAdminGenerated') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[LoginLinkTokens] DROP CONSTRAINT [DF_LoginLinkTokens_IsAdminGenerated];
    ALTER TABLE [dbo].[LoginLinkTokens] DROP COLUMN [IsAdminGenerated];
END
");
        }
    }
}
