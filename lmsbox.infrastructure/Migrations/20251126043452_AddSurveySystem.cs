using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSurveySystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "PostSurveyCompleted",
                table: "LearnerProgresses",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "PostSurveyCompletedAt",
                table: "LearnerProgresses",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "PostSurveyResponseId",
                table: "LearnerProgresses",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PreSurveyCompleted",
                table: "LearnerProgresses",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "PreSurveyCompletedAt",
                table: "LearnerProgresses",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "PreSurveyResponseId",
                table: "LearnerProgresses",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsPostSurveyMandatory",
                table: "Courses",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsPreSurveyMandatory",
                table: "Courses",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "PostCourseSurveyId",
                table: "Courses",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "PreCourseSurveyId",
                table: "Courses",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Surveys",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SurveyType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    OrganisationId = table.Column<long>(type: "bigint", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Surveys", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Surveys_AspNetUsers_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Surveys_Organisations_OrganisationId",
                        column: x => x.OrganisationId,
                        principalTable: "Organisations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SurveyQuestions",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SurveyId = table.Column<long>(type: "bigint", nullable: false),
                    QuestionText = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    QuestionType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Options = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    OrderIndex = table.Column<int>(type: "int", nullable: false),
                    IsRequired = table.Column<bool>(type: "bit", nullable: false),
                    MinRating = table.Column<int>(type: "int", nullable: true),
                    MaxRating = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyQuestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyQuestions_Surveys_SurveyId",
                        column: x => x.SurveyId,
                        principalTable: "Surveys",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SurveyResponses",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SurveyId = table.Column<long>(type: "bigint", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    CourseId = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SurveyType = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyResponses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyResponses_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SurveyResponses_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SurveyResponses_Surveys_SurveyId",
                        column: x => x.SurveyId,
                        principalTable: "Surveys",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SurveyQuestionResponses",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SurveyResponseId = table.Column<long>(type: "bigint", nullable: false),
                    SurveyQuestionId = table.Column<long>(type: "bigint", nullable: false),
                    AnswerText = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SelectedOptions = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RatingValue = table.Column<int>(type: "int", nullable: true),
                    AnsweredAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyQuestionResponses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyQuestionResponses_SurveyQuestions_SurveyQuestionId",
                        column: x => x.SurveyQuestionId,
                        principalTable: "SurveyQuestions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SurveyQuestionResponses_SurveyResponses_SurveyResponseId",
                        column: x => x.SurveyResponseId,
                        principalTable: "SurveyResponses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Courses_PostCourseSurveyId",
                table: "Courses",
                column: "PostCourseSurveyId");

            migrationBuilder.CreateIndex(
                name: "IX_Courses_PreCourseSurveyId",
                table: "Courses",
                column: "PreCourseSurveyId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyQuestionResponses_SurveyQuestionId",
                table: "SurveyQuestionResponses",
                column: "SurveyQuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyQuestionResponses_SurveyResponseId",
                table: "SurveyQuestionResponses",
                column: "SurveyResponseId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyQuestions_SurveyId",
                table: "SurveyQuestions",
                column: "SurveyId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_CourseId",
                table: "SurveyResponses",
                column: "CourseId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_SurveyId",
                table: "SurveyResponses",
                column: "SurveyId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_UserId",
                table: "SurveyResponses",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Surveys_CreatedByUserId",
                table: "Surveys",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Surveys_OrganisationId",
                table: "Surveys",
                column: "OrganisationId");

            migrationBuilder.AddForeignKey(
                name: "FK_Courses_Surveys_PostCourseSurveyId",
                table: "Courses",
                column: "PostCourseSurveyId",
                principalTable: "Surveys",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Courses_Surveys_PreCourseSurveyId",
                table: "Courses",
                column: "PreCourseSurveyId",
                principalTable: "Surveys",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Courses_Surveys_PostCourseSurveyId",
                table: "Courses");

            migrationBuilder.DropForeignKey(
                name: "FK_Courses_Surveys_PreCourseSurveyId",
                table: "Courses");

            migrationBuilder.DropTable(
                name: "SurveyQuestionResponses");

            migrationBuilder.DropTable(
                name: "SurveyQuestions");

            migrationBuilder.DropTable(
                name: "SurveyResponses");

            migrationBuilder.DropTable(
                name: "Surveys");

            migrationBuilder.DropIndex(
                name: "IX_Courses_PostCourseSurveyId",
                table: "Courses");

            migrationBuilder.DropIndex(
                name: "IX_Courses_PreCourseSurveyId",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "PostSurveyCompleted",
                table: "LearnerProgresses");

            migrationBuilder.DropColumn(
                name: "PostSurveyCompletedAt",
                table: "LearnerProgresses");

            migrationBuilder.DropColumn(
                name: "PostSurveyResponseId",
                table: "LearnerProgresses");

            migrationBuilder.DropColumn(
                name: "PreSurveyCompleted",
                table: "LearnerProgresses");

            migrationBuilder.DropColumn(
                name: "PreSurveyCompletedAt",
                table: "LearnerProgresses");

            migrationBuilder.DropColumn(
                name: "PreSurveyResponseId",
                table: "LearnerProgresses");

            migrationBuilder.DropColumn(
                name: "IsPostSurveyMandatory",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "IsPreSurveyMandatory",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "PostCourseSurveyId",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "PreCourseSurveyId",
                table: "Courses");
        }
    }
}
