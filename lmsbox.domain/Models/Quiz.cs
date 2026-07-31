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

    /// <summary>
    /// HTML or plain text shown on the quiz introduction page before the learner starts.
    /// </summary>
    public string? IntroductionContent { get; set; }

    public int PassingScore { get; set; } = 70; // Percentage required to pass

    public bool IsTimed { get; set; } = false;

    public int TimeLimit { get; set; } = 30; // Minutes

    public bool ShuffleQuestions { get; set; } = false;

    public bool ShuffleAnswers { get; set; } = false;

    public bool ShowResults { get; set; } = true;

    public bool AllowRetake { get; set; } = true;

    public int MaxAttempts { get; set; } = 3;

    /// <summary>
    /// Number of random questions shown per attempt. Null or 0 means all questions in the pool.
    /// </summary>
    public int? QuestionsPerAttempt { get; set; }

    /// <summary>
    /// Optional JSON object mapping Category -> number of questions to include per attempt.
    /// Used only when QuestionsPerAttempt is set (random subset mode).
    /// Example: { "Category A": 5, "Category B": 3 }
    /// </summary>
    public string? QuestionsPerAttemptByCategoryJson { get; set; }

    /// <summary>
    /// When true, this quiz is a reusable template stored in the Question Bank (not tied to a course).
    /// Course quizzes should keep this false.
    /// </summary>
    public bool IsQuestionBank { get; set; } = false;

    /// <summary>
    /// If this course quiz was created by importing a Question Bank quiz, this stores the source quiz id.
    /// </summary>
    public string? SourceQuestionBankQuizId { get; set; }

    // Relationship to course (null for question bank quizzes)
    public string? CourseId { get; set; }
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

    /// <summary>
    /// Optional link back to the global question bank question for cumulative statistics.
    /// Null for legacy/free-form quiz questions.
    /// </summary>
    public long? QuestionBankQuestionId { get; set; }

    [Required]
    public string Question { get; set; } = null!;

    public string Type { get; set; } = "mc_single"; // mc_single, mc_multi, true_false, short_answer

    public int Points { get; set; } = 1;

    public string? Explanation { get; set; }

    /// <summary>Topic or module category for reporting (e.g. "Fall Protection").</summary>
    public string? Category { get; set; }

    /// <summary>When true, an incorrect answer fails the quiz regardless of score.</summary>
    public bool IsCriticalSafety { get; set; }

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

    /// <summary>
    /// Optional link back to the global question bank option for precise answer mapping.
    /// </summary>
    public long? QuestionBankQuestionOptionId { get; set; }

    [Required]
    public string Text { get; set; } = null!;

    public bool IsCorrect { get; set; } = false;

    // Relationship to question
    public long QuizQuestionId { get; set; }
    [ForeignKey(nameof(QuizQuestionId))]
    public QuizQuestion? QuizQuestion { get; set; }

    public int Order { get; set; } // Order of options
}

/// <summary>
/// A learner's submitted attempt at a quiz.
/// </summary>
public class QuizAttempt
{
    [Key]
    public long Id { get; set; }

    public string QuizId { get; set; } = null!;
    [ForeignKey(nameof(QuizId))]
    public Quiz? Quiz { get; set; }

    public string UserId { get; set; } = null!;
    [ForeignKey(nameof(UserId))]
    public ApplicationUser? User { get; set; }

    public DateTime StartedAt { get; set; }

    public DateTime CompletedAt { get; set; }

    public int DurationSeconds { get; set; }

    public int ScorePercent { get; set; }

    public bool Passed { get; set; }

    public bool FailedCriticalSafety { get; set; }

    public bool IsCompleted { get; set; } = true;

    public ICollection<QuizAttemptAnswer> Answers { get; set; } = new List<QuizAttemptAnswer>();

    public ICollection<QuizAttemptQuestion> AttemptQuestions { get; set; } = new List<QuizAttemptQuestion>();
}

/// <summary>
/// Questions assigned to a specific quiz attempt (subset of the pool when random selection is enabled).
/// </summary>
public class QuizAttemptQuestion
{
    [Key]
    public long Id { get; set; }

    public long QuizAttemptId { get; set; }
    [ForeignKey(nameof(QuizAttemptId))]
    public QuizAttempt? QuizAttempt { get; set; }

    public long QuizQuestionId { get; set; }
    [ForeignKey(nameof(QuizQuestionId))]
    public QuizQuestion? QuizQuestion { get; set; }

    public long? QuestionBankQuestionId { get; set; }

    public int DisplayOrder { get; set; }
}

/// <summary>
/// Per-question answer and timing for a quiz attempt.
/// </summary>
public class QuizAttemptAnswer
{
    [Key]
    public long Id { get; set; }

    public long QuizAttemptId { get; set; }
    [ForeignKey(nameof(QuizAttemptId))]
    public QuizAttempt? QuizAttempt { get; set; }

    public long QuizQuestionId { get; set; }
    [ForeignKey(nameof(QuizQuestionId))]
    public QuizQuestion? QuizQuestion { get; set; }

    public long? QuestionBankQuestionId { get; set; }

    public long? SelectedOptionId { get; set; }

    /// <summary>JSON array of option IDs for mc_multi questions.</summary>
    public string? SelectedOptionIdsJson { get; set; }

    /// <summary>JSON array of QuestionBank option IDs for bank-backed questions.</summary>
    public string? SelectedQuestionBankOptionIdsJson { get; set; }

    public bool IsCorrect { get; set; }

    public int ResponseTimeMs { get; set; }
}
