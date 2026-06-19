using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace ShortcutDeck;

public static class ActionRunner
{
    public static async Task RunAsync(ShortcutTile tile, Form owner)
    {
        if (tile.IsBlank)
        {
            throw new InvalidOperationException("비어 있는 타일입니다.");
        }

        var value = tile.ActionValue.Trim();
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException("실행 값이 비어 있습니다.");
        }

        switch (tile.ActionType)
        {
            case ShortcutActionType.Url:
                Start(value);
                break;
            case ShortcutActionType.File:
                if (!File.Exists(value))
                {
                    throw new FileNotFoundException("파일을 찾을 수 없습니다.", value);
                }
                Start(value);
                break;
            case ShortcutActionType.Folder:
                if (!Directory.Exists(value))
                {
                    throw new DirectoryNotFoundException($"폴더를 찾을 수 없습니다: {value}");
                }
                Start(value);
                break;
            case ShortcutActionType.App:
                Start(value);
                break;
            case ShortcutActionType.Hotkey:
                await SendHotkeyAsync(value, owner);
                break;
            case ShortcutActionType.Text:
                await PasteTextAsync(value, owner);
                break;
            default:
                throw new InvalidOperationException("지원하지 않는 실행 방식입니다.");
        }
    }

    private static void Start(string target)
    {
        Process.Start(new ProcessStartInfo(target)
        {
            UseShellExecute = true
        });
    }

    private static async Task SendHotkeyAsync(string hotkey, Form owner)
    {
        var sendKeys = ConvertToSendKeys(hotkey);
        owner.WindowState = FormWindowState.Minimized;
        await Task.Delay(250);
        SendKeys.SendWait(sendKeys);
    }

    private static async Task PasteTextAsync(string text, Form owner)
    {
        Clipboard.SetText(text);
        owner.WindowState = FormWindowState.Minimized;
        await Task.Delay(250);
        SendKeys.SendWait("^v");
    }

    private static string ConvertToSendKeys(string hotkey)
    {
        var parts = hotkey
            .Split('+', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .ToList();

        if (parts.Count == 0)
        {
            throw new InvalidOperationException("단축키 형식이 올바르지 않습니다.");
        }

        var prefix = "";
        parts.RemoveAll(part =>
        {
            if (part.Equals("Ctrl", StringComparison.OrdinalIgnoreCase) ||
                part.Equals("Control", StringComparison.OrdinalIgnoreCase))
            {
                prefix += "^";
                return true;
            }

            if (part.Equals("Shift", StringComparison.OrdinalIgnoreCase))
            {
                prefix += "+";
                return true;
            }

            if (part.Equals("Alt", StringComparison.OrdinalIgnoreCase))
            {
                prefix += "%";
                return true;
            }

            if (part.Equals("Win", StringComparison.OrdinalIgnoreCase) ||
                part.Equals("Windows", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Windows 키 조합은 현재 전송 방식에서 지원하지 않습니다.");
            }

            return false;
        });

        if (parts.Count != 1)
        {
            throw new InvalidOperationException("단축키는 Ctrl+Shift+S 같은 형식으로 입력하세요.");
        }

        return prefix + MapKey(parts[0]);
    }

    private static string MapKey(string key)
    {
        key = key.Trim();
        if (key.Length == 1)
        {
            return char.IsLetterOrDigit(key[0])
                ? key.ToLowerInvariant()
                : "{" + key + "}";
        }

        if (key.StartsWith("F", StringComparison.OrdinalIgnoreCase) &&
            int.TryParse(key[1..], out var functionNumber) &&
            functionNumber is >= 1 and <= 24)
        {
            return "{" + key.ToUpperInvariant() + "}";
        }

        return key.ToLowerInvariant() switch
        {
            "enter" or "return" => "{ENTER}",
            "esc" or "escape" => "{ESC}",
            "tab" => "{TAB}",
            "space" => " ",
            "backspace" => "{BACKSPACE}",
            "delete" or "del" => "{DELETE}",
            "insert" or "ins" => "{INSERT}",
            "home" => "{HOME}",
            "end" => "{END}",
            "pageup" or "pgup" => "{PGUP}",
            "pagedown" or "pgdn" => "{PGDN}",
            "up" => "{UP}",
            "down" => "{DOWN}",
            "left" => "{LEFT}",
            "right" => "{RIGHT}",
            _ => "{" + key.ToUpperInvariant() + "}"
        };
    }
}
