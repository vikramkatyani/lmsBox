using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lmsbox.infrastructure.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260727170000_AddAnnouncementReadReceipts")]
    public partial class AddAnnouncementReadReceipts : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[AnnouncementReadReceipts]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AnnouncementReadReceipts] (
        [Id] bigint IDENTITY(1,1) NOT NULL,
        [AutomationTaskId] bigint NOT NULL,
        [UserId] nvarchar(450) NOT NULL,
        [ReadAtUtc] datetime2 NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_AnnouncementReadReceipts] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AnnouncementReadReceipts_AutomationTasks_AutomationTaskId]
            FOREIGN KEY ([AutomationTaskId]) REFERENCES [dbo].[AutomationTasks] ([Id]) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX [IX_AnnouncementReadReceipts_AutomationTaskId_UserId]
        ON [dbo].[AnnouncementReadReceipts] ([AutomationTaskId], [UserId]);
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[AnnouncementReadReceipts]', N'U') IS NOT NULL
    DROP TABLE [dbo].[AnnouncementReadReceipts];
");
        }
    }
}
