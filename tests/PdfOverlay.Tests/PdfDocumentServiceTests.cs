using PdfOverlay.Core.Services;

namespace PdfOverlay.Tests;

public class PdfDocumentServiceTests
{
    [Fact]
    public void OpenAndRender_DoesNotModifySourceFile()
    {
        var path = Path.Combine(Path.GetTempPath(), "pdfoverlay-tests", $"{Guid.NewGuid():N}.pdf");
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllBytes(path, MinimalPdf.OnePageBytes);
        var before = File.ReadAllBytes(path);
        var beforeWriteTime = File.GetLastWriteTimeUtc(path);

        var service = new PdfDocumentService();
        using var doc = service.Open(path);
        using var page = service.RenderPage(path, 1, dpi: 72);

        var after = File.ReadAllBytes(path);
        Assert.Equal(1, doc.PageCount);
        Assert.True(page.Width > 0);
        Assert.True(page.Height > 0);
        Assert.Equal(before, after);
        Assert.Equal(beforeWriteTime, File.GetLastWriteTimeUtc(path));

        File.Delete(path);
    }
}
