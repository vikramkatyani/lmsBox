using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lmsbox.domain.Models;

/// <summary>
/// Survey that can be used as pre or post-course survey
/// </summary>
public class Survey
{
    [Key]
    public long Id { get; set; }

    [Required]
    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    // Survey status: Draft or Published
    [Required]
    public string Status { get; set; } = "Draft";

    // Organisation that owns this survey
    public long OrganisationId { get; set; }
    [ForeignKey(nameof(OrganisationId))]
    public Organisation? Organisation { get; set; }

    // Who created the survey
    public string CreatedByUserId { get; set; } = null!;
    [ForeignKey(nameof(CreatedByUserId))]
    public ApplicationUser? CreatedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public bool IsActive { get; set; } = true;

    // Soft delete
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }

    // Navigation properties
    public ICollection<SurveyQuestion>? Questions { get; set; }
    public ICollection<SurveyResponse>? Responses { get; set; }
}

/// <summary>
/// Question within a survey
/// </summary>
public class SurveyQuestion
{
    [Key]
    public long Id { get; set; }

    public long SurveyId { get; set; }
    [ForeignKey(nameof(SurveyId))]
    public Survey? Survey { get; set; }

    [Required]
    public string QuestionText { get; set; } = null!;

    // QuestionType: MultipleChoice, SingleChoice, Text, Rating, YesNo
    public string QuestionType { get; set; } = "Text";

    // JSON array of options for multiple choice/single choice questions
    // Example: ["Option 1", "Option 2", "Option 3"]
    public string? Options { get; set; }

    // Display order
    public int OrderIndex { get; set; }

    public bool IsRequired { get; set; } = true;

    /// <summary>
    /// Who can view responses in reports: All or SuperAdminOnly.
    /// </summary>
    public string ResponseVisibility { get; set; } = SurveyQuestionResponseVisibility.All;

    // For rating questions: min and max values
    public int? MinRating { get; set; }
    public int? MaxRating { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<SurveyQuestionResponse>? QuestionResponses { get; set; }
}

public static class SurveyQuestionResponseVisibility
{
    public const string All = "All";
    public const string SuperAdminOnly = "SuperAdminOnly";
}

/// <summary>
/// A learner's submission of a survey for a specific course
/// </summary>
public class SurveyResponse
{
    [Key]
    public long Id { get; set; }

    public long SurveyId { get; set; }
    [ForeignKey(nameof(SurveyId))]
    public Survey? Survey { get; set; }

    public string UserId { get; set; } = null!;
    [ForeignKey(nameof(UserId))]
    public ApplicationUser? User { get; set; }

    // Course this survey response is for
    public string? CourseId { get; set; }
    [ForeignKey(nameof(CourseId))]
    public Course? Course { get; set; }

    // When survey was submitted
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;

    // Survey type at time of submission: PreCourse or PostCourse
    public string SurveyType { get; set; } = null!;

    // Navigation properties
    public ICollection<SurveyQuestionResponse>? QuestionResponses { get; set; }
}

/// <summary>
/// Individual answer to a survey question
/// </summary>
public class SurveyQuestionResponse
{
    [Key]
    public long Id { get; set; }

    public long SurveyResponseId { get; set; }
    [ForeignKey(nameof(SurveyResponseId))]
    public SurveyResponse? SurveyResponse { get; set; }

    public long SurveyQuestionId { get; set; }
    [ForeignKey(nameof(SurveyQuestionId))]
    public SurveyQuestion? SurveyQuestion { get; set; }

    // The actual answer - could be text, selected option, rating number, etc.
    public string? AnswerText { get; set; }

    // For multiple choice questions, store selected option(s) as JSON array
    public string? SelectedOptions { get; set; }

    // For rating questions
    public int? RatingValue { get; set; }

    public DateTime AnsweredAt { get; set; } = DateTime.UtcNow;
}
