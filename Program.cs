using System;
using System.Linq;
using System.Windows.Forms;

namespace ShortcutDeck;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Contains("--smoke-test", StringComparer.OrdinalIgnoreCase))
        {
            return RunSmokeTest();
        }

        Application.SetHighDpiMode(HighDpiMode.SystemAware);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new MainForm());
        return 0;
    }

    private static int RunSmokeTest()
    {
        try
        {
            if (IconCatalog.Icons.Count != 100)
            {
                return 2;
            }

            var profile = ProcurementLibrary.CreateDefaultProfile();
            if (profile.Tiles.Count != DeckLayoutExtensions.MaxTileCount ||
                profile.Layout.VisibleCount() != 15 ||
                profile.Tiles.Take(15).Any(tile => tile.IsBlank))
            {
                return 3;
            }

            var store = AppStorage.Load();
            if (store.Profiles.Count == 0)
            {
                return 4;
            }

            return 0;
        }
        catch
        {
            return 1;
        }
    }
}
