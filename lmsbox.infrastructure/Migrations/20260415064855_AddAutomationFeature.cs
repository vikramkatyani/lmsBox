using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAutomationFeature : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TimeZoneId",
                table: "Organisations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AutomationTasks",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganisationId = table.Column<long>(type: "bigint", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    UpdatedByUserId = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    Type = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    EventKey = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    EmailSubject = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    EmailBodyHtml = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AudienceType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    AudienceFilterJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CourseFilterJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ScheduleMode = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    DaysAfterAssignment = table.Column<int>(type: "int", nullable: true),
                    IntervalMinutes = table.Column<int>(type: "int", nullable: true),
                    AnnouncementSendAtLocal = table.Column<DateTime>(type: "datetime2", nullable: true),
                    AnnouncementSendAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TimeZoneId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PublishedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AutomationTasks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AutomationTasks_AspNetUsers_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AutomationTasks_AspNetUsers_UpdatedByUserId",
                        column: x => x.UpdatedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_AutomationTasks_Organisations_OrganisationId",
                        column: x => x.OrganisationId,
                        principalTable: "Organisations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AutomationDispatches",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AutomationTaskId = table.Column<long>(type: "bigint", nullable: false),
                    OrganisationId = table.Column<long>(type: "bigint", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    RecipientEmail = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    SubjectSnapshot = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    BodySnapshot = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ScheduledForUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    LastError = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    SentAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IdempotencyKey = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AutomationDispatches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AutomationDispatches_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_AutomationDispatches_AutomationTasks_AutomationTaskId",
                        column: x => x.AutomationTaskId,
                        principalTable: "AutomationTasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AutomationDispatches_Organisations_OrganisationId",
                        column: x => x.OrganisationId,
                        principalTable: "Organisations",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_AutomationDispatches_AutomationTaskId",
                table: "AutomationDispatches",
                column: "AutomationTaskId");

            migrationBuilder.CreateIndex(
                name: "IX_AutomationDispatches_IdempotencyKey",
                table: "AutomationDispatches",
                column: "IdempotencyKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AutomationDispatches_OrganisationId",
                table: "AutomationDispatches",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_AutomationDispatches_Status_ScheduledForUtc",
                table: "AutomationDispatches",
                columns: new[] { "Status", "ScheduledForUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_AutomationDispatches_UserId",
                table: "AutomationDispatches",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AutomationTasks_CreatedAtUtc",
                table: "AutomationTasks",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_AutomationTasks_CreatedByUserId",
                table: "AutomationTasks",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_AutomationTasks_OrganisationId_Status_Type",
                table: "AutomationTasks",
                columns: new[] { "OrganisationId", "Status", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_AutomationTasks_UpdatedByUserId",
                table: "AutomationTasks",
                column: "UpdatedByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AutomationDispatches");

            migrationBuilder.DropTable(
                name: "AutomationTasks");

            migrationBuilder.DropColumn(
                name: "TimeZoneId",
                table: "Organisations");
        }
    }
}
