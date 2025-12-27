import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SQLite from 'expo-sqlite';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { enableScreens } from 'react-native-screens';
import { LinearGradient } from 'expo-linear-gradient';
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
    shouldShowAlert: true,
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
};

type ThemePreference = 'system' | 'light' | 'dark';

type SettingsState = {
  protocolKey: string;
  customFastingHours: number;
  customEatingHours: number;
  remindersEnabled: boolean;
  hydrationEnabled: boolean;
  hydrationIntervalHours: number;
  dailyCalorieGoal: number;
  themePreference: ThemePreference;
};

type TabParamList = {
  Home: undefined;
  Insights: undefined;
  Eating: undefined;
  History: undefined;
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
};

type ScreenProps = {
  theme: Theme;
  now: number;
  protocolLabel: string;
  activeSession: FastingSession | null;
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
  onUpdateSetting: <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => void;
};

const Tab = createBottomTabNavigator<TabParamList>();

const DEFAULT_SETTINGS: SettingsState = {
  protocolKey: '16:8',
  customFastingHours: 16,
  customEatingHours: 8,
  remindersEnabled: true,
  hydrationEnabled: true,
  hydrationIntervalHours: 3,
  dailyCalorieGoal: 0,
  themePreference: 'system',
};

const PROTOCOLS = [
  { key: '15:9', label: '15:9', fastingHours: 15, eatingHours: 9 },
  { key: '16:8', label: '16:8', fastingHours: 16, eatingHours: 8 },
  { key: '17:7', label: '17:7', fastingHours: 17, eatingHours: 7 },
  { key: '18:6', label: '18:6', fastingHours: 18, eatingHours: 6 },
  { key: 'custom', label: 'Custom', fastingHours: 0, eatingHours: 0 },
];

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
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );`
  );
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
  onStartFast,
  onStopFast,
  onOpenEdit,
}: ScreenProps) => (
  <ScreenShell theme={theme}>
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Fasting Lane</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>{formatDate(now)}</Text>
      </View>

      <View style={[styles.card, getCardStyle(theme)]}> 
        <Text style={[styles.sectionTitle, { color: theme.muted }]}>Current Fast</Text>
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
            <Text style={[styles.timer, { color: theme.text }]}>No active fast</Text>
            <Text style={[styles.meta, { color: theme.muted }]}>Protocol {protocolLabel}</Text>
            <Pressable
              style={[
                styles.primaryButton,
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

const InsightsScreen = ({
  theme,
  totalWeekMs,
  dailyTotals,
  maxDailyMs,
  dailyCaloriesTotals,
  maxDailyCalories,
}: ScreenProps) => (
  <ScreenShell theme={theme}>
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Insights</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Weekly overview</Text>
      </View>

      <View style={[styles.card, getCardStyle(theme)]}> 
        <Text style={[styles.sectionTitle, { color: theme.muted }]}>Weekly Overview</Text>
        <View style={styles.chart}>
          {dailyTotals.map((day) => (
            <View key={day.label} style={styles.chartCol}>
              <View
                style={[
                  styles.chartBar,
                  {
                    backgroundColor: theme.accent,
                    height: Math.max(6, (day.totalMs / maxDailyMs) * 120),
                  },
                ]}
              />
              <Text style={[styles.chartLabel, { color: theme.muted }]}>{day.label}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.meta, { color: theme.muted }]}> 
          Total fasting this week: {formatDuration(totalWeekMs)}
        </Text>
      </View>

      <View style={[styles.card, getCardStyle(theme)]}> 
        <Text style={[styles.sectionTitle, { color: theme.muted }]}>Daily Calories</Text>
        <View style={styles.chart}>
          {dailyCaloriesTotals.map((day) => (
            <View key={day.label} style={styles.chartCol}>
              <View
                style={[
                  styles.chartBar,
                  {
                    backgroundColor: theme.accent,
                    height: Math.max(
                      6,
                      (day.totalCalories / Math.max(maxDailyCalories, 1)) * 120
                    ),
                  },
                ]}
              />
              <Text style={[styles.chartLabel, { color: theme.muted }]}>{day.label}</Text>
              <Text style={[styles.microLabel, { color: theme.muted }]}>
                {day.totalCalories}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  </ScreenShell>
);

const EatingScreen = ({
  theme,
  todayCalories,
  dailyCalorieGoal,
  noteText,
  noteCalories,
  setNoteText,
  setNoteCalories,
  onAddNote,
  notes,
}: ScreenProps) => (
  <ScreenShell theme={theme}>
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Eating Window</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Mindful notes</Text>
      </View>

      <View style={[styles.card, getCardStyle(theme)]}> 
        <Text style={[styles.sectionTitle, { color: theme.muted }]}>Today</Text>
        <Text style={[styles.meta, { color: theme.text }]}> 
          Daily calories: {todayCalories}
          {dailyCalorieGoal > 0 ? ` / ${dailyCalorieGoal}` : ''}
        </Text>
        <View style={styles.noteRow}>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            placeholder="Quick note"
            placeholderTextColor={theme.muted}
            value={noteText}
            onChangeText={setNoteText}
          />
          <TextInput
            style={[styles.calorieInput, { color: theme.text, borderColor: theme.border }]}
            placeholder="kcal"
            placeholderTextColor={theme.muted}
            value={noteCalories}
            onChangeText={setNoteCalories}
            keyboardType="numeric"
          />
        </View>
        <Pressable
          style={[
            styles.primaryButton,
            { backgroundColor: theme.accent, shadowColor: theme.shadow },
          ]}
          onPress={onAddNote}
        >
          <Text style={styles.primaryButtonText}>Add note</Text>
        </Pressable>
      </View>

      <View style={[styles.card, getCardStyle(theme)]}> 
        <Text style={[styles.sectionTitle, { color: theme.muted }]}>Recent notes</Text>
        {notes.slice(0, 12).map((note) => (
          <View key={note.id} style={[styles.noteItem, { borderColor: theme.border }]}>
            <Text style={[styles.noteText, { color: theme.text }]}>{note.text}</Text>
            <Text style={[styles.meta, { color: theme.muted }]}>
              {formatTime(note.timestamp)}
              {note.calories ? ` - ${note.calories} kcal` : ''}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  </ScreenShell>
);

const HistoryScreen = ({ theme, sessions, now, onOpenEdit }: ScreenProps) => (
  <ScreenShell theme={theme}>
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>History</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>All sessions</Text>
      </View>

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
    </ScrollView>
  </ScreenShell>
);

const SettingsScreen = ({ theme, settings, onUpdateSetting }: ScreenProps) => (
  <ScreenShell theme={theme}>
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Personalize Fasting Lane</Text>
      </View>

      <View style={[styles.card, getCardStyle(theme)]}> 
        <Text style={[styles.sectionTitle, { color: theme.muted }]}>Protocol</Text>
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
      </View>

      <View style={[styles.card, getCardStyle(theme)]}> 
        <Text style={[styles.sectionTitle, { color: theme.muted }]}>Reminders</Text>
        <View style={styles.switchRow}>
          <Text style={[styles.meta, { color: theme.text }]}>Smart reminders</Text>
          <Switch
            value={settings.remindersEnabled}
            onValueChange={(value) => onUpdateSetting('remindersEnabled', value)}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={[styles.meta, { color: theme.text }]}>Hydration reminders</Text>
          <Switch
            value={settings.hydrationEnabled}
            onValueChange={(value) => onUpdateSetting('hydrationEnabled', value)}
          />
        </View>

        <View style={styles.noteRow}>
          <Text style={[styles.meta, { color: theme.muted }]}>Hydration interval</Text>
          {[2, 3, 4].map((hours) => (
            <Pressable
              key={hours}
              style={[
                styles.pill,
                {
                  backgroundColor:
                    settings.hydrationIntervalHours === hours ? theme.accent : theme.bg,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => onUpdateSetting('hydrationIntervalHours', hours)}
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
      </View>

      <View style={[styles.card, getCardStyle(theme)]}> 
        <Text style={[styles.sectionTitle, { color: theme.muted }]}>Nutrition</Text>
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
      </View>

      <View style={[styles.card, getCardStyle(theme)]}> 
        <Text style={[styles.sectionTitle, { color: theme.muted }]}>Appearance</Text>
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
      </View>

      <View style={[styles.card, getCardStyle(theme)]}> 
        <Text style={[styles.sectionTitle, { color: theme.muted }]}>Disclaimer</Text>
        <Text style={[styles.meta, { color: theme.muted }]}> 
          This app is for informational and tracking purposes only and is not medical advice. Always
          consult a healthcare professional before making changes to your diet or fasting routine.
        </Text>
      </View>
    </ScrollView>
  </ScreenShell>
);

export default function App() {
  const systemScheme = useColorScheme();
  const dbRef = useRef<SQLite.SQLiteDatabase | null>(null);
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  const [sessions, setSessions] = useState<FastingSession[]>([]);
  const [notes, setNotes] = useState<EatingNote[]>([]);
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [activeSession, setActiveSession] = useState<FastingSession | null>(null);
  const [now, setNow] = useState(Date.now());
  const [noteText, setNoteText] = useState('');
  const [noteCalories, setNoteCalories] = useState('');
  const [editSession, setEditSession] = useState<FastingSession | null>(null);
  const [editStart, setEditStart] = useState<Date | null>(null);
  const [editEnd, setEditEnd] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const theme: Theme = useMemo(() => {
    const applied =
      settings.themePreference === 'system'
        ? systemScheme ?? 'light'
        : settings.themePreference;
    return applied === 'dark'
      ? {
          mode: 'dark',
          bg: '#121514',
          bgAlt: '#0B0E0E',
          card: '#1B201F',
          text: '#F2F1ED',
          muted: '#A8A39B',
          accent: '#E1B35D',
          border: '#2B3230',
          shadow: '#000000',
        }
      : {
          mode: 'light',
          bg: '#F6F1EA',
          bgAlt: '#EDE6DC',
          card: '#FFFFFF',
          text: '#1B1C1A',
          muted: '#6A6760',
          accent: '#2F6B5E',
          border: '#E2D9CD',
          shadow: '#4A4339',
        };
  }, [settings.themePreference, systemScheme]);

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
      await loadSettings();
      await refreshData();
      setReady(true);
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
    settings.hydrationEnabled,
    settings.hydrationIntervalHours,
    settings.protocolKey,
    settings.customFastingHours,
    settings.customEatingHours,
  ]);

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
        case 'hydrationEnabled':
          loaded.hydrationEnabled = row.value === 'true';
          break;
        case 'hydrationIntervalHours':
          loaded.hydrationIntervalHours = Number(row.value);
          break;
        case 'dailyCalorieGoal':
          loaded.dailyCalorieGoal = Number(row.value);
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
  };

  const ensureNotificationPermissions = async () => {
    const current = await Notifications.getPermissionsAsync();
    if (current.status !== 'granted') {
      const request = await Notifications.requestPermissionsAsync();
      return request.status === 'granted';
    }
    return true;
  };

  const scheduleReminders = async (session: FastingSession | null) => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!session || !settings.remindersEnabled) return;

    const hasPermission = await ensureNotificationPermissions();
    if (!hasPermission) return;

    const protocol = getProtocolDetails(settings);
    const plannedEnd =
      session.end_time ??
      session.start_time + protocol.fastingHours * 3600 * 1000;

    if (plannedEnd > Date.now()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Fast complete',
          body: 'Your fasting window is finished. Time to refuel mindfully.',
        },
        trigger: new Date(plannedEnd),
      });
    }

    if (settings.hydrationEnabled && plannedEnd > Date.now()) {
      const intervalMs = settings.hydrationIntervalHours * 3600 * 1000;
      let next = Date.now() + intervalMs;
      while (next < plannedEnd) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Hydration check',
            body: 'Take a moment to drink water.',
          },
          trigger: new Date(next),
        });
        next += intervalMs;
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
  };

  const stopFast = async () => {
    if (!activeSession) return;
    const nowTs = Date.now();
    await run(
      'UPDATE fasting_sessions SET end_time = ?, updated_at = ? WHERE id = ?;',
      [nowTs, nowTs, activeSession.id]
    );
    await refreshData();
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
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    const calories = noteCalories.trim().length > 0 ? Number(noteCalories) : null;
    await run(
      'INSERT INTO eating_notes (timestamp, text, calories) VALUES (?, ?, ?);',
      [Date.now(), noteText.trim(), calories]
    );
    setNoteText('');
    setNoteCalories('');
    await refreshData();
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
    setSettings(next);
    await persistSetting(key, value);
  };

  const screenProps: ScreenProps = {
    theme,
    now,
    protocolLabel: protocol.label,
    activeSession,
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
    onUpdateSetting: updateSetting,
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
                History: 'calendar-outline',
                Settings: 'settings-outline',
              };
              return <Ionicons name={icons[route.name] ?? 'ellipse'} size={size} color={color} />;
            },
          })}
        >
          <Tab.Screen name="Home">{() => <HomeScreen {...screenProps} />}</Tab.Screen>
          <Tab.Screen name="Insights">
            {() => <InsightsScreen {...screenProps} />}
          </Tab.Screen>
          <Tab.Screen name="Eating">{() => <EatingScreen {...screenProps} />}</Tab.Screen>
          <Tab.Screen name="History">{() => <HistoryScreen {...screenProps} />}</Tab.Screen>
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
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
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
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
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
  chartCol: {
    alignItems: 'center',
    flex: 1,
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
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 140,
    fontFamily: 'Manrope_500Medium',
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
  noteText: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
  },
  historyRow: {
    paddingVertical: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
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
    padding: 20,
  },
  modalContent: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
  },
});
