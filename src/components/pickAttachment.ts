// One PDF or photo for a record (notice, class announcement). Returns null
// when the user cancels the picker.
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import type { PickedDocument } from '../types';

export async function pickAttachment(): Promise<PickedDocument | null> {
  try {
    const [file] = await pick({ type: [types.pdf, types.images], allowMultiSelection: false });
    return { uri: file.uri, name: file.name, type: file.type };
  } catch (e) {
    if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return null;
    throw e;
  }
}

/** multipart body `file` for POST …/attachment. */
export function attachmentForm(file: PickedDocument, fallbackName: string): FormData {
  const isPdf = (file.type || '').includes('pdf') || /\.pdf$/i.test(file.name || '');
  const fd = new FormData();
  fd.append('file', {
    uri: file.uri,
    name: file.name || `${fallbackName}${isPdf ? '.pdf' : '.jpg'}`,
    type: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
  } as unknown as Blob);
  return fd;
}
