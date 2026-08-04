using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserCourseProgressReportIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF EXISTS (
                    SELECT 1 FROM sys.indexes
                    WHERE name = 'IX_LearnerProgresses_CourseId'
                      AND object_id = OBJECT_ID(N'LearnerProgresses')
                )
                DROP INDEX [IX_LearnerProgresses_CourseId] ON [LearnerProgresses];

                IF NOT EXISTS (
                    SELECT 1 FROM sys.indexes
                    WHERE name = 'IX_LearnerProgresses_Completed_ProgressPercent_LastAccessedAt_StartedAt_CompletedAt'
                      AND object_id = OBJECT_ID(N'LearnerProgresses')
                )
                CREATE INDEX [IX_LearnerProgresses_Completed_ProgressPercent_LastAccessedAt_StartedAt_CompletedAt]
                    ON [LearnerProgresses] ([Completed], [ProgressPercent], [LastAccessedAt], [StartedAt], [CompletedAt])
                    WHERE [LessonId] IS NULL AND [CourseId] IS NOT NULL;

                IF NOT EXISTS (
                    SELECT 1 FROM sys.indexes
                    WHERE name = 'IX_LearnerProgresses_CourseId_Completed_ProgressPercent_CompletedAt'
                      AND object_id = OBJECT_ID(N'LearnerProgresses')
                )
                CREATE INDEX [IX_LearnerProgresses_CourseId_Completed_ProgressPercent_CompletedAt]
                    ON [LearnerProgresses] ([CourseId], [Completed], [ProgressPercent], [CompletedAt])
                    WHERE [LessonId] IS NULL AND [CourseId] IS NOT NULL;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LearnerProgresses_Completed_ProgressPercent_LastAccessedAt_StartedAt_CompletedAt",
                table: "LearnerProgresses");

            migrationBuilder.DropIndex(
                name: "IX_LearnerProgresses_CourseId_Completed_ProgressPercent_CompletedAt",
                table: "LearnerProgresses");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT 1 FROM sys.indexes
                    WHERE name = 'IX_LearnerProgresses_CourseId'
                      AND object_id = OBJECT_ID(N'LearnerProgresses')
                )
                CREATE INDEX [IX_LearnerProgresses_CourseId] ON [LearnerProgresses] ([CourseId]);");
        }
    }
}
