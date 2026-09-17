using PdfOverlay.Core.Models;
using PdfOverlay.Core.Services;

namespace PdfOverlay.Tests;

public class ProjectExportServiceTests
{
    [Fact]
    public void ExportAndImport_RoundTripsSettings_WithoutEmbeddingPdfs()
    {
        var path = Path.Combine(Path.GetTempPath(), "pdfoverlay-tests", $"{Guid.NewGuid():N}.pdfoverlay.json");
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);

        var service = new ProjectExportService();
        var original = new ProjectFile
        {
            DocumentAPath = @"C:\docs\a.pdf",
            DocumentBPath = @"C:\docs\b.pdf",
            PageA = 2,
            PageB = 3,
            Opacity = 0.35f,
            OffsetX = 12,
            OffsetY = -4,
            TopScale = 1.1f,
        };

        service.Export(path, original);
        var loaded = service.Import(path);
        var text = File.ReadAllText(path);

        Assert.Equal(2, loaded.PageA);
        Assert.Equal(3, loaded.PageB);
        Assert.Equal(0.35f, loaded.Opacity, precision: 3);
        Assert.Equal(12f, loaded.OffsetX);
        Assert.Equal(-4f, loaded.OffsetY);
        Assert.Equal(1.1f, loaded.TopScale, precision: 3);
        Assert.Contains("a.pdf", text, StringComparison.Ordinal);
        Assert.DoesNotContain("%PDF", text, StringComparison.Ordinal);

        File.Delete(path);
    }
}
