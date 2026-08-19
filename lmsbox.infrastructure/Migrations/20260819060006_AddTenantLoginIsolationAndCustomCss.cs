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
            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'EmailIndex'
      AND object_id = OBJECT_ID(N'dbo.AspNetUsers')
)
    DROP INDEX [EmailIndex] ON [dbo].[AspNetUsers];

IF COL_LENGTH('dbo.Tenants', 'CustomCss') IS NULL
    ALTER TABLE [dbo].[Tenants] ADD [CustomCss] nvarchar(max) NULL;

-- Widen UserName/NormalizedUserName for tenant-prefixed format
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.AspNetUsers') AND name = N'UserName' AND max_length < 640
)
    ALTER TABLE [dbo].[AspNetUsers] ALTER COLUMN [UserName] nvarchar(320) NULL;

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.AspNetUsers') AND name = N'NormalizedUserName' AND max_length < 640
)
    ALTER TABLE [dbo].[AspNetUsers] ALTER COLUMN [NormalizedUserName] nvarchar(320) NULL;

-- Rewrite UserName to tenant-prefixed format
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

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_AspNetUsers_NormalizedEmail_NoTenant'
      AND object_id = OBJECT_ID(N'dbo.AspNetUsers')
)
    CREATE UNIQUE INDEX [IX_AspNetUsers_NormalizedEmail_NoTenant]
        ON [dbo].[AspNetUsers] ([NormalizedEmail])
        WHERE [TenantId] IS NULL AND [NormalizedEmail] IS NOT NULL;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_AspNetUsers_TenantId_NormalizedEmail'
      AND object_id = OBJECT_ID(N'dbo.AspNetUsers')
)
    CREATE UNIQUE INDEX [IX_AspNetUsers_TenantId_NormalizedEmail]
        ON [dbo].[AspNetUsers] ([TenantId], [NormalizedEmail])
        WHERE [TenantId] IS NOT NULL AND [NormalizedEmail] IS NOT NULL;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetUsers_NormalizedEmail_NoTenant' AND object_id = OBJECT_ID(N'dbo.AspNetUsers'))
    DROP INDEX [IX_AspNetUsers_NormalizedEmail_NoTenant] ON [dbo].[AspNetUsers];

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetUsers_TenantId_NormalizedEmail' AND object_id = OBJECT_ID(N'dbo.AspNetUsers'))
    DROP INDEX [IX_AspNetUsers_TenantId_NormalizedEmail] ON [dbo].[AspNetUsers];

UPDATE AspNetUsers
SET UserName = Email,
    NormalizedUserName = UPPER(Email)
WHERE Email IS NOT NULL;

IF COL_LENGTH('dbo.Tenants', 'CustomCss') IS NOT NULL
    ALTER TABLE [dbo].[Tenants] DROP COLUMN [CustomCss];

ALTER TABLE [dbo].[AspNetUsers] ALTER COLUMN [UserName] nvarchar(256) NULL;
ALTER TABLE [dbo].[AspNetUsers] ALTER COLUMN [NormalizedUserName] nvarchar(256) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'EmailIndex' AND object_id = OBJECT_ID(N'dbo.AspNetUsers'))
    CREATE INDEX [EmailIndex] ON [dbo].[AspNetUsers] ([NormalizedEmail]);
");
        }
    }
}
