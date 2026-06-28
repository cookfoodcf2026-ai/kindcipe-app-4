import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const WEEKDAYS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

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

interface DateCardsPickerProps {
  value: string;
  onChange: (iso: string) => void;
  days?: number;
}

export default function DateCardsPicker({
  value,
  onChange,
  days = 30,
}: DateCardsPickerProps) {
  const [dateWindowStart, setDateWindowStart] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
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

  return (
    <View style={s.dateCardsSection}>
      <Text style={s.dateCardsMonth}>{currentMonth}</Text>
      <View style={s.dateCardsRow}>
        <TouchableOpacity
          style={s.dateArrowBtn}
          onPress={() => shiftDateWindow(-1)}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={18} color="#013E77" />
        </TouchableOpacity>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.dateCardsScroll}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {dateCardsData.map((dc) => {
            const isSelected = value === dc.date;
            return (
              <TouchableOpacity
                key={dc.date}
                style={[s.dateCard, isSelected && s.dateCardSelected]}
                onPress={() => onChange(dc.date)}
                activeOpacity={0.7}
              >
                <Text
                  style={[s.dateCardDay, isSelected && s.dateCardDaySelected]}
                >
                  {dc.day}
                </Text>
                <Text
                  style={[
                    s.dateCardWeekday,
                    isSelected && s.dateCardWeekdaySelected,
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
          onPress={() => shiftDateWindow(1)}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-forward" size={18} color="#013E77" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  dateCardsSection: {
    marginTop: 8,
  },
  dateCardsMonth: {
    fontSize: 13,
    fontWeight: "700",
    color: "#013E77",
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
    borderColor: "#013E77",
    backgroundColor: "#EFF6FF",
  },
  dateCardDay: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  dateCardDaySelected: {
    color: "#013E77",
  },
  dateCardWeekday: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  dateCardWeekdaySelected: {
    color: "#013E77",
    fontWeight: "600",
  },
});
