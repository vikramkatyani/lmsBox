using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace lmsbox.domain.Models
{
    // Quiz DTOs
    public class CreateQuizRequest
    {
        [Required]
        public string Title { get; set; } = null!;
        public string? Description { get; set; }
        public string? IntroductionContent { get; set; }
        public int PassingScore { get; set; } = 70;
        public bool IsTimed { get; set; } = false;
        public int TimeLimit { get; set; } = 30;
        public bool ShuffleQuestions { get; set; } = false;
        public bool ShuffleAnswers { get; set; } = false;
        public bool ShowResults { get; set; } = true;
        public bool AllowRetake { get; set; } = true;
        public int MaxAttempts { get; set; } = 3;
        /// <summary>Random questions per attempt; null or 0 = show entire pool.</summary>
        public int? QuestionsPerAttempt { get; set; }
        /// <summary>
        /// CourseId is required for course quizzes, but omitted for Question Bank quizzes.
        /// Validation is enforced in the relevant controllers.
        /// </summary>
        public string? CourseId { get; set; }
        public List<CreateQuestionRequest> Questions { get; set; } = new();
    }

    public class UpdateQuizRequest : CreateQuizRequest
    {
    }

    public class CreateQuizFromBankRequest
    {
        [Required]
        public string Title { get; set; } = null!;
        public string? Description { get; set; }
        public string? IntroductionContent { get; set; }
        public int PassingScore { get; set; } = 70;
        public bool IsTimed { get; set; } = false;
        public int TimeLimit { get; set; } = 30;
        public bool ShuffleQuestions { get; set; } = false;
        public bool ShuffleAnswers { get; set; } = false;
        public bool ShowResults { get; set; } = true;
        public bool AllowRetake { get; set; } = true;
        public int MaxAttempts { get; set; } = 3;
        public int? QuestionsPerAttempt { get; set; }
        /// <summary>
        /// Optional mapping of Category -> number of questions to show per attempt.
        /// When provided, the sum should equal QuestionsPerAttempt.
        /// </summary>
        public Dictionary<string, int>? QuestionsPerAttemptByCategory { get; set; }

        [Required]
        public string CourseId { get; set; } = null!;

        public long[] QuestionBankQuestionIds { get; set; } = Array.Empty<long>();
    }

    public class UpdateQuizFromBankRequest : CreateQuizFromBankRequest
    {
    }

    public class CreateQuestionRequest
    {
        [Required]
        public string Question { get; set; } = null!;
        public string Type { get; set; } = "mc_single";
        public int Points { get; set; } = 1;
        public string? Explanation { get; set; }
        public string? Category { get; set; }
        public bool IsCriticalSafety { get; set; }
        public List<CreateOptionRequest> Options { get; set; } = new();
    }

    public class CreateOptionRequest
    {
        [Required]
        public string Text { get; set; } = null!;
        public bool IsCorrect { get; set; } = false;
    }

    // Question Bank (global questions) DTOs
    public class CreateQuestionBankQuestionRequest
    {
        [Required]
        public string Question { get; set; } = null!;
        public string Type { get; set; } = "mc_single";
        public int Points { get; set; } = 1;
        public string? Explanation { get; set; }
        public string? Category { get; set; }
        public bool IsCriticalSafety { get; set; }
        public string[]? Tags { get; set; }
        public List<CreateOptionRequest> Options { get; set; } = new();
    }

    public class UpdateQuestionBankQuestionRequest : CreateQuestionBankQuestionRequest
    {
    }

    // User DTOs
    public class CreateUserRequest
    {
        [Required]
        [StringLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string LastName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        public string? Role { get; set; } = "Learner";
        
        public List<string>? GroupIds { get; set; }
    }

    public class UpdateUserRequest
    {
        [Required]
        [StringLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string LastName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        public string? Role { get; set; }
        
        public List<string>? GroupIds { get; set; }
    }

    // Course DTOs (learner-facing)
    public class CourseListResponse
    {
        public List<CourseItemDto> Items { get; set; } = new();
        public int Total { get; set; }
    }

    public class CourseItemDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Banner { get; set; } = string.Empty;
        public int Progress { get; set; }
        public DateTime? EnrolledDate { get; set; }
        public DateTime? LastAccessedDate { get; set; }
        public bool IsCompleted { get; set; }
        public bool CertificateEligible { get; set; }
        public DateTime? CertificateIssuedDate { get; set; }
        public string? CertificateUrl { get; set; }
    }

    public class CourseDetailDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Banner { get; set; } = string.Empty;
        public int Progress { get; set; }
        public bool IsCompleted { get; set; }
        public DateTime? CompletedAt { get; set; }
        public List<LessonDto> Lessons { get; set; } = new();
    }

    public class LessonDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty; // video, pdf, scorm, quiz, html
        public string Duration { get; set; } = string.Empty;
        public int Ordinal { get; set; }
        public int Progress { get; set; }
        public bool IsCompleted { get; set; }
        public DateTime? CompletedAt { get; set; }
        public string Url { get; set; } = string.Empty;
    }

    // Admin Course DTOs
    public class AdminCourseListResponse
    {
        public List<AdminCourseDto> Courses { get; set; } = new();
        public int Total { get; set; }
        public object? Pagination { get; set; }
    }

    public class AdminCourseDto
    {
        public string Id { get; set; } = null!;
        public string Title { get; set; } = null!;
        public string? Description { get; set; }
        public string? ShortDescription { get; set; }
        public string? Category { get; set; }
        public string[] Tags { get; set; } = Array.Empty<string>();
        public string Status { get; set; } = null!;
        public bool CertificateEnabled { get; set; }
        public string? BannerUrl { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? CreatedByUserName { get; set; }
        public string? OrganisationName { get; set; }
        public int LessonCount { get; set; }
    }

    public class AdminCourseDetailDto : AdminCourseDto
    {
        public long OrganisationId { get; set; }
        public List<AdminLessonDto> Lessons { get; set; } = new();
    }

    public class AdminLessonDto
    {
        public long Id { get; set; }
        public int Order { get; set; }
        public string Type { get; set; } = null!;
        public string Title { get; set; } = null!;
        public string? Description { get; set; }
        public bool IsOptional { get; set; }
        public string? Src { get; set; }
        public string? EntryUrl { get; set; }
        public string? QuizId { get; set; }
    }

    // Admin course request DTOs
    public class CreateCourseRequest
    {
        [Required]
        public string Title { get; set; } = null!;
        public string? Description { get; set; }
        public string? ShortDescription { get; set; }
        public string? Category { get; set; }
        public string[]? Tags { get; set; }
        public bool CertificateEnabled { get; set; } = true;
        public string? BannerUrl { get; set; }
    }

    public class UpdateCourseRequest : CreateCourseRequest
    {
        public string? Status { get; set; }
        public List<UpdateLessonDto>? Lessons { get; set; }
    }

    public class UpdateLessonDto
    {
        public long? Id { get; set; } // null for new lessons
        [Required]
        public string Title { get; set; } = null!;
        public string? Content { get; set; }
        public int Ordinal { get; set; }
        public string Type { get; set; } = "content"; // content, video, quiz, scorm, document
        public string? QuizId { get; set; }
        public string? VideoUrl { get; set; }
        public int? VideoDurationSeconds { get; set; }
        public string? ScormUrl { get; set; }
        public string? ScormEntryUrl { get; set; }
        public string? DocumentUrl { get; set; }
        public bool IsOptional { get; set; }
    }

    // Reporting DTOs
    public class CustomReportRequest
    {
        public string EntityType { get; set; } = "users"; // users, courses, pathways, progress
        public List<string> Metrics { get; set; } = new(); // Selected metrics to include
        public string? GroupBy { get; set; } // Field to group by
        public string? SortBy { get; set; } // Field to sort by
        public bool? SortDescending { get; set; } = true; // Sort direction
        public string? FilterBy { get; set; } // Field to filter by
        public object? FilterValue { get; set; } // Filter value
        public DateTime? StartDate { get; set; } // Date range start
        public DateTime? EndDate { get; set; } // Date range end
        public int? Limit { get; set; } = 100; // Max records to return
    }

    // Dev login DTO
    public class DevLoginRequest
    {
        [Required]
        public string Email { get; set; } = null!;
    }
}
