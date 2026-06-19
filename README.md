# QuickLaunch

Windows shortcut deck app for procurement and operations teams.

## Features

- Stream Deck style layouts: `3x3`, `5x3`, `5x4`
- Shortcut sources: library templates, manual entry, keyboard hotkeys
- Import/export profile sharing with JSON
- 100 built-in icon skins plus text-only tiles
- Multiple profiles with auto-save

## Build

```powershell
dotnet build .\ShortcutDeck.csproj -c Release
```

## Publish

Framework-dependent:

```powershell
dotnet publish .\ShortcutDeck.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o .\publish
```

Self-contained:

```powershell
dotnet publish .\ShortcutDeck.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:PublishTrimmed=false -o .\publish-self-contained
```
