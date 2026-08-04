using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FilterCourseTitleUniqueIndexOnSoftDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_Course_OrganisationId_Title",
                table: "Courses");

            migrationBuilder.CreateIndex(
                name: "UX_Course_OrganisationId_Title",
                table: "Courses",
                columns: new[] { "OrganisationId", "Title" },
                unique: true,
                filter: "[IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_Course_OrganisationId_Title",
                table: "Courses");

            migrationBuilder.CreateIndex(
                name: "UX_Course_OrganisationId_Title",
                table: "Courses",
                columns: new[] { "OrganisationId", "Title" },
                unique: true);
        }
    }
}
