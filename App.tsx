import React, {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  ActivityIndicator,
  AccessibilityInfo,
  Alert,
  Animated,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  Vibration,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useKeepAwake } from 'expo-keep-awake';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import Link, { Mode } from './modules/offline-link';
import { runtime } from './src/session/runtime';
import { revealPresentation, type RevealPresentation } from './src/session/reveal';
import { APP_VERSION } from './src/protocol/messages';
import {
  Color,
  Role,
  PlayStyle,
  Team,
  MAX_PLAYERS,
  BLUETOOTH_DIRECT_MAX_PLAYERS,
  playerLimit,
  TURN_SECONDS,
  needsHandoff,
  effectiveRole,
} from './src/core/model';
import { validLobby } from './src/core/engine';
import { wordLists } from './src/content/words';
import { languages, languageFromLocale } from './src/content/languages';
import { LanguageProvider, useLanguage } from './src/i18n/context';
import { translate } from './src/i18n/translate';
import { LanguageFlag } from './src/ui/LanguageFlag';
import {
  AmbientBackground,
  BrandMark,
  GradientFill,
  HeroArtwork,
  Icon,
  IconName,
  MotionContext,
  TeamScore,
  WordCard,
  palette as C,
  symbols,
} from './src/ui/visuals';
type Page =
  | 'home'
  | 'channel'
  | 'intent'
  | 'setup'
  | 'find'
  | 'session'
  | 'history'
  | 'rules'
  | 'settings'
  | 'language'
  | 'diagnostics'
  | 'scan'
  | 'licenses';
function Label({ children }: { children: React.ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}
function Copy({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[s.copy, style]}>{children}</Text>;
}
function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  danger = false,
  compact = false,
  icon,
  subtitle,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  danger?: boolean;
  compact?: boolean;
  icon?: IconName;
  subtitle?: string;
}) {
  const motion = useContext(MotionContext);
  const scale = useRef(new Animated.Value(1)).current;
  const press = (down: boolean) => {
    if (!motion) return;
    Animated.spring(scale, {
      toValue: down ? 0.975 : 1,
      speed: 32,
      bounciness: 3,
      useNativeDriver: true,
    }).start();
  };
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => press(true)}
        onPressOut={() => press(false)}
        style={({ pressed }) => [
          s.button,
          secondary && s.secondary,
          !!subtitle && s.featuredButton,
          danger && { borderColor: C.red },
          compact && { paddingVertical: 11, minHeight: 44 },
          disabled && { opacity: 0.42 },
          pressed && { opacity: 0.88 },
        ]}
      >
        {!secondary && <GradientFill from="#DAFF94" to="#B7EB59" />}
        {!!subtitle && secondary && <GradientFill from="#34316D" to="#262448" />}
        {icon && (
          <View style={[s.actionIcon, { backgroundColor: secondary ? '#FFFFFF12' : '#17271E12' }]}>
            <Icon name={icon} color={secondary ? C.blue : C.bg} size={24} />
          </View>
        )}
        <View style={subtitle ? { flex: 1, gap: 4 } : undefined}>
          <Text
            style={[
              s.buttonText,
              secondary && { color: danger ? C.red : C.text },
              !!subtitle && { textAlign: 'left', fontSize: 17 },
            ]}
          >
            {title}
          </Text>
          {subtitle && (
            <Text style={[s.actionCaption, { color: secondary ? C.muted : '#354D2C' }]}>
              {subtitle}
            </Text>
          )}
        </View>
        {!!subtitle && <Icon name="arrow" color={secondary ? C.text : C.bg} size={20} />}
      </Pressable>
    </Animated.View>
  );
}
function Pill({
  title,
  selected,
  onPress,
  color = C.gold,
  disabled = false,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.pill,
        selected && { borderColor: color, backgroundColor: color + '18' },
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={[s.pillText, selected && { color }]}>{title}</Text>
    </Pressable>
  );
}
function Input({
  label,
  value,
  onChangeText,
  placeholder,
  maxLength = 32,
  numeric = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  numeric?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor="#71868e"
        style={[s.input, focused && { borderColor: C.gold, backgroundColor: '#24243C' }]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType={numeric ? 'numbers-and-punctuation' : 'default'}
        autoCorrect={false}
        autoCapitalize="none"
        selectionColor={C.gold}
      />
    </View>
  );
}
export default function App() {
  const appState = useSyncExternalStore(runtime.subscribe, runtime.snapshot);
  const appLanguage = languageFromLocale(appState.settings.language);
  const [fonts] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  return (
    <LanguageProvider language={appLanguage}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        {fonts ? (
          <GameApp />
        ) : (
          <View style={[s.fill, s.center]}>
            <ActivityIndicator color={C.gold} />
            <Text style={s.copy}>{translate(appLanguage, 'Apertura archivio…')}</Text>
          </View>
        )}
      </SafeAreaProvider>
    </LanguageProvider>
  );
}
function HostAwake() {
  useKeepAwake();
  return null;
}
function GameApp() {
  const { t, labels: it, language, message, history } = useLanguage();
  const words = wordLists[language];
  const state = useSyncExternalStore(runtime.subscribe, runtime.snapshot);
  const [page, setPage] = useState<Page>('home');
  const [intent, setIntent] = useState<'host' | 'join'>('host');
  const [mode, setMode] = useState<Mode>('bluetooth');
  const [name, setName] = useState('');
  const [turnSeconds, setTurnSeconds] = useState<number | null>(null);
  const [playStyle, setPlayStyle] = useState<PlayStyle>('classic');
  const [now, setNow] = useState(Date.now());
  const [address, setAddress] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [hostAddress, setHostAddress] = useState('');
  const [clueWord, setClueWord] = useState('');
  const [clueCount, setClueCount] = useState<number | 'infinity'>(2);
  const [working, setWorking] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [localError, setLocalError] = useState('');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [licenseQuery, setLicenseQuery] = useState('');
  const [expandedLicense, setExpandedLicense] = useState('');
  const [reduceMotion, setReduceMotion] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [revealNotice, setRevealNotice] = useState<RevealPresentation | null>(null);
  const previousView = useRef(state.view);
  const seenReveal = useRef<string | null>(null);
  const entrance = useRef(new Animated.Value(1)).current;
  const scroll = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const visiblePresentation =
    revealNotice &&
    foreground &&
    page === 'session' &&
    state.active &&
    state.reveal?.id === revealNotice.event.id &&
    revealNotice.event.gameId === state.view?.id &&
    revealNotice.event.round === state.view?.round &&
    state.view?.phase !== 'lobby'
      ? revealNotice
      : null;
  const visibleReveal = visiblePresentation?.event ?? null;
  const v = visiblePresentation?.view ?? state.view,
    own = v?.players.find((p) => p.id === state.ownId);
  const sessionPages: Page[] = ['session', 'history', 'diagnostics'];
  const busy = working || state.busy;
  const shared = v?.playStyle === 'shared';
  const single = v?.playStyle === 'single';
  const rotating = shared || single;
  const ownRole = v && own ? effectiveRole(v, own) : undefined;
  const sharedSynchronizing =
    shared &&
    v?.phase !== 'lobby' &&
    v?.phase !== 'finished' &&
    !state.isHost &&
    state.status !== 'Connesso all’host';
  const handoffRequired = !!v && (needsHandoff(v, own) || sharedSynchronizing);
  const displayTeam = rotating && v ? v.active : (own?.team ?? 'red');
  const spyOccupied =
    !!v &&
    v.players.some((p) => p.id !== own?.id && p.role === 'spy' && (shared || p.team === own?.team));
  const secondsLeft =
    v?.turnEndsAt == null
      ? null
      : Math.max(0, Math.ceil((v.turnEndsAt - now - state.hostTimeOffset) / 1000));
  useEffect(() => {
    if (v?.turnEndsAt == null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [v?.turnEndsAt]);
  const run = async (fn: () => Promise<unknown>) => {
    if (working) return;
    setWorking(true);
    setLocalError('');
    runtime.clearError();
    try {
      await fn();
    } catch (e) {
      const error = e instanceof Error ? e.message : t('Operazione non riuscita');
      setLocalError(error);
      runtime.reportError(error);
    } finally {
      setWorking(false);
    }
  };
  useEffect(() => {
    void run(async () => {
      await runtime.initialize();
      if (runtime.snapshot().active) setPage('session');
    }).finally(() => setInitialized(true));
  }, []);
  useLayoutEffect(() => {
    const presentation = revealPresentation(previousView.current, state.view);
    previousView.current = state.view;
    const reveal = state.reveal;
    if (!reveal || seenReveal.current === reveal.id) return;
    seenReveal.current = reveal.id;
    if (!initialized || !foreground || page !== 'session') return;
    // Rendering may batch a reveal with a later timer or presence update.
    if (!presentation || presentation.event.index !== reveal.index) return;
    setRevealNotice({ ...presentation, event: reveal });
    if (state.settings.haptic) {
      const patterns = {
        correct: [0, 35],
        opponent: [0, 65, 60, 65],
        neutral: [0, 40, 80, 40],
        assassin: [0, 140, 100, 180],
      };
      Vibration.vibrate(patterns[reveal.kind]);
    }
    Link.revealFeedback(reveal.kind, state.settings.sound);
  }, [
    state.view,
    state.reveal,
    initialized,
    foreground,
    page,
    state.settings.haptic,
    state.settings.sound,
  ]);
  useEffect(() => {
    if (!foreground || page !== 'session' || !state.active) setRevealNotice(null);
  }, [foreground, page, state.active, v?.id, v?.round]);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const reduced = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const active = AppState.addEventListener('change', (value) =>
      setForeground(value === 'active'),
    );
    return () => {
      mounted = false;
      reduced.remove();
      active.remove();
    };
  }, []);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    if (reduceMotion) {
      entrance.setValue(1);
      return;
    }
    entrance.setValue(0);
    const transition = Animated.timing(entrance, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    });
    transition.start();
    return () => transition.stop();
  }, [page, reduceMotion, entrance]);
  useEffect(() => {
    if (state.hostInfo?.addresses[0]) setHostAddress(state.hostInfo.addresses[0]);
  }, [state.hostInfo]);
  useEffect(() => {
    setClueWord('');
  }, [v?.phase, v?.round, v?.turn]);
  useEffect(() => {
    if (rotating) scroll.current?.scrollTo({ y: 0, animated: false });
  }, [rotating, v?.turn, single ? v?.phase : null]);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [v?.round, v?.phase === 'lobby', v?.phase === 'finished']);
  const act = (action: Parameters<typeof runtime.act>[0]) => void run(() => runtime.act(action));
  const feedback = () => {
    if (state.settings.haptic) Vibration.vibrate(35);
    Link.feedback(state.settings.sound);
  };
  const goHome = () => {
    if (state.active)
      Alert.alert(
        single ? t('Salvare e tornare alla Home?') : t('Lasciare la stanza?'),
        single
          ? t('La partita rimane salvata su questo telefono. Potrete riprenderla dalla Home.')
          : t(
              'La sessione rimane salvata per il recupero. Se sei l’host, tutti attendono il tuo ritorno.',
            ),
        [
          { text: t('Resta'), style: 'cancel' },
          {
            text: t('Esci'),
            onPress: () =>
              void run(async () => {
                await runtime.leave();
                setPage('home');
              }),
          },
        ],
      );
    else setPage('home');
  };
  const titles: Record<Page, string> = {
    home: 'Open Codenames',
    channel: t('Scegli il canale'),
    intent: mode === 'bluetooth' ? 'Bluetooth' : t('Wi-Fi / hotspot'),
    setup:
      playStyle === 'single'
        ? t('Unico dispositivo')
        : intent === 'host'
          ? t('Prepara la stanza')
          : t('Entra in partita'),
    find: t('Raggiungi la squadra'),
    session: v?.phase === 'lobby' ? t('Sala operativa') : t('La missione'),
    history: t('Registro missione'),
    rules: t('Manuale operativo'),
    settings: t('Preferenze'),
    language: t('Scegli la lingua'),
    diagnostics: t('Test del collegamento'),
    scan: t('Inquadra il QR'),
    licenses: t('Licenze e attribuzioni'),
  };
  const [manualRelay, setManualRelay] = useState(false);
  const selectChannel = (channel: Mode | 'single') => {
    setLocalError('');
    runtime.clearError();
    if (channel === 'single') {
      setPlayStyle('single');
      setIntent('host');
      setPage('setup');
    } else {
      if (mode !== channel) {
        setAddress('');
        setRoomCode('');
        setManualRelay(false);
      }
      setMode(channel);
      if (playStyle === 'single') setPlayStyle('classic');
      setPage('intent');
    }
  };
  const goBack = () => {
    if (page === 'home') return;
    if (page === 'session') {
      goHome();
      return;
    }
    if (sessionPages.includes(page)) {
      setPage('session');
      return;
    }
    if (page === 'setup') {
      setPage(playStyle === 'single' ? 'channel' : 'intent');
      return;
    }
    if (page === 'intent') {
      setPage('channel');
      return;
    }
    if (page === 'find') {
      setPage('setup');
      if (mode === 'bluetooth') void run(() => runtime.stopDiscovery());
      return;
    }
    if (page === 'scan') {
      setPage('find');
      return;
    }
    if (page === 'licenses') {
      setPage('settings');
      return;
    }
    setPage('home');
  };
  const startJoin = (host: string, viaRelay = false) =>
    void run(async () => {
      if (!name.trim()) throw new Error(t('Inserisci il tuo nickname'));
      if (mode === 'lan' && !/^[a-f\d]{6}$/i.test(roomCode))
        throw new Error(t('Inserisci il codice stanza di 6 caratteri'));
      setPage('session');
      await runtime.join({
        mode,
        address: host.trim(),
        port: 42831,
        roomCode: roomCode.toUpperCase(),
        nickname: name,
        ...(viaRelay ? { viaRelay: true } : {}),
      });
    });
  const cardWidth = (Math.min(width, 640) - 40 - 24) / 5;
  const error = message(localError || state.error);
  const canGuess =
    (own &&
      ownRole === 'guesser' &&
      (rotating || own.team === v?.active) &&
      !handoffRequired &&
      v?.phase === 'guess' &&
      !v.paused &&
      state.status === 'Connesso all’host') ||
    (state.isHost &&
      own &&
      ownRole === 'guesser' &&
      (rotating || own.team === v?.active) &&
      !handoffRequired &&
      v?.phase === 'guess' &&
      !v.paused);
  const selectCard = (index: number) => {
    const c = v?.board[index];
    if (!c || c.revealed || !canGuess || busy || visibleReveal) return;
    const version = v!.version;
    Alert.alert(
      t('Confermi “{0}”?', c.word.toLocaleUpperCase(language)),
      t('Questa scelta scopre la carta per tutti.'),
      [
        { text: t('Rifletti ancora'), style: 'cancel' },
        {
          text: t('Scopri carta'),
          onPress: () => {
            if (runtime.snapshot().view?.version !== version) {
              setLocalError(t('Il tabellone è cambiato. Rivedilo prima di scegliere.'));
              return;
            }
            act({ type: 'guess', index });
          },
        },
      ],
    );
  };
  if (!initialized)
    return (
      <View style={[s.fill, s.center]}>
        <ActivityIndicator color={C.gold} />
        <Text style={s.copy}>{t('Apertura archivio…')}</Text>
      </View>
    );
  const revealTitles = {
    correct: t('Agente trovato!'),
    opponent: t('Agente avversario'),
    neutral: t('Carta neutrale'),
    assassin: t('Assassino!'),
  };
  const revealColor = visibleReveal
    ? visibleReveal.color === 'assassin'
      ? C.red
      : C[visibleReveal.color]
    : C.gold;
  const revealOutcome =
    state.view?.phase === 'finished'
      ? state.view.winner
        ? t('Vince la squadra {0}.', it[state.view.winner].toLocaleLowerCase(language))
        : t('Fine missione')
      : state.view?.turn !== v?.turn
        ? t(
            'Turno concluso. Ora tocca alla squadra {0}.',
            it[state.view!.active].toLocaleLowerCase(language),
          )
        : t('Puoi continuare a scegliere oppure terminare il turno.');
  return (
    <MotionContext.Provider value={!reduceMotion && foreground}>
      {state.active && (state.isHost || state.relayEnabled) && <HostAwake />}
      <SafeAreaView style={s.fill} edges={['top', 'bottom']}>
        <AmbientBackground />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.topbar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={page === 'home' ? t('Home') : t('Indietro')}
              onPress={goBack}
              style={s.back}
            >
              {page === 'home' ? <BrandMark size={40} /> : <Icon name="back" color={C.text} />}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={s.brand} numberOfLines={1} adjustsFontSizeToFit>
                {titles[page]}
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  s.headerCaption,
                  sessionPages.includes(page) &&
                    v?.phase !== 'lobby' &&
                    own && { color: C[displayTeam] },
                ]}
              >
                {sessionPages.includes(page) && v?.phase !== 'lobby' && own
                  ? rotating
                    ? t(
                        '{0} · turno {1}',
                        ownRole === 'spy' ? t('Suggeritori') : t('Decifratori'),
                        it[v.active],
                      )
                    : t('Tu: squadra {0} · {1}', it[own.team], it[own.role])
                  : page === 'home'
                    ? 'by Gleetch'
                    : t('La vostra prossima connessione.')}
              </Text>
            </View>
            {page === 'home' && (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('Lingua')}
                  accessibilityValue={{
                    text: languages.find((option) => option.code === language)!.name,
                  }}
                  accessibilityHint={t('Apri la scelta della lingua')}
                  onPress={() => setPage('language')}
                  style={({ pressed }) => [
                    s.settingsButton,
                    pressed && { backgroundColor: '#343454' },
                  ]}
                >
                  <LanguageFlag language={language} width={30} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('Impostazioni')}
                  accessibilityHint={t('Apri le preferenze dell’app')}
                  onPress={() => setPage('settings')}
                  style={({ pressed }) => [
                    s.settingsButton,
                    pressed && { backgroundColor: '#343454' },
                  ]}
                >
                  <Icon name="settings" size={23} color={C.text} />
                </Pressable>
              </>
            )}
          </View>
          {!!error && (
            <Pressable
              accessibilityRole="alert"
              accessibilityLabel={error}
              onPress={() => {
                setLocalError('');
                runtime.clearError();
              }}
              style={s.error}
            >
              <Text style={s.errorText}>{error} ×</Text>
            </Pressable>
          )}
          <Animated.ScrollView
            ref={scroll}
            style={{
              opacity: entrance,
              transform: [
                { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
              ],
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[s.content, { minHeight: '100%' }]}
          >
            {page === 'home' && (
              <>
                <View style={s.hero}>
                  <GradientFill from="#393371" to="#242343" />
                  <View style={s.heroLine}>
                    <View style={s.heroTag}>
                      <Icon name="spark" color={C.gold} size={13} />
                      <Text style={s.heroTagText}>{t('PICCOLI INDIZI. GRANDI INTUIZIONI.')}</Text>
                    </View>
                  </View>
                  <Text style={s.title}>
                    {t('Una parola.')}
                    {'\n'}
                    <Text style={{ color: C.gold }}>{t('Mille connessioni.')}</Text>
                  </Text>
                  <Text style={s.heroCopy}>
                    {t('Riunisci gli amici, trova i tuoi agenti.')}
                    {'\n'}
                    {t('E occhio all’assassino.')}
                  </Text>
                  <HeroArtwork />
                  <View style={s.heroStats}>
                    <View style={s.heroStat}>
                      <Icon name="players" size={16} color={C.blue} />
                      <Text style={s.stat}>{t('Senza account')}</Text>
                    </View>
                    <View style={s.statDivider} />
                    <Text style={s.stat}>{t('25 parole')}</Text>
                    <View style={s.statDivider} />
                    <Text style={s.stat}>{t('2 squadre')}</Text>
                  </View>
                </View>
                <View style={s.sectionHeading}>
                  <Text style={s.sectionTitle}>{t('Si gioca insieme.')}</Text>
                  <Text style={s.tiny}>{t('Vicini, anche senza Internet')}</Text>
                </View>
                <Button
                  title={t('Gioca')}
                  subtitle={t('Wi-Fi, Bluetooth o un solo telefono')}
                  icon="players"
                  onPress={() => setPage('channel')}
                />
                {(state.savedHost || state.savedClient) && (
                  <View style={s.panel}>
                    <Label>{t('RIPRENDI DA DOVE ERAVATE')}</Label>
                    {state.savedHost && (
                      <Button
                        title={t('Riprendi la tua partita')}
                        secondary
                        compact
                        disabled={working}
                        onPress={() =>
                          void run(async () => {
                            setPage('session');
                            await runtime.host(name || 'Host', mode, true);
                          })
                        }
                      />
                    )}
                    {state.savedClient && (
                      <Button
                        title={t('Rientra nella tua sessione')}
                        secondary
                        compact
                        disabled={working}
                        onPress={() =>
                          void run(async () => {
                            setPage('session');
                            await runtime.join(
                              { mode, address: '', port: 42831, roomCode: '', nickname: name },
                              true,
                            );
                          })
                        }
                      />
                    )}
                  </View>
                )}
                <Button title={t('Regole')} secondary compact onPress={() => setPage('rules')} />
                <Copy style={s.footer}>
                  {t('Indipendente, open source, senza account.')}
                  {'\n'}
                  {t('Non affiliato a Czech Games Edition.')}
                </Copy>
              </>
            )}
            {page === 'language' && (
              <>
                <Label>{t('LINGUA DELL’APP')}</Label>
                <Text style={s.heading}>{t('Interfaccia e parole.')}</Text>
                <Copy>
                  {t(
                    'La scelta viene salvata su questo telefono. Le nuove partite useranno le parole nella lingua di chi ospita; una partita già creata mantiene il suo mazzo.',
                  )}
                </Copy>
                <View accessibilityRole="radiogroup" style={{ gap: 12 }}>
                  {languages.map((option) => (
                    <Pressable
                      key={option.code}
                      accessibilityRole="radio"
                      accessibilityLabel={option.name}
                      accessibilityState={{ checked: language === option.code, disabled: working }}
                      disabled={working}
                      onPress={() =>
                        void run(() =>
                          runtime.settings({ ...state.settings, language: option.code }),
                        )
                      }
                      style={({ pressed }) => [
                        s.languageOption,
                        language === option.code && {
                          borderColor: C.blue,
                          backgroundColor: '#292A49',
                        },
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <View
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                      >
                        <LanguageFlag language={option.code} width={32} />
                        <Text style={[s.subtitle, { flexShrink: 1 }]}>{option.name}</Text>
                      </View>
                      <Text style={[s.tiny, { color: C.blue }]}>
                        {language === option.code
                          ? `✓ ${t('Selezionata')}`
                          : option.code.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Button title={t('Torna alla Home')} secondary onPress={() => setPage('home')} />
              </>
            )}
            {page === 'channel' && (
              <>
                <Label>{t('01 / CANALE DI GIOCO')}</Label>
                <Text style={s.heading}>{t('Come volete giocare?')}</Text>
                <Copy>
                  {t(
                    'Scegli il canale. Con più telefoni potrai poi ospitare una stanza o entrare in quella degli amici.',
                  )}
                </Copy>
                <Button
                  title={t('Wi-Fi / hotspot')}
                  subtitle={t('Dispositivi 2–{0}\nStessa rete, anche senza Internet', MAX_PLAYERS)}
                  icon="wifi"
                  secondary
                  onPress={() => selectChannel('lan')}
                />
                <Button
                  title="Bluetooth"
                  subtitle={t(
                    'Dispositivi 2–{0}\nTelefoni vicini, senza Wi-Fi o Internet',
                    BLUETOOTH_DIRECT_MAX_PLAYERS,
                  )}
                  icon="bluetooth"
                  secondary
                  onPress={() => selectChannel('bluetooth')}
                />
                <Button
                  title={t('Unico dispositivo')}
                  subtitle={t('1 dispositivo\nPassa il telefono tra ruoli e squadre')}
                  icon="players"
                  secondary
                  onPress={() => selectChannel('single')}
                />
              </>
            )}
            {page === 'intent' && (
              <>
                <Label>02 / {mode === 'bluetooth' ? 'BLUETOOTH' : t('WI-FI / HOTSPOT')}</Label>
                <Text style={s.heading}>{t('Ospita o entra.')}</Text>
                <Copy>
                  {mode === 'bluetooth'
                    ? t(
                        'Tenete il Bluetooth acceso. Chi ospita rende visibile la stanza e approva gli ingressi.',
                      )
                    : t(
                        'Collegate i telefoni alla stessa rete Wi-Fi o all’hotspot. Internet non serve.',
                      )}
                </Copy>
                <Button
                  title={t('Ospita partita')}
                  subtitle={t('Crea la stanza per il tuo gruppo')}
                  icon="plus"
                  onPress={() => {
                    setIntent('host');
                    setPage('setup');
                  }}
                />
                <Button
                  title={t('Entra in partita')}
                  subtitle={t('Raggiungi una stanza già aperta')}
                  icon="search"
                  secondary
                  onPress={() => {
                    setIntent('join');
                    setPage('setup');
                  }}
                />
              </>
            )}
            {page === 'setup' && (
              <>
                <Label>
                  {playStyle === 'single'
                    ? t('UNICO DISPOSITIVO')
                    : `03 / ${mode === 'bluetooth' ? 'BLUETOOTH' : t('WI-FI / HOTSPOT')}`}
                </Label>
                <Text style={s.heading}>
                  {intent === 'host'
                    ? playStyle === 'single'
                      ? t('Un telefono, due squadre.')
                      : t('La squadra parte da qui.')
                    : t('Avvicina i telefoni.')}
                </Text>
                {playStyle !== 'single' && (
                  <Input
                    label={
                      intent === 'host' && playStyle === 'shared'
                        ? t('NOME DEL DISPOSITIVO')
                        : t('IL TUO NICKNAME')
                    }
                    value={name}
                    onChangeText={setName}
                    placeholder={t('Come ti riconosce la squadra?')}
                    maxLength={20}
                  />
                )}
                {intent === 'host' && playStyle !== 'single' && (
                  <View style={s.panel}>
                    <Label>{t('GESTIONE PARTITA')}</Label>
                    <View style={s.row}>
                      <Pill
                        title={t('Classica')}
                        selected={playStyle === 'classic'}
                        onPress={() => setPlayStyle('classic')}
                      />
                      <Pill
                        title={t('Condivisa')}
                        selected={playStyle === 'shared'}
                        onPress={() => setPlayStyle('shared')}
                      />
                    </View>
                    <Copy>
                      {playStyle === 'shared'
                        ? t(
                            'Da 2 dispositivi: uno per entrambi i suggeritori, uno o più per i decifratori. Passate i telefoni alla squadra di turno; la mappa resta sul dispositivo dei suggeritori.',
                          )
                        : t('Da 4 dispositivi: ognuno ha la propria squadra e il proprio ruolo.')}
                    </Copy>
                  </View>
                )}
                {intent === 'host' && (
                  <View style={s.panel}>
                    <View style={s.row}>
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={s.subtitle}>{t('Tempo per turno')}</Text>
                        <Copy>
                          {turnSeconds === null
                            ? t('Senza limite di tempo')
                            : t('Alla scadenza passa alla squadra avversaria')}
                        </Copy>
                      </View>
                      <Switch
                        accessibilityLabel={t('Attiva timer per turno')}
                        value={turnSeconds !== null}
                        onValueChange={(enabled) => setTurnSeconds(enabled ? 90 : null)}
                        trackColor={{ false: C.stroke, true: C.gold }}
                        thumbColor={C.text}
                      />
                    </View>
                    {turnSeconds !== null && (
                      <View style={[s.row, { flexWrap: 'wrap' }]}>
                        {TURN_SECONDS.map((n) => (
                          <Pill
                            key={n}
                            title={`${n} s`}
                            selected={turnSeconds === n}
                            onPress={() => setTurnSeconds(n)}
                          />
                        ))}
                      </View>
                    )}
                    <Copy>
                      {t('Il tempo comprende indizio e scelte')}
                      {playStyle !== 'classic'
                        ? t(', incluso il passaggio del telefono')
                        : ''}.{' '}
                      {playStyle === 'single'
                        ? t('La partita viene salvata su questo telefono.')
                        : t('L’host deve tenere l’app aperta.')}
                    </Copy>
                  </View>
                )}
                <Button
                  title={
                    intent === 'host'
                      ? playStyle === 'single'
                        ? t('Prepara la partita →')
                        : t('Apri la stanza →')
                      : t('Cerca la stanza →')
                  }
                  disabled={
                    working || (!name.trim() && !(intent === 'host' && playStyle === 'single'))
                  }
                  onPress={() =>
                    intent === 'host'
                      ? void run(async () => {
                          setPage('session');
                          await runtime.host(
                            playStyle === 'single' ? t('Unico dispositivo') : name.trim(),
                            playStyle === 'single' ? 'local' : mode,
                            false,
                            turnSeconds,
                            playStyle,
                          );
                        })
                      : void run(async () => {
                          setPage('find');
                          if (mode === 'bluetooth') await runtime.discover();
                        })
                  }
                />
                {intent === 'host' && playStyle === 'single' ? (
                  <Copy>
                    {t(
                      'Passate il telefono solo quando compare la schermata di conferma. Il suggeritore deve nascondere la mappa inviando l’indizio prima di consegnarlo ai decifratori.',
                    )}
                  </Copy>
                ) : (
                  <Copy>
                    {t('Fino a ')}
                    {MAX_PLAYERS}
                    {t(' dispositivi, host incluso. In Bluetooth, oltre')}{' '}
                    {BLUETOOTH_DIRECT_MAX_PLAYERS}
                    {t(
                      ' serve un telefono ponte: modalità sperimentale, da collaudare sui vostri modelli. L’host deve tenere l’app aperta; gli altri possono bloccare il telefono e si sincronizzano al rientro.',
                    )}
                  </Copy>
                )}
              </>
            )}
            {page === 'find' && (
              <>
                <Label>
                  {t('04 / INGRESSO ')}
                  {mode === 'bluetooth' ? 'BLUETOOTH' : t('LOCALE')}
                </Label>
                <Text style={s.heading}>{t('Trova la tua stanza.')}</Text>
                {mode === 'bluetooth' ? (
                  <>
                    <Copy>
                      {t(
                        'L’host deve aprire la stanza e accettare la visibilità Android. Qui compaiono i dispositivi rilevati e già associati. Se riconosci il telefono dell’host, puoi provare a collegarti anche prima della verifica del servizio. Confermate gli eventuali codici di associazione su entrambi i telefoni.',
                      )}
                    </Copy>
                    {state.scanning && (
                      <View style={s.status}>
                        <ActivityIndicator color={C.gold} />
                        <Copy>
                          {state.discoveryStage === 'services'
                            ? t('Verifica dei servizi Open Codenames…')
                            : t('Ricerca dispositivi nelle vicinanze…')}
                        </Copy>
                      </View>
                    )}
                    {state.nearby.map((h) => (
                      <View key={h.address + String(h.relay)} style={s.panel}>
                        <Label>
                          {h.verified
                            ? h.relay
                              ? t('PONTE BLUETOOTH · SPERIMENTALE')
                              : t('HOST BLUETOOTH')
                            : t('DISPOSITIVO · SERVIZIO NON VERIFICATO')}
                        </Label>
                        <Text style={s.subtitle}>{h.name}</Text>
                        <Copy>
                          {h.address}
                          {h.paired ? t(' · Già associato') : ''}
                        </Copy>
                        {!h.verified && (
                          <Copy>
                            {t(
                              'Il servizio del gioco non è ancora confermato. Un dispositivo già associato potrebbe non essere nelle vicinanze.',
                            )}
                          </Copy>
                        )}
                        <Button
                          title={
                            h.verified ? t('Richiedi ingresso') : t('Prova collegamento all’host')
                          }
                          disabled={working}
                          onPress={() => startJoin(h.address, h.relay)}
                        />
                        {!h.verified && (
                          <Button
                            title={t('Collega come ponte sperimentale')}
                            secondary
                            disabled={working}
                            onPress={() => startJoin(h.address, true)}
                          />
                        )}
                      </View>
                    ))}
                    {!state.scanning && state.nearby.length === 0 && (
                      <View style={s.panel}>
                        <Text style={s.subtitle}>{t('Nessun dispositivo individuato')}</Text>
                        <Copy>
                          {t(
                            'Avvicina i telefoni e chiedi all’host di rendersi nuovamente visibile. Su Android 11 o precedente serve anche la posizione attiva. Puoi anche associare i telefoni dalle impostazioni Bluetooth e ripetere la ricerca.',
                          )}
                        </Copy>
                      </View>
                    )}
                    <Button
                      title={state.scanning ? t('Interrompi ricerca') : t('Ripeti ricerca')}
                      secondary
                      disabled={working}
                      onPress={() =>
                        void run(() =>
                          state.scanning ? runtime.stopDiscovery() : runtime.discover(),
                        )
                      }
                    />
                    <Input
                      label={t('OPPURE INDIRIZZO BLUETOOTH')}
                      value={address}
                      onChangeText={setAddress}
                      placeholder="AA:BB:CC:DD:EE:FF"
                      maxLength={17}
                    />
                    <View style={s.row}>
                      <Pill
                        title={t('Host diretto')}
                        selected={!manualRelay}
                        onPress={() => setManualRelay(false)}
                      />
                      <Pill
                        title={t('Ponte sperimentale')}
                        selected={manualRelay}
                        onPress={() => setManualRelay(true)}
                      />
                    </View>
                    <Button
                      title={t('Collega indirizzo')}
                      secondary
                      disabled={working || !/^([a-f\d]{2}:){5}[a-f\d]{2}$/i.test(address)}
                      onPress={() => startJoin(address, manualRelay)}
                    />
                  </>
                ) : (
                  <>
                    <Copy>
                      {t(
                        'Usate la stessa rete o l’hotspot dell’host. Se Android avvisa che la rete non ha Internet, scegliete di restare collegati.',
                      )}
                    </Copy>
                    <Button
                      title={t('▦  Scansiona QR dell’host')}
                      secondary
                      onPress={() => {
                        setScanned(false);
                        setPage('scan');
                      }}
                    />
                    <Input
                      label={t('INDIRIZZO IPv4 LOCALE')}
                      value={address}
                      onChangeText={setAddress}
                      placeholder="192.168.43.1"
                      maxLength={15}
                      numeric
                    />
                    <Input
                      label={t('CODICE STANZA')}
                      value={roomCode}
                      onChangeText={setRoomCode}
                      placeholder={t('6 caratteri, es. A1B2C3')}
                      maxLength={6}
                    />
                    <Button
                      title={t('Richiedi ingresso →')}
                      disabled={working || !address || roomCode.length !== 6}
                      onPress={() => startJoin(address)}
                    />
                  </>
                )}
              </>
            )}
            {page === 'scan' && (
              <>
                <Text style={s.heading}>{t('Un invito, tutto locale.')}</Text>
                {!cameraPermission?.granted ? (
                  <>
                    <Copy>
                      {t(
                        'La fotocamera serve solo a leggere l’indirizzo locale e il codice stanza. Non vengono salvate immagini.',
                      )}
                    </Copy>
                    <Button
                      title={t('Consenti fotocamera')}
                      onPress={() => void requestCameraPermission()}
                    />
                  </>
                ) : (
                  <CameraView
                    style={{ height: 360, borderRadius: 18, overflow: 'hidden' }}
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={
                      scanned
                        ? undefined
                        : (event) => {
                            try {
                              const q = JSON.parse(event.data);
                              if (
                                q.app !== 'open-codenames' ||
                                q.v !== 1 ||
                                typeof q.address !== 'string' ||
                                !/^[A-F0-9]{6}$/.test(q.roomCode) ||
                                q.port !== 42831
                              )
                                throw new Error();
                              setScanned(true);
                              setAddress(q.address);
                              setRoomCode(q.roomCode);
                              setPage('find');
                              feedback();
                            } catch {
                              setScanned(true);
                              setLocalError(t('QR non valido per Open Codenames'));
                            }
                          }
                    }
                  />
                )}
                {scanned && (
                  <Button
                    title={t('Scansiona di nuovo')}
                    secondary
                    onPress={() => setScanned(false)}
                  />
                )}
                <Button title={t('Inserisci a mano')} secondary onPress={() => setPage('find')} />
              </>
            )}
            {page === 'session' && (
              <>
                <View style={s.connection}>
                  <Text
                    style={[
                      s.tag,
                      {
                        color: state.status.includes('Connesso') || state.isHost ? C.green : C.gold,
                      },
                    ]}
                  >
                    ●{' '}
                    {single
                      ? t('UNICO DISPOSITIVO')
                      : state.mode === 'bluetooth'
                        ? 'BLUETOOTH'
                        : t('RETE LOCALE')}
                  </Text>
                  <Text style={[s.tiny, { flex: 1, textAlign: 'right' }]}>
                    {message(state.status)}
                  </Text>
                </View>
                {!!state.waitingFingerprint && (
                  <View style={[s.panel, { borderColor: C.blue }]}>
                    <Label>{t('VERIFICA IL VERO HOST')}</Label>
                    <Text style={s.subtitle}>{state.waitingFingerprint}</Text>
                    <Copy>
                      {t(
                        'Confronta tutti i gruppi con “Impronta host” sul telefono che ospita la partita. Conferma solo se coincidono: protegge le credenziali e la mappa dal telefono ponte.',
                      )}
                    </Copy>
                    <Button
                      title={t('Conferma impronta')}
                      disabled={working}
                      onPress={() => void run(() => runtime.confirmRelayHost())}
                    />
                  </View>
                )}
                {!v && (
                  <View style={[s.panel, { paddingVertical: 40, alignItems: 'center' }]}>
                    {busy && <ActivityIndicator color={C.gold} size="large" />}
                    <Text style={s.subtitle}>
                      {state.active
                        ? t('In attesa del collegamento')
                        : t('Stanza non ancora aperta')}
                    </Text>
                    <Copy>
                      {t(
                        'Ogni ingresso deve essere approvato dall’host. Se il collegamento si interrompe, la sessione approvata può essere recuperata.',
                      )}
                    </Copy>
                    <Button
                      title={t('Riprendi collegamento')}
                      secondary
                      disabled={working}
                      onPress={() => void run(() => runtime.resumeTransport())}
                    />
                    <Button title={t('Torna alla Home')} secondary onPress={goHome} />
                  </View>
                )}
                {v && v.phase === 'lobby' && (
                  <>
                    <View style={s.panel}>
                      <Label>
                        {single
                          ? t('UN TELEFONO PER TUTTI')
                          : state.isHost
                            ? t('LA TUA STANZA')
                            : t('SALA OPERATIVA')}
                      </Label>
                      <Text style={s.heading}>
                        {single
                          ? t('Preparate le due squadre.')
                          : state.isHost
                            ? t('Invita la squadra.')
                            : t('Scegli la tua copertura.')}
                      </Text>
                      {single && (
                        <Copy>
                          {t(
                            'Lo stesso telefono passa al suggeritore, poi ai decifratori della squadra di turno. Dopo l’indizio la mappa viene nascosta. Al cambio turno il telefono passa alla squadra avversaria. Non servono altri dispositivi o collegamenti.',
                          )}
                        </Copy>
                      )}
                      {state.isHost && state.mode === 'bluetooth' && (
                        <>
                          <Copy>
                            {t('Nome dispositivo:')}{' '}
                            <Text style={{ color: C.text }}>{state.hostInfo?.name || '…'}</Text>
                          </Copy>
                          <Button
                            title={t('Rendi host visibile per 5 minuti')}
                            secondary
                            compact
                            disabled={working}
                            onPress={() => void run(() => runtime.visible())}
                          />
                          <Copy>
                            {t(
                              'I compagni scelgono “Gioca → Bluetooth → Entra in partita”. I dialoghi di associazione sono gestiti da Android.',
                            )}
                          </Copy>
                          <Label>{t('IMPRONTA HOST')}</Label>
                          <Text style={s.subtitle}>{state.hostFingerprint}</Text>
                          <Copy>
                            {t(
                              'Per arrivare a 10: un partecipante già collegato attiva il ponte sul proprio telefono; gli ultimi due entrano da quel ponte e verificano questa impronta. Il ponte è sperimentale e dipende dal supporto Bluetooth dei telefoni.',
                            )}
                          </Copy>
                        </>
                      )}
                      {state.isHost && state.mode === 'lan' && (
                        <>
                          <Label>
                            {t('CODICE STANZA · ')}
                            {state.roomCode}
                          </Label>
                          {state.hostInfo?.addresses.map((ip) => (
                            <Pill
                              key={ip}
                              title={ip}
                              selected={hostAddress === ip}
                              onPress={() => setHostAddress(ip)}
                            />
                          ))}
                          {hostAddress ? (
                            <View style={s.qr}>
                              <QRCode
                                size={180}
                                backgroundColor="#fff"
                                color={C.bg}
                                value={JSON.stringify({
                                  app: 'open-codenames',
                                  v: 1,
                                  address: hostAddress,
                                  port: 42831,
                                  roomCode: state.roomCode,
                                })}
                              />
                            </View>
                          ) : (
                            <Copy>
                              {t(
                                'Attiva l’hotspot o collegati a una rete Wi-Fi, poi premi Riprendi collegamento.',
                              )}
                            </Copy>
                          )}
                          <Copy>
                            {hostAddress ? `${hostAddress}:42831 · ` : ''}
                            {t('codice ')}
                            {state.roomCode}
                            {'\n'}
                            {t('Scegli l’indirizzo raggiungibile dalla rete condivisa.')}
                          </Copy>
                        </>
                      )}
                    </View>
                    {!state.isHost && state.mode === 'bluetooth' && !state.viaRelay && (
                      <View style={[s.panel, { borderColor: C.blue }]}>
                        <Label>{t('PONTE BLUETOOTH · SPERIMENTALE')}</Label>
                        <Copy>
                          {t(
                            'Ospita fino a 2 collegamenti aggiuntivi, mantenendo aperta l’app. L’host approva tutti gli ingressi. I dati dei compagni attraversano il ponte cifrati; alcuni telefoni non supportano questo collegamento simultaneo.',
                          )}
                        </Copy>
                        <Text style={s.subtitle}>
                          {state.relayEnabled
                            ? t('Ponte attivo · {0} / 2 collegati', state.relayChildren)
                            : t('Estendi la squadra fino a 10')}
                        </Text>
                        <Button
                          title={
                            state.relayEnabled
                              ? t('Disattiva ponte')
                              : t('Attiva ponte sperimentale')
                          }
                          secondary
                          disabled={working}
                          onPress={() => void run(() => runtime.setRelay(!state.relayEnabled))}
                        />
                        {state.relayEnabled && (
                          <Button
                            title={t('Rendi ponte visibile')}
                            secondary
                            compact
                            onPress={() => void run(() => runtime.visible())}
                          />
                        )}
                      </View>
                    )}
                    {state.pending.map((p) => (
                      <View key={p.peer} style={[s.panel, { borderColor: C.gold }]}>
                        <Label>
                          {p.peer.startsWith('relay:')
                            ? t('INGRESSO TRAMITE PONTE CIFRATO')
                            : t('RICHIESTA D’INGRESSO')}
                        </Label>
                        <Text style={s.subtitle}>{p.nickname}</Text>
                        <View style={s.row}>
                          <View style={{ flex: 1 }}>
                            <Button
                              title={t('Accetta')}
                              disabled={working}
                              onPress={() => void run(() => runtime.approve(p.peer, true))}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Button
                              title={t('Rifiuta')}
                              secondary
                              disabled={working}
                              onPress={() => void run(() => runtime.approve(p.peer, false))}
                            />
                          </View>
                        </View>
                      </View>
                    ))}
                    <View style={s.row}>
                      <Label>
                        {single
                          ? t('UNICO DISPOSITIVO')
                          : shared
                            ? t('DISPOSITIVI CONDIVISI')
                            : t('PARTECIPANTI')}
                      </Label>
                      <Text style={[s.tag, { marginLeft: 'auto' }]}>
                        {v.players.length} / {playerLimit(state.mode)}
                      </Text>
                    </View>
                    <Copy>
                      {t(
                        'Lingua delle parole: {0}',
                        languages.find((option) => option.code === v.language)?.name ?? 'Italiano',
                      )}
                    </Copy>
                    <Copy>
                      {t('Modalità:')}{' '}
                      {single
                        ? t('Unico dispositivo · un telefono')
                        : shared
                          ? t('Condivisa · da 2 dispositivi')
                          : t('Classica · da 4 dispositivi')}
                      {'\n'}
                      {t('Tempo per turno:')}{' '}
                      {v.turnSeconds
                        ? t('{0} secondi · cambio automatico', v.turnSeconds)
                        : t('nessun limite')}
                    </Copy>
                    {state.isHost && !rotating && (
                      <Button
                        title={t('Mescola squadre')}
                        secondary
                        disabled={busy || v.players.length < 2}
                        onPress={() =>
                          Alert.alert(
                            t('Mescolare le squadre?'),
                            t(
                              'Le squadre saranno bilanciate. I suggeritori restano uno per squadra e tutti dovranno confermare di nuovo.',
                            ),
                            [
                              { text: t('Annulla'), style: 'cancel' },
                              { text: t('Mescola'), onPress: () => act({ type: 'shuffle' }) },
                            ],
                          )
                        }
                      />
                    )}
                    {shared &&
                      (['spy', 'guesser'] as Role[]).map((role) => (
                        <View
                          key={role}
                          style={[
                            s.panel,
                            { borderTopColor: role === 'spy' ? C.gold : C.blue, borderTopWidth: 3 },
                          ]}
                        >
                          <Label>
                            {role === 'spy'
                              ? t('SUGGERITORI · 1 DISPOSITIVO')
                              : t('DECIFRATORI · 1 O PIÙ DISPOSITIVI')}
                          </Label>
                          <Copy>
                            {role === 'spy'
                              ? t('Mappa riservata, telefono da passare tra i due suggeritori.')
                              : t(
                                  'Tabellone pubblico, telefoni da passare ai decifratori della squadra di turno.',
                                )}
                          </Copy>
                          {!v.players.some((p) => p.role === role) && (
                            <Copy>{t('In attesa di un dispositivo')}</Copy>
                          )}
                          {v.players
                            .filter((p) => p.role === role)
                            .map((p) => (
                              <View key={p.id} style={s.player}>
                                <View style={{ flex: 1, gap: 4 }}>
                                  <Text style={s.playerName}>
                                    {p.nickname}
                                    {p.id === state.ownId ? t(' · questo telefono') : ''}
                                    {p.id === v.hostId ? t(' · host') : ''}
                                  </Text>
                                  <Copy>
                                    {p.connected ? t('Connesso') : t('Scollegato')} ·{' '}
                                    {p.ready ? t('Pronto') : t('Da confermare')}
                                  </Copy>
                                </View>
                                {state.isHost && p.id !== state.ownId && (
                                  <Button
                                    title={t('Rimuovi')}
                                    secondary
                                    compact
                                    disabled={busy}
                                    onPress={() =>
                                      Alert.alert(t('Rimuovi dispositivo'), p.nickname, [
                                        { text: t('Annulla'), style: 'cancel' },
                                        {
                                          text: t('Rimuovi'),
                                          style: 'destructive',
                                          onPress: () => act({ type: 'remove', playerId: p.id }),
                                        },
                                      ])
                                    }
                                  />
                                )}
                              </View>
                            ))}
                        </View>
                      ))}
                    {!rotating &&
                      (['red', 'blue'] as Team[]).map((team) => (
                        <View
                          key={team}
                          style={[s.panel, { borderTopColor: C[team], borderTopWidth: 3 }]}
                        >
                          <Text style={[s.subtitle, { color: C[team] }]}>
                            {symbols[team]}
                            {t(' Squadra ')}
                            {it[team]}
                          </Text>
                          {!v.players.some((p) => p.team === team && p.role === 'spy') && (
                            <View style={{ paddingVertical: 10, gap: 6 }}>
                              <Label>{t('SUGGERITORE · 0 / 1')}</Label>
                              <Copy>{t('Posto disponibile')}</Copy>
                            </View>
                          )}
                          {v.players
                            .filter((p) => p.team === team)
                            .sort((a, b) => Number(b.role === 'spy') - Number(a.role === 'spy'))
                            .map((p, index, teamPlayers) => (
                              <React.Fragment key={p.id}>
                                {(index === 0 || teamPlayers[index - 1]?.role !== p.role) && (
                                  <Label>
                                    {p.role === 'spy' ? t('SUGGERITORE · 1 / 1') : t('DECIFRATORI')}
                                  </Label>
                                )}
                                <View
                                  style={[
                                    s.player,
                                    p.role === 'spy' && {
                                      backgroundColor: C[team] + '14',
                                      borderColor: C[team] + '60',
                                      borderWidth: 1,
                                      borderRadius: 14,
                                      padding: 12,
                                    },
                                  ]}
                                >
                                  <View style={[s.avatar, { backgroundColor: C[team] + '20' }]}>
                                    <Text style={[s.avatarLetter, { color: C[team] }]}>
                                      {p.nickname.slice(0, 1).toLocaleUpperCase(language)}
                                    </Text>
                                    <View
                                      style={[
                                        s.presenceDot,
                                        { backgroundColor: p.connected ? C.green : C.stroke },
                                      ]}
                                    />
                                  </View>
                                  <View style={{ flex: 1, gap: 4 }}>
                                    <Text style={s.playerName}>
                                      {p.nickname}
                                      {p.id === state.ownId ? t(' · tu') : ''}
                                      {p.id === v.hostId ? t(' · host') : ''}
                                    </Text>
                                    <Text style={s.tiny}>
                                      {it[p.role]} · {p.connected ? t('connesso') : t('scollegato')}{' '}
                                      · {p.ready ? t('pronto') : t('da confermare')}
                                    </Text>
                                  </View>
                                  <Text
                                    accessibilityLabel={p.ready ? t('Pronto') : t('Non pronto')}
                                    style={{ color: p.ready ? C.green : C.muted, fontSize: 20 }}
                                  >
                                    {p.ready ? '✓' : '○'}
                                  </Text>
                                  {state.isHost && p.id !== state.ownId && (
                                    <Pressable
                                      accessibilityRole="button"
                                      accessibilityLabel={t('Rimuovi {0}', p.nickname)}
                                      onPress={() =>
                                        Alert.alert(t('Rimuovi partecipante'), p.nickname, [
                                          { text: t('Annulla'), style: 'cancel' },
                                          {
                                            text: t('Rimuovi'),
                                            style: 'destructive',
                                            onPress: () => act({ type: 'remove', playerId: p.id }),
                                          },
                                        ])
                                      }
                                      style={s.remove}
                                    >
                                      <Text style={{ color: C.red }}>×</Text>
                                    </Pressable>
                                  )}
                                </View>
                              </React.Fragment>
                            ))}
                          {!v.players.some((p) => p.team === team) && (
                            <Copy>{t('Squadra in attesa di partecipanti')}</Copy>
                          )}
                        </View>
                      ))}
                    {own && !single && (
                      <View style={s.panel}>
                        <Label>{t('IL TUO INCARICO')}</Label>
                        {!shared && (
                          <View style={s.row}>
                            {(['red', 'blue'] as Team[]).map((team) => (
                              <Pill
                                key={team}
                                title={it[team]}
                                color={C[team]}
                                selected={own.team === team}
                                disabled={
                                  busy ||
                                  (own.role === 'spy' &&
                                    v.players.some(
                                      (p) => p.team === team && p.role === 'spy' && p.id !== own.id,
                                    ))
                                }
                                onPress={() =>
                                  !busy && act({ type: 'choose', team, role: own.role })
                                }
                              />
                            ))}
                          </View>
                        )}
                        <View style={s.row}>
                          {(['spy', 'guesser'] as Role[]).map((role) => (
                            <Pill
                              key={role}
                              title={
                                role === 'spy' && spyOccupied
                                  ? t('Suggeritore · occupato')
                                  : shared
                                    ? role === 'spy'
                                      ? t('Dispositivo suggeritori')
                                      : t('Dispositivo decifratori')
                                    : it[role]
                              }
                              selected={own.role === role}
                              disabled={busy || (role === 'spy' && spyOccupied)}
                              onPress={() => !busy && act({ type: 'choose', team: own.team, role })}
                            />
                          ))}
                        </View>
                        <Button
                          title={
                            own.ready
                              ? t('✓ Pronto · tocca per annullare')
                              : t('Conferma: sono pronto')
                          }
                          secondary={own.ready}
                          disabled={busy}
                          onPress={() => act({ type: 'ready', ready: !own.ready })}
                        />
                      </View>
                    )}
                    <Copy>
                      {single
                        ? t(
                            'Quando avete formato le due squadre, avviate la missione. Il telefono indicherà a chi passarlo e richiederà conferma prima di mostrare la mappa o abilitare le scelte.',
                          )
                        : shared
                          ? t(
                              'Per partire: almeno 2 dispositivi connessi e pronti, esattamente uno per i suggeritori e almeno uno per i decifratori. Il dispositivo segue la squadra di turno.',
                            )
                          : t(
                              'Per partire: almeno 4 persone connesse e pronte, esattamente un suggeritore e almeno un decifratore per squadra.',
                            )}{' '}
                      {!single && t('Il ruolo resta bloccato fino alla fine.')}
                    </Copy>
                    {state.isHost && (
                      <Button
                        title={t('Avvia missione →')}
                        disabled={busy || !validLobby(v)}
                        onPress={() => act({ type: 'start' })}
                      />
                    )}
                  </>
                )}
                {v &&
                  v.phase !== 'lobby' &&
                  (handoffRequired ? (
                    <View style={[s.panel, { borderColor: C[v.active], borderTopWidth: 4 }]}>
                      <Label>{t('PASSAGGIO DEL TELEFONO')}</Label>
                      <Text style={s.heading}>
                        {sharedSynchronizing
                          ? t('Sincronizzazione della partita…')
                          : t(
                              'Passa il telefono alla squadra {0}.',
                              it[v.active].toLocaleLowerCase(language),
                            )}
                      </Text>
                      <Text style={s.subtitle}>
                        {ownRole === 'spy'
                          ? t('Al suggeritore di turno')
                          : t('Ai decifratori di turno')}
                      </Text>
                      <Copy>
                        {sharedSynchronizing
                          ? t(
                              'Attendi lo stato attuale prima di passare il telefono o mostrare la mappa.',
                            )
                          : ownRole === 'spy'
                            ? t(
                                'Solo il suggeritore può guardare questo schermo. Conferma quando ha ricevuto il telefono per mostrare la mappa riservata.',
                              )
                            : t(
                                'Conferma quando il telefono è in mano ai decifratori della squadra indicata.',
                              )}
                      </Copy>
                      {v.turnSeconds !== null && (
                        <Copy>{t('Il tempo del turno continua durante il passaggio.')}</Copy>
                      )}
                      {v.paused && (
                        <Copy>{t('L’host non è disponibile. Attendete il suo rientro.')}</Copy>
                      )}
                      <Button
                        title={t(
                          'Conferma · {0}squadra {1}',
                          single
                            ? ownRole === 'spy'
                              ? t('suggeritore · ')
                              : t('decifratori · ')
                            : '',
                          it[v.active].toLocaleLowerCase(language),
                        )}
                        disabled={
                          busy ||
                          v.paused ||
                          (!state.isHost && state.status !== 'Connesso all’host')
                        }
                        onPress={() =>
                          act({
                            type: 'handoff',
                            turn: v.turn,
                            ...(single && (v.phase === 'clue' || v.phase === 'guess')
                              ? { phase: v.phase }
                              : {}),
                          })
                        }
                      />
                    </View>
                  ) : (
                    <>
                      {own && (
                        <View
                          style={[
                            s.panel,
                            { borderColor: C[displayTeam], borderLeftWidth: 5, gap: 6 },
                          ]}
                        >
                          <Text style={[s.tag, { color: C[displayTeam] }]}>
                            {single
                              ? t('UNICO DISPOSITIVO · RUOLO DI QUESTA FASE')
                              : shared
                                ? t('DISPOSITIVO CONDIVISO · SQUADRA DI TURNO')
                                : t('LA TUA SQUADRA')}
                          </Text>
                          <Text style={[s.subtitle, { color: C[displayTeam] }]}>
                            {symbols[displayTeam]}
                            {t(' Squadra ')}
                            {it[displayTeam]} ·{' '}
                            {rotating
                              ? ownRole === 'spy'
                                ? t('Suggeritori')
                                : t('Decifratori')
                              : it[own.role]}
                          </Text>
                          {v.phase !== 'finished' && (
                            <Copy>
                              {rotating || v.active === own.team
                                ? t('È il turno della tua squadra.')
                                : t(
                                    'Ora gioca la squadra {0}.',
                                    it[v.active].toLocaleLowerCase(language),
                                  )}
                            </Copy>
                          )}
                        </View>
                      )}
                      <View style={[s.mission, { borderColor: C[v.active] + '65' }]}>
                        <GradientFill
                          from={v.active === 'red' ? '#432C43' : '#29395A'}
                          to="#22223A"
                        />
                        <View style={s.row}>
                          <Label>
                            {v.phase === 'finished'
                              ? t('MISSIONE CONCLUSA')
                              : t('TURNO SQUADRA {0}', it[v.active].toLocaleUpperCase(language))}
                          </Label>
                          <Text style={[s.tag, { marginLeft: 'auto' }]}>
                            {ownRole ? it[ownRole] : ''}
                          </Text>
                        </View>
                        <View style={[s.row, { alignItems: 'baseline' }]}>
                          <Text style={s.clue}>
                            {v.clue?.word ||
                              (v.phase === 'finished' ? t('Fine missione') : t('Attesa indizio'))}
                          </Text>
                          {v.clue && (
                            <Text style={s.clueNumber}>
                              {v.clue.count === 'infinity' ? '∞' : v.clue.count}
                            </Text>
                          )}
                        </View>
                        <Copy>
                          {v.phase === 'clue'
                            ? t('Il suggeritore attivo prepara una parola.')
                            : v.phase === 'guess'
                              ? t(
                                  'Tentativi disponibili: {0} · effettuati: {1}',
                                  v.remaining ?? '∞',
                                  v.guesses,
                                )
                              : message(v.reason ?? '')}
                        </Copy>
                      </View>
                      {v.turnSeconds !== null && v.phase !== 'finished' && (
                        <View
                          style={[
                            s.notice,
                            {
                              borderColor:
                                secondsLeft !== null && secondsLeft <= 10 ? C.red : C.stroke,
                            },
                          ]}
                        >
                          <Label>{t('TEMPO DEL TURNO · CAMBIO AUTOMATICO')}</Label>
                          <Text
                            accessibilityRole="timer"
                            style={[
                              s.subtitle,
                              { color: secondsLeft !== null && secondsLeft <= 10 ? C.red : C.gold },
                            ]}
                          >
                            {secondsLeft === null
                              ? t('Timer sospeso')
                              : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`}
                          </Text>
                        </View>
                      )}
                      <View style={s.score}>
                        {(['red', 'blue'] as Team[]).map((team) => (
                          <TeamScore
                            key={team}
                            team={team}
                            count={v.counters[team]}
                            total={
                              v.counters[team] +
                              v.board.filter((card) => card.revealed && card.color === team).length
                            }
                            active={v.phase !== 'finished' && v.active === team}
                            own={!rotating && own?.team === team}
                          />
                        ))}
                      </View>
                      {v.paused && v.phase !== 'finished' && (
                        <View style={s.notice}>
                          <Text style={s.subtitle}>{t('Partita in attesa')}</Text>
                          <Copy>{t('L’host non è disponibile. Attendete il suo rientro.')}</Copy>
                        </View>
                      )}
                      {ownRole === 'spy' && (
                        <Text style={[s.tag, { color: C.gold }]}>
                          {single
                            ? t('◈ MAPPA RISERVATA · SOLO IL SUGGERITORE DI TURNO')
                            : t('◈ MAPPA RISERVATA · ENTRAMBI I SUGGERITORI VEDONO I COLORI')}
                        </Text>
                      )}
                      <View style={s.board}>
                        {Array.from({ length: 5 }, (_, row) => (
                          <View key={row} style={s.boardRow}>
                            {v.board.slice(row * 5, row * 5 + 5).map((c, column) => {
                              const index = row * 5 + column;
                              return (
                                <WordCard
                                  key={v.round + '-' + index}
                                  card={c}
                                  index={index}
                                  enabled={!!canGuess && !busy}
                                  small={cardWidth < 65}
                                  highlighted={visibleReveal?.index === index}
                                  onPress={() => selectCard(index)}
                                />
                              );
                            })}
                          </View>
                        ))}
                      </View>
                      <Copy>
                        {t(
                          'Il pallino si colora di rosso o blu per indicare la squadra che ha scelto la carta. Le carte già scoperte sono più scure.',
                        )}
                      </Copy>
                      <View style={s.legend}>
                        {(['red', 'blue', 'neutral', 'assassin'] as Color[]).map((color) => (
                          <Text
                            key={color}
                            style={[s.tiny, { color: color === 'assassin' ? C.text : C[color] }]}
                          >
                            {symbols[color]} {it[color]}
                          </Text>
                        ))}
                      </View>
                      {v.phase === 'clue' &&
                        own &&
                        ownRole === 'spy' &&
                        (rotating || own.team === v.active) && (
                          <View style={s.panel}>
                            <Input
                              label={t('IL TUO INDIZIO · UNA PAROLA')}
                              value={clueWord}
                              onChangeText={setClueWord}
                              placeholder={t('Una parola, molte connessioni')}
                            />
                            <Label>{t('NUMERO DI PAROLE')}</Label>
                            <View style={s.numbers}>
                              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 'infinity' as const].map((n) => (
                                <Pill
                                  key={n}
                                  title={n === 'infinity' ? '∞' : String(n)}
                                  selected={clueCount === n}
                                  onPress={() => setClueCount(n)}
                                />
                              ))}
                            </View>
                            {(clueCount === 0 || clueCount === 'infinity') && (
                              <Copy>
                                {clueCount === 0
                                  ? t(
                                      '0: evitate le parole legate all’indizio. Tentativi illimitati finché si indovina.',
                                    )
                                  : t(
                                      '∞: tentativi illimitati, senza indicare quante parole si collegano all’indizio.',
                                    )}{' '}
                                {t('È comunque obbligatorio almeno un tentativo.')}
                              </Copy>
                            )}
                            <Button
                              title={
                                single
                                  ? t('Nascondi mappa e passa ai decifratori')
                                  : t('Trasmetti indizio')
                              }
                              disabled={busy || v.paused || !clueWord.trim()}
                              onPress={() =>
                                act({ type: 'clue', word: clueWord, count: clueCount })
                              }
                            />
                          </View>
                        )}
                      {v.phase === 'guess' &&
                        own &&
                        ownRole === 'guesser' &&
                        (rotating || own.team === v.active) && (
                          <>
                            <Copy>
                              {t(
                                'Toccate una carta per confermarla insieme. La prima scelta valida ricevuta dall’host prevale.',
                              )}
                            </Copy>
                            <Button
                              title={t('Termina il turno')}
                              secondary
                              disabled={busy || v.paused || v.guesses < 1 || !canGuess}
                              onPress={() => act({ type: 'end' })}
                            />
                          </>
                        )}
                      {v.phase === 'finished' && (
                        <View style={[s.panel, { borderColor: v.winner ? C[v.winner] : C.gold }]}>
                          <Label>{t('ESITO DELLA MISSIONE')}</Label>
                          <Text style={s.heading}>
                            {v.winner
                              ? t('Vince la squadra {0}.', it[v.winner].toLocaleLowerCase(language))
                              : t('Missione annullata.')}
                          </Text>
                          <Copy>{message(v.reason ?? '')}</Copy>
                          {state.isHost ? (
                            <Button
                              title={t('Torna in lobby · nuova missione')}
                              disabled={busy}
                              onPress={() => act({ type: 'lobby' })}
                            />
                          ) : (
                            <Copy>{t('L’host può riaprire la lobby per una nuova partita.')}</Copy>
                          )}
                        </View>
                      )}
                      <Button
                        title={t('Consulta il registro')}
                        secondary
                        onPress={() => setPage('history')}
                      />
                      {state.isHost && v.phase !== 'finished' && (
                        <Button
                          title={t('Annulla missione')}
                          secondary
                          danger
                          disabled={busy}
                          onPress={() =>
                            Alert.alert(
                              t('Annullare la missione?'),
                              t('Sarà possibile tornare in lobby e cambiare i ruoli.'),
                              [
                                { text: t('Continua a giocare'), style: 'cancel' },
                                {
                                  text: t('Annulla missione'),
                                  style: 'destructive',
                                  onPress: () => act({ type: 'cancel' }),
                                },
                              ],
                            )
                          }
                        />
                      )}
                    </>
                  ))}
                {state.active && (
                  <>
                    <View style={s.rule} />
                    {!single && (
                      <Button
                        title={t('Riprendi collegamento')}
                        secondary
                        compact
                        disabled={working}
                        onPress={() => void run(() => runtime.resumeTransport())}
                      />
                    )}
                    {!single && (
                      <Button
                        title={t('Diagnostica · prova tecnica')}
                        secondary
                        compact
                        onPress={() => setPage('diagnostics')}
                      />
                    )}
                    <Button
                      title={single ? t('Salva ed esci') : t('Lascia stanza')}
                      secondary
                      compact
                      onPress={goHome}
                    />
                  </>
                )}
              </>
            )}
            {page === 'history' && (
              <>
                <Label>{t('SOLO INFORMAZIONI PUBBLICHE')}</Label>
                <Text style={s.heading}>{t('Ogni parola lascia una traccia.')}</Text>
                {v?.history.map((line, i) => (
                  <View key={i} style={s.historyRow}>
                    <Text style={s.historyNumber}>{String(i + 1).padStart(2, '0')}</Text>
                    <Copy style={{ flex: 1 }}>{history(line)}</Copy>
                  </View>
                ))}
                <Button
                  title={t('Torna al tabellone')}
                  secondary
                  onPress={() => setPage('session')}
                />
              </>
            )}
            {page === 'diagnostics' && (
              <>
                <Label>{t('PROVA TECNICA / SOCKET NATIVI')}</Label>
                <Text style={s.heading}>{t('Verifica il canale.')}</Text>
                <Copy>
                  {t(
                    'Su quattro telefoni: uno ospita, tre entrano e vengono approvati. Ogni client invia un messaggio ECO e verifica la risposta dell’host. Scollega un client, poi fallo rientrare. Questa schermata registra gli eventi effettivi della sessione; non simula connessioni.',
                  )}
                </Copy>
                <View style={s.panel}>
                  <Copy>
                    {t('Modalità: ')}
                    {state.mode}
                    {'\n'}
                    {t('Versione app: ')}
                    {APP_VERSION}
                    {'\n'}
                    {t('Connessi: ')}
                    {v?.players.filter((p) => p.connected).length || 0} / {v?.players.length || 0}
                    {'\n'}
                    {t('Versione stato: ')}
                    {v?.version ?? '—'}
                    {'\n'}
                    {t('Stato: ')}
                    {message(state.status)}
                    {state.mode === 'bluetooth' && state.hostFingerprint
                      ? t('\nImpronta host: {0}', state.hostFingerprint)
                      : ''}
                    {state.viaRelay ? t('\nCollegamento tramite ponte cifrato') : ''}
                  </Copy>
                  <Button
                    title={t('Invia ECO all’host')}
                    disabled={busy || !v}
                    onPress={() =>
                      act({
                        type: 'probe',
                        text: t(
                          'Test da {0} #{1}',
                          own?.nickname || 'host',
                          Date.now().toString().slice(-5),
                        ),
                      })
                    }
                  />
                </View>
                {!state.isHost && state.mode === 'bluetooth' && !state.viaRelay && v && (
                  <View style={s.panel}>
                    <Label>{t('PONTE SPERIMENTALE')}</Label>
                    <Copy>
                      {t(
                        'Il ponte deve restare in primo piano. Dopo un riavvio riattivalo qui per far rientrare i partecipanti collegati attraverso questo telefono.',
                      )}
                    </Copy>
                    <Button
                      title={
                        state.relayEnabled ? t('Disattiva ponte') : t('Attiva ponte sperimentale')
                      }
                      secondary
                      disabled={working}
                      onPress={() => void run(() => runtime.setRelay(!state.relayEnabled))}
                    />
                    {state.relayEnabled && (
                      <Button
                        title={t('Rendi ponte visibile')}
                        secondary
                        onPress={() => void run(() => runtime.visible())}
                      />
                    )}
                  </View>
                )}
                {state.diagnostics.map((line, i) => (
                  <Text key={i} selectable style={s.log}>
                    {message(line)}
                  </Text>
                ))}
                <Copy>
                  {t(
                    'Wi-Fi e dati mobili devono essere spenti durante il test Bluetooth. I dispositivi fisici non sono stati collaudati automaticamente.',
                  )}
                </Copy>
                <Button
                  title={t('Torna alla stanza')}
                  secondary
                  onPress={() => setPage('session')}
                />
              </>
            )}
            {page === 'rules' && (
              <>
                <Label>{t('LEGGI PRIMA DELLA PRIMA MISSIONE')}</Label>
                <Text style={s.heading}>
                  {t('Una parola.')}
                  {'\n'}
                  {t('Una connessione.')}
                </Text>
                <Copy style={{ lineHeight: 25 }}>{it.rules}</Copy>
                <View style={s.panel}>
                  <Label>{t('RISERVATEZZA')}</Label>
                  <Copy>
                    {t(
                      'Le carte coperte vengono escluse dai messaggi ai decifratori. Il telefono host conserva necessariamente la mappa completa. Non esiste protezione contro un host modificato intenzionalmente.',
                    )}
                  </Copy>
                </View>
                <Button title={t('Torna alla Home')} secondary onPress={() => setPage('home')} />
              </>
            )}
            {page === 'settings' && (
              <>
                <Label>{t('PREFERENZE LOCALI')}</Label>
                <Text style={s.heading}>{t('Il tuo equipaggiamento.')}</Text>
                <Copy>
                  {t('Versione ')}
                  {APP_VERSION}
                </Copy>
                <Button
                  title={t('Progetto su GitHub')}
                  subtitle={t('Aggiornamenti, codice sorgente e segnalazioni · apre il browser')}
                  icon="github"
                  secondary
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      try {
                        await Linking.openURL('https://github.com/PaoloConteDev/OpenCodenames');
                      } catch {
                        throw new Error(
                          t('Impossibile aprire GitHub. Riprova con un browser disponibile.'),
                        );
                      }
                    })
                  }
                />
                {(
                  [
                    {
                      key: 'haptic',
                      title: t('Feedback aptico'),
                      description: t('Una breve vibrazione alla conferma.'),
                    },
                    {
                      key: 'sound',
                      title: t('Suono delle azioni'),
                      description: t('Segnale sintetizzato sul telefono, senza download.'),
                    },
                  ] as const
                ).map((setting) => (
                  <View key={setting.key} style={s.setting}>
                    <View style={{ flex: 1, gap: 7 }}>
                      <Text style={s.subtitle}>{setting.title}</Text>
                      <Copy>{setting.description}</Copy>
                    </View>
                    <Switch
                      accessibilityLabel={setting.title}
                      value={state.settings[setting.key]}
                      onValueChange={(value) =>
                        void run(() =>
                          runtime.settings({ ...state.settings, [setting.key]: value }),
                        )
                      }
                      trackColor={{ true: C.gold, false: C.stroke }}
                      thumbColor={C.text}
                    />
                  </View>
                ))}
                <View style={s.panel}>
                  <Label>
                    {languages
                      .find((option) => option.code === language)!
                      .name.toLocaleUpperCase(language)}
                  </Label>
                  <Copy>
                    {words.length}
                    {t(
                      ' parole incluse. Font Space Grotesk incluso nell’APK (SIL OFL). Codice e contenuti originali MIT. Nessun account, pubblicità, telemetria o servizio AI durante la partita.',
                    )}
                  </Copy>
                </View>
                <Copy>
                  {t(
                    'Conservazione: l’host salva la stanza e la mappa nella memoria privata dell’app; gli altri conservano solo le credenziali di recupero. Nessun backup cloud. Disinstallare l’app elimina questi dati.',
                  )}
                </Copy>
                <Button title={t('Torna alla Home')} secondary onPress={() => setPage('home')} />
              </>
            )}
            {page === 'settings' && (
              <Button
                title={t('Licenze delle dipendenze · offline')}
                secondary
                onPress={() => setPage('licenses')}
              />
            )}
            {page === 'licenses' && (
              <>
                <Label>{t('OPEN SOURCE / AVVISI INCLUSI')}</Label>
                <Copy>
                  {t(
                    'Open Codenames © 2026 contributors · MIT. Font Space Grotesk · SIL OFL. Le dipendenze mantengono le rispettive licenze. Cerca il nome di un pacchetto e aprilo per leggere gli avvisi conservati.',
                  )}
                </Copy>
                <Input
                  label={t('CERCA PACCHETTO')}
                  value={licenseQuery}
                  onChangeText={setLicenseQuery}
                  maxLength={80}
                  placeholder={t('es. space-grotesk o react-native')}
                />
                {(
                  require('./assets/third-party-notices.json') as {
                    name: string;
                    version: string;
                    license: string;
                    texts: string[];
                  }[]
                )
                  .filter((n) => n.name.includes(licenseQuery.toLowerCase()))
                  .slice(0, 30)
                  .map((n, i) => (
                    <View key={`${n.name}-${i}`} style={s.panel}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setExpandedLicense(expandedLicense === n.name ? '' : n.name)}
                        style={{ minHeight: 44 }}
                      >
                        <Text style={s.playerName}>
                          {n.name}@{n.version}
                        </Text>
                        <Copy>
                          {n.license}
                          {t(' · tocca per leggere')}
                        </Copy>
                      </Pressable>
                      {expandedLicense === n.name && (
                        <Copy>
                          {n.texts.join('\n\n') ||
                            t('Consultare la licenza indicata nel pacchetto sorgente.')}
                        </Copy>
                      )}
                    </View>
                  ))}
                <Copy>
                  {t(
                    'Sono mostrati i primi 30 risultati. Restringi la ricerca per trovare gli altri pacchetti. Il repository contiene anche THIRD_PARTY_NOTICES.txt con l’elenco completo.',
                  )}
                </Copy>
              </>
            )}
            {busy && (
              <View accessibilityLiveRegion="polite" style={s.status}>
                <ActivityIndicator color={C.gold} />
                <Text style={s.tiny}>{t('OPERAZIONE IN CORSO…')}</Text>
              </View>
            )}
          </Animated.ScrollView>
        </KeyboardAvoidingView>
        <Modal
          transparent
          visible={!!visibleReveal}
          animationType={reduceMotion ? 'none' : 'fade'}
          onRequestClose={() => setRevealNotice(null)}
        >
          {visibleReveal && (
            <View style={s.revealBackdrop}>
              <View accessibilityViewIsModal style={[s.revealDialog, { borderColor: revealColor }]}>
                <ScrollView contentContainerStyle={s.revealContent} bounces={false}>
                  <View
                    accessible
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    accessibilityLabel={`${visibleReveal.word}. ${revealTitles[visibleReveal.kind]}. ${it[visibleReveal.color]}. ${t('Scelta dalla squadra {0}', it[visibleReveal.team])}. ${revealOutcome}`}
                    style={s.revealResult}
                  >
                    <View style={[s.revealSymbol, { backgroundColor: revealColor + '18' }]}>
                      <Text style={[s.revealSymbolText, { color: revealColor }]}>
                        {symbols[visibleReveal.color]}
                      </Text>
                    </View>
                    <Text style={[s.tag, { color: revealColor, textAlign: 'center' }]}>
                      {revealTitles[visibleReveal.kind]}
                    </Text>
                    <View style={[s.revealCard, { borderColor: revealColor }]}>
                      <GradientFill from={revealColor + '30'} to="#22223A" />
                      <Text style={s.revealWord}>
                        {visibleReveal.word.toLocaleUpperCase(language)}
                      </Text>
                      <Text style={[s.tag, { color: revealColor }]}>{it[visibleReveal.color]}</Text>
                    </View>
                    <Text style={s.tiny}>
                      {t('Scelta dalla squadra {0}', it[visibleReveal.team])}
                    </Text>
                    <Text style={[s.copy, { textAlign: 'center' }]}>{revealOutcome}</Text>
                  </View>
                  <Button title={t('Continua')} onPress={() => setRevealNotice(null)} />
                </ScrollView>
              </View>
            </View>
          )}
        </Modal>
      </SafeAreaView>
    </MotionContext.Provider>
  );
}
const s = StyleSheet.create({
  revealBackdrop: {
    flex: 1,
    backgroundColor: '#080812B8',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  revealDialog: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '100%',
    backgroundColor: '#22223A',
    borderWidth: 2,
    borderRadius: 28,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  revealContent: { padding: 24, gap: 24 },
  revealResult: { alignItems: 'center', gap: 16 },
  revealSymbol: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealSymbolText: { fontSize: 32, fontFamily: 'SpaceGrotesk_700Bold' },
  revealCard: {
    width: '100%',
    minHeight: 140,
    padding: 20,
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  revealWord: {
    color: C.text,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 30,
    textAlign: 'center',
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 18,
    minHeight: 64,
    borderRadius: 18,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.stroke,
  },
  fill: { flex: 1, backgroundColor: C.bg },
  center: { justifyContent: 'center', alignItems: 'center', gap: 18 },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 18,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: '#101021E8',
  },
  back: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.stroke,
    backgroundColor: C.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontFamily: 'SpaceGrotesk_700Bold', color: C.text, fontSize: 18 },
  tiny: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: C.muted, lineHeight: 17 },
  mark: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, width: 32, height: 30 },
  label: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 10,
    letterSpacing: 1.5,
    color: C.gold,
    lineHeight: 18,
  },
  copy: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, lineHeight: 21, color: C.muted },
  heading: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 29,
    lineHeight: 34,
    letterSpacing: -0.8,
    color: C.text,
  },
  subtitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 18, color: C.text },
  hero: {
    borderWidth: 1,
    borderColor: C.stroke,
    padding: 22,
    borderRadius: 30,
    gap: 12,
    backgroundColor: C.panel,
    overflow: 'hidden',
  },
  heroLine: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 34,
    lineHeight: 39,
    color: C.text,
    letterSpacing: -1.5,
  },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  rule: { backgroundColor: C.stroke, height: 1 },
  stat: { fontSize: 11, color: '#ECEBFF', fontFamily: 'SpaceGrotesk_500Medium' },
  button: {
    minHeight: 56,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 18,
    backgroundColor: C.gold,
    overflow: 'hidden',
  },
  secondary: { backgroundColor: '#202039', borderColor: '#3D3B5A' },
  buttonText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    color: C.bg,
    textAlign: 'center',
  },
  panel: {
    backgroundColor: C.panel,
    padding: 19,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: C.stroke,
    gap: 14,
  },
  footer: { fontSize: 11, textAlign: 'center', lineHeight: 18, marginTop: 4 },
  transport: {
    backgroundColor: C.panel,
    padding: 20,
    flexDirection: 'row',
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.stroke,
  },
  transportIcon: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  tag: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.5,
    color: C.muted,
    lineHeight: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: C.stroke,
    borderRadius: 17,
    padding: 15,
    minHeight: 54,
    color: C.text,
    backgroundColor: C.panel,
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 16,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.stroke,
    borderRadius: 13,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { color: C.muted, fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold' },
  connection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1C1C35',
    borderRadius: 15,
    padding: 12,
  },
  qr: { alignSelf: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 12 },
  player: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.stroke,
  },
  playerName: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 15, color: C.text },
  remove: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  mission: {
    borderWidth: 1,
    borderRadius: 24,
    backgroundColor: C.panel,
    padding: 20,
    gap: 10,
    overflow: 'hidden',
  },
  clue: { fontFamily: 'SpaceGrotesk_700Bold', color: C.text, fontSize: 28, flexShrink: 1 },
  clueNumber: {
    fontSize: 32,
    color: C.gold,
    fontFamily: 'SpaceGrotesk_500Medium',
    backgroundColor: '#FFFFFF0D',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  score: { flexDirection: 'row', gap: 12 },
  board: { gap: 6 },
  boardRow: { flexDirection: 'row', gap: 6 },
  legend: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' },
  numbers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notice: {
    borderWidth: 1,
    borderColor: C.gold,
    backgroundColor: C.panel,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  error: {
    backgroundColor: '#492b2c',
    padding: 14,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
  },
  errorText: {
    color: '#ffd9d4',
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 13,
    lineHeight: 19,
  },
  status: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  historyRow: {
    flexDirection: 'row',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.stroke,
    paddingVertical: 12,
  },
  historyNumber: { color: C.gold, fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12 },
  log: { color: C.muted, fontFamily: 'monospace', fontSize: 11, lineHeight: 17 },
  setting: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.stroke,
  },
  headerCaption: {
    color: C.muted,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 10,
    marginTop: 3,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#B8F48A12',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
  },
  headerBadgeText: { color: C.green, fontSize: 10, fontFamily: 'SpaceGrotesk_500Medium' },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.green },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 20,
    backgroundColor: '#FFFFFF0B',
    alignSelf: 'flex-start',
  },
  heroTagText: {
    color: '#E0DEF9',
    fontSize: 8,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    letterSpacing: 0.6,
  },
  heroCopy: {
    color: '#D5D2F0',
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    backgroundColor: '#15152B50',
    borderRadius: 14,
    padding: 12,
  },
  heroStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statDivider: { width: 1, height: 13, backgroundColor: '#FFFFFF24' },
  sectionHeading: { gap: 3, marginTop: 4 },
  sectionTitle: { color: C.text, fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 19 },
  featuredButton: { minHeight: 86, paddingHorizontal: 17, borderRadius: 22, borderWidth: 0 },
  actionIcon: {
    width: 44,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCaption: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, lineHeight: 16 },
  radioIndicator: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCheck: { color: C.bg, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold' },
  avatar: {
    width: 36,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 17 },
  presenceDot: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: C.panel,
    bottom: 0,
    right: -2,
  },
});
