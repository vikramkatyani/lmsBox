using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSuperAdminAndOrganisationEnhancements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_Organisations_OrganisationID",
                table: "AspNetUsers");

            migrationBuilder.AddColumn<long>(
                name: "AllocatedStorageGB",
                table: "Organisations",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "BannerUrl",
                table: "Organisations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "Organisations",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedOn",
                table: "Organisations",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "Domain",
                table: "Organisations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FaviconUrl",
                table: "Organisations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FromEmail",
                table: "Organisations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FromName",
                table: "Organisations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Organisations",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ManagerEmail",
                table: "Organisations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ManagerName",
                table: "Organisations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ManagerPhone",
                table: "Organisations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MaxUsers",
                table: "Organisations",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "RenewalDate",
                table: "Organisations",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SendGridApiKey",
                table: "Organisations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SmtpHost",
                table: "Organisations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SmtpPassword",
                table: "Organisations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SmtpPort",
                table: "Organisations",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "SmtpUseSsl",
                table: "Organisations",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SmtpUsername",
                table: "Organisations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SupportEmail",
                table: "Organisations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ThemeSettings",
                table: "Organisations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedBy",
                table: "Organisations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedOn",
                table: "Organisations",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AlterColumn<long>(
                name: "OrganisationID",
                table: "AspNetUsers",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.CreateTable(
                name: "GlobalLibraryContents",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ContentType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AzureBlobPath = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    FileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    MimeType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UploadedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UploadedBy = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Tags = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GlobalLibraryContents", x => x.Id);
                });

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_Organisations_OrganisationID",
                table: "AspNetUsers",
                column: "OrganisationID",
                principalTable: "Organisations",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_Organisations_OrganisationID",
                table: "AspNetUsers");

            migrationBuilder.DropTable(
                name: "GlobalLibraryContents");

            migrationBuilder.DropColumn(
                name: "AllocatedStorageGB",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "BannerUrl",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "CreatedOn",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "Domain",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "FaviconUrl",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "FromEmail",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "FromName",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "ManagerEmail",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "ManagerName",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "ManagerPhone",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "MaxUsers",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "RenewalDate",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "SendGridApiKey",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "SmtpHost",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "SmtpPassword",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "SmtpPort",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "SmtpUseSsl",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "SmtpUsername",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "SupportEmail",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "ThemeSettings",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "UpdatedBy",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "UpdatedOn",
                table: "Organisations");

            migrationBuilder.AlterColumn<long>(
                name: "OrganisationID",
                table: "AspNetUsers",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_Organisations_OrganisationID",
                table: "AspNetUsers",
                column: "OrganisationID",
                principalTable: "Organisations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
