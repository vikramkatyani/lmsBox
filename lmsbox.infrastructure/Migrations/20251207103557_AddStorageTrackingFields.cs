using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStorageTrackingFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "BrandingStorageUsedBytes",
                table: "Organisations",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "ContentStorageUsedBytes",
                table: "Organisations",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<DateTime>(
                name: "StorageLastCalculated",
                table: "Organisations",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "StorageUsedBytes",
                table: "Organisations",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BrandingStorageUsedBytes",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "ContentStorageUsedBytes",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "StorageLastCalculated",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "StorageUsedBytes",
                table: "Organisations");
        }
    }
}
