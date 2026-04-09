IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
CREATE TABLE [AspNetRoles] (
    [Id] nvarchar(450) NOT NULL,
    [Name] nvarchar(256) NULL,
    [NormalizedName] nvarchar(256) NULL,
    [ConcurrencyStamp] nvarchar(max) NULL,
    CONSTRAINT [PK_AspNetRoles] PRIMARY KEY ([Id])
);

CREATE TABLE [AuditLogs] (
    [Id] bigint NOT NULL IDENTITY,
    [Action] nvarchar(max) NOT NULL,
    [PerformedBy] nvarchar(max) NOT NULL,
    [PerformedAt] datetime2 NOT NULL,
    [Details] nvarchar(max) NULL,
    CONSTRAINT [PK_AuditLogs] PRIMARY KEY ([Id])
);

CREATE TABLE [Organisations] (
    [Id] bigint NOT NULL IDENTITY,
    [Name] nvarchar(max) NOT NULL,
    [Description] nvarchar(max) NULL,
    CONSTRAINT [PK_Organisations] PRIMARY KEY ([Id])
);

CREATE TABLE [RevokedTokens] (
    [Id] uniqueidentifier NOT NULL,
    [Jti] nvarchar(max) NULL,
    [TokenHash] nvarchar(max) NULL,
    [RevokedAt] datetime2 NOT NULL,
    [ExpiresAt] datetime2 NOT NULL,
    CONSTRAINT [PK_RevokedTokens] PRIMARY KEY ([Id])
);

CREATE TABLE [UserRoles] (
    [Id] int NOT NULL IDENTITY,
    [Name] nvarchar(max) NOT NULL,
    [Description] nvarchar(max) NULL,
    CONSTRAINT [PK_UserRoles] PRIMARY KEY ([Id])
);

CREATE TABLE [AspNetRoleClaims] (
    [Id] int NOT NULL IDENTITY,
    [RoleId] nvarchar(450) NOT NULL,
    [ClaimType] nvarchar(max) NULL,
    [ClaimValue] nvarchar(max) NULL,
    CONSTRAINT [PK_AspNetRoleClaims] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_AspNetRoleClaims_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [AspNetUsers] (
    [Id] nvarchar(450) NOT NULL,
    [FirstName] nvarchar(max) NOT NULL,
    [LastName] nvarchar(max) NULL,
    [OrganisationID] bigint NOT NULL,
    [CreatedOn] datetime2 NOT NULL,
    [CreatedBy] nvarchar(max) NOT NULL,
    [ActiveStatus] int NOT NULL,
    [ActivatedOn] datetime2 NOT NULL,
    [ActivatedBy] nvarchar(max) NOT NULL,
    [DeactivatedOn] datetime2 NOT NULL,
    [DeactivatedBy] nvarchar(max) NOT NULL,
    [UserName] nvarchar(256) NULL,
    [NormalizedUserName] nvarchar(256) NULL,
    [Email] nvarchar(256) NULL,
    [NormalizedEmail] nvarchar(256) NULL,
    [EmailConfirmed] bit NOT NULL,
    [PasswordHash] nvarchar(max) NULL,
    [SecurityStamp] nvarchar(max) NULL,
    [ConcurrencyStamp] nvarchar(max) NULL,
    [PhoneNumber] nvarchar(max) NULL,
    [PhoneNumberConfirmed] bit NOT NULL,
    [TwoFactorEnabled] bit NOT NULL,
    [LockoutEnd] datetimeoffset NULL,
    [LockoutEnabled] bit NOT NULL,
    [AccessFailedCount] int NOT NULL,
    CONSTRAINT [PK_AspNetUsers] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_AspNetUsers_Organisations_OrganisationID] FOREIGN KEY ([OrganisationID]) REFERENCES [Organisations] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [AspNetUserClaims] (
    [Id] int NOT NULL IDENTITY,
    [UserId] nvarchar(450) NOT NULL,
    [ClaimType] nvarchar(max) NULL,
    [ClaimValue] nvarchar(max) NULL,
    CONSTRAINT [PK_AspNetUserClaims] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_AspNetUserClaims_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [AspNetUserLogins] (
    [LoginProvider] nvarchar(450) NOT NULL,
    [ProviderKey] nvarchar(450) NOT NULL,
    [ProviderDisplayName] nvarchar(max) NULL,
    [UserId] nvarchar(450) NOT NULL,
    CONSTRAINT [PK_AspNetUserLogins] PRIMARY KEY ([LoginProvider], [ProviderKey]),
    CONSTRAINT [FK_AspNetUserLogins_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [AspNetUserRoles] (
    [UserId] nvarchar(450) NOT NULL,
    [RoleId] nvarchar(450) NOT NULL,
    CONSTRAINT [PK_AspNetUserRoles] PRIMARY KEY ([UserId], [RoleId]),
    CONSTRAINT [FK_AspNetUserRoles_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_AspNetUserRoles_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [AspNetUserTokens] (
    [UserId] nvarchar(450) NOT NULL,
    [LoginProvider] nvarchar(450) NOT NULL,
    [Name] nvarchar(450) NOT NULL,
    [Value] nvarchar(max) NULL,
    CONSTRAINT [PK_AspNetUserTokens] PRIMARY KEY ([UserId], [LoginProvider], [Name]),
    CONSTRAINT [FK_AspNetUserTokens_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [Badges] (
    [Id] int NOT NULL IDENTITY,
    [Name] nvarchar(max) NOT NULL,
    [Description] nvarchar(max) NULL,
    [AwardedAt] datetime2 NOT NULL,
    [UserId] nvarchar(450) NULL,
    CONSTRAINT [PK_Badges] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Badges_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id])
);

CREATE TABLE [Courses] (
    [Id] nvarchar(450) NOT NULL,
    [Title] nvarchar(250) NOT NULL,
    [Description] nvarchar(max) NULL,
    [ShortDescription] nvarchar(max) NULL,
    [Category] nvarchar(max) NULL,
    [Tags] nvarchar(max) NULL,
    [CertificateEnabled] bit NOT NULL,
    [BannerUrl] nvarchar(max) NULL,
    [Status] nvarchar(max) NOT NULL,
    [UpdatedAt] datetime2 NULL,
    [OrganisationId] bigint NOT NULL,
    [CreatedByUserId] nvarchar(450) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_Courses] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Courses_AspNetUsers_CreatedByUserId] FOREIGN KEY ([CreatedByUserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Courses_Organisations_OrganisationId] FOREIGN KEY ([OrganisationId]) REFERENCES [Organisations] ([Id]) ON DELETE NO ACTION
);

CREATE TABLE [LearningGroups] (
    [Id] bigint NOT NULL IDENTITY,
    [Name] nvarchar(200) NOT NULL,
    [Description] nvarchar(max) NULL,
    [OrganisationId] bigint NOT NULL,
    [CreatedByUserId] nvarchar(450) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_LearningGroups] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_LearningGroups_AspNetUsers_CreatedByUserId] FOREIGN KEY ([CreatedByUserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LearningGroups_Organisations_OrganisationId] FOREIGN KEY ([OrganisationId]) REFERENCES [Organisations] ([Id]) ON DELETE NO ACTION
);

CREATE TABLE [LoginLinkTokens] (
    [Id] uniqueidentifier NOT NULL,
    [UserId] nvarchar(max) NOT NULL,
    [TokenHash] nvarchar(max) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [ExpiresAt] datetime2 NOT NULL,
    [UsedAt] datetime2 NULL,
    [SentAt] datetime2 NULL,
    [SendFailedCount] int NOT NULL,
    [LastSendError] nvarchar(max) NULL,
    [ApplicationUserId] nvarchar(450) NULL,
    CONSTRAINT [PK_LoginLinkTokens] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_LoginLinkTokens_AspNetUsers_ApplicationUserId] FOREIGN KEY ([ApplicationUserId]) REFERENCES [AspNetUsers] ([Id])
);

CREATE TABLE [UserUserRole] (
    [Id] int NOT NULL IDENTITY,
    [UserId] nvarchar(450) NOT NULL,
    [RoleId] int NOT NULL,
    [AssignedAt] datetime2 NOT NULL,
    [AssignedBy] nvarchar(max) NOT NULL,
    CONSTRAINT [PK_UserUserRole] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_UserUserRole_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_UserUserRole_UserRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [UserRoles] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [Feedbacks] (
    [Id] int NOT NULL IDENTITY,
    [UserId] nvarchar(450) NOT NULL,
    [CourseId] nvarchar(450) NULL,
    [Comment] nvarchar(max) NOT NULL,
    [Rating] int NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_Feedbacks] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Feedbacks_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_Feedbacks_Courses_CourseId] FOREIGN KEY ([CourseId]) REFERENCES [Courses] ([Id])
);

CREATE TABLE [Lessons] (
    [Id] bigint NOT NULL IDENTITY,
    [CourseId] nvarchar(450) NOT NULL,
    [Title] nvarchar(500) NOT NULL,
    [Content] nvarchar(max) NULL,
    [Ordinal] int NOT NULL,
    [CreatedByUserId] nvarchar(450) NOT NULL,
    [CreatedAt] datetime2 NOT NULL DEFAULT (GETUTCDATE()),
    CONSTRAINT [PK_Lessons] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Lessons_AspNetUsers_CreatedByUserId] FOREIGN KEY ([CreatedByUserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Lessons_Courses_CourseId] FOREIGN KEY ([CourseId]) REFERENCES [Courses] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [CourseAssignments] (
    [Id] int NOT NULL IDENTITY,
    [CourseId] nvarchar(450) NOT NULL,
    [LearningGroupId] bigint NOT NULL,
    [AssignedByUserId] nvarchar(450) NOT NULL,
    [AssignedAt] datetime2 NOT NULL,
    [DueDate] datetime2 NULL,
    [ApplicationUserId] nvarchar(450) NULL,
    CONSTRAINT [PK_CourseAssignments] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_CourseAssignments_AspNetUsers_ApplicationUserId] FOREIGN KEY ([ApplicationUserId]) REFERENCES [AspNetUsers] ([Id]),
    CONSTRAINT [FK_CourseAssignments_AspNetUsers_AssignedByUserId] FOREIGN KEY ([AssignedByUserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_CourseAssignments_Courses_CourseId] FOREIGN KEY ([CourseId]) REFERENCES [Courses] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_CourseAssignments_LearningGroups_LearningGroupId] FOREIGN KEY ([LearningGroupId]) REFERENCES [LearningGroups] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [GroupCourses] (
    [Id] int NOT NULL IDENTITY,
    [LearningGroupId] bigint NOT NULL,
    [CourseId] nvarchar(450) NOT NULL,
    [AssignedAt] datetime2 NOT NULL,
    [ExpiresAt] datetime2 NULL,
    CONSTRAINT [PK_GroupCourses] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_GroupCourses_Courses_CourseId] FOREIGN KEY ([CourseId]) REFERENCES [Courses] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_GroupCourses_LearningGroups_LearningGroupId] FOREIGN KEY ([LearningGroupId]) REFERENCES [LearningGroups] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [LearnerGroups] (
    [Id] int NOT NULL IDENTITY,
    [UserId] nvarchar(450) NOT NULL,
    [LearningGroupId] bigint NOT NULL,
    [JoinedAt] datetime2 NOT NULL,
    [IsActive] bit NOT NULL,
    CONSTRAINT [PK_LearnerGroups] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_LearnerGroups_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_LearnerGroups_LearningGroups_LearningGroupId] FOREIGN KEY ([LearningGroupId]) REFERENCES [LearningGroups] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [LearnerProgresses] (
    [Id] int NOT NULL IDENTITY,
    [UserId] nvarchar(450) NOT NULL,
    [CourseId] nvarchar(450) NULL,
    [LessonId] bigint NULL,
    [ProgressPercent] int NOT NULL,
    [Completed] bit NOT NULL,
    [CompletedAt] datetime2 NULL,
    CONSTRAINT [PK_LearnerProgresses] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_LearnerProgresses_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_LearnerProgresses_Courses_CourseId] FOREIGN KEY ([CourseId]) REFERENCES [Courses] ([Id]),
    CONSTRAINT [FK_LearnerProgresses_Lessons_LessonId] FOREIGN KEY ([LessonId]) REFERENCES [Lessons] ([Id])
);

CREATE INDEX [IX_AspNetRoleClaims_RoleId] ON [AspNetRoleClaims] ([RoleId]);

CREATE UNIQUE INDEX [RoleNameIndex] ON [AspNetRoles] ([NormalizedName]) WHERE [NormalizedName] IS NOT NULL;

CREATE INDEX [IX_AspNetUserClaims_UserId] ON [AspNetUserClaims] ([UserId]);

CREATE INDEX [IX_AspNetUserLogins_UserId] ON [AspNetUserLogins] ([UserId]);

CREATE INDEX [IX_AspNetUserRoles_RoleId] ON [AspNetUserRoles] ([RoleId]);

CREATE INDEX [EmailIndex] ON [AspNetUsers] ([NormalizedEmail]);

CREATE INDEX [IX_AspNetUsers_OrganisationID] ON [AspNetUsers] ([OrganisationID]);

CREATE UNIQUE INDEX [UserNameIndex] ON [AspNetUsers] ([NormalizedUserName]) WHERE [NormalizedUserName] IS NOT NULL;

CREATE INDEX [IX_Badges_UserId] ON [Badges] ([UserId]);

CREATE INDEX [IX_CourseAssignments_ApplicationUserId] ON [CourseAssignments] ([ApplicationUserId]);

CREATE INDEX [IX_CourseAssignments_AssignedByUserId] ON [CourseAssignments] ([AssignedByUserId]);

CREATE INDEX [IX_CourseAssignments_CourseId] ON [CourseAssignments] ([CourseId]);

CREATE INDEX [IX_CourseAssignments_LearningGroupId] ON [CourseAssignments] ([LearningGroupId]);

CREATE INDEX [IX_Courses_CreatedByUserId] ON [Courses] ([CreatedByUserId]);

CREATE UNIQUE INDEX [UX_Course_OrganisationId_Title] ON [Courses] ([OrganisationId], [Title]);

CREATE INDEX [IX_Feedbacks_CourseId] ON [Feedbacks] ([CourseId]);

CREATE INDEX [IX_Feedbacks_UserId] ON [Feedbacks] ([UserId]);

CREATE INDEX [IX_GroupCourses_CourseId] ON [GroupCourses] ([CourseId]);

CREATE INDEX [IX_GroupCourses_LearningGroupId] ON [GroupCourses] ([LearningGroupId]);

CREATE INDEX [IX_LearnerGroups_LearningGroupId] ON [LearnerGroups] ([LearningGroupId]);

CREATE INDEX [IX_LearnerGroups_UserId] ON [LearnerGroups] ([UserId]);

CREATE INDEX [IX_LearnerProgresses_CourseId] ON [LearnerProgresses] ([CourseId]);

CREATE INDEX [IX_LearnerProgresses_LessonId] ON [LearnerProgresses] ([LessonId]);

CREATE INDEX [IX_LearnerProgresses_UserId] ON [LearnerProgresses] ([UserId]);

CREATE INDEX [IX_LearningGroups_CreatedByUserId] ON [LearningGroups] ([CreatedByUserId]);

CREATE INDEX [IX_LearningGroups_OrganisationId] ON [LearningGroups] ([OrganisationId]);

CREATE INDEX [IX_Lessons_CourseId] ON [Lessons] ([CourseId]);

CREATE INDEX [IX_Lessons_CreatedByUserId] ON [Lessons] ([CreatedByUserId]);

CREATE INDEX [IX_LoginLinkTokens_ApplicationUserId] ON [LoginLinkTokens] ([ApplicationUserId]);

CREATE INDEX [IX_RevokedTokens_ExpiresAt] ON [RevokedTokens] ([ExpiresAt]);

CREATE INDEX [IX_UserUserRole_RoleId] ON [UserUserRole] ([RoleId]);

CREATE INDEX [IX_UserUserRole_UserId] ON [UserUserRole] ([UserId]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251102142041_Initial', N'9.0.10');

CREATE TABLE [LearningPathways] (
    [Id] nvarchar(450) NOT NULL,
    [Title] nvarchar(250) NOT NULL,
    [Description] nvarchar(max) NULL,
    [ShortDescription] nvarchar(max) NULL,
    [Category] nvarchar(max) NULL,
    [Tags] nvarchar(max) NULL,
    [IsActive] bit NOT NULL DEFAULT CAST(1 AS bit),
    [BannerUrl] nvarchar(max) NULL,
    [EstimatedDurationHours] int NOT NULL,
    [DifficultyLevel] nvarchar(max) NOT NULL DEFAULT N'Beginner',
    [OrganisationId] bigint NOT NULL,
    [CreatedByUserId] nvarchar(450) NOT NULL,
    [CreatedAt] datetime2 NOT NULL DEFAULT (GETUTCDATE()),
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_LearningPathways] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_LearningPathways_AspNetUsers_CreatedByUserId] FOREIGN KEY ([CreatedByUserId]) REFERENCES [AspNetUsers] ([Id]),
    CONSTRAINT [FK_LearningPathways_Organisations_OrganisationId] FOREIGN KEY ([OrganisationId]) REFERENCES [Organisations] ([Id])
);

CREATE TABLE [LearnerPathwayProgresses] (
    [Id] int NOT NULL IDENTITY,
    [UserId] nvarchar(450) NOT NULL,
    [LearningPathwayId] nvarchar(450) NOT NULL,
    [CompletedCourses] int NOT NULL DEFAULT 0,
    [TotalCourses] int NOT NULL DEFAULT 0,
    [ProgressPercent] int NOT NULL DEFAULT 0,
    [IsCompleted] bit NOT NULL DEFAULT CAST(0 AS bit),
    [CompletedAt] datetime2 NULL,
    [EnrolledAt] datetime2 NOT NULL DEFAULT (GETUTCDATE()),
    [LastAccessedAt] datetime2 NULL,
    [CurrentCourseId] nvarchar(450) NULL,
    CONSTRAINT [PK_LearnerPathwayProgresses] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_LearnerPathwayProgresses_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_LearnerPathwayProgresses_Courses_CurrentCourseId] FOREIGN KEY ([CurrentCourseId]) REFERENCES [Courses] ([Id]) ON DELETE SET NULL,
    CONSTRAINT [FK_LearnerPathwayProgresses_LearningPathways_LearningPathwayId] FOREIGN KEY ([LearningPathwayId]) REFERENCES [LearningPathways] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [PathwayCourses] (
    [Id] int NOT NULL IDENTITY,
    [LearningPathwayId] nvarchar(450) NOT NULL,
    [CourseId] nvarchar(450) NOT NULL,
    [SequenceOrder] int NOT NULL,
    [IsMandatory] bit NOT NULL DEFAULT CAST(1 AS bit),
    [PrerequisiteCourseIds] nvarchar(max) NULL,
    [AddedAt] datetime2 NOT NULL DEFAULT (GETUTCDATE()),
    CONSTRAINT [PK_PathwayCourses] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_PathwayCourses_Courses_CourseId] FOREIGN KEY ([CourseId]) REFERENCES [Courses] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_PathwayCourses_LearningPathways_LearningPathwayId] FOREIGN KEY ([LearningPathwayId]) REFERENCES [LearningPathways] ([Id]) ON DELETE CASCADE
);

CREATE INDEX [IX_LearnerPathwayProgresses_CurrentCourseId] ON [LearnerPathwayProgresses] ([CurrentCourseId]);

CREATE INDEX [IX_LearnerPathwayProgresses_EnrolledAt] ON [LearnerPathwayProgresses] ([EnrolledAt]);

CREATE INDEX [IX_LearnerPathwayProgresses_LearningPathwayId] ON [LearnerPathwayProgresses] ([LearningPathwayId]);

CREATE INDEX [IX_LearnerPathwayProgresses_UserId] ON [LearnerPathwayProgresses] ([UserId]);

CREATE UNIQUE INDEX [IX_LearnerPathwayProgresses_UserId_LearningPathwayId] ON [LearnerPathwayProgresses] ([UserId], [LearningPathwayId]);

CREATE INDEX [IX_LearningPathways_CreatedAt] ON [LearningPathways] ([CreatedAt]);

CREATE INDEX [IX_LearningPathways_CreatedByUserId] ON [LearningPathways] ([CreatedByUserId]);

CREATE INDEX [IX_LearningPathways_OrganisationId] ON [LearningPathways] ([OrganisationId]);

CREATE INDEX [IX_LearningPathways_OrganisationId_IsActive] ON [LearningPathways] ([OrganisationId], [IsActive]);

CREATE INDEX [IX_PathwayCourses_CourseId] ON [PathwayCourses] ([CourseId]);

CREATE INDEX [IX_PathwayCourses_LearningPathwayId] ON [PathwayCourses] ([LearningPathwayId]);

CREATE UNIQUE INDEX [IX_PathwayCourses_LearningPathwayId_CourseId] ON [PathwayCourses] ([LearningPathwayId], [CourseId]);

CREATE INDEX [IX_PathwayCourses_LearningPathwayId_SequenceOrder] ON [PathwayCourses] ([LearningPathwayId], [SequenceOrder]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251102144658_AddLearningPathways', N'9.0.10');

CREATE TABLE [Quizzes] (
    [Id] nvarchar(450) NOT NULL,
    [Title] nvarchar(max) NOT NULL,
    [Description] nvarchar(max) NULL,
    [PassingScore] int NOT NULL,
    [IsTimed] bit NOT NULL,
    [TimeLimit] int NOT NULL,
    [ShuffleQuestions] bit NOT NULL,
    [ShuffleAnswers] bit NOT NULL,
    [ShowResults] bit NOT NULL,
    [AllowRetake] bit NOT NULL,
    [MaxAttempts] int NOT NULL,
    [CourseId] nvarchar(450) NOT NULL,
    [CreatedByUserId] nvarchar(450) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_Quizzes] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Quizzes_AspNetUsers_CreatedByUserId] FOREIGN KEY ([CreatedByUserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_Quizzes_Courses_CourseId] FOREIGN KEY ([CourseId]) REFERENCES [Courses] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [QuizQuestions] (
    [Id] bigint NOT NULL IDENTITY,
    [Question] nvarchar(max) NOT NULL,
    [Type] nvarchar(max) NOT NULL,
    [Points] int NOT NULL,
    [Explanation] nvarchar(max) NULL,
    [QuizId] nvarchar(450) NOT NULL,
    [Order] int NOT NULL,
    CONSTRAINT [PK_QuizQuestions] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_QuizQuestions_Quizzes_QuizId] FOREIGN KEY ([QuizId]) REFERENCES [Quizzes] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [QuizQuestionOptions] (
    [Id] bigint NOT NULL IDENTITY,
    [Text] nvarchar(max) NOT NULL,
    [IsCorrect] bit NOT NULL,
    [QuizQuestionId] bigint NOT NULL,
    [Order] int NOT NULL,
    CONSTRAINT [PK_QuizQuestionOptions] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_QuizQuestionOptions_QuizQuestions_QuizQuestionId] FOREIGN KEY ([QuizQuestionId]) REFERENCES [QuizQuestions] ([Id]) ON DELETE CASCADE
);

CREATE INDEX [IX_QuizQuestionOptions_QuizQuestionId] ON [QuizQuestionOptions] ([QuizQuestionId]);

CREATE INDEX [IX_QuizQuestions_QuizId] ON [QuizQuestions] ([QuizId]);

CREATE INDEX [IX_Quizzes_CourseId] ON [Quizzes] ([CourseId]);

CREATE INDEX [IX_Quizzes_CreatedByUserId] ON [Quizzes] ([CreatedByUserId]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251103110715_AddQuizzes', N'9.0.10');

ALTER TABLE [Lessons] ADD [DocumentUrl] nvarchar(max) NULL;

ALTER TABLE [Lessons] ADD [IsOptional] bit NOT NULL DEFAULT CAST(0 AS bit);

ALTER TABLE [Lessons] ADD [QuizId] nvarchar(450) NULL;

ALTER TABLE [Lessons] ADD [ScormEntryUrl] nvarchar(max) NULL;

ALTER TABLE [Lessons] ADD [ScormUrl] nvarchar(max) NULL;

ALTER TABLE [Lessons] ADD [Type] nvarchar(max) NOT NULL DEFAULT N'';

ALTER TABLE [Lessons] ADD [VideoDurationSeconds] int NULL;

ALTER TABLE [Lessons] ADD [VideoUrl] nvarchar(max) NULL;

CREATE INDEX [IX_Lessons_QuizId] ON [Lessons] ([QuizId]);

ALTER TABLE [Lessons] ADD CONSTRAINT [FK_Lessons_Quizzes_QuizId] FOREIGN KEY ([QuizId]) REFERENCES [Quizzes] ([Id]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251104065804_AddLessonTypeAndFields', N'9.0.10');

ALTER TABLE [LearnerProgresses] ADD [VideoTimestamp] int NULL;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251105104651_AddVideoTimestampToLearnerProgress', N'9.0.10');

ALTER TABLE [LearnerProgresses] ADD [LastAccessedAt] datetime2 NULL;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251105105907_AddLastAccessedToLearnerProgress', N'9.0.10');

ALTER TABLE [LearnerProgresses] ADD [SessionStartTime] datetime2 NULL;

ALTER TABLE [LearnerProgresses] ADD [TotalTimeSpentSeconds] int NOT NULL DEFAULT 0;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251105110510_AddTimeTrackingToLearnerProgress', N'9.0.10');

ALTER TABLE [Courses] ADD [DeletedAt] datetime2 NULL;

ALTER TABLE [Courses] ADD [DeletedByUserId] nvarchar(450) NULL;

ALTER TABLE [Courses] ADD [IsDeleted] bit NOT NULL DEFAULT CAST(0 AS bit);

CREATE INDEX [IX_Courses_DeletedByUserId] ON [Courses] ([DeletedByUserId]);

ALTER TABLE [Courses] ADD CONSTRAINT [FK_Courses_AspNetUsers_DeletedByUserId] FOREIGN KEY ([DeletedByUserId]) REFERENCES [AspNetUsers] ([Id]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251106064352_AddCourseSoftDelete', N'9.0.10');

ALTER TABLE [AspNetUsers] DROP CONSTRAINT [FK_AspNetUsers_Organisations_OrganisationID];

ALTER TABLE [Organisations] ADD [AllocatedStorageGB] bigint NOT NULL DEFAULT CAST(0 AS bigint);

ALTER TABLE [Organisations] ADD [BannerUrl] nvarchar(max) NULL;

ALTER TABLE [Organisations] ADD [CreatedBy] nvarchar(max) NOT NULL DEFAULT N'';

ALTER TABLE [Organisations] ADD [CreatedOn] datetime2 NOT NULL DEFAULT '0001-01-01T00:00:00.0000000';

ALTER TABLE [Organisations] ADD [Domain] nvarchar(max) NULL;

ALTER TABLE [Organisations] ADD [FaviconUrl] nvarchar(max) NULL;

ALTER TABLE [Organisations] ADD [FromEmail] nvarchar(max) NULL;

ALTER TABLE [Organisations] ADD [FromName] nvarchar(max) NULL;

ALTER TABLE [Organisations] ADD [IsActive] bit NOT NULL DEFAULT CAST(0 AS bit);

ALTER TABLE [Organisations] ADD [ManagerEmail] nvarchar(max) NULL;

ALTER TABLE [Organisations] ADD [ManagerName] nvarchar(max) NULL;

ALTER TABLE [Organisations] ADD [ManagerPhone] nvarchar(max) NULL;

ALTER TABLE [Organisations] ADD [MaxUsers] int NOT NULL DEFAULT 0;

ALTER TABLE [Organisations] ADD [RenewalDate] datetime2 NULL;

ALTER TABLE [Organisations] ADD [SendGridApiKey] nvarchar(max) NULL;

ALTER TABLE [Organisations] ADD [SmtpHost] nvarchar(max) NULL;

ALTER TABLE [Organisations] ADD [SmtpPassword] nvarchar(max) NULL;

ALTER TABLE [Organisations] ADD [SmtpPort] int NULL;

ALTER TABLE [Organisations] ADD [SmtpUseSsl] bit NOT NULL DEFAULT CAST(0 AS bit);

ALTER TABLE [Organisations] ADD [SmtpUsername] nvarchar(max) NULL;

ALTER TABLE [Organisations] ADD [SupportEmail] nvarchar(max) NULL;

ALTER TABLE [Organisations] ADD [ThemeSettings] nvarchar(max) NULL;

ALTER TABLE [Organisations] ADD [UpdatedBy] nvarchar(max) NULL;

ALTER TABLE [Organisations] ADD [UpdatedOn] datetime2 NULL;

DECLARE @var sysname;
SELECT @var = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[AspNetUsers]') AND [c].[name] = N'OrganisationID');
IF @var IS NOT NULL EXEC(N'ALTER TABLE [AspNetUsers] DROP CONSTRAINT [' + @var + '];');
ALTER TABLE [AspNetUsers] ALTER COLUMN [OrganisationID] bigint NULL;

CREATE TABLE [GlobalLibraryContents] (
    [Id] bigint NOT NULL IDENTITY,
    [Title] nvarchar(max) NOT NULL,
    [Description] nvarchar(max) NULL,
    [ContentType] nvarchar(max) NOT NULL,
    [AzureBlobPath] nvarchar(max) NOT NULL,
    [FileName] nvarchar(max) NULL,
    [FileSizeBytes] bigint NOT NULL,
    [MimeType] nvarchar(max) NULL,
    [UploadedOn] datetime2 NOT NULL,
    [UploadedBy] nvarchar(max) NOT NULL,
    [IsActive] bit NOT NULL,
    [UpdatedOn] datetime2 NULL,
    [UpdatedBy] nvarchar(max) NULL,
    [Tags] nvarchar(max) NULL,
    CONSTRAINT [PK_GlobalLibraryContents] PRIMARY KEY ([Id])
);

ALTER TABLE [AspNetUsers] ADD CONSTRAINT [FK_AspNetUsers_Organisations_OrganisationID] FOREIGN KEY ([OrganisationID]) REFERENCES [Organisations] ([Id]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251107072141_AddSuperAdminAndOrganisationEnhancements', N'9.0.10');


                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns 
                    WHERE object_id = OBJECT_ID('Organisations') 
                    AND name = 'BrandName'
                )
                BEGIN
                    ALTER TABLE Organisations ADD BrandName nvarchar(max) NULL
                END
            

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251121143628_SyncModelSnapshot', N'9.0.10');

ALTER TABLE [LearnerProgresses] ADD [CertificateUrl] nvarchar(max) NULL;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251124084223_AddCertificateUrlToLearnerProgress', N'9.0.10');

ALTER TABLE [LearnerProgresses] ADD [CertificateId] nvarchar(max) NULL;

ALTER TABLE [LearnerProgresses] ADD [CertificateIssuedAt] datetime2 NULL;

ALTER TABLE [LearnerProgresses] ADD [CertificateIssuedBy] nvarchar(max) NULL;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251124084641_AddCertificateTrackingFields', N'9.0.10');


                IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LearnerProgresses_UserId' AND object_id = OBJECT_ID('LearnerProgresses'))
                BEGIN
                    DROP INDEX [IX_LearnerProgresses_UserId] ON [LearnerProgresses];
                END
            

DECLARE @var1 sysname;
SELECT @var1 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[LearnerProgresses]') AND [c].[name] = N'CertificateId');
IF @var1 IS NOT NULL EXEC(N'ALTER TABLE [LearnerProgresses] DROP CONSTRAINT [' + @var1 + '];');
ALTER TABLE [LearnerProgresses] ALTER COLUMN [CertificateId] nvarchar(450) NULL;

CREATE INDEX [IX_LearnerProgresses_CertificateId] ON [LearnerProgresses] ([CertificateId]);

CREATE INDEX [IX_LearnerProgresses_CertificateIssuedAt] ON [LearnerProgresses] ([CertificateIssuedAt]);

CREATE UNIQUE INDEX [IX_LearnerProgresses_UserId_CourseId_LessonId] ON [LearnerProgresses] ([UserId], [CourseId], [LessonId]) WHERE [CourseId] IS NOT NULL AND [LessonId] IS NOT NULL;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251124091340_AddUniqueLearnerProgressConstraint', N'9.0.10');

ALTER TABLE [LearnerProgresses] ADD [PostSurveyCompleted] bit NOT NULL DEFAULT CAST(0 AS bit);

ALTER TABLE [LearnerProgresses] ADD [PostSurveyCompletedAt] datetime2 NULL;

ALTER TABLE [LearnerProgresses] ADD [PostSurveyResponseId] bigint NULL;

ALTER TABLE [LearnerProgresses] ADD [PreSurveyCompleted] bit NOT NULL DEFAULT CAST(0 AS bit);

ALTER TABLE [LearnerProgresses] ADD [PreSurveyCompletedAt] datetime2 NULL;

ALTER TABLE [LearnerProgresses] ADD [PreSurveyResponseId] bigint NULL;

ALTER TABLE [Courses] ADD [IsPostSurveyMandatory] bit NOT NULL DEFAULT CAST(0 AS bit);

ALTER TABLE [Courses] ADD [IsPreSurveyMandatory] bit NOT NULL DEFAULT CAST(0 AS bit);

ALTER TABLE [Courses] ADD [PostCourseSurveyId] bigint NULL;

ALTER TABLE [Courses] ADD [PreCourseSurveyId] bigint NULL;

CREATE TABLE [Surveys] (
    [Id] bigint NOT NULL IDENTITY,
    [Title] nvarchar(max) NOT NULL,
    [Description] nvarchar(max) NULL,
    [SurveyType] nvarchar(max) NOT NULL,
    [OrganisationId] bigint NOT NULL,
    [CreatedByUserId] nvarchar(450) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    [IsActive] bit NOT NULL,
    [IsDeleted] bit NOT NULL,
    [DeletedAt] datetime2 NULL,
    CONSTRAINT [PK_Surveys] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Surveys_AspNetUsers_CreatedByUserId] FOREIGN KEY ([CreatedByUserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Surveys_Organisations_OrganisationId] FOREIGN KEY ([OrganisationId]) REFERENCES [Organisations] ([Id]) ON DELETE NO ACTION
);

CREATE TABLE [SurveyQuestions] (
    [Id] bigint NOT NULL IDENTITY,
    [SurveyId] bigint NOT NULL,
    [QuestionText] nvarchar(max) NOT NULL,
    [QuestionType] nvarchar(max) NOT NULL,
    [Options] nvarchar(max) NULL,
    [OrderIndex] int NOT NULL,
    [IsRequired] bit NOT NULL,
    [MinRating] int NULL,
    [MaxRating] int NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_SurveyQuestions] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_SurveyQuestions_Surveys_SurveyId] FOREIGN KEY ([SurveyId]) REFERENCES [Surveys] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [SurveyResponses] (
    [Id] bigint NOT NULL IDENTITY,
    [SurveyId] bigint NOT NULL,
    [UserId] nvarchar(450) NOT NULL,
    [CourseId] nvarchar(450) NULL,
    [SubmittedAt] datetime2 NOT NULL,
    [SurveyType] nvarchar(max) NOT NULL,
    CONSTRAINT [PK_SurveyResponses] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_SurveyResponses_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_SurveyResponses_Courses_CourseId] FOREIGN KEY ([CourseId]) REFERENCES [Courses] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_SurveyResponses_Surveys_SurveyId] FOREIGN KEY ([SurveyId]) REFERENCES [Surveys] ([Id]) ON DELETE NO ACTION
);

CREATE TABLE [SurveyQuestionResponses] (
    [Id] bigint NOT NULL IDENTITY,
    [SurveyResponseId] bigint NOT NULL,
    [SurveyQuestionId] bigint NOT NULL,
    [AnswerText] nvarchar(max) NULL,
    [SelectedOptions] nvarchar(max) NULL,
    [RatingValue] int NULL,
    [AnsweredAt] datetime2 NOT NULL,
    CONSTRAINT [PK_SurveyQuestionResponses] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_SurveyQuestionResponses_SurveyQuestions_SurveyQuestionId] FOREIGN KEY ([SurveyQuestionId]) REFERENCES [SurveyQuestions] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_SurveyQuestionResponses_SurveyResponses_SurveyResponseId] FOREIGN KEY ([SurveyResponseId]) REFERENCES [SurveyResponses] ([Id]) ON DELETE CASCADE
);

CREATE INDEX [IX_Courses_PostCourseSurveyId] ON [Courses] ([PostCourseSurveyId]);

CREATE INDEX [IX_Courses_PreCourseSurveyId] ON [Courses] ([PreCourseSurveyId]);

CREATE INDEX [IX_SurveyQuestionResponses_SurveyQuestionId] ON [SurveyQuestionResponses] ([SurveyQuestionId]);

CREATE INDEX [IX_SurveyQuestionResponses_SurveyResponseId] ON [SurveyQuestionResponses] ([SurveyResponseId]);

CREATE INDEX [IX_SurveyQuestions_SurveyId] ON [SurveyQuestions] ([SurveyId]);

CREATE INDEX [IX_SurveyResponses_CourseId] ON [SurveyResponses] ([CourseId]);

CREATE INDEX [IX_SurveyResponses_SurveyId] ON [SurveyResponses] ([SurveyId]);

CREATE INDEX [IX_SurveyResponses_UserId] ON [SurveyResponses] ([UserId]);

CREATE INDEX [IX_Surveys_CreatedByUserId] ON [Surveys] ([CreatedByUserId]);

CREATE INDEX [IX_Surveys_OrganisationId] ON [Surveys] ([OrganisationId]);

ALTER TABLE [Courses] ADD CONSTRAINT [FK_Courses_Surveys_PostCourseSurveyId] FOREIGN KEY ([PostCourseSurveyId]) REFERENCES [Surveys] ([Id]);

ALTER TABLE [Courses] ADD CONSTRAINT [FK_Courses_Surveys_PreCourseSurveyId] FOREIGN KEY ([PreCourseSurveyId]) REFERENCES [Surveys] ([Id]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251126043452_AddSurveySystem', N'9.0.10');

ALTER TABLE [Surveys] ADD [Status] nvarchar(max) NOT NULL DEFAULT N'';

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251126051644_AddStatusToSurvey', N'9.0.10');

DECLARE @var2 sysname;
SELECT @var2 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Surveys]') AND [c].[name] = N'SurveyType');
IF @var2 IS NOT NULL EXEC(N'ALTER TABLE [Surveys] DROP CONSTRAINT [' + @var2 + '];');
ALTER TABLE [Surveys] DROP COLUMN [SurveyType];

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251126053558_RemoveSurveyType', N'9.0.10');

ALTER TABLE [Courses] DROP CONSTRAINT [FK_Courses_Surveys_PostCourseSurveyId];

ALTER TABLE [Courses] DROP CONSTRAINT [FK_Courses_Surveys_PreCourseSurveyId];

ALTER TABLE [Courses] ADD CONSTRAINT [FK_Courses_Surveys_PostCourseSurveyId] FOREIGN KEY ([PostCourseSurveyId]) REFERENCES [Surveys] ([Id]) ON DELETE NO ACTION;

ALTER TABLE [Courses] ADD CONSTRAINT [FK_Courses_Surveys_PreCourseSurveyId] FOREIGN KEY ([PreCourseSurveyId]) REFERENCES [Surveys] ([Id]) ON DELETE NO ACTION;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251129014319_ConfigureSurveyForeignKeys', N'9.0.10');

ALTER TABLE [LearnerProgresses] ADD [ScormData] nvarchar(max) NULL;

ALTER TABLE [LearnerProgresses] ADD [ScormLessonLocation] nvarchar(max) NULL;

ALTER TABLE [LearnerProgresses] ADD [ScormLessonStatus] nvarchar(max) NULL;

ALTER TABLE [LearnerProgresses] ADD [ScormScore] nvarchar(max) NULL;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251129024608_AddScormTrackingFields', N'9.0.10');

ALTER TABLE [LearnerProgresses] ADD [StartedAt] datetime2 NULL;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251129030154_AddStartedAtToLearnerProgress', N'9.0.10');

ALTER TABLE [LearnerProgresses] ADD [RowVersion] rowversion NULL;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251129062431_AddRowVersionToLearnerProgress', N'9.0.10');

ALTER TABLE [Lessons] ADD [HtmlContent] nvarchar(max) NULL;

ALTER TABLE [Lessons] ADD [HtmlUrl] nvarchar(max) NULL;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251201065041_AddHtmlLessonType', N'9.0.10');

ALTER TABLE [GlobalLibraryContents] ADD [Category] nvarchar(max) NULL;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251202094821_AddCategoryToGlobalLibraryContent', N'9.0.10');

ALTER TABLE [GlobalLibraryContents] ADD [DurationSeconds] int NULL;

ALTER TABLE [GlobalLibraryContents] ADD [ThumbnailUrl] nvarchar(max) NULL;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251203052223_AddDurationAndThumbnailToGlobalLibraryContent', N'9.0.10');

EXEC sp_rename N'[Lessons].[VideoDurationSeconds]', N'DurationSeconds', 'COLUMN';

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251203054259_RenameVideoDurationToLessonDuration', N'9.0.10');

ALTER TABLE [Organisations] ADD [StorageKey] nvarchar(12) NOT NULL DEFAULT N'';


                UPDATE Organisations 
                SET StorageKey = SUBSTRING(LOWER(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', '')), 1, 12)
                WHERE StorageKey = '' OR StorageKey IS NULL
            

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251203132739_AddStorageKeyToOrganisation', N'9.0.10');

ALTER TABLE [Organisations] ADD [BrandingStorageUsedBytes] bigint NOT NULL DEFAULT CAST(0 AS bigint);

ALTER TABLE [Organisations] ADD [ContentStorageUsedBytes] bigint NOT NULL DEFAULT CAST(0 AS bigint);

ALTER TABLE [Organisations] ADD [StorageLastCalculated] datetime2 NULL;

ALTER TABLE [Organisations] ADD [StorageUsedBytes] bigint NOT NULL DEFAULT CAST(0 AS bigint);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251207103557_AddStorageTrackingFields', N'9.0.10');

CREATE TABLE [CourseCategories] (
    [Id] bigint NOT NULL IDENTITY,
    [Name] nvarchar(100) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [CreatedByUserId] nvarchar(max) NULL,
    CONSTRAINT [PK_CourseCategories] PRIMARY KEY ([Id])
);

CREATE UNIQUE INDEX [IX_CourseCategories_Name] ON [CourseCategories] ([Name]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251208135942_AddCourseCategoryTable', N'9.0.10');

CREATE TABLE [UserEngagements] (
    [Id] bigint NOT NULL IDENTITY,
    [UserId] nvarchar(450) NOT NULL,
    [OrganisationId] bigint NOT NULL,
    [EventType] nvarchar(50) NOT NULL,
    [CourseId] nvarchar(450) NULL,
    [LessonId] bigint NULL,
    [QuizId] bigint NULL,
    [PathwayId] bigint NULL,
    [Metadata] nvarchar(2000) NULL,
    [CreatedAt] datetime2 NOT NULL DEFAULT (GETUTCDATE()),
    [DurationSeconds] int NULL,
    CONSTRAINT [PK_UserEngagements] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_UserEngagements_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_UserEngagements_Courses_CourseId] FOREIGN KEY ([CourseId]) REFERENCES [Courses] ([Id]),
    CONSTRAINT [FK_UserEngagements_Lessons_LessonId] FOREIGN KEY ([LessonId]) REFERENCES [Lessons] ([Id]),
    CONSTRAINT [FK_UserEngagements_Organisations_OrganisationId] FOREIGN KEY ([OrganisationId]) REFERENCES [Organisations] ([Id]) ON DELETE CASCADE
);

CREATE INDEX [IX_UserEngagements_CourseId] ON [UserEngagements] ([CourseId]);

CREATE INDEX [IX_UserEngagements_EventType] ON [UserEngagements] ([EventType]);

CREATE INDEX [IX_UserEngagements_LessonId] ON [UserEngagements] ([LessonId]);

CREATE INDEX [IX_UserEngagements_OrganisationId_CreatedAt] ON [UserEngagements] ([OrganisationId], [CreatedAt]);

CREATE INDEX [IX_UserEngagements_UserId_CreatedAt] ON [UserEngagements] ([UserId], [CreatedAt]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251210055936_AddUserEngagementTracking', N'9.0.10');

ALTER TABLE [Lessons] ADD [GlobalLibraryContentId] bigint NULL;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251215065838_AddGlobalLibraryContentReference', N'9.0.10');

ALTER TABLE [GlobalLibraryContents] ADD [Code] nvarchar(max) NULL;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251215092944_AddCodeToGlobalLibraryContent', N'9.0.10');

ALTER TABLE [Lessons] ADD [ScormVersion] nvarchar(20) NULL;


UPDATE Lessons
SET ScormVersion = '1.2'
WHERE Type = 'scorm' AND ScormUrl IS NOT NULL;


INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260331065626_AddScormVersionToLessons', N'9.0.10');

COMMIT;
GO

