import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

const BRAND = "#013E77";
const TEXT = "#1A1A1A";
const SUB = "#9CA3AF";
const BORDER = "#E2E8F0";
const BG_CHIP = "#F3F4F6";

const CHIP_WIDTH = 56;
const CHIP_MARGIN = 8;
const CHIP_TOTAL = CHIP_WIDTH + CHIP_MARGIN;

type YearMonth = { year: number; month: number };

interface PlanDatePickerProps {
  value: string;
  onChange: (iso: string) => void;
  monthsAhead?: number;
  showShortcuts?: boolean;
  minDate?: string;
}

const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const todayISO = () => toISODate(new Date());

const getDaysInMonth = (year: number, month: number) =>
  new Date(year, month, 0).getDate();

const addMonths = (ym: YearMonth, n: number): YearMonth => {
  const d = new Date(ym.year, ym.month - 1 + n, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

const compareYM = (a: YearMonth, b: YearMonth) => {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
};

const parseYMFromISO = (iso: string): YearMonth => {
  const [y, m] = iso.split("-").map(Number);
  return { year: y, month: m };
};

const getNextMonday = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return toISODate(d);
};

const getNextSaturday = (): string => {
  const d = new Date();
  const daysUntilSat = (6 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilSat);
  return toISODate(d);
};

function getNextMonthButtonLabel(ym: YearMonth, t: (key: string) => string) {
  return `${ym.year}年${ym.month}月`;
}

export default function PlanDatePicker({
  value,
  onChange,
  monthsAhead = 12,
  showShortcuts = true,
  minDate,
}: PlanDatePickerProps) {
  const { t } = useTranslation();

  const min = minDate || todayISO();
  const today = todayISO();

  const [viewingYM, setViewingYM] = useState<YearMonth>(() => {
    if (value) return parseYMFromISO(value);
    return parseYMFromISO(today);
  });

  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  const maxYM = useMemo(() => {
    const now = new Date();
    return addMonths(
      { year: now.getFullYear(), month: now.getMonth() + 1 },
      monthsAhead
    );
  }, [monthsAhead]);

  useEffect(() => {
    if (value) {
      const newYM = parseYMFromISO(value);
      setViewingYM((prev) => {
        if (compareYM(prev, newYM) !== 0) return newYM;
        return prev;
      });
    }
  }, [value]);

  const daysInMonth = useMemo(
    () => getDaysInMonth(viewingYM.year, viewingYM.month),
    [viewingYM]
  );

  const startDay = useMemo(() => {
    const todayYM = parseYMFromISO(today);
    if (compareYM(viewingYM, todayYM) === 0) {
      return new Date().getDate();
    }
    return 1;
  }, [viewingYM, today]);

  const dayItems = useMemo(() => {
    const items: { iso: string; day: number; weekday: string; isToday: boolean; isTomorrow: boolean }[] = [];
    for (let d = startDay; d <= daysInMonth; d++) {
      const date = new Date(viewingYM.year, viewingYM.month - 1, d);
      const iso = toISODate(date);
      const weekday = date.toLocaleDateString("zh-HK", { weekday: "short" });
      items.push({
        iso,
        day: d,
        weekday,
        isToday: iso === today,
        isTomorrow: iso === toISODate(new Date(Date.now() + 86400000)),
      });
    }
    return items;
  }, [viewingYM, startDay, daysInMonth, today]);

  const selectedIndex = useMemo(() => {
    return dayItems.findIndex((item) => item.iso === value);
  }, [dayItems, value]);

  useEffect(() => {
    if (selectedIndex >= 0 && scrollRef.current) {
      const x = Math.max(0, selectedIndex * CHIP_TOTAL - 60);
      scrollRef.current.scrollTo({ x, animated: false });
    }
  }, [selectedIndex, viewingYM]);

  const handleSelect = useCallback(
    (iso: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(iso);
    },
    [onChange]
  );

  const goToPrevMonth = () => {
    const todayYM = parseYMFromISO(today);
    if (compareYM(viewingYM, todayYM) > 0) {
      const prev = addMonths(viewingYM, -1);
      setViewingYM(prev);
    }
  };

  const goToNextMonth = () => {
    if (compareYM(viewingYM, maxYM) < 0) {
      const next = addMonths(viewingYM, 1);
      setViewingYM(next);
    }
  };

  const shortcuts = useMemo(() => {
    const items: { label: string; iso: string }[] = [];
    const todayVal = todayISO();
    const tomorrowVal = toISODate(new Date(Date.now() + 86400000));
    const nextMon = getNextMonday();
    const nextSat = getNextSaturday();

    if (todayVal >= min) items.push({ label: t("common.today") || "今天", iso: todayVal });
    if (tomorrowVal >= min) items.push({ label: t("common.tomorrow") || "明天", iso: tomorrowVal });
    if (nextMon >= min) items.push({ label: "下週一", iso: nextMon });
    if (nextSat >= min) items.push({ label: "週末", iso: nextSat });

    return items;
  }, [min, t]);

  const monthList = useMemo(() => {
    const list: { label: string; ym: YearMonth }[] = [];
    const now = new Date();
    const currentYM: YearMonth = { year: now.getFullYear(), month: now.getMonth() + 1 };
    for (let i = 0; i <= monthsAhead; i++) {
      const ym = addMonths(currentYM, i);
      list.push({
        label: `${ym.year}年${ym.month}月`,
        ym,
      });
    }
    return list;
  }, [monthsAhead]);

  const isPrevDisabled = compareYM(viewingYM, parseYMFromISO(today)) <= 0;
  const isNextDisabled = compareYM(viewingYM, maxYM) >= 0;

  return (
    <>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={[s.arrowBtn, isPrevDisabled && s.arrowBtnDisabled]}
          onPress={goToPrevMonth}
          disabled={isPrevDisabled}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={isPrevDisabled ? SUB : TEXT}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={s.monthBtn}
          onPress={() => setShowMonthPicker(true)}
        >
          <Text style={s.monthBtnTxt}>
            {getNextMonthButtonLabel(viewingYM, t)}
          </Text>
          <Ionicons name="chevron-down" size={16} color={TEXT} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.arrowBtn, isNextDisabled && s.arrowBtnDisabled]}
          onPress={goToNextMonth}
          disabled={isNextDisabled}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={isNextDisabled ? SUB : TEXT}
          />
        </TouchableOpacity>
      </View>

      {/* Shortcuts */}
      {showShortcuts && shortcuts.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.shortcutRow}
          contentContainerStyle={{ paddingRight: 16 }}
        >
          {shortcuts.map((item) => (
            <TouchableOpacity
              key={item.iso}
              style={[
                s.shortcutChip,
                value === item.iso && s.shortcutChipActive,
              ]}
              onPress={() => handleSelect(item.iso)}
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
        </ScrollView>
      )}

      {/* Day chips */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.dayRow}
        contentContainerStyle={{ paddingRight: 16 }}
      >
        {dayItems.map((item) => {
          const isSelected = item.iso === value;
          const isPast = item.iso < min;
          return (
            <TouchableOpacity
              key={item.iso}
              style={[
                s.dayChip,
                isSelected && s.dayChipActive,
                item.isToday && !isSelected && s.dayChipToday,
                isPast && s.dayChipDisabled,
              ]}
              onPress={() => !isPast && handleSelect(item.iso)}
              disabled={isPast}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  s.dayChipWeekday,
                  isSelected && s.dayChipWeekdayActive,
                  isPast && s.dayChipWeekdayDisabled,
                ]}
              >
                {item.isToday
                  ? t("common.today") || "今天"
                  : item.isTomorrow
                  ? t("common.tomorrow") || "明天"
                  : item.weekday}
              </Text>
              <Text
                style={[
                  s.dayChipDay,
                  isSelected && s.dayChipDayActive,
                  isPast && s.dayChipDayDisabled,
                ]}
              >
                {item.day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Month picker modal */}
      <Modal
        visible={showMonthPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>選擇月份</Text>
              <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                <Text style={s.sheetClose}>完成</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={monthList}
              keyExtractor={(item) => `${item.ym.year}-${item.ym.month}`}
              contentContainerStyle={{ paddingBottom: 12 }}
              renderItem={({ item }) => {
                const isActive = compareYM(item.ym, viewingYM) === 0;
                return (
                  <TouchableOpacity
                    style={[s.monthOpt, isActive && s.monthOptActive]}
                    onPress={() => {
                      setViewingYM(item.ym);
                      setShowMonthPicker(false);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text
                      style={[
                        s.monthOptTxt,
                        isActive && s.monthOptTxtActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {isActive && <Text style={s.monthOptCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 10,
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BG_CHIP,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowBtnDisabled: {
    opacity: 0.4,
  },
  monthBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: BG_CHIP,
  },
  monthBtnTxt: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT,
  },
  shortcutRow: {
    marginBottom: 10,
  },
  shortcutChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: BG_CHIP,
    marginRight: 8,
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
  dayRow: {
    marginBottom: 4,
  },
  dayChip: {
    width: CHIP_WIDTH,
    height: 64,
    borderRadius: 14,
    backgroundColor: BG_CHIP,
    marginRight: CHIP_MARGIN,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dayChipActive: {
    backgroundColor: BRAND,
  },
  dayChipToday: {
    borderWidth: 1.5,
    borderColor: BRAND,
  },
  dayChipDisabled: {
    opacity: 0.4,
  },
  dayChipWeekday: {
    fontSize: 11,
    color: SUB,
    fontWeight: "600",
  },
  dayChipWeekdayActive: {
    color: "rgba(255,255,255,0.85)",
  },
  dayChipWeekdayDisabled: {
    color: SUB,
  },
  dayChipDay: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT,
  },
  dayChipDayActive: {
    color: "#fff",
  },
  dayChipDayDisabled: {
    color: SUB,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT,
  },
  sheetClose: {
    fontSize: 15,
    fontWeight: "600",
    color: BRAND,
  },
  monthOpt: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F3F4F6",
  },
  monthOptActive: {
    backgroundColor: "#EEF4FB",
  },
  monthOptTxt: {
    flex: 1,
    fontSize: 15,
    color: TEXT,
  },
  monthOptTxtActive: {
    fontWeight: "700",
    color: BRAND,
  },
  monthOptCheck: {
    fontSize: 16,
    color: BRAND,
    fontWeight: "700",
  },
});
