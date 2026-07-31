namespace lmsBox.Server.Services;

public interface IInteractiveBlockPromptService
{
    IReadOnlyList<InteractiveBlockTypeSchema> GetAvailableBlockTypes();
    InteractiveBlockTypeSchema? GetBlockTypeSchema(string blockType);
    (string CompletionRuleJson, string Prompt) BuildGenerationPrompt(string blockType, string blockTitle, string formPayloadJson, string? mediaAssetsJson);
    void ValidateFormPayload(string blockType, string formPayloadJson);
}

public class InteractiveBlockTypeSchema
{
    public string Type { get; set; } = null!;
    public string Label { get; set; } = null!;
    public string Description { get; set; } = null!;
    public List<InteractiveBlockFormField> Fields { get; set; } = new();
}

public class InteractiveBlockFormField
{
    public string Name { get; set; } = null!;
    public string Label { get; set; } = null!;
    public string FieldType { get; set; } = "text";
    public bool Required { get; set; }
    public string? HelpText { get; set; }
    public object? DefaultValue { get; set; }
}
