using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lmsbox.domain.Models;

public class Quiz
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public string Id { get; set; } = null!;

    [Required]
    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public int PassingScore { get; set; } = 70; // Percentage required to pass

    public bool IsTimed { get; set; } = false;

    public int TimeLimit { get; set; } = 30; // Minutes

    public bool ShuffleQuestions { get; set; } = false;

    public bool ShuffleAnswers { get; set; } = false;

    public bool ShowResults { get; set; } = true;

    public bool AllowRetake { get; set; } = true;

    public int MaxAttempts { get; set; } = 3;

    // Relationship to course
    public string CourseId { get; set; } = null!;
    [ForeignKey(nameof(CourseId))]
    public Course? Course { get; set; }

    // Who created the quiz
    public string CreatedByUserId { get; set; } = null!;
    [ForeignKey(nameof(CreatedByUserId))]
    public ApplicationUser? CreatedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Questions in this quiz
    public ICollection<QuizQuestion> Questions { get; set; } = new List<QuizQuestion>();
}

public class QuizQuestion
{
    [Key]
    public long Id { get; set; }

    [Required]
    public string Question { get; set; } = null!;

    public string Type { get; set; } = "mc_single"; // mc_single, mc_multi, true_false, short_answer

    public int Points { get; set; } = 1;

    public string? Explanation { get; set; }

    // Relationship to quiz
    public string QuizId { get; set; } = null!;
    [ForeignKey(nameof(QuizId))]
    public Quiz? Quiz { get; set; }

    public int Order { get; set; } // Order of questions in quiz

    // Options for multiple choice questions
    public ICollection<QuizQuestionOption> Options { get; set; } = new List<QuizQuestionOption>();
}

public class QuizQuestionOption
{
    [Key]
    public long Id { get; set; }

    [Required]
    public string Text { get; set; } = null!;

    public bool IsCorrect { get; set; } = false;

    // Relationship to question
    public long QuizQuestionId { get; set; }
    [ForeignKey(nameof(QuizQuestionId))]
    public QuizQuestion? QuizQuestion { get; set; }

    public int Order { get; set; } // Order of options
}