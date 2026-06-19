using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Windows.Forms;

namespace ShortcutDeck;

public sealed class MainForm : Form
{
    private static readonly IReadOnlyList<ColorOption> BackgroundOptions = new[]
    {
        new ColorOption("#2563EB", "블루"),
        new ColorOption("#0F766E", "틸"),
        new ColorOption("#B45309", "앰버"),
        new ColorOption("#BE123C", "로즈"),
        new ColorOption("#334155", "슬레이트"),
        new ColorOption("#15803D", "그린"),
        new ColorOption("#7C3AED", "바이올렛"),
        new ColorOption("#C2410C", "오렌지"),
        new ColorOption("#0369A1", "시안"),
        new ColorOption("#3F3F46", "징크"),
        new ColorOption("#111827", "잉크"),
        new ColorOption("#4B5563", "그레이")
    };

    private readonly DeckStore _store;
    private readonly List<DeckTileControl> _tileControls = new();

    private readonly ComboBox _profileCombo = new();
    private readonly ComboBox _layoutCombo = new();
    private readonly CheckBox _runModeCheck = new();
    private readonly CheckBox _alwaysTopCheck = new();
    private readonly TableLayoutPanel _deckGrid = new();
    private readonly ListBox _libraryList = new();
    private readonly TextBox _librarySearch = new();
    private readonly ComboBox _categoryCombo = new();
    private readonly Label _libraryCountLabel = new();
    private readonly Label _statusLabel = new();
    private readonly Label _selectedLabel = new();

    private readonly TextBox _titleBox = new();
    private readonly ComboBox _actionTypeCombo = new();
    private readonly TextBox _actionValueBox = new();
    private readonly Button _browseButton = new();
    private readonly ComboBox _iconCombo = new();
    private readonly ComboBox _backgroundCombo = new();
    private readonly TextBox _notesBox = new();

    private int _selectedIndex;
    private bool _loading;

    public MainForm()
    {
        _store = AppStorage.Load();

        Text = "ShortcutDeck";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(1080, 700);
        Size = new Size(1260, 780);
        BackColor = Color.FromArgb(15, 23, 42);
        ForeColor = Color.FromArgb(226, 232, 240);
        Font = new Font("Segoe UI", 9.2f);

        BuildUi();
        BindStaticData();
        RefreshProfiles();
        RefreshLibrary();
        RenderDeck();
        SelectTile(0);
        SetStatus($"자동 저장: {AppStorage.StorePath}");

        FormClosing += (_, _) => SaveStore();
    }

    private DeckProfile CurrentProfile => _store.Profiles[_store.ActiveProfileIndex];

    private void BuildUi()
    {
        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 3,
            RowCount = 1,
            Padding = new Padding(10),
            BackColor = BackColor
        };
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 286));
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 330));
        Controls.Add(root);

        root.Controls.Add(BuildLibraryPanel(), 0, 0);
        root.Controls.Add(BuildDeckPanel(), 1, 0);
        root.Controls.Add(BuildEditorPanel(), 2, 0);
    }

    private Control BuildLibraryPanel()
    {
        var panel = CreateSurfacePanel(new Padding(12));
        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 7
        };
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 32));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 34));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 34));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 24));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 38));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 38));
        panel.Controls.Add(layout);

        layout.Controls.Add(CreateHeader("라이브러리"), 0, 0);

        _categoryCombo.Dock = DockStyle.Fill;
        StyleCombo(_categoryCombo);
        _categoryCombo.SelectedIndexChanged += (_, _) => RefreshLibrary();
        layout.Controls.Add(_categoryCombo, 0, 1);

        _librarySearch.Dock = DockStyle.Fill;
        _librarySearch.BorderStyle = BorderStyle.FixedSingle;
        _librarySearch.TextChanged += (_, _) => RefreshLibrary();
        layout.Controls.Add(_librarySearch, 0, 2);

        _libraryList.Dock = DockStyle.Fill;
        _libraryList.BorderStyle = BorderStyle.None;
        _libraryList.BackColor = Color.FromArgb(17, 24, 39);
        _libraryList.ForeColor = Color.FromArgb(226, 232, 240);
        _libraryList.IntegralHeight = false;
        _libraryList.DoubleClick += (_, _) => ApplySelectedTemplate();
        layout.Controls.Add(_libraryList, 0, 3);

        _libraryCountLabel.Dock = DockStyle.Fill;
        _libraryCountLabel.ForeColor = Color.FromArgb(148, 163, 184);
        layout.Controls.Add(_libraryCountLabel, 0, 4);

        var applyButton = CreateButton("선택 타일에 적용");
        applyButton.Click += (_, _) => ApplySelectedTemplate();
        layout.Controls.Add(applyButton, 0, 5);

        var emptyButton = CreateButton("선택 타일 비우기");
        emptyButton.Click += (_, _) => ClearSelectedTile();
        layout.Controls.Add(emptyButton, 0, 6);

        return panel;
    }

    private Control BuildDeckPanel()
    {
        var outer = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 3,
            Padding = new Padding(10, 0, 10, 0),
            BackColor = BackColor
        };
        outer.RowStyles.Add(new RowStyle(SizeType.Absolute, 52));
        outer.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        outer.RowStyles.Add(new RowStyle(SizeType.Absolute, 30));

        var toolbar = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
            AutoScroll = true,
            BackColor = BackColor,
            Padding = new Padding(0, 4, 0, 4)
        };
        outer.Controls.Add(toolbar, 0, 0);

        toolbar.Controls.Add(CreateSmallLabel("프로필"));
        _profileCombo.Width = 150;
        StyleCombo(_profileCombo);
        _profileCombo.SelectedIndexChanged += (_, _) =>
        {
            if (_loading || _profileCombo.SelectedIndex < 0)
            {
                return;
            }

            _store.ActiveProfileIndex = _profileCombo.SelectedIndex;
            _selectedIndex = 0;
            RenderDeck();
            SelectTile(0);
            SaveStore();
        };
        toolbar.Controls.Add(_profileCombo);

        var newProfileButton = CreateToolbarButton("새");
        newProfileButton.Click += (_, _) => AddProfile();
        toolbar.Controls.Add(newProfileButton);

        var duplicateProfileButton = CreateToolbarButton("복제");
        duplicateProfileButton.Click += (_, _) => DuplicateProfile();
        toolbar.Controls.Add(duplicateProfileButton);

        var deleteProfileButton = CreateToolbarButton("삭제");
        deleteProfileButton.Click += (_, _) => DeleteProfile();
        toolbar.Controls.Add(deleteProfileButton);

        toolbar.Controls.Add(CreateSmallLabel("레이아웃"));
        _layoutCombo.Width = 88;
        StyleCombo(_layoutCombo);
        _layoutCombo.SelectedIndexChanged += (_, _) =>
        {
            if (_loading || _layoutCombo.SelectedItem is not LayoutOption option)
            {
                return;
            }

            CurrentProfile.Layout = option.Layout;
            RenderDeck();
            SelectTile(Math.Min(_selectedIndex, CurrentProfile.Layout.VisibleCount() - 1));
            SaveStore();
        };
        toolbar.Controls.Add(_layoutCombo);

        _runModeCheck.Text = "실행 모드";
        _runModeCheck.AutoSize = true;
        _runModeCheck.ForeColor = ForeColor;
        _runModeCheck.Padding = new Padding(8, 6, 4, 0);
        toolbar.Controls.Add(_runModeCheck);

        _alwaysTopCheck.Text = "항상 위";
        _alwaysTopCheck.AutoSize = true;
        _alwaysTopCheck.ForeColor = ForeColor;
        _alwaysTopCheck.Padding = new Padding(6, 6, 4, 0);
        _alwaysTopCheck.CheckedChanged += (_, _) => TopMost = _alwaysTopCheck.Checked;
        toolbar.Controls.Add(_alwaysTopCheck);

        var exportButton = CreateToolbarButton("Export");
        exportButton.Click += (_, _) => ExportProfile();
        toolbar.Controls.Add(exportButton);

        var importButton = CreateToolbarButton("Import");
        importButton.Click += (_, _) => ImportProfile();
        toolbar.Controls.Add(importButton);

        _deckGrid.Dock = DockStyle.Fill;
        _deckGrid.BackColor = Color.FromArgb(15, 23, 42);
        outer.Controls.Add(_deckGrid, 0, 1);

        _statusLabel.Dock = DockStyle.Fill;
        _statusLabel.ForeColor = Color.FromArgb(148, 163, 184);
        _statusLabel.TextAlign = ContentAlignment.MiddleLeft;
        outer.Controls.Add(_statusLabel, 0, 2);

        return outer;
    }

    private Control BuildEditorPanel()
    {
        var panel = CreateSurfacePanel(new Padding(12));
        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 19
        };
        panel.Controls.Add(layout);

        AddRow(layout, CreateHeader("타일 편집"), 32);

        _selectedLabel.Dock = DockStyle.Fill;
        _selectedLabel.ForeColor = Color.FromArgb(148, 163, 184);
        AddRow(layout, _selectedLabel, 24);

        AddRow(layout, CreateFieldLabel("이름"), 22);
        _titleBox.Dock = DockStyle.Fill;
        _titleBox.TextChanged += (_, _) => ApplyEditorToTile();
        AddRow(layout, _titleBox, 32);

        AddRow(layout, CreateFieldLabel("실행 방식"), 22);
        _actionTypeCombo.Dock = DockStyle.Fill;
        StyleCombo(_actionTypeCombo);
        _actionTypeCombo.SelectedIndexChanged += (_, _) =>
        {
            UpdateTargetMode();
            ApplyEditorToTile();
        };
        AddRow(layout, _actionTypeCombo, 32);

        AddRow(layout, CreateFieldLabel("값 / 단축키 / 텍스트"), 22);
        var targetPanel = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 2,
            RowCount = 1
        };
        targetPanel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        targetPanel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 70));
        _actionValueBox.Dock = DockStyle.Fill;
        _actionValueBox.Multiline = true;
        _actionValueBox.ScrollBars = ScrollBars.Vertical;
        _actionValueBox.TextChanged += (_, _) => ApplyEditorToTile();
        _actionValueBox.KeyDown += ActionValueBoxOnKeyDown;
        targetPanel.Controls.Add(_actionValueBox, 0, 0);
        _browseButton.Text = "찾기";
        _browseButton.Dock = DockStyle.Fill;
        _browseButton.Click += (_, _) => BrowseActionValue();
        StyleButton(_browseButton, compact: true);
        targetPanel.Controls.Add(_browseButton, 1, 0);
        AddRow(layout, targetPanel, 82);

        AddRow(layout, CreateFieldLabel($"아이콘 스킨 ({IconCatalog.Icons.Count}개)"), 22);
        _iconCombo.Dock = DockStyle.Fill;
        StyleCombo(_iconCombo);
        _iconCombo.SelectedIndexChanged += (_, _) =>
        {
            if (_loading || SelectedTile is null || _iconCombo.SelectedItem is not IconOption option)
            {
                return;
            }

            SelectedTile.IconId = option.Id;
            var icon = IconCatalog.Find(option.Id);
            if (icon is not null)
            {
                SelectedTile.Background = ColorTranslator.ToHtml(icon.Background);
                SelectBackground(SelectedTile.Background);
            }

            RefreshSelectedTile();
            SaveStore();
        };
        AddRow(layout, _iconCombo, 32);

        AddRow(layout, CreateFieldLabel("배경"), 22);
        _backgroundCombo.Dock = DockStyle.Fill;
        StyleCombo(_backgroundCombo);
        _backgroundCombo.SelectedIndexChanged += (_, _) =>
        {
            if (_loading || SelectedTile is null || _backgroundCombo.SelectedItem is not ColorOption option)
            {
                return;
            }

            SelectedTile.Background = option.Hex;
            RefreshSelectedTile();
            SaveStore();
        };
        AddRow(layout, _backgroundCombo, 32);

        AddRow(layout, CreateFieldLabel("메모"), 22);
        _notesBox.Dock = DockStyle.Fill;
        _notesBox.Multiline = true;
        _notesBox.ScrollBars = ScrollBars.Vertical;
        _notesBox.TextChanged += (_, _) => ApplyEditorToTile();
        AddRow(layout, _notesBox, 76);

        var runButton = CreateButton("실행 테스트");
        runButton.Click += async (_, _) => await RunTileAsync(_selectedIndex);
        AddRow(layout, runButton, 38);

        var duplicateButton = CreateButton("타일 복제");
        duplicateButton.Click += (_, _) => DuplicateSelectedTile();
        AddRow(layout, duplicateButton, 38);

        var movePanel = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 4,
            RowCount = 1
        };
        for (var i = 0; i < 4; i++)
        {
            movePanel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 25));
        }

        var left = CreateButton("왼쪽");
        left.Click += (_, _) => MoveSelected(-1);
        var up = CreateButton("위");
        up.Click += (_, _) => MoveSelected(-CurrentProfile.Layout.Size().Columns);
        var down = CreateButton("아래");
        down.Click += (_, _) => MoveSelected(CurrentProfile.Layout.Size().Columns);
        var right = CreateButton("오른쪽");
        right.Click += (_, _) => MoveSelected(1);
        movePanel.Controls.Add(left, 0, 0);
        movePanel.Controls.Add(up, 1, 0);
        movePanel.Controls.Add(down, 2, 0);
        movePanel.Controls.Add(right, 3, 0);
        AddRow(layout, movePanel, 38);

        var filler = new Panel { Dock = DockStyle.Fill, BackColor = panel.BackColor };
        AddRow(layout, filler, 100, SizeType.Percent);

        return panel;
    }

    private ShortcutTile? SelectedTile =>
        _selectedIndex >= 0 && _selectedIndex < CurrentProfile.Tiles.Count
            ? CurrentProfile.Tiles[_selectedIndex]
            : null;

    private void BindStaticData()
    {
        _layoutCombo.DataSource = DeckLayoutExtensions.Options.ToList();
        _actionTypeCombo.DataSource = DeckLayoutExtensions.ActionOptions.ToList();
        _iconCombo.DataSource = IconCatalog.Options.ToList();
        _backgroundCombo.DataSource = BackgroundOptions.ToList();

        _categoryCombo.Items.Clear();
        _categoryCombo.Items.Add("전체");
        foreach (var category in ProcurementLibrary.Categories)
        {
            _categoryCombo.Items.Add(category);
        }
        _categoryCombo.SelectedIndex = 0;
    }

    private void RefreshProfiles()
    {
        _loading = true;
        _profileCombo.Items.Clear();
        foreach (var profile in _store.Profiles)
        {
            _profileCombo.Items.Add(profile.Name);
        }

        _profileCombo.SelectedIndex = _store.ActiveProfileIndex;
        SelectLayout(CurrentProfile.Layout);
        _loading = false;
    }

    private void RefreshLibrary()
    {
        var query = _librarySearch.Text.Trim();
        var category = _categoryCombo.SelectedItem as string ?? "전체";

        var filtered = ProcurementLibrary.Templates.Where(template =>
        {
            var categoryMatch = category == "전체" || template.Category == category;
            var queryMatch = string.IsNullOrWhiteSpace(query) ||
                template.Title.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                template.Category.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                template.Notes.Contains(query, StringComparison.OrdinalIgnoreCase);
            return categoryMatch && queryMatch;
        }).ToList();

        _libraryList.DataSource = null;
        _libraryList.DataSource = filtered;
        _libraryCountLabel.Text = $"{filtered.Count}개 템플릿";
    }

    private void RenderDeck()
    {
        AppStorage.NormalizeProfile(CurrentProfile);
        var visibleCount = CurrentProfile.Layout.VisibleCount();
        if (_selectedIndex >= visibleCount)
        {
            _selectedIndex = visibleCount - 1;
        }

        var (columns, rows) = CurrentProfile.Layout.Size();

        _deckGrid.SuspendLayout();
        _deckGrid.Controls.Clear();
        _deckGrid.ColumnStyles.Clear();
        _deckGrid.RowStyles.Clear();
        _deckGrid.ColumnCount = columns;
        _deckGrid.RowCount = rows;
        _tileControls.Clear();

        for (var col = 0; col < columns; col++)
        {
            _deckGrid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f / columns));
        }

        for (var row = 0; row < rows; row++)
        {
            _deckGrid.RowStyles.Add(new RowStyle(SizeType.Percent, 100f / rows));
        }

        for (var index = 0; index < visibleCount; index++)
        {
            var tileControl = new DeckTileControl
            {
                Dock = DockStyle.Fill,
                SlotIndex = index,
                Tile = CurrentProfile.Tiles[index],
                IsSelected = index == _selectedIndex
            };

            var capturedIndex = index;
            tileControl.Click += (_, _) =>
            {
                if (_runModeCheck.Checked)
                {
                    _ = RunTileAsync(capturedIndex);
                    return;
                }

                SelectTile(capturedIndex);
            };
            tileControl.DoubleClick += async (_, _) => await RunTileAsync(capturedIndex);

            _tileControls.Add(tileControl);
            _deckGrid.Controls.Add(tileControl, index % columns, index / columns);
        }

        _deckGrid.ResumeLayout();
    }

    private void SelectTile(int index)
    {
        var visibleCount = CurrentProfile.Layout.VisibleCount();
        _selectedIndex = Math.Clamp(index, 0, visibleCount - 1);

        foreach (var tile in _tileControls)
        {
            tile.IsSelected = tile.SlotIndex == _selectedIndex;
        }

        LoadEditor();
    }

    private void LoadEditor()
    {
        var tile = SelectedTile;
        _loading = true;

        if (tile is null)
        {
            _selectedLabel.Text = "선택 없음";
            _titleBox.Text = "";
            _actionValueBox.Text = "";
            _notesBox.Text = "";
            _loading = false;
            return;
        }

        _selectedLabel.Text = $"슬롯 {_selectedIndex + 1}";
        _titleBox.Text = tile.Title;
        SelectActionType(tile.ActionType);
        _actionValueBox.Text = tile.ActionValue;
        SelectIcon(tile.IconId);
        SelectBackground(tile.Background);
        _notesBox.Text = tile.Notes;
        _loading = false;
        UpdateTargetMode();
    }

    private void ApplyEditorToTile()
    {
        if (_loading || SelectedTile is null)
        {
            return;
        }

        var tile = SelectedTile;
        tile.Title = _titleBox.Text;
        tile.ActionValue = _actionValueBox.Text;
        tile.Notes = _notesBox.Text;

        if (_actionTypeCombo.SelectedItem is ActionTypeOption actionOption)
        {
            tile.ActionType = actionOption.Type;
        }

        if (_iconCombo.SelectedItem is IconOption iconOption)
        {
            tile.IconId = iconOption.Id;
        }

        if (_backgroundCombo.SelectedItem is ColorOption colorOption)
        {
            tile.Background = colorOption.Hex;
        }

        RefreshSelectedTile();
        SaveStore();
    }

    private void RefreshSelectedTile()
    {
        if (_selectedIndex >= 0 && _selectedIndex < _tileControls.Count)
        {
            _tileControls[_selectedIndex].Tile = CurrentProfile.Tiles[_selectedIndex];
        }
    }

    private void ApplySelectedTemplate()
    {
        if (_libraryList.SelectedItem is not ShortcutTemplate template || SelectedTile is null)
        {
            return;
        }

        CurrentProfile.Tiles[_selectedIndex] = template.ToTile();
        SelectTile(_selectedIndex);
        RefreshSelectedTile();
        SaveStore();
        SetStatus($"적용됨: {template.Title}");
    }

    private void ClearSelectedTile()
    {
        CurrentProfile.Tiles[_selectedIndex] = ShortcutTile.Blank();
        SelectTile(_selectedIndex);
        RefreshSelectedTile();
        SaveStore();
        SetStatus("선택 타일을 비웠습니다.");
    }

    private void DuplicateSelectedTile()
    {
        if (SelectedTile is null || SelectedTile.IsBlank)
        {
            return;
        }

        var visibleCount = CurrentProfile.Layout.VisibleCount();
        var targetIndex = Enumerable
            .Range(_selectedIndex + 1, visibleCount - _selectedIndex - 1)
            .Concat(Enumerable.Range(0, _selectedIndex))
            .FirstOrDefault(index => CurrentProfile.Tiles[index].IsBlank);

        if (!CurrentProfile.Tiles[targetIndex].IsBlank)
        {
            MessageBox.Show(this, "현재 레이아웃에 빈 슬롯이 없습니다.", "ShortcutDeck", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        CurrentProfile.Tiles[targetIndex] = SelectedTile.Clone();
        RenderDeck();
        SelectTile(targetIndex);
        SaveStore();
    }

    private void MoveSelected(int delta)
    {
        var visibleCount = CurrentProfile.Layout.VisibleCount();
        var columns = CurrentProfile.Layout.Size().Columns;
        var target = _selectedIndex + delta;

        if (target < 0 || target >= visibleCount)
        {
            return;
        }

        if (delta == -1 && _selectedIndex % columns == 0)
        {
            return;
        }

        if (delta == 1 && _selectedIndex % columns == columns - 1)
        {
            return;
        }

        (CurrentProfile.Tiles[_selectedIndex], CurrentProfile.Tiles[target]) =
            (CurrentProfile.Tiles[target], CurrentProfile.Tiles[_selectedIndex]);
        RenderDeck();
        SelectTile(target);
        SaveStore();
    }

    private async System.Threading.Tasks.Task RunTileAsync(int index)
    {
        if (index < 0 || index >= CurrentProfile.Tiles.Count)
        {
            return;
        }

        try
        {
            await ActionRunner.RunAsync(CurrentProfile.Tiles[index], this);
            SetStatus($"실행됨: {CurrentProfile.Tiles[index].Title}");
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "실행 실패", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
    }

    private void AddProfile()
    {
        var profile = new DeckProfile
        {
            Name = $"프로필 {_store.Profiles.Count + 1}",
            Layout = DeckLayout.FiveByThree
        };
        AppStorage.NormalizeProfile(profile);
        _store.Profiles.Add(profile);
        _store.ActiveProfileIndex = _store.Profiles.Count - 1;
        RefreshProfiles();
        RenderDeck();
        SelectTile(0);
        SaveStore();
    }

    private void DuplicateProfile()
    {
        var clone = new DeckProfile
        {
            Name = CurrentProfile.Name + " 복사본",
            Layout = CurrentProfile.Layout,
            Tiles = CurrentProfile.Tiles.Select(tile => tile.Clone()).ToList()
        };
        AppStorage.NormalizeProfile(clone);
        _store.Profiles.Add(clone);
        _store.ActiveProfileIndex = _store.Profiles.Count - 1;
        RefreshProfiles();
        RenderDeck();
        SelectTile(0);
        SaveStore();
    }

    private void DeleteProfile()
    {
        if (_store.Profiles.Count <= 1)
        {
            MessageBox.Show(this, "마지막 프로필은 삭제할 수 없습니다.", "ShortcutDeck", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        var result = MessageBox.Show(this, $"'{CurrentProfile.Name}' 프로필을 삭제할까요?", "ShortcutDeck", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
        if (result != DialogResult.Yes)
        {
            return;
        }

        _store.Profiles.RemoveAt(_store.ActiveProfileIndex);
        _store.ActiveProfileIndex = Math.Clamp(_store.ActiveProfileIndex, 0, _store.Profiles.Count - 1);
        RefreshProfiles();
        RenderDeck();
        SelectTile(0);
        SaveStore();
    }

    private void ExportProfile()
    {
        using var dialog = new SaveFileDialog
        {
            Title = "프로필 Export",
            Filter = "ShortcutDeck profile (*.shortcutdeck.json)|*.shortcutdeck.json|JSON (*.json)|*.json",
            FileName = SanitizeFileName(CurrentProfile.Name) + ".shortcutdeck.json"
        };

        if (dialog.ShowDialog(this) != DialogResult.OK)
        {
            return;
        }

        try
        {
            AppStorage.ExportProfile(CurrentProfile, dialog.FileName);
            SetStatus($"Export 완료: {dialog.FileName}");
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "Export 실패", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
    }

    private void ImportProfile()
    {
        using var dialog = new OpenFileDialog
        {
            Title = "프로필 Import",
            Filter = "ShortcutDeck profile (*.shortcutdeck.json;*.json)|*.shortcutdeck.json;*.json|All files (*.*)|*.*"
        };

        if (dialog.ShowDialog(this) != DialogResult.OK)
        {
            return;
        }

        try
        {
            var profile = AppStorage.ImportProfile(dialog.FileName);
            var baseName = profile.Name;
            var suffix = 2;
            while (_store.Profiles.Any(existing => existing.Name.Equals(profile.Name, StringComparison.OrdinalIgnoreCase)))
            {
                profile.Name = $"{baseName} ({suffix++})";
            }

            _store.Profiles.Add(profile);
            _store.ActiveProfileIndex = _store.Profiles.Count - 1;
            RefreshProfiles();
            RenderDeck();
            SelectTile(0);
            SaveStore();
            SetStatus($"Import 완료: {profile.Name}");
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "Import 실패", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
    }

    private void BrowseActionValue()
    {
        if (_actionTypeCombo.SelectedItem is not ActionTypeOption actionOption)
        {
            return;
        }

        switch (actionOption.Type)
        {
            case ShortcutActionType.File:
                using (var fileDialog = new OpenFileDialog
                {
                    Title = "파일 선택",
                    Filter = "All files (*.*)|*.*"
                })
                {
                    if (fileDialog.ShowDialog(this) == DialogResult.OK)
                    {
                        _actionValueBox.Text = fileDialog.FileName;
                    }
                }
                break;
            case ShortcutActionType.App:
                using (var appDialog = new OpenFileDialog
                {
                    Title = "앱 선택",
                    Filter = "Executable (*.exe;*.bat;*.cmd;*.lnk)|*.exe;*.bat;*.cmd;*.lnk|All files (*.*)|*.*"
                })
                {
                    if (appDialog.ShowDialog(this) == DialogResult.OK)
                    {
                        _actionValueBox.Text = appDialog.FileName;
                    }
                }
                break;
            case ShortcutActionType.Folder:
                using (var folderDialog = new FolderBrowserDialog
                {
                    Description = "폴더 선택",
                    UseDescriptionForTitle = true
                })
                {
                    if (folderDialog.ShowDialog(this) == DialogResult.OK)
                    {
                        _actionValueBox.Text = folderDialog.SelectedPath;
                    }
                }
                break;
        }
    }

    private void ActionValueBoxOnKeyDown(object? sender, KeyEventArgs e)
    {
        if (_actionTypeCombo.SelectedItem is not ActionTypeOption option ||
            option.Type != ShortcutActionType.Hotkey)
        {
            return;
        }

        if (e.KeyCode is Keys.ControlKey or Keys.ShiftKey or Keys.Menu)
        {
            e.SuppressKeyPress = true;
            return;
        }

        var parts = new List<string>();
        if (e.Control)
        {
            parts.Add("Ctrl");
        }
        if (e.Shift)
        {
            parts.Add("Shift");
        }
        if (e.Alt)
        {
            parts.Add("Alt");
        }

        parts.Add(KeyToDisplay(e.KeyCode));
        _actionValueBox.Text = string.Join("+", parts);
        _actionValueBox.SelectionStart = _actionValueBox.Text.Length;
        e.SuppressKeyPress = true;
    }

    private void UpdateTargetMode()
    {
        if (_actionTypeCombo.SelectedItem is not ActionTypeOption option)
        {
            return;
        }

        _browseButton.Enabled = option.Type is ShortcutActionType.File or ShortcutActionType.Folder or ShortcutActionType.App;
        _actionValueBox.AcceptsReturn = option.Type == ShortcutActionType.Text;
    }

    private void SaveStore()
    {
        try
        {
            AppStorage.Save(_store);
        }
        catch (Exception ex)
        {
            SetStatus("저장 실패: " + ex.Message);
        }
    }

    private void SetStatus(string message)
    {
        _statusLabel.Text = message;
    }

    private void SelectLayout(DeckLayout layout)
    {
        foreach (var item in _layoutCombo.Items)
        {
            if (item is LayoutOption option && option.Layout == layout)
            {
                _layoutCombo.SelectedItem = option;
                return;
            }
        }
    }

    private void SelectActionType(ShortcutActionType type)
    {
        foreach (var item in _actionTypeCombo.Items)
        {
            if (item is ActionTypeOption option && option.Type == type)
            {
                _actionTypeCombo.SelectedItem = option;
                return;
            }
        }
    }

    private void SelectIcon(string iconId)
    {
        foreach (var item in _iconCombo.Items)
        {
            if (item is IconOption option && option.Id == iconId)
            {
                _iconCombo.SelectedItem = option;
                return;
            }
        }

        _iconCombo.SelectedIndex = 0;
    }

    private void SelectBackground(string background)
    {
        foreach (var item in _backgroundCombo.Items)
        {
            if (item is ColorOption option && option.Hex.Equals(background, StringComparison.OrdinalIgnoreCase))
            {
                _backgroundCombo.SelectedItem = option;
                return;
            }
        }

        _backgroundCombo.SelectedIndex = 0;
    }

    private static string KeyToDisplay(Keys key)
    {
        if (key is >= Keys.A and <= Keys.Z)
        {
            return key.ToString();
        }

        if (key is >= Keys.D0 and <= Keys.D9)
        {
            return ((int)(key - Keys.D0)).ToString();
        }

        if (key is >= Keys.NumPad0 and <= Keys.NumPad9)
        {
            return ((int)(key - Keys.NumPad0)).ToString();
        }

        return key switch
        {
            Keys.Return => "Enter",
            Keys.Escape => "Esc",
            Keys.Delete => "Delete",
            Keys.Back => "Backspace",
            Keys.PageUp => "PageUp",
            Keys.PageDown => "PageDown",
            Keys.Space => "Space",
            Keys.Left => "Left",
            Keys.Right => "Right",
            Keys.Up => "Up",
            Keys.Down => "Down",
            _ => key.ToString()
        };
    }

    private static string SanitizeFileName(string name)
    {
        foreach (var invalid in Path.GetInvalidFileNameChars())
        {
            name = name.Replace(invalid, '_');
        }

        return string.IsNullOrWhiteSpace(name) ? "shortcutdeck" : name;
    }

    private static Panel CreateSurfacePanel(Padding padding)
    {
        return new Panel
        {
            Dock = DockStyle.Fill,
            Margin = new Padding(0),
            Padding = padding,
            BackColor = Color.FromArgb(17, 24, 39)
        };
    }

    private static Label CreateHeader(string text)
    {
        return new Label
        {
            Text = text,
            Dock = DockStyle.Fill,
            ForeColor = Color.White,
            Font = new Font("Segoe UI Semibold", 12f, FontStyle.Bold),
            TextAlign = ContentAlignment.MiddleLeft
        };
    }

    private static Label CreateFieldLabel(string text)
    {
        return new Label
        {
            Text = text,
            Dock = DockStyle.Fill,
            ForeColor = Color.FromArgb(203, 213, 225),
            TextAlign = ContentAlignment.BottomLeft
        };
    }

    private static Label CreateSmallLabel(string text)
    {
        return new Label
        {
            Text = text,
            AutoSize = false,
            Width = 48,
            Height = 30,
            ForeColor = Color.FromArgb(203, 213, 225),
            TextAlign = ContentAlignment.MiddleLeft,
            Margin = new Padding(0, 2, 4, 2)
        };
    }

    private static Button CreateButton(string text)
    {
        var button = new Button { Text = text, Dock = DockStyle.Fill };
        StyleButton(button);
        return button;
    }

    private static Button CreateToolbarButton(string text)
    {
        var button = new Button
        {
            Text = text,
            Width = Math.Max(44, text.Length * 18),
            Height = 30,
            Margin = new Padding(3, 2, 3, 2)
        };
        StyleButton(button, compact: true);
        return button;
    }

    private static void StyleButton(Button button, bool compact = false)
    {
        button.FlatStyle = FlatStyle.Flat;
        button.FlatAppearance.BorderColor = Color.FromArgb(71, 85, 105);
        button.FlatAppearance.MouseOverBackColor = Color.FromArgb(51, 65, 85);
        button.FlatAppearance.MouseDownBackColor = Color.FromArgb(30, 41, 59);
        button.BackColor = Color.FromArgb(30, 41, 59);
        button.ForeColor = Color.FromArgb(226, 232, 240);
        button.Font = new Font("Segoe UI Semibold", compact ? 8.4f : 9f, FontStyle.Bold);
    }

    private static void StyleCombo(ComboBox comboBox)
    {
        comboBox.DropDownStyle = ComboBoxStyle.DropDownList;
        comboBox.FlatStyle = FlatStyle.Flat;
        comboBox.BackColor = Color.White;
        comboBox.ForeColor = Color.FromArgb(15, 23, 42);
        comboBox.Margin = new Padding(3, 2, 3, 2);
    }

    private static void AddRow(TableLayoutPanel layout, Control control, float height, SizeType sizeType = SizeType.Absolute)
    {
        var row = layout.RowStyles.Count;
        layout.RowStyles.Add(new RowStyle(sizeType, height));
        layout.Controls.Add(control, 0, row);
    }
}
