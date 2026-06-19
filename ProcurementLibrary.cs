using System;
using System.Collections.Generic;
using System.Linq;

namespace ShortcutDeck;

public static class ProcurementLibrary
{
    private static readonly Dictionary<string, string> Palette = new()
    {
        ["blue"] = "#2563EB",
        ["teal"] = "#0F766E",
        ["amber"] = "#B45309",
        ["rose"] = "#BE123C",
        ["slate"] = "#334155"
    };

    public static IReadOnlyList<ShortcutTemplate> Templates { get; } = CreateTemplates();

    public static IReadOnlyList<string> Categories { get; } = Templates
        .Select(template => template.Category)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .OrderBy(category => category)
        .ToList();

    public static DeckProfile CreateDefaultProfile()
    {
        var starterTitles = new[]
        {
            "구매요청서 작성",
            "PO 생성",
            "PO 조회",
            "RFQ 생성",
            "견적 비교표",
            "거래처 마스터",
            "공급사 포털",
            "전자계약",
            "송장 매칭",
            "납기 추적",
            "Outlook",
            "Excel",
            "Teams",
            "견적 요청 문구",
            "납기 확인 문구"
        };

        var profile = new DeckProfile
        {
            Name = "구매 업무 기본",
            Layout = DeckLayout.FiveByThree,
            Tiles = starterTitles
                .Select(title => Templates.First(template => template.Title == title).ToTile())
                .ToList()
        };

        AppStorage.NormalizeProfile(profile);
        return profile;
    }

    private static IReadOnlyList<ShortcutTemplate> CreateTemplates()
    {
        return new List<ShortcutTemplate>
        {
            T("ERP/SRM", "구매요청서 작성", ShortcutActionType.Url, "https://erp.company.local/purchase-requisitions/new", "rfq", "blue", "회사 ERP 주소로 수정해서 사용하세요."),
            T("ERP/SRM", "구매요청서 조회", ShortcutActionType.Url, "https://erp.company.local/purchase-requisitions", "search", "slate"),
            T("ERP/SRM", "PO 생성", ShortcutActionType.Url, "https://erp.company.local/purchase-orders/new", "po", "blue"),
            T("ERP/SRM", "PO 조회", ShortcutActionType.Url, "https://erp.company.local/purchase-orders", "search", "blue"),
            T("ERP/SRM", "미결 PO", ShortcutActionType.Url, "https://erp.company.local/purchase-orders/open", "po", "amber"),
            T("ERP/SRM", "발주 변경", ShortcutActionType.Url, "https://erp.company.local/purchase-orders/change", "po", "rose"),
            T("ERP/SRM", "입고 처리", ShortcutActionType.Url, "https://erp.company.local/goods-receipts/new", "delivery", "teal"),
            T("ERP/SRM", "송장 매칭", ShortcutActionType.Url, "https://erp.company.local/invoice-matching", "invoice", "amber"),
            T("ERP/SRM", "예산 조회", ShortcutActionType.Url, "https://erp.company.local/budget", "budget", "slate"),
            T("ERP/SRM", "재고 조회", ShortcutActionType.Url, "https://erp.company.local/inventory", "inventory", "teal"),
            T("ERP/SRM", "단가계약", ShortcutActionType.Url, "https://erp.company.local/contracts/pricing", "contract", "blue"),
            T("ERP/SRM", "품질 클레임", ShortcutActionType.Url, "https://erp.company.local/quality-claims", "quality", "rose"),
            T("ERP/SRM", "승인 대기함", ShortcutActionType.Url, "https://erp.company.local/approvals", "approval", "teal"),
            T("ERP/SRM", "월 구매 리포트", ShortcutActionType.Url, "https://erp.company.local/reports/purchasing-monthly", "report", "slate"),
            T("ERP/SRM", "구매 분석", ShortcutActionType.Url, "https://erp.company.local/analytics/purchasing", "analytics", "blue"),

            T("소싱", "RFQ 생성", ShortcutActionType.Url, "https://srm.company.local/rfq/new", "rfq", "blue"),
            T("소싱", "RFQ 조회", ShortcutActionType.Url, "https://srm.company.local/rfq", "search", "blue"),
            T("소싱", "견적 비교표", ShortcutActionType.App, "excel.exe", "sheet", "teal"),
            T("소싱", "공급사 포털", ShortcutActionType.Url, "https://supplier.company.local", "vendor", "teal"),
            T("소싱", "거래처 마스터", ShortcutActionType.Url, "https://erp.company.local/vendors", "vendor", "blue"),
            T("소싱", "신규 거래처 등록", ShortcutActionType.Url, "https://erp.company.local/vendors/new", "vendor", "amber"),
            T("소싱", "전자계약", ShortcutActionType.Url, "https://contract.company.local", "contract", "slate"),
            T("소싱", "벤더 리스크", ShortcutActionType.Url, "https://erp.company.local/vendor-risk", "risk", "rose"),
            T("소싱", "원가 분석 시트", ShortcutActionType.App, "excel.exe", "analytics", "teal"),

            T("납기/물류", "납기 추적", ShortcutActionType.Url, "https://erp.company.local/delivery-tracking", "delivery", "teal"),
            T("납기/물류", "긴급 납기 리스트", ShortcutActionType.Url, "https://erp.company.local/delivery-tracking/urgent", "risk", "rose"),
            T("납기/물류", "선적 서류 폴더", ShortcutActionType.Folder, "C:\\", "folder", "slate"),
            T("납기/물류", "입고 예정 캘린더", ShortcutActionType.Url, "https://erp.company.local/receipts/calendar", "calendar", "blue"),
            T("납기/물류", "물류사 연락처", ShortcutActionType.Url, "https://erp.company.local/logistics/contacts", "mail", "amber"),

            T("Office", "Outlook", ShortcutActionType.App, "outlook.exe", "mail", "blue"),
            T("Office", "새 메일", ShortcutActionType.Url, "mailto:", "mail", "teal"),
            T("Office", "Excel", ShortcutActionType.App, "excel.exe", "sheet", "teal"),
            T("Office", "Teams", ShortcutActionType.Url, "msteams:", "chat", "slate"),
            T("Office", "구매 폴더", ShortcutActionType.Folder, "C:\\", "folder", "amber"),
            T("Office", "계산기", ShortcutActionType.App, "calc.exe", "budget", "slate"),
            T("Office", "메모장", ShortcutActionType.App, "notepad.exe", "report", "slate"),
            T("Office", "캡처 도구", ShortcutActionType.Url, "ms-screenclip:", "search", "rose"),

            T("외부 조회", "환율 조회", ShortcutActionType.Url, "https://finance.naver.com/marketindex/", "budget", "blue"),
            T("외부 조회", "LME 원자재", ShortcutActionType.Url, "https://www.lme.com/", "analytics", "amber"),
            T("외부 조회", "HS Code 검색", ShortcutActionType.Url, "https://unipass.customs.go.kr/clip/index.do", "search", "slate"),
            T("외부 조회", "국세청", ShortcutActionType.Url, "https://www.nts.go.kr/", "invoice", "teal"),

            T("문구", "견적 요청 문구", ShortcutActionType.Text, "안녕하세요. 첨부 사양 기준으로 견적서와 납기 가능일을 회신 부탁드립니다.", "mail", "blue"),
            T("문구", "납기 확인 문구", ShortcutActionType.Text, "안녕하세요. 해당 PO의 현재 납기 가능일과 지연 리스크 여부 확인 부탁드립니다.", "delivery", "teal"),
            T("문구", "송장 확인 문구", ShortcutActionType.Text, "안녕하세요. 송장 정보와 PO/입고 내역 매칭 여부 확인 부탁드립니다.", "invoice", "amber"),
            T("문구", "승인 요청 문구", ShortcutActionType.Text, "검토 완료 후 승인 부탁드립니다. 특이사항은 본문 하단에 정리했습니다.", "approval", "teal"),
            T("문구", "거래처 등록 요청", ShortcutActionType.Text, "신규 거래처 등록을 위해 사업자등록증, 통장 사본, 담당자 연락처 전달 부탁드립니다.", "vendor", "blue"),
            T("문구", "계약 검토 요청", ShortcutActionType.Text, "첨부 계약서 초안 검토 부탁드립니다. 금액, 납기, 위약 조항을 중점 확인해 주세요.", "contract", "slate"),
            T("문구", "품질 이슈 통보", ShortcutActionType.Text, "입고 품질 이슈가 확인되어 원인 분석 및 개선 대책 회신 부탁드립니다.", "quality", "rose"),

            T("단축키", "복사", ShortcutActionType.Hotkey, "Ctrl+C", "settings", "slate"),
            T("단축키", "붙여넣기", ShortcutActionType.Hotkey, "Ctrl+V", "settings", "teal"),
            T("단축키", "저장", ShortcutActionType.Hotkey, "Ctrl+S", "settings", "blue"),
            T("단축키", "실행취소", ShortcutActionType.Hotkey, "Ctrl+Z", "settings", "amber"),
            T("단축키", "찾기", ShortcutActionType.Hotkey, "Ctrl+F", "search", "blue"),
            T("단축키", "새로고침", ShortcutActionType.Hotkey, "F5", "settings", "teal"),
            T("단축키", "브라우저 새 탭", ShortcutActionType.Hotkey, "Ctrl+T", "search", "slate"),
            T("단축키", "창 전환", ShortcutActionType.Hotkey, "Alt+Tab", "settings", "rose"),
            T("단축키", "작업 관리자", ShortcutActionType.Hotkey, "Ctrl+Shift+Esc", "settings", "rose")
        };
    }

    private static ShortcutTemplate T(
        string category,
        string title,
        ShortcutActionType actionType,
        string actionValue,
        string iconBase,
        string palette,
        string notes = "")
    {
        var background = Palette.TryGetValue(palette, out var color) ? color : "#334155";
        var iconId = IconCatalog.Icons.Any(icon => icon.Id == $"{iconBase}-{palette}")
            ? $"{iconBase}-{palette}"
            : IconCatalog.TextOnlyIconId;

        return new ShortcutTemplate
        {
            Category = category,
            Title = title,
            ActionType = actionType,
            ActionValue = actionValue,
            IconId = iconId,
            Background = background,
            Notes = notes
        };
    }
}
