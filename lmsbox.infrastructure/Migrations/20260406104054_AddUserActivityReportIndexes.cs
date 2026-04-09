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
                // Drop the old single-column index only if it exists (may be absent in some environments)
                migrationBuilder.Sql(@"
                    IF EXISTS (
                        SELECT 1 FROM sys.indexes
                        WHERE name = 'IX_AspNetUsers_OrganisationID'
                          AND object_id = OBJECT_ID(N'AspNetUsers')
                    )
                    DROP INDEX [IX_AspNetUsers_OrganisationID] ON [AspNetUsers];");

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

                // Recreate the old index only if it doesn't already exist
                migrationBuilder.Sql(@"
                    IF NOT EXISTS (
                        SELECT 1 FROM sys.indexes
                        WHERE name = 'IX_AspNetUsers_OrganisationID'
                          AND object_id = OBJECT_ID(N'AspNetUsers')
                    )
                    CREATE INDEX [IX_AspNetUsers_OrganisationID] ON [AspNetUsers] ([OrganisationID]);");
        }
    }
}
