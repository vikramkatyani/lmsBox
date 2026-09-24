namespace lmsBox.Server.Services;

public static class InteractiveLessonConstants
{
    /// <summary>
    /// Safety cap after removing the original 5-block interactive lesson limit.
    /// Keep in sync with client INTERACTIVE_LESSON_MAX_BLOCKS.
    /// </summary>
    public const int MaxBlocksPerLesson = 100;

    /// <summary>
    /// Active limit per questionnaire block. Set to <see cref="MaxQuestionnaireQuestionsPerBlock"/> to allow multiple questions.
    /// Keep in sync with the client lessonFeatureFlags value.
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
    public const int MaxBlockIntroLength = 500;
    public const int MaxTextBodyLength = 10000;

    /// <summary>Ceiling on the raw rich text markup, which carries tags on top of the visible text.</summary>
    public const int MaxTextBodyHtmlLength = 60000;
    public const int MaxVideoTitleLength = 200;
    public const int MaxVideoDescriptionLength = 2000;
    public const int MaxVideoUrlLength = 2000;

    public const int MaxAudioTitleLength = 200;
    public const int MaxAudioDescriptionLength = 2000;
    public const int MaxAudioUrlLength = 2000;

    public const int MaxHeroKickerLength = 120;
    public const int MaxHeroTitleLength = 200;
    public const int MaxHeroIntroLength = 500;
    public const int MaxHeroMetaPills = 6;
    public const int MaxHeroMetaPillLength = 40;
    public const int MaxHeroBackgroundImageUrlLength = 2000;

    public const int MaxCardsPerBlock = 6;
    public const int MaxCardLabelLength = 80;
    public const int MaxCardTitleLength = 200;
    public const int MaxCardBodyLength = 1000;

    public const int MaxRevealItems = 8;
    public const int MaxRevealLabelLength = 60;
    public const int MaxRevealTitleLength = 200;
    public const int MaxRevealBodyLength = 2000;
    public const int MaxRevealHintLength = 160;

    public const int MaxFlipCards = 8;
    public const int MaxFlipFrontTitleLength = 200;
    public const int MaxFlipBackBodyLength = 1000;
    public const int MaxFlipHintLength = 60;

    public const int MaxRememberLabelLength = 60;
    public const int MaxRememberBodyLength = 2000;

    public const int MaxWarningLabelLength = 60;
    public const int MaxWarningBodyLength = 2000;

    public const int MaxTimelineStages = 10;
    public const int MaxTimelineTitleLength = 200;
    public const int MaxTimelineBodyLength = 2000;
    public const int MaxTimelineHintLength = 160;

    public const int MaxReflectionLabelLength = 60;
    public const int MaxReflectionTitleLength = 200;
    public const int MaxReflectionPromptLength = 500;
    public const int MaxReflectionPlaceholderLength = 160;

    public const int MaxHotspotPins = 12;
    public const int MaxHotspotImageUrlLength = 2000;
    public const int MaxHotspotImageAltLength = 300;
    public const int MaxHotspotPinTitleLength = 120;
    public const int MaxHotspotPinBodyLength = 600;

    public const int MaxProcessSteps = 8;
    public const int MaxProcessNodes = 8;
    public const int MaxProcessNodeLabelLength = 60;
    public const int MaxProcessStepTitleLength = 200;
    public const int MaxProcessStepBodyLength = 1000;
    public const int MaxProcessFinishMessageLength = 500;
    public const int MaxProcessButtonLabelLength = 60;
    public const int MaxBlockImageUrlLength = 2000;
    public const int MaxQuestionnaireFeedbackLength = 1000;
    public const int MaxIconKeyLength = 80;

    public const int MaxTabsPanels = 10;
    public const int MaxTabsHeadingLength = 200;
    public const int MaxTabsTitleLength = 200;
    public const int MaxTabsBodyLength = 2000;

    public const int MaxFlowchartNodes = 10;
    public const int MaxFlowchartHeadingLength = 200;
    public const int MaxFlowchartHintLength = 160;
    public const int MaxFlowchartTitleLength = 200;
    public const int MaxFlowchartBodyLength = 2000;

    public const int MinOrderingItems = 2;
    public const int MaxOrderingItems = 10;
    public const int MaxOrderingItemLength = 300;
    public const int MaxOrderingInstructionLength = 1000;
    public const int MaxOrderingHintLength = 160;
    public const int MaxOrderingFeedbackLength = 1000;

    public static int EffectiveMaxAiQuestionnaireQuestions =>
        Math.Min(MaxAiQuestionnaireQuestions, QuestionnaireQuestionsPerBlock);
}
