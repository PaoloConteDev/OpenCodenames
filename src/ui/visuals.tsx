import React, { createContext, useContext, useEffect, useId, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  SvgXml,
} from 'react-native-svg';
import { brandSvg } from './brand';
export function BrandMark({ size = 36 }: { size?: number }) {
  return <SvgXml xml={brandSvg} width={size} height={size} />;
}
import type { PublicCard, Team } from '../core/model';
import { useLanguage } from '../i18n/context';
export const palette = {
  bg: '#101021',
  panel: '#1C1C35',
  stroke: '#353550',
  text: '#F6F5FF',
  muted: '#B8B8D0',
  gold: '#C5F76B',
  red: '#FF897C',
  blue: '#82B4FF',
  neutral: '#D9D5ED',
  green: '#A9EDB4',
};
export const MotionContext = createContext(false);
export const symbols = { red: '◆', blue: '●', neutral: '◇', assassin: '✕' } as const;
/** All artwork is rendered locally as vector shapes, without network assets. */
export function GradientFill({ from = '#343171', to = '#222044' }: { from?: string; to?: string }) {
  const id = useId().replace(/:/g, '_');
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
export function AmbientBackground() {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
    </View>
  );
}
export type IconName =
  | 'plus'
  | 'search'
  | 'bluetooth'
  | 'wifi'
  | 'arrow'
  | 'back'
  | 'spark'
  | 'players'
  | 'settings'
  | 'github'
  | 'language';
export function Icon({
  name,
  color = palette.text,
  size = 24,
}: {
  name: IconName;
  color?: string;
  size?: number;
}) {
  return (
    <Svg
      pointerEvents="none"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === 'plus' && <Path d="M12 5v14M5 12h14" />}
      {name === 'search' && (
        <>
          <Circle cx="10.5" cy="10.5" r="6.5" />
          <Path d="m16 16 4.5 4.5" />
        </>
      )}
      {name === 'bluetooth' && <Path d="m7 7 10 10-5 4V3l5 4L7 17" />}
      {name === 'wifi' && (
        <>
          <Path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0m-9 4a5 5 0 0 1 6 0" />
          <Circle cx="12" cy="20" r=".65" fill={color} strokeWidth="0" />
        </>
      )}
      {name === 'arrow' && <Path d="M4 12h15m-6-6 6 6-6 6" />}
      {name === 'back' && <Path d="m14 5-7 7 7 7" />}
      {name === 'github' && (
        <>
          <Path d="M9 21v-3.3c-3.2-.5-5-2.2-5-5.2 0-1.5.5-2.8 1.5-3.8C5 7.3 5.3 5.8 5.7 5c1.6-.1 2.8.7 3.5 1.2a12 12 0 0 1 5.6 0c.7-.5 1.9-1.3 3.5-1.2.4.8.7 2.3.2 3.7 1 1 1.5 2.3 1.5 3.8 0 3-1.8 4.7-5 5.2V21" />
          <Path d="M9 19c-3 .8-3.5-2-5-2" />
        </>
      )}
      {name === 'language' && (
        <>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z" />
        </>
      )}
      {name === 'settings' && (
        <>
          <Path d="M10 2h4l.6 2.7 2.2 1.3 2.6-.8 2 3.4-2 1.9v3l2 1.9-2 3.4-2.6-.8-2.2 1.3L14 22h-4l-.6-2.7-2.2-1.3-2.6.8-2-3.4 2-1.9v-3l-2-1.9 2-3.4 2.6.8 2.2-1.3Z" />
          <Circle cx="12" cy="12" r="3.2" />
        </>
      )}
      {name === 'spark' && (
        <Path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z" />
      )}
      {name === 'players' && (
        <>
          <Circle cx="9" cy="8" r="3" />
          <Path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2" />
        </>
      )}
    </Svg>
  );
}
export function HeroArtwork() {
  const motion = useContext(MotionContext);
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motion) {
      drift.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [motion, drift]);
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.artwork}
    >
      <View style={styles.orbit} />
      <View style={styles.orbitInner} />
      <Animated.View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          transform: [
            { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [3, -4] }) },
          ],
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 320 172">
          <G transform="translate(45 35) rotate(-14 58 55)">
            <Rect x="0" y="5" width="108" height="119" rx="17" fill="#101021" opacity=".25" />
            <Rect width="108" height="116" rx="17" fill={palette.red} />
            <Path d="M15 18h24m-24 7h15" stroke="#542C3C" strokeWidth="2" opacity=".45" />
            <Circle cx="54" cy="49" r="15" fill="#572D40" />
            <Path d="M28 89c0-28 52-28 52 0" fill="#572D40" />
            <Rect x="42" y="45" width="24" height="6" rx="3" fill={palette.red} />
            <Path d="M20 102h68" stroke="#572D40" strokeWidth="2" opacity=".3" />
          </G>
          <G transform="translate(170 20) rotate(13 52 58)">
            <Rect x="0" y="5" width="108" height="119" rx="17" fill="#101021" opacity=".25" />
            <Rect width="108" height="116" rx="17" fill={palette.blue} />
            <Path d="M15 18h24m-24 7h15" stroke="#273C72" strokeWidth="2" opacity=".45" />
            <Circle cx="54" cy="49" r="15" fill="#273C72" />
            <Path d="M28 89c0-28 52-28 52 0" fill="#273C72" />
            <Rect x="42" y="45" width="24" height="6" rx="3" fill={palette.blue} />
            <Path d="M20 102h68" stroke="#273C72" strokeWidth="2" opacity=".3" />
          </G>
          <G transform="translate(103 113) rotate(-3 61 18)">
            <Rect width="127" height="36" rx="18" fill={palette.gold} />
            <Path d="m18 10 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#233025" />
          </G>
          <Path
            d="m29 38 2 6 6 2-6 2-2 6-2-6-6-2 6-2Zm258 82 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"
            fill={palette.gold}
          />
          <Circle cx="288" cy="41" r="3" fill={palette.red} />
          <Circle cx="25" cy="120" r="3" fill={palette.blue} />
          <Line
            x1="129"
            y1="131"
            x2="214"
            y2="131"
            stroke="#233025"
            strokeWidth="2.5"
            strokeDasharray="4 5"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}
export function TeamScore({
  team,
  count,
  total,
  active,
  own = false,
}: {
  team: Team;
  count: number;
  total: number;
  active: boolean;
  own?: boolean;
}) {
  const color = palette[team];
  const { t, labels: it } = useLanguage();
  return (
    <View
      accessibilityLabel={t(
        'Squadra {0}{1}, {2} agenti rimasti{3}',
        it[team],
        own ? t(', la tua squadra') : '',
        count,
        active ? t(', turno attivo') : '',
      )}
      style={[
        styles.teamScore,
        { backgroundColor: color + '14', borderColor: active ? color : color + '30' },
      ]}
    >
      {own && (
        <Text style={[styles.scoreCaption, { color, fontFamily: 'SpaceGrotesk_700Bold' }]}>
          {t('LA TUA SQUADRA')}
        </Text>
      )}
      <View style={styles.scoreLine}>
        <Text style={[styles.scoreName, { color }]}>
          {symbols[team]} {it[team]}
        </Text>
        <Text style={[styles.scoreCount, { color }]}>{count}</Text>
      </View>
      <View style={styles.track}>
        <View
          style={{
            height: 4,
            borderRadius: 2,
            width: `${total ? (count / total) * 100 : 0}%`,
            backgroundColor: color,
          }}
        />
      </View>
      <Text style={styles.scoreCaption}>
        {t('agenti da trovare')}
        {active ? t(' · turno attivo') : ''}
      </Text>
    </View>
  );
}
export function WordCard({
  card,
  index,
  enabled,
  small,
  onPress,
}: {
  card: PublicCard;
  index: number;
  enabled: boolean;
  small: boolean;
  onPress: () => void;
}) {
  const { t, labels: it, language } = useLanguage();
  const motion = useContext(MotionContext);
  const scale = useRef(new Animated.Value(1)).current;
  const wasRevealed = useRef(card.revealed);
  useEffect(() => {
    if (motion && card.revealed && !wasRevealed.current) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.9, duration: 100, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, speed: 22, bounciness: 8, useNativeDriver: true }),
      ]).start();
    }
    wasRevealed.current = card.revealed;
  }, [card.revealed, motion, scale]);
  const color = card.color;
  const ink = card.revealed || color === 'assassin' ? palette.text : '#24243C';
  const dark = { red: '#63313B', blue: '#243F69', neutral: '#494554', assassin: '#101018' };
  return (
    <Animated.View style={{ flex: 1, minWidth: 0, transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${card.word}, ${card.revealed ? t('scoperta') : t('coperta')}${color ? `, ${it[color]}` : ''}${card.selectedBy ? t(', scelta dalla squadra {0}', it[card.selectedBy]) : ''}`}
        accessibilityState={{ disabled: card.revealed || !enabled }}
        disabled={card.revealed || !enabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: card.revealed
              ? color
                ? dark[color]
                : '#363346'
              : color === 'assassin'
                ? '#24243C'
                : color
                  ? palette[color]
                  : '#F3F1FA',
            borderColor: color === 'assassin' ? '#686581' : color ? palette[color] : '#FFFFFF',
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <View style={styles.cardTop}>
          <Text style={[styles.cardIndex, { color: ink }]}>
            {String(index + 1).padStart(2, '0')}
          </Text>
          <View
            accessibilityElementsHidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor:
                card.revealed && card.selectedBy ? palette[card.selectedBy] : '#FFFFFF',
              borderWidth: 1,
              borderColor: card.revealed && card.selectedBy ? '#FFFFFF90' : '#24243C40',
            }}
          />
        </View>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          numberOfLines={1}
          style={[styles.word, { color: ink, fontSize: small ? 11 : 13 }]}
        >
          {card.word.toLocaleUpperCase(language)}
        </Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.cardType, { color: ink }]}>
          {card.revealed
            ? t('SCOPERTA{0}', color ? ' · ' + it[color].toLocaleUpperCase(language) : '')
            : color
              ? it[color].toLocaleUpperCase(language)
              : t('COPERTA')}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  glowTop: {
    position: 'absolute',
    top: -130,
    right: -140,
    width: 390,
    height: 390,
    borderRadius: 195,
    backgroundColor: '#292050',
    opacity: 0.38,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -170,
    left: -160,
    width: 370,
    height: 370,
    borderRadius: 185,
    backgroundColor: '#173743',
    opacity: 0.25,
  },
  artwork: { height: 164, width: '100%', alignSelf: 'center', maxWidth: 360 },
  orbit: {
    position: 'absolute',
    width: 214,
    height: 152,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: '#7472AC40',
    top: 4,
    alignSelf: 'center',
    transform: [{ rotate: '-20deg' }],
  },
  orbitInner: {
    position: 'absolute',
    width: 274,
    height: 104,
    borderRadius: 140,
    borderWidth: 1,
    borderColor: '#7472AC30',
    top: 32,
    alignSelf: 'center',
    transform: [{ rotate: '18deg' }],
  },
  teamScore: { flex: 1, borderWidth: 1, borderRadius: 20, padding: 14, gap: 8 },
  scoreLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  scoreName: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13 },
  scoreCount: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 32, lineHeight: 36 },
  track: { height: 4, backgroundColor: '#FFFFFF12', borderRadius: 2, overflow: 'hidden' },
  scoreCaption: { color: palette.muted, fontSize: 10, fontFamily: 'SpaceGrotesk_400Regular' },
  card: {
    flex: 1,
    minHeight: 82,
    borderRadius: 12,
    borderWidth: 1,
    padding: 5,
    paddingBottom: 7,
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 4,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardIndex: { fontSize: 8, opacity: 0.65, fontFamily: 'SpaceGrotesk_500Medium' },
  word: { fontFamily: 'SpaceGrotesk_700Bold', textAlign: 'center', lineHeight: 18 },
  cardType: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 7,
    textAlign: 'center',
    opacity: 0.8,
  },
});
