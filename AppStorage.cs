using System;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ShortcutDeck;

public static class AppStorage
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() }
    };

    public static string DataDirectory =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ShortcutDeck");

    public static string StorePath => Path.Combine(DataDirectory, "profiles.json");

    public static DeckStore Load()
    {
        try
        {
            if (File.Exists(StorePath))
            {
                var json = File.ReadAllText(StorePath);
                var store = JsonSerializer.Deserialize<DeckStore>(json, JsonOptions);
                if (store is not null)
                {
                    Normalize(store);
                    return store;
                }
            }
        }
        catch
        {
            // Corrupt user settings should not stop the app from opening.
        }

        var defaultStore = new DeckStore();
        defaultStore.Profiles.Add(ProcurementLibrary.CreateDefaultProfile());
        Normalize(defaultStore);
        return defaultStore;
    }

    public static void Save(DeckStore store)
    {
        Normalize(store);
        Directory.CreateDirectory(DataDirectory);
        var json = JsonSerializer.Serialize(store, JsonOptions);
        File.WriteAllText(StorePath, json);
    }

    public static void ExportProfile(DeckProfile profile, string path)
    {
        NormalizeProfile(profile);
        var json = JsonSerializer.Serialize(profile, JsonOptions);
        File.WriteAllText(path, json);
    }

    public static DeckProfile ImportProfile(string path)
    {
        var json = File.ReadAllText(path);
        var profile = JsonSerializer.Deserialize<DeckProfile>(json, JsonOptions);
        if (profile is null)
        {
            throw new InvalidDataException("프로필 파일을 읽을 수 없습니다.");
        }

        NormalizeProfile(profile);
        return profile;
    }

    public static void Normalize(DeckStore store)
    {
        if (store.Profiles.Count == 0)
        {
            store.Profiles.Add(ProcurementLibrary.CreateDefaultProfile());
        }

        foreach (var profile in store.Profiles)
        {
            NormalizeProfile(profile);
        }

        if (store.ActiveProfileIndex < 0 || store.ActiveProfileIndex >= store.Profiles.Count)
        {
            store.ActiveProfileIndex = 0;
        }
    }

    public static void NormalizeProfile(DeckProfile profile)
    {
        if (string.IsNullOrWhiteSpace(profile.Name))
        {
            profile.Name = "Unnamed";
        }

        while (profile.Tiles.Count < DeckLayoutExtensions.MaxTileCount)
        {
            profile.Tiles.Add(ShortcutTile.Blank());
        }

        if (profile.Tiles.Count > DeckLayoutExtensions.MaxTileCount)
        {
            profile.Tiles.RemoveRange(DeckLayoutExtensions.MaxTileCount, profile.Tiles.Count - DeckLayoutExtensions.MaxTileCount);
        }

        foreach (var tile in profile.Tiles)
        {
            if (tile.Id == Guid.Empty)
            {
                tile.Id = Guid.NewGuid();
            }

            if (string.IsNullOrWhiteSpace(tile.IconId))
            {
                tile.IconId = IconCatalog.TextOnlyIconId;
            }

            if (string.IsNullOrWhiteSpace(tile.Background))
            {
                tile.Background = "#243447";
            }

            if (string.IsNullOrWhiteSpace(tile.Foreground))
            {
                tile.Foreground = "#FFFFFF";
            }
        }
    }
}
