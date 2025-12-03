using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStorageKeyToOrganisation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "StorageKey",
                table: "Organisations",
                type: "nvarchar(12)",
                maxLength: 12,
                nullable: false,
                defaultValue: "");

            // Generate unique StorageKeys for existing organisations (12 characters)
            migrationBuilder.Sql(@"
                UPDATE Organisations 
                SET StorageKey = SUBSTRING(LOWER(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', '')), 1, 12)
                WHERE StorageKey = '' OR StorageKey IS NULL
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StorageKey",
                table: "Organisations");
        }
    }
}
