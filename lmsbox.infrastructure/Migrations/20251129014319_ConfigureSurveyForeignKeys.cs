using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ConfigureSurveyForeignKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Courses_Surveys_PostCourseSurveyId",
                table: "Courses");

            migrationBuilder.DropForeignKey(
                name: "FK_Courses_Surveys_PreCourseSurveyId",
                table: "Courses");

            migrationBuilder.AddForeignKey(
                name: "FK_Courses_Surveys_PostCourseSurveyId",
                table: "Courses",
                column: "PostCourseSurveyId",
                principalTable: "Surveys",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Courses_Surveys_PreCourseSurveyId",
                table: "Courses",
                column: "PreCourseSurveyId",
                principalTable: "Surveys",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
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
    }
}
