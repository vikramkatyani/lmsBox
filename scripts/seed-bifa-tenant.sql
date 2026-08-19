-- Branding columns if missing
IF COL_LENGTH('Tenants','BrandName') IS NULL
BEGIN
  ALTER TABLE Tenants ADD BrandName nvarchar(max) NULL;
  ALTER TABLE Tenants ADD BannerUrl nvarchar(max) NULL;
  ALTER TABLE Tenants ADD FaviconUrl nvarchar(max) NULL;
  ALTER TABLE Tenants ADD ThemeSettings nvarchar(max) NULL;
END
GO

IF COL_LENGTH('Tenants','CustomCss') IS NULL
BEGIN
  ALTER TABLE Tenants ADD CustomCss nvarchar(max) NULL;
END
GO

IF COL_LENGTH('Tenants','LoginHeroUrl') IS NULL
BEGIN
  ALTER TABLE Tenants ADD LoginHeroUrl nvarchar(max) NULL;
END
GO

IF COL_LENGTH('Organisations','UseTenantBranding') IS NULL
BEGIN
  ALTER TABLE Organisations ADD UseTenantBranding bit NOT NULL CONSTRAINT DF_Org_UseTenantBranding DEFAULT(1);
END
GO

IF NOT EXISTS (SELECT 1 FROM __EFMigrationsHistory WHERE MigrationId = N'20260811110142_AddTenantBranding')
  INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion) VALUES (N'20260811110142_AddTenantBranding', N'9.0.0');
GO

-- Matches local BIFA Brand Guidelines v1.2 (tenants.json + bifa-theme.css).
-- CustomCss is applied by DbSeeder from design-system/tenants/bifa-theme.css.
DECLARE @theme nvarchar(max) = N'{"name":"BIFA Learning","strapline":"The leading body representing the UK international freight services industry","primaryColor":"#002e62","secondaryColor":"#0059a3","accentColor":"#ee7203","accentStrongColor":"#e74011","pageBackgroundColor":"#f7f8fa","buttonColor":"#e74011","buttonTextColor":"#ffffff","grey":"#575756","lightGrey":"#c4c2b2","fontFamily":"Poppins, Arial, Helvetica, sans-serif","css":"bifa","logo":"/assets/bifa-logo.svg","guidelineVersion":"1.2"}';

IF NOT EXISTS (SELECT 1 FROM Tenants WHERE Code = N'bifa')
BEGIN
  INSERT INTO Tenants (
    Name, Code, Description, AllowsMultipleOrganisations, MaxUsers, AllocatedStorageGB,
    Domain, SupportEmail, ManagerName, ManagerEmail, IsActive, CreatedOn, CreatedBy,
    BrandName, BannerUrl, FaviconUrl, ThemeSettings
  )
  VALUES (
    N'BIFA',
    N'bifa',
    N'British International Freight Association - training and development for the UK international freight services industry.',
    0,
    500,
    50,
    N'bifa.org',
    N'bifa@bifa.org',
    N'BIFA Communications',
    N'BIFAcomms@bifa.org',
    1,
    SYSUTCDATETIME(),
    N'system',
    N'BIFA Learning',
    N'/assets/bifa-logo.svg',
    N'/assets/bifa-logo.svg',
    @theme
  );
END
ELSE
BEGIN
  UPDATE Tenants SET
    Name = N'BIFA',
    Description = N'British International Freight Association - training and development for the UK international freight services industry.',
    Domain = N'bifa.org',
    SupportEmail = N'bifa@bifa.org',
    ManagerName = N'BIFA Communications',
    ManagerEmail = N'BIFAcomms@bifa.org',
    BrandName = N'BIFA Learning',
    BannerUrl = N'/assets/bifa-logo.svg',
    FaviconUrl = N'/assets/bifa-logo.svg',
    ThemeSettings = @theme,
    IsActive = 1,
    UpdatedOn = SYSUTCDATETIME(),
    UpdatedBy = N'system'
  WHERE Code = N'bifa';
END
GO

DECLARE @tenantId bigint = (SELECT Id FROM Tenants WHERE Code = N'bifa');

IF NOT EXISTS (SELECT 1 FROM Organisations WHERE TenantId = @tenantId)
BEGIN
  INSERT INTO Organisations (
    TenantId, Name, Description, StorageKey, MaxUsers, AllocatedStorageGB,
    Domain, SupportEmail, ManagerName, ManagerEmail, BrandName, BannerUrl, FaviconUrl,
    ThemeSettings, UseTenantBranding, IsActive, CreatedOn, CreatedBy, SmtpUseSsl
  )
  VALUES (
    @tenantId,
    N'BIFA Learning',
    N'Primary organisation for BIFA Learning (inherits tenant branding).',
    LOWER(SUBSTRING(REPLACE(CONVERT(nvarchar(36), NEWID()), N'-', N''), 1, 12)),
    500,
    50,
    N'bifa.org',
    N'bifa@bifa.org',
    N'BIFA Communications',
    N'BIFAcomms@bifa.org',
    NULL, NULL, NULL, NULL,
    1,
    1,
    SYSUTCDATETIME(),
    N'system',
    1
  );
END
ELSE
BEGIN
  UPDATE Organisations SET UseTenantBranding = 1, UpdatedOn = SYSUTCDATETIME(), UpdatedBy = N'system'
  WHERE TenantId = @tenantId;
END
GO

SELECT t.Id AS TenantId, t.Name, t.Code, t.BrandName, t.BannerUrl, o.Id AS OrgId, o.Name AS OrgName, o.UseTenantBranding
FROM Tenants t
LEFT JOIN Organisations o ON o.TenantId = t.Id
WHERE t.Code = N'bifa';
GO
