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
            migrationBuilder.DropIndex(
                name: "IX_LearnerProgresses_CourseId",
                table: "LearnerProgresses");

            migrationBuilder.CreateIndex(
                name: "IX_LearnerProgresses_Completed_ProgressPercent_LastAccessedAt_StartedAt_CompletedAt",
                table: "LearnerProgresses",
                columns: new[] { "Completed", "ProgressPercent", "LastAccessedAt", "StartedAt", "CompletedAt" },
                filter: "[LessonId] IS NULL AND [CourseId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_LearnerProgresses_CourseId_Completed_ProgressPercent_CompletedAt",
                table: "LearnerProgresses",
                columns: new[] { "CourseId", "Completed", "ProgressPercent", "CompletedAt" },
                filter: "[LessonId] IS NULL AND [CourseId] IS NOT NULL");
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

            migrationBuilder.CreateIndex(
                name: "IX_LearnerProgresses_CourseId",
                table: "LearnerProgresses",
                column: "CourseId");
        }
    }
}
