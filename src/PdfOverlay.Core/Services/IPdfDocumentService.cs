using PdfOverlay.Core.Models;
using SkiaSharp;

namespace PdfOverlay.Core.Services;

/// <summary>
/// Local PDF open/render service. Source files are opened read-only and never overwritten.
/// </summary>
public interface IPdfDocumentService
{
    LoadedDocument Open(string filePath);

    /// <summary>
    /// Renders a 1-based page to an SKBitmap. Caller owns the returned bitmap.
    /// Rendering stays on the local machine; nothing is uploaded.
    /// </summary>
    SKBitmap RenderPage(string filePath, int pageNumber1Based, int dpi = 120);
}
