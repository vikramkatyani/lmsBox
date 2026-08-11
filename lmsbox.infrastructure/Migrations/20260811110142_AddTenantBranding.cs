using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantBranding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BannerUrl",
                table: "Tenants",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BrandName",
                table: "Tenants",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FaviconUrl",
                table: "Tenants",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ThemeSettings",
                table: "Tenants",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "UseTenantBranding",
                table: "Organisations",
                type: "bit",
                nullable: false,
                defaultValue: true);

            // Preserve existing custom org branding; otherwise inherit tenant branding
            migrationBuilder.Sql(@"
UPDATE Organisations
SET UseTenantBranding = 0
WHERE
    (BrandName IS NOT NULL AND LTRIM(RTRIM(BrandName)) <> '')
    OR (BannerUrl IS NOT NULL AND LTRIM(RTRIM(BannerUrl)) <> '')
    OR (FaviconUrl IS NOT NULL AND LTRIM(RTRIM(FaviconUrl)) <> '')
    OR (ThemeSettings IS NOT NULL AND LTRIM(RTRIM(ThemeSettings)) <> '');

-- Seed tenant branding from the oldest org that has branding (when tenant has none yet)
UPDATE t
SET
    t.BrandName = COALESCE(t.BrandName, o.BrandName),
    t.BannerUrl = COALESCE(t.BannerUrl, o.BannerUrl),
    t.FaviconUrl = COALESCE(t.FaviconUrl, o.FaviconUrl),
    t.ThemeSettings = COALESCE(t.ThemeSettings, o.ThemeSettings)
FROM Tenants t
OUTER APPLY (
    SELECT TOP 1 BrandName, BannerUrl, FaviconUrl, ThemeSettings
    FROM Organisations o
    WHERE o.TenantId = t.Id
      AND (
            (o.BrandName IS NOT NULL AND LTRIM(RTRIM(o.BrandName)) <> '')
            OR (o.BannerUrl IS NOT NULL AND LTRIM(RTRIM(o.BannerUrl)) <> '')
            OR (o.FaviconUrl IS NOT NULL AND LTRIM(RTRIM(o.FaviconUrl)) <> '')
            OR (o.ThemeSettings IS NOT NULL AND LTRIM(RTRIM(o.ThemeSettings)) <> '')
          )
    ORDER BY o.Id
) o
WHERE o.BrandName IS NOT NULL OR o.BannerUrl IS NOT NULL OR o.FaviconUrl IS NOT NULL OR o.ThemeSettings IS NOT NULL;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BannerUrl",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "BrandName",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "FaviconUrl",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "ThemeSettings",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "UseTenantBranding",
                table: "Organisations");
        }
    }
}
