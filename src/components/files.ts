// Files the school shares (homework sheets, notices, messages, timetables,
// syllabus, event photos). One viewer screen opens them all:
//   openFile(navigate, { path: n.attachment_path, type: n.attachment_type, name: n.attachment_name })
// `path` is a signed link (`uploads/…?exp=&sig=`) that expires after ~24 h —
// pass it straight from the API response, never store it.
import { Linking } from 'react-native';
import { photoUrl } from '../api';
import type { FileKind, NavigateFn } from '../types';

export interface FileRef {
  path: string;
  type?: FileKind | string | null;
  name?: string | null;
}

/** 'pdf' | 'image' from the API's attachment_type, else from the link's extension. */
export function fileKind(path: string | null | undefined, type?: string | null): FileKind {
  if (type === 'pdf' || type === 'image') return type;
  return String(path || '').split('?')[0].toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
}

/** Absolute URL of a stored file. */
export const fileUrl = (path?: string | null): string | null => photoUrl(path);

/** Push the common FileViewer screen. */
export function openFile(navigate: NavigateFn, file: FileRef): void {
  if (!file.path) return;
  navigate('FileViewer', { path: file.path, type: fileKind(file.path, file.type), name: file.name || null });
}

/** Hand the file to another app (browser / PDF reader / gallery). Resolves false if nothing could open it. */
export async function openExternally(path: string | null | undefined): Promise<boolean> {
  const url = fileUrl(path);
  if (!url) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** The file name to show: the uploader's name, else the last part of the link. */
export function displayName(file: FileRef): string {
  if (file.name) return file.name;
  const last = String(file.path).split('?')[0].split('/').pop();
  return last || 'file';
}

/** Stable cache name for a stored file (signed links change; the stored name does not). */
export function cacheName(path: string): string {
  return String(path).split('?')[0].replace(/^\/+/, '').replace(/[^A-Za-z0-9._-]/g, '_');
}
