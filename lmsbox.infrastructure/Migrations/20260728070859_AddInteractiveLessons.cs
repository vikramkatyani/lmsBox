using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddInteractiveLessons : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[InteractiveLessonSettings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[InteractiveLessonSettings] (
        [Id] bigint NOT NULL IDENTITY(1,1),
        [LessonId] bigint NOT NULL,
        [Description] nvarchar(max) NULL,
        [LockNextBlockUntilComplete] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_InteractiveLessonSettings] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_InteractiveLessonSettings_Lessons_LessonId]
            FOREIGN KEY ([LessonId]) REFERENCES [dbo].[Lessons] ([Id]) ON DELETE CASCADE
    );
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_InteractiveLessonSettings_LessonId'
      AND object_id = OBJECT_ID(N'dbo.InteractiveLessonSettings')
)
    CREATE UNIQUE INDEX [IX_InteractiveLessonSettings_LessonId]
        ON [dbo].[InteractiveLessonSettings] ([LessonId]);

IF OBJECT_ID(N'[dbo].[InteractiveBlocks]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[InteractiveBlocks] (
        [Id] bigint NOT NULL IDENTITY(1,1),
        [InteractiveLessonSettingsId] bigint NOT NULL,
        [Ordinal] int NOT NULL,
        [BlockType] nvarchar(max) NOT NULL,
        [Title] nvarchar(max) NOT NULL,
        [Status] nvarchar(max) NOT NULL,
        [FormPayloadJson] nvarchar(max) NULL,
        [GeneratedHtml] nvarchar(max) NULL,
        [EditedHtml] nvarchar(max) NULL,
        [CompletionRuleJson] nvarchar(max) NULL,
        [MediaAssetsJson] nvarchar(max) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        [ApprovedAt] datetime2 NULL,
        CONSTRAINT [PK_InteractiveBlocks] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_InteractiveBlocks_InteractiveLessonSettings_InteractiveLessonSettingsId]
            FOREIGN KEY ([InteractiveLessonSettingsId]) REFERENCES [dbo].[InteractiveLessonSettings] ([Id]) ON DELETE CASCADE
    );
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_InteractiveBlocks_InteractiveLessonSettingsId'
      AND object_id = OBJECT_ID(N'dbo.InteractiveBlocks')
)
    CREATE INDEX [IX_InteractiveBlocks_InteractiveLessonSettingsId]
        ON [dbo].[InteractiveBlocks] ([InteractiveLessonSettingsId]);

IF OBJECT_ID(N'[dbo].[InteractiveBlockProgresses]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[InteractiveBlockProgresses] (
        [Id] int NOT NULL IDENTITY(1,1),
        [UserId] nvarchar(450) NOT NULL,
        [LessonId] bigint NOT NULL,
        [BlockId] bigint NOT NULL,
        [IsComplete] bit NOT NULL,
        [CompletedAt] datetime2 NULL,
        [ProgressDataJson] nvarchar(max) NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_InteractiveBlockProgresses] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_InteractiveBlockProgresses_AspNetUsers_UserId]
            FOREIGN KEY ([UserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_InteractiveBlockProgresses_InteractiveBlocks_BlockId]
            FOREIGN KEY ([BlockId]) REFERENCES [dbo].[InteractiveBlocks] ([Id]),
        CONSTRAINT [FK_InteractiveBlockProgresses_Lessons_LessonId]
            FOREIGN KEY ([LessonId]) REFERENCES [dbo].[Lessons] ([Id])
    );
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_InteractiveBlockProgresses_BlockId'
      AND object_id = OBJECT_ID(N'dbo.InteractiveBlockProgresses')
)
    CREATE INDEX [IX_InteractiveBlockProgresses_BlockId]
        ON [dbo].[InteractiveBlockProgresses] ([BlockId]);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_InteractiveBlockProgresses_LessonId'
      AND object_id = OBJECT_ID(N'dbo.InteractiveBlockProgresses')
)
    CREATE INDEX [IX_InteractiveBlockProgresses_LessonId]
        ON [dbo].[InteractiveBlockProgresses] ([LessonId]);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_InteractiveBlockProgresses_UserId_BlockId'
      AND object_id = OBJECT_ID(N'dbo.InteractiveBlockProgresses')
)
    CREATE UNIQUE INDEX [IX_InteractiveBlockProgresses_UserId_BlockId]
        ON [dbo].[InteractiveBlockProgresses] ([UserId], [BlockId]);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[InteractiveBlockProgresses]', N'U') IS NOT NULL
    DROP TABLE [dbo].[InteractiveBlockProgresses];
IF OBJECT_ID(N'[dbo].[InteractiveBlocks]', N'U') IS NOT NULL
    DROP TABLE [dbo].[InteractiveBlocks];
IF OBJECT_ID(N'[dbo].[InteractiveLessonSettings]', N'U') IS NOT NULL
    DROP TABLE [dbo].[InteractiveLessonSettings];
");
        }
    }
}
