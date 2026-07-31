using System.ComponentModel.DataAnnotations.Schema;

namespace lmsbox.domain.Models;

public class InteractiveBlockProgress
{
    public int Id { get; set; }

    public string UserId { get; set; } = null!;

    [ForeignKey(nameof(UserId))]
    public ApplicationUser? User { get; set; }

    public long LessonId { get; set; }

    [ForeignKey(nameof(LessonId))]
    public Lesson? Lesson { get; set; }

    public long BlockId { get; set; }

    [ForeignKey(nameof(BlockId))]
    public InteractiveBlock? Block { get; set; }

    public bool IsComplete { get; set; }

    public DateTime? CompletedAt { get; set; }

    public string? ProgressDataJson { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
