namespace lmsBox.Server.Configuration;

/// <summary>
/// Quiz feature toggles. Critical safety questions auto-fail an assessment when answered incorrectly.
/// </summary>
public class QuizFeatureOptions
{
    public const string SectionName = "QuizFeatures";

    /// <summary>
    /// When false, critical safety questions are treated as normal questions (no auto-fail, hidden in admin UI).
    /// </summary>
    public bool EnableCriticalSafety { get; set; }
}
