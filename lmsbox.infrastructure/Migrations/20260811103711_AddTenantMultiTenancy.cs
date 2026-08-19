using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantMultiTenancy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[Tenants]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Tenants] (
        [Id] bigint NOT NULL IDENTITY(1,1),
        [Name] nvarchar(200) NOT NULL,
        [Code] nvarchar(100) NOT NULL,
        [Description] nvarchar(max) NULL,
        [AllowsMultipleOrganisations] bit NOT NULL,
        [MaxUsers] int NOT NULL,
        [AllocatedStorageGB] bigint NOT NULL,
        [Domain] nvarchar(max) NULL,
        [SupportEmail] nvarchar(max) NULL,
        [ManagerName] nvarchar(max) NULL,
        [ManagerEmail] nvarchar(max) NULL,
        [ManagerPhone] nvarchar(max) NULL,
        [RenewalDate] datetime2 NULL,
        [IsActive] bit NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [CreatedBy] nvarchar(max) NOT NULL,
        [UpdatedOn] datetime2 NULL,
        [UpdatedBy] nvarchar(max) NULL,
        CONSTRAINT [PK_Tenants] PRIMARY KEY ([Id])
    );
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Tenants_Code' AND object_id = OBJECT_ID(N'dbo.Tenants'))
    CREATE UNIQUE INDEX [IX_Tenants_Code] ON [dbo].[Tenants] ([Code]);

IF COL_LENGTH('dbo.Organisations', 'TenantId') IS NULL
    ALTER TABLE [dbo].[Organisations] ADD [TenantId] bigint NULL;

IF COL_LENGTH('dbo.AspNetUsers', 'TenantId') IS NULL
    ALTER TABLE [dbo].[AspNetUsers] ADD [TenantId] bigint NULL;

-- Backfill: one single-org tenant per existing organisation (only if no tenants exist yet)
IF NOT EXISTS (SELECT TOP 1 1 FROM Tenants)
BEGIN
    INSERT INTO Tenants (Name, Code, Description, AllowsMultipleOrganisations, MaxUsers, AllocatedStorageGB, Domain, SupportEmail, ManagerName, ManagerEmail, ManagerPhone, RenewalDate, IsActive, CreatedOn, CreatedBy)
    SELECT
        o.Name,
        LEFT(CONCAT('org-', CAST(o.Id AS nvarchar(20)), '-', LOWER(REPLACE(REPLACE(REPLACE(ISNULL(o.StorageKey, CAST(o.Id AS nvarchar(20))), ' ', '-'), '_', '-'), '.', '-'))), 100),
        o.Description,
        0,
        o.MaxUsers,
        o.AllocatedStorageGB,
        o.Domain,
        o.SupportEmail,
        o.ManagerName,
        o.ManagerEmail,
        o.ManagerPhone,
        o.RenewalDate,
        o.IsActive,
        o.CreatedOn,
        ISNULL(NULLIF(o.CreatedBy, ''), 'system')
    FROM Organisations o
    WHERE NOT EXISTS (SELECT 1 FROM Tenants t WHERE t.Name = o.Name);

    UPDATE o
    SET o.TenantId = t.Id
    FROM Organisations o
    INNER JOIN Tenants t ON t.Name = o.Name
    WHERE o.TenantId IS NULL;

    UPDATE u
    SET u.TenantId = o.TenantId
    FROM AspNetUsers u
    INNER JOIN Organisations o ON o.Id = u.OrganisationID
    WHERE u.TenantId IS NULL AND o.TenantId IS NOT NULL;
END

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'FK_Organisations_Tenants_TenantId'
      AND parent_object_id = OBJECT_ID(N'dbo.Organisations')
)
    ALTER TABLE [dbo].[Organisations] WITH CHECK
        ADD CONSTRAINT [FK_Organisations_Tenants_TenantId]
        FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants] ([Id]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Organisations_TenantId' AND object_id = OBJECT_ID(N'dbo.Organisations'))
    CREATE INDEX [IX_Organisations_TenantId] ON [dbo].[Organisations] ([TenantId]);

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'FK_AspNetUsers_Tenants_TenantId'
      AND parent_object_id = OBJECT_ID(N'dbo.AspNetUsers')
)
    ALTER TABLE [dbo].[AspNetUsers] WITH CHECK
        ADD CONSTRAINT [FK_AspNetUsers_Tenants_TenantId]
        FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants] ([Id]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetUsers_TenantId' AND object_id = OBJECT_ID(N'dbo.AspNetUsers'))
    CREATE INDEX [IX_AspNetUsers_TenantId] ON [dbo].[AspNetUsers] ([TenantId]);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_AspNetUsers_Tenants_TenantId' AND parent_object_id = OBJECT_ID(N'dbo.AspNetUsers'))
    ALTER TABLE [dbo].[AspNetUsers] DROP CONSTRAINT [FK_AspNetUsers_Tenants_TenantId];
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Organisations_Tenants_TenantId' AND parent_object_id = OBJECT_ID(N'dbo.Organisations'))
    ALTER TABLE [dbo].[Organisations] DROP CONSTRAINT [FK_Organisations_Tenants_TenantId];
IF COL_LENGTH('dbo.AspNetUsers', 'TenantId') IS NOT NULL
    ALTER TABLE [dbo].[AspNetUsers] DROP COLUMN [TenantId];
IF COL_LENGTH('dbo.Organisations', 'TenantId') IS NOT NULL
    ALTER TABLE [dbo].[Organisations] DROP COLUMN [TenantId];
IF OBJECT_ID(N'[dbo].[Tenants]', N'U') IS NOT NULL
    DROP TABLE [dbo].[Tenants];
");
        }
    }
}
