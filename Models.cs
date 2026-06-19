using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;

namespace ShortcutDeck;

public enum DeckLayout
{
    ThreeByThree,
    FiveByThree,
    FiveByFour
}

public enum ShortcutActionType
{
    Url,
    File,
    Folder,
    App,
    Hotkey,
    Text
}

public sealed class ShortcutTile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = "";
    public ShortcutActionType ActionType { get; set; } = ShortcutActionType.Url;
    public string ActionValue { get; set; } = "";
    public string IconId { get; set; } = IconCatalog.TextOnlyIconId;
    public string Background { get; set; } = "#243447";
    public string Foreground { get; set; } = "#FFFFFF";
    public string Notes { get; set; } = "";

    [JsonIgnore]
    public bool IsBlank => string.IsNullOrWhiteSpace(Title) && string.IsNullOrWhiteSpace(ActionValue);

    public static ShortcutTile Blank()
    {
        return new ShortcutTile();
    }

    public ShortcutTile Clone()
    {
        return new ShortcutTile
        {
            Id = Guid.NewGuid(),
            Title = Title,
            ActionType = ActionType,
            ActionValue = ActionValue,
            IconId = IconId,
            Background = Background,
            Foreground = Foreground,
            Notes = Notes
        };
    }
}

public sealed class DeckProfile
{
    public string Name { get; set; } = "Default";
    public DeckLayout Layout { get; set; } = DeckLayout.FiveByThree;
    public List<ShortcutTile> Tiles { get; set; } = new();
}

public sealed class DeckStore
{
    public int ActiveProfileIndex { get; set; }
    public List<DeckProfile> Profiles { get; set; } = new();
}

public sealed class ShortcutTemplate
{
    public string Category { get; init; } = "";
    public string Title { get; init; } = "";
    public ShortcutActionType ActionType { get; init; }
    public string ActionValue { get; init; } = "";
    public string IconId { get; init; } = IconCatalog.TextOnlyIconId;
    public string Background { get; init; } = "#243447";
    public string Notes { get; init; } = "";

    public ShortcutTile ToTile()
    {
        return new ShortcutTile
        {
            Title = Title,
            ActionType = ActionType,
            ActionValue = ActionValue,
            IconId = IconId,
            Background = Background,
            Foreground = "#FFFFFF",
            Notes = Notes
        };
    }

    public override string ToString()
    {
        return $"{Category} | {Title}";
    }
}

public sealed record LayoutOption(DeckLayout Layout, string Label)
{
    public override string ToString() => Label;
}

public sealed record ActionTypeOption(ShortcutActionType Type, string Label)
{
    public override string ToString() => Label;
}

public sealed record IconOption(string Id, string Label)
{
    public override string ToString() => Label;
}

public sealed record ColorOption(string Hex, string Label)
{
    public override string ToString() => $"{Label}  {Hex}";
}

public static class DeckLayoutExtensions
{
    public const int MaxTileCount = 20;

    public static IReadOnlyList<LayoutOption> Options { get; } = new[]
    {
        new LayoutOption(DeckLayout.ThreeByThree, "3 x 3"),
        new LayoutOption(DeckLayout.FiveByThree, "5 x 3"),
        new LayoutOption(DeckLayout.FiveByFour, "5 x 4")
    };

    public static (int Columns, int Rows) Size(this DeckLayout layout)
    {
        return layout switch
        {
            DeckLayout.ThreeByThree => (3, 3),
            DeckLayout.FiveByThree => (5, 3),
            DeckLayout.FiveByFour => (5, 4),
            _ => (5, 3)
        };
    }

    public static int VisibleCount(this DeckLayout layout)
    {
        var (columns, rows) = layout.Size();
        return columns * rows;
    }

    public static string DisplayName(this ShortcutActionType type)
    {
        return type switch
        {
            ShortcutActionType.Url => "URL 열기",
            ShortcutActionType.File => "파일 열기",
            ShortcutActionType.Folder => "폴더 열기",
            ShortcutActionType.App => "앱 실행",
            ShortcutActionType.Hotkey => "키보드 단축키",
            ShortcutActionType.Text => "텍스트 붙여넣기",
            _ => type.ToString()
        };
    }

    public static IReadOnlyList<ActionTypeOption> ActionOptions { get; } = Enum
        .GetValues<ShortcutActionType>()
        .Select(type => new ActionTypeOption(type, type.DisplayName()))
        .ToList();
}
