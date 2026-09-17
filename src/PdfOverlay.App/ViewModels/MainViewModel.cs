using System;
using System.Collections.ObjectModel;
using System.Globalization;
using System.Threading.Tasks;
using Avalonia.Media.Imaging;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using PdfOverlay.App.Services;
using PdfOverlay.Core.Models;
using PdfOverlay.Core.Services;
using SkiaSharp;

namespace PdfOverlay.App.ViewModels;

public partial class MainViewModel : ViewModelBase, IDisposable
{
    private readonly ITempWorkspace _tempWorkspace;
    private readonly IPdfDocumentService _pdfDocumentService;
    private readonly IOverlayComposer _overlayComposer;
    private readonly IProjectExportService _projectExportService;
    private readonly OverlaySession _session = new();
    private IFileDialogService? _fileDialogs;
    private SKBitmap? _pageABitmap;
    private SKBitmap? _pageBBitmap;
    private bool _disposed;
    private bool _suspendRefresh;

    public MainViewModel(
        ITempWorkspace tempWorkspace,
        IPdfDocumentService pdfDocumentService,
        IOverlayComposer overlayComposer,
        IProjectExportService projectExportService)
    {
        _tempWorkspace = tempWorkspace;
        _pdfDocumentService = pdfDocumentService;
        _overlayComposer = overlayComposer;
        _projectExportService = projectExportService;
        TempFolderPath = _tempWorkspace.RootPath;
        PrivacySummary =
            "Local-only: PDFs stay on this computer, are opened read-only, " +
            "are not uploaded, and are not kept in a recent-files list. " +
            "Alignment is memory-only unless you export a project. " +
            "Temporary files live only under the folder below and are cleared on exit.";
    }

    public void AttachFileDialogs(IFileDialogService fileDialogs) =>
        _fileDialogs = fileDialogs;

    [ObservableProperty]
    private string? _documentAName;

    [ObservableProperty]
    private string? _documentBName;

    [ObservableProperty]
    private int _pageA = 1;

    [ObservableProperty]
    private int _pageB = 1;

    [ObservableProperty]
    private int _pageACount;

    [ObservableProperty]
    private int _pageBCount;

    [ObservableProperty]
    private double _opacity = 0.5;

    [ObservableProperty]
    private double _offsetX;

    [ObservableProperty]
    private double _offsetY;

    [ObservableProperty]
    private double _topScale = 1.0;

    [ObservableProperty]
    private double _viewZoom = 1.0;

    [ObservableProperty]
    private Bitmap? _overlayPreview;

    [ObservableProperty]
    private Bitmap? _pageAPreview;

    [ObservableProperty]
    private Bitmap? _pageBPreview;

    [ObservableProperty]
    private string _statusMessage = "Open two local PDFs to begin.";

    [ObservableProperty]
    private string _tempFolderPath = string.Empty;

    [ObservableProperty]
    private string _privacySummary = string.Empty;

    public ObservableCollection<int> PageAOptions { get; } = new();
    public ObservableCollection<int> PageBOptions { get; } = new();

    public string OffsetSummary =>
        string.Create(CultureInfo.InvariantCulture, $"Offset X {OffsetX:0} · Y {OffsetY:0} · Scale {TopScale:0.##}");

    partial void OnPageAChanged(int value)
    {
        if (_suspendRefresh || _session.DocumentA is null)
        {
            return;
        }

        _session.PageA = value;
        RefreshOverlay();
    }

    partial void OnPageBChanged(int value)
    {
        if (_suspendRefresh || _session.DocumentB is null)
        {
            return;
        }

        _session.PageB = value;
        RefreshOverlay();
    }

    partial void OnOpacityChanged(double value)
    {
        if (_suspendRefresh)
        {
            return;
        }

        _session.Opacity = (float)Math.Clamp(value, 0, 1);
        RefreshOverlay(reRenderPages: false);
    }

    partial void OnOffsetXChanged(double value)
    {
        if (_suspendRefresh)
        {
            return;
        }

        _session.OffsetX = (float)value;
        OnPropertyChanged(nameof(OffsetSummary));
        RefreshOverlay(reRenderPages: false);
    }

    partial void OnOffsetYChanged(double value)
    {
        if (_suspendRefresh)
        {
            return;
        }

        _session.OffsetY = (float)value;
        OnPropertyChanged(nameof(OffsetSummary));
        RefreshOverlay(reRenderPages: false);
    }

    partial void OnTopScaleChanged(double value)
    {
        if (_suspendRefresh)
        {
            return;
        }

        _session.TopScale = (float)Math.Clamp(value, 0.1, 4);
        OnPropertyChanged(nameof(OffsetSummary));
        RefreshOverlay(reRenderPages: false);
    }

    [RelayCommand]
    private async Task OpenDocumentAAsync() => await OpenDocumentAsync(isDocumentA: true);

    [RelayCommand]
    private async Task OpenDocumentBAsync() => await OpenDocumentAsync(isDocumentA: false);

    [RelayCommand]
    private async Task ChooseTempFolderAsync()
    {
        if (_fileDialogs is null)
        {
            StatusMessage = "File dialogs are not available yet.";
            return;
        }

        var folder = await _fileDialogs.PickFolderAsync("Choose temporary working folder");
        if (string.IsNullOrWhiteSpace(folder))
        {
            return;
        }

        try
        {
            _tempWorkspace.Relocate(folder);
            TempFolderPath = _tempWorkspace.RootPath;
            StatusMessage = $"Temporary folder set to: {TempFolderPath}";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Could not set temporary folder: {ex.Message}";
        }
    }

    [RelayCommand]
    private void ClearTemporaryData()
    {
        try
        {
            _tempWorkspace.Clear();
            TempFolderPath = _tempWorkspace.RootPath;
            StatusMessage = "Temporary data cleared.";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Could not clear temporary data: {ex.Message}";
        }
    }

    [RelayCommand]
    private void Nudge(string? direction)
    {
        const double step = 1;
        switch (direction)
        {
            case "Left":
                OffsetX -= step;
                break;
            case "Right":
                OffsetX += step;
                break;
            case "Up":
                OffsetY -= step;
                break;
            case "Down":
                OffsetY += step;
                break;
            case "Left10":
                OffsetX -= 10;
                break;
            case "Right10":
                OffsetX += 10;
                break;
            case "Up10":
                OffsetY -= 10;
                break;
            case "Down10":
                OffsetY += 10;
                break;
        }
    }

    [RelayCommand]
    private void ResetAlignment()
    {
        _suspendRefresh = true;
        try
        {
            _session.ResetAlignment();
            Opacity = _session.Opacity;
            OffsetX = _session.OffsetX;
            OffsetY = _session.OffsetY;
            TopScale = _session.TopScale;
            ViewZoom = 1.0;
        }
        finally
        {
            _suspendRefresh = false;
        }

        OnPropertyChanged(nameof(OffsetSummary));
        RefreshOverlay(reRenderPages: false);
        StatusMessage = "Alignment reset (in memory only — nothing was saved).";
    }

    [RelayCommand]
    private void ZoomIn() => ViewZoom = Math.Min(3.0, Math.Round(ViewZoom + 0.25, 2));

    [RelayCommand]
    private void ZoomOut() => ViewZoom = Math.Max(0.25, Math.Round(ViewZoom - 0.25, 2));

    [RelayCommand]
    private void ZoomReset() => ViewZoom = 1.0;

    [RelayCommand]
    private async Task ExportProjectAsync()
    {
        if (_fileDialogs is null)
        {
            StatusMessage = "File dialogs are not available yet.";
            return;
        }

        var path = await _fileDialogs.SaveProjectAsync(
            "Export project (settings only — PDFs are not copied)",
            "comparison.pdfoverlay.json");
        if (string.IsNullOrWhiteSpace(path))
        {
            return;
        }

        try
        {
            var project = new ProjectFile
            {
                DocumentAPath = _session.DocumentA?.FilePath,
                DocumentBPath = _session.DocumentB?.FilePath,
                PageA = _session.PageA,
                PageB = _session.PageB,
                Opacity = _session.Opacity,
                OffsetX = _session.OffsetX,
                OffsetY = _session.OffsetY,
                TopScale = _session.TopScale,
            };
            _projectExportService.Export(path, project);
            StatusMessage = $"Project exported to {path}. PDF files were not copied.";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Could not export project: {ex.Message}";
        }
    }

    [RelayCommand]
    private async Task ImportProjectAsync()
    {
        if (_fileDialogs is null)
        {
            StatusMessage = "File dialogs are not available yet.";
            return;
        }

        var path = await _fileDialogs.PickProjectAsync("Import project");
        if (string.IsNullOrWhiteSpace(path))
        {
            return;
        }

        try
        {
            var project = _projectExportService.Import(path);
            await ApplyProjectAsync(project);
            StatusMessage = $"Project imported from {path}.";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Could not import project: {ex.Message}";
        }
    }

    private async Task ApplyProjectAsync(ProjectFile project)
    {
        _suspendRefresh = true;
        try
        {
            if (!string.IsNullOrWhiteSpace(project.DocumentAPath) && File.Exists(project.DocumentAPath))
            {
                await OpenPathAsync(project.DocumentAPath, isDocumentA: true);
            }

            if (!string.IsNullOrWhiteSpace(project.DocumentBPath) && File.Exists(project.DocumentBPath))
            {
                await OpenPathAsync(project.DocumentBPath, isDocumentA: false);
            }

            if (_session.DocumentA is not null)
            {
                PageA = Math.Clamp(project.PageA, 1, _session.DocumentA.PageCount);
                _session.PageA = PageA;
            }

            if (_session.DocumentB is not null)
            {
                PageB = Math.Clamp(project.PageB, 1, _session.DocumentB.PageCount);
                _session.PageB = PageB;
            }

            Opacity = project.Opacity;
            OffsetX = project.OffsetX;
            OffsetY = project.OffsetY;
            TopScale = project.TopScale;
            _session.Opacity = (float)Opacity;
            _session.OffsetX = (float)OffsetX;
            _session.OffsetY = (float)OffsetY;
            _session.TopScale = (float)TopScale;
        }
        finally
        {
            _suspendRefresh = false;
        }

        OnPropertyChanged(nameof(OffsetSummary));
        RefreshOverlay();
    }

    private async Task OpenDocumentAsync(bool isDocumentA)
    {
        if (_fileDialogs is null)
        {
            StatusMessage = "File dialogs are not available yet.";
            return;
        }

        var path = await _fileDialogs.PickPdfAsync(isDocumentA ? "Open PDF A" : "Open PDF B");
        if (string.IsNullOrWhiteSpace(path))
        {
            return;
        }

        try
        {
            await OpenPathAsync(path, isDocumentA);
            StatusMessage = $"Opened {(isDocumentA ? DocumentAName : DocumentBName)}. Original file is not modified.";
            RefreshOverlay();
        }
        catch (Exception ex)
        {
            StatusMessage = $"Could not open PDF: {ex.Message}";
        }
    }

    private Task OpenPathAsync(string path, bool isDocumentA)
    {
        var loaded = _pdfDocumentService.Open(path);
        if (isDocumentA)
        {
            _session.DocumentA?.Dispose();
            _session.DocumentA = loaded;
            _session.PageA = 1;
            DocumentAName = loaded.FileName;
            PageACount = loaded.PageCount;
            ReplacePageOptions(PageAOptions, loaded.PageCount);
            PageA = 1;
        }
        else
        {
            _session.DocumentB?.Dispose();
            _session.DocumentB = loaded;
            _session.PageB = 1;
            DocumentBName = loaded.FileName;
            PageBCount = loaded.PageCount;
            ReplacePageOptions(PageBOptions, loaded.PageCount);
            PageB = 1;
        }

        return Task.CompletedTask;
    }

    private void RefreshOverlay(bool reRenderPages = true)
    {
        try
        {
            if (_session.DocumentA is null || _session.DocumentB is null)
            {
                return;
            }

            if (reRenderPages)
            {
                _pageABitmap?.Dispose();
                _pageBBitmap?.Dispose();
                _pageABitmap = _pdfDocumentService.RenderPage(_session.DocumentA.FilePath, _session.PageA, dpi: 144);
                _pageBBitmap = _pdfDocumentService.RenderPage(_session.DocumentB.FilePath, _session.PageB, dpi: 144);

                PageAPreview?.Dispose();
                PageBPreview?.Dispose();
                PageAPreview = SkiaAvaloniaImageConverter.ToAvaloniaBitmap(_pageABitmap);
                PageBPreview = SkiaAvaloniaImageConverter.ToAvaloniaBitmap(_pageBBitmap);
            }

            if (_pageABitmap is null || _pageBBitmap is null)
            {
                return;
            }

            using var composed = _overlayComposer.Compose(
                _pageABitmap,
                _pageBBitmap,
                new OverlayComposeOptions(
                    TopOpacity: _session.Opacity,
                    OffsetX: _session.OffsetX,
                    OffsetY: _session.OffsetY,
                    TopScale: _session.TopScale));
            OverlayPreview?.Dispose();
            OverlayPreview = SkiaAvaloniaImageConverter.ToAvaloniaBitmap(composed);
            StatusMessage =
                $"Overlay ready — A p.{_session.PageA} / B p.{_session.PageB} · " +
                $"{(int)(_session.Opacity * 100)}% opacity · {OffsetSummary}";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Could not render overlay: {ex.Message}";
        }
    }

    private static void ReplacePageOptions(ObservableCollection<int> target, int pageCount)
    {
        target.Clear();
        for (var i = 1; i <= pageCount; i++)
        {
            target.Add(i);
        }
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        OverlayPreview?.Dispose();
        PageAPreview?.Dispose();
        PageBPreview?.Dispose();
        _pageABitmap?.Dispose();
        _pageBBitmap?.Dispose();
        _session.Reset();
        DocumentAName = null;
        DocumentBName = null;
    }
}
