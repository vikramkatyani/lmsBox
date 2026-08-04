using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddQuestionBankAndQuizAttempts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Fully guarded SQL — production has drifted indexes/FKs and partial applies.
            migrationBuilder.Sql(@"
DECLARE @fk sysname;
DECLARE fk_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT fk.name
    FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    INNER JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
    WHERE fk.parent_object_id = OBJECT_ID(N'dbo.Quizzes')
      AND c.name = N'CourseId';
OPEN fk_cursor;
FETCH NEXT FROM fk_cursor INTO @fk;
WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC(N'ALTER TABLE [dbo].[Quizzes] DROP CONSTRAINT [' + REPLACE(@fk, ']', ']]') + N']');
    FETCH NEXT FROM fk_cursor INTO @fk;
END
CLOSE fk_cursor;
DEALLOCATE fk_cursor;

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Quizzes') AND name = N'CourseId' AND is_nullable = 0
)
    ALTER TABLE [dbo].[Quizzes] ALTER COLUMN [CourseId] nvarchar(450) NULL;

IF COL_LENGTH('dbo.Quizzes', 'IntroductionContent') IS NULL
    ALTER TABLE [dbo].[Quizzes] ADD [IntroductionContent] nvarchar(max) NULL;
IF COL_LENGTH('dbo.Quizzes', 'IsQuestionBank') IS NULL
    ALTER TABLE [dbo].[Quizzes] ADD [IsQuestionBank] bit NOT NULL CONSTRAINT [DF_Quizzes_IsQuestionBank] DEFAULT(0);
IF COL_LENGTH('dbo.Quizzes', 'QuestionsPerAttempt') IS NULL
    ALTER TABLE [dbo].[Quizzes] ADD [QuestionsPerAttempt] int NULL;
IF COL_LENGTH('dbo.Quizzes', 'QuestionsPerAttemptByCategoryJson') IS NULL
    ALTER TABLE [dbo].[Quizzes] ADD [QuestionsPerAttemptByCategoryJson] nvarchar(max) NULL;
IF COL_LENGTH('dbo.Quizzes', 'SourceQuestionBankQuizId') IS NULL
    ALTER TABLE [dbo].[Quizzes] ADD [SourceQuestionBankQuizId] nvarchar(max) NULL;

IF COL_LENGTH('dbo.QuizQuestions', 'Category') IS NULL
    ALTER TABLE [dbo].[QuizQuestions] ADD [Category] nvarchar(max) NULL;
IF COL_LENGTH('dbo.QuizQuestions', 'IsCriticalSafety') IS NULL
    ALTER TABLE [dbo].[QuizQuestions] ADD [IsCriticalSafety] bit NOT NULL CONSTRAINT [DF_QuizQuestions_IsCriticalSafety] DEFAULT(0);
IF COL_LENGTH('dbo.QuizQuestions', 'QuestionBankQuestionId') IS NULL
    ALTER TABLE [dbo].[QuizQuestions] ADD [QuestionBankQuestionId] bigint NULL;

IF COL_LENGTH('dbo.QuizQuestionOptions', 'QuestionBankQuestionOptionId') IS NULL
    ALTER TABLE [dbo].[QuizQuestionOptions] ADD [QuestionBankQuestionOptionId] bigint NULL;

IF OBJECT_ID(N'[dbo].[QuestionBankCategories]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[QuestionBankCategories] (
        [Id] bigint NOT NULL IDENTITY(1,1),
        [Name] nvarchar(100) NOT NULL,
        [Description] nvarchar(500) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [CreatedByUserId] nvarchar(max) NULL,
        [UpdatedAt] datetime2 NULL,
        [UpdatedByUserId] nvarchar(max) NULL,
        CONSTRAINT [PK_QuestionBankCategories] PRIMARY KEY ([Id])
    );
END

IF OBJECT_ID(N'[dbo].[QuestionBankQuestions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[QuestionBankQuestions] (
        [Id] bigint NOT NULL IDENTITY(1,1),
        [Question] nvarchar(max) NOT NULL,
        [Type] nvarchar(max) NOT NULL,
        [Points] int NOT NULL,
        [Explanation] nvarchar(max) NULL,
        [Category] nvarchar(max) NULL,
        [IsCriticalSafety] bit NOT NULL,
        [IsArchived] bit NOT NULL,
        [Tags] nvarchar(max) NULL,
        [CreatedByUserId] nvarchar(450) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [PK_QuestionBankQuestions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_QuestionBankQuestions_AspNetUsers_CreatedByUserId]
            FOREIGN KEY ([CreatedByUserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE CASCADE
    );
END

IF OBJECT_ID(N'[dbo].[QuizAttempts]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[QuizAttempts] (
        [Id] bigint NOT NULL IDENTITY(1,1),
        [QuizId] nvarchar(450) NOT NULL,
        [UserId] nvarchar(450) NOT NULL,
        [StartedAt] datetime2 NOT NULL,
        [CompletedAt] datetime2 NOT NULL,
        [DurationSeconds] int NOT NULL,
        [ScorePercent] int NOT NULL,
        [Passed] bit NOT NULL,
        [FailedCriticalSafety] bit NOT NULL,
        [IsCompleted] bit NOT NULL,
        CONSTRAINT [PK_QuizAttempts] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_QuizAttempts_AspNetUsers_UserId]
            FOREIGN KEY ([UserId]) REFERENCES [dbo].[AspNetUsers] ([Id]),
        CONSTRAINT [FK_QuizAttempts_Quizzes_QuizId]
            FOREIGN KEY ([QuizId]) REFERENCES [dbo].[Quizzes] ([Id]) ON DELETE CASCADE
    );
END

IF OBJECT_ID(N'[dbo].[QuestionBankQuestionOptions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[QuestionBankQuestionOptions] (
        [Id] bigint NOT NULL IDENTITY(1,1),
        [Text] nvarchar(max) NOT NULL,
        [IsCorrect] bit NOT NULL,
        [QuestionBankQuestionId] bigint NOT NULL,
        [Order] int NOT NULL,
        CONSTRAINT [PK_QuestionBankQuestionOptions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_QuestionBankQuestionOptions_QuestionBankQuestions_QuestionBankQuestionId]
            FOREIGN KEY ([QuestionBankQuestionId]) REFERENCES [dbo].[QuestionBankQuestions] ([Id]) ON DELETE CASCADE
    );
END

IF OBJECT_ID(N'[dbo].[QuestionBankQuestionStatsCourse]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[QuestionBankQuestionStatsCourse] (
        [Id] bigint NOT NULL IDENTITY(1,1),
        [CourseId] nvarchar(450) NOT NULL,
        [QuestionBankQuestionId] bigint NOT NULL,
        [PresentedCount] bigint NOT NULL,
        [CorrectCount] bigint NOT NULL,
        [IncorrectCount] bigint NOT NULL,
        [LastPresentedAt] datetime2 NULL,
        CONSTRAINT [PK_QuestionBankQuestionStatsCourse] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_QuestionBankQuestionStatsCourse_QuestionBankQuestions_QuestionBankQuestionId]
            FOREIGN KEY ([QuestionBankQuestionId]) REFERENCES [dbo].[QuestionBankQuestions] ([Id]) ON DELETE CASCADE
    );
END

IF OBJECT_ID(N'[dbo].[QuestionBankQuestionStatsGlobal]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[QuestionBankQuestionStatsGlobal] (
        [QuestionBankQuestionId] bigint NOT NULL,
        [PresentedCount] bigint NOT NULL,
        [CorrectCount] bigint NOT NULL,
        [IncorrectCount] bigint NOT NULL,
        [LastPresentedAt] datetime2 NULL,
        CONSTRAINT [PK_QuestionBankQuestionStatsGlobal] PRIMARY KEY ([QuestionBankQuestionId]),
        CONSTRAINT [FK_QuestionBankQuestionStatsGlobal_QuestionBankQuestions_QuestionBankQuestionId]
            FOREIGN KEY ([QuestionBankQuestionId]) REFERENCES [dbo].[QuestionBankQuestions] ([Id]) ON DELETE CASCADE
    );
END

IF OBJECT_ID(N'[dbo].[QuestionBankQuestionStatsQuiz]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[QuestionBankQuestionStatsQuiz] (
        [Id] bigint NOT NULL IDENTITY(1,1),
        [QuizId] nvarchar(450) NOT NULL,
        [QuestionBankQuestionId] bigint NOT NULL,
        [PresentedCount] bigint NOT NULL,
        [CorrectCount] bigint NOT NULL,
        [IncorrectCount] bigint NOT NULL,
        [LastPresentedAt] datetime2 NULL,
        CONSTRAINT [PK_QuestionBankQuestionStatsQuiz] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_QuestionBankQuestionStatsQuiz_QuestionBankQuestions_QuestionBankQuestionId]
            FOREIGN KEY ([QuestionBankQuestionId]) REFERENCES [dbo].[QuestionBankQuestions] ([Id]) ON DELETE CASCADE
    );
END

IF OBJECT_ID(N'[dbo].[QuizAttemptAnswers]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[QuizAttemptAnswers] (
        [Id] bigint NOT NULL IDENTITY(1,1),
        [QuizAttemptId] bigint NOT NULL,
        [QuizQuestionId] bigint NOT NULL,
        [QuestionBankQuestionId] bigint NULL,
        [SelectedOptionId] bigint NULL,
        [SelectedOptionIdsJson] nvarchar(max) NULL,
        [SelectedQuestionBankOptionIdsJson] nvarchar(max) NULL,
        [IsCorrect] bit NOT NULL,
        [ResponseTimeMs] int NOT NULL,
        CONSTRAINT [PK_QuizAttemptAnswers] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_QuizAttemptAnswers_QuizAttempts_QuizAttemptId]
            FOREIGN KEY ([QuizAttemptId]) REFERENCES [dbo].[QuizAttempts] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_QuizAttemptAnswers_QuizQuestions_QuizQuestionId]
            FOREIGN KEY ([QuizQuestionId]) REFERENCES [dbo].[QuizQuestions] ([Id])
    );
END

IF OBJECT_ID(N'[dbo].[QuizAttemptQuestions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[QuizAttemptQuestions] (
        [Id] bigint NOT NULL IDENTITY(1,1),
        [QuizAttemptId] bigint NOT NULL,
        [QuizQuestionId] bigint NOT NULL,
        [QuestionBankQuestionId] bigint NULL,
        [DisplayOrder] int NOT NULL,
        CONSTRAINT [PK_QuizAttemptQuestions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_QuizAttemptQuestions_QuizAttempts_QuizAttemptId]
            FOREIGN KEY ([QuizAttemptId]) REFERENCES [dbo].[QuizAttempts] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_QuizAttemptQuestions_QuizQuestions_QuizQuestionId]
            FOREIGN KEY ([QuizQuestionId]) REFERENCES [dbo].[QuizQuestions] ([Id])
    );
END

IF OBJECT_ID(N'dbo.QuestionBankCategories', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_QuestionBankCategories_Name' AND object_id = OBJECT_ID(N'dbo.QuestionBankCategories'))
    CREATE UNIQUE INDEX [IX_QuestionBankCategories_Name] ON [dbo].[QuestionBankCategories] ([Name]);

IF OBJECT_ID(N'dbo.QuestionBankQuestionOptions', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_QuestionBankQuestionOptions_QuestionBankQuestionId' AND object_id = OBJECT_ID(N'dbo.QuestionBankQuestionOptions'))
    CREATE INDEX [IX_QuestionBankQuestionOptions_QuestionBankQuestionId] ON [dbo].[QuestionBankQuestionOptions] ([QuestionBankQuestionId]);

IF OBJECT_ID(N'dbo.QuestionBankQuestions', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_QuestionBankQuestions_CreatedAt' AND object_id = OBJECT_ID(N'dbo.QuestionBankQuestions'))
    CREATE INDEX [IX_QuestionBankQuestions_CreatedAt] ON [dbo].[QuestionBankQuestions] ([CreatedAt]);

IF OBJECT_ID(N'dbo.QuestionBankQuestions', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_QuestionBankQuestions_CreatedByUserId' AND object_id = OBJECT_ID(N'dbo.QuestionBankQuestions'))
    CREATE INDEX [IX_QuestionBankQuestions_CreatedByUserId] ON [dbo].[QuestionBankQuestions] ([CreatedByUserId]);

IF OBJECT_ID(N'dbo.QuestionBankQuestionStatsCourse', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_QuestionBankQuestionStatsCourse_CourseId_QuestionBankQuestionId' AND object_id = OBJECT_ID(N'dbo.QuestionBankQuestionStatsCourse'))
    CREATE UNIQUE INDEX [IX_QuestionBankQuestionStatsCourse_CourseId_QuestionBankQuestionId] ON [dbo].[QuestionBankQuestionStatsCourse] ([CourseId], [QuestionBankQuestionId]);

IF OBJECT_ID(N'dbo.QuestionBankQuestionStatsCourse', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_QuestionBankQuestionStatsCourse_QuestionBankQuestionId' AND object_id = OBJECT_ID(N'dbo.QuestionBankQuestionStatsCourse'))
    CREATE INDEX [IX_QuestionBankQuestionStatsCourse_QuestionBankQuestionId] ON [dbo].[QuestionBankQuestionStatsCourse] ([QuestionBankQuestionId]);

IF OBJECT_ID(N'dbo.QuestionBankQuestionStatsQuiz', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_QuestionBankQuestionStatsQuiz_QuestionBankQuestionId' AND object_id = OBJECT_ID(N'dbo.QuestionBankQuestionStatsQuiz'))
    CREATE INDEX [IX_QuestionBankQuestionStatsQuiz_QuestionBankQuestionId] ON [dbo].[QuestionBankQuestionStatsQuiz] ([QuestionBankQuestionId]);

IF OBJECT_ID(N'dbo.QuestionBankQuestionStatsQuiz', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_QuestionBankQuestionStatsQuiz_QuizId_QuestionBankQuestionId' AND object_id = OBJECT_ID(N'dbo.QuestionBankQuestionStatsQuiz'))
    CREATE UNIQUE INDEX [IX_QuestionBankQuestionStatsQuiz_QuizId_QuestionBankQuestionId] ON [dbo].[QuestionBankQuestionStatsQuiz] ([QuizId], [QuestionBankQuestionId]);

IF OBJECT_ID(N'dbo.QuizAttemptAnswers', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_QuizAttemptAnswers_QuizAttemptId' AND object_id = OBJECT_ID(N'dbo.QuizAttemptAnswers'))
    CREATE INDEX [IX_QuizAttemptAnswers_QuizAttemptId] ON [dbo].[QuizAttemptAnswers] ([QuizAttemptId]);

IF OBJECT_ID(N'dbo.QuizAttemptAnswers', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_QuizAttemptAnswers_QuizQuestionId' AND object_id = OBJECT_ID(N'dbo.QuizAttemptAnswers'))
    CREATE INDEX [IX_QuizAttemptAnswers_QuizQuestionId] ON [dbo].[QuizAttemptAnswers] ([QuizQuestionId]);

IF OBJECT_ID(N'dbo.QuizAttemptQuestions', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_QuizAttemptQuestions_QuizAttemptId_QuizQuestionId' AND object_id = OBJECT_ID(N'dbo.QuizAttemptQuestions'))
    CREATE UNIQUE INDEX [IX_QuizAttemptQuestions_QuizAttemptId_QuizQuestionId] ON [dbo].[QuizAttemptQuestions] ([QuizAttemptId], [QuizQuestionId]);

IF OBJECT_ID(N'dbo.QuizAttemptQuestions', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_QuizAttemptQuestions_QuizQuestionId' AND object_id = OBJECT_ID(N'dbo.QuizAttemptQuestions'))
    CREATE INDEX [IX_QuizAttemptQuestions_QuizQuestionId] ON [dbo].[QuizAttemptQuestions] ([QuizQuestionId]);

IF OBJECT_ID(N'dbo.QuizAttempts', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_QuizAttempts_QuizId_UserId_CompletedAt' AND object_id = OBJECT_ID(N'dbo.QuizAttempts'))
    CREATE INDEX [IX_QuizAttempts_QuizId_UserId_CompletedAt] ON [dbo].[QuizAttempts] ([QuizId], [UserId], [CompletedAt]);

IF OBJECT_ID(N'dbo.QuizAttempts', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_QuizAttempts_UserId' AND object_id = OBJECT_ID(N'dbo.QuizAttempts'))
    CREATE INDEX [IX_QuizAttempts_UserId] ON [dbo].[QuizAttempts] ([UserId]);

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'FK_Quizzes_Courses_CourseId'
      AND parent_object_id = OBJECT_ID(N'dbo.Quizzes')
)
    ALTER TABLE [dbo].[Quizzes] WITH CHECK
        ADD CONSTRAINT [FK_Quizzes_Courses_CourseId]
        FOREIGN KEY ([CourseId]) REFERENCES [dbo].[Courses] ([Id]);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_Quizzes_Courses_CourseId'
      AND parent_object_id = OBJECT_ID(N'dbo.Quizzes')
)
    ALTER TABLE [dbo].[Quizzes] DROP CONSTRAINT [FK_Quizzes_Courses_CourseId];
");

            migrationBuilder.DropTable(
                name: "QuestionBankCategories");

            migrationBuilder.DropTable(
                name: "QuestionBankQuestionOptions");

            migrationBuilder.DropTable(
                name: "QuestionBankQuestionStatsCourse");

            migrationBuilder.DropTable(
                name: "QuestionBankQuestionStatsGlobal");

            migrationBuilder.DropTable(
                name: "QuestionBankQuestionStatsQuiz");

            migrationBuilder.DropTable(
                name: "QuizAttemptAnswers");

            migrationBuilder.DropTable(
                name: "QuizAttemptQuestions");

            migrationBuilder.DropTable(
                name: "QuestionBankQuestions");

            migrationBuilder.DropTable(
                name: "QuizAttempts");

            migrationBuilder.DropColumn(
                name: "IntroductionContent",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "IsQuestionBank",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "QuestionsPerAttempt",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "QuestionsPerAttemptByCategoryJson",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "SourceQuestionBankQuizId",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "QuizQuestions");

            migrationBuilder.DropColumn(
                name: "IsCriticalSafety",
                table: "QuizQuestions");

            migrationBuilder.DropColumn(
                name: "QuestionBankQuestionId",
                table: "QuizQuestions");

            migrationBuilder.DropColumn(
                name: "QuestionBankQuestionOptionId",
                table: "QuizQuestionOptions");

            migrationBuilder.AlterColumn<string>(
                name: "CourseId",
                table: "Quizzes",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(450)",
                oldNullable: true);

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_Quizzes_Courses_CourseId'
      AND parent_object_id = OBJECT_ID(N'dbo.Quizzes')
)
    ALTER TABLE [dbo].[Quizzes] WITH CHECK
        ADD CONSTRAINT [FK_Quizzes_Courses_CourseId]
        FOREIGN KEY ([CourseId]) REFERENCES [dbo].[Courses] ([Id])
        ON DELETE CASCADE;
");
        }
    }
}
