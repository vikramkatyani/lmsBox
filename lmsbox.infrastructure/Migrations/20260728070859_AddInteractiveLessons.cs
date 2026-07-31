using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddInteractiveLessons : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "InteractiveLessonSettings",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LessonId = table.Column<long>(type: "bigint", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LockNextBlockUntilComplete = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InteractiveLessonSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InteractiveLessonSettings_Lessons_LessonId",
                        column: x => x.LessonId,
                        principalTable: "Lessons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InteractiveBlocks",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InteractiveLessonSettingsId = table.Column<long>(type: "bigint", nullable: false),
                    Ordinal = table.Column<int>(type: "int", nullable: false),
                    BlockType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FormPayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    GeneratedHtml = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    EditedHtml = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CompletionRuleJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MediaAssetsJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ApprovedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InteractiveBlocks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InteractiveBlocks_InteractiveLessonSettings_InteractiveLessonSettingsId",
                        column: x => x.InteractiveLessonSettingsId,
                        principalTable: "InteractiveLessonSettings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InteractiveBlockProgresses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    LessonId = table.Column<long>(type: "bigint", nullable: false),
                    BlockId = table.Column<long>(type: "bigint", nullable: false),
                    IsComplete = table.Column<bool>(type: "bit", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ProgressDataJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InteractiveBlockProgresses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InteractiveBlockProgresses_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InteractiveBlockProgresses_InteractiveBlocks_BlockId",
                        column: x => x.BlockId,
                        principalTable: "InteractiveBlocks",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_InteractiveBlockProgresses_Lessons_LessonId",
                        column: x => x.LessonId,
                        principalTable: "Lessons",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_InteractiveBlockProgresses_BlockId",
                table: "InteractiveBlockProgresses",
                column: "BlockId");

            migrationBuilder.CreateIndex(
                name: "IX_InteractiveBlockProgresses_LessonId",
                table: "InteractiveBlockProgresses",
                column: "LessonId");

            migrationBuilder.CreateIndex(
                name: "IX_InteractiveBlockProgresses_UserId_BlockId",
                table: "InteractiveBlockProgresses",
                columns: new[] { "UserId", "BlockId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InteractiveBlocks_InteractiveLessonSettingsId",
                table: "InteractiveBlocks",
                column: "InteractiveLessonSettingsId");

            migrationBuilder.CreateIndex(
                name: "IX_InteractiveLessonSettings_LessonId",
                table: "InteractiveLessonSettings",
                column: "LessonId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InteractiveBlockProgresses");

            migrationBuilder.DropTable(
                name: "InteractiveBlocks");

            migrationBuilder.DropTable(
                name: "InteractiveLessonSettings");
        }
    }
}
