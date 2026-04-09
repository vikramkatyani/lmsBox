using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddContentUsageReportIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_LearnerProgresses_CourseId_LessonId_LastAccessedAt_CompletedAt_StartedAt",
                table: "LearnerProgresses",
                columns: new[] { "CourseId", "LessonId", "LastAccessedAt", "CompletedAt", "StartedAt" },
                filter: "[LessonId] IS NULL AND [CourseId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_LearnerProgresses_CourseId_LessonId_UserId_Completed_ProgressPercent",
                table: "LearnerProgresses",
                columns: new[] { "CourseId", "LessonId", "UserId", "Completed", "ProgressPercent" },
                filter: "[LessonId] IS NULL AND [CourseId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LearnerProgresses_CourseId_LessonId_LastAccessedAt_CompletedAt_StartedAt",
                table: "LearnerProgresses");

            migrationBuilder.DropIndex(
                name: "IX_LearnerProgresses_CourseId_LessonId_UserId_Completed_ProgressPercent",
                table: "LearnerProgresses");
        }
    }
}
