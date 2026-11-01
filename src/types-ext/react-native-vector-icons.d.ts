// react-native-vector-icons@10 ships no TypeScript types, and
// @types/react-native-vector-icons pulls in the old @types/react-native that
// clashes with RN 0.87's built-in types — so declare the one family we use.
declare module 'react-native-vector-icons/MaterialCommunityIcons' {
  import type { ComponentType } from 'react';
  import type { StyleProp, TextProps, TextStyle } from 'react-native';

  export interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
    style?: StyleProp<TextStyle>;
  }

  const MaterialCommunityIcons: ComponentType<IconProps>;
  export default MaterialCommunityIcons;
}
