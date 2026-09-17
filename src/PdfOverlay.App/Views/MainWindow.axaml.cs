using Avalonia.Controls;
using PdfOverlay.App.Services;
using PdfOverlay.App.ViewModels;

namespace PdfOverlay.App.Views;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Opened += OnOpened;
    }

    private void OnOpened(object? sender, System.EventArgs e)
    {
        if (DataContext is MainViewModel vm)
        {
            vm.AttachFileDialogs(new AvaloniaFileDialogService(this));
        }
    }
}
