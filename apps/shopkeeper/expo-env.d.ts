/// <reference types="expo/types" />

// Type stub for expo-haptics — package is a native module mocked in tests and
// resolved at runtime via the Expo native module registry. Declaring it here
// lets tsc resolve the import without requiring the package in node_modules.
declare module 'expo-haptics' {
  export enum ImpactFeedbackStyle {
    Light = 'Light',
    Medium = 'Medium',
    Heavy = 'Heavy',
    Rigid = 'Rigid',
    Soft = 'Soft',
  }
  export enum NotificationFeedbackType {
    Success = 'Success',
    Warning = 'Warning',
    Error = 'Error',
  }
  export function impactAsync(style?: ImpactFeedbackStyle): Promise<void>;
  export function notificationAsync(type?: NotificationFeedbackType): Promise<void>;
  export function selectionAsync(): Promise<void>;
}
