using System;
using System.Collections.ObjectModel;
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
    private readonly OverlaySession _session = new();
    private IFileDialogService? _fileDialogs;
    private SKBitmap? _pageABitmap;
    private SKBitmap? _pageBBitmap;
    private bool _disposed;

    public MainViewModel(
        ITempWorkspace tempWorkspace,
        IPdfDocumentService pdfDocumentService,
        IOverlayComposer overlayComposer)
    {
        _tempWorkspace = tempWorkspace;
        _pdfDocumentService = pdfDocumentService;
        _overlayComposer = overlayComposer;
        TempFolderPath = _tempWorkspace.RootPath;
        PrivacySummary =
            "Local-only PoC: PDFs stay on this computer, are opened read-only, " +
            "are not uploaded, and are not kept in a recent-files list. " +
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

    partial void OnPageAChanged(int value)
    {
        if (_session.DocumentA is null)
        {
            return;
        }

        _session.PageA = value;
        RefreshOverlay();
    }

    partial void OnPageBChanged(int value)
    {
        if (_session.DocumentB is null)
        {
            return;
        }

        _session.PageB = value;
        RefreshOverlay();
    }

    partial void OnOpacityChanged(double value)
    {
        _session.Opacity = (float)Math.Clamp(value, 0, 1);
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

            StatusMessage = $"Opened {loaded.FileName} ({loaded.PageCount} page(s)). Original file is not modified.";
            RefreshOverlay();
        }
        catch (Exception ex)
        {
            StatusMessage = $"Could not open PDF: {ex.Message}";
        }
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
                _pageABitmap = _pdfDocumentService.RenderPage(_session.DocumentA.FilePath, _session.PageA);
                _pageBBitmap = _pdfDocumentService.RenderPage(_session.DocumentB.FilePath, _session.PageB);

                PageAPreview?.Dispose();
                PageBPreview?.Dispose();
                PageAPreview = SkiaAvaloniaImageConverter.ToAvaloniaBitmap(_pageABitmap);
                PageBPreview = SkiaAvaloniaImageConverter.ToAvaloniaBitmap(_pageBBitmap);
            }

            if (_pageABitmap is null || _pageBBitmap is null)
            {
                return;
            }

            using var composed = _overlayComposer.Compose(_pageABitmap, _pageBBitmap, _session.Opacity);
            OverlayPreview?.Dispose();
            OverlayPreview = SkiaAvaloniaImageConverter.ToAvaloniaBitmap(composed);
            StatusMessage =
                $"Overlay ready — A p.{_session.PageA} under B p.{_session.PageB} at {(int)(_session.Opacity * 100)}% opacity.";
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
        // Intentionally do not keep recent file names after dispose.
        DocumentAName = null;
        DocumentBName = null;
    }
}
