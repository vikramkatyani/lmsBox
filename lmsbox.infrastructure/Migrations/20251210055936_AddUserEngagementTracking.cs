using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserEngagementTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserEngagements",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    OrganisationId = table.Column<long>(type: "bigint", nullable: false),
                    EventType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CourseId = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    LessonId = table.Column<long>(type: "bigint", nullable: true),
                    QuizId = table.Column<long>(type: "bigint", nullable: true),
                    PathwayId = table.Column<long>(type: "bigint", nullable: true),
                    Metadata = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    DurationSeconds = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserEngagements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserEngagements_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserEngagements_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_UserEngagements_Lessons_LessonId",
                        column: x => x.LessonId,
                        principalTable: "Lessons",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_UserEngagements_Organisations_OrganisationId",
                        column: x => x.OrganisationId,
                        principalTable: "Organisations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserEngagements_CourseId",
                table: "UserEngagements",
                column: "CourseId");

            migrationBuilder.CreateIndex(
                name: "IX_UserEngagements_EventType",
                table: "UserEngagements",
                column: "EventType");

            migrationBuilder.CreateIndex(
                name: "IX_UserEngagements_LessonId",
                table: "UserEngagements",
                column: "LessonId");

            migrationBuilder.CreateIndex(
                name: "IX_UserEngagements_OrganisationId_CreatedAt",
                table: "UserEngagements",
                columns: new[] { "OrganisationId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_UserEngagements_UserId_CreatedAt",
                table: "UserEngagements",
                columns: new[] { "UserId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserEngagements");
        }
    }
}
