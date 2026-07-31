using lmsBox.Server.Configuration;
using Microsoft.Extensions.Options;

namespace lmsBox.Server.Services;

public interface IQuizFeatureService
{
    bool IsCriticalSafetyEnabled { get; }

    bool ResolveCriticalSafety(bool isCriticalSafety);
}

public sealed class QuizFeatureService : IQuizFeatureService
{
    public QuizFeatureService(IOptions<QuizFeatureOptions> options)
    {
        IsCriticalSafetyEnabled = options.Value.EnableCriticalSafety;
    }

    public bool IsCriticalSafetyEnabled { get; }

    public bool ResolveCriticalSafety(bool isCriticalSafety) =>
        IsCriticalSafetyEnabled && isCriticalSafety;
}
