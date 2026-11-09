// An avatar you can tap to see the photo big (Nov 2026: Profile / StaffProfile
// and the staff screens). The photo opens in a modal over everything; tapping
// anywhere outside the picture (or Android back) closes it. Without a photo
// it is a plain, untappable Avatar.
import React, { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { t } from '../i18n';
import { Avatar } from './ui';

interface Props {
  name?: string | null;
  uri?: string | null;
  size?: number;
  testID?: string;
}

export default function PhotoAvatar({ name, uri, size = 44, testID }: Props) {
  const [open, setOpen] = useState(false);
  const { width, height } = useWindowDimensions();
  const side = Math.min(width - 48, height * 0.6, 520);
  if (!uri) return <Avatar name={name || ''} uri={null} size={size} />;
  return (
    <>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setOpen(true)} testID={testID}
        accessibilityRole="imagebutton" accessibilityLabel={t('View photo')}>
        <Avatar name={name || ''} uri={uri} size={size} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}
        statusBarTranslucent navigationBarTranslucent>
        {/* the backdrop closes it; the picture itself swallows taps */}
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} testID={testID ? `${testID}-backdrop` : undefined}>
          <Pressable onPress={() => {}} style={[styles.frame, { width: side, height: side, borderRadius: side / 2 }]}>
            <Image source={{ uri }} style={styles.fill} resizeMode="cover" accessibilityIgnoresInvertColors />
          </Pressable>
          {name ? <Text style={styles.name}>{name}</Text> : null}
          <View style={styles.hint}>
            <MCIcon name="gesture-tap" size={16} color="rgba(255,255,255,0.75)" />
            <Text style={styles.hintText}>{t('Tap anywhere to close')}</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,10,20,0.88)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  frame: { overflow: 'hidden', backgroundColor: '#222', borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  fill: { width: '100%', height: '100%' },
  name: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 18, textAlign: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  hintText: { color: 'rgba(255,255,255,0.75)', fontSize: 12.5, marginLeft: 6 },
});
