using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserActivityReportIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_OrganisationID",
                table: "AspNetUsers");

            migrationBuilder.CreateIndex(
                name: "IX_LearnerProgresses_UserId_Completed_ProgressPercent",
                table: "LearnerProgresses",
                columns: new[] { "UserId", "Completed", "ProgressPercent" });

            migrationBuilder.CreateIndex(
                name: "IX_LearnerProgresses_UserId_LastAccessedAt_CompletedAt",
                table: "LearnerProgresses",
                columns: new[] { "UserId", "LastAccessedAt", "CompletedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_OrganisationID_ActiveStatus_CreatedOn",
                table: "AspNetUsers",
                columns: new[] { "OrganisationID", "ActiveStatus", "CreatedOn" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LearnerProgresses_UserId_Completed_ProgressPercent",
                table: "LearnerProgresses");

            migrationBuilder.DropIndex(
                name: "IX_LearnerProgresses_UserId_LastAccessedAt_CompletedAt",
                table: "LearnerProgresses");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_OrganisationID_ActiveStatus_CreatedOn",
                table: "AspNetUsers");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_OrganisationID",
                table: "AspNetUsers",
                column: "OrganisationID");
        }
    }
}
