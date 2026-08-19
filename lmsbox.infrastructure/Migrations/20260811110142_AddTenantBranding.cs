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
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.Tenants', 'BannerUrl') IS NULL
    ALTER TABLE [dbo].[Tenants] ADD [BannerUrl] nvarchar(max) NULL;

IF COL_LENGTH('dbo.Tenants', 'BrandName') IS NULL
    ALTER TABLE [dbo].[Tenants] ADD [BrandName] nvarchar(max) NULL;

IF COL_LENGTH('dbo.Tenants', 'FaviconUrl') IS NULL
    ALTER TABLE [dbo].[Tenants] ADD [FaviconUrl] nvarchar(max) NULL;

IF COL_LENGTH('dbo.Tenants', 'ThemeSettings') IS NULL
    ALTER TABLE [dbo].[Tenants] ADD [ThemeSettings] nvarchar(max) NULL;

IF COL_LENGTH('dbo.Organisations', 'UseTenantBranding') IS NULL
    ALTER TABLE [dbo].[Organisations] ADD [UseTenantBranding] bit NOT NULL
        CONSTRAINT [DF_Organisations_UseTenantBranding] DEFAULT(1);

-- Preserve existing custom org branding; otherwise inherit tenant branding
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
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.Tenants', 'BannerUrl') IS NOT NULL
    ALTER TABLE [dbo].[Tenants] DROP COLUMN [BannerUrl];
IF COL_LENGTH('dbo.Tenants', 'BrandName') IS NOT NULL
    ALTER TABLE [dbo].[Tenants] DROP COLUMN [BrandName];
IF COL_LENGTH('dbo.Tenants', 'FaviconUrl') IS NOT NULL
    ALTER TABLE [dbo].[Tenants] DROP COLUMN [FaviconUrl];
IF COL_LENGTH('dbo.Tenants', 'ThemeSettings') IS NOT NULL
    ALTER TABLE [dbo].[Tenants] DROP COLUMN [ThemeSettings];

DECLARE @df sysname;
SELECT @df = dc.name FROM sys.default_constraints dc
INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
WHERE dc.parent_object_id = OBJECT_ID(N'dbo.Organisations') AND c.name = N'UseTenantBranding';
IF @df IS NOT NULL EXEC(N'ALTER TABLE dbo.Organisations DROP CONSTRAINT [' + @df + N']');
IF COL_LENGTH('dbo.Organisations', 'UseTenantBranding') IS NOT NULL
    ALTER TABLE [dbo].[Organisations] DROP COLUMN [UseTenantBranding];
");
        }
    }
}
