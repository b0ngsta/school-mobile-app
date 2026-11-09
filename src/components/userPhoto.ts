// Profile photos for accounts (Nov 2026): pick one from the gallery and send it
// to POST /users/{id}/photo (managers: any staff / student; the class teacher:
// students of their section — the server decides). Returns the new photo_path,
// or null when the user cancels the picker. The server shrinks the picture
// (≤ 800 px), so nothing is resized here.
import { api } from '../api';
import { pickImage } from '../screens/Fees';

export async function changeUserPhoto(userId: number): Promise<string | null> {
  const shot = await pickImage();
  if (!shot) return null;
  const fd = new FormData();
  fd.append('file', {
    uri: shot.uri,
    name: shot.fileName || 'photo.jpg',
    type: shot.type || 'image/jpeg',
  } as unknown as Blob);
  const res = await api<{ photo_path: string }>(`/users/${userId}/photo`, { method: 'POST', formData: fd });
  return res?.photo_path ?? null;
}
