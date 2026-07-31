using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lmsbox.domain.Models;

public class QuestionBankQuestionStatsGlobal
{
    [Key]
    public long QuestionBankQuestionId { get; set; }

    [ForeignKey(nameof(QuestionBankQuestionId))]
    public QuestionBankQuestion? Question { get; set; }

    public long PresentedCount { get; set; }
    public long CorrectCount { get; set; }
    public long IncorrectCount { get; set; }
    public DateTime? LastPresentedAt { get; set; }
}

public class QuestionBankQuestionStatsCourse
{
    [Key]
    public long Id { get; set; }

    public string CourseId { get; set; } = null!;

    public long QuestionBankQuestionId { get; set; }

    [ForeignKey(nameof(QuestionBankQuestionId))]
    public QuestionBankQuestion? Question { get; set; }

    public long PresentedCount { get; set; }
    public long CorrectCount { get; set; }
    public long IncorrectCount { get; set; }
    public DateTime? LastPresentedAt { get; set; }
}

public class QuestionBankQuestionStatsQuiz
{
    [Key]
    public long Id { get; set; }

    public string QuizId { get; set; } = null!;

    public long QuestionBankQuestionId { get; set; }

    [ForeignKey(nameof(QuestionBankQuestionId))]
    public QuestionBankQuestion? Question { get; set; }

    public long PresentedCount { get; set; }
    public long CorrectCount { get; set; }
    public long IncorrectCount { get; set; }
    public DateTime? LastPresentedAt { get; set; }
}
