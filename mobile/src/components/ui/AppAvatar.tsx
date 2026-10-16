import React, { useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useTheme } from '../../core/theme';
import { AppText } from './AppText';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AppAvatarProps {
  name: string;
  imageUrl?: string;
  size?: AvatarSize;
}

export const AppAvatar: React.FC<AppAvatarProps> = ({ name, imageUrl, size = 'md' }) => {
  const { theme } = useTheme();
  const [imageError, setImageError] = useState(false);

  const getDimension = () => {
    switch (size) {
      case 'sm':
        return theme.componentHeights.avatarSm;
      case 'lg':
        return theme.componentHeights.avatarLg;
      case 'md':
      default:
        return theme.componentHeights.avatarMd;
    }
  };

  const dimension = getDimension();

  const getInitials = (str: string) => {
    if (!str) return 'U';
    const parts = str.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const showImage = imageUrl && !imageError;

  return (
    <View
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor: theme.colors.primaryLight,
          borderColor: theme.colors.border,
          borderWidth: 1,
        },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: imageUrl }}
          style={[styles.image, { width: dimension, height: dimension, borderRadius: dimension / 2 }]}
          onError={() => setImageError(true)}
        />
      ) : (
        <AppText
          style={{
            color: theme.colors.primary,
            fontWeight: theme.typography.weights.bold,
            fontSize: dimension * 0.4,
          }}
        >
          {getInitials(name)}
        </AppText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    resizeMode: 'cover',
  },
});
