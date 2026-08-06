/**
 * Indexed media / file asset discovered inside the package.
 */
export interface Asset {
  /** Stable id — prefer source id when present; otherwise path-based key (not a random UUID) */
  id: string;
  filename: string;
  /** Package-relative path */
  path: string;
  /** MIME / media category, e.g. "image/jpeg", "video/mp4", "application/octet-stream" */
  mediaType: string;
  /** Pixel width when discoverable from component metadata */
  width?: number;
  /** Pixel height when discoverable from component metadata */
  height?: number;
  /** Owning component id when the asset was referenced from a component */
  parentComponentId?: string;
  /** Byte size when known from the ZIP entry */
  size?: number;
  /** Whether the file exists in the extracted package */
  exists: boolean;
}
