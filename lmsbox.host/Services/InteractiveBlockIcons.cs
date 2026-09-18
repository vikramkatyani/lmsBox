using System.Text.Json;

namespace lmsBox.Server.Services;

public static class InteractiveBlockIcons
{
    private const string LucidePrefix = "lucide:";
    private const string SolidSuffix = ":solid";
    private const string CatalogResourceName = "lmsBox.Server.Assets.lucide-icons.json";

    private static readonly HashSet<string> LegacyKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "document",
        "panel",
        "check",
        "shield",
        "triangle",
        "bulb",
        "info",
        "list",
        "star",
        "flag",
        "clock",
        "users",
        "book",
        "chat",
        "play",
        "globe"
    };

    private static readonly Lazy<Dictionary<string, string>> InnerSvgByName = new(LoadCatalog);

    public static bool IsAllowed(string? key)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            return true;
        }

        var value = key.Trim();
        if (LegacyKeys.Contains(value))
        {
            return true;
        }

        if (!value.StartsWith(LucidePrefix, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return TryParse(value, out var name, out _) && InnerSvgByName.Value.ContainsKey(name);
    }

    public static string Resolve(string? key, string fallbackSvg)
        => ResolveCustom(key) ?? fallbackSvg;

    public static string? ResolveCustom(string? key)
    {
        if (!TryParse(key, out var name, out var solid))
        {
            return null;
        }

        if (!InnerSvgByName.Value.TryGetValue(name, out var innerSvg) || string.IsNullOrWhiteSpace(innerSvg))
        {
            return null;
        }

        var fill = solid ? "currentColor" : "none";
        var strokeWidth = solid ? "1.5" : "2";
        return $"""<svg width="34" height="34" viewBox="0 0 24 24" fill="{fill}" stroke="currentColor" stroke-width="{strokeWidth}" stroke-linecap="round" stroke-linejoin="round">{innerSvg}</svg>""";
    }

    private static bool TryParse(string? key, out string name, out bool solid)
    {
        name = "";
        solid = false;
        if (string.IsNullOrWhiteSpace(key))
        {
            return false;
        }

        var value = key.Trim();
        if (!value.StartsWith(LucidePrefix, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var remainder = value[LucidePrefix.Length..];
        if (remainder.EndsWith(SolidSuffix, StringComparison.OrdinalIgnoreCase))
        {
            solid = true;
            remainder = remainder[..^SolidSuffix.Length];
        }

        if (remainder.Length == 0 || remainder.Any(ch => !char.IsAsciiLetterOrDigit(ch) && ch != '-'))
        {
            return false;
        }

        name = remainder.ToLowerInvariant();
        return true;
    }

    private static Dictionary<string, string> LoadCatalog()
    {
        var assembly = typeof(InteractiveBlockIcons).Assembly;
        using var stream = assembly.GetManifestResourceStream(CatalogResourceName);
        if (stream == null)
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }

        var parsed = JsonSerializer.Deserialize<Dictionary<string, string>>(stream)
            ?? new Dictionary<string, string>();
        return new Dictionary<string, string>(parsed, StringComparer.OrdinalIgnoreCase);
    }
}
