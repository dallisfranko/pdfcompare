using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;
using PdfOverlay.App.ViewModels;
using PdfOverlay.App.Views;
using PdfOverlay.Core.Services;

namespace PdfOverlay.App;

public partial class App : Application
{
    private ITempWorkspace? _tempWorkspace;
    private MainViewModel? _mainViewModel;

    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
    }

    public override void OnFrameworkInitializationCompleted()
    {
        _tempWorkspace = TempWorkspace.CreateForPortableApp();
        var pdfService = new PdfDocumentService();
        var overlayComposer = new OverlayComposer();
        var projectExport = new ProjectExportService();

        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            _mainViewModel = new MainViewModel(_tempWorkspace, pdfService, overlayComposer, projectExport);
            if (_tempWorkspace.IsUsingFallbackLocation)
            {
                _mainViewModel.StatusMessage =
                    "Portable temp folder was not writable (for example a read-only USB). " +
                    $"Using fallback: {_tempWorkspace.RootPath}. You can choose another folder anytime.";
            }
            var mainWindow = new MainWindow
            {
                DataContext = _mainViewModel,
            };
            desktop.MainWindow = mainWindow;
            desktop.ShutdownRequested += OnShutdownRequested;
        }

        base.OnFrameworkInitializationCompleted();
    }

    private void OnShutdownRequested(object? sender, ShutdownRequestedEventArgs e)
    {
        try
        {
            _mainViewModel?.Dispose();
        }
        finally
        {
            _tempWorkspace?.Dispose();
            _tempWorkspace = null;
        }
    }
}
