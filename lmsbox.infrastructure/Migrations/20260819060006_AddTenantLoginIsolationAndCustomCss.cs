using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantLoginIsolationAndCustomCss : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "EmailIndex",
                table: "AspNetUsers");

            migrationBuilder.AddColumn<string>(
                name: "CustomCss",
                table: "Tenants",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "UserName",
                table: "AspNetUsers",
                type: "nvarchar(320)",
                maxLength: 320,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(256)",
                oldMaxLength: 256,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "NormalizedUserName",
                table: "AspNetUsers",
                type: "nvarchar(320)",
                maxLength: 320,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(256)",
                oldMaxLength: 256,
                oldNullable: true);

            migrationBuilder.Sql(@"
UPDATE AspNetUsers
SET
    UserName = CASE
        WHEN TenantId IS NULL THEN Email
        ELSE CONCAT(CAST(TenantId AS nvarchar(20)), N'|', Email)
    END,
    NormalizedUserName = UPPER(CASE
        WHEN TenantId IS NULL THEN Email
        ELSE CONCAT(CAST(TenantId AS nvarchar(20)), N'|', Email)
    END)
WHERE Email IS NOT NULL
  AND UserName <> CASE
        WHEN TenantId IS NULL THEN Email
        ELSE CONCAT(CAST(TenantId AS nvarchar(20)), N'|', Email)
      END;
");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_NormalizedEmail_NoTenant",
                table: "AspNetUsers",
                column: "NormalizedEmail",
                unique: true,
                filter: "[TenantId] IS NULL AND [NormalizedEmail] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_TenantId_NormalizedEmail",
                table: "AspNetUsers",
                columns: new[] { "TenantId", "NormalizedEmail" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [NormalizedEmail] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_NormalizedEmail_NoTenant",
                table: "AspNetUsers");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_TenantId_NormalizedEmail",
                table: "AspNetUsers");

            migrationBuilder.Sql(@"
UPDATE AspNetUsers
SET UserName = Email,
    NormalizedUserName = UPPER(Email)
WHERE Email IS NOT NULL;
");

            migrationBuilder.DropColumn(
                name: "CustomCss",
                table: "Tenants");

            migrationBuilder.AlterColumn<string>(
                name: "UserName",
                table: "AspNetUsers",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(320)",
                oldMaxLength: 320,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "NormalizedUserName",
                table: "AspNetUsers",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(320)",
                oldMaxLength: 320,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                table: "AspNetUsers",
                column: "NormalizedEmail");
        }
    }
}
