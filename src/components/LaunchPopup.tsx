// App-launch announcements (student / parent accounts): every time the app
// starts — and after signing in — the school's active announcements
// (GET /student/announcements: changed timings, a tour, an emergency) show
// in a popup with photos and text. The ✕ closes it. One popup per app start
// per account: the module-level `shownFor` resets only when the app process
// starts again.
import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { api, photoUrl } from '../api';
import { t } from '../i18n';
import { colors, shadow } from '../theme';
import type { Announcement } from '../types';

let shownFor: string | null = null;

/** Test hook: forget that the popup was shown in this process. */
export function resetLaunchPopup(): void {
  shownFor = null;
}

export default function LaunchPopup({ userKey }: { userKey: string }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(width - 32, 520);

  useEffect(() => {
    if (shownFor === userKey) return undefined;
    shownFor = userKey;
    let alive = true;
    api<Announcement[]>('/student/announcements')
      .then(list => {
        if (alive && Array.isArray(list) && list.length) {
          setItems(list);
          setIndex(0);
          setVisible(true);
        }
      })
      .catch(() => {}); // no popup is better than an error at launch (older servers: 404)
    return () => {
      alive = false;
    };
  }, [userKey]);

  if (!visible || !items.length) return null;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
    if (i !== index) setIndex(i);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setVisible(false)} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.card, shadow.pop, { width: cardWidth, maxHeight: height * 0.82 }]}>
          <View style={[styles.head, { backgroundColor: colors.brand }]}>
            <MCIcon name="bullhorn-variant" size={20} color="#fff" />
            <Text style={styles.headText} numberOfLines={1}>{t('School announcement')}</Text>
            <TouchableOpacity
              onPress={() => setVisible(false)}
              style={styles.close}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t('Close')}
              testID="launch-popup-close">
              <MCIcon name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
            style={{ width: cardWidth }}>
            {items.map(a => (
              <ScrollView key={a.id} style={{ width: cardWidth }} contentContainerStyle={styles.page}>
                {a.images.map(img => (
                  <Image
                    key={img.id}
                    source={{ uri: photoUrl(img.image_path) || undefined }}
                    style={[styles.image, { width: cardWidth - 32 }]}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                ))}
                <Text style={styles.title}>{a.title}</Text>
                {a.body ? <Text style={styles.body}>{a.body}</Text> : null}
              </ScrollView>
            ))}
          </ScrollView>
          {items.length > 1 ? (
            <View style={styles.dots}>
              {items.map((a, i) => (
                <View key={a.id} style={[styles.dot, { backgroundColor: i === index ? colors.brand : colors.line }]} />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,18,30,0.6)', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  headText: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '800', marginLeft: 8 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  page: { padding: 16 },
  image: { aspectRatio: 4 / 3, borderRadius: 16, marginBottom: 12, backgroundColor: colors.page },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink },
  body: { fontSize: 14.5, lineHeight: 21, color: colors.ink, marginTop: 6 },
  dots: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 14, paddingTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4 },
});
