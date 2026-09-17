using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Avalonia.Controls;
using Avalonia.Platform.Storage;

namespace PdfOverlay.App.Services;

public sealed class AvaloniaFileDialogService : IFileDialogService
{
    private static readonly FilePickerFileType ProjectType = new("PdfOverlay project")
    {
        Patterns = new[] { "*.pdfoverlay.json", "*.json" },
    };

    private readonly Window _window;

    public AvaloniaFileDialogService(Window window)
    {
        _window = window;
    }

    public async Task<string?> PickPdfAsync(string title)
    {
        var files = await _window.StorageProvider.OpenFilePickerAsync(new FilePickerOpenOptions
        {
            Title = title,
            AllowMultiple = false,
            FileTypeFilter = new List<FilePickerFileType>
            {
                new("PDF documents")
                {
                    Patterns = new[] { "*.pdf" },
                    MimeTypes = new[] { "application/pdf" },
                },
            },
        });

        return files.FirstOrDefault()?.TryGetLocalPath();
    }

    public async Task<string?> PickFolderAsync(string title)
    {
        var folders = await _window.StorageProvider.OpenFolderPickerAsync(new FolderPickerOpenOptions
        {
            Title = title,
            AllowMultiple = false,
        });

        return folders.FirstOrDefault()?.TryGetLocalPath();
    }

    public async Task<string?> PickProjectAsync(string title)
    {
        var files = await _window.StorageProvider.OpenFilePickerAsync(new FilePickerOpenOptions
        {
            Title = title,
            AllowMultiple = false,
            FileTypeFilter = new List<FilePickerFileType> { ProjectType },
        });

        return files.FirstOrDefault()?.TryGetLocalPath();
    }

    public async Task<string?> SaveProjectAsync(string title, string suggestedFileName)
    {
        var file = await _window.StorageProvider.SaveFilePickerAsync(new FilePickerSaveOptions
        {
            Title = title,
            SuggestedFileName = suggestedFileName,
            DefaultExtension = "pdfoverlay.json",
            FileTypeChoices = new List<FilePickerFileType> { ProjectType },
        });

        return file?.TryGetLocalPath();
    }
}
