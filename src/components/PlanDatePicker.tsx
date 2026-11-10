import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { DateUtil } from "@/src/lib/DateUtil";
import { buildDateRange, clampDateToRange } from "@/lib/dateRange";
import { useTranslation } from "react-i18next";

const BRAND = "#183B56";
const TEXT = "#1A1A1A";
const SUB = "#9CA3AF";
const CARD_WIDTH = 82;

const formatDateCard = (dateStr: string) => {
  const isToday = DateUtil.isToday(dateStr);
  const day = new Date(dateStr + 'T00:00:00').getDate();
  const weekday = DateUtil.getWeekday(dateStr, true);
  return { day: String(day), weekday, isToday };
};

const formatMonthLabel = (dateStr: string) => {
  return DateUtil.formatMonthLabel(dateStr);
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
  const { t } = useTranslation();
  const today = DateUtil.todayISO();
  const min = minDate || today;
  const normalizedValue = value
    ? clampDateToRange(value, min, maxDate)
    : value;
  const days = monthsAhead * 30;

  const [dateWindowStart, setDateWindowStart] = useState(
    () => new Date(`${min}T00:00:00`),
  );
  const [visibleMonth, setVisibleMonth] = useState("");
  const [scrollStarted, setScrollStarted] = useState(false);
  const [scrollViewportWidth, setScrollViewportWidth] = useState(0);
  const touchStartTimeRef = useRef<number>(0);
  const isTouchingRef = useRef(false);

  const dateCardsData = useMemo(() => {
    let windowStart = DateUtil.toISODate(dateWindowStart);
    if (windowStart < min) windowStart = min;
    if (maxDate && maxDate >= min && windowStart > maxDate) {
      windowStart = maxDate;
    }
    return buildDateRange(windowStart, maxDate, days).map((date) => ({
      date,
      ...formatDateCard(date),
    }));
  }, [dateWindowStart, days, maxDate, min]);

  const currentMonth = useMemo(() => {
    if (normalizedValue) return formatMonthLabel(normalizedValue);
    if (visibleMonth) return visibleMonth;
    if (dateCardsData.length === 0) return "";
    return formatMonthLabel(dateCardsData[0].date);
  }, [normalizedValue, dateCardsData, visibleMonth]);

  useEffect(() => {
    if (value && normalizedValue && value !== normalizedValue) {
      onChange(normalizedValue);
    }
  }, [value, normalizedValue, onChange]);

  useEffect(() => {
    setDateWindowStart((prev) => {
      const minStart = new Date(`${min}T00:00:00`);
      let next = prev;
      if (next < minStart) next = minStart;
      if (maxDate && maxDate >= min) {
        const maxStart = new Date(`${maxDate}T00:00:00`);
        if (next > maxStart) next = maxStart;
      }
      return next;
    });
  }, [min, maxDate]);

  const handleScroll = useCallback(
    (event: any) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.min(
        Math.max(Math.floor(offsetX / CARD_WIDTH), 0),
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
    // 撳一個日期時即時更新月份標題（避免揀咗 1/9 但 header 仍顯示 8月）
    setVisibleMonth(formatMonthLabel(date));
    onChange(date);
  }, [scrollStarted, onChange]);

  const shiftDateWindow = useCallback((shiftDays: number) => {
    setDateWindowStart((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + shiftDays);
      const minStart = new Date(`${min}T00:00:00`);
      if (next < minStart) return minStart;
      if (maxDate && maxDate >= min) {
        const maxStart = new Date(`${maxDate}T00:00:00`);
        if (next > maxStart) return maxStart;
      }
      return next;
    });
    setVisibleMonth("");
  }, [min, maxDate]);

  const shortcuts = useMemo(() => {
    const items: { label: string; iso: string }[] = [];
    const seen = new Set<string>();
    const todayVal = DateUtil.todayISO();
    const tomorrowVal = DateUtil.tomorrowISO();

    const add = (label: string, iso: string) => {
      if (iso < min) return;
      if (maxDate && iso > maxDate) return;
      if (seen.has(iso)) return;
      seen.add(iso);
      items.push({ label, iso });
    };

    add(t("shopping.today"), todayVal);
    add(t("shopping.tomorrow"), tomorrowVal);

    return items;
  }, [min, maxDate, t]);

  const scrollRef = useRef<ScrollView>(null);
  const lastTargetRef = useRef<string | null>(null);
  const pendingScrollTargetRef = useRef<string | null>(null);

  const scrollToCardIndex = useCallback(
    (index: number) => {
      if (!scrollRef.current || index < 0) return;
      const viewport = scrollViewportWidth || CARD_WIDTH * 5;
      const x = Math.max(
        0,
        index * CARD_WIDTH + CARD_WIDTH / 2 - viewport / 2,
      );
      scrollRef.current.scrollTo({ x, animated: true });
    },
    [scrollViewportWidth],
  );

  // Ensure the generated window includes value, then scroll it into view.
  // Never falls back to maxDate: with a value the strip must show that date.
  // Only reacts when the target actually changes — NOT on manual scroll / arrow taps,
  // otherwise the picker keeps snapping back to the selected date while the user scrolls.
  useEffect(() => {
    const target = normalizedValue;
    if (!target) return;
    const targetKey = `${target}|${min}|${maxDate ?? ""}`;
    if (lastTargetRef.current === targetKey) return;
    lastTargetRef.current = targetKey;
    if (!scrollRef.current || isTouchingRef.current) return;
    const firstDate = dateCardsData[0]?.date;
    const lastDate = dateCardsData[dateCardsData.length - 1]?.date;
    if (!firstDate) return;
    if (target < firstDate) {
      const daysDiff = DateUtil.daysBetween(target, firstDate);
      const next = new Date(`${firstDate}T00:00:00`);
      next.setDate(next.getDate() - daysDiff);
      setDateWindowStart(next);
      setVisibleMonth("");
      pendingScrollTargetRef.current = target;
      return;
    }
    if (lastDate && target > lastDate) {
      const daysDiff = DateUtil.daysBetween(lastDate, target);
      const next = new Date(`${lastDate}T00:00:00`);
      next.setDate(next.getDate() + daysDiff);
      setDateWindowStart(next);
      setVisibleMonth("");
      pendingScrollTargetRef.current = target;
      return;
    }
    const idx = dateCardsData.findIndex((dc) => dc.date === target);
    if (idx >= 0) scrollToCardIndex(idx);
  }, [normalizedValue, min, maxDate, dateCardsData, scrollToCardIndex]);

  // After the window was extended to include an out-of-range target, scroll to it once the new cards render.
  useEffect(() => {
    const target = pendingScrollTargetRef.current;
    if (!target) return;
    pendingScrollTargetRef.current = null;
    if (!scrollRef.current) return;
    const idx = dateCardsData.findIndex((dc) => dc.date === target);
    if (idx >= 0) scrollToCardIndex(idx);
  }, [dateCardsData, scrollToCardIndex]);

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
                  normalizedValue === item.iso && s.shortcutChipActive,
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
                    normalizedValue === item.iso && s.shortcutChipTxtActive,
                  ]}
                >
                {t(item.label as any)}
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
              shiftDateWindow(-7);
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
            onLayout={(e) =>
              setScrollViewportWidth(e.nativeEvent.layout.width)
            }
            onScrollBeginDrag={handleScrollBeginDrag}
            onScrollEndDrag={handleScrollEndDrag}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {dateCardsData.map((dc, index) => {
              const isSelected = normalizedValue === dc.date;
              const isPast = dc.date < min;
              return (
                <TouchableOpacity
                  key={`${dc.date}-${index}`}
                  style={[
                    s.dateCard,
                    isSelected && s.dateCardSelected,
                    isPast && s.dateCardDisabled,
                  ]}
                  onPress={() => handleDatePress(dc.date, isPast)}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  delayPressIn={50}
                  delayLongPress={250}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  disabled={isPast}
                  activeOpacity={0.6}
                >
                  <Text
                    style={[
                      s.dateCardDay,
                      isSelected && s.dateCardDaySelected,
                      isPast && s.dateCardDayDisabled,
                    ]}
                  >
                    {dc.day}
                  </Text>
                  <Text
                    style={[
                      s.dateCardWeekday,
                      isSelected && s.dateCardWeekdaySelected,
                      isPast && s.dateCardWeekdayDisabled,
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
              shiftDateWindow(7);
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
    backgroundColor: "#E8F0F4",
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
