// Excel files on the phone (Nov 2026, exam results upload):
//   saveExcel(name, base64) → the phone's Downloads folder (react-native-blob-util,
//                             MediaStore on Android 10+) and opened in Excel /
//                             Google Sheets when one is installed; if saving there
//                             fails, the file is opened straight from the app's cache
//   pickExcel()             → one .xlsx chosen with the system file picker
import { Platform } from 'react-native';
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import type { PickedDocument } from '../types';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type SaveResult = 'downloads' | 'opened';

export async function saveExcel(filename: string, base64: string): Promise<SaveResult> {
  if (Platform.OS !== 'android') throw new Error('Saving files is only available on Android.');
  // required lazily: the native module only exists in a built app (not in jest / web)
  const Blob = require('react-native-blob-util').default;
  const path = `${Blob.fs.dirs.CacheDir}/${filename}`;
  await Blob.fs.writeFile(path, base64, 'base64');
  try {
    await Blob.MediaCollection.copyToMediaStore({ name: filename, parentFolder: '', mimeType: XLSX_MIME }, 'Download', path);
    Blob.android.actionViewIntent(path, XLSX_MIME).catch(() => {});
    return 'downloads';
  } catch {
    // older Android / no storage access → open the cached copy in a spreadsheet app
    await Blob.android.actionViewIntent(path, XLSX_MIME);
    return 'opened';
  }
}

export async function pickExcel(): Promise<PickedDocument | null> {
  try {
    const xlsx = (types as Record<string, string | readonly string[]>).xlsx ?? XLSX_MIME;
    const [file] = await pick({
      // some file providers label .xlsx as a generic binary; the server checks the contents
      type: [...([] as string[]).concat(xlsx as string[]), 'application/octet-stream'],
      allowMultiSelection: false,
    });
    if (file.name && !/\.xlsx$/i.test(file.name)) {
      throw new Error('Choose the Excel (.xlsx) file — download the template, fill it in and save it as .xlsx.');
    }
    return { uri: file.uri, name: file.name, type: file.type };
  } catch (e) {
    if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return null;
    throw e;
  }
}
