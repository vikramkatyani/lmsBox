namespace lmsBox.Server.Services;

public static class InteractiveLessonConstants
{
    public const int MaxBlocksPerLesson = 5;

    /// <summary>
    /// Active limit per questionnaire block. Set to <see cref="MaxQuestionnaireQuestionsPerBlock"/> to allow multiple questions.
    /// </summary>
    public const int QuestionnaireQuestionsPerBlock = 1;

    /// <summary>Ceiling per block when multi-question questionnaires are enabled.</summary>
    public const int MaxQuestionnaireQuestionsPerBlock = 20;

    public const int MaxAiQuestionnaireQuestions = 10;
    public const int MaxCarouselSlides = 10;
    public const int MaxAiCarouselSlides = 10;
    public const int MaxAccordionPanels = 10;
    public const int MaxAiAccordionPanels = 10;
    public const int MaxTextHeadingLength = 200;
    public const int MaxTextSubheadingLength = 300;
    public const int MaxTextBodyLength = 10000;
    public const int MaxVideoTitleLength = 200;
    public const int MaxVideoDescriptionLength = 2000;
    public const int MaxVideoUrlLength = 2000;

    public static int EffectiveMaxAiQuestionnaireQuestions =>
        Math.Min(MaxAiQuestionnaireQuestions, QuestionnaireQuestionsPerBlock);
}
