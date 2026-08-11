using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantMultiTenancy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Tenants",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AllowsMultipleOrganisations = table.Column<bool>(type: "bit", nullable: false),
                    MaxUsers = table.Column<int>(type: "int", nullable: false),
                    AllocatedStorageGB = table.Column<long>(type: "bigint", nullable: false),
                    Domain = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SupportEmail = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ManagerName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ManagerEmail = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ManagerPhone = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RenewalDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tenants", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Tenants_Code",
                table: "Tenants",
                column: "Code",
                unique: true);

            migrationBuilder.AddColumn<long>(
                name: "TenantId",
                table: "Organisations",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "TenantId",
                table: "AspNetUsers",
                type: "bigint",
                nullable: true);

            // Backfill: one single-org tenant per existing organisation
            migrationBuilder.Sql(@"
INSERT INTO Tenants (Name, Code, Description, AllowsMultipleOrganisations, MaxUsers, AllocatedStorageGB, Domain, SupportEmail, ManagerName, ManagerEmail, ManagerPhone, RenewalDate, IsActive, CreatedOn, CreatedBy)
SELECT
    o.Name,
    LEFT(CONCAT('org-', CAST(o.Id AS nvarchar(20)), '-', LOWER(REPLACE(REPLACE(REPLACE(ISNULL(o.StorageKey, CAST(o.Id AS nvarchar(20))), ' ', '-'), '_', '-'), '.', '-'))), 100),
    o.Description,
    0,
    o.MaxUsers,
    o.AllocatedStorageGB,
    o.Domain,
    o.SupportEmail,
    o.ManagerName,
    o.ManagerEmail,
    o.ManagerPhone,
    o.RenewalDate,
    o.IsActive,
    o.CreatedOn,
    ISNULL(NULLIF(o.CreatedBy, ''), 'system')
FROM Organisations o
WHERE o.TenantId IS NULL;
");

            migrationBuilder.Sql(@"
UPDATE o
SET TenantId = t.Id
FROM Organisations o
INNER JOIN Tenants t ON t.Code = LEFT(CONCAT('org-', CAST(o.Id AS nvarchar(20)), '-', LOWER(REPLACE(REPLACE(REPLACE(ISNULL(o.StorageKey, CAST(o.Id AS nvarchar(20))), ' ', '-'), '_', '-'), '.', '-'))), 100)
WHERE o.TenantId IS NULL;
");

            migrationBuilder.Sql(@"
UPDATE u
SET TenantId = o.TenantId
FROM AspNetUsers u
INNER JOIN Organisations o ON u.OrganisationID = o.Id
WHERE u.TenantId IS NULL AND u.OrganisationID IS NOT NULL;
");

            migrationBuilder.AlterColumn<long>(
                name: "TenantId",
                table: "Organisations",
                type: "bigint",
                nullable: false,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Organisations_TenantId",
                table: "Organisations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_TenantId",
                table: "AspNetUsers",
                column: "TenantId");

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_Tenants_TenantId",
                table: "AspNetUsers",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Organisations_Tenants_TenantId",
                table: "Organisations",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_Tenants_TenantId",
                table: "AspNetUsers");

            migrationBuilder.DropForeignKey(
                name: "FK_Organisations_Tenants_TenantId",
                table: "Organisations");

            migrationBuilder.DropTable(
                name: "Tenants");

            migrationBuilder.DropIndex(
                name: "IX_Organisations_TenantId",
                table: "Organisations");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_TenantId",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Organisations");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "AspNetUsers");
        }
    }
}
