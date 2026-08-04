using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganisationIdToQuestionBank : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_QuestionBankCategories_Name",
                table: "QuestionBankCategories");

            migrationBuilder.AddColumn<long>(
                name: "OrganisationId",
                table: "QuestionBankQuestions",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "OrganisationId",
                table: "QuestionBankCategories",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuestionBankQuestions_OrganisationId",
                table: "QuestionBankQuestions",
                column: "OrganisationId");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionBankCategories_OrganisationId_Name",
                table: "QuestionBankCategories",
                columns: new[] { "OrganisationId", "Name" },
                unique: true,
                filter: "[OrganisationId] IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_QuestionBankCategories_Organisations_OrganisationId",
                table: "QuestionBankCategories",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_QuestionBankQuestions_Organisations_OrganisationId",
                table: "QuestionBankQuestions",
                column: "OrganisationId",
                principalTable: "Organisations",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_QuestionBankCategories_Organisations_OrganisationId",
                table: "QuestionBankCategories");

            migrationBuilder.DropForeignKey(
                name: "FK_QuestionBankQuestions_Organisations_OrganisationId",
                table: "QuestionBankQuestions");

            migrationBuilder.DropIndex(
                name: "IX_QuestionBankQuestions_OrganisationId",
                table: "QuestionBankQuestions");

            migrationBuilder.DropIndex(
                name: "IX_QuestionBankCategories_OrganisationId_Name",
                table: "QuestionBankCategories");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "QuestionBankQuestions");

            migrationBuilder.DropColumn(
                name: "OrganisationId",
                table: "QuestionBankCategories");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionBankCategories_Name",
                table: "QuestionBankCategories",
                column: "Name",
                unique: true);
        }
    }
}
