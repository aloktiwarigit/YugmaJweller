import React from 'react';

type IconProps = {
  name?: string;
  size?: number;
  color?: string;
};

function Icon({ name, size, color }: IconProps): React.ReactElement {
  return React.createElement('icon', {
    'data-icon': name,
    'data-size': size,
    'data-color': color,
  });
}

export const Ionicons = Icon;
export const AntDesign = Icon;
export const Feather = Icon;
export const MaterialIcons = Icon;
export const MaterialCommunityIcons = Icon;
export default Icon;
