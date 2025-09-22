export type FileKind = "pdf" | "docx" | "other";

export function detectFileKind({
  contentType,
  extension,
}: { contentType?: string | null; extension?: string }): FileKind {
  const ct = (contentType || "").toLowerCase();
  const ext = (extension || "").toLowerCase().replace(/^\./, ''); // Remove leading dot if present
  
  // MIME type takes precedence over extension
  if (ct.includes("application/pdf") || ext === "pdf") return "pdf";
  if (
    ct.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document") ||
    ext === "docx"
  ) return "docx";
  
  return "other";
}

export function getFileKindDisplayInfo(kind: FileKind): {
  showPreviewTab: boolean;
  showOriginalTab: boolean;
  previewTabLabel: string;
  originalTabLabel: string;
  userMessage?: string;
} {
  switch (kind) {
    case "pdf":
      return {
        showPreviewTab: false,
        showOriginalTab: true,
        previewTabLabel: "Preview",
        originalTabLabel: "PDF File",
        userMessage: "Showing original PDF. (Text preview not available for PDFs.)"
      };
    case "docx":
      return {
        showPreviewTab: true,
        showOriginalTab: false,
        previewTabLabel: "Preview",
        originalTabLabel: "Original File",
        userMessage: "Showing extracted text. (Original DOCX not displayed; download from file menu if needed.)"
      };
    default:
      return {
        showPreviewTab: true,
        showOriginalTab: true,
        previewTabLabel: "Preview",
        originalTabLabel: "Original File"
      };
  }
}

export function validateResumeFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 10MB' };
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File type not supported. Please upload PDF, DOC, DOCX, or TXT files.' };
  }

  return { valid: true };
}