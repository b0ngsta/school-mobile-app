// The still part of the orbit: ONE baked picture (night Earth tilted 23.44°,
// its atmosphere, axis, protractor, chalk-dashed Equator / Tropics, and the
// curved stretch of the orbit line) + the two straight rails + a few text
// labels (translated). Nothing here moves or re-renders after layout.
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { t } from '../../i18n';
import { SCENE_BOX } from './geometry';
import type { OrbitLayout } from './geometry';
import { TILT, latitudeLabel, northPole } from './globe';

const SCENE = require('../../assets/home/orbit_scene.webp');

// In Earth radii, computed once.
const LINES = [
  { key: 'Equator', lat: 0, x: -0.52, color: 'rgba(170,232,255,0.85)' },
  { key: 'Tropic of Cancer', lat: 23.44, x: -0.5, color: 'rgba(255,222,150,0.82)' },
  { key: 'Tropic of Capricorn', lat: -23.44, x: -0.46, color: 'rgba(255,222,150,0.82)' },
].map(l => ({ ...l, ...latitudeLabel(l.lat, l.x) }));
const POLE = northPole();

/** `lang` is only here so a language change redraws the labels. */
export const OrbitScene = React.memo(function OrbitSceneView({ L, lang }: { L: OrbitLayout; lang: string }) {
  const { cx, cy, R } = L;
  const upper = lang === 'en';
  const tiltRight = cx + (POLE.x - 0.33) * R; // just left of the protractor
  const tiltMid = cy + (POLE.y - 0.1) * R;
  return (
    <>
      <Image
        source={SCENE}
        fadeDuration={0}
        style={[
          styles.abs,
          {
            left: cx - SCENE_BOX.left * R,
            top: cy - SCENE_BOX.halfHeight * R,
            width: (SCENE_BOX.left + SCENE_BOX.right) * R,
            height: 2 * SCENE_BOX.halfHeight * R,
          },
        ]}
      />
      <View style={[styles.railGlow, styles.railTop, { left: L.railX - 4, height: L.railTopEnd }]} />
      <View style={[styles.rail, styles.railTop, { left: L.railX - 1, height: L.railTopEnd }]} />
      <View style={[styles.railGlow, styles.railBottom, { left: L.railX - 4, top: L.railBottomStart, height: L.height - L.railBottomStart }]} />
      <View style={[styles.rail, styles.railBottom, { left: L.railX - 1, top: L.railBottomStart, height: L.height - L.railBottomStart }]} />

      {LINES.map(l => (
        <View
          key={l.key}
          style={[styles.lineLabel, { left: cx + l.x * R - 80, top: cy + l.y * R - 13, transform: [{ rotate: `${l.angle}deg` }] }]}>
          <Text style={[styles.lineText, { color: l.color }]} numberOfLines={1}>
            {upper ? t(l.key).toUpperCase() : t(l.key)}
          </Text>
        </View>
      ))}
      <View style={[styles.tilt, { left: tiltRight - 70, top: tiltMid - 15 }]}>
        <Text style={styles.tiltValue}>{`${TILT}°`}</Text>
        <Text style={styles.tiltNote} numberOfLines={1}>
          {t('axial tilt')}
        </Text>
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  rail: { position: 'absolute', width: 2 },
  railGlow: { position: 'absolute', width: 8, borderRadius: 4, opacity: 0.2 },
  railTop: { top: 0, backgroundImage: 'linear-gradient(to bottom, rgba(154,166,255,0.15), rgba(170,180,255,0.75) 55%, #FF5C8A)' },
  railBottom: { backgroundImage: 'linear-gradient(to bottom, #FFC94A, rgba(255,214,140,0.7) 45%, rgba(255,201,74,0.15))' },
  lineLabel: { position: 'absolute', width: 160, height: 26, alignItems: 'center' },
  lineText: {
    fontSize: 8.5,
    lineHeight: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  tilt: { position: 'absolute', width: 70, alignItems: 'flex-end' },
  tiltValue: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
    color: '#FFD98A',
    textShadowColor: 'rgba(255,190,80,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  tiltNote: { fontSize: 8.5, lineHeight: 11, color: 'rgba(255,240,210,0.75)', letterSpacing: 1, fontStyle: 'italic' },
});
