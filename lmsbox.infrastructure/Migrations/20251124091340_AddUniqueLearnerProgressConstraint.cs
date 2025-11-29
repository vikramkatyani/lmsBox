using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUniqueLearnerProgressConstraint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop index only if it exists (Azure database may not have it)
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LearnerProgresses_UserId' AND object_id = OBJECT_ID('LearnerProgresses'))
                BEGIN
                    DROP INDEX [IX_LearnerProgresses_UserId] ON [LearnerProgresses];
                END
            ");
            
            // Original code commented out:
            // migrationBuilder.DropIndex(
            //     name: "IX_LearnerProgresses_UserId",
            //     table: "LearnerProgresses");

            migrationBuilder.AlterColumn<string>(
                name: "CertificateId",
                table: "LearnerProgresses",
                type: "nvarchar(450)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_LearnerProgresses_CertificateId",
                table: "LearnerProgresses",
                column: "CertificateId");

            migrationBuilder.CreateIndex(
                name: "IX_LearnerProgresses_CertificateIssuedAt",
                table: "LearnerProgresses",
                column: "CertificateIssuedAt");

            migrationBuilder.CreateIndex(
                name: "IX_LearnerProgresses_UserId_CourseId_LessonId",
                table: "LearnerProgresses",
                columns: new[] { "UserId", "CourseId", "LessonId" },
                unique: true,
                filter: "[CourseId] IS NOT NULL AND [LessonId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LearnerProgresses_CertificateId",
                table: "LearnerProgresses");

            migrationBuilder.DropIndex(
                name: "IX_LearnerProgresses_CertificateIssuedAt",
                table: "LearnerProgresses");

            migrationBuilder.DropIndex(
                name: "IX_LearnerProgresses_UserId_CourseId_LessonId",
                table: "LearnerProgresses");

            migrationBuilder.AlterColumn<string>(
                name: "CertificateId",
                table: "LearnerProgresses",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_LearnerProgresses_UserId",
                table: "LearnerProgresses",
                column: "UserId");
        }
    }
}
