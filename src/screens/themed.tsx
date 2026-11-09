// Theme switcher for screens. Each screen's UI lives in its own file per UI
// theme (Profile → Theme, uiTheme.ts); routes.ts registers
//   themedScreen({ default: XDefault, creative: XCreative })
// and this renders the file for the active theme. The two files never import
// each other — shared data/state lives in a hook next to them (e.g.
// screens/home/useStudentHome.ts), so only the UI layer is duplicated.
// A screen without a creative file yet falls back to its default file.
import React from 'react';
import type { ComponentType } from 'react';
import { useUiTheme } from '../hooks';
import type { ScreenProps } from '../types';
import type { UiTheme } from '../uiTheme';

export type ThemedVariants = { default: ComponentType<ScreenProps> } & Partial<Record<UiTheme, ComponentType<ScreenProps>>>;

export function themedScreen(variants: ThemedVariants, name?: string): ComponentType<ScreenProps> {
  function ThemedScreen(props: ScreenProps) {
    const theme = useUiTheme();
    const Variant = variants[theme] || variants.default;
    return <Variant {...props} />;
  }
  ThemedScreen.displayName = `Themed(${name || variants.default.displayName || variants.default.name || 'Screen'})`;
  return ThemedScreen;
}
