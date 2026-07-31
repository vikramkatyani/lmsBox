using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lmsbox.domain.Models;

public class InteractiveLessonSettings
{
    public long Id { get; set; }

    public long LessonId { get; set; }

    [ForeignKey(nameof(LessonId))]
    public Lesson? Lesson { get; set; }

    public string? Description { get; set; }

    public bool LockNextBlockUntilComplete { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<InteractiveBlock> Blocks { get; set; } = new List<InteractiveBlock>();
}
