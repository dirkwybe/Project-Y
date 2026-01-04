import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SQLite from 'expo-sqlite';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
  Image,
  Alert,
  ActivityIndicator,
  Appearance,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { enableScreens } from 'react-native-screens';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Polyline } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { useFonts } from 'expo-font';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import { Ionicons } from '@expo/vector-icons';

enableScreens(false);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

type FastingSession = {
  id: number;
  start_time: number;
  end_time: number | null;
  protocol_key: string;
  created_at: number;
  updated_at: number;
};

type EatingNote = {
  id: number;
  timestamp: number;
  text: string;
  calories: number | null;
  thumbnail_path?: string | null;
  meta_json?: string | null;
};

type ScanItem = {
  name: string;
  portion?: string | null;
  grams?: number | null;
  confidence?: number | null;
  calories?: number | null;
  sourceName?: string | null;
  count?: number | null;
};

type ThemePreference = 'system' | 'light' | 'dark';
type HydrationMode = 'fasting' | 'eating' | 'both';
type UnitSystem = 'metric' | 'imperial';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
type CalorieGoalMode = 'lose' | 'maintain' | 'gain';
type PlanPace = 'gentle' | 'moderate' | 'aggressive';

type FoodEstimateResult = {
  items: ScanItem[];
  totalCalories: number;
  disclaimer?: string;
};

type PortionCoachResult = {
  estimatedCalories: number;
  targetCalories: number | null;
  adjustments: string[];
  summary: string;
};

type GoalTuningResult = {
  recommendedProtocol: string;
  rationale: string;
  note?: string;
};

type AutopilotItem = {
  id: string;
  time: string;
  timeMs: number;
  title: string;
  calories: number;
  notes?: string;
  ingredients?: string[];
};

type AutopilotResult = {
  items: AutopilotItem[];
  totalCalories: number;
  disclaimer?: string;
  windowStart?: number;
  windowEnd?: number;
  windowLabel?: string;
};

type CravingRescueResult = {
  quickTip: string;
  steps: string[];
  snackIdeas?: string[];
};

type FridgeMealIdea = {
  title: string;
  calories: number;
  ingredients: string[];
  notes?: string;
};

type FridgeIdeasResult = {
  items: string[];
  meals: FridgeMealIdea[];
  calorieLimit: number;
  disclaimer?: string;
};

type PantryItem = {
  id: number;
  title: string;
  calories: number;
  ingredients: string[];
  notes: string | null;
  createdAt: number;
};

type AdaptivePlan = {
  id: number;
  goalMode: CalorieGoalMode;
  targetPace: PlanPace;
  startProtocol: string;
  targetProtocol: string;
  minEatingHours: number;
  rampWeeks: number;
  startDate: number;
  status: string;
  createdAt: number;
  updatedAt: number;
};

type AdaptivePlanWeek = {
  id: number;
  plan_id: number;
  week_index: number;
  protocol_key: string;
  daily_calories: number | null;
  notes: string | null;
};

type PlanCheckIn = {
  id: number;
  plan_id: number;
  week_index: number;
  adherence_pct: number;
  energy: number;
  hunger: number;
  conflicts: string | null;
  suggestion_json: string | null;
  created_at: number;
};

type PlanUpdate = {
  id: number;
  plan_id: number;
  message: string;
  created_at: number;
};

type PlanSuggestion = {
  action: 'step_up' | 'hold' | 'step_down';
  rationale: string;
  nextProtocol?: string;
};

type SettingsState = {
  protocolKey: string;
  customFastingHours: number;
  customEatingHours: number;
  remindersEnabled: boolean;
  allowNightReminders: boolean;
  remindersIntroShown: boolean;
  hydrationEnabled: boolean;
  hydrationMode: HydrationMode;
  hydrationIntervalHours: number;
  dailyCalorieGoal: number;
  unitSystem: UnitSystem;
  historyRetentionDays: number;
  themePreference: ThemePreference;
};

type TabParamList = {
  Home: undefined;
  Insights: undefined;
  Eating: undefined;
  Smart: undefined;
  Plan: undefined;
  Settings: undefined;
};

type Theme = {
  mode: 'light' | 'dark';
  bg: string;
  bgAlt: string;
  card: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
  shadow: string;
  panic: string;
};

  type ScreenProps = {
    theme: Theme;
    now: number;
    protocolLabel: string;
    activeSession: FastingSession | null;
    isFasting: boolean;
    activeDuration: number;
    expectedEnd: number | false | null;
  avgWeekMs: number;
  longestWeekMs: number;
  adherencePct: number;
  totalWeekMs: number;
  dailyTotals: { label: string; totalMs: number }[];
  maxDailyMs: number;
  dailyCaloriesTotals: { label: string; totalCalories: number }[];
  maxDailyCalories: number;
  todayCalories: number;
  dailyCalorieGoal: number;
  eatingWindowElapsedMs: number;
  eatingWindowRemainingMs: number | null;
  eatingWindowTotalMs: number | null;
  currentWindowLabel: string;
  currentWindowCalories: number;
  currentWindowNotes: EatingNote[];
  eatingWindowsHistory: {
    start: number;
    end: number;
    totalCalories: number;
    noteCount: number;
    notes: EatingNote[];
  }[];
  nextReminderLabel: string;
  nextHydrationLabel: string;
  notes: EatingNote[];
  sessions: FastingSession[];
  settings: SettingsState;
  onStartFast: () => void;
  onStopFast: () => void;
  onOpenEdit: (session: FastingSession) => void;
  onAddNote: () => void;
  noteText: string;
  noteCalories: string;
  setNoteText: (value: string) => void;
  setNoteCalories: (value: string) => void;
  ifEatText: string;
  setIfEatText: (value: string) => void;
  ifEatResult: FoodEstimateResult | null;
  ifEatBusy: boolean;
  onEstimateFood: () => void;
  onClearFoodEstimate: () => void;
  portionText: string;
  setPortionText: (value: string) => void;
  portionTarget: string;
  setPortionTarget: (value: string) => void;
  portionResult: PortionCoachResult | null;
  portionBusy: boolean;
  onPortionCoach: () => void;
  onClearPortionCoach: () => void;
  fridgeLimit: string;
  setFridgeLimit: (value: string) => void;
  fridgeIdeas: FridgeIdeasResult | null;
  fridgeBusy: boolean;
  onScanFridge: () => void;
  onClearFridgeIdeas: () => void;
  pantryItems: PantryItem[];
  onSaveFridgeIdea: (meal: FridgeMealIdea) => void;
  pantryPickerVisible: boolean;
  onOpenPantryPicker: () => void;
  onClosePantryPicker: () => void;
  goalTuningResult: GoalTuningResult | null;
  goalTuningBusy: boolean;
  onRequestGoalTuning: () => void;
  onApplyGoalTuning: () => void;
  onUpdateSetting: <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => void;
  notificationStatus: string;
  onRequestNotificationPermissions: () => void;
  onSendTestReminder: () => void;
  onScanFoodPhoto: () => void;
  onScanFoodPhotoSmart: () => void;
  scanBusy: boolean;
  scanStatus: string;
  onDeleteNote: (id: number) => void;
  onOpenEditNote: (note: EatingNote) => void;
  onOpenCalorieHelper: () => void;
  onClearHistory: () => void;
  autopilotResult: AutopilotResult | null;
  autopilotBusy: boolean;
  onRequestAutopilot: () => void;
  onClearAutopilot: () => void;
  onUpdateAutopilotItem: (itemId: string, updates: Partial<AutopilotItem>) => void;
  onRemoveAutopilotItem: (itemId: string) => void;
  onOpenAutopilotTimePicker: (itemId: string) => void;
  onAddAutopilotItemFromPantry: (item: PantryItem) => void;
  rescueResult: CravingRescueResult | null;
  rescueBusy: boolean;
  onRequestRescue: () => void;
  onClearRescue: () => void;
  onOpenRescue: () => void;
  plan: AdaptivePlan | null;
  planWeeks: AdaptivePlanWeek[];
  planCheckins: PlanCheckIn[];
  planHistory: AdaptivePlan[];
  planUpdates: PlanUpdate[];
  planBuilderVisible: boolean;
  planGoalMode: CalorieGoalMode;
  setPlanGoalMode: (value: CalorieGoalMode) => void;
  planPace: PlanPace;
  setPlanPace: (value: PlanPace) => void;
  planStartProtocol: string;
  setPlanStartProtocol: (value: string) => void;
  planRampWeeks: number;
  setPlanRampWeeks: (value: number) => void;
  planMinEatingHours: number;
  setPlanMinEatingHours: (value: number) => void;
  planBusy: boolean;
  onOpenPlanBuilder: () => void;
  onClosePlanBuilder: () => void;
  onCreatePlan: () => void;
  checkinAdherence: number;
  setCheckinAdherence: (value: number) => void;
  checkinEnergy: number;
  setCheckinEnergy: (value: number) => void;
  checkinHunger: number;
  setCheckinHunger: (value: number) => void;
  checkinSuggestion: PlanSuggestion | null;
  onSavePlanCheckin: () => void;
  onApplyPlanSuggestion: () => void;
  onTogglePlanStatus: () => void;
  onActivatePlan: () => void;
  onDeactivatePlan: () => void;
  onClearPlan: () => void;
};

const Tab = createBottomTabNavigator<TabParamList>();

const DEFAULT_SETTINGS: SettingsState = {
  protocolKey: '16:8',
  customFastingHours: 16,
  customEatingHours: 8,
  remindersEnabled: true,
  allowNightReminders: false,
  remindersIntroShown: false,
  hydrationEnabled: true,
  hydrationMode: 'fasting',
  hydrationIntervalHours: 3,
  dailyCalorieGoal: 0,
  unitSystem: 'metric',
  historyRetentionDays: 0,
  themePreference: 'system',
};

const PROTOCOLS = [
  { key: '15:9', label: '15:9', fastingHours: 15, eatingHours: 9 },
  { key: '16:8', label: '16:8', fastingHours: 16, eatingHours: 8 },
  { key: '17:7', label: '17:7', fastingHours: 17, eatingHours: 7 },
  { key: '18:6', label: '18:6', fastingHours: 18, eatingHours: 6 },
  { key: 'custom', label: 'Custom', fastingHours: 0, eatingHours: 0 },
];

const ACTIVITY_LEVELS: {
  key: ActivityLevel;
  label: string;
  factor: number;
}[] = [
  { key: 'sedentary', label: 'Sedentary', factor: 1.2 },
  { key: 'light', label: 'Light', factor: 1.375 },
  { key: 'moderate', label: 'Moderate', factor: 1.55 },
  { key: 'active', label: 'Active', factor: 1.725 },
  { key: 'veryActive', label: 'Very active', factor: 1.9 },
];

const CALORIE_GOALS: {
  key: CalorieGoalMode;
  label: string;
  adjustment: number;
}[] = [
  { key: 'lose', label: 'Lose weight', adjustment: -400 },
  { key: 'maintain', label: 'Maintain', adjustment: 0 },
  { key: 'gain', label: 'Gain weight', adjustment: 300 },
];

const PLAN_PACES: { key: PlanPace; label: string }[] = [
  { key: 'gentle', label: 'Gentle' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'aggressive', label: 'Aggressive' },
];

const PROTOCOL_ORDER = ['15:9', '16:8', '17:7', '18:6'];
const PROTOCOL_EATING_HOURS: Record<string, number> = {
  '15:9': 9,
  '16:8': 8,
  '17:7': 7,
  '18:6': 6,
};

const FOOD_API_URL = process.env.EXPO_PUBLIC_FOOD_API_URL ?? '';
const FOOD_API_KEY = process.env.EXPO_PUBLIC_FOOD_API_KEY ?? '';

const normalizeImageAsset = async (asset: ImagePicker.ImagePickerAsset) => {
  const uri = asset.uri;
  const fileName = asset.fileName ?? 'photo';
  const mimeType = asset.mimeType ?? '';
  const lowerUri = uri.toLowerCase();
  const isJpeg =
    mimeType.includes('jpeg') ||
    mimeType.includes('jpg') ||
    lowerUri.endsWith('.jpg') ||
    lowerUri.endsWith('.jpeg');
  const isHeif =
    mimeType.includes('heic') ||
    mimeType.includes('heif') ||
    lowerUri.endsWith('.heic') ||
    lowerUri.endsWith('.heif');

  if (isHeif || !isJpeg) {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    return {
      uri: result.uri,
      name: `${fileName}.jpg`,
      type: 'image/jpeg',
    };
  }

  return {
    uri,
    name: fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') ? fileName : `${fileName}.jpg`,
    type: mimeType || 'image/jpeg',
  };
};

const initDb = async (db: SQLite.SQLiteDatabase) => {
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS fasting_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      protocol_key TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS eating_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      text TEXT NOT NULL,
      calories INTEGER
    );
    CREATE TABLE IF NOT EXISTS pantry_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      calories INTEGER NOT NULL,
      ingredients_json TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS adaptive_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_mode TEXT NOT NULL,
      target_pace TEXT NOT NULL,
      start_protocol TEXT NOT NULL,
      target_protocol TEXT NOT NULL,
      min_eating_hours INTEGER NOT NULL,
      ramp_weeks INTEGER NOT NULL,
      start_date INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS adaptive_plan_weeks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      week_index INTEGER NOT NULL,
      protocol_key TEXT NOT NULL,
      daily_calories INTEGER,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS adaptive_plan_checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      week_index INTEGER NOT NULL,
      adherence_pct INTEGER NOT NULL,
      energy INTEGER NOT NULL,
      hunger INTEGER NOT NULL,
      conflicts TEXT,
      suggestion_json TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS adaptive_plan_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );`
  );
};

const ensureEatingNotesColumns = async (db: SQLite.SQLiteDatabase) => {
  const columns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info('eating_notes');"
  );
  const names = new Set(columns.map((col) => col.name));
  if (!names.has('thumbnail_path')) {
    await db.execAsync('ALTER TABLE eating_notes ADD COLUMN thumbnail_path TEXT;');
  }
  if (!names.has('meta_json')) {
    await db.execAsync('ALTER TABLE eating_notes ADD COLUMN meta_json TEXT;');
  }
};

const formatDuration = (ms: number) => {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });

const parseIngredientsInput = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const getDateKey = (ts: number) => {
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isQuietHours = (date: Date) => {
  const hour = date.getHours();
  const quietStart = 22;
  const quietEnd = 7;
  return quietStart > quietEnd
    ? hour >= quietStart || hour < quietEnd
    : hour >= quietStart && hour < quietEnd;
};

const startOfWeek = (date: Date) => {
  const day = date.getDay();
  const diff = (day + 6) % 7;
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(date.getDate() - diff);
  return start;
};

const getProtocolDetails = (settings: SettingsState) => {
  if (settings.protocolKey === 'custom') {
    return {
      key: 'custom',
      label: `Custom ${settings.customFastingHours}:${settings.customEatingHours}`,
      fastingHours: settings.customFastingHours,
      eatingHours: settings.customEatingHours,
    };
  }
  return PROTOCOLS.find((protocol) => protocol.key === settings.protocolKey) ??
    PROTOCOLS[1];
};

const ScreenShell = ({ theme, children }: { theme: Theme; children: ReactNode }) => (
  <LinearGradient colors={[theme.bg, theme.bgAlt]} style={styles.gradient}>
    <SafeAreaView style={styles.container}>{children}</SafeAreaView>
  </LinearGradient>
);

const getCardStyle = (theme: Theme) => ({
  backgroundColor: theme.card,
  borderColor: theme.border,
  shadowColor: theme.shadow,
});

const RingTimer = ({
  progress,
  theme,
  label,
}: {
  progress: number;
  theme: Theme;
  label: string;
}) => {
  const size = 140;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const dashOffset = circumference * (1 - clamped);

  return (
    <View style={styles.ringWrap}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.border}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.accent}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.ringText, { color: theme.text }]}>{label}</Text>
      </View>
    </View>
  );
};

const HeaderBar = ({
  theme,
  title,
  subtitle,
}: {
  theme: Theme;
  title: string;
  subtitle: string;
}) => (
  <View style={styles.headerRow}>
    <View style={styles.headerContent}>
      <Text style={[styles.title, styles.headerTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.subtitle, styles.headerSubtitle, { color: theme.muted }]}>
        {subtitle}
      </Text>
    </View>
  </View>
);

const HomeScreen = ({
  theme,
  now,
  protocolLabel,
  activeSession,
  activeDuration,
  expectedEnd,
  avgWeekMs,
  longestWeekMs,
  adherencePct,
  eatingWindowElapsedMs,
  eatingWindowRemainingMs,
  eatingWindowTotalMs,
  currentWindowLabel,
  currentWindowCalories,
  currentWindowNotes,
  onOpenRescue,
  rescueBusy,
  nextReminderLabel,
  nextHydrationLabel,
  onStartFast,
  onStopFast,
  onOpenEdit,
}: ScreenProps) => {
  return (
    <ScreenShell theme={theme}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <HeaderBar
        theme={theme}
        title="Fasting Lane"
        subtitle={formatDate(now)}
      />

      <View style={[styles.card, getCardStyle(theme)]}> 
        <View style={styles.sectionTitleRow}>
          <Ionicons name="time-outline" size={16} color={theme.muted} />
          <Text style={[styles.sectionTitle, { color: theme.muted }]}>
            {activeSession ? 'Current Fast' : 'Current Eating Window'}
          </Text>
        </View>
        {activeSession ? (
          <>
            <Text style={[styles.timer, { color: theme.text }]}>
              {formatDuration(activeDuration)}
            </Text>
            <Text style={[styles.meta, { color: theme.muted }]}> 
              Started {formatTime(activeSession.start_time)} - {protocolLabel}
            </Text>
            {expectedEnd ? (
              <Text style={[styles.meta, { color: theme.muted }]}>Expected end {formatTime(expectedEnd)}</Text>
            ) : null}
            {expectedEnd ? (
              <>
                <RingTimer
                  progress={activeDuration / Math.max(1, expectedEnd - activeSession.start_time)}
                  theme={theme}
                  label={formatDuration(activeDuration)}
                />
                <View style={styles.fastMetaRow}>
                  <Text style={[styles.meta, { color: theme.muted }]}>
                    {formatDuration(Math.max(0, expectedEnd - now))} left
                  </Text>
                  <Pressable
                    style={[
                      styles.iconButton,
                      { borderColor: theme.border, backgroundColor: theme.panic },
                    ]}
                    onPress={onOpenRescue}
                    disabled={rescueBusy}
                  >
                    <Ionicons name="alert-circle-outline" size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              </>
            ) : null}
            <View style={styles.inlineRow}>
              <View style={[styles.infoBadge, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <Ionicons name="timer-outline" size={14} color={theme.accent} />
                <Text style={[styles.badgeText, { color: theme.text }]}>
                  Next: {nextReminderLabel || 'None'}
                </Text>
              </View>
              <View style={[styles.infoBadge, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <Ionicons name="water-outline" size={14} color={theme.accent} />
                <Text style={[styles.badgeText, { color: theme.text }]}>
                  Hydration: {nextHydrationLabel || 'None'}
                </Text>
              </View>
            </View>
            <View style={styles.row}>
              <Pressable
                style={[
                  styles.primaryButton,
                  { backgroundColor: theme.accent, shadowColor: theme.shadow },
                ]}
                onPress={onStopFast}
              >
                <Text style={styles.primaryButtonText}>Stop</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, { borderColor: theme.border }]}
                onPress={() => onOpenEdit(activeSession)}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Adjust</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.timer, { color: theme.text }]}>
              {eatingWindowTotalMs !== null
                ? formatDuration(eatingWindowElapsedMs)
                : 'No window yet'}
            </Text>
            <Text style={[styles.meta, { color: theme.muted }]}>{currentWindowLabel}</Text>
            <Text style={[styles.meta, { color: theme.muted }]}>Protocol {protocolLabel}</Text>
            {eatingWindowTotalMs ? (
              <>
                <RingTimer
                  progress={eatingWindowElapsedMs / Math.max(1, eatingWindowTotalMs)}
                  theme={theme}
                  label={formatDuration(eatingWindowElapsedMs)}
                />
                <Text style={[styles.meta, { color: theme.muted }]}>
                  {formatDuration(eatingWindowElapsedMs)} elapsed
                  {eatingWindowRemainingMs !== null
                    ? ` - ${formatDuration(Math.max(0, eatingWindowRemainingMs))} left`
                    : ''}
                </Text>
              </>
            ) : null}
            <Text style={[styles.meta, { color: theme.muted }]}>
              Calories in window: {currentWindowCalories} - Notes: {currentWindowNotes.length}
            </Text>
            <View style={styles.inlineRow}>
              <View style={[styles.infoBadge, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <Ionicons name="timer-outline" size={14} color={theme.accent} />
                <Text style={[styles.badgeText, { color: theme.text }]}>
                  Next: {nextReminderLabel || 'None'}
                </Text>
              </View>
              <View style={[styles.infoBadge, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <Ionicons name="water-outline" size={14} color={theme.accent} />
                <Text style={[styles.badgeText, { color: theme.text }]}>
                  Hydration: {nextHydrationLabel || 'None'}
                </Text>
              </View>
            </View>
              <Pressable
                style={[
                  styles.primaryButton,
                  styles.buttonSpacing,
                  { backgroundColor: theme.accent, shadowColor: theme.shadow },
                ]}
                onPress={onStartFast}
              >
              <Text style={styles.primaryButtonText}>Start fasting</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.sectionRow}>
        <View style={[styles.metricCard, getCardStyle(theme)]}> 
          <Text style={[styles.metricLabel, { color: theme.muted }]}>Weekly avg</Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>
            {formatDuration(avgWeekMs)}
          </Text>
        </View>
        <View style={[styles.metricCard, getCardStyle(theme)]}> 
          <Text style={[styles.metricLabel, { color: theme.muted }]}>Longest</Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>
            {formatDuration(longestWeekMs)}
          </Text>
        </View>
        <View style={[styles.metricCard, getCardStyle(theme)]}> 
          <Text style={[styles.metricLabel, { color: theme.muted }]}>Adherence</Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>{adherencePct}%</Text>
        </View>
      </View>

    </ScrollView>
  </ScreenShell>
  );
};

const InsightsHistoryScreen = ({
  theme,
  totalWeekMs,
  dailyTotals,
  maxDailyMs,
  dailyCaloriesTotals,
  maxDailyCalories,
  goalTuningResult,
  goalTuningBusy,
  onRequestGoalTuning,
  onApplyGoalTuning,
  sessions,
  now,
  onOpenEdit,
  eatingWindowsHistory,
}: ScreenProps) => {
  const [weeklyChartWidth, setWeeklyChartWidth] = useState(0);
  const [caloriesChartWidth, setCaloriesChartWidth] = useState(0);
  const [activeTab, setActiveTab] = useState<'insights' | 'history'>('insights');
  const chartHeight = 120;

  const movingAverage = (values: number[], windowSize = 3) =>
    values.map((_, index) => {
      const halfWindow = Math.floor(windowSize / 2);
      let sum = 0;
      let count = 0;
      for (let i = index - halfWindow; i <= index + halfWindow; i += 1) {
        if (i >= 0 && i < values.length) {
          sum += values[i];
          count += 1;
        }
      }
      return count > 0 ? sum / count : values[index];
    });

  const buildTrendPoints = (
    values: number[],
    maxValue: number,
    width: number,
    height: number
  ) => {
    if (!width || maxValue <= 0 || values.length === 0) return '';
    const colWidth = width / values.length;
    return values
      .map((value, index) => {
        const x = colWidth * (index + 0.5);
        const y = height - (value / maxValue) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const weeklyTrendValues = movingAverage(
    dailyTotals.map((day) => day.totalMs)
  );
  const weeklyTrendPoints = buildTrendPoints(
    weeklyTrendValues,
    Math.max(maxDailyMs, 1),
    weeklyChartWidth,
    chartHeight
  );
  const calorieTrendValues = movingAverage(
    dailyCaloriesTotals.map((day) => day.totalCalories)
  );
  const calorieTrendPoints = buildTrendPoints(
    calorieTrendValues,
    Math.max(maxDailyCalories, 1),
    caloriesChartWidth,
    chartHeight
  );

  return (
    <ScreenShell theme={theme}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <HeaderBar
          theme={theme}
          title="Insights"
          subtitle={activeTab === 'insights' ? 'Weekly overview' : 'Session history'}
        />

        <View style={styles.segmentedRow}>
          {(['insights', 'history'] as const).map((option) => (
            <Pressable
              key={option}
              style={[
                styles.segmentedButton,
                {
                  backgroundColor: option === activeTab ? theme.accent : theme.bg,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => setActiveTab(option)}
            >
              <Text
                style={[
                  styles.segmentedText,
                  { color: option === activeTab ? '#111' : theme.text },
                ]}
              >
                {option === 'insights' ? 'Insights' : 'History'}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeTab === 'insights' ? (
          <>
            <View style={[styles.card, getCardStyle(theme)]}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="stats-chart-outline" size={16} color={theme.muted} />
                <Text style={[styles.sectionTitle, { color: theme.muted }]}>Weekly Overview</Text>
              </View>
              <View
                style={styles.chartWrap}
                onLayout={(event) => setWeeklyChartWidth(event.nativeEvent.layout.width)}
              >
                <View style={[styles.chartBars, { height: chartHeight }]}>
                  {dailyTotals.map((day) => (
                    <View key={day.label} style={styles.chartCol}>
                      <View
                        style={[
                          styles.chartBar,
                          {
                            backgroundColor: theme.accent,
                            height: Math.max(6, (day.totalMs / maxDailyMs) * chartHeight),
                          },
                        ]}
                      />
                    </View>
                  ))}
                  {weeklyTrendPoints ? (
                    <Svg style={styles.chartOverlay} width={weeklyChartWidth} height={chartHeight}>
                      <Polyline
                        points={weeklyTrendPoints}
                        fill="none"
                        stroke={theme.accent}
                        strokeWidth={2}
                        strokeOpacity={0.35}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  ) : null}
                </View>
                <View style={styles.chartLabels}>
                  {dailyTotals.map((day) => (
                    <View key={`${day.label}-label`} style={styles.chartLabelCol}>
                      <Text style={[styles.chartLabel, { color: theme.muted }]}>{day.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <Text style={[styles.meta, { color: theme.muted }]}>
                Total fasting this week: {formatDuration(totalWeekMs)}
              </Text>
            </View>

            <View style={[styles.card, getCardStyle(theme)]}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="flame-outline" size={16} color={theme.muted} />
                <Text style={[styles.sectionTitle, { color: theme.muted }]}>Daily Calories</Text>
              </View>
              <View
                style={styles.chartWrap}
                onLayout={(event) => setCaloriesChartWidth(event.nativeEvent.layout.width)}
              >
                <View style={[styles.chartBars, { height: chartHeight }]}>
                  {dailyCaloriesTotals.map((day) => (
                    <View key={day.label} style={styles.chartCol}>
                      <View
                        style={[
                          styles.chartBar,
                          {
                            backgroundColor: theme.accent,
                            height: Math.max(
                              6,
                              (day.totalCalories / Math.max(maxDailyCalories, 1)) * chartHeight
                            ),
                          },
                        ]}
                      />
                    </View>
                  ))}
                  {calorieTrendPoints ? (
                    <Svg style={styles.chartOverlay} width={caloriesChartWidth} height={chartHeight}>
                      <Polyline
                        points={calorieTrendPoints}
                        fill="none"
                        stroke={theme.accent}
                        strokeWidth={2}
                        strokeOpacity={0.35}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  ) : null}
                </View>
                <View style={styles.chartLabels}>
                  {dailyCaloriesTotals.map((day) => (
                    <View key={`${day.label}-label`} style={styles.chartLabelCol}>
                      <Text style={[styles.chartLabel, { color: theme.muted }]}>{day.label}</Text>
                      <Text style={[styles.microLabel, { color: theme.muted }]}>
                        {day.totalCalories}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

          </>
        ) : (
          <>
            <View style={[styles.card, getCardStyle(theme)]}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="calendar-outline" size={16} color={theme.muted} />
                <Text style={[styles.sectionTitle, { color: theme.muted }]}>Sessions</Text>
              </View>
              {sessions.map((session) => {
                const endTs = session.end_time ?? now;
                return (
                  <Pressable
                    key={session.id}
                    style={styles.historyRow}
                    onPress={() => onOpenEdit(session)}
                  >
                    <View>
                      <Text style={[styles.noteText, { color: theme.text }]}> 
                        {formatDate(session.start_time)} - {formatDuration(endTs - session.start_time)}
                      </Text>
                      <Text style={[styles.meta, { color: theme.muted }]}> 
                        {formatTime(session.start_time)} to{' '}
                        {session.end_time ? formatTime(session.end_time) : 'Active'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              {sessions.length === 0 ? (
                <Text style={[styles.meta, { color: theme.muted }]}>No sessions yet.</Text>
              ) : null}
            </View>

            <View style={[styles.card, getCardStyle(theme)]}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="time-outline" size={16} color={theme.muted} />
                <Text style={[styles.sectionTitle, { color: theme.muted }]}>Eating windows</Text>
              </View>
              {eatingWindowsHistory.length === 0 ? (
                <Text style={[styles.meta, { color: theme.muted }]}>
                  No completed eating windows yet.
                </Text>
              ) : null}
              {eatingWindowsHistory.map((window, index) => (
                <View key={`${window.start}-${index}`} style={styles.historyRow}>
                  <Text style={[styles.noteText, { color: theme.text }]}>
                    {formatDate(window.start)} - {formatDate(window.end)}
                  </Text>
                  <Text style={[styles.meta, { color: theme.muted }]}>
                    Total calories: {window.totalCalories} - {window.noteCount} notes
                  </Text>
                  {window.notes.length > 0 ? (
                    <View style={styles.historyNotes}>
                      {window.notes.map((note) => (
                        <View key={note.id} style={styles.historyNoteRow}>
                          {note.thumbnail_path ? (
                            <Image source={{ uri: note.thumbnail_path }} style={styles.historyThumb} />
                          ) : null}
                          <Text style={[styles.historyNoteText, { color: theme.text }]}>
                            - {note.text}
                            {note.calories !== null && note.calories !== undefined
                              ? ` (${note.calories} kcal)`
                              : ''}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </ScreenShell>
  );
};

const EatingScreen = ({
  theme,
  todayCalories,
  dailyCalorieGoal,
  currentWindowLabel,
  currentWindowCalories,
  currentWindowNotes,
  noteText,
  noteCalories,
  setNoteText,
  setNoteCalories,
  onAddNote,
  onScanFoodPhoto,
  scanBusy,
  scanStatus,
  onDeleteNote,
  onOpenEditNote,
  isFasting,
  autopilotResult,
  autopilotBusy,
  onRequestAutopilot,
  onClearAutopilot,
}: ScreenProps) => {
  const [showWindowNotes, setShowWindowNotes] = useState(true);
  return (
  <ScreenShell theme={theme}>
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <HeaderBar
        theme={theme}
        title="Eating Window"
        subtitle="Mindful notes"
      />

      <View style={[styles.card, getCardStyle(theme)]}> 
        <View style={styles.sectionTitleRow}>
          <Ionicons name="restaurant-outline" size={16} color={theme.muted} />
          <Text style={[styles.sectionTitle, { color: theme.muted }]}>Current window</Text>
        </View>
        <Text style={[styles.meta, { color: theme.text }]}> 
          {currentWindowLabel} - {currentWindowCalories} kcal
        </Text>
        <Text style={[styles.meta, { color: theme.muted }]}> 
          Daily calories: {todayCalories}
          {dailyCalorieGoal > 0 ? ` / ${dailyCalorieGoal}` : ''}
        </Text>
          <View style={[styles.noteRow, isFasting ? styles.disabledRow : null]}>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="Quick note"
              placeholderTextColor={theme.muted}
              value={noteText}
              onChangeText={setNoteText}
              editable={!isFasting}
            />
            <TextInput
              style={[styles.calorieInput, { color: theme.text, borderColor: theme.border }]}
              placeholder="kcal"
              placeholderTextColor={theme.muted}
              value={noteCalories}
              onChangeText={setNoteCalories}
              keyboardType="numeric"
              editable={!isFasting}
            />
          </View>
          {isFasting ? (
            <Text style={[styles.meta, styles.metaStrong, { color: theme.muted }]}>
              Notes are available during eating windows.
            </Text>
          ) : null}
          <View style={styles.row}>
            <Pressable
              style={[
                styles.primaryButton,
                { backgroundColor: theme.accent, shadowColor: theme.shadow, opacity: isFasting ? 0.6 : 1 },
              ]}
              onPress={onAddNote}
              disabled={isFasting}
            >
              <Text style={styles.primaryButtonText}>Add note</Text>
            </Pressable>
            <Pressable
              style={[
                styles.secondaryButton,
                {
                  borderColor: theme.border,
                  opacity: scanBusy || isFasting ? 0.6 : 1,
                },
              ]}
              onPress={onScanFoodPhoto}
              disabled={scanBusy || isFasting}
            >
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
              {scanBusy ? 'Scanning...' : 'Scan photo'}
            </Text>
          </Pressable>
        </View>
        {scanBusy ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator size="small" color={theme.accent} />
            <Text style={[styles.meta, { color: theme.muted }]}>Scanning photo...</Text>
          </View>
        ) : scanStatus ? (
          <Text style={[styles.meta, { color: theme.muted }]}>{scanStatus}</Text>
        ) : null}
          <Text style={[styles.meta, { color: theme.muted }]}>
            Photo estimates are approximate. Review before saving.
          </Text>
        </View>

        <View style={[styles.card, getCardStyle(theme)]}> 
          <Pressable
            style={styles.sectionHeaderRow}
            onPress={() => setShowWindowNotes((prev) => !prev)}
          >
            <View style={styles.sectionHeaderLeft}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="document-text-outline" size={16} color={theme.muted} />
                <Text style={[styles.sectionTitle, styles.sectionTitleCompact, { color: theme.muted }]}>
                  Window notes
                </Text>
              </View>
              <Text style={[styles.sectionSubtitle, { color: theme.muted }]}>
                {currentWindowNotes.length} notes
              </Text>
            </View>
            <Ionicons
              name={showWindowNotes ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.muted}
            />
          </Pressable>
        {showWindowNotes ? (
          <>
            {currentWindowNotes.length === 0 ? (
              <Text style={[styles.meta, { color: theme.muted }]}>
                No notes in this window yet.
              </Text>
            ) : null}
            {currentWindowNotes.map((note) => (
              <View key={note.id} style={[styles.noteItem, { borderColor: theme.border }]}>
                <View style={styles.noteHeaderRow}>
                  <View style={styles.noteContent}>
                    {note.thumbnail_path ? (
                      <Image source={{ uri: note.thumbnail_path }} style={styles.noteThumb} />
                    ) : null}
                    <Text style={[styles.noteText, { color: theme.text }]}>{note.text}</Text>
                    <Text style={[styles.meta, { color: theme.muted }]}> 
                      {formatTime(note.timestamp)}
                      {note.calories !== null && note.calories !== undefined
                        ? ` - ${note.calories} kcal`
                        : ''}
                    </Text>
                  </View>
                  <View style={styles.noteActions}>
                    <Pressable
                      style={[styles.iconButton, { borderColor: theme.border }]}
                      onPress={() => onOpenEditNote(note)}
                    >
                      <Ionicons name="create-outline" size={16} color={theme.muted} />
                    </Pressable>
                    <Pressable
                      style={[styles.iconButton, { borderColor: theme.border }]}
                      onPress={() => onDeleteNote(note.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color={theme.muted} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </>
        ) : (
          <Text style={[styles.meta, { color: theme.muted }]}>Notes hidden.</Text>
        )}
      </View>
    </ScrollView>
  </ScreenShell>
  );
};

const PlanScreen = ({
  theme,
  now,
  plan,
  planWeeks,
  planCheckins,
  planHistory,
  planUpdates,
  planBuilderVisible,
  planGoalMode,
  setPlanGoalMode,
  planPace,
  setPlanPace,
  planStartProtocol,
  setPlanStartProtocol,
  planRampWeeks,
  setPlanRampWeeks,
  planMinEatingHours,
  setPlanMinEatingHours,
  planBusy,
  onOpenPlanBuilder,
  onClosePlanBuilder,
  onCreatePlan,
  checkinAdherence,
  setCheckinAdherence,
  checkinEnergy,
  setCheckinEnergy,
  checkinHunger,
  setCheckinHunger,
  checkinSuggestion,
  onSavePlanCheckin,
  onApplyPlanSuggestion,
  onTogglePlanStatus,
  onActivatePlan,
  onDeactivatePlan,
  onClearPlan,
}: ScreenProps) => {
  const isPlanActive = plan?.status === 'active';
  const currentWeekIndex = plan && isPlanActive
    ? Math.max(
        0,
        Math.min(
          Math.floor((now - plan.startDate) / (7 * 24 * 3600 * 1000)),
          plan.rampWeeks - 1
        )
      )
    : 0;
  const weekStart = plan && isPlanActive
    ? plan.startDate + currentWeekIndex * 7 * 24 * 3600 * 1000
    : null;
  const weekEnd = weekStart ? weekStart + 6 * 24 * 3600 * 1000 : null;
  const weekDayIndex = weekStart
    ? Math.min(6, Math.max(0, Math.floor((now - weekStart) / (24 * 3600 * 1000))))
    : 0;
  const orderedPlanWeeks = [...planWeeks].sort((a, b) => a.week_index - b.week_index);
  const recentSuggestion = (() => {
    if (checkinSuggestion) return checkinSuggestion;
    if (!planCheckins[0]?.suggestion_json) return null;
    try {
      return JSON.parse(planCheckins[0].suggestion_json || '{}') as PlanSuggestion;
    } catch (error) {
      return null;
    }
  })();

  return (
    <ScreenShell theme={theme}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <HeaderBar
          theme={theme}
          title="Adaptive Plan"
          subtitle="Ramp your fasting and calories"
        />

        {!plan ? (
          <View style={[styles.card, getCardStyle(theme)]}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="map-outline" size={16} color={theme.muted} />
              <Text style={[styles.sectionTitle, { color: theme.muted }]}>Start a plan</Text>
            </View>
            <Text style={[styles.meta, { color: theme.muted }]}>
              Build a gradual plan from an easy start to a stricter target.
            </Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.primaryButton, { backgroundColor: theme.accent, shadowColor: theme.shadow }]}
                onPress={onOpenPlanBuilder}
              >
                <Text style={styles.primaryButtonText}>Create plan</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={[styles.card, getCardStyle(theme)]}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="compass-outline" size={16} color={theme.muted} />
                <Text style={[styles.sectionTitle, { color: theme.muted }]}>Plan overview</Text>
              </View>
              <Text style={[styles.meta, { color: theme.text }]}>
                Goal: {CALORIE_GOALS.find((goal) => goal.key === plan.goalMode)?.label ?? plan.goalMode}
              </Text>
              <Text style={[styles.meta, { color: theme.muted }]}>
                Pace: {PLAN_PACES.find((pace) => pace.key === plan.targetPace)?.label ?? plan.targetPace}
              </Text>
              <Text style={[styles.meta, { color: theme.muted }]}>
                {plan.startProtocol} -> {plan.targetProtocol} - Min eating {plan.minEatingHours}h
              </Text>
              <Text style={[styles.meta, { color: theme.muted }]}>
                Current week: {currentWeekIndex + 1} of {plan.rampWeeks}
                {weekStart && weekEnd ? ` - ${formatDate(weekStart)} to ${formatDate(weekEnd)}` : ''}
              </Text>
              <View style={[styles.planStatusCard, { borderColor: theme.border, backgroundColor: theme.bgAlt }]}>
                <Text style={[styles.metaStrong, { color: theme.text }]}>
                  Week {currentWeekIndex + 1} · Day {weekDayIndex + 1} · {plan.status}
                </Text>
                {isPlanActive ? (
                  <View style={styles.planDayRow}>
                    {Array.from({ length: 7 }, (_, index) => (
                      <View
                        key={`plan-day-${index}`}
                        style={[
                          styles.planDayDot,
                          {
                            backgroundColor: index === weekDayIndex ? theme.accent : theme.border,
                          },
                        ]}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
              <View style={styles.planActionRow}>
                <Pressable
                  style={[styles.secondaryButton, { borderColor: theme.border }]}
                  onPress={onOpenPlanBuilder}
                >
                  <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Edit</Text>
                </Pressable>
                {plan.status === 'draft' ? (
                  <Pressable
                    style={[styles.primaryButton, { backgroundColor: theme.accent, shadowColor: theme.shadow }]}
                    onPress={onActivatePlan}
                  >
                    <Text style={styles.primaryButtonText}>Activate</Text>
                  </Pressable>
                ) : (
                  <>
                    <Pressable
                      style={[styles.secondaryButton, { borderColor: theme.border }]}
                      onPress={onTogglePlanStatus}
                    >
                      <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                        {plan.status === 'paused' ? 'Resume' : 'Pause'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.secondaryButton, { borderColor: theme.border }]}
                      onPress={onDeactivatePlan}
                    >
                      <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                        Deactivate
                      </Text>
                    </Pressable>
                  </>
                )}
                <Pressable
                  style={[styles.ghostButton, { borderColor: theme.border }]}
                  onPress={onClearPlan}
                >
                  <Text style={[styles.ghostButtonText, { color: theme.text }]}>
                    Clear
                  </Text>
                </Pressable>
              </View>
              {!isPlanActive ? (
                <Text style={[styles.meta, { color: theme.muted }]}>
                  Activate the plan to start the timeline and weekly check-ins.
                </Text>
              ) : null}
            </View>

            <View style={[styles.card, getCardStyle(theme)]}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="calendar-outline" size={16} color={theme.muted} />
                <Text style={[styles.sectionTitle, { color: theme.muted }]}>Plan timeline</Text>
              </View>
              {orderedPlanWeeks.map((week, index) => {
                const isCurrent = index === currentWeekIndex && isPlanActive;
                return (
                  <View
                    key={week.id}
                    style={[
                      styles.planWeekRow,
                      { borderColor: theme.border },
                      isCurrent ? { backgroundColor: theme.bgAlt } : null,
                    ]}
                  >
                    <View style={styles.planWeekHeader}>
                      <Text style={[styles.metaStrong, { color: theme.text }]}>
                        Week {index + 1}
                      </Text>
                      <Text style={[styles.meta, { color: theme.muted }]}>
                        {week.protocol_key}
                      </Text>
                    </View>
                    <Text style={[styles.meta, { color: theme.muted }]}>
                      Daily calories: {week.daily_calories && week.daily_calories > 0 ? week.daily_calories : 'Not set'}
                    </Text>
                    {week.notes ? (
                      <Text style={[styles.meta, { color: theme.muted }]}>{week.notes}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <View style={[styles.card, getCardStyle(theme)]}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="clipboard-outline" size={16} color={theme.muted} />
                <Text style={[styles.sectionTitle, { color: theme.muted }]}>Weekly check-in</Text>
              </View>
              {!isPlanActive ? (
                <Text style={[styles.meta, { color: theme.muted }]}>
                  Activate the plan to submit check-ins.
                </Text>
              ) : null}
              <Text style={[styles.meta, { color: theme.muted }]}>
                Log how the week felt to get a recommended adjustment.
              </Text>
              <Text style={[styles.meta, { color: theme.muted }]}>Adherence</Text>
              <View style={styles.emojiRow}>
                {[
                  { value: 1, label: '😢' },
                  { value: 2, label: '🙁' },
                  { value: 3, label: '😐' },
                  { value: 4, label: '🙂' },
                  { value: 5, label: '😄' },
                ].map((item) => (
                  <Pressable
                    key={`adherence-${item.value}`}
                    style={[
                      styles.emojiButton,
                      {
                        borderColor: theme.border,
                        backgroundColor: checkinAdherence === item.value ? theme.bgAlt : 'transparent',
                        opacity: isPlanActive ? 1 : 0.6,
                      },
                    ]}
                    onPress={() => setCheckinAdherence(item.value)}
                    disabled={!isPlanActive}
                  >
                    <Text style={styles.emojiLabel}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.meta, { color: theme.muted }]}>Energy</Text>
              <View style={styles.pillRow}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Pressable
                    key={`energy-${value}`}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: checkinEnergy === value ? theme.accent : theme.bg,
                        borderColor: theme.border,
                        opacity: isPlanActive ? 1 : 0.6,
                      },
                    ]}
                    onPress={() => setCheckinEnergy(value)}
                    disabled={!isPlanActive}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: checkinEnergy === value ? '#111' : theme.text },
                      ]}
                    >
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.meta, { color: theme.muted }]}>Hunger</Text>
              <View style={styles.pillRow}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Pressable
                    key={`hunger-${value}`}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: checkinHunger === value ? theme.accent : theme.bg,
                        borderColor: theme.border,
                        opacity: isPlanActive ? 1 : 0.6,
                      },
                    ]}
                    onPress={() => setCheckinHunger(value)}
                    disabled={!isPlanActive}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: checkinHunger === value ? '#111' : theme.text },
                      ]}
                    >
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.row}>
                <Pressable
                  style={[
                    styles.primaryButton,
                    { backgroundColor: theme.accent, shadowColor: theme.shadow, opacity: isPlanActive ? 1 : 0.6 },
                  ]}
                  onPress={onSavePlanCheckin}
                  disabled={!isPlanActive}
                >
                  <Text style={styles.primaryButtonText}>Save check-in</Text>
                </Pressable>
              </View>
              {recentSuggestion ? (
                <View style={styles.smartResult}>
                  <Text style={[styles.metaStrong, { color: theme.text }]}>
                    Recommendation: {recentSuggestion.action.replace('_', ' ')}
                  </Text>
                  <Text style={[styles.meta, { color: theme.muted }]}>{recentSuggestion.rationale}</Text>
                  {recentSuggestion.nextProtocol ? (
                    <Text style={[styles.meta, { color: theme.muted }]}>
                      Suggested protocol: {recentSuggestion.nextProtocol}
                    </Text>
                  ) : null}
                  <Text style={[styles.meta, { color: theme.muted }]}>
                    Protocol updates are suggestions only - you approve changes.
                  </Text>
                  {recentSuggestion.action !== 'hold' ? (
                    <Pressable
                      style={[styles.secondaryButton, { borderColor: theme.border }]}
                      onPress={onApplyPlanSuggestion}
                    >
                      <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                        Apply adjustment
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={[styles.card, getCardStyle(theme)]}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="time-outline" size={16} color={theme.muted} />
                <Text style={[styles.sectionTitle, { color: theme.muted }]}>Plan history</Text>
              </View>
              {planHistory.length === 0 ? (
                <Text style={[styles.meta, { color: theme.muted }]}>
                  No previous plans yet.
                </Text>
              ) : (
                planHistory.map((item) => (
                  <View key={`plan-${item.id}`} style={[styles.planWeekRow, { borderColor: theme.border }]}>
                    <View style={styles.planWeekHeader}>
                      <Text style={[styles.metaStrong, { color: theme.text }]}>
                        {CALORIE_GOALS.find((goal) => goal.key === item.goalMode)?.label ?? item.goalMode}
                      </Text>
                      <Text style={[styles.meta, { color: theme.muted }]}>
                        {formatDate(item.startDate)}
                      </Text>
                    </View>
                    <Text style={[styles.meta, { color: theme.muted }]}>
                      {item.startProtocol} -> {item.targetProtocol} - {item.rampWeeks} weeks
                    </Text>
                    <Text style={[styles.meta, { color: theme.muted }]}>
                      Pace: {PLAN_PACES.find((pace) => pace.key === item.targetPace)?.label ?? item.targetPace}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <View style={[styles.card, getCardStyle(theme)]}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="mail-outline" size={16} color={theme.muted} />
                <Text style={[styles.sectionTitle, { color: theme.muted }]}>Plan updates</Text>
              </View>
              {planUpdates.length === 0 ? (
                <Text style={[styles.meta, { color: theme.muted }]}>
                  No updates yet.
                </Text>
              ) : (
                planUpdates.map((update) => (
                  <View
                    key={`plan-update-${update.id}`}
                    style={[styles.planUpdateRow, { borderColor: theme.border }]}
                  >
                    <Text style={[styles.meta, { color: theme.text }]}>{update.message}</Text>
                    <Text style={[styles.microLabel, { color: theme.muted }]}>
                      {formatDate(update.created_at)} {formatTime(update.created_at)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={planBuilderVisible} animationType="slide" transparent>
        <Pressable style={styles.modalBackdrop} onPress={onClosePlanBuilder}>
          <KeyboardAvoidingView
            style={styles.modalAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <Pressable style={[styles.modalContent, getCardStyle(theme)]} onPress={() => {}}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Build your plan
              </Text>
              <Text style={[styles.meta, { color: theme.muted }]}>Goal</Text>
              <View style={styles.pillRow}>
                {CALORIE_GOALS.map((goal) => (
                  <Pressable
                    key={goal.key}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: planGoalMode === goal.key ? theme.accent : theme.bg,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => setPlanGoalMode(goal.key)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: planGoalMode === goal.key ? '#111' : theme.text },
                      ]}
                    >
                      {goal.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.meta, { color: theme.muted }]}>Pace</Text>
              <View style={styles.pillRow}>
                {PLAN_PACES.map((pace) => (
                  <Pressable
                    key={pace.key}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: planPace === pace.key ? theme.accent : theme.bg,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => setPlanPace(pace.key)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: planPace === pace.key ? '#111' : theme.text },
                      ]}
                    >
                      {pace.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.meta, { color: theme.muted }]}>Start protocol</Text>
              <View style={styles.pillRow}>
                {PROTOCOLS.filter((protocol) => protocol.key !== 'custom').map((protocol) => (
                  <Pressable
                    key={protocol.key}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: planStartProtocol === protocol.key ? theme.accent : theme.bg,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => setPlanStartProtocol(protocol.key)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: planStartProtocol === protocol.key ? '#111' : theme.text },
                      ]}
                    >
                      {protocol.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.meta, { color: theme.muted }]}>Ramp length (weeks)</Text>
              <View style={styles.pillRow}>
                {[3, 4, 6].map((weeks) => (
                  <Pressable
                    key={`weeks-${weeks}`}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: planRampWeeks === weeks ? theme.accent : theme.bg,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => setPlanRampWeeks(weeks)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: planRampWeeks === weeks ? '#111' : theme.text },
                      ]}
                    >
                      {weeks}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.meta, { color: theme.muted }]}>Minimum eating hours</Text>
              <TextInput
                style={[styles.calorieInput, { color: theme.text, borderColor: theme.border }]}
                value={String(planMinEatingHours)}
                onChangeText={(value) =>
                  setPlanMinEatingHours(Math.max(6, Math.min(12, Number(value) || 6)))
                }
                keyboardType="numeric"
                placeholder="Minimum eating hours"
                placeholderTextColor={theme.muted}
              />
              <View style={styles.row}>
                <Pressable
                  style={[
                    styles.primaryButton,
                    { backgroundColor: theme.accent, shadowColor: theme.shadow, opacity: planBusy ? 0.7 : 1 },
                  ]}
                  onPress={onCreatePlan}
                  disabled={planBusy}
                >
                  <Text style={styles.primaryButtonText}>
                    {planBusy ? 'Saving...' : 'Save plan'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryButton, { borderColor: theme.border }]}
                  onPress={onClosePlanBuilder}
                >
                  <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </ScreenShell>
  );
};

const SmartToolsScreen = ({
  theme,
  todayCalories,
  dailyCalorieGoal,
  ifEatText,
  setIfEatText,
  ifEatResult,
  ifEatBusy,
  onEstimateFood,
  onClearFoodEstimate,
  onScanFoodPhotoSmart,
  scanBusy,
  fridgeLimit,
  setFridgeLimit,
  fridgeIdeas,
  fridgeBusy,
  onScanFridge,
  onClearFridgeIdeas,
  pantryItems,
  onSaveFridgeIdea,
  pantryPickerVisible,
  onOpenPantryPicker,
  onClosePantryPicker,
  goalTuningResult,
  goalTuningBusy,
  onRequestGoalTuning,
  onApplyGoalTuning,
  autopilotResult,
  autopilotBusy,
  onRequestAutopilot,
  onClearAutopilot,
  onUpdateAutopilotItem,
  onRemoveAutopilotItem,
  onOpenAutopilotTimePicker,
  onAddAutopilotItemFromPantry,
}: ScreenProps) => {
  return (
    <ScreenShell theme={theme}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <HeaderBar
          theme={theme}
          title="Smart tools"
          subtitle="AI-powered helpers"
        />

        <View style={[styles.card, getCardStyle(theme)]}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="restaurant-outline" size={16} color={theme.muted} />
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>If I eat this</Text>
          </View>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            placeholder="Example: Turkey wrap and a latte"
            placeholderTextColor={theme.muted}
            value={ifEatText}
            onChangeText={setIfEatText}
          />
          <View style={styles.row}>
            <Pressable
              style={[
                styles.primaryButton,
                { backgroundColor: theme.accent, shadowColor: theme.shadow, opacity: ifEatBusy ? 0.7 : 1 },
              ]}
              onPress={onEstimateFood}
              disabled={ifEatBusy}
            >
              <Text style={styles.primaryButtonText}>
                {ifEatBusy ? 'Estimating...' : 'Estimate'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, { borderColor: theme.border, opacity: scanBusy ? 0.7 : 1 }]}
              onPress={onScanFoodPhotoSmart}
              disabled={scanBusy}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                {scanBusy ? 'Scanning...' : 'Scan photo'}
              </Text>
            </Pressable>
            {ifEatResult ? (
              <Pressable
                style={[styles.secondaryButton, { borderColor: theme.border }]}
                onPress={onClearFoodEstimate}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          {ifEatResult ? (
            <View style={styles.smartResult}>
              <Text style={[styles.metaStrong, { color: theme.text }]}>
                Estimated total: {ifEatResult.totalCalories} kcal
              </Text>
              {ifEatResult.items.map((item, index) => (
                <Text key={`${item.name}-${index}`} style={[styles.meta, { color: theme.muted }]}>
                  - {item.name}
                  {item.calories !== null && item.calories !== undefined
                    ? ` (${item.calories} kcal)`
                    : ''}
                </Text>
              ))}
              {ifEatResult.disclaimer ? (
                <Text style={[styles.meta, { color: theme.muted }]}>{ifEatResult.disclaimer}</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={[styles.card, getCardStyle(theme)]}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="leaf-outline" size={16} color={theme.muted} />
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>Fridge ideas</Text>
          </View>
          <Text style={[styles.meta, { color: theme.muted }]}>
            Snap your fridge and get meal ideas under a calorie limit.
          </Text>
          <TextInput
            style={[styles.calorieInput, { color: theme.text, borderColor: theme.border }]}
            placeholder="Limit kcal (optional, default 400)"
            placeholderTextColor={theme.muted}
            value={fridgeLimit}
            onChangeText={setFridgeLimit}
            keyboardType="numeric"
          />
          <View style={styles.row}>
            <Pressable
              style={[
                styles.primaryButton,
                { backgroundColor: theme.accent, shadowColor: theme.shadow, opacity: fridgeBusy ? 0.7 : 1 },
              ]}
              onPress={onScanFridge}
              disabled={fridgeBusy}
            >
              <Text style={styles.primaryButtonText}>
                {fridgeBusy ? 'Scanning...' : 'Scan fridge'}
              </Text>
            </Pressable>
            {fridgeIdeas ? (
              <Pressable
                style={[styles.secondaryButton, { borderColor: theme.border }]}
                onPress={onClearFridgeIdeas}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          {fridgeIdeas ? (
            <View style={styles.smartResult}>
              {fridgeIdeas.items?.length ? (
                <Text style={[styles.meta, { color: theme.muted }]}>
                  Detected: {fridgeIdeas.items.join(', ')}
                </Text>
              ) : null}
              {fridgeIdeas.meals.map((meal, index) => {
                const saved = pantryItems.some(
                  (item) => item.title.trim().toLowerCase() === meal.title.trim().toLowerCase()
                );
                return (
                  <View key={`${meal.title}-${index}`} style={styles.smartMeal}>
                    <Text style={[styles.metaStrong, { color: theme.text }]}>
                      {meal.title} - {meal.calories} kcal
                    </Text>
                    <Text style={[styles.meta, { color: theme.muted }]}>
                      {meal.ingredients.join(', ')}
                    </Text>
                    {meal.notes ? (
                      <Text style={[styles.meta, { color: theme.muted }]}>{meal.notes}</Text>
                    ) : null}
                    <View style={styles.inlineRow}>
                      <Pressable
                        style={[
                          styles.tinyButton,
                          { borderColor: theme.border, opacity: saved ? 0.6 : 1 },
                        ]}
                        onPress={() => onSaveFridgeIdea(meal)}
                        disabled={saved}
                      >
                        <Text style={[styles.tinyButtonText, { color: theme.text }]}>
                          {saved ? 'Saved' : 'Save to pantry'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
              {fridgeIdeas.disclaimer ? (
                <Text style={[styles.meta, { color: theme.muted }]}>{fridgeIdeas.disclaimer}</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={[styles.card, getCardStyle(theme)]}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="sparkles-outline" size={16} color={theme.muted} />
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>Plan your eating window</Text>
          </View>
          <Text style={[styles.meta, { color: theme.muted }]}>
            Plan your eating window with a timed mini-menu.
          </Text>
          {autopilotResult?.windowStart && autopilotResult.windowEnd ? (
            <Text style={[styles.meta, { color: theme.muted }]}>
              {autopilotResult.windowLabel ?? 'Eating window'}:{' '}
              {formatTime(autopilotResult.windowStart)} - {formatTime(autopilotResult.windowEnd)}
            </Text>
          ) : null}
          <View style={styles.row}>
            <Pressable
              style={[
                styles.primaryButton,
                { backgroundColor: theme.accent, shadowColor: theme.shadow, opacity: autopilotBusy ? 0.7 : 1 },
              ]}
              onPress={onRequestAutopilot}
              disabled={autopilotBusy}
            >
              <Text style={styles.primaryButtonText}>
                {autopilotBusy ? 'Planning...' : 'Build menu'}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.secondaryButton,
                { borderColor: theme.border, opacity: pantryItems.length > 0 ? 1 : 0.5 },
              ]}
              onPress={onOpenPantryPicker}
              disabled={pantryItems.length === 0}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                Add from pantry
              </Text>
            </Pressable>
            {autopilotResult ? (
              <Pressable
                style={[styles.secondaryButton, { borderColor: theme.border }]}
                onPress={onClearAutopilot}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          {autopilotResult ? (
            <View style={styles.smartResult}>
              <Text style={[styles.metaStrong, { color: theme.text }]}>
                Total target: {autopilotResult.totalCalories} kcal
              </Text>
              {autopilotResult.items.length === 0 ? (
                <Text style={[styles.meta, { color: theme.muted }]}>No items yet.</Text>
              ) : null}
              {autopilotResult.items.map((item) => (
                <View key={item.id} style={styles.autopilotItem}>
                  <View style={styles.autopilotRow}>
                    <Pressable
                      style={[styles.timePill, { borderColor: theme.border }]}
                      onPress={() => onOpenAutopilotTimePicker(item.id)}
                    >
                      <Text style={[styles.timePillText, { color: theme.text }]}>
                        {item.time || 'Set time'}
                      </Text>
                    </Pressable>
                    <TextInput
                      style={[
                        styles.autopilotInput,
                        { color: theme.text, borderColor: theme.border },
                      ]}
                      value={item.title}
                      onChangeText={(value) => onUpdateAutopilotItem(item.id, { title: value })}
                      placeholder="Meal"
                      placeholderTextColor={theme.muted}
                    />
                    <TextInput
                      style={[
                        styles.autopilotCalorieInput,
                        { color: theme.text, borderColor: theme.border },
                      ]}
                      value={String(item.calories ?? '')}
                      onChangeText={(value) =>
                        onUpdateAutopilotItem(item.id, {
                          calories: Number.isFinite(Number(value)) ? Number(value) : 0,
                        })
                      }
                      keyboardType="numeric"
                      placeholder="kcal"
                      placeholderTextColor={theme.muted}
                    />
                    <Pressable
                      style={[styles.iconButton, { borderColor: theme.border }]}
                      onPress={() => onRemoveAutopilotItem(item.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color={theme.muted} />
                    </Pressable>
                  </View>
                  <TextInput
                    style={[
                      styles.autopilotIngredients,
                      { color: theme.text, borderColor: theme.border },
                    ]}
                    value={(item.ingredients ?? []).join(', ')}
                    onChangeText={(value) =>
                      onUpdateAutopilotItem(item.id, {
                        ingredients: parseIngredientsInput(value),
                      })
                    }
                    placeholder="Ingredients (comma separated)"
                    placeholderTextColor={theme.muted}
                    multiline
                  />
                  {item.notes ? (
                    <Text style={[styles.meta, { color: theme.muted }]}>{item.notes}</Text>
                  ) : null}
                </View>
              ))}
              {autopilotResult.disclaimer ? (
                <Text style={[styles.meta, { color: theme.muted }]}>{autopilotResult.disclaimer}</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={[styles.card, getCardStyle(theme)]}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="options-outline" size={16} color={theme.muted} />
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>Goal tuning</Text>
          </View>
          <Text style={[styles.meta, { color: theme.muted }]}>
            Get a recommended fasting window based on your recent logs.
          </Text>
          <View style={[styles.goalBox, { borderColor: theme.border }]}>
            <Text style={[styles.metaStrong, { color: theme.text }]}>Recommendation</Text>
            <View style={styles.goalActionRow}>
              <Pressable
                style={[
                  styles.primaryButton,
                  { backgroundColor: theme.accent, shadowColor: theme.shadow, opacity: goalTuningBusy ? 0.7 : 1 },
                ]}
                onPress={onRequestGoalTuning}
                disabled={goalTuningBusy}
              >
                <Text style={styles.primaryButtonText}>
                  {goalTuningBusy ? 'Analyzing...' : 'Get'}
                </Text>
              </Pressable>
              {goalTuningResult ? (
                <Pressable
                  style={[styles.secondaryButton, { borderColor: theme.border }]}
                  onPress={onApplyGoalTuning}
                >
                  <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Apply</Text>
                </Pressable>
              ) : null}
            </View>
            {goalTuningResult ? (
              <View style={styles.smartResult}>
                <Text style={[styles.metaStrong, { color: theme.text }]}>
                  Recommended: {goalTuningResult.recommendedProtocol}
                </Text>
                <Text style={[styles.meta, { color: theme.muted }]}>{goalTuningResult.rationale}</Text>
                {goalTuningResult.note ? (
                  <Text style={[styles.meta, { color: theme.muted }]}>{goalTuningResult.note}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <Modal visible={pantryPickerVisible} animationType="slide" transparent>
        <Pressable style={styles.modalBackdrop} onPress={onClosePantryPicker}>
          <Pressable style={[styles.modalContent, getCardStyle(theme)]} onPress={() => {}}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Pantry ideas</Text>
            <ScrollView style={styles.pantryList} keyboardShouldPersistTaps="handled">
              {pantryItems.length === 0 ? (
                <Text style={[styles.meta, { color: theme.muted }]}>
                  Save fridge ideas to build a pantry list.
                </Text>
              ) : (
                pantryItems.map((item) => (
                  <View key={item.id} style={styles.pantryRow}>
                    <View style={styles.pantryText}>
                      <Text style={[styles.metaStrong, { color: theme.text }]}>
                        {item.title}
                      </Text>
                      <Text style={[styles.meta, { color: theme.muted }]}>
                        {item.calories} kcal
                      </Text>
                      {item.ingredients.length > 0 ? (
                        <Text style={[styles.meta, { color: theme.muted }]}>
                          {item.ingredients.join(', ')}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      style={[
                        styles.secondaryButton,
                        { borderColor: theme.border },
                      ]}
                      onPress={() => {
                        onAddAutopilotItemFromPantry(item);
                        onClosePantryPicker();
                      }}
                    >
                      <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                        Add
                      </Text>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
            <Pressable
              style={[styles.secondaryButton, { borderColor: theme.border }]}
              onPress={onClosePantryPicker}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenShell>
  );
};

const HistoryScreen = ({
  theme,
  sessions,
  now,
  onOpenEdit,
  eatingWindowsHistory,
}: ScreenProps) => (
  <ScreenShell theme={theme}>
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <HeaderBar
        theme={theme}
        title="History"
        subtitle="All sessions"
      />

      <View style={[styles.card, getCardStyle(theme)]}> 
        <Text style={[styles.sectionTitle, { color: theme.muted }]}>Sessions</Text>
        {sessions.map((session) => {
          const endTs = session.end_time ?? now;
          return (
            <Pressable
              key={session.id}
              style={styles.historyRow}
              onPress={() => onOpenEdit(session)}
            >
              <View>
                <Text style={[styles.noteText, { color: theme.text }]}> 
                  {formatDate(session.start_time)} - {formatDuration(endTs - session.start_time)}
                </Text>
                <Text style={[styles.meta, { color: theme.muted }]}> 
                  {formatTime(session.start_time)} to{' '}
                  {session.end_time ? formatTime(session.end_time) : 'Active'}
                </Text>
              </View>
            </Pressable>
          );
        })}
        {sessions.length === 0 ? (
          <Text style={[styles.meta, { color: theme.muted }]}>No sessions yet.</Text>
        ) : null}
      </View>

      <View style={[styles.card, getCardStyle(theme)]}> 
        <Text style={[styles.sectionTitle, { color: theme.muted }]}>Eating windows</Text>
        {eatingWindowsHistory.length === 0 ? (
          <Text style={[styles.meta, { color: theme.muted }]}>
            No completed eating windows yet.
          </Text>
        ) : null}
        {eatingWindowsHistory.map((window, index) => (
          <View key={`${window.start}-${index}`} style={styles.historyRow}>
            <Text style={[styles.noteText, { color: theme.text }]}>
              {formatDate(window.start)} - {formatDate(window.end)}
            </Text>
            <Text style={[styles.meta, { color: theme.muted }]}>
              Total calories: {window.totalCalories} - {window.noteCount} notes
            </Text>
            {window.notes.length > 0 ? (
              <View style={styles.historyNotes}>
                {window.notes.map((note) => (
                  <View key={note.id} style={styles.historyNoteRow}>
                    {note.thumbnail_path ? (
                      <Image source={{ uri: note.thumbnail_path }} style={styles.historyThumb} />
                    ) : null}
                    <Text style={[styles.historyNoteText, { color: theme.text }]}>
                      - {note.text}
                      {note.calories !== null && note.calories !== undefined
                        ? ` (${note.calories} kcal)`
                        : ''}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
  </ScreenShell>
);

const SettingsScreen = ({
  theme,
  settings,
  onUpdateSetting,
  notificationStatus,
  onRequestNotificationPermissions,
  onSendTestReminder,
  onOpenCalorieHelper,
  onClearHistory,
}: ScreenProps) => {
  const [showProtocol, setShowProtocol] = useState(true);
  const [showReminders, setShowReminders] = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);
  const [showUnits, setShowUnits] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  return (
    <ScreenShell theme={theme}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <HeaderBar
          theme={theme}
          title="Settings"
          subtitle="Personalize Fasting Lane"
        />

      <View style={[styles.card, getCardStyle(theme)]}> 
        <Pressable
          style={styles.sectionHeaderRow}
          onPress={() => setShowProtocol((prev) => !prev)}
        >
          <View style={styles.sectionHeaderLeft}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="time-outline" size={16} color={theme.muted} />
              <Text style={[styles.sectionTitle, styles.sectionTitleCompact, { color: theme.muted }]}>
                Protocol
              </Text>
            </View>
          </View>
          <Ionicons
            name={showProtocol ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.muted}
          />
        </Pressable>
        {showProtocol ? (
          <>
            <View style={styles.pillRow}>
              {PROTOCOLS.map((item) => (
                <Pressable
                  key={item.key}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: settings.protocolKey === item.key ? theme.accent : theme.bg,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => onUpdateSetting('protocolKey', item.key)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: settings.protocolKey === item.key ? '#111' : theme.text },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {settings.protocolKey === 'custom' ? (
              <View style={styles.noteRow}>
                <TextInput
                  style={[styles.calorieInput, { color: theme.text, borderColor: theme.border }]}
                  value={String(settings.customFastingHours)}
                  onChangeText={(value) =>
                    onUpdateSetting('customFastingHours', Math.max(1, Number(value) || 1))
                  }
                  keyboardType="numeric"
                />
                <Text style={[styles.meta, { color: theme.muted }]}>hours fasting</Text>
                <TextInput
                  style={[styles.calorieInput, { color: theme.text, borderColor: theme.border }]}
                  value={String(settings.customEatingHours)}
                  onChangeText={(value) =>
                    onUpdateSetting('customEatingHours', Math.max(1, Number(value) || 1))
                  }
                  keyboardType="numeric"
                />
                <Text style={[styles.meta, { color: theme.muted }]}>hours eating</Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={[styles.meta, { color: theme.muted }]}>Tap to expand.</Text>
        )}
      </View>

      <View style={[styles.card, getCardStyle(theme)]}> 
        <Pressable
          style={styles.sectionHeaderRow}
          onPress={() => setShowReminders((prev) => !prev)}
        >
          <View style={styles.sectionHeaderLeft}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="notifications-outline" size={16} color={theme.muted} />
              <Text style={[styles.sectionTitle, styles.sectionTitleCompact, { color: theme.muted }]}>
                Reminders
              </Text>
            </View>
          </View>
          <Ionicons
            name={showReminders ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.muted}
          />
        </Pressable>
        {showReminders ? (
          <>
            <View style={styles.switchRow}>
              <Text style={[styles.meta, { color: theme.text }]}>Smart reminders</Text>
              <Switch
                value={settings.remindersEnabled}
                onValueChange={(value) => onUpdateSetting('remindersEnabled', value)}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.meta, { color: theme.text }]}>Allow night reminders</Text>
              <Switch
                value={settings.allowNightReminders}
                onValueChange={(value) => onUpdateSetting('allowNightReminders', value)}
                disabled={!settings.remindersEnabled}
              />
            </View>
            <Text style={[styles.microLabel, { color: theme.muted }]}>
              Quiet hours are 22:00-07:00. Night reminders are off by default.
            </Text>

            <View style={styles.switchRow}>
              <Text style={[styles.meta, { color: theme.text }]}>Hydration reminders</Text>
              <Switch
                value={settings.hydrationEnabled}
                onValueChange={(value) => onUpdateSetting('hydrationEnabled', value)}
              />
            </View>

            <View style={styles.timingBlock}>
              <Text style={[styles.meta, { color: theme.muted }]}>Hydration timing</Text>
              <View style={styles.pillRowSingle}>
                {(['fasting', 'eating', 'both'] as HydrationMode[]).map((mode) => (
                  <Pressable
                    key={mode}
                    style={[
                      styles.pill,
                      styles.pillCompact,
                      {
                        backgroundColor:
                          settings.hydrationMode === mode ? theme.accent : theme.bg,
                        borderColor: theme.border,
                        opacity: settings.hydrationEnabled ? 1 : 0.5,
                      },
                    ]}
                    onPress={() => onUpdateSetting('hydrationMode', mode)}
                    disabled={!settings.hydrationEnabled}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: settings.hydrationMode === mode ? '#111' : theme.text },
                      ]}
                    >
                      {mode === 'fasting' ? 'Fasting' : mode === 'eating' ? 'Eating' : 'Both'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.noteRow}>
              <Text style={[styles.meta, { color: theme.muted }]}>Hydration interval</Text>
              {[1, 2, 3, 4].map((hours) => (
                <Pressable
                  key={hours}
                  style={[
                    styles.pill,
                    {
                      backgroundColor:
                        settings.hydrationIntervalHours === hours ? theme.accent : theme.bg,
                      borderColor: theme.border,
                      opacity: settings.hydrationEnabled ? 1 : 0.5,
                    },
                  ]}
                  onPress={() => onUpdateSetting('hydrationIntervalHours', hours)}
                  disabled={!settings.hydrationEnabled}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: settings.hydrationIntervalHours === hours ? '#111' : theme.text },
                    ]}
                >
                  {hours}h
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.meta, { color: theme.muted }]}>
            Notifications: {notificationStatus}
          </Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.secondaryButton, { borderColor: theme.border }]}
              onPress={onRequestNotificationPermissions}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                Request permission
              </Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, { borderColor: theme.border }]}
              onPress={onSendTestReminder}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                Test reminder
              </Text>
            </Pressable>
          </View>
          </>
        ) : (
          <Text style={[styles.meta, { color: theme.muted }]}>Tap to expand.</Text>
        )}
      </View>

      <View style={[styles.card, getCardStyle(theme)]}> 
        <Pressable
          style={styles.sectionHeaderRow}
          onPress={() => setShowNutrition((prev) => !prev)}
        >
          <View style={styles.sectionHeaderLeft}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="nutrition-outline" size={16} color={theme.muted} />
              <Text style={[styles.sectionTitle, styles.sectionTitleCompact, { color: theme.muted }]}>
                Nutrition
              </Text>
            </View>
          </View>
          <Ionicons
            name={showNutrition ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.muted}
          />
        </Pressable>
        {showNutrition ? (
          <>
            <View style={styles.noteRow}>
              <Text style={[styles.meta, { color: theme.muted }]}>Daily calorie goal</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                value={settings.dailyCalorieGoal ? String(settings.dailyCalorieGoal) : ''}
                onChangeText={(value) => onUpdateSetting('dailyCalorieGoal', Number(value) || 0)}
                keyboardType="numeric"
                placeholder="Optional"
                placeholderTextColor={theme.muted}
              />
            </View>
            <View style={styles.row}>
              <Pressable
                style={[styles.secondaryButton, { borderColor: theme.border }]}
                onPress={onOpenCalorieHelper}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                  Calorie helper
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={[styles.meta, { color: theme.muted }]}>Tap to expand.</Text>
        )}
      </View>

      <View style={[styles.card, getCardStyle(theme)]}> 
        <Pressable
          style={styles.sectionHeaderRow}
          onPress={() => setShowUnits((prev) => !prev)}
        >
          <View style={styles.sectionHeaderLeft}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="swap-horizontal-outline" size={16} color={theme.muted} />
              <Text style={[styles.sectionTitle, styles.sectionTitleCompact, { color: theme.muted }]}>
                Units
              </Text>
            </View>
          </View>
          <Ionicons
            name={showUnits ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.muted}
          />
        </Pressable>
        {showUnits ? (
          <View style={styles.noteRow}>
            <Text style={[styles.meta, { color: theme.muted }]}>Food portions</Text>
            {(['metric', 'imperial'] as UnitSystem[]).map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.pill,
                  {
                    backgroundColor: settings.unitSystem === option ? theme.accent : theme.bg,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => onUpdateSetting('unitSystem', option)}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: settings.unitSystem === option ? '#111' : theme.text },
                  ]}
                >
                  {option === 'metric' ? 'Metric' : 'Imperial'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={[styles.meta, { color: theme.muted }]}>Tap to expand.</Text>
        )}
      </View>

      <View style={[styles.card, getCardStyle(theme)]}> 
        <Pressable
          style={styles.sectionHeaderRow}
          onPress={() => setShowHistory((prev) => !prev)}
        >
          <View style={styles.sectionHeaderLeft}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="archive-outline" size={16} color={theme.muted} />
              <Text style={[styles.sectionTitle, styles.sectionTitleCompact, { color: theme.muted }]}>
                History
              </Text>
            </View>
          </View>
          <Ionicons
            name={showHistory ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.muted}
          />
        </Pressable>
        {showHistory ? (
          <>
            <Text style={[styles.meta, { color: theme.muted }]}>Auto-delete old history</Text>
            <View style={styles.pillRow}>
              {[
                { label: 'Keep all', value: 0 },
                { label: '30 days', value: 30 },
                { label: '90 days', value: 90 },
                { label: '180 days', value: 180 },
                { label: '365 days', value: 365 },
              ].map((option) => (
                <Pressable
                  key={option.label}
                  style={[
                    styles.pill,
                    {
                      backgroundColor:
                        settings.historyRetentionDays === option.value
                          ? theme.accent
                          : theme.bg,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => onUpdateSetting('historyRetentionDays', option.value)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: settings.historyRetentionDays === option.value ? '#111' : theme.text },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.row}>
              <Pressable
                style={[styles.secondaryButton, { borderColor: theme.border }]}
                onPress={onClearHistory}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                  Clear all history
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={[styles.meta, { color: theme.muted }]}>Tap to expand.</Text>
        )}
      </View>

      <View style={[styles.card, getCardStyle(theme)]}> 
        <Pressable
          style={styles.sectionHeaderRow}
          onPress={() => setShowAppearance((prev) => !prev)}
        >
          <View style={styles.sectionHeaderLeft}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="color-palette-outline" size={16} color={theme.muted} />
              <Text style={[styles.sectionTitle, styles.sectionTitleCompact, { color: theme.muted }]}>
                Appearance
              </Text>
            </View>
          </View>
          <Ionicons
            name={showAppearance ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.muted}
          />
        </Pressable>
        {showAppearance ? (
          <View style={styles.noteRow}>
            <Text style={[styles.meta, { color: theme.muted }]}>Theme</Text>
            {(['system', 'light', 'dark'] as ThemePreference[]).map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.pill,
                  {
                    backgroundColor: settings.themePreference === option ? theme.accent : theme.bg,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => onUpdateSetting('themePreference', option)}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: settings.themePreference === option ? '#111' : theme.text },
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={[styles.meta, { color: theme.muted }]}>Tap to expand.</Text>
        )}
      </View>

      <View style={[styles.card, getCardStyle(theme)]}> 
        <Pressable
          style={styles.sectionHeaderRow}
          onPress={() => setShowDisclaimer((prev) => !prev)}
        >
          <View style={styles.sectionHeaderLeft}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="information-circle-outline" size={16} color={theme.muted} />
              <Text style={[styles.sectionTitle, styles.sectionTitleCompact, { color: theme.muted }]}>
                Disclaimer
              </Text>
            </View>
          </View>
          <Ionicons
            name={showDisclaimer ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.muted}
          />
        </Pressable>
        {showDisclaimer ? (
          <Text style={[styles.meta, { color: theme.muted }]}> 
            This app is for informational and tracking purposes only and is not medical advice. Always
            consult a healthcare professional before making changes to your diet or fasting routine.
          </Text>
        ) : (
          <Text style={[styles.meta, { color: theme.muted }]}>Tap to expand.</Text>
        )}
      </View>
    </ScrollView>
  </ScreenShell>
  );
};

export default function App() {
  const systemScheme = useColorScheme();
  const [resolvedScheme, setResolvedScheme] = useState<'light' | 'dark'>(
    systemScheme === 'dark' ? 'dark' : 'light'
  );
  const dbRef = useRef<SQLite.SQLiteDatabase | null>(null);
  const [ready, setReady] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState('unknown');
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  const lastCalorieReminderDateRef = useRef<string | null>(null);
  const [sessions, setSessions] = useState<FastingSession[]>([]);
  const [notes, setNotes] = useState<EatingNote[]>([]);
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [activeSession, setActiveSession] = useState<FastingSession | null>(null);
  const [now, setNow] = useState(Date.now());
  const [noteText, setNoteText] = useState('');
  const [noteCalories, setNoteCalories] = useState('');
  const [ifEatText, setIfEatText] = useState('');
  const [ifEatResult, setIfEatResult] = useState<FoodEstimateResult | null>(null);
  const [ifEatBusy, setIfEatBusy] = useState(false);
  const [portionText, setPortionText] = useState('');
  const [portionTarget, setPortionTarget] = useState('');
  const [portionResult, setPortionResult] = useState<PortionCoachResult | null>(null);
  const [portionBusy, setPortionBusy] = useState(false);
  const [fridgeLimit, setFridgeLimit] = useState('');
  const [fridgeIdeas, setFridgeIdeas] = useState<FridgeIdeasResult | null>(null);
  const [fridgeBusy, setFridgeBusy] = useState(false);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [pantryPickerVisible, setPantryPickerVisible] = useState(false);
  const [autopilotResult, setAutopilotResult] = useState<AutopilotResult | null>(null);
  const [autopilotBusy, setAutopilotBusy] = useState(false);
  const [autopilotTimePicker, setAutopilotTimePicker] = useState<{
    itemId: string;
    value: Date;
  } | null>(null);
  const [rescueResult, setRescueResult] = useState<CravingRescueResult | null>(null);
  const [rescueBusy, setRescueBusy] = useState(false);
  const [rescueVisible, setRescueVisible] = useState(false);
  const [calorieHelperVisible, setCalorieHelperVisible] = useState(false);
  const [helperSex, setHelperSex] = useState<'female' | 'male'>('female');
  const [helperAge, setHelperAge] = useState('');
  const [helperHeight, setHelperHeight] = useState('');
  const [helperWeight, setHelperWeight] = useState('');
  const [helperActivity, setHelperActivity] = useState<ActivityLevel>('moderate');
  const [helperGoal, setHelperGoal] = useState<CalorieGoalMode>('maintain');
  const [goalTuningResult, setGoalTuningResult] = useState<GoalTuningResult | null>(null);
  const [goalTuningBusy, setGoalTuningBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [scanItems, setScanItems] = useState<ScanItem[] | null>(null);
  const [scanThumbPath, setScanThumbPath] = useState<string | null>(null);
  const [scanTotalCalories, setScanTotalCalories] = useState<number | null>(null);
  const [scanVisible, setScanVisible] = useState(false);
  const [scanMode, setScanMode] = useState<'note' | 'smart'>('note');
  const [scanRecalcBusy, setScanRecalcBusy] = useState(false);
  const [editNote, setEditNote] = useState<EatingNote | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [editNoteCalories, setEditNoteCalories] = useState('');
  const [editNoteVisible, setEditNoteVisible] = useState(false);
  const [editSession, setEditSession] = useState<FastingSession | null>(null);
  const [editStart, setEditStart] = useState<Date | null>(null);
  const [editEnd, setEditEnd] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [plan, setPlan] = useState<AdaptivePlan | null>(null);
  const [planWeeks, setPlanWeeks] = useState<AdaptivePlanWeek[]>([]);
  const [planCheckins, setPlanCheckins] = useState<PlanCheckIn[]>([]);
  const [planHistory, setPlanHistory] = useState<AdaptivePlan[]>([]);
  const [planUpdates, setPlanUpdates] = useState<PlanUpdate[]>([]);
  const [planBuilderVisible, setPlanBuilderVisible] = useState(false);
  const [planGoalMode, setPlanGoalMode] = useState<CalorieGoalMode>('lose');
  const [planPace, setPlanPace] = useState<PlanPace>('gentle');
  const [planStartProtocol, setPlanStartProtocol] = useState('16:8');
  const [planRampWeeks, setPlanRampWeeks] = useState(4);
  const [planMinEatingHours, setPlanMinEatingHours] = useState(8);
  const [planBusy, setPlanBusy] = useState(false);
  const [checkinAdherence, setCheckinAdherence] = useState(3);
  const [checkinEnergy, setCheckinEnergy] = useState(3);
  const [checkinHunger, setCheckinHunger] = useState(3);
  const [checkinSuggestion, setCheckinSuggestion] = useState<PlanSuggestion | null>(null);

  useEffect(() => {
    if (systemScheme) {
      setResolvedScheme(systemScheme === 'dark' ? 'dark' : 'light');
    }
  }, [systemScheme]);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setResolvedScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => subscription.remove();
  }, []);

  const theme: Theme = useMemo(() => {
    const lightTheme: Theme = {
      mode: 'light',
      bg: '#F3F5F8',
      bgAlt: '#E9EDF2',
      card: '#FFFFFF',
      text: '#1C2330',
      muted: '#6B788C',
      accent: '#2CB7B3',
      border: '#DCE3EB',
      shadow: '#7B8896',
      panic: '#E2534A',
    };
    const darkTheme: Theme = {
      mode: 'dark',
      bg: '#0F1723',
      bgAlt: '#151F2E',
      card: '#1B2739',
      text: '#E9EEF4',
      muted: '#9DA9BA',
      accent: '#2CB7B3',
      border: '#27364C',
      shadow: '#000000',
      panic: '#E25D54',
    };
    if (settings.themePreference === 'system') {
      return resolvedScheme === 'dark' ? darkTheme : lightTheme;
    }
    return settings.themePreference === 'dark' ? darkTheme : lightTheme;
  }, [settings.themePreference, resolvedScheme]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (ready) {
      interval = setInterval(() => setNow(Date.now()), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [ready]);

  useEffect(() => {
    const boot = async () => {
      const database = await SQLite.openDatabaseAsync('fastlane.db');
      dbRef.current = database;
      await initDb(database);
      await ensureEatingNotesColumns(database);
      await loadSettings();
      await refreshData();
      setReady(true);
      await refreshNotificationStatus();
    };
    boot();
  }, []);

  useEffect(() => {
    if (ready) {
      scheduleReminders(activeSession);
    }
  }, [
    ready,
    activeSession,
    settings.remindersEnabled,
    settings.allowNightReminders,
    settings.hydrationEnabled,
    settings.hydrationMode,
    settings.hydrationIntervalHours,
    settings.protocolKey,
    settings.customFastingHours,
    settings.customEatingHours,
    settings.dailyCalorieGoal,
    todayCalories,
    todayKey,
  ]);

  useEffect(() => {
    if (!ready) return;
    if (settings.historyRetentionDays > 0) {
      purgeHistory(settings.historyRetentionDays);
    }
  }, [ready, settings.historyRetentionDays]);

  const getDb = () => {
    if (!dbRef.current) {
      throw new Error('Database not ready.');
    }
    return dbRef.current;
  };

  const getAll = async <T,>(sql: string, params: (string | number | null)[] = []) => {
    const db = getDb();
    return (await db.getAllAsync<T>(sql, params)) ?? [];
  };

  const run = async (sql: string, params: (string | number | null)[] = []) => {
    const db = getDb();
    await db.runAsync(sql, params);
  };

  const loadSettings = async () => {
    const result = await getAll<{ key: string; value: string }>(
      'SELECT key, value FROM settings;'
    );
    const loaded: Partial<SettingsState> = {};
    result.forEach((row) => {
      switch (row.key) {
        case 'protocolKey':
          loaded.protocolKey = row.value;
          break;
        case 'customFastingHours':
          loaded.customFastingHours = Number(row.value);
          break;
        case 'customEatingHours':
          loaded.customEatingHours = Number(row.value);
          break;
        case 'remindersEnabled':
          loaded.remindersEnabled = row.value === 'true';
          break;
        case 'allowNightReminders':
          loaded.allowNightReminders = row.value === 'true';
          break;
        case 'remindersIntroShown':
          loaded.remindersIntroShown = row.value === 'true';
          break;
        case 'hydrationEnabled':
          loaded.hydrationEnabled = row.value === 'true';
          break;
        case 'hydrationMode':
          loaded.hydrationMode = row.value as HydrationMode;
          break;
        case 'hydrationIntervalHours':
          loaded.hydrationIntervalHours = Number(row.value);
          break;
        case 'dailyCalorieGoal':
          loaded.dailyCalorieGoal = Number(row.value);
          break;
        case 'unitSystem':
          loaded.unitSystem = row.value as UnitSystem;
          break;
        case 'historyRetentionDays':
          loaded.historyRetentionDays = Number(row.value);
          break;
        case 'themePreference':
          loaded.themePreference = row.value as ThemePreference;
          break;
        default:
          break;
      }
    });
    setSettings({ ...DEFAULT_SETTINGS, ...loaded });
  };

  const persistSetting = async <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => {
    await run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);', [
      key,
      String(value),
    ]);
  };

  const refreshData = async () => {
    const sessionsResult = await getAll<FastingSession>(
      'SELECT * FROM fasting_sessions ORDER BY start_time DESC;'
    );
    const notesResult = await getAll<EatingNote>(
      'SELECT * FROM eating_notes ORDER BY timestamp DESC;'
    );
    setSessions(sessionsResult);
    setNotes(notesResult);
    const active = sessionsResult.find((session) => session.end_time === null) ?? null;
    setActiveSession(active);
    await loadPlanData();
    await loadPantryItems();
  };

  const loadPantryItems = async () => {
    const rows = await getAll<{
      id: number;
      title: string;
      calories: number;
      ingredients_json: string | null;
      notes: string | null;
      created_at: number;
    }>('SELECT * FROM pantry_items ORDER BY created_at DESC;');
    const parsed = rows.map((row) => {
      let ingredients: string[] = [];
      if (row.ingredients_json) {
        try {
          const parsedList = JSON.parse(row.ingredients_json);
          if (Array.isArray(parsedList)) {
            ingredients = parsedList.map((item) => String(item));
          }
        } catch (error) {
          ingredients = [];
        }
      }
      return {
        id: row.id,
        title: row.title,
        calories: row.calories,
        ingredients,
        notes: row.notes,
        createdAt: row.created_at,
      };
    });
    setPantryItems(parsed);
  };

  const loadPlanData = async () => {
    const rows = await getAll<{
      id: number;
      goal_mode: CalorieGoalMode;
      target_pace: PlanPace;
      start_protocol: string;
      target_protocol: string;
      min_eating_hours: number;
      ramp_weeks: number;
      start_date: number;
      status: string;
      created_at: number;
      updated_at: number;
    }>(
      `SELECT * FROM adaptive_plans
       WHERE status IN ('active', 'paused', 'draft')
       ORDER BY CASE
         WHEN status = 'active' THEN 0
         WHEN status = 'paused' THEN 1
         ELSE 2
       END, updated_at DESC
       LIMIT 1;`
    );
    if (rows.length === 0) {
      setPlan(null);
      setPlanWeeks([]);
      setPlanCheckins([]);
      setPlanUpdates([]);
    } else {
      const row = rows[0];
      const loadedPlan: AdaptivePlan = {
        id: row.id,
        goalMode: row.goal_mode,
        targetPace: row.target_pace,
        startProtocol: row.start_protocol,
        targetProtocol: row.target_protocol,
        minEatingHours: row.min_eating_hours,
        rampWeeks: row.ramp_weeks,
        startDate: row.start_date,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
      setPlan(loadedPlan);
      const weekRows = await getAll<AdaptivePlanWeek>(
        'SELECT * FROM adaptive_plan_weeks WHERE plan_id = ? ORDER BY week_index ASC;',
        [loadedPlan.id]
      );
      setPlanWeeks(weekRows);
      const checkinRows = await getAll<PlanCheckIn>(
        'SELECT * FROM adaptive_plan_checkins WHERE plan_id = ? ORDER BY created_at DESC;',
        [loadedPlan.id]
      );
      setPlanCheckins(checkinRows);
      const updateRows = await getAll<PlanUpdate>(
        'SELECT * FROM adaptive_plan_updates WHERE plan_id = ? ORDER BY created_at DESC LIMIT 8;',
        [loadedPlan.id]
      );
      setPlanUpdates(updateRows);
    }

    const historyRows = await getAll<{
      id: number;
      goal_mode: CalorieGoalMode;
      target_pace: PlanPace;
      start_protocol: string;
      target_protocol: string;
      min_eating_hours: number;
      ramp_weeks: number;
      start_date: number;
      status: string;
      created_at: number;
      updated_at: number;
    }>('SELECT * FROM adaptive_plans WHERE status = ? ORDER BY updated_at DESC;', ['archived']);
    setPlanHistory(
      historyRows.map((row) => ({
        id: row.id,
        goalMode: row.goal_mode,
        targetPace: row.target_pace,
        startProtocol: row.start_protocol,
        targetProtocol: row.target_protocol,
        minEatingHours: row.min_eating_hours,
        rampWeeks: row.ramp_weeks,
        startDate: row.start_date,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
    );
  };

  const addPlanUpdate = async (planId: number, message: string) => {
    await run(
      'INSERT INTO adaptive_plan_updates (plan_id, message, created_at) VALUES (?, ?, ?);',
      [planId, message, Date.now()]
    );
  };

  const clampProtocolForMinEating = (protocolKey: string, minEatingHours: number) => {
    const allowed = PROTOCOL_ORDER.filter(
      (key) => (PROTOCOL_EATING_HOURS[key] ?? 0) >= minEatingHours
    );
    if (allowed.length === 0) return protocolKey;
    if (allowed.includes(protocolKey)) return protocolKey;
    return allowed[allowed.length - 1];
  };

  const resolveTargetProtocol = (goalMode: CalorieGoalMode, pace: PlanPace, minEatingHours: number) => {
    const mapping: Record<CalorieGoalMode, Record<PlanPace, string>> = {
      lose: { gentle: '16:8', moderate: '17:7', aggressive: '18:6' },
      maintain: { gentle: '15:9', moderate: '16:8', aggressive: '17:7' },
      gain: { gentle: '15:9', moderate: '15:9', aggressive: '16:8' },
    };
    const target = mapping[goalMode]?.[pace] ?? '16:8';
    return clampProtocolForMinEating(target, minEatingHours);
  };

  const getProtocolIndex = (protocolKey: string) => {
    const index = PROTOCOL_ORDER.indexOf(protocolKey);
    return index === -1 ? 1 : index;
  };

  const getCalorieAdjustment = (goalMode: CalorieGoalMode, pace: PlanPace) => {
    if (goalMode === 'maintain') return 0;
    const magnitude = pace === 'aggressive' ? 300 : pace === 'moderate' ? 200 : 100;
    return goalMode === 'lose' ? -magnitude : magnitude;
  };

  const buildPlanWeeks = (
    startProtocol: string,
    goalMode: CalorieGoalMode,
    pace: PlanPace,
    rampWeeks: number,
    minEatingHours: number,
    baseCalories: number
  ) => {
    const safeWeeks = Math.max(2, Math.min(8, rampWeeks));
    const targetProtocol = resolveTargetProtocol(goalMode, pace, minEatingHours);
    const startClamped = clampProtocolForMinEating(startProtocol, minEatingHours);
    const startIndex = getProtocolIndex(startClamped);
    const targetIndex = getProtocolIndex(targetProtocol);
    const steps = Math.max(0, targetIndex - startIndex);
    const adjustment = getCalorieAdjustment(goalMode, pace);
    const weeks = Array.from({ length: safeWeeks }, (_, weekIndex) => {
      const progress = safeWeeks === 1 ? 0 : weekIndex / (safeWeeks - 1);
      const step = steps === 0 ? 0 : Math.round(steps * progress);
      const protocolKey = PROTOCOL_ORDER[Math.min(startIndex + step, targetIndex)];
      const calories =
        baseCalories > 0 ? Math.max(0, Math.round(baseCalories + adjustment * progress)) : null;
      return {
        weekIndex,
        protocolKey,
        dailyCalories: calories,
        notes: weekIndex === 0 ? 'Start steady and focus on consistency.' : null,
      };
    });
    return { targetProtocol, weeks };
  };

  const requestPlanRecommendation = async (payload: {
    goalMode: CalorieGoalMode;
    targetPace: PlanPace;
    startProtocol: string;
    minEatingHours: number;
    rampWeeks: number;
    dailyCalorieGoal: number;
    adherencePct: number;
    avgFastingHours: number;
  }) => {
    if (!FOOD_API_URL) return null;
    try {
      const response = await fetch(`${FOOD_API_URL}/v1/plan/recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(FOOD_API_KEY ? { 'X-API-KEY': FOOD_API_KEY } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      return null;
    }
  };

  const createAdaptivePlan = async () => {
    if (planBusy) return;
    setPlanBusy(true);
    try {
      setCheckinSuggestion(null);
      const baseCalories = settings.dailyCalorieGoal;
      const recommendation = await requestPlanRecommendation({
        goalMode: planGoalMode,
        targetPace: planPace,
        startProtocol: planStartProtocol,
        minEatingHours: planMinEatingHours,
        rampWeeks: planRampWeeks,
        dailyCalorieGoal: baseCalories,
        adherencePct,
        avgFastingHours: Number((avgWeekMs / 3600000).toFixed(1)),
      });

      const localPlan = buildPlanWeeks(
        planStartProtocol,
        planGoalMode,
        planPace,
        planRampWeeks,
        planMinEatingHours,
        baseCalories
      );

      const targetProtocol =
        recommendation?.targetProtocol && PROTOCOL_ORDER.includes(recommendation.targetProtocol)
          ? recommendation.targetProtocol
          : localPlan.targetProtocol;
      const normalizedWeeks = Array.isArray(recommendation?.weeks)
        ? recommendation.weeks
            .map((week: any, index: number) => ({
              weekIndex:
                Number.isFinite(Number(week.weekIndex)) ? Number(week.weekIndex) : index,
              protocolKey:
                typeof week.protocolKey === 'string' && PROTOCOL_ORDER.includes(week.protocolKey)
                  ? week.protocolKey
                  : localPlan.weeks[index]?.protocolKey ?? localPlan.targetProtocol,
              dailyCalories:
                Number.isFinite(Number(week.dailyCalories)) ? Number(week.dailyCalories) : null,
              notes: typeof week.notes === 'string' ? week.notes : null,
            }))
            .filter((week: any) => week.weekIndex !== null)
        : [];
      const weeks =
        normalizedWeeks.length > 0
          ? normalizedWeeks
          : localPlan.weeks;

      const nowTs = Date.now();
      await run(
        "UPDATE adaptive_plans SET status = ? WHERE status IN ('active', 'paused');",
        ['archived']
      );
      await run(
        `INSERT INTO adaptive_plans (
          goal_mode,
          target_pace,
          start_protocol,
          target_protocol,
          min_eating_hours,
          ramp_weeks,
          start_date,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          planGoalMode,
          planPace,
          planStartProtocol,
          targetProtocol,
          planMinEatingHours,
          weeks.length,
          nowTs,
          'draft',
          nowTs,
          nowTs,
        ]
      );
      const planRow = await getAll<{ id: number }>(
        'SELECT id FROM adaptive_plans WHERE status = ? ORDER BY id DESC LIMIT 1;',
        ['draft']
      );
      const planId = planRow[0]?.id;
      if (!planId) throw new Error('Plan creation failed.');
      await addPlanUpdate(planId, 'Plan created (draft). Activate to begin.');
      await run('DELETE FROM adaptive_plan_weeks WHERE plan_id = ?;', [planId]);
      for (let index = 0; index < weeks.length; index += 1) {
        const week = weeks[index];
        await run(
          `INSERT INTO adaptive_plan_weeks (plan_id, week_index, protocol_key, daily_calories, notes)
           VALUES (?, ?, ?, ?, ?);`,
          [
            planId,
            index,
            week.protocolKey,
            week.dailyCalories ?? null,
            week.notes ?? null,
          ]
        );
      }
      setPlanBuilderVisible(false);
      await loadPlanData();
    } catch (error) {
      Alert.alert('Adaptive plan', String(error));
    } finally {
      setPlanBusy(false);
    }
  };

  const openPlanBuilder = () => {
    if (plan) {
      setPlanGoalMode(plan.goalMode);
      setPlanPace(plan.targetPace);
      setPlanStartProtocol(plan.startProtocol);
      setPlanRampWeeks(plan.rampWeeks);
      setPlanMinEatingHours(plan.minEatingHours);
    }
    setPlanBuilderVisible(true);
  };

  const togglePlanStatus = async () => {
    if (!plan) return;
    const nextStatus = plan.status === 'paused' ? 'active' : 'paused';
    await run('UPDATE adaptive_plans SET status = ?, updated_at = ? WHERE id = ?;', [
      nextStatus,
      Date.now(),
      plan.id,
    ]);
    await addPlanUpdate(
      plan.id,
      nextStatus === 'paused' ? 'Plan paused.' : 'Plan resumed.'
    );
    await loadPlanData();
  };

  const deactivatePlan = async () => {
    if (!plan) return;
    if (plan.status === 'draft') return;
    const nowTs = Date.now();
    await run('UPDATE adaptive_plans SET status = ?, updated_at = ? WHERE id = ?;', [
      'draft',
      nowTs,
      plan.id,
    ]);
    await addPlanUpdate(plan.id, 'Plan deactivated.');
    await loadPlanData();
  };

  const clearPlan = async () => {
    Alert.alert(
      'Clear plan',
      'This will delete all plans, weeks, check-ins, and updates. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await run('DELETE FROM adaptive_plan_updates;');
            await run('DELETE FROM adaptive_plan_checkins;');
            await run('DELETE FROM adaptive_plan_weeks;');
            await run('DELETE FROM adaptive_plans;');
            await loadPlanData();
          },
        },
      ]
    );
  };

  const activatePlan = async () => {
    if (!plan) return;
    if (plan.status !== 'draft') return;
    const nowTs = Date.now();
    await run(
      'UPDATE adaptive_plans SET status = ?, start_date = ?, updated_at = ? WHERE id = ?;',
      ['active', nowTs, nowTs, plan.id]
    );
    await addPlanUpdate(plan.id, 'Plan activated.');
    await loadPlanData();
  };

  const getCurrentPlanWeekIndex = (planItem: AdaptivePlan | null) => {
    if (!planItem) return 0;
    const elapsed = Math.floor((now - planItem.startDate) / (7 * 24 * 3600 * 1000));
    return Math.max(0, Math.min(elapsed, planItem.rampWeeks - 1));
  };

  const buildCheckinSuggestion = (
    adherencePctValue: number,
    energy: number,
    hunger: number,
    currentProtocol: string,
    minEatingHours: number
  ): PlanSuggestion => {
    if (adherencePctValue < 70 || energy <= 2 || hunger >= 4) {
      const currentIndex = getProtocolIndex(currentProtocol);
      const nextIndex = Math.max(0, currentIndex - 1);
      const nextProtocol = clampProtocolForMinEating(
        PROTOCOL_ORDER[nextIndex],
        minEatingHours
      );
      return {
        action: 'step_down',
        rationale: 'Dial back slightly to improve adherence and recovery.',
        nextProtocol,
      };
    }
    if (adherencePctValue >= 85 && energy >= 4 && hunger <= 2) {
      const currentIndex = getProtocolIndex(currentProtocol);
      const nextIndex = Math.min(PROTOCOL_ORDER.length - 1, currentIndex + 1);
      const nextProtocol = clampProtocolForMinEating(
        PROTOCOL_ORDER[nextIndex],
        minEatingHours
      );
      return {
        action: 'step_up',
        rationale: 'You are consistent and feeling good. Consider stepping up.',
        nextProtocol,
      };
    }
    return {
      action: 'hold',
      rationale: 'Stay steady this week and focus on consistency.',
      nextProtocol: currentProtocol,
    };
  };

  const savePlanCheckin = async () => {
    if (!plan) return;
    if (plan.status !== 'active') {
      Alert.alert('Check-in', 'Activate your plan to submit check-ins.');
      return;
    }
    const adherencePctValue = Math.min(100, Math.max(20, checkinAdherence * 20));
    const currentWeekIndex = getCurrentPlanWeekIndex(plan);
    const currentWeek = planWeeks.find((week) => week.week_index === currentWeekIndex);
    const currentProtocol = currentWeek?.protocol_key ?? plan.startProtocol;
    const suggestion = buildCheckinSuggestion(
      adherencePctValue,
      checkinEnergy,
      checkinHunger,
      currentProtocol,
      plan.minEatingHours
    );
    const nowTs = Date.now();
    await run(
      `INSERT INTO adaptive_plan_checkins (
        plan_id,
        week_index,
        adherence_pct,
        energy,
        hunger,
        conflicts,
        suggestion_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        plan.id,
        currentWeekIndex,
        Math.round(adherencePctValue),
        checkinEnergy,
        checkinHunger,
        null,
        JSON.stringify(suggestion),
        nowTs,
      ]
    );
    setCheckinSuggestion(suggestion);
    setCheckinConflicts('');
    await addPlanUpdate(
      plan.id,
      `Check-in saved: ${Math.round(adherencePctValue)}% adherence.`
    );
    await loadPlanData();
  };

  const applyPlanSuggestion = async () => {
    if (!plan || !checkinSuggestion) return;
    if (checkinSuggestion.action === 'hold') return;
    const currentWeekIndex = getCurrentPlanWeekIndex(plan);
    const currentWeek = planWeeks.find((week) => week.week_index === currentWeekIndex);
    const baseProtocol = currentWeek?.protocol_key ?? plan.startProtocol;
    const nextProtocol = checkinSuggestion.nextProtocol ?? baseProtocol;
    const remainingWeeks = Math.max(1, plan.rampWeeks - currentWeekIndex);
    const rebuilt = buildPlanWeeks(
      nextProtocol,
      plan.goalMode,
      plan.targetPace,
      remainingWeeks,
      plan.minEatingHours,
      settings.dailyCalorieGoal
    );

    await run('DELETE FROM adaptive_plan_weeks WHERE plan_id = ? AND week_index >= ?;', [
      plan.id,
      currentWeekIndex,
    ]);
    for (let index = 0; index < rebuilt.weeks.length; index += 1) {
      const week = rebuilt.weeks[index];
      await run(
        `INSERT INTO adaptive_plan_weeks (plan_id, week_index, protocol_key, daily_calories, notes)
         VALUES (?, ?, ?, ?, ?);`,
        [
          plan.id,
          currentWeekIndex + index,
          week.protocolKey,
          week.dailyCalories ?? null,
          week.notes ?? null,
        ]
      );
    }
    await run(
      'UPDATE adaptive_plans SET start_protocol = ?, target_protocol = ?, updated_at = ? WHERE id = ?;',
      [
        nextProtocol,
        rebuilt.targetProtocol,
        Date.now(),
        plan.id,
      ]
    );
    await addPlanUpdate(
      plan.id,
      `Plan adjusted: ${checkinSuggestion.action.replace('_', ' ')}.`
    );
    await loadPlanData();
    Alert.alert('Plan adjusted', 'Your plan has been recalculated.');
  };

  const purgeHistory = async (days: number) => {
    if (!Number.isFinite(days) || days <= 0) return;
    const cutoff = Date.now() - days * 24 * 3600 * 1000;
    await run('DELETE FROM eating_notes WHERE timestamp < ?;', [cutoff]);
    await run(
      'DELETE FROM fasting_sessions WHERE end_time IS NOT NULL AND end_time < ?;',
      [cutoff]
    );
    await refreshData();
  };

  const clearAllHistory = () => {
    Alert.alert(
      'Clear all history',
      'This will delete all fasting sessions and eating notes. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await run('DELETE FROM fasting_sessions;');
            await run('DELETE FROM eating_notes;');
            setSessions([]);
            setNotes([]);
            setActiveSession(null);
            lastCalorieReminderDateRef.current = null;
            await Notifications.cancelAllScheduledNotificationsAsync();
            await scheduleReminders(null, []);
          },
        },
      ]
    );
  };

  const getActiveSession = async () => {
    const result = await getAll<FastingSession>(
      'SELECT * FROM fasting_sessions WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1;'
    );
    return result[0] ?? null;
  };

  const ensureNotificationPermissions = async () => {
    const current = await Notifications.getPermissionsAsync();
    if (current.status !== 'granted') {
      const request = await Notifications.requestPermissionsAsync();
      await refreshNotificationStatus();
      return request.status === 'granted';
    }
    return true;
  };

  const refreshNotificationStatus = async () => {
    const current = await Notifications.getPermissionsAsync();
    setNotificationStatus(current.status ?? 'unknown');
  };

  const requestNotificationPermissions = async () => {
    const request = await Notifications.requestPermissionsAsync();
    const status = request.status ?? 'unknown';
    setNotificationStatus(status);
    Alert.alert('Notifications', `Status: ${status}`);
  };

  const sendTestReminder = async () => {
    try {
      const permissions = await Notifications.getPermissionsAsync();
      const status = permissions.status ?? 'unknown';
      if (status !== 'granted') {
        Alert.alert('Notifications', `Permission not granted: ${status}`);
        return;
      }
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Fasting Lane test',
          body: 'This is a test reminder to confirm notifications work.',
        },
        trigger: { type: 'timeInterval', seconds: 5, repeats: false },
      });
      Alert.alert('Test scheduled', `Reminder scheduled (id: ${id}).`);
    } catch (error) {
      Alert.alert('Test failed', String(error));
    }
  };

  const scheduleReminders = async (
    session: FastingSession | null,
    sessionsOverride?: FastingSession[]
  ) => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!settings.remindersEnabled) return;

    const hasPermission = await ensureNotificationPermissions();
    if (!hasPermission) return;

    const hydrationDuringFasting =
      settings.hydrationMode === 'fasting' || settings.hydrationMode === 'both';
    const hydrationDuringEating =
      settings.hydrationMode === 'eating' || settings.hydrationMode === 'both';
    const shouldScheduleAt = (date: Date) =>
      settings.allowNightReminders || !isQuietHours(date);

    const completedSessions = (sessionsOverride ?? sessions).filter(
      (item) => item.end_time !== null
    );
    const lastCompletedLocal = completedSessions.sort(
      (a, b) => (b.end_time ?? 0) - (a.end_time ?? 0)
    )[0];

    if (session) {
      const protocol = getProtocolDetails(settings);
      const plannedEnd =
        session.end_time ??
        session.start_time + protocol.fastingHours * 3600 * 1000;

      if (plannedEnd > Date.now() && shouldScheduleAt(new Date(plannedEnd))) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Fast complete',
            body: 'Your fasting window is finished. Time to refuel mindfully.',
          },
          trigger: { type: 'date', date: new Date(plannedEnd) },
        });
      }

      if (settings.hydrationEnabled && hydrationDuringFasting && plannedEnd > Date.now()) {
        const intervalMs = settings.hydrationIntervalHours * 3600 * 1000;
        let next = Date.now() + intervalMs;
        while (next < plannedEnd) {
          const nextDate = new Date(next);
          if (shouldScheduleAt(nextDate)) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Hydration check',
                body: 'Take a moment to drink water.',
              },
              trigger: { type: 'date', date: nextDate },
            });
          }
          next += intervalMs;
        }
      }
    } else {
      const protocol = getProtocolDetails(settings);
      const nextFastStart = lastCompletedLocal?.end_time
        ? lastCompletedLocal.end_time + protocol.eatingHours * 3600 * 1000
        : null;

      if (nextFastStart && nextFastStart > Date.now() && shouldScheduleAt(new Date(nextFastStart))) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Start your fast',
            body: 'Your eating window is ending. Time to begin your next fast.',
          },
          trigger: { type: 'date', date: new Date(nextFastStart) },
        });
      }

      if (settings.hydrationEnabled && hydrationDuringEating && nextFastStart && nextFastStart > Date.now()) {
        const intervalMs = settings.hydrationIntervalHours * 3600 * 1000;
        let next = Date.now() + intervalMs;
        while (next < nextFastStart) {
          const nextDate = new Date(next);
          if (shouldScheduleAt(nextDate)) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Hydration check',
                body: 'Take a moment to drink water.',
              },
              trigger: { type: 'date', date: nextDate },
            });
          }
          next += intervalMs;
        }
      }

      if (settings.dailyCalorieGoal > 0) {
        const threshold = Math.round(settings.dailyCalorieGoal * 0.9);
        const shouldRemind =
        todayCalories >= threshold &&
        todayCalories < settings.dailyCalorieGoal &&
        lastCalorieReminderDateRef.current !== todayKey;
      if (shouldRemind) {
        if (!shouldScheduleAt(new Date())) {
          return;
        }
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Calorie goal near',
            body: `You are close to your daily goal (${todayCalories}/${settings.dailyCalorieGoal}).`,
          },
          trigger: { type: 'timeInterval', seconds: 5, repeats: false },
        });
        if (id) {
          lastCalorieReminderDateRef.current = todayKey;
        }
      }
      }
    }
  };

  const startFast = async () => {
    const nowTs = Date.now();
    const protocol = getProtocolDetails(settings);
    await run(
      `INSERT INTO fasting_sessions 
      (start_time, end_time, protocol_key, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?);`,
      [nowTs, null, protocol.key, nowTs, nowTs]
    );
    await refreshData();
    await scheduleReminders(await getActiveSession());
  };

  const stopFast = async () => {
    if (!activeSession) return;
    const nowTs = Date.now();
    await run(
      'UPDATE fasting_sessions SET end_time = ?, updated_at = ? WHERE id = ?;',
      [nowTs, nowTs, activeSession.id]
    );
    await refreshData();
    await scheduleReminders(null);
  };

  const openEdit = (session: FastingSession) => {
    setEditSession(session);
    setEditStart(new Date(session.start_time));
    setEditEnd(session.end_time ? new Date(session.end_time) : null);
  };

  const saveEdit = async () => {
    if (!editSession || !editStart) return;
    const startTs = editStart.getTime();
    const endTs = editEnd ? editEnd.getTime() : null;
    await run(
      'UPDATE fasting_sessions SET start_time = ?, end_time = ?, updated_at = ? WHERE id = ?;',
      [startTs, endTs, Date.now(), editSession.id]
    );
    setEditSession(null);
    await refreshData();
    await scheduleReminders(await getActiveSession());
  };

  const addNote = async () => {
    if (activeSession) {
      Alert.alert('Fasting in progress', 'Notes can be added during eating windows.');
      return;
    }
    if (!noteText.trim()) return;
    const calories = noteCalories.trim().length > 0 ? Number(noteCalories) : null;
    await run(
      'INSERT INTO eating_notes (timestamp, text, calories, thumbnail_path, meta_json) VALUES (?, ?, ?, ?, ?);',
      [Date.now(), noteText.trim(), calories, null, null]
    );
    setNoteText('');
    setNoteCalories('');
    await refreshData();
  };

  const deleteNote = async (id: number) => {
    await run('DELETE FROM eating_notes WHERE id = ?;', [id]);
    await refreshData();
  };

  const openEditNote = (note: EatingNote) => {
    setEditNote(note);
    setEditNoteText(note.text);
    setEditNoteCalories(
      note.calories !== null && note.calories !== undefined
        ? String(note.calories)
        : ''
    );
    setEditNoteVisible(true);
  };

  const saveEditNote = async () => {
    if (!editNote) return;
    const calories =
      editNoteCalories.trim().length > 0 ? Number(editNoteCalories) : null;
    await run(
      'UPDATE eating_notes SET text = ?, calories = ? WHERE id = ?;',
      [editNoteText.trim() || 'Note', calories, editNote.id]
    );
    setEditNoteVisible(false);
    setEditNote(null);
    setEditNoteText('');
    setEditNoteCalories('');
    await refreshData();
  };

  const promptImageSource = () =>
    new Promise<'camera' | 'library' | null>((resolve) => {
      Alert.alert(
        'Photo source',
        'Choose a photo source.',
        [
          { text: 'Camera', onPress: () => resolve('camera') },
          { text: 'Photo library', onPress: () => resolve('library') },
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        ],
        { cancelable: true }
      );
    });

  const addPhotoNote = async (allowDuringFasting = false, mode: 'note' | 'smart' = 'note') => {
    if (activeSession && !allowDuringFasting) {
      Alert.alert('Fasting in progress', 'Photo notes can be added during eating windows.');
      return;
    }
    if (!FOOD_API_URL) {
      Alert.alert('Photo scan', 'Set EXPO_PUBLIC_FOOD_API_URL to use photo scans.');
      return;
    }
    setScanBusy(true);
    setScanStatus('Opening photo picker...');
    try {
      const source = await promptImageSource();
      if (!source) return;

      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Camera', 'Camera permission is required.');
          return;
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Photos', 'Photo library permission is required.');
          return;
        }
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              quality: 0.7,
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
            })
          : await ImagePicker.launchImageLibraryAsync({
              quality: 0.7,
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
            });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      const normalizedAsset = await normalizeImageAsset(asset);
      setScanStatus('Analyzing photo...');

      const formData = new FormData();
      formData.append('image', {
        uri: normalizedAsset.uri,
        name: normalizedAsset.name,
        type: normalizedAsset.type,
      } as unknown as Blob);
      formData.append('unitSystem', settings.unitSystem);

      const response = await fetch(`${FOOD_API_URL}/v1/food/analyze`, {
        method: 'POST',
        headers: FOOD_API_KEY ? { 'X-API-KEY': FOOD_API_KEY } : undefined,
        body: formData,
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || 'Photo analysis failed.');
      }
      const data = await response.json();
      const thumbBase64 = data.thumbnailBase64;
      const items = Array.isArray(data.items) ? data.items : [];
      const totalCalories = data.totalCalories ?? null;

      let thumbPath: string | null = null;
      if (thumbBase64) {
        const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
        if (baseDir) {
          const fileName = `thumb_${Date.now()}.jpg`;
          const dest = `${baseDir}${fileName}`;
          await FileSystem.writeAsStringAsync(dest, thumbBase64, {
            encoding: FileSystem.EncodingType?.Base64 ?? 'base64',
          });
          thumbPath = dest;
        } else {
          thumbPath = `data:image/jpeg;base64,${thumbBase64}`;
        }
      }

      setScanThumbPath(thumbPath);
      setScanItems(
        items.length > 0
          ? items
          : [{ name: '', portion: '', calories: null, count: null }]
      );
      setScanTotalCalories(totalCalories);
      setScanMode(mode);
      setScanVisible(true);
      setScanStatus('Review the estimate before saving.');
    } catch (error) {
      Alert.alert('Photo scan failed', String(error));
    } finally {
      setScanBusy(false);
    }
  };

  const estimateFood = async () => {
    if (!FOOD_API_URL) {
      Alert.alert('Food estimate', 'Set EXPO_PUBLIC_FOOD_API_URL to use smart tools.');
      return;
    }
    if (!ifEatText.trim()) return;
    setIfEatResult(null);
    setIfEatBusy(true);
    try {
      const response = await fetch(`${FOOD_API_URL}/v1/food/estimate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(FOOD_API_KEY ? { 'X-API-KEY': FOOD_API_KEY } : {}),
        },
        body: JSON.stringify({ text: ifEatText.trim(), unitSystem: settings.unitSystem }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || 'Estimate failed.');
      }
      const data = (await response.json()) as FoodEstimateResult;
      setIfEatResult(data);
    } catch (error) {
      Alert.alert('Estimate failed', String(error));
    } finally {
      setIfEatBusy(false);
    }
  };

  const clearFoodEstimate = () => {
    setIfEatResult(null);
  };

  const requestPortionCoach = async () => {
    if (!FOOD_API_URL) {
      Alert.alert('Portion coach', 'Set EXPO_PUBLIC_FOOD_API_URL to use smart tools.');
      return;
    }
    if (!portionText.trim()) {
      Alert.alert('Portion coach', 'Add a meal description to get tips.');
      return;
    }
    setPortionResult(null);
    const targetInput = portionTarget.trim();
    const targetCalories = targetInput.length > 0 ? Number(targetInput) : null;
    const suggestedTarget =
      targetCalories !== null && Number.isFinite(targetCalories)
        ? targetCalories
        : dailyCalorieGoal > 0
          ? Math.max(0, dailyCalorieGoal - todayCalories)
          : null;

    setPortionBusy(true);
    try {
      const payload: { text: string; targetCalories?: number; unitSystem?: UnitSystem } = {
        text: portionText.trim(),
      };
      payload.unitSystem = settings.unitSystem;
      if (Number.isFinite(suggestedTarget) && suggestedTarget !== null && suggestedTarget > 0) {
        payload.targetCalories = suggestedTarget;
      }
      const response = await fetch(`${FOOD_API_URL}/v1/portion/coach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(FOOD_API_KEY ? { 'X-API-KEY': FOOD_API_KEY } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || 'Portion coach failed.');
      }
      const data = (await response.json()) as PortionCoachResult;
      setPortionResult(data);
    } catch (error) {
      Alert.alert('Portion coach failed', String(error));
    } finally {
      setPortionBusy(false);
    }
  };

  const clearPortionCoach = () => {
    setPortionResult(null);
  };

  const scanFridgeIdeas = async () => {
    if (!FOOD_API_URL) {
      Alert.alert('Fridge ideas', 'Set EXPO_PUBLIC_FOOD_API_URL to use smart tools.');
      return;
    }
    const parsedLimit = Number(fridgeLimit);
    const suggestedLimit =
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 400;

    setFridgeIdeas(null);
    setFridgeBusy(true);
    try {
      const source = await promptImageSource();
      if (!source) return;

      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Camera', 'Camera permission is required.');
          return;
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Photos', 'Photo library permission is required.');
          return;
        }
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              quality: 0.7,
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
            })
          : await ImagePicker.launchImageLibraryAsync({
              quality: 0.7,
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
            });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      const normalizedAsset = await normalizeImageAsset(asset);

      const formData = new FormData();
      formData.append('image', {
        uri: normalizedAsset.uri,
        name: normalizedAsset.name,
        type: normalizedAsset.type,
      } as unknown as Blob);
      formData.append('calorieLimit', String(suggestedLimit));

      const response = await fetch(`${FOOD_API_URL}/v1/fridge/ideas`, {
        method: 'POST',
        headers: FOOD_API_KEY ? { 'X-API-KEY': FOOD_API_KEY } : undefined,
        body: formData,
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || 'Fridge scan failed.');
      }
      const data = (await response.json()) as FridgeIdeasResult;
      setFridgeIdeas(data);
    } catch (error) {
      Alert.alert('Fridge scan failed', String(error));
    } finally {
      setFridgeBusy(false);
    }
  };

  const clearFridgeIdeas = () => {
    setFridgeIdeas(null);
  };

  const saveFridgeIdea = async (meal: FridgeMealIdea) => {
    const trimmedTitle = meal.title.trim();
    if (!trimmedTitle) return;
    const exists = pantryItems.some(
      (item) => item.title.trim().toLowerCase() === trimmedTitle.toLowerCase()
    );
    if (exists) return;
    await run(
      'INSERT INTO pantry_items (title, calories, ingredients_json, notes, created_at) VALUES (?, ?, ?, ?, ?);',
      [
        trimmedTitle,
        Math.max(0, Math.round(meal.calories || 0)),
        JSON.stringify(meal.ingredients ?? []),
        meal.notes ?? null,
        Date.now(),
      ]
    );
    await loadPantryItems();
  };

  const resolveAutopilotWindow = () => {
    const nowTs = Date.now();
    const eatingMs = Math.max(1, protocol.eatingHours) * 3600 * 1000;
    if (activeSession) {
      const start =
        typeof expectedEnd === 'number'
          ? expectedEnd
          : activeSession.start_time + protocol.fastingHours * 3600 * 1000;
      return { start, end: start + eatingMs, label: 'Next eating window' };
    }
    if (currentWindowStart !== null) {
      const start = nowTs > currentWindowStart ? nowTs : currentWindowStart;
      const end = start + eatingMs;
      return { start, end, label: 'Remaining eating window' };
    }
    return { start: nowTs, end: nowTs + eatingMs, label: 'First eating window' };
  };

  const applyAutopilotSchedule = (
    items: AutopilotItem[],
    windowStart: number,
    windowEnd: number
  ) => {
    if (!items.length) return items;
    const windowMs = Math.max(30 * 60000, windowEnd - windowStart);
    const step = windowMs / (items.length + 1);
    return items.map((item, index) => {
      const timeMs = Math.round(windowStart + step * (index + 1));
      return {
        ...item,
        timeMs,
        time: formatTime(timeMs),
      };
    });
  };


  const requestAutopilot = async () => {
    if (!FOOD_API_URL) {
      Alert.alert('Autopilot', 'Set EXPO_PUBLIC_FOOD_API_URL to use smart tools.');
      return;
    }
    const window = resolveAutopilotWindow();
    const remainingMinutes = Math.max(15, Math.round((window.end - window.start) / 60000));
    const remainingCalories =
      settings.dailyCalorieGoal > 0
        ? Math.max(0, settings.dailyCalorieGoal - todayCalories)
        : null;
    setAutopilotResult(null);
    setAutopilotBusy(true);
    try {
      const response = await fetch(`${FOOD_API_URL}/v1/autopilot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(FOOD_API_KEY ? { 'X-API-KEY': FOOD_API_KEY } : {}),
        },
        body: JSON.stringify({
          windowMinutes: remainingMinutes,
          remainingCalories,
          dailyGoal: settings.dailyCalorieGoal || null,
          unitSystem: settings.unitSystem,
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || 'Autopilot failed.');
      }
      const data = (await response.json()) as AutopilotResult;
      const baseItems = Array.isArray(data.items) ? data.items : [];
      const hydratedItems = baseItems.map((item, index) => ({
        id: `auto-${Date.now()}-${index}`,
        time: item.time ?? '',
        timeMs: window.start,
        title: item.title?.trim() || 'Meal',
        calories: Math.max(0, Math.round(Number(item.calories) || 0)),
        notes: item.notes,
        ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
      }));
      const scheduledItems = applyAutopilotSchedule(hydratedItems, window.start, window.end);
      const totalCalories = scheduledItems.reduce(
        (sum, item) => sum + (Number(item.calories) || 0),
        0
      );
      setAutopilotResult({
        items: scheduledItems,
        totalCalories: totalCalories || data.totalCalories || 0,
        disclaimer: data.disclaimer,
        windowStart: window.start,
        windowEnd: window.end,
        windowLabel: window.label,
      });
    } catch (error) {
      Alert.alert('Autopilot failed', String(error));
    } finally {
      setAutopilotBusy(false);
    }
  };

  const clearAutopilot = () => {
    setAutopilotResult(null);
  };

  const updateAutopilotItem = (itemId: string, updates: Partial<AutopilotItem>) => {
    setAutopilotResult((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      );
      const totalCalories = items.reduce(
        (sum, item) => sum + (Number(item.calories) || 0),
        0
      );
      return { ...prev, items, totalCalories };
    });
  };

  const removeAutopilotItem = (itemId: string) => {
    setAutopilotResult((prev) => {
      if (!prev) return prev;
      const remaining = prev.items.filter((item) => item.id !== itemId);
      const windowStart = prev.windowStart ?? Date.now();
      const windowEnd =
        prev.windowEnd ?? windowStart + Math.max(1, protocol.eatingHours) * 3600 * 1000;
      const scheduled = applyAutopilotSchedule(remaining, windowStart, windowEnd);
      const totalCalories = scheduled.reduce(
        (sum, item) => sum + (Number(item.calories) || 0),
        0
      );
      return { ...prev, items: scheduled, totalCalories };
    });
  };

  const openAutopilotTimePicker = (itemId: string) => {
    if (!autopilotResult) return;
    const item = autopilotResult.items.find((entry) => entry.id === itemId);
    if (!item) return;
    setAutopilotTimePicker({
      itemId,
      value: new Date(item.timeMs || Date.now()),
    });
  };

  const applyAutopilotTime = (itemId: string, selected: Date) => {
    setAutopilotResult((prev) => {
      if (!prev) return prev;
      const windowStart = prev.windowStart ?? Date.now();
      const windowEnd =
        prev.windowEnd ?? windowStart + Math.max(1, protocol.eatingHours) * 3600 * 1000;
      const baseDate = new Date(windowStart);
      const timeCandidate = new Date(baseDate);
      timeCandidate.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      const clampedMs = Math.min(
        windowEnd - 5 * 60000,
        Math.max(windowStart, timeCandidate.getTime())
      );
      const items = prev.items.map((item) =>
        item.id === itemId
          ? { ...item, timeMs: clampedMs, time: formatTime(clampedMs) }
          : item
      );
      return { ...prev, items };
    });
  };

  const addAutopilotItemFromPantry = (item: PantryItem) => {
    setAutopilotResult((prev) => {
      const window =
        prev?.windowStart && prev?.windowEnd
          ? { start: prev.windowStart, end: prev.windowEnd, label: prev.windowLabel ?? 'Window' }
          : resolveAutopilotWindow();
      const nextItem: AutopilotItem = {
        id: `pantry-${item.id}-${Date.now()}`,
        time: '',
        timeMs: window.start,
        title: item.title,
        calories: Math.max(0, Math.round(item.calories || 0)),
        notes: item.notes ?? undefined,
        ingredients: item.ingredients ?? [],
      };
      const items = prev?.items ? [...prev.items, nextItem] : [nextItem];
      const scheduled = applyAutopilotSchedule(items, window.start, window.end);
      const totalCalories = scheduled.reduce(
        (sum, entry) => sum + (Number(entry.calories) || 0),
        0
      );
      return {
        items: scheduled,
        totalCalories,
        disclaimer: prev?.disclaimer,
        windowStart: window.start,
        windowEnd: window.end,
        windowLabel: window.label,
      };
    });
  };

  const requestRescue = async (skipApiCheck?: boolean) => {
    if (!skipApiCheck && !FOOD_API_URL) {
      Alert.alert('Craving rescue', 'Set EXPO_PUBLIC_FOOD_API_URL to use smart tools.');
      return;
    }
    const remainingCalories =
      settings.dailyCalorieGoal > 0
        ? Math.max(0, settings.dailyCalorieGoal - todayCalories)
        : null;
    const minutesLeft =
      activeSession && expectedEnd ? Math.max(0, Math.round((expectedEnd - now) / 60000)) : null;
    const fastingDurationMinutes = activeSession
      ? Math.max(0, Math.round(activeDuration / 60000))
      : null;
    setRescueResult(null);
    setRescueBusy(true);
    try {
      const response = await fetch(`${FOOD_API_URL}/v1/craving/rescue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(FOOD_API_KEY ? { 'X-API-KEY': FOOD_API_KEY } : {}),
        },
        body: JSON.stringify({
          isFasting: Boolean(activeSession),
          minutesLeft,
          fastingDurationMinutes,
          streakDays,
          remainingCalories,
          unitSystem: settings.unitSystem,
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || 'Rescue failed.');
      }
      const data = (await response.json()) as CravingRescueResult;
      setRescueResult(data);
    } catch (error) {
      Alert.alert('Craving rescue failed', String(error));
    } finally {
      setRescueBusy(false);
    }
  };

  const clearRescue = () => {
    setRescueResult(null);
  };

  const openRescue = () => {
    if (!FOOD_API_URL) {
      Alert.alert('Craving rescue', 'Set EXPO_PUBLIC_FOOD_API_URL to use smart tools.');
      return;
    }
    setRescueVisible(true);
    requestRescue(true);
  };

  const getCalorieHelperEstimate = () => {
    const age = Number(helperAge);
    const height = Number(helperHeight);
    const weight = Number(helperWeight);
    if (
      !Number.isFinite(age) ||
      !Number.isFinite(height) ||
      !Number.isFinite(weight) ||
      age <= 0 ||
      height <= 0 ||
      weight <= 0
    ) {
      return null;
    }
    const base =
      helperSex === 'male'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;
    const activityFactor =
      ACTIVITY_LEVELS.find((level) => level.key === helperActivity)?.factor ?? 1.2;
    const goalAdjustment =
      CALORIE_GOALS.find((goal) => goal.key === helperGoal)?.adjustment ?? 0;
    const estimate = Math.round(base * activityFactor + goalAdjustment);
    return estimate > 0 ? estimate : null;
  };

  const applyCalorieHelper = () => {
    const estimate = getCalorieHelperEstimate();
    if (!estimate) {
      Alert.alert('Calorie helper', 'Add your age, height, and weight to get a goal.');
      return;
    }
    updateSetting('dailyCalorieGoal', estimate);
    setCalorieHelperVisible(false);
  };

  const requestGoalTuning = async () => {
    if (!FOOD_API_URL) {
      Alert.alert('Goal tuning', 'Set EXPO_PUBLIC_FOOD_API_URL to use smart tools.');
      return;
    }
    if (sessions.length < 3) {
      Alert.alert('Goal tuning', 'Log a few fasts first to generate a recommendation.');
      return;
    }
    setGoalTuningResult(null);
    setGoalTuningBusy(true);
    try {
      const response = await fetch(`${FOOD_API_URL}/v1/goal/tuning`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(FOOD_API_KEY ? { 'X-API-KEY': FOOD_API_KEY } : {}),
        },
        body: JSON.stringify({
          currentProtocol: protocol.key === 'custom' ? '16:8' : protocol.key,
          adherencePct,
          avgFastingHours: Number((avgWeekMs / 3600000).toFixed(1)),
          longestWeekHours: Number((longestWeekMs / 3600000).toFixed(1)),
          sessionsCount: sessions.length,
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || 'Goal tuning failed.');
      }
      const data = (await response.json()) as GoalTuningResult;
      setGoalTuningResult(data);
    } catch (error) {
      Alert.alert('Goal tuning failed', String(error));
    } finally {
      setGoalTuningBusy(false);
    }
  };

  const updateScanItemCalories = (index: number, value: string) => {
    if (!scanItems) return;
    const next = [...scanItems];
    const parsed = Number(value);
    next[index] = {
      ...next[index],
      calories: Number.isFinite(parsed) ? parsed : null,
    };
    setScanItems(next);
    const total = next.reduce((sum, item) => sum + (item.calories ?? 0), 0);
    setScanTotalCalories(total);
  };

  const recalcScanCalories = async () => {
    if (!FOOD_API_URL) {
      Alert.alert('Photo scan', 'Set EXPO_PUBLIC_FOOD_API_URL to use smart tools.');
      return;
    }
    if (!scanItems || scanItems.length === 0) return;
    setScanRecalcBusy(true);
    try {
      const response = await fetch(`${FOOD_API_URL}/v1/food/recalculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(FOOD_API_KEY ? { 'X-API-KEY': FOOD_API_KEY } : {}),
        },
        body: JSON.stringify({ items: scanItems }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || 'Refresh failed.');
      }
      const data = (await response.json()) as FoodEstimateResult;
      setScanItems((prev) =>
        Array.isArray(data.items) && data.items.length > 0 ? data.items : prev
      );
      setScanTotalCalories((prev) =>
        Array.isArray(data.items) && data.items.length > 0
          ? data.totalCalories ?? 0
          : prev ?? 0
      );
    } catch (error) {
      Alert.alert('Refresh failed', String(error));
    } finally {
      setScanRecalcBusy(false);
    }
  };

  const updateScanItemName = (index: number, value: string) => {
    if (!scanItems) return;
    const next = [...scanItems];
    next[index] = {
      ...next[index],
      name: value,
    };
    setScanItems(next);
  };

  const updateScanItemPortion = (index: number, value: string) => {
    if (!scanItems) return;
    const next = [...scanItems];
    next[index] = {
      ...next[index],
      portion: value,
    };
    setScanItems(next);
  };

  const updateScanItemCount = (index: number, value: string) => {
    if (!scanItems) return;
    const next = [...scanItems];
    const trimmed = value.trim();
    const parsed = trimmed.length > 0 ? Number(trimmed) : null;
    next[index] = {
      ...next[index],
      count:
        parsed !== null && Number.isFinite(parsed) && parsed > 0
          ? Math.round(parsed)
          : null,
    };
    setScanItems(next);
  };

  const addPhotoNoteSmart = async () => {
    await addPhotoNote(true, 'smart');
  };

  const removeScanItem = (index: number) => {
    if (!scanItems) return;
    const next = scanItems.filter((_, itemIndex) => itemIndex !== index);
    const finalItems =
      next.length > 0 ? next : [{ name: '', portion: '', calories: null, count: null }];
    setScanItems(finalItems);
    const total = finalItems.reduce((sum, item) => sum + (item.calories ?? 0), 0);
    setScanTotalCalories(total);
  };

  const saveScanResult = async () => {
    if (!scanItems) return;
    const summary = scanItems.length
      ? `Photo: ${scanItems.map((item) => item.name).join(', ')}`
      : 'Photo log';
    await run(
      'INSERT INTO eating_notes (timestamp, text, calories, thumbnail_path, meta_json) VALUES (?, ?, ?, ?, ?);',
      [Date.now(), summary, scanTotalCalories, scanThumbPath, JSON.stringify(scanItems)]
    );
    setScanItems(null);
    setScanThumbPath(null);
    setScanTotalCalories(null);
    setScanVisible(false);
    await refreshData();
  };

  const closeScanModal = () => {
    setScanItems(null);
    setScanThumbPath(null);
    setScanTotalCalories(null);
    setScanVisible(false);
  };

  const protocol = getProtocolDetails(settings);
  const activeDuration = activeSession ? now - activeSession.start_time : 0;
  const expectedEnd =
    activeSession &&
    (activeSession.end_time ??
      activeSession.start_time + protocol.fastingHours * 3600 * 1000);

  const weekStart = startOfWeek(new Date(now));
  const weekStartMs = weekStart.getTime();
  const weekSessions = sessions.filter((session) => {
    const endTs = session.end_time ?? now;
    return endTs >= weekStartMs;
  });

  const weeklyDurations = weekSessions.map((session) => {
    const endTs = session.end_time ?? now;
    return Math.max(0, endTs - session.start_time);
  });

  const totalWeekMs = weeklyDurations.reduce((sum, ms) => sum + ms, 0);
  const avgWeekMs = weeklyDurations.length > 0 ? totalWeekMs / weeklyDurations.length : 0;
  const longestWeekMs = weeklyDurations.length > 0 ? Math.max(...weeklyDurations) : 0;
  const adherencePct =
    protocol.fastingHours > 0 && avgWeekMs > 0
      ? Math.min(
          100,
          Math.round((avgWeekMs / (protocol.fastingHours * 3600 * 1000)) * 100)
        )
      : 0;

  const dailyTotals = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    const total = weekSessions.reduce((sum, session) => {
      const start = session.start_time;
      const end = session.end_time ?? now;
      if (end < dayStart.getTime() || start > dayEnd.getTime()) return sum;
      const clipStart = Math.max(start, dayStart.getTime());
      const clipEnd = Math.min(end, dayEnd.getTime());
      return sum + Math.max(0, clipEnd - clipStart);
    }, 0);
    return {
      label: day.toLocaleDateString([], { weekday: 'short' }),
      totalMs: total,
    };
  });
  const maxDailyMs = Math.max(...dailyTotals.map((day) => day.totalMs), 1);

  const todayCalories = notes.reduce((sum, note) => {
    const noteDate = new Date(note.timestamp);
    const isToday = noteDate.toDateString() === new Date(now).toDateString();
    return isToday ? sum + (note.calories ?? 0) : sum;
  }, 0);

  const todayKey = new Date(now).toDateString();
  const streakDays = (() => {
    if (sessions.length === 0 && !activeSession) return 0;
    const daySet = new Set<string>();
    sessions.forEach((session) => {
      daySet.add(getDateKey(session.start_time));
      if (session.end_time) {
        daySet.add(getDateKey(session.end_time));
      }
    });
    if (activeSession) {
      daySet.add(getDateKey(now));
    }
    let count = 0;
    for (let offset = 0; offset < 3650; offset += 1) {
      const date = new Date(now);
      date.setDate(date.getDate() - offset);
      const key = getDateKey(date.getTime());
      if (!daySet.has(key)) break;
      count += 1;
    }
    return count;
  })();

  const completedSessions = sessions
    .filter((session) => session.end_time !== null)
    .sort((a, b) => (b.end_time ?? 0) - (a.end_time ?? 0));
  const lastCompleted = completedSessions[0] ?? null;
  const currentWindowStart = lastCompleted?.end_time ?? null;
  const currentWindowEnd = activeSession
    ? activeSession.start_time
    : now;

  const currentWindowNotes =
    currentWindowStart !== null
      ? notes.filter(
          (note) =>
            note.timestamp >= currentWindowStart &&
            note.timestamp <= currentWindowEnd
        )
      : [];
  const currentWindowCalories = currentWindowNotes.reduce(
    (sum, note) => sum + (note.calories ?? 0),
    0
  );

  const eatingWindowElapsedMs =
    currentWindowStart !== null ? now - currentWindowStart : 0;
  const eatingWindowTotalMs =
    currentWindowStart !== null
      ? protocol.eatingHours * 3600 * 1000
      : null;
  const eatingWindowRemainingMs =
    !activeSession && eatingWindowTotalMs !== null
      ? eatingWindowTotalMs - eatingWindowElapsedMs
      : null;
  const currentWindowLabel =
    currentWindowStart === null
      ? 'No window yet'
      : activeSession
        ? 'Last eating window'
        : 'Eating window';

  const sessionsAsc = [...sessions]
    .filter((session) => session.end_time !== null)
    .sort((a, b) => a.start_time - b.start_time);
  const eatingWindowsHistory = sessionsAsc
    .map((session, index) => {
      const nextSession = sessionsAsc[index + 1];
      const windowStart = session.end_time as number;
      const windowEnd = nextSession
        ? nextSession.start_time
        : activeSession
          ? activeSession.start_time
          : null;
      if (!windowEnd) return null;
      if (currentWindowStart === windowStart && currentWindowEnd === windowEnd) {
        return null;
      }
        const windowNotes = notes
          .filter((note) => note.timestamp >= windowStart && note.timestamp <= windowEnd)
          .sort((a, b) => a.timestamp - b.timestamp);
        return {
          start: windowStart,
          end: windowEnd,
          totalCalories: windowNotes.reduce(
            (sum, note) => sum + (note.calories ?? 0),
            0
          ),
          noteCount: windowNotes.length,
          notes: windowNotes,
        };
      })
      .filter(
        (window): window is {
          start: number;
          end: number;
          totalCalories: number;
          noteCount: number;
          notes: EatingNote[];
        } => !!window
      )
    .slice(-6)
    .reverse();

  const dailyCaloriesTotals = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    const total = notes.reduce((sum, note) => {
      const ts = note.timestamp;
      if (ts < dayStart.getTime() || ts > dayEnd.getTime()) return sum;
      return sum + (note.calories ?? 0);
    }, 0);
    return {
      label: day.toLocaleDateString([], { weekday: 'short' }),
      totalCalories: total,
    };
  });
  const maxDailyCalories = Math.max(
    ...dailyCaloriesTotals.map((day) => day.totalCalories),
    1
  );

  const updateSetting = async <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => {
    const next = { ...settings, [key]: value };
    let showIntro = false;
    if (key === 'remindersEnabled' && value === true && !settings.remindersIntroShown) {
      next.remindersIntroShown = true;
      showIntro = true;
    }
    setSettings(next);
    await persistSetting(key, value);
    if (showIntro) {
      await persistSetting('remindersIntroShown', true);
      Alert.alert(
        'Reminders enabled',
        'Night reminders are off by default. Enable them in Settings if you want overnight notifications.'
      );
    }
  };

  const applyGoalTuning = () => {
    if (!goalTuningResult) return;
    const allowed = PROTOCOLS.map((item) => item.key);
    const recommended = goalTuningResult.recommendedProtocol;
    if (!allowed.includes(recommended)) {
      Alert.alert('Goal tuning', 'Recommended protocol is not supported.');
      return;
    }
    updateSetting('protocolKey', recommended);
    setGoalTuningResult(null);
    Alert.alert('Goal tuning', 'Recommended window applied.');
  };

  const nextFastStartMs =
    lastCompleted?.end_time && !activeSession
      ? lastCompleted.end_time + protocol.eatingHours * 3600 * 1000
      : null;
  const nextFastStartLabel = nextFastStartMs ? formatTime(nextFastStartMs) : null;

  const hydrationDuringFasting =
    settings.hydrationMode === 'fasting' || settings.hydrationMode === 'both';
  const hydrationDuringEating =
    settings.hydrationMode === 'eating' || settings.hydrationMode === 'both';
  const hydrationActive =
    settings.hydrationEnabled &&
    ((activeSession && hydrationDuringFasting) ||
      (!activeSession && hydrationDuringEating && currentWindowStart !== null));
  const nextHydrationMs = hydrationActive
    ? now + settings.hydrationIntervalHours * 3600 * 1000
    : null;
  const nextHydrationLabel = nextHydrationMs ? formatTime(nextHydrationMs) : 'None';

  const nextReminderLabel = activeSession
    ? expectedEnd
      ? formatTime(expectedEnd)
      : 'Not scheduled'
    : nextFastStartLabel ?? (settings.dailyCalorieGoal > 0 ? 'Calorie goal near' : 'None');

  const screenProps: ScreenProps = {
    theme,
    now,
    protocolLabel: protocol.label,
    activeSession,
    isFasting: Boolean(activeSession),
    activeDuration,
    expectedEnd,
    avgWeekMs,
    longestWeekMs,
    adherencePct,
    totalWeekMs,
    dailyTotals,
    maxDailyMs,
    dailyCaloriesTotals,
    maxDailyCalories,
    todayCalories,
    dailyCalorieGoal: settings.dailyCalorieGoal,
    eatingWindowElapsedMs,
    eatingWindowRemainingMs,
    eatingWindowTotalMs,
    currentWindowLabel,
    currentWindowCalories,
    currentWindowNotes,
    eatingWindowsHistory,
    nextReminderLabel,
    nextHydrationLabel,
    notes,
    sessions,
    settings,
    onStartFast: startFast,
    onStopFast: stopFast,
    onOpenEdit: openEdit,
    onAddNote: addNote,
    noteText,
    noteCalories,
    setNoteText,
    setNoteCalories,
    ifEatText,
    setIfEatText,
    ifEatResult,
    ifEatBusy,
    onEstimateFood: estimateFood,
    onClearFoodEstimate: clearFoodEstimate,
    portionText,
    setPortionText,
    portionTarget,
    setPortionTarget,
    portionResult,
    portionBusy,
    onPortionCoach: requestPortionCoach,
    onClearPortionCoach: clearPortionCoach,
    fridgeLimit,
    setFridgeLimit,
    fridgeIdeas,
    fridgeBusy,
    onScanFridge: scanFridgeIdeas,
    onClearFridgeIdeas: clearFridgeIdeas,
    pantryItems,
    onSaveFridgeIdea: saveFridgeIdea,
    pantryPickerVisible,
    onOpenPantryPicker: () => setPantryPickerVisible(true),
    onClosePantryPicker: () => setPantryPickerVisible(false),
    goalTuningResult,
    goalTuningBusy,
    onRequestGoalTuning: requestGoalTuning,
    onApplyGoalTuning: applyGoalTuning,
    onUpdateSetting: updateSetting,
    notificationStatus,
    onRequestNotificationPermissions: requestNotificationPermissions,
    onSendTestReminder: sendTestReminder,
    onScanFoodPhoto: addPhotoNote,
    onScanFoodPhotoSmart: addPhotoNoteSmart,
    scanBusy,
    scanStatus,
    onDeleteNote: deleteNote,
    onOpenEditNote: openEditNote,
    onOpenCalorieHelper: () => setCalorieHelperVisible(true),
    onClearHistory: clearAllHistory,
    autopilotResult,
    autopilotBusy,
    onRequestAutopilot: requestAutopilot,
    onClearAutopilot: clearAutopilot,
    onUpdateAutopilotItem: updateAutopilotItem,
    onRemoveAutopilotItem: removeAutopilotItem,
    onOpenAutopilotTimePicker: openAutopilotTimePicker,
    onAddAutopilotItemFromPantry: addAutopilotItemFromPantry,
    rescueResult,
    rescueBusy,
    onRequestRescue: requestRescue,
    onClearRescue: clearRescue,
    onOpenRescue: openRescue,
    plan,
    planWeeks,
    planCheckins,
    planUpdates,
    planBuilderVisible,
    planGoalMode,
    setPlanGoalMode,
    planPace,
    setPlanPace,
    planStartProtocol,
    setPlanStartProtocol,
    planRampWeeks,
    setPlanRampWeeks,
    planMinEatingHours,
    setPlanMinEatingHours,
    planBusy,
    onOpenPlanBuilder: openPlanBuilder,
    onClosePlanBuilder: () => setPlanBuilderVisible(false),
    onCreatePlan: createAdaptivePlan,
    checkinAdherence,
    setCheckinAdherence,
    checkinEnergy,
    setCheckinEnergy,
    checkinHunger,
    setCheckinHunger,
    checkinSuggestion,
    onSavePlanCheckin: savePlanCheckin,
    onApplyPlanSuggestion: applyPlanSuggestion,
    onTogglePlanStatus: togglePlanStatus,
    planHistory,
    onActivatePlan: activatePlan,
    onDeactivatePlan: deactivatePlan,
    onClearPlan: clearPlan,
  };

  if (!ready || !fontsLoaded) {
    return (
      <ScreenShell theme={theme}>
        <View style={styles.loading}>
          <Text style={[styles.title, { color: theme.text }]}>Fasting Lane</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>Preparing your space</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <>
      <NavigationContainer
        theme={{
          ...DefaultTheme,
          dark: theme.mode === 'dark',
          colors: {
            ...DefaultTheme.colors,
            primary: theme.accent,
            background: theme.bg,
            card: theme.card,
            text: theme.text,
            border: theme.border,
            notification: theme.accent,
          },
        }}
      >
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarStyle: {
              backgroundColor: theme.card,
              borderTopColor: theme.border,
              borderTopWidth: 1,
              height: 64,
              paddingBottom: 8,
              paddingTop: 6,
              shadowColor: theme.shadow,
              shadowOpacity: 0.12,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: -2 },
              elevation: 12,
            },
            tabBarActiveTintColor: theme.accent,
            tabBarInactiveTintColor: theme.muted,
            tabBarLabelStyle: {
              fontFamily: 'Manrope_600SemiBold',
              fontSize: 11,
              letterSpacing: 0.2,
            },
            tabBarIcon: ({ color, size }) => {
              const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
                Home: 'timer-outline',
                Insights: 'stats-chart-outline',
                Eating: 'restaurant-outline',
                Smart: 'sparkles-outline',
                Plan: 'map-outline',
                Settings: 'settings-outline',
              };
              return <Ionicons name={icons[route.name] ?? 'ellipse'} size={size} color={color} />;
            },
          })}
        >
          <Tab.Screen name="Home">{() => <HomeScreen {...screenProps} />}</Tab.Screen>
          <Tab.Screen name="Eating">{() => <EatingScreen {...screenProps} />}</Tab.Screen>
          <Tab.Screen name="Plan">{() => <PlanScreen {...screenProps} />}</Tab.Screen>
          <Tab.Screen name="Smart">{() => <SmartToolsScreen {...screenProps} />}</Tab.Screen>
          <Tab.Screen name="Insights">
            {() => <InsightsHistoryScreen {...screenProps} />}
          </Tab.Screen>
          <Tab.Screen name="Settings">{() => <SettingsScreen {...screenProps} />}</Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>

      <Modal visible={!!editSession} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, getCardStyle(theme)]}> 
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Adjust fast</Text>
            <Pressable
              style={[styles.secondaryButton, { borderColor: theme.border }]}
              onPress={() => {
                setShowStartPicker(true);
                setShowEndPicker(false);
              }}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}> 
                Start:{' '}
                {editStart ? `${formatDate(editStart.getTime())} ${formatTime(editStart.getTime())}` : '--'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, { borderColor: theme.border }]}
              onPress={() => {
                setShowEndPicker(true);
                setShowStartPicker(false);
              }}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}> 
                End:{' '}
                {editEnd ? `${formatDate(editEnd.getTime())} ${formatTime(editEnd.getTime())}` : 'Active'}
              </Text>
            </Pressable>
            {Platform.OS === 'ios' && showStartPicker && editStart ? (
              <DateTimePicker
                value={editStart}
                mode="datetime"
                display="inline"
                onChange={(_, date) => {
                  if (date) setEditStart(date);
                }}
              />
            ) : null}
            {Platform.OS === 'ios' && showEndPicker ? (
              <DateTimePicker
                value={editEnd ?? new Date()}
                mode="datetime"
                display="inline"
                onChange={(_, date) => {
                  if (date) setEditEnd(date);
                }}
              />
            ) : null}
            <View style={styles.row}>
              <Pressable
                style={[
                  styles.primaryButton,
                  { backgroundColor: theme.accent, shadowColor: theme.shadow },
                ]}
                onPress={saveEdit}
              >
                <Text style={styles.primaryButtonText}>Save</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, { borderColor: theme.border }]}
                onPress={() => setEditSession(null)}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {Platform.OS !== 'ios' && showStartPicker && editStart ? (
        <DateTimePicker
          value={editStart}
          mode="datetime"
          display="default"
          onChange={(_, date) => {
            setShowStartPicker(false);
            if (date) setEditStart(date);
          }}
        />
      ) : null}
      {Platform.OS !== 'ios' && showEndPicker ? (
        <DateTimePicker
          value={editEnd ?? new Date()}
          mode="datetime"
          display="default"
          onChange={(_, date) => {
            setShowEndPicker(false);
            if (date) setEditEnd(date);
          }}
        />
      ) : null}
      {autopilotTimePicker ? (
        <DateTimePicker
          value={autopilotTimePicker.value}
          mode="time"
          display="default"
          onChange={(_, date) => {
            if (date) {
              applyAutopilotTime(autopilotTimePicker.itemId, date);
            }
            setAutopilotTimePicker(null);
          }}
        />
      ) : null}

      <Modal visible={scanVisible} animationType="slide" transparent>
        <Pressable style={styles.modalBackdrop} onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            style={styles.modalAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <Pressable style={[styles.modalContent, getCardStyle(theme)]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Review photo estimate
            </Text>
            {scanThumbPath ? (
              <Image source={{ uri: scanThumbPath }} style={styles.scanThumb} />
            ) : null}
            <ScrollView style={styles.scanList} keyboardShouldPersistTaps="handled">
                {scanItems?.map((item, index) => {
                  const isUnrecognized =
                    item.calories === null ||
                    item.calories === undefined ||
                    (item.calories === 0 && !item.sourceName);
                  return (
                  <View key={`scan-item-${index}`} style={styles.scanRow}>
                    <View style={styles.scanNameRow}>
                      <TextInput
                        style={[
                          styles.scanInput,
                          styles.scanInputFlex,
                          { color: theme.text, borderColor: theme.border },
                        ]}
                        value={item.name ?? ''}
                        onChangeText={(value) => updateScanItemName(index, value)}
                        placeholder="Food name"
                        placeholderTextColor={theme.muted}
                      />
                      <Pressable
                        style={[styles.iconButton, { borderColor: theme.border }]}
                        onPress={() => removeScanItem(index)}
                      >
                        <Ionicons name="trash-outline" size={16} color={theme.muted} />
                      </Pressable>
                    </View>
                    <View style={styles.scanFieldRow}>
                      <TextInput
                        style={[
                          styles.scanInput,
                          styles.scanInputFlex,
                          { color: theme.text, borderColor: theme.border },
                        ]}
                        value={item.portion ?? ''}
                        onChangeText={(value) => updateScanItemPortion(index, value)}
                        placeholder={
                          settings.unitSystem === 'imperial'
                            ? 'Portion (e.g., 5 oz)'
                            : 'Portion (e.g., 150 g)'
                        }
                        placeholderTextColor={theme.muted}
                      />
                      <TextInput
                        style={[
                          styles.scanInput,
                          styles.scanCountInput,
                          { color: theme.text, borderColor: theme.border },
                        ]}
                        value={item.count !== null && item.count !== undefined ? String(item.count) : ''}
                        onChangeText={(value) => updateScanItemCount(index, value)}
                        placeholder="Count"
                        placeholderTextColor={theme.muted}
                        keyboardType="numeric"
                      />
                      <TextInput
                        style={[
                          styles.scanInput,
                          styles.scanCountInput,
                          { color: theme.text, borderColor: theme.border },
                        ]}
                        value={
                          isUnrecognized
                            ? ''
                            : item.calories !== null && item.calories !== undefined
                              ? String(item.calories)
                              : ''
                        }
                        onChangeText={(value) => updateScanItemCalories(index, value)}
                        keyboardType="numeric"
                        placeholder="kcal"
                        placeholderTextColor={theme.muted}
                      />
                    </View>
                    {isUnrecognized ? (
                      <Text style={[styles.warningText, { color: theme.muted }]}>
                        Not recognized. Enter a name and kcal, or refresh calories.
                      </Text>
                    ) : null}
                  </View>
                  );
                })}
              </ScrollView>
              <Text style={[styles.meta, { color: theme.muted }]}>
                Edit names, portions, or counts, then refresh calories.
              </Text>
              <View style={styles.inlineRow}>
                <Text style={[styles.meta, { color: theme.muted }]}>
                  Total: {scanTotalCalories ?? 0} kcal
                </Text>
                <Pressable
                  style={[
                    styles.ghostButton,
                    { borderColor: theme.border, opacity: scanRecalcBusy ? 0.6 : 1 },
                  ]}
                  onPress={recalcScanCalories}
                  disabled={scanRecalcBusy}
                >
                  <Text style={[styles.ghostButtonText, { color: theme.text }]}>
                    {scanRecalcBusy ? 'Updating...' : 'Refresh calories'}
                  </Text>
                </Pressable>
              </View>
            <View style={styles.row}>
              {scanMode === 'smart' ? (
                <Pressable
                  style={[
                    styles.primaryButton,
                    { backgroundColor: theme.accent, shadowColor: theme.shadow },
                  ]}
                  onPress={closeScanModal}
                >
                  <Text style={styles.primaryButtonText}>OK</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    style={[
                      styles.primaryButton,
                      { backgroundColor: theme.accent, shadowColor: theme.shadow },
                    ]}
                    onPress={saveScanResult}
                  >
                    <Text style={styles.primaryButtonText}>Save</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.secondaryButton, { borderColor: theme.border }]}
                    onPress={closeScanModal}
                  >
                    <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                      Cancel
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <Modal visible={editNoteVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, getCardStyle(theme)]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Edit note
            </Text>
              <TextInput
                style={[styles.input, styles.inputTall, { color: theme.text, borderColor: theme.border }]}
                value={editNoteText}
                onChangeText={setEditNoteText}
                placeholder="Note"
                placeholderTextColor={theme.muted}
              />
            <TextInput
              style={[styles.calorieInput, { color: theme.text, borderColor: theme.border }]}
              value={editNoteCalories}
              onChangeText={setEditNoteCalories}
              keyboardType="numeric"
              placeholder="kcal"
              placeholderTextColor={theme.muted}
            />
            <View style={styles.row}>
              <Pressable
                style={[
                  styles.primaryButton,
                  { backgroundColor: theme.accent, shadowColor: theme.shadow },
                ]}
                onPress={saveEditNote}
              >
                <Text style={styles.primaryButtonText}>Save</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, { borderColor: theme.border }]}
                onPress={() => setEditNoteVisible(false)}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={rescueVisible} animationType="slide" transparent>
        <Pressable style={styles.modalBackdrop} onPress={() => setRescueVisible(false)}>
          <Pressable style={[styles.modalContent, getCardStyle(theme)]} onPress={() => {}}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Craving rescue
            </Text>
            {rescueBusy ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color={theme.accent} />
                <Text style={[styles.meta, { color: theme.muted }]}>Pulling your plan...</Text>
              </View>
            ) : rescueResult ? (
              <View style={styles.smartResult}>
                <Text style={[styles.metaStrong, { color: theme.text }]}>
                  {rescueResult.quickTip}
                </Text>
                {rescueResult.steps.map((step, index) => (
                  <Text key={`${step}-${index}`} style={[styles.meta, { color: theme.muted }]}>
                    - {step}
                  </Text>
                ))}
                {rescueResult.snackIdeas && rescueResult.snackIdeas.length > 0 ? (
                  <Text style={[styles.meta, { color: theme.muted }]}>
                    Snack ideas: {rescueResult.snackIdeas.join(', ')}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={[styles.meta, { color: theme.muted }]}>
                Tap again if you want another rescue plan.
              </Text>
            )}
            <View style={styles.row}>
              <Pressable
                style={[styles.secondaryButton, { borderColor: theme.border }]}
                onPress={() => setRescueVisible(false)}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={calorieHelperVisible} animationType="slide" transparent>
        <Pressable style={styles.modalBackdrop} onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            style={styles.modalAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <Pressable style={[styles.modalContent, getCardStyle(theme)]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Calorie helper
              </Text>
              <Text style={[styles.meta, { color: theme.muted }]}>
                Uses metric units (kg and cm) to estimate a daily goal.
              </Text>

              <View style={styles.timingBlock}>
                <Text style={[styles.meta, { color: theme.muted }]}>Sex</Text>
                <View style={styles.pillRow}>
                  {(['female', 'male'] as const).map((option) => (
                    <Pressable
                      key={option}
                      style={[
                        styles.pill,
                        {
                          backgroundColor: helperSex === option ? theme.accent : theme.bg,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={() => setHelperSex(option)}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          { color: helperSex === option ? '#111' : theme.text },
                        ]}
                      >
                        {option === 'female' ? 'Female' : 'Male'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.noteRow}>
                <Text style={[styles.meta, { color: theme.muted }]}>Age</Text>
                <TextInput
                  style={[styles.calorieInput, { color: theme.text, borderColor: theme.border }]}
                  value={helperAge}
                  onChangeText={setHelperAge}
                  keyboardType="numeric"
                  placeholder="Years"
                  placeholderTextColor={theme.muted}
                />
              </View>
              <View style={styles.noteRow}>
                <Text style={[styles.meta, { color: theme.muted }]}>Height</Text>
                <TextInput
                  style={[styles.calorieInput, { color: theme.text, borderColor: theme.border }]}
                  value={helperHeight}
                  onChangeText={setHelperHeight}
                  keyboardType="numeric"
                  placeholder="cm"
                  placeholderTextColor={theme.muted}
                />
              </View>
              <View style={styles.noteRow}>
                <Text style={[styles.meta, { color: theme.muted }]}>Weight</Text>
                <TextInput
                  style={[styles.calorieInput, { color: theme.text, borderColor: theme.border }]}
                  value={helperWeight}
                  onChangeText={setHelperWeight}
                  keyboardType="numeric"
                  placeholder="kg"
                  placeholderTextColor={theme.muted}
                />
              </View>

              <View style={styles.timingBlock}>
                <Text style={[styles.meta, { color: theme.muted }]}>Activity</Text>
                <View style={styles.pillRow}>
                  {ACTIVITY_LEVELS.map((level) => (
                    <Pressable
                      key={level.key}
                      style={[
                        styles.pill,
                        {
                          backgroundColor: helperActivity === level.key ? theme.accent : theme.bg,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={() => setHelperActivity(level.key)}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          { color: helperActivity === level.key ? '#111' : theme.text },
                        ]}
                      >
                        {level.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.timingBlock}>
                <Text style={[styles.meta, { color: theme.muted }]}>Goal</Text>
                <View style={styles.pillRow}>
                  {CALORIE_GOALS.map((goal) => (
                    <Pressable
                      key={goal.key}
                      style={[
                        styles.pill,
                        {
                          backgroundColor: helperGoal === goal.key ? theme.accent : theme.bg,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={() => setHelperGoal(goal.key)}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          { color: helperGoal === goal.key ? '#111' : theme.text },
                        ]}
                      >
                        {goal.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Text style={[styles.meta, { color: theme.muted }]}>
                Suggested goal:{' '}
                {getCalorieHelperEstimate()
                  ? `${getCalorieHelperEstimate()} kcal/day`
                  : 'Enter your details'}
              </Text>

              <View style={styles.row}>
                <Pressable
                  style={[
                    styles.primaryButton,
                    { backgroundColor: theme.accent, shadowColor: theme.shadow },
                  ]}
                  onPress={applyCalorieHelper}
                >
                  <Text style={styles.primaryButtonText}>Apply goal</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryButton, { borderColor: theme.border }]}
                  onPress={() => setCalorieHelperVisible(false)}
                >
                  <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scroll: {
    padding: 22,
    paddingBottom: 80,
  },
  header: {
    marginBottom: 16,
  },
  headerRow: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    alignItems: 'center',
    width: '100%',
  },
  headerTitle: {
    textAlign: 'center',
  },
  headerSubtitle: {
    textAlign: 'center',
  },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  logoImage: {
    width: 22,
    height: 22,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Manrope_700Bold',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    fontFamily: 'Manrope_500Medium',
  },
  card: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  sectionTitle: {
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
    fontFamily: 'Manrope_600SemiBold',
    lineHeight: 16,
    includeFontPadding: false,
  },
  sectionTitleCompact: {
    marginBottom: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  sectionHeaderLeft: {
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  segmentedButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  segmentedText: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
  },
  timer: {
    fontSize: 36,
    fontFamily: 'Manrope_700Bold',
    marginBottom: 6,
  },
  meta: {
    fontSize: 13,
    marginTop: 6,
    fontFamily: 'Manrope_500Medium',
  },
  metaStrong: {
    fontFamily: 'Manrope_700Bold',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  buttonSpacing: {
    marginTop: 12,
  },
  primaryButton: {
    paddingVertical: 0,
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryButtonText: {
    color: '#111',
    fontFamily: 'Manrope_700Bold',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    paddingVertical: 0,
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: 'Manrope_600SemiBold',
  },
  sectionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  metricLabel: {
    fontSize: 12,
    marginBottom: 6,
    fontFamily: 'Manrope_500Medium',
  },
  metricValue: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 16,
    marginBottom: 12,
  },
  chartWrap: {
    marginTop: 16,
    marginBottom: 12,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    position: 'relative',
  },
  chartOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  chartCol: {
    alignItems: 'center',
    flex: 1,
  },
  chartLabels: {
    flexDirection: 'row',
    marginTop: 6,
  },
  chartLabelCol: {
    flex: 1,
    alignItems: 'center',
  },
  chartBar: {
    width: 12,
    borderRadius: 6,
    marginBottom: 6,
  },
  chartLabel: {
    fontSize: 11,
    fontFamily: 'Manrope_500Medium',
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  ringCenter: {
    position: 'absolute',
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
  },
  scanThumb: {
    width: 96,
    height: 96,
    borderRadius: 16,
    marginBottom: 12,
    alignSelf: 'center',
  },
  scanList: {
    maxHeight: 240,
    marginBottom: 8,
  },
  scanRow: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 10,
  },
  scanNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scanFieldRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scanInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 44,
    fontFamily: 'Manrope_500Medium',
    marginBottom: 6,
  },
  scanInputFlex: {
    flex: 1,
  },
  scanCountInput: {
    width: 72,
    textAlign: 'center',
  },
  warningText: {
    fontSize: 11,
    marginTop: 4,
    fontFamily: 'Manrope_500Medium',
  },
  microLabel: {
    fontSize: 10,
    marginTop: 4,
    fontFamily: 'Manrope_500Medium',
  },
  noteRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginTop: 10,
    flexWrap: 'wrap',
  },
  planWeekRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 4,
  },
  planWeekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 8,
  },
  fastMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  planStatusCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    gap: 6,
  },
  planActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  planDayDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  planUpdateRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 6,
  },
  emojiRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 6,
  },
  emojiButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiLabel: {
    fontSize: 18,
  },
  goalBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    gap: 8,
  },
  goalActionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  smartBlock: {
    marginTop: 12,
  },
  smartDivider: {
    height: 1,
    marginVertical: 12,
    opacity: 0.6,
  },
  smartResult: {
    marginTop: 10,
    gap: 4,
  },
  smartMeal: {
    marginTop: 8,
    gap: 2,
  },
  autopilotItem: {
    marginTop: 10,
    gap: 8,
  },
  autopilotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  autopilotInput: {
    flex: 1,
    minWidth: 140,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 44,
    fontFamily: 'Manrope_500Medium',
  },
  autopilotCalorieInput: {
    width: 80,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 10,
    minHeight: 44,
    textAlign: 'center',
    fontFamily: 'Manrope_600SemiBold',
  },
  autopilotIngredients: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 48,
    fontFamily: 'Manrope_500Medium',
  },
  timePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePillText: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
  },
  pantryList: {
    maxHeight: 320,
    marginTop: 12,
    marginBottom: 12,
  },
  pantryRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  pantryText: {
    flex: 1,
    gap: 2,
  },
  goalResult: {
    marginTop: 10,
    gap: 6,
  },
  timingBlock: {
    marginTop: 10,
  },
  disabledRow: {
    opacity: 0.5,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 140,
    fontFamily: 'Manrope_500Medium',
  },
  inputTall: {
    minHeight: 48,
    paddingVertical: 12,
  },
  calorieInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 70,
    textAlign: 'center',
    fontFamily: 'Manrope_600SemiBold',
  },
  noteItem: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  noteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  ghostButton: {
    paddingVertical: 0,
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  ghostButtonText: {
    fontSize: 13,
    fontFamily: 'Manrope_600SemiBold',
  },
  tinyButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  tinyButtonText: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
  },
  noteContent: {
    flex: 1,
  },
  noteActions: {
    gap: 8,
  },
  noteThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginBottom: 8,
  },
  iconButton: {
    borderWidth: 1,
    borderRadius: 999,
    padding: 8,
    alignSelf: 'flex-start',
  },
  noteText: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
  },
  historyRow: {
    paddingVertical: 8,
  },
  historyNotes: {
    marginTop: 6,
    gap: 4,
    paddingLeft: 8,
  },
  historyNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyThumb: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  historyNoteText: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  pillRowSingle: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    marginTop: 8,
    justifyContent: 'space-between',
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  pillCompact: {
    paddingHorizontal: 8,
    flex: 1,
    alignItems: 'center',
  },
  pillText: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalAvoid: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
  },
});
