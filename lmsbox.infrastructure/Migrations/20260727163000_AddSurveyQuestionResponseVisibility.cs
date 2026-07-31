using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260727163000_AddSurveyQuestionResponseVisibility")]
    public partial class AddSurveyQuestionResponseVisibility : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.SurveyQuestions', 'ResponseVisibility') IS NULL
BEGIN
    ALTER TABLE dbo.SurveyQuestions ADD ResponseVisibility nvarchar(max) NOT NULL
        CONSTRAINT DF_SurveyQuestions_ResponseVisibility DEFAULT('All');
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.SurveyQuestions', 'ResponseVisibility') IS NOT NULL
BEGIN
    DECLARE @constraintName sysname;
    SELECT @constraintName = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.SurveyQuestions')
      AND c.name = 'ResponseVisibility';

    IF @constraintName IS NOT NULL
        EXEC(N'ALTER TABLE dbo.SurveyQuestions DROP CONSTRAINT [' + @constraintName + N']');

    ALTER TABLE dbo.SurveyQuestions DROP COLUMN ResponseVisibility;
END
");
        }
    }
}
