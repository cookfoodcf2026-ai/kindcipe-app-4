import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const BRAND = "#013E77";
const TEXT = "#1A1A1A";
const SUB = "#9CA3AF";

const WEEKDAYS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const todayISO = () => toISODate(new Date());

const formatDateCard = (dateStr: string) => {
  const date = new Date(dateStr);
  const day = date.getDate();
  const weekday = WEEKDAYS[date.getDay()];
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  let suffix = "";
  if (isToday) suffix = "·今";
  else if (isTomorrow) suffix = "·明";
  return { day: String(day), weekday: `${weekday}${suffix}`, isToday };
};

const formatMonthLabel = (dateStr: string) => {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}月`;
};

interface PlanDatePickerProps {
  value: string | null;
  onChange: (iso: string) => void;
  monthsAhead?: number;
  showShortcuts?: boolean;
  minDate?: string;
  maxDate?: string;
}

export default function PlanDatePicker({
  value,
  onChange,
  monthsAhead = 2,
  showShortcuts = true,
  minDate,
  maxDate,
}: PlanDatePickerProps) {
  const min = minDate || todayISO();
  const today = todayISO();
  const days = monthsAhead * 30;

  const [dateWindowStart, setDateWindowStart] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [visibleMonth, setVisibleMonth] = useState("");
  const [scrollStarted, setScrollStarted] = useState(false);
  const [currentScrollX, setCurrentScrollX] = useState(0);
  const currentScrollXRef = useRef(0);
  const touchStartTimeRef = useRef<number>(0);
  const isTouchingRef = useRef(false);

  const dateCardsData = useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(dateWindowStart);
      d.setDate(dateWindowStart.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates.map((date) => ({
      date,
      ...formatDateCard(date),
    }));
  }, [dateWindowStart, days]);

  const currentMonth = useMemo(() => {
    if (visibleMonth) return visibleMonth;
    if (dateCardsData.length === 0) return "";
    return formatMonthLabel(dateCardsData[0].date);
  }, [dateCardsData, visibleMonth]);

  const handleScroll = useCallback(
    (event: any) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      setCurrentScrollX(offsetX);
      currentScrollXRef.current = offsetX;
      const cardWidth = 82;
      const index = Math.min(
        Math.max(Math.floor(offsetX / cardWidth), 0),
        dateCardsData.length - 1,
      );
      if (index >= 0 && index < dateCardsData.length) {
        const month = formatMonthLabel(dateCardsData[index].date);
        setVisibleMonth(month);
      }
    },
    [dateCardsData],
  );

  const handlePressIn = useCallback(() => {
    touchStartTimeRef.current = Date.now();
    isTouchingRef.current = true;
  }, []);

  const handlePressOut = useCallback(() => {
    isTouchingRef.current = false;
  }, []);

  const handleScrollBeginDrag = useCallback(() => {
    setScrollStarted(true);
  }, []);

  const handleScrollEndDrag = useCallback(() => {
    setTimeout(() => setScrollStarted(false), 50);
  }, []);

  const handleDatePress = useCallback((date: string, isPast: boolean) => {
    if (isPast) return;
    
    const touchDuration = Date.now() - touchStartTimeRef.current;
    
    if (scrollStarted || touchDuration > 250) {
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(date);
  }, [scrollStarted, onChange]);

  const shiftDateWindow = useCallback((shiftDays: number) => {
    setDateWindowStart((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + shiftDays);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (next < today) return today;
      return next;
    });
    setVisibleMonth("");
  }, []);

  const shortcuts = useMemo(() => {
    const items: { label: string; iso: string }[] = [];
    const seen = new Set<string>();
    const todayVal = todayISO();
    const tomorrowVal = toISODate(new Date(Date.now() + 86400000));

    const add = (label: string, iso: string) => {
      if (iso >= min && !seen.has(iso)) {
        seen.add(iso);
        items.push({ label, iso });
      }
    };

    add("今天", todayVal);
    add("明天", tomorrowVal);

    return items;
  }, [min]);

  const scrollRef = useRef<ScrollView>(null);
  const lastTargetRef = useRef<string | null>(null);
  const pendingScrollTargetRef = useRef<string | null>(null);

  // Ensure the generated window includes value/maxDate, then scroll it into view.
  // Only reacts when the target actually changes — NOT on manual scroll / arrow taps,
  // otherwise the picker keeps snapping back to the selected date while the user scrolls.
  useEffect(() => {
    const target = value || maxDate;
    if (!target) return;
    if (lastTargetRef.current === target) return;
    lastTargetRef.current = target;
    if (!scrollRef.current || isTouchingRef.current) return;
    const firstDate = dateCardsData[0]?.date;
    const lastDate = dateCardsData[dateCardsData.length - 1]?.date;
    if (!firstDate || !lastDate) return;
    if (target < firstDate) {
      const msDiff = new Date(firstDate).getTime() - new Date(target).getTime();
      const daysDiff = Math.ceil(msDiff / 86400000);
      const next = new Date(dateWindowStart);
      next.setDate(next.getDate() - daysDiff);
      setDateWindowStart(next);
      setVisibleMonth("");
      pendingScrollTargetRef.current = target;
      return;
    }
    if (target > lastDate) {
      const msDiff = new Date(target).getTime() - new Date(lastDate).getTime();
      const daysDiff = Math.ceil(msDiff / 86400000);
      const next = new Date(dateWindowStart);
      next.setDate(next.getDate() + daysDiff);
      setDateWindowStart(next);
      setVisibleMonth("");
      pendingScrollTargetRef.current = target;
      return;
    }
    const idx = dateCardsData.findIndex((dc) => dc.date === target);
    if (idx >= 0) {
      // Only scroll if date is not already in visible range (roughly)
      const visibleStart = Math.floor(currentScrollXRef.current / 82);
      const visibleEnd = visibleStart + 5; // ~5 cards visible
      if (idx < visibleStart || idx > visibleEnd) {
        const x = Math.max(0, idx * 82 - 60);
        scrollRef.current.scrollTo({ x, animated: true });
      }
    }
  }, [value, maxDate, dateCardsData, dateWindowStart]);

  // After the window was extended to include an out-of-range target, scroll to it once the new cards render.
  useEffect(() => {
    const target = pendingScrollTargetRef.current;
    if (!target) return;
    pendingScrollTargetRef.current = null;
    if (!scrollRef.current) return;
    const idx = dateCardsData.findIndex((dc) => dc.date === target);
    if (idx >= 0) {
      scrollRef.current.scrollTo({ x: Math.max(0, idx * 82 - 60), animated: true });
    }
  }, [dateCardsData]);

  return (
    <View style={s.container}>
      {/* Shortcuts */}
      {showShortcuts && shortcuts.length > 0 && (
        <View style={s.shortcutRow}>
          {shortcuts.map((item) => (
            <TouchableOpacity
              key={item.iso}
              style={[
                s.shortcutChip,
                value === item.iso && s.shortcutChipActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onChange(item.iso);
                
                // 更新日期窗口，讓自動滾動生效
                const selectedDate = new Date(item.iso);
                setDateWindowStart(() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() - 2);
                  return d;
                });
                setVisibleMonth("");
              }}
            >
              <Text
                style={[
                  s.shortcutChipTxt,
                  value === item.iso && s.shortcutChipTxtActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Date cards */}
      <View style={s.dateCardsSection}>
        <Text style={s.dateCardsMonth}>{currentMonth}</Text>
        <View style={s.dateCardsRow}>
          <TouchableOpacity
            style={s.dateArrowBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              shiftDateWindow(-30);
            }}
            activeOpacity={0.7}
            delayPressIn={100}
            hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
          >
            <Ionicons name="chevron-back" size={18} color={BRAND} />
          </TouchableOpacity>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.dateCardsScroll}
            onScrollBeginDrag={handleScrollBeginDrag}
            onScrollEndDrag={handleScrollEndDrag}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {dateCardsData.map((dc) => {
              const isSelected = value === dc.date;
              const isPast = dc.date < min;
              return (
                <TouchableOpacity
                  key={dc.date}
                  style={[
                    s.dateCard,
                    isSelected && s.dateCardSelected,
                    isPast && s.dateCardDisabled,
                    maxDate && dc.date > maxDate && s.dateCardDisabled,
                  ]}
                  onPress={() => {
                    if (maxDate && dc.date > maxDate) {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                      Alert.alert(
                        "日期超出範圍",
                        `選擇的日期（${dc.date}）超出允許範圍\n\n最遲可選擇：${maxDate}`,
                        [{ text: "確定" }]
                      );
                      return;
                    }
                    handleDatePress(dc.date, isPast);
                  }}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  delayPressIn={50}
                  delayLongPress={250}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  disabled={isPast || !!(maxDate && dc.date > maxDate)}
                  activeOpacity={0.6}
                >
                  <Text
                    style={[
                      s.dateCardDay,
                      isSelected && s.dateCardDaySelected,
                      isPast && s.dateCardDayDisabled,
                      maxDate && dc.date > maxDate && s.dateCardDayDisabled,
                    ]}
                  >
                    {dc.day}
                  </Text>
                  <Text
                    style={[
                      s.dateCardWeekday,
                      isSelected && s.dateCardWeekdaySelected,
                      isPast && s.dateCardWeekdayDisabled,
                      maxDate && dc.date > maxDate && s.dateCardWeekdayDisabled,
                    ]}
                  >
                    {dc.weekday}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={s.dateArrowBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              shiftDateWindow(30);
            }}
            activeOpacity={0.7}
            delayPressIn={100}
            hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
          >
            <Ionicons name="chevron-forward" size={18} color={BRAND} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginTop: 8,
    width: '100%',
  },
  shortcutRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  shortcutChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },
  shortcutChipActive: {
    backgroundColor: BRAND,
  },
  shortcutChipTxt: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT,
  },
  shortcutChipTxtActive: {
    color: "#fff",
  },
  dateCardsSection: {
    marginTop: 4,
  },
  dateCardsMonth: {
    fontSize: 13,
    fontWeight: "700",
    color: BRAND,
    textAlign: "center",
    marginBottom: 8,
  },
  dateCardsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateArrowBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E8F0FE",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dateCardsScroll: {
    flex: 1,
    minHeight: 70,
  },
  dateCard: {
    backgroundColor: "#FFF7ED",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    minWidth: 60,
    marginRight: 6,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  dateCardSelected: {
    borderWidth: 2,
    borderColor: BRAND,
    backgroundColor: "#EFF6FF",
  },
  dateCardDisabled: {
    opacity: 0.4,
  },
  dateCardDay: {
    fontSize: 18,
    fontWeight: "800",
    color: TEXT,
  },
  dateCardDaySelected: {
    color: BRAND,
  },
  dateCardDayDisabled: {
    color: SUB,
  },
  dateCardWeekday: {
    fontSize: 11,
    color: SUB,
    marginTop: 2,
  },
  dateCardWeekdaySelected: {
    color: BRAND,
    fontWeight: "600",
  },
  dateCardWeekdayDisabled: {
    color: SUB,
  },
});
