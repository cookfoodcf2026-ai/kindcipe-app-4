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
  value: string;
  onChange: (iso: string) => void;
  monthsAhead?: number;
  showShortcuts?: boolean;
  minDate?: string;
}

export default function PlanDatePicker({
  value,
  onChange,
  monthsAhead = 2,
  showShortcuts = true,
  minDate,
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
      const cardWidth = 98;
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

  // Scroll to selected date when value changes
  useEffect(() => {
    if (value && scrollRef.current) {
      const idx = dateCardsData.findIndex((dc) => dc.date === value);
      if (idx >= 0) {
        const x = Math.max(0, idx * 98 - 60);
        scrollRef.current.scrollTo({ x, animated: false });
      }
    }
  }, [value, dateCardsData]);

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
            onPress={() => shiftDateWindow(-7)}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={18} color={BRAND} />
          </TouchableOpacity>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.dateCardsScroll}
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
                  ]}
                  onPress={() => {
                    if (!isPast) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onChange(dc.date);
                    }
                  }}
                  disabled={isPast}
                  activeOpacity={0.7}
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
            onPress={() => shiftDateWindow(7)}
            activeOpacity={0.7}
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
    gap: 6,
  },
  dateArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E8F0FE",
    alignItems: "center",
    justifyContent: "center",
  },
  dateCardsScroll: {
    flex: 1,
  },
  dateCard: {
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    minWidth: 90,
    marginRight: 8,
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
    fontSize: 22,
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
