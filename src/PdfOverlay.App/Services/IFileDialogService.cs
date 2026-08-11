using System.Threading.Tasks;

namespace PdfOverlay.App.Services;

public interface IFileDialogService
{
    Task<string?> PickPdfAsync(string title);
    Task<string?> PickFolderAsync(string title);
}
