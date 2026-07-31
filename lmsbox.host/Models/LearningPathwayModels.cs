namespace lmsBox.Server.Models;

public class CreateLearningPathwayRequest
{
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public string? ShortDescription { get; set; }
    public string? Category { get; set; }
    public string? Tags { get; set; }
    public string? BannerUrl { get; set; }
    public int EstimatedDurationHours { get; set; }
    public string DifficultyLevel { get; set; } = "Beginner";
    public List<PathwayCourseRequest> Courses { get; set; } = new();
}

public class UpdateLearningPathwayRequest
{
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public string? ShortDescription { get; set; }
    public string? Category { get; set; }
    public string? Tags { get; set; }
    public string? BannerUrl { get; set; }
    public int EstimatedDurationHours { get; set; }
    public string DifficultyLevel { get; set; } = "Beginner";
    public bool IsActive { get; set; } = true;
    public List<PathwayCourseRequest> Courses { get; set; } = new();
}

public class PathwayCourseRequest
{
    public string CourseId { get; set; } = null!;
    public int SequenceOrder { get; set; }
    public bool IsMandatory { get; set; } = true;
    public List<string>? PrerequisiteCourseIds { get; set; }
}

public class LearningPathwayDto
{
    public string Id { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public string? ShortDescription { get; set; }
    public string? Category { get; set; }
    public string? Tags { get; set; }
    public bool IsActive { get; set; }
    public string? BannerUrl { get; set; }
    public int EstimatedDurationHours { get; set; }
    public string DifficultyLevel { get; set; } = null!;
    public long OrganisationId { get; set; }
    public string OrganisationName { get; set; } = null!;
    public string CreatedByUserId { get; set; } = null!;
    public string CreatedByUserName { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int CourseCount { get; set; }
    public List<PathwayCourseDto> Courses { get; set; } = new();
    public LearnerPathwayProgressDto? UserProgress { get; set; }
}

public class PathwayCourseDto
{
    public int Id { get; set; }
    public string CourseId { get; set; } = null!;
    public string CourseTitle { get; set; } = null!;
    public string? CourseDescription { get; set; }
    public int SequenceOrder { get; set; }
    public bool IsMandatory { get; set; }
    public List<string>? PrerequisiteCourseIds { get; set; }
    public DateTime AddedAt { get; set; }
    public bool IsCompleted { get; set; }
    public bool IsAccessible { get; set; } // Based on prerequisites
}

public class LearnerPathwayProgressDto
{
    public int Id { get; set; }
    public string UserId { get; set; } = null!;
    public string LearningPathwayId { get; set; } = null!;
    public int CompletedCourses { get; set; }
    public int TotalCourses { get; set; }
    public int ProgressPercent { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime EnrolledAt { get; set; }
    public DateTime? LastAccessedAt { get; set; }
    public string? CurrentCourseId { get; set; }
    public string? CurrentCourseTitle { get; set; }
}

public class LearningPathwayListResponse
{
    public List<LearningPathwayDto> Items { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}