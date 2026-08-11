using PdfOverlay.Core.Services;

namespace PdfOverlay.Tests;

public class TempWorkspaceTests
{
    [Fact]
    public void Clear_RemovesScratchFiles_ButKeepsRoot()
    {
        var root = Path.Combine(Path.GetTempPath(), "pdfoverlay-tests", Guid.NewGuid().ToString("N"));
        using var workspace = new TempWorkspace(root);

        var scratch = workspace.GetTempFilePath(".bin");
        File.WriteAllBytes(scratch, new byte[] { 1, 2, 3, 4 });
        Assert.True(File.Exists(scratch));

        workspace.Clear();

        Assert.True(Directory.Exists(workspace.RootPath));
        Assert.False(File.Exists(scratch));
        Assert.True(File.Exists(Path.Combine(workspace.RootPath, "README.txt")));
    }

    [Fact]
    public void Dispose_DeletesTemporaryRoot()
    {
        var root = Path.Combine(Path.GetTempPath(), "pdfoverlay-tests", Guid.NewGuid().ToString("N"));
        var workspace = new TempWorkspace(root);
        var scratch = workspace.GetTempFilePath(".tmp");
        File.WriteAllText(scratch, "scratch");

        workspace.Dispose();

        Assert.False(Directory.Exists(root));
    }

    [Fact]
    public void Relocate_MovesRootAndClearsPrevious()
    {
        var first = Path.Combine(Path.GetTempPath(), "pdfoverlay-tests", Guid.NewGuid().ToString("N"), "a");
        var second = Path.Combine(Path.GetTempPath(), "pdfoverlay-tests", Guid.NewGuid().ToString("N"), "b");

        using var workspace = new TempWorkspace(first);
        var scratch = workspace.GetTempFilePath(".dat");
        File.WriteAllText(scratch, "old");

        workspace.Relocate(second);

        Assert.Equal(Path.GetFullPath(second), workspace.RootPath);
        Assert.False(File.Exists(scratch));
        Assert.True(Directory.Exists(second));
        Assert.False(Directory.Exists(first));
    }
}
