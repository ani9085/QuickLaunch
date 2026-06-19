using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Linq;

namespace ShortcutDeck;

public static class UiUtil
{
    public static Color FromHex(string? hex, Color fallback)
    {
        if (string.IsNullOrWhiteSpace(hex))
        {
            return fallback;
        }

        try
        {
            return ColorTranslator.FromHtml(hex);
        }
        catch
        {
            return fallback;
        }
    }

    public static GraphicsPath RoundedRect(Rectangle bounds, int radius)
    {
        var path = new GraphicsPath();
        var diameter = Math.Max(1, radius * 2);
        var arc = new Rectangle(bounds.Location, new Size(diameter, diameter));

        path.AddArc(arc, 180, 90);
        arc.X = bounds.Right - diameter;
        path.AddArc(arc, 270, 90);
        arc.Y = bounds.Bottom - diameter;
        path.AddArc(arc, 0, 90);
        arc.X = bounds.Left;
        path.AddArc(arc, 90, 90);
        path.CloseFigure();

        return path;
    }

    public static string Initials(string text, int maxLength = 3)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return "+";
        }

        var words = text
            .Split(new[] { ' ', '-', '_', '/', '\\', '.', ':' }, StringSplitOptions.RemoveEmptyEntries)
            .Take(maxLength)
            .ToArray();

        if (words.Length <= 1)
        {
            return text.Trim().Length <= maxLength
                ? text.Trim().ToUpperInvariant()
                : text.Trim()[..maxLength].ToUpperInvariant();
        }

        return string.Concat(words.Select(word => char.ToUpperInvariant(word[0])));
    }

    public static Color Blend(Color a, Color b, float amount)
    {
        amount = Math.Clamp(amount, 0f, 1f);
        var r = (int)(a.R + (b.R - a.R) * amount);
        var g = (int)(a.G + (b.G - a.G) * amount);
        var bl = (int)(a.B + (b.B - a.B) * amount);
        return Color.FromArgb(r, g, bl);
    }
}
