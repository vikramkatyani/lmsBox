using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddScormVersionToLessons : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ScormVersion",
                table: "Lessons",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            // Backfill existing SCORM lessons with version 1.2 (legacy)
            migrationBuilder.Sql(@"
UPDATE Lessons
SET ScormVersion = '1.2'
WHERE Type = 'scorm' AND ScormUrl IS NOT NULL;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ScormVersion",
                table: "Lessons");
        }
    }
}
