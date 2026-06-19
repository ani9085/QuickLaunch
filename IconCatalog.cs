using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Linq;

namespace ShortcutDeck;

public enum IconKind
{
    PurchaseOrder,
    Request,
    Vendor,
    Contract,
    Invoice,
    Approval,
    Budget,
    Delivery,
    Inventory,
    Quality,
    Report,
    Analytics,
    Calendar,
    Mail,
    Chat,
    Spreadsheet,
    Erp,
    Search,
    Risk,
    Settings
}

public sealed record IconDefinition(
    string Id,
    string Name,
    IconKind Kind,
    string Label,
    Color Background,
    Color Foreground);

public static class IconCatalog
{
    public const string TextOnlyIconId = "text-only";

    private sealed record IconBase(string Key, string Name, IconKind Kind, string Label);
    private sealed record IconPalette(string Key, string Name, string Background, string Foreground);

    private static readonly Lazy<IReadOnlyList<IconDefinition>> LazyIcons = new(CreateIcons);

    public static IReadOnlyList<IconDefinition> Icons => LazyIcons.Value;

    public static IReadOnlyList<IconOption> Options { get; } = new[]
    {
        new IconOption(TextOnlyIconId, "텍스트만")
    }.Concat(Icons.Select(icon => new IconOption(icon.Id, icon.Name))).ToList();

    public static IconDefinition? Find(string? iconId)
    {
        if (string.IsNullOrWhiteSpace(iconId) || iconId == TextOnlyIconId)
        {
            return null;
        }

        return Icons.FirstOrDefault(icon => string.Equals(icon.Id, iconId, StringComparison.OrdinalIgnoreCase));
    }

    public static void DrawIcon(Graphics graphics, string? iconId, Rectangle bounds, Color color, string title)
    {
        var icon = Find(iconId);
        graphics.SmoothingMode = SmoothingMode.AntiAlias;

        if (icon is null)
        {
            DrawTextOnly(graphics, bounds, color, title);
            return;
        }

        DrawKind(graphics, icon.Kind, bounds, color, icon.Label);
    }

    private static IReadOnlyList<IconDefinition> CreateIcons()
    {
        var bases = new[]
        {
            new IconBase("po", "PO 주문", IconKind.PurchaseOrder, "PO"),
            new IconBase("rfq", "RFQ 요청", IconKind.Request, "RFQ"),
            new IconBase("vendor", "거래처", IconKind.Vendor, "VEN"),
            new IconBase("contract", "계약", IconKind.Contract, "CTR"),
            new IconBase("invoice", "인보이스", IconKind.Invoice, "INV"),
            new IconBase("approval", "승인", IconKind.Approval, "OK"),
            new IconBase("budget", "예산", IconKind.Budget, "BUD"),
            new IconBase("delivery", "납기", IconKind.Delivery, "DEL"),
            new IconBase("inventory", "재고", IconKind.Inventory, "STK"),
            new IconBase("quality", "품질", IconKind.Quality, "QA"),
            new IconBase("report", "리포트", IconKind.Report, "RPT"),
            new IconBase("analytics", "분석", IconKind.Analytics, "BI"),
            new IconBase("calendar", "일정", IconKind.Calendar, "CAL"),
            new IconBase("mail", "메일", IconKind.Mail, "MSG"),
            new IconBase("chat", "협업", IconKind.Chat, "TALK"),
            new IconBase("sheet", "스프레드시트", IconKind.Spreadsheet, "XLS"),
            new IconBase("erp", "ERP", IconKind.Erp, "ERP"),
            new IconBase("search", "검색", IconKind.Search, "SRCH"),
            new IconBase("risk", "리스크", IconKind.Risk, "!"),
            new IconBase("settings", "설정", IconKind.Settings, "SET")
        };

        var palettes = new[]
        {
            new IconPalette("blue", "블루", "#2563EB", "#FFFFFF"),
            new IconPalette("teal", "틸", "#0F766E", "#FFFFFF"),
            new IconPalette("amber", "앰버", "#B45309", "#FFFFFF"),
            new IconPalette("rose", "로즈", "#BE123C", "#FFFFFF"),
            new IconPalette("slate", "슬레이트", "#334155", "#FFFFFF")
        };

        return bases
            .SelectMany(iconBase => palettes.Select(palette => new IconDefinition(
                $"{iconBase.Key}-{palette.Key}",
                $"{iconBase.Name} / {palette.Name}",
                iconBase.Kind,
                iconBase.Label,
                UiUtil.FromHex(palette.Background, Color.SteelBlue),
                UiUtil.FromHex(palette.Foreground, Color.White))))
            .ToList();
    }

    private static void DrawTextOnly(Graphics graphics, Rectangle bounds, Color color, string title)
    {
        using var font = new Font("Segoe UI Semibold", Math.Max(14, bounds.Height / 3), FontStyle.Bold, GraphicsUnit.Pixel);
        using var brush = new SolidBrush(color);
        var text = UiUtil.Initials(title);
        var format = new StringFormat
        {
            Alignment = StringAlignment.Center,
            LineAlignment = StringAlignment.Center
        };
        graphics.DrawString(text, font, brush, bounds, format);
    }

    private static void DrawKind(Graphics graphics, IconKind kind, Rectangle bounds, Color color, string label)
    {
        var pad = Math.Max(4, bounds.Width / 12);
        var rect = Rectangle.Inflate(bounds, -pad, -pad);
        var stroke = Math.Max(2, bounds.Width / 17);

        using var pen = new Pen(color, stroke)
        {
            StartCap = LineCap.Round,
            EndCap = LineCap.Round,
            LineJoin = LineJoin.Round
        };
        using var thinPen = new Pen(Color.FromArgb(190, color), Math.Max(1, stroke - 1))
        {
            StartCap = LineCap.Round,
            EndCap = LineCap.Round,
            LineJoin = LineJoin.Round
        };
        using var brush = new SolidBrush(Color.FromArgb(230, color));
        using var dimBrush = new SolidBrush(Color.FromArgb(60, color));

        switch (kind)
        {
            case IconKind.PurchaseOrder:
                DrawDocument(graphics, rect, pen, thinPen);
                DrawSmallLabel(graphics, rect, color, label);
                break;
            case IconKind.Request:
                DrawClipboard(graphics, rect, pen, thinPen);
                break;
            case IconKind.Vendor:
                DrawUser(graphics, rect, pen, dimBrush);
                break;
            case IconKind.Contract:
                DrawDocument(graphics, rect, pen, thinPen);
                graphics.DrawLine(pen, rect.Left + rect.Width * 0.22f, rect.Bottom - rect.Height * 0.28f, rect.Right - rect.Width * 0.22f, rect.Bottom - rect.Height * 0.28f);
                break;
            case IconKind.Invoice:
                DrawReceipt(graphics, rect, pen, thinPen);
                break;
            case IconKind.Approval:
                graphics.DrawLines(pen, new[]
                {
                    new PointF(rect.Left + rect.Width * 0.18f, rect.Top + rect.Height * 0.52f),
                    new PointF(rect.Left + rect.Width * 0.42f, rect.Bottom - rect.Height * 0.22f),
                    new PointF(rect.Right - rect.Width * 0.14f, rect.Top + rect.Height * 0.25f)
                });
                break;
            case IconKind.Budget:
                DrawCard(graphics, rect, pen, thinPen);
                DrawSmallLabel(graphics, rect, color, "$");
                break;
            case IconKind.Delivery:
                DrawTruck(graphics, rect, pen, thinPen, dimBrush);
                break;
            case IconKind.Inventory:
                DrawBox(graphics, rect, pen, thinPen);
                break;
            case IconKind.Quality:
                DrawShield(graphics, rect, pen, thinPen);
                break;
            case IconKind.Report:
                DrawDocument(graphics, rect, pen, thinPen);
                DrawBars(graphics, Rectangle.Inflate(rect, -rect.Width / 5, -rect.Height / 4), brush);
                break;
            case IconKind.Analytics:
                DrawChart(graphics, rect, pen, brush);
                break;
            case IconKind.Calendar:
                DrawCalendar(graphics, rect, pen, thinPen);
                break;
            case IconKind.Mail:
                DrawMail(graphics, rect, pen, thinPen);
                break;
            case IconKind.Chat:
                DrawChat(graphics, rect, pen, thinPen);
                break;
            case IconKind.Spreadsheet:
                DrawSpreadsheet(graphics, rect, pen, thinPen);
                break;
            case IconKind.Erp:
                DrawGlobe(graphics, rect, pen, thinPen);
                DrawSmallLabel(graphics, rect, color, "E");
                break;
            case IconKind.Search:
                DrawSearch(graphics, rect, pen);
                break;
            case IconKind.Risk:
                DrawWarning(graphics, rect, pen, color);
                break;
            case IconKind.Settings:
                DrawGear(graphics, rect, pen, thinPen);
                break;
            default:
                DrawTextOnly(graphics, rect, color, label);
                break;
        }
    }

    private static void DrawDocument(Graphics g, Rectangle rect, Pen pen, Pen thinPen)
    {
        var points = new[]
        {
            new PointF(rect.Left + rect.Width * 0.22f, rect.Top + rect.Height * 0.08f),
            new PointF(rect.Right - rect.Width * 0.24f, rect.Top + rect.Height * 0.08f),
            new PointF(rect.Right - rect.Width * 0.08f, rect.Top + rect.Height * 0.24f),
            new PointF(rect.Right - rect.Width * 0.08f, rect.Bottom - rect.Height * 0.08f),
            new PointF(rect.Left + rect.Width * 0.22f, rect.Bottom - rect.Height * 0.08f)
        };
        g.DrawPolygon(pen, points);
        g.DrawLine(thinPen, rect.Right - rect.Width * 0.24f, rect.Top + rect.Height * 0.08f, rect.Right - rect.Width * 0.24f, rect.Top + rect.Height * 0.25f);
        g.DrawLine(thinPen, rect.Right - rect.Width * 0.24f, rect.Top + rect.Height * 0.25f, rect.Right - rect.Width * 0.08f, rect.Top + rect.Height * 0.25f);
        g.DrawLine(thinPen, rect.Left + rect.Width * 0.34f, rect.Top + rect.Height * 0.46f, rect.Right - rect.Width * 0.22f, rect.Top + rect.Height * 0.46f);
        g.DrawLine(thinPen, rect.Left + rect.Width * 0.34f, rect.Top + rect.Height * 0.62f, rect.Right - rect.Width * 0.22f, rect.Top + rect.Height * 0.62f);
    }

    private static void DrawClipboard(Graphics g, Rectangle rect, Pen pen, Pen thinPen)
    {
        g.DrawRectangle(pen, rect.Left + rect.Width / 5, rect.Top + rect.Height / 5, rect.Width * 3 / 5, rect.Height * 2 / 3);
        g.DrawRectangle(thinPen, rect.Left + rect.Width * 3 / 8, rect.Top + rect.Height / 9, rect.Width / 4, rect.Height / 5);
        g.DrawLine(thinPen, rect.Left + rect.Width / 3, rect.Top + rect.Height / 2, rect.Right - rect.Width / 3, rect.Top + rect.Height / 2);
        g.DrawLine(thinPen, rect.Left + rect.Width / 3, rect.Top + rect.Height * 2 / 3, rect.Right - rect.Width / 3, rect.Top + rect.Height * 2 / 3);
    }

    private static void DrawUser(Graphics g, Rectangle rect, Pen pen, Brush fill)
    {
        var head = new RectangleF(rect.Left + rect.Width * 0.34f, rect.Top + rect.Height * 0.12f, rect.Width * 0.32f, rect.Width * 0.32f);
        g.FillEllipse(fill, head);
        g.DrawEllipse(pen, head);
        var body = new RectangleF(rect.Left + rect.Width * 0.22f, rect.Top + rect.Height * 0.52f, rect.Width * 0.56f, rect.Height * 0.34f);
        g.DrawArc(pen, body, 200, 140);
    }

    private static void DrawReceipt(Graphics g, Rectangle rect, Pen pen, Pen thinPen)
    {
        var left = rect.Left + rect.Width * 0.22f;
        var right = rect.Right - rect.Width * 0.22f;
        var top = rect.Top + rect.Height * 0.12f;
        var bottom = rect.Bottom - rect.Height * 0.12f;
        var zig = new[]
        {
            new PointF(left, top),
            new PointF(right, top),
            new PointF(right, bottom),
            new PointF(right - rect.Width * 0.12f, bottom - rect.Height * 0.08f),
            new PointF(right - rect.Width * 0.24f, bottom),
            new PointF(right - rect.Width * 0.36f, bottom - rect.Height * 0.08f),
            new PointF(left, bottom),
            new PointF(left, top)
        };
        g.DrawLines(pen, zig);
        g.DrawLine(thinPen, left + rect.Width * 0.14f, top + rect.Height * 0.28f, right - rect.Width * 0.14f, top + rect.Height * 0.28f);
        g.DrawLine(thinPen, left + rect.Width * 0.14f, top + rect.Height * 0.45f, right - rect.Width * 0.24f, top + rect.Height * 0.45f);
    }

    private static void DrawCard(Graphics g, Rectangle rect, Pen pen, Pen thinPen)
    {
        var card = new Rectangle(rect.Left + rect.Width / 8, rect.Top + rect.Height / 4, rect.Width * 3 / 4, rect.Height / 2);
        g.DrawRectangle(pen, card);
        g.DrawLine(thinPen, card.Left, card.Top + card.Height / 3, card.Right, card.Top + card.Height / 3);
    }

    private static void DrawTruck(Graphics g, Rectangle rect, Pen pen, Pen thinPen, Brush fill)
    {
        var body = new RectangleF(rect.Left + rect.Width * 0.1f, rect.Top + rect.Height * 0.35f, rect.Width * 0.48f, rect.Height * 0.28f);
        var cab = new RectangleF(rect.Left + rect.Width * 0.58f, rect.Top + rect.Height * 0.42f, rect.Width * 0.28f, rect.Height * 0.21f);
        g.FillRectangle(fill, body);
        g.DrawRectangle(pen, body.X, body.Y, body.Width, body.Height);
        g.DrawRectangle(pen, cab.X, cab.Y, cab.Width, cab.Height);
        g.DrawLine(thinPen, rect.Left + rect.Width * 0.66f, rect.Top + rect.Height * 0.42f, rect.Left + rect.Width * 0.75f, rect.Top + rect.Height * 0.52f);
        g.DrawEllipse(pen, rect.Left + rect.Width * 0.2f, rect.Top + rect.Height * 0.62f, rect.Width * 0.15f, rect.Width * 0.15f);
        g.DrawEllipse(pen, rect.Left + rect.Width * 0.64f, rect.Top + rect.Height * 0.62f, rect.Width * 0.15f, rect.Width * 0.15f);
    }

    private static void DrawBox(Graphics g, Rectangle rect, Pen pen, Pen thinPen)
    {
        var front = new RectangleF(rect.Left + rect.Width * 0.23f, rect.Top + rect.Height * 0.35f, rect.Width * 0.48f, rect.Height * 0.42f);
        g.DrawRectangle(pen, front.X, front.Y, front.Width, front.Height);
        g.DrawLine(thinPen, front.Left, front.Top, rect.Left + rect.Width * 0.42f, rect.Top + rect.Height * 0.2f);
        g.DrawLine(thinPen, front.Right, front.Top, rect.Left + rect.Width * 0.78f, rect.Top + rect.Height * 0.2f);
        g.DrawLine(thinPen, rect.Left + rect.Width * 0.42f, rect.Top + rect.Height * 0.2f, rect.Left + rect.Width * 0.78f, rect.Top + rect.Height * 0.2f);
        g.DrawLine(thinPen, rect.Left + rect.Width * 0.78f, rect.Top + rect.Height * 0.2f, front.Right, front.Bottom);
    }

    private static void DrawShield(Graphics g, Rectangle rect, Pen pen, Pen thinPen)
    {
        var points = new[]
        {
            new PointF(rect.Left + rect.Width * 0.5f, rect.Top + rect.Height * 0.08f),
            new PointF(rect.Right - rect.Width * 0.16f, rect.Top + rect.Height * 0.22f),
            new PointF(rect.Right - rect.Width * 0.22f, rect.Bottom - rect.Height * 0.2f),
            new PointF(rect.Left + rect.Width * 0.5f, rect.Bottom - rect.Height * 0.06f),
            new PointF(rect.Left + rect.Width * 0.22f, rect.Bottom - rect.Height * 0.2f),
            new PointF(rect.Left + rect.Width * 0.16f, rect.Top + rect.Height * 0.22f)
        };
        g.DrawPolygon(pen, points);
        g.DrawLines(thinPen, new[]
        {
            new PointF(rect.Left + rect.Width * 0.33f, rect.Top + rect.Height * 0.52f),
            new PointF(rect.Left + rect.Width * 0.46f, rect.Top + rect.Height * 0.65f),
            new PointF(rect.Left + rect.Width * 0.68f, rect.Top + rect.Height * 0.38f)
        });
    }

    private static void DrawBars(Graphics g, Rectangle rect, Brush brush)
    {
        var gap = rect.Width / 9;
        var width = rect.Width / 5;
        g.FillRectangle(brush, rect.Left + gap, rect.Bottom - rect.Height / 3, width, rect.Height / 3);
        g.FillRectangle(brush, rect.Left + gap * 2 + width, rect.Bottom - rect.Height / 2, width, rect.Height / 2);
        g.FillRectangle(brush, rect.Left + gap * 3 + width * 2, rect.Bottom - rect.Height * 2 / 3, width, rect.Height * 2 / 3);
    }

    private static void DrawChart(Graphics g, Rectangle rect, Pen pen, Brush brush)
    {
        g.DrawLine(pen, rect.Left + rect.Width * 0.16f, rect.Top + rect.Height * 0.16f, rect.Left + rect.Width * 0.16f, rect.Bottom - rect.Height * 0.14f);
        g.DrawLine(pen, rect.Left + rect.Width * 0.16f, rect.Bottom - rect.Height * 0.14f, rect.Right - rect.Width * 0.08f, rect.Bottom - rect.Height * 0.14f);
        DrawBars(g, Rectangle.Inflate(rect, -rect.Width / 6, -rect.Height / 5), brush);
    }

    private static void DrawCalendar(Graphics g, Rectangle rect, Pen pen, Pen thinPen)
    {
        var cal = new Rectangle(rect.Left + rect.Width / 6, rect.Top + rect.Height / 5, rect.Width * 2 / 3, rect.Height * 3 / 5);
        g.DrawRectangle(pen, cal);
        g.DrawLine(thinPen, cal.Left, cal.Top + cal.Height / 4, cal.Right, cal.Top + cal.Height / 4);
        g.DrawLine(thinPen, cal.Left + cal.Width / 3, cal.Top + cal.Height / 4, cal.Left + cal.Width / 3, cal.Bottom);
        g.DrawLine(thinPen, cal.Left + cal.Width * 2 / 3, cal.Top + cal.Height / 4, cal.Left + cal.Width * 2 / 3, cal.Bottom);
    }

    private static void DrawMail(Graphics g, Rectangle rect, Pen pen, Pen thinPen)
    {
        var mail = new Rectangle(rect.Left + rect.Width / 7, rect.Top + rect.Height / 4, rect.Width * 5 / 7, rect.Height / 2);
        g.DrawRectangle(pen, mail);
        g.DrawLine(thinPen, mail.Left, mail.Top, mail.Left + mail.Width / 2, mail.Top + mail.Height / 2);
        g.DrawLine(thinPen, mail.Right, mail.Top, mail.Left + mail.Width / 2, mail.Top + mail.Height / 2);
    }

    private static void DrawChat(Graphics g, Rectangle rect, Pen pen, Pen thinPen)
    {
        var bubble = new RectangleF(rect.Left + rect.Width * 0.12f, rect.Top + rect.Height * 0.22f, rect.Width * 0.72f, rect.Height * 0.45f);
        g.DrawArc(pen, bubble, 180, 180);
        g.DrawArc(pen, bubble, 0, 180);
        g.DrawLine(pen, bubble.Left + bubble.Width * 0.22f, bubble.Bottom, bubble.Left + bubble.Width * 0.12f, rect.Bottom - rect.Height * 0.12f);
        g.DrawLine(thinPen, bubble.Left + bubble.Width * 0.32f, bubble.Top + bubble.Height * 0.5f, bubble.Left + bubble.Width * 0.34f, bubble.Top + bubble.Height * 0.5f);
        g.DrawLine(thinPen, bubble.Left + bubble.Width * 0.5f, bubble.Top + bubble.Height * 0.5f, bubble.Left + bubble.Width * 0.52f, bubble.Top + bubble.Height * 0.5f);
        g.DrawLine(thinPen, bubble.Left + bubble.Width * 0.68f, bubble.Top + bubble.Height * 0.5f, bubble.Left + bubble.Width * 0.7f, bubble.Top + bubble.Height * 0.5f);
    }

    private static void DrawSpreadsheet(Graphics g, Rectangle rect, Pen pen, Pen thinPen)
    {
        var sheet = new Rectangle(rect.Left + rect.Width / 6, rect.Top + rect.Height / 7, rect.Width * 2 / 3, rect.Height * 5 / 7);
        g.DrawRectangle(pen, sheet);
        for (var i = 1; i < 3; i++)
        {
            g.DrawLine(thinPen, sheet.Left + sheet.Width * i / 3, sheet.Top, sheet.Left + sheet.Width * i / 3, sheet.Bottom);
            g.DrawLine(thinPen, sheet.Left, sheet.Top + sheet.Height * i / 3, sheet.Right, sheet.Top + sheet.Height * i / 3);
        }
    }

    private static void DrawGlobe(Graphics g, Rectangle rect, Pen pen, Pen thinPen)
    {
        var globe = new Rectangle(rect.Left + rect.Width / 6, rect.Top + rect.Height / 6, rect.Width * 2 / 3, rect.Height * 2 / 3);
        g.DrawEllipse(pen, globe);
        g.DrawLine(thinPen, globe.Left, globe.Top + globe.Height / 2, globe.Right, globe.Top + globe.Height / 2);
        g.DrawArc(thinPen, globe.Left + globe.Width / 4, globe.Top, globe.Width / 2, globe.Height, 90, 180);
        g.DrawArc(thinPen, globe.Left + globe.Width / 4, globe.Top, globe.Width / 2, globe.Height, 270, 180);
    }

    private static void DrawSearch(Graphics g, Rectangle rect, Pen pen)
    {
        var circle = new RectangleF(rect.Left + rect.Width * 0.2f, rect.Top + rect.Height * 0.18f, rect.Width * 0.46f, rect.Width * 0.46f);
        g.DrawEllipse(pen, circle);
        g.DrawLine(pen, circle.Right - rect.Width * 0.02f, circle.Bottom - rect.Height * 0.02f, rect.Right - rect.Width * 0.18f, rect.Bottom - rect.Height * 0.18f);
    }

    private static void DrawWarning(Graphics g, Rectangle rect, Pen pen, Color color)
    {
        var points = new[]
        {
            new PointF(rect.Left + rect.Width * 0.5f, rect.Top + rect.Height * 0.1f),
            new PointF(rect.Right - rect.Width * 0.12f, rect.Bottom - rect.Height * 0.12f),
            new PointF(rect.Left + rect.Width * 0.12f, rect.Bottom - rect.Height * 0.12f)
        };
        g.DrawPolygon(pen, points);
        using var font = new Font("Segoe UI Semibold", rect.Height / 2.6f, FontStyle.Bold, GraphicsUnit.Pixel);
        using var brush = new SolidBrush(color);
        var format = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
        g.DrawString("!", font, brush, rect, format);
    }

    private static void DrawGear(Graphics g, Rectangle rect, Pen pen, Pen thinPen)
    {
        var center = new PointF(rect.Left + rect.Width / 2f, rect.Top + rect.Height / 2f);
        var outer = rect.Width * 0.34f;
        for (var i = 0; i < 8; i++)
        {
            var angle = Math.PI * 2 * i / 8;
            var p1 = new PointF(center.X + (float)Math.Cos(angle) * outer * 0.78f, center.Y + (float)Math.Sin(angle) * outer * 0.78f);
            var p2 = new PointF(center.X + (float)Math.Cos(angle) * outer, center.Y + (float)Math.Sin(angle) * outer);
            g.DrawLine(thinPen, p1, p2);
        }

        g.DrawEllipse(pen, center.X - outer * 0.65f, center.Y - outer * 0.65f, outer * 1.3f, outer * 1.3f);
        g.DrawEllipse(thinPen, center.X - outer * 0.24f, center.Y - outer * 0.24f, outer * 0.48f, outer * 0.48f);
    }

    private static void DrawSmallLabel(Graphics g, Rectangle rect, Color color, string label)
    {
        using var font = new Font("Segoe UI Semibold", Math.Max(10, rect.Height / 5), FontStyle.Bold, GraphicsUnit.Pixel);
        using var brush = new SolidBrush(color);
        var labelRect = new Rectangle(rect.Left, rect.Top + rect.Height / 3, rect.Width, rect.Height / 3);
        var format = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
        g.DrawString(label, font, brush, labelRect, format);
    }
}
