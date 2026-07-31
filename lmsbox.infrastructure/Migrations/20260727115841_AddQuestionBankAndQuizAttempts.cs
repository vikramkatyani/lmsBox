using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddQuestionBankAndQuizAttempts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Quizzes_Courses_CourseId",
                table: "Quizzes");

            migrationBuilder.AlterColumn<string>(
                name: "CourseId",
                table: "Quizzes",
                type: "nvarchar(450)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AddColumn<string>(
                name: "IntroductionContent",
                table: "Quizzes",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsQuestionBank",
                table: "Quizzes",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "QuestionsPerAttempt",
                table: "Quizzes",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QuestionsPerAttemptByCategoryJson",
                table: "Quizzes",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceQuestionBankQuizId",
                table: "Quizzes",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "QuizQuestions",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsCriticalSafety",
                table: "QuizQuestions",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "QuestionBankQuestionId",
                table: "QuizQuestions",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "QuestionBankQuestionOptionId",
                table: "QuizQuestionOptions",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "QuestionBankCategories",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionBankCategories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "QuestionBankQuestions",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Question = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Points = table.Column<int>(type: "int", nullable: false),
                    Explanation = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Category = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsCriticalSafety = table.Column<bool>(type: "bit", nullable: false),
                    IsArchived = table.Column<bool>(type: "bit", nullable: false),
                    Tags = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedByUserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionBankQuestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuestionBankQuestions_AspNetUsers_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "QuizAttempts",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    QuizId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DurationSeconds = table.Column<int>(type: "int", nullable: false),
                    ScorePercent = table.Column<int>(type: "int", nullable: false),
                    Passed = table.Column<bool>(type: "bit", nullable: false),
                    FailedCriticalSafety = table.Column<bool>(type: "bit", nullable: false),
                    IsCompleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuizAttempts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuizAttempts_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_QuizAttempts_Quizzes_QuizId",
                        column: x => x.QuizId,
                        principalTable: "Quizzes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "QuestionBankQuestionOptions",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Text = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsCorrect = table.Column<bool>(type: "bit", nullable: false),
                    QuestionBankQuestionId = table.Column<long>(type: "bigint", nullable: false),
                    Order = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionBankQuestionOptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuestionBankQuestionOptions_QuestionBankQuestions_QuestionBankQuestionId",
                        column: x => x.QuestionBankQuestionId,
                        principalTable: "QuestionBankQuestions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "QuestionBankQuestionStatsCourse",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CourseId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    QuestionBankQuestionId = table.Column<long>(type: "bigint", nullable: false),
                    PresentedCount = table.Column<long>(type: "bigint", nullable: false),
                    CorrectCount = table.Column<long>(type: "bigint", nullable: false),
                    IncorrectCount = table.Column<long>(type: "bigint", nullable: false),
                    LastPresentedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionBankQuestionStatsCourse", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuestionBankQuestionStatsCourse_QuestionBankQuestions_QuestionBankQuestionId",
                        column: x => x.QuestionBankQuestionId,
                        principalTable: "QuestionBankQuestions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "QuestionBankQuestionStatsGlobal",
                columns: table => new
                {
                    QuestionBankQuestionId = table.Column<long>(type: "bigint", nullable: false),
                    PresentedCount = table.Column<long>(type: "bigint", nullable: false),
                    CorrectCount = table.Column<long>(type: "bigint", nullable: false),
                    IncorrectCount = table.Column<long>(type: "bigint", nullable: false),
                    LastPresentedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionBankQuestionStatsGlobal", x => x.QuestionBankQuestionId);
                    table.ForeignKey(
                        name: "FK_QuestionBankQuestionStatsGlobal_QuestionBankQuestions_QuestionBankQuestionId",
                        column: x => x.QuestionBankQuestionId,
                        principalTable: "QuestionBankQuestions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "QuestionBankQuestionStatsQuiz",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    QuizId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    QuestionBankQuestionId = table.Column<long>(type: "bigint", nullable: false),
                    PresentedCount = table.Column<long>(type: "bigint", nullable: false),
                    CorrectCount = table.Column<long>(type: "bigint", nullable: false),
                    IncorrectCount = table.Column<long>(type: "bigint", nullable: false),
                    LastPresentedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionBankQuestionStatsQuiz", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuestionBankQuestionStatsQuiz_QuestionBankQuestions_QuestionBankQuestionId",
                        column: x => x.QuestionBankQuestionId,
                        principalTable: "QuestionBankQuestions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "QuizAttemptAnswers",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    QuizAttemptId = table.Column<long>(type: "bigint", nullable: false),
                    QuizQuestionId = table.Column<long>(type: "bigint", nullable: false),
                    QuestionBankQuestionId = table.Column<long>(type: "bigint", nullable: true),
                    SelectedOptionId = table.Column<long>(type: "bigint", nullable: true),
                    SelectedOptionIdsJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SelectedQuestionBankOptionIdsJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsCorrect = table.Column<bool>(type: "bit", nullable: false),
                    ResponseTimeMs = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuizAttemptAnswers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuizAttemptAnswers_QuizAttempts_QuizAttemptId",
                        column: x => x.QuizAttemptId,
                        principalTable: "QuizAttempts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_QuizAttemptAnswers_QuizQuestions_QuizQuestionId",
                        column: x => x.QuizQuestionId,
                        principalTable: "QuizQuestions",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "QuizAttemptQuestions",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    QuizAttemptId = table.Column<long>(type: "bigint", nullable: false),
                    QuizQuestionId = table.Column<long>(type: "bigint", nullable: false),
                    QuestionBankQuestionId = table.Column<long>(type: "bigint", nullable: true),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuizAttemptQuestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuizAttemptQuestions_QuizAttempts_QuizAttemptId",
                        column: x => x.QuizAttemptId,
                        principalTable: "QuizAttempts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_QuizAttemptQuestions_QuizQuestions_QuizQuestionId",
                        column: x => x.QuizQuestionId,
                        principalTable: "QuizQuestions",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_QuestionBankCategories_Name",
                table: "QuestionBankCategories",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuestionBankQuestionOptions_QuestionBankQuestionId",
                table: "QuestionBankQuestionOptions",
                column: "QuestionBankQuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionBankQuestions_CreatedAt",
                table: "QuestionBankQuestions",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionBankQuestions_CreatedByUserId",
                table: "QuestionBankQuestions",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionBankQuestionStatsCourse_CourseId_QuestionBankQuestionId",
                table: "QuestionBankQuestionStatsCourse",
                columns: new[] { "CourseId", "QuestionBankQuestionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuestionBankQuestionStatsCourse_QuestionBankQuestionId",
                table: "QuestionBankQuestionStatsCourse",
                column: "QuestionBankQuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionBankQuestionStatsQuiz_QuestionBankQuestionId",
                table: "QuestionBankQuestionStatsQuiz",
                column: "QuestionBankQuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionBankQuestionStatsQuiz_QuizId_QuestionBankQuestionId",
                table: "QuestionBankQuestionStatsQuiz",
                columns: new[] { "QuizId", "QuestionBankQuestionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttemptAnswers_QuizAttemptId",
                table: "QuizAttemptAnswers",
                column: "QuizAttemptId");

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttemptAnswers_QuizQuestionId",
                table: "QuizAttemptAnswers",
                column: "QuizQuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttemptQuestions_QuizAttemptId_QuizQuestionId",
                table: "QuizAttemptQuestions",
                columns: new[] { "QuizAttemptId", "QuizQuestionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttemptQuestions_QuizQuestionId",
                table: "QuizAttemptQuestions",
                column: "QuizQuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttempts_QuizId_UserId_CompletedAt",
                table: "QuizAttempts",
                columns: new[] { "QuizId", "UserId", "CompletedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttempts_UserId",
                table: "QuizAttempts",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Quizzes_Courses_CourseId",
                table: "Quizzes",
                column: "CourseId",
                principalTable: "Courses",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Quizzes_Courses_CourseId",
                table: "Quizzes");

            migrationBuilder.DropTable(
                name: "QuestionBankCategories");

            migrationBuilder.DropTable(
                name: "QuestionBankQuestionOptions");

            migrationBuilder.DropTable(
                name: "QuestionBankQuestionStatsCourse");

            migrationBuilder.DropTable(
                name: "QuestionBankQuestionStatsGlobal");

            migrationBuilder.DropTable(
                name: "QuestionBankQuestionStatsQuiz");

            migrationBuilder.DropTable(
                name: "QuizAttemptAnswers");

            migrationBuilder.DropTable(
                name: "QuizAttemptQuestions");

            migrationBuilder.DropTable(
                name: "QuestionBankQuestions");

            migrationBuilder.DropTable(
                name: "QuizAttempts");

            migrationBuilder.DropColumn(
                name: "IntroductionContent",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "IsQuestionBank",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "QuestionsPerAttempt",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "QuestionsPerAttemptByCategoryJson",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "SourceQuestionBankQuizId",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "QuizQuestions");

            migrationBuilder.DropColumn(
                name: "IsCriticalSafety",
                table: "QuizQuestions");

            migrationBuilder.DropColumn(
                name: "QuestionBankQuestionId",
                table: "QuizQuestions");

            migrationBuilder.DropColumn(
                name: "QuestionBankQuestionOptionId",
                table: "QuizQuestionOptions");

            migrationBuilder.AlterColumn<string>(
                name: "CourseId",
                table: "Quizzes",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(450)",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Quizzes_Courses_CourseId",
                table: "Quizzes",
                column: "CourseId",
                principalTable: "Courses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
