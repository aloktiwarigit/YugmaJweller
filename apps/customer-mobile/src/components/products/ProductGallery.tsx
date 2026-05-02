import React, { useState, useRef } from 'react';
import { View, FlatList, Dimensions, Modal, Pressable, Text } from 'react-native';
import { Image } from 'expo-image';

export type PublicImageRow = {
  id: string;
  alt_text: string | null;
  width: number;
  height: number;
  srcset: string;
  default_url: string;
  placeholder_url: string;
};

const { width: screenWidth } = Dimensions.get('window');

// Aged-gold accent (Direction 5) for active dot; neutral gray for inactive.
const DOT_ACTIVE   = '#B58A3C';
const DOT_INACTIVE = '#D4C4A0';
// Cream background per Direction 5 anchor (#F5EDDD).
const CREAM_BG = '#F5EDDD';

function altFor(image: PublicImageRow, productName: string, index: number): string {
  return image.alt_text ?? `${productName} – तस्वीर ${index + 1}`;
}

export function ProductGallery({
  images,
  productName,
}: {
  images: PublicImageRow[];
  productName: string;
}): React.ReactElement {
  const [activeIndex, setActiveIndex]   = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const flatListRef = useRef<FlatList<PublicImageRow>>(null);

  // Empty-images fallback: cream background with Hindi message.
  if (images.length === 0) {
    return (
      <View
        style={{
          width: screenWidth,
          height: screenWidth,
          backgroundColor: CREAM_BG,
          justifyContent: 'center',
          alignItems: 'center',
        }}
        accessibilityLabel="तस्वीर उपलब्ध नहीं"
      >
        <Text style={{ fontSize: 16, color: '#4A526E' }}>तस्वीर उपलब्ध नहीं</Text>
      </View>
    );
  }

  const renderItem = ({
    item,
    index,
  }: {
    item: PublicImageRow;
    index: number;
  }): React.ReactElement => (
    <Pressable
      onPress={() => setLightboxOpen(true)}
      accessibilityRole="image"
      accessibilityLabel={altFor(item, productName, index)}
      style={{ width: screenWidth, height: screenWidth }}
    >
      <Image
        source={{ uri: item.default_url }}
        placeholder={{ uri: item.placeholder_url }}
        style={{ width: screenWidth, height: screenWidth, backgroundColor: CREAM_BG }}
        contentFit="cover"
        transition={300}
      />
    </Pressable>
  );

  return (
    <>
      <FlatList<PublicImageRow>
        ref={flatListRef}
        data={images}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          setActiveIndex(
            Math.round(e.nativeEvent.contentOffset.x / screenWidth),
          );
        }}
      />

      {/* Dot indicators */}
      {images.length > 1 && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 10,
          }}
        >
          {images.map((_, i) => (
            <View
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                marginHorizontal: 4,
                backgroundColor: i === activeIndex ? DOT_ACTIVE : DOT_INACTIVE,
              }}
            />
          ))}
        </View>
      )}

      {/* Lightbox modal */}
      <Modal
        visible={lightboxOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxOpen(false)}
        accessibilityViewIsModal
      >
        <Pressable
          onPress={() => setLightboxOpen(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.95)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          accessibilityLabel="तस्वीर बंद करें"
          accessibilityRole="button"
        >
          {images[activeIndex] !== undefined && (
            <Image
              source={{ uri: images[activeIndex]!.default_url }}
              placeholder={{ uri: images[activeIndex]!.placeholder_url }}
              style={{ width: '100%', height: '70%' }}
              contentFit="contain"
              transition={200}
              accessibilityRole="image"
              accessibilityLabel={altFor(
                images[activeIndex]!,
                productName,
                activeIndex,
              )}
            />
          )}
        </Pressable>
      </Modal>
    </>
  );
}
