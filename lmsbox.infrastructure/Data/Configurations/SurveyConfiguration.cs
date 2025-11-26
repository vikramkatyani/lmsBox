using lmsbox.domain.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace lmsbox.infrastructure.Data.Configurations;

public class SurveyConfiguration : IEntityTypeConfiguration<Survey>
{
    public void Configure(EntityTypeBuilder<Survey> builder)
    {
        // Configure cascade delete behavior to avoid cycles
        builder.HasOne(s => s.Organisation)
            .WithMany()
            .HasForeignKey(s => s.OrganisationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.CreatedByUser)
            .WithMany()
            .HasForeignKey(s => s.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class SurveyResponseConfiguration : IEntityTypeConfiguration<SurveyResponse>
{
    public void Configure(EntityTypeBuilder<SurveyResponse> builder)
    {
        // Configure cascade delete behavior to avoid cycles
        builder.HasOne(sr => sr.Survey)
            .WithMany(s => s.Responses)
            .HasForeignKey(sr => sr.SurveyId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(sr => sr.User)
            .WithMany()
            .HasForeignKey(sr => sr.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(sr => sr.Course)
            .WithMany()
            .HasForeignKey(sr => sr.CourseId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class SurveyQuestionConfiguration : IEntityTypeConfiguration<SurveyQuestion>
{
    public void Configure(EntityTypeBuilder<SurveyQuestion> builder)
    {
        builder.HasOne(sq => sq.Survey)
            .WithMany(s => s.Questions)
            .HasForeignKey(sq => sq.SurveyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class SurveyQuestionResponseConfiguration : IEntityTypeConfiguration<SurveyQuestionResponse>
{
    public void Configure(EntityTypeBuilder<SurveyQuestionResponse> builder)
    {
        builder.HasOne(sqr => sqr.SurveyResponse)
            .WithMany(sr => sr.QuestionResponses)
            .HasForeignKey(sqr => sqr.SurveyResponseId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(sqr => sqr.SurveyQuestion)
            .WithMany(sq => sq.QuestionResponses)
            .HasForeignKey(sqr => sqr.SurveyQuestionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
