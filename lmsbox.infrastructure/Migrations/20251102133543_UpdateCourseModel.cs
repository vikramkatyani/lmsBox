using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateCourseModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BannerUrl",
                table: "Courses",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "Courses",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "CertificateEnabled",
                table: "Courses",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ShortDescription",
                table: "Courses",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Courses",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Tags",
                table: "Courses",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Courses",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BannerUrl",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "CertificateEnabled",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "ShortDescription",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "Tags",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Courses");
        }
    }
}
