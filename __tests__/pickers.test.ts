import { pick } from '@react-native-documents/picker';
import { launchImageLibrary } from 'react-native-image-picker';
import { pickPdf } from '../src/screens/staff/ExamPapers';
import { pickImage } from '../src/screens/Fees';

const pickMock = pick as jest.Mock;
const libMock = launchImageLibrary as jest.Mock;

describe('pickPdf (@react-native-documents/picker)', () => {
  beforeEach(() => pickMock.mockReset());

  it('asks for a single PDF and returns uri/name/type', async () => {
    pickMock.mockResolvedValue([
      { uri: 'content://x/1', name: 'maths.pdf', type: 'application/pdf', hasRequestedType: true },
    ]);
    await expect(pickPdf()).resolves.toEqual({
      uri: 'content://x/1',
      name: 'maths.pdf',
      type: 'application/pdf',
    });
    expect(pickMock).toHaveBeenCalledWith({ type: ['application/pdf'], allowMultiSelection: false });
  });

  it('returns null when the user cancels', async () => {
    pickMock.mockRejectedValue({ code: 'OPERATION_CANCELED', message: 'cancelled' });
    await expect(pickPdf()).resolves.toBeNull();
  });

  it('rejects a non-PDF from a provider that ignored the filter', async () => {
    pickMock.mockResolvedValue([
      { uri: 'content://x/2', name: 'a.jpg', type: 'image/jpeg', hasRequestedType: false },
    ]);
    await expect(pickPdf()).rejects.toThrow(/PDF/);
  });

  it('passes other errors through', async () => {
    pickMock.mockRejectedValue(new Error('boom'));
    await expect(pickPdf()).rejects.toThrow('boom');
  });
});

describe('pickImage (react-native-image-picker)', () => {
  beforeEach(() => libMock.mockReset());

  it('returns the first asset', async () => {
    libMock.mockResolvedValue({ assets: [{ uri: 'file:///a.jpg', fileName: 'a.jpg', type: 'image/jpeg' }] });
    await expect(pickImage()).resolves.toEqual({ uri: 'file:///a.jpg', fileName: 'a.jpg', type: 'image/jpeg' });
  });

  it('returns null on cancel', async () => {
    libMock.mockResolvedValue({ didCancel: true });
    await expect(pickImage()).resolves.toBeNull();
  });

  it('throws on a picker error', async () => {
    libMock.mockResolvedValue({ errorCode: 'permission', errorMessage: 'No access' });
    await expect(pickImage()).rejects.toThrow('No access');
  });
});
