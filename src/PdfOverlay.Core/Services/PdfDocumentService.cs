using PDFtoImage;
using PdfOverlay.Core.Models;
using SkiaSharp;

namespace PdfOverlay.Core.Services;

public sealed class PdfDocumentService : IPdfDocumentService
{
    public LoadedDocument Open(string filePath)
    {
        if (string.IsNullOrWhiteSpace(filePath))
        {
            throw new ArgumentException("A PDF file path is required.", nameof(filePath));
        }

        var fullPath = Path.GetFullPath(filePath);
        if (!File.Exists(fullPath))
        {
            throw new FileNotFoundException("PDF file was not found.", fullPath);
        }

        // Read-only share keeps the original file available to other apps and
        // makes it clear we never open for write.
        using var stream = new FileStream(
            fullPath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.ReadWrite | FileShare.Delete);

        var pageCount = Conversion.GetPageCount(stream, leaveOpen: false);
        if (pageCount < 1)
        {
            throw new InvalidDataException("The PDF does not contain any pages.");
        }

        return new LoadedDocument(fullPath, pageCount);
    }

    public SKBitmap RenderPage(string filePath, int pageNumber1Based, int dpi = 120)
    {
        if (pageNumber1Based < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(pageNumber1Based), "Page numbers are 1-based.");
        }

        if (dpi < 36 || dpi > 600)
        {
            throw new ArgumentOutOfRangeException(nameof(dpi), "DPI must be between 36 and 600.");
        }

        var fullPath = Path.GetFullPath(filePath);
        using var stream = new FileStream(
            fullPath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.ReadWrite | FileShare.Delete);

        var pageCount = Conversion.GetPageCount(stream, leaveOpen: true);
        if (pageNumber1Based > pageCount)
        {
            throw new ArgumentOutOfRangeException(
                nameof(pageNumber1Based),
                $"Page {pageNumber1Based} is outside 1..{pageCount}.");
        }

        stream.Position = 0;
        var options = new RenderOptions(Dpi: dpi);
        // Index is 0-based for PDFtoImage.
        return Conversion.ToImage(stream, pageNumber1Based - 1, leaveOpen: false, options: options);
    }
}
