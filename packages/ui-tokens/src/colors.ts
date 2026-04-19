export const colors = {
  primary: '#B58A3C',   // aged gold
  accent:  '#D4745A',   // terracotta blush
  bg:      '#F5EDDD',   // cream
  ink:     '#1E2440',   // indigo-ink
  inkMute: '#4A526E',
  border:  '#D9C9A8',
  error:   '#B1402B',
} as const;

export type ColorToken = keyof typeof colors;
