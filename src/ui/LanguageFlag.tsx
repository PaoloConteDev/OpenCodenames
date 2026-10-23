import React, { useId } from 'react';
import { View } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import type { Language } from '../content/languages';

/** Local vector flags stay consistent across Android versions and fonts. */
export function LanguageFlag({ language, width = 30 }: { language: Language; width?: number }) {
  const clip = useId().replace(/:/g, '_');
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={(width * 2) / 3} viewBox="0 0 60 40">
        <Defs>
          <ClipPath id={clip}>
            <Rect width="60" height="40" rx="4" />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${clip})`}>
          {language === 'en' ? (
            <>
              <Rect width="60" height="40" fill="#012169" />
              <Path d="M0 0 60 40M60 0 0 40" stroke="#FFFFFF" strokeWidth="9" />
              <Path
                d="M0 0 30 20H26L0 3ZM60 0 30 20V17L56 0ZM60 40 30 20H34L60 37ZM0 40 30 20V23L4 40Z"
                fill="#C8102E"
              />
              <Path d="M30 0v40M0 20h60" stroke="#FFFFFF" strokeWidth="13" />
              <Path d="M30 0v40M0 20h60" stroke="#C8102E" strokeWidth="7" />
            </>
          ) : language === 'de' ? (
            <>
              <Rect width="60" height="40" fill="#FFCE00" />
              <Rect width="60" height="27" fill="#DD0000" />
              <Rect width="60" height="13" fill="#151515" />
            </>
          ) : language === 'es' ? (
            <>
              <Rect width="60" height="40" fill="#AA151B" />
              <Rect y="10" width="60" height="20" fill="#F1BF00" />
            </>
          ) : (
            <>
              <Rect width="60" height="40" fill={language === 'it' ? '#009246' : '#002395'} />
              <Rect x="20" width="20" height="40" fill="#FFFFFF" />
              <Rect
                x="40"
                width="20"
                height="40"
                fill={language === 'it' ? '#CE2B37' : '#ED2939'}
              />
            </>
          )}
          <Rect
            x="0.5"
            y="0.5"
            width="59"
            height="39"
            rx="3.5"
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity="0.2"
          />
        </G>
      </Svg>
    </View>
  );
}
