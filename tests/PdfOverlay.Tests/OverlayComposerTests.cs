using PdfOverlay.Core.Services;
using SkiaSharp;

namespace PdfOverlay.Tests;

public class OverlayComposerTests
{
    [Fact]
    public void Compose_RespectsOpacityExtremes()
    {
        using var bottom = CreateSolidBitmap(40, 30, SKColors.Red);
        using var top = CreateSolidBitmap(40, 30, SKColors.Blue);
        var composer = new OverlayComposer();

        using var opaque = composer.Compose(bottom, top, 1f);
        using var hidden = composer.Compose(bottom, top, 0f);

        Assert.Equal(SKColors.Blue, opaque.GetPixel(5, 5));
        Assert.Equal(SKColors.Red, hidden.GetPixel(5, 5));
    }

    [Fact]
    public void Compose_UsesLargestDimensions()
    {
        using var bottom = CreateSolidBitmap(20, 10, SKColors.Black);
        using var top = CreateSolidBitmap(30, 40, SKColors.White);
        var composer = new OverlayComposer();

        using var result = composer.Compose(bottom, top, 0.5f);

        Assert.Equal(30, result.Width);
        Assert.Equal(40, result.Height);
    }

    [Fact]
    public void Compose_AppliesOffset()
    {
        using var bottom = CreateSolidBitmap(20, 20, SKColors.Red);
        using var top = CreateSolidBitmap(10, 10, SKColors.Blue);
        var composer = new OverlayComposer();

        using var result = composer.Compose(
            bottom,
            top,
            new OverlayComposeOptions(TopOpacity: 1f, OffsetX: 10f, OffsetY: 5f));

        Assert.Equal(SKColors.Red, result.GetPixel(2, 2));
        Assert.Equal(SKColors.Blue, result.GetPixel(12, 7));
    }

    private static SKBitmap CreateSolidBitmap(int width, int height, SKColor color)
    {
        var bitmap = new SKBitmap(width, height);
        using var canvas = new SKCanvas(bitmap);
        canvas.Clear(color);
        return bitmap;
    }
}
