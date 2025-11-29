using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddScormTrackingFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ScormData",
                table: "LearnerProgresses",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ScormLessonLocation",
                table: "LearnerProgresses",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ScormLessonStatus",
                table: "LearnerProgresses",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ScormScore",
                table: "LearnerProgresses",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ScormData",
                table: "LearnerProgresses");

            migrationBuilder.DropColumn(
                name: "ScormLessonLocation",
                table: "LearnerProgresses");

            migrationBuilder.DropColumn(
                name: "ScormLessonStatus",
                table: "LearnerProgresses");

            migrationBuilder.DropColumn(
                name: "ScormScore",
                table: "LearnerProgresses");
        }
    }
}
