// The one viewer for every file the school shares — homework sheets,
// notices, messages, timetables, syllabus, event photos. PDFs render in the
// app (react-native-pdf: pinch zoom, "Page 2 of 5"); photos in a zoomable
// view. The top-right button hands the file to another app (download /
// share / print). Open it with components/files.ts openFile().
// Params: { path (signed link), type: 'pdf' | 'image', name? }.
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Pdf from 'react-native-pdf';
import { HeaderIcon, PortalHeader } from '../components/portal';
import { cacheName, displayName, fileKind, fileUrl, openExternally } from '../components/files';
import ZoomableImage from '../components/ZoomableImage';
import { Button } from '../components/ui';
import { useI18n } from '../hooks';
import { colors } from '../theme';
import type { ScreenProps } from '../types';

export default function FileViewer({ params, goBack }: ScreenProps) {
  const { t } = useI18n();
  const path: string = params?.path || '';
  const kind = fileKind(path, params?.type);
  const url = fileUrl(path);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [failed, setFailed] = useState(false);
  const [externalFailed, setExternalFailed] = useState(false);

  const external = async () => setExternalFailed(!(await openExternally(path)));
  const subtitle = kind === 'pdf'
    ? pages ? t('Page {n} of {total}', { n: page, total: pages }) : displayName({ path, name: params?.name })
    : displayName({ path, name: params?.name });

  return (
    <View style={styles.flex}>
      <PortalHeader
        title={kind === 'pdf' ? t('View PDF') : t('View photo')}
        subtitle={subtitle}
        onBack={goBack}
        right={url ? <HeaderIcon icon="open-in-new" label={t('Open in another app')} onPress={external} /> : null}
      />
      <View style={styles.body}>
        {!url ? (
          <Problem text={t('This file is not available.')} />
        ) : failed ? (
          <Problem text={t('The file could not be opened here.')}>
            <Button label={t('Open in another app')} onPress={external} style={styles.problemButton} />
          </Problem>
        ) : kind === 'pdf' ? (
          <Pdf
            source={{ uri: url, cache: true, cacheFileName: cacheName(path) }}
            style={styles.flex}
            trustAllCerts={false}
            fitPolicy={0}
            spacing={8}
            enableDoubleTapZoom
            onLoadComplete={n => setPages(n)}
            onPageChanged={(p, n) => {
              setPage(p);
              setPages(n);
            }}
            onError={() => setFailed(true)}
            renderActivityIndicator={() => <ActivityIndicator color={colors.brand} size="large" />}
          />
        ) : (
          <ZoomableImage uri={url} onError={() => setFailed(true)} />
        )}
        {externalFailed ? <Text style={styles.toast}>{t('No app on this phone can open this file.')}</Text> : null}
      </View>
    </View>
  );
}

function Problem({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <View style={styles.problem}>
      <Text style={styles.problemText}>{text}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, backgroundColor: '#fff' },
  problem: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  problemText: { color: colors.subtle, fontSize: 14.5, textAlign: 'center' },
  problemButton: { marginTop: 16, alignSelf: 'stretch' },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: colors.ink,
    color: '#fff',
    padding: 12,
    borderRadius: 12,
    textAlign: 'center',
    overflow: 'hidden',
  },
});
