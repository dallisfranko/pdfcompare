using System.Text.Json;
using PdfOverlay.Core.Models;

namespace PdfOverlay.Core.Services;

public interface IProjectExportService
{
    void Export(string filePath, ProjectFile project);
    ProjectFile Import(string filePath);
}

public sealed class ProjectExportService : IProjectExportService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public void Export(string filePath, ProjectFile project)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(filePath);
        ArgumentNullException.ThrowIfNull(project);

        var fullPath = Path.GetFullPath(filePath);
        var directory = Path.GetDirectoryName(fullPath);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        var json = JsonSerializer.Serialize(project, JsonOptions);
        File.WriteAllText(fullPath, json);
    }

    public ProjectFile Import(string filePath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(filePath);
        var fullPath = Path.GetFullPath(filePath);
        if (!File.Exists(fullPath))
        {
            throw new FileNotFoundException("Project file was not found.", fullPath);
        }

        var json = File.ReadAllText(fullPath);
        var project = JsonSerializer.Deserialize<ProjectFile>(json, JsonOptions)
            ?? throw new InvalidDataException("Project file was empty or invalid.");

        if (project.Version < 1)
        {
            throw new InvalidDataException("Unsupported project file version.");
        }

        project.Opacity = Math.Clamp(project.Opacity, 0f, 1f);
        project.TopScale = Math.Clamp(project.TopScale <= 0 ? 1f : project.TopScale, 0.1f, 4f);
        project.PageA = Math.Max(1, project.PageA);
        project.PageB = Math.Max(1, project.PageB);
        return project;
    }
}
