using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace ShortcutDeck;

public sealed class DeckTileControl : Control
{
    private ShortcutTile _tile = ShortcutTile.Blank();
    private bool _hovered;
    private bool _selected;

    public DeckTileControl()
    {
        SetStyle(
            ControlStyles.AllPaintingInWmPaint |
            ControlStyles.UserPaint |
            ControlStyles.OptimizedDoubleBuffer |
            ControlStyles.ResizeRedraw,
            true);
        Cursor = Cursors.Hand;
        Margin = new Padding(8);
        MinimumSize = new Size(92, 92);
    }

    public int SlotIndex { get; set; }

    public ShortcutTile Tile
    {
        get => _tile;
        set
        {
            _tile = value;
            Invalidate();
        }
    }

    public bool IsSelected
    {
        get => _selected;
        set
        {
            _selected = value;
            Invalidate();
        }
    }

    protected override void OnMouseEnter(EventArgs e)
    {
        _hovered = true;
        Invalidate();
        base.OnMouseEnter(e);
    }

    protected override void OnMouseLeave(EventArgs e)
    {
        _hovered = false;
        Invalidate();
        base.OnMouseLeave(e);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        var graphics = e.Graphics;
        graphics.SmoothingMode = SmoothingMode.AntiAlias;
        graphics.Clear(Parent?.BackColor ?? Color.FromArgb(17, 24, 39));

        var bounds = Rectangle.Inflate(ClientRectangle, -3, -3);
        using var path = UiUtil.RoundedRect(bounds, 8);

        var background = _tile.IsBlank
            ? Color.FromArgb(31, 41, 55)
            : UiUtil.FromHex(_tile.Background, Color.FromArgb(36, 52, 71));
        var top = UiUtil.Blend(background, Color.White, _hovered ? 0.14f : 0.07f);

        using (var brush = new LinearGradientBrush(bounds, top, background, LinearGradientMode.Vertical))
        {
            graphics.FillPath(brush, path);
        }

        var borderColor = _selected
            ? Color.FromArgb(245, 158, 11)
            : _hovered
                ? Color.FromArgb(180, 226, 232, 240)
                : Color.FromArgb(60, 255, 255, 255);
        using (var borderPen = new Pen(borderColor, _selected ? 3 : 1))
        {
            graphics.DrawPath(borderPen, path);
        }

        if (_tile.IsBlank)
        {
            DrawBlank(graphics, bounds);
            return;
        }

        var foreground = UiUtil.FromHex(_tile.Foreground, Color.White);
        DrawBadge(graphics, bounds, _tile.ActionType.DisplayName());

        var iconSize = Math.Min(bounds.Width - 28, Math.Max(44, bounds.Height / 3));
        var iconRect = new Rectangle(
            bounds.Left + (bounds.Width - iconSize) / 2,
            bounds.Top + Math.Max(17, bounds.Height / 7),
            iconSize,
            iconSize);
        IconCatalog.DrawIcon(graphics, _tile.IconId, iconRect, foreground, _tile.Title);

        var titleRect = new Rectangle(
            bounds.Left + 8,
            bounds.Bottom - Math.Max(42, bounds.Height / 4),
            bounds.Width - 16,
            Math.Max(36, bounds.Height / 4));
        using var titleFont = new Font("Segoe UI Semibold", 9.5f, FontStyle.Bold);
        TextRenderer.DrawText(
            graphics,
            _tile.Title,
            titleFont,
            titleRect,
            foreground,
            TextFormatFlags.HorizontalCenter |
            TextFormatFlags.VerticalCenter |
            TextFormatFlags.WordBreak |
            TextFormatFlags.EndEllipsis);
    }

    private static void DrawBlank(Graphics graphics, Rectangle bounds)
    {
        var color = Color.FromArgb(150, 203, 213, 225);
        using var pen = new Pen(color, 2) { DashStyle = DashStyle.Dash };
        var inner = Rectangle.Inflate(bounds, -12, -12);
        using var innerPath = UiUtil.RoundedRect(inner, 8);
        graphics.DrawPath(pen, innerPath);

        using var plusPen = new Pen(color, 3)
        {
            StartCap = LineCap.Round,
            EndCap = LineCap.Round
        };
        var center = new Point(bounds.Left + bounds.Width / 2, bounds.Top + bounds.Height / 2 - 8);
        graphics.DrawLine(plusPen, center.X - 13, center.Y, center.X + 13, center.Y);
        graphics.DrawLine(plusPen, center.X, center.Y - 13, center.X, center.Y + 13);

        using var font = new Font("Segoe UI", 8.5f);
        TextRenderer.DrawText(
            graphics,
            "빈 슬롯",
            font,
            new Rectangle(bounds.Left, center.Y + 18, bounds.Width, 24),
            color,
            TextFormatFlags.HorizontalCenter |
            TextFormatFlags.VerticalCenter);
    }

    private static void DrawBadge(Graphics graphics, Rectangle bounds, string label)
    {
        var badgeText = label switch
        {
            "URL 열기" => "URL",
            "파일 열기" => "FILE",
            "폴더 열기" => "DIR",
            "앱 실행" => "APP",
            "키보드 단축키" => "KEY",
            "텍스트 붙여넣기" => "TEXT",
            _ => label
        };
        var badge = new Rectangle(bounds.Right - 52, bounds.Top + 8, 42, 19);
        using var path = UiUtil.RoundedRect(badge, 6);
        using var brush = new SolidBrush(Color.FromArgb(80, 0, 0, 0));
        graphics.FillPath(brush, path);
        using var font = new Font("Segoe UI Semibold", 7.2f, FontStyle.Bold);
        TextRenderer.DrawText(
            graphics,
            badgeText,
            font,
            badge,
            Color.White,
            TextFormatFlags.HorizontalCenter |
            TextFormatFlags.VerticalCenter |
            TextFormatFlags.EndEllipsis);
    }
}
