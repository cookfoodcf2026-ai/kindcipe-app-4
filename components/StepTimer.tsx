import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

const BRAND = "#183B56";
const COPPER = "#F37021";
const CARD = "#FFFFFF";
const TEXT = "#1C1C1E";
const SUB = "#8E8E93";
const HINT = "#C7C7CC";
const BORDER = "#F0EDE8";

type Props = {
  defaultSeconds?: number;
  onTimerEnd?: () => void;
};

export default function StepTimer({ defaultSeconds = 0, onTimerEnd }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"idle" | "input" | "counting">("idle");
  const [totalSec, setTotalSec] = useState(defaultSeconds);
  const [remaining, setRemaining] = useState(defaultSeconds);
  const [running, setRunning] = useState(false);
  const [inputMin, setInputMin] = useState(defaultSeconds > 0 ? String(Math.floor(defaultSeconds / 60)) : "");
  const [inputSec, setInputSec] = useState(defaultSeconds > 0 ? String(defaultSeconds % 60) : "0");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerEndedRef = useRef(false);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            setRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  useEffect(() => {
    if (remaining === 0 && totalSec > 0 && !running && !timerEndedRef.current) {
      timerEndedRef.current = true;
      if (onTimerEnd) onTimerEnd();
    }
    if (running && totalSec > 0) {
      timerEndedRef.current = false;
    }
  }, [remaining, running, totalSec, onTimerEnd]);

  const isDone = remaining === 0 && totalSec > 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const handleConfirm = () => {
    const m = parseInt(inputMin || "0");
    const s = parseInt(inputSec || "0");
    const total = (isNaN(m) ? 0 : m) * 60 + (isNaN(s) ? 0 : s);
    if (total <= 0) return;
    setTotalSec(total);
    setRemaining(total);
    setMode("counting");
    setRunning(true);
  };

  const handleReset = () => {
    setRunning(false);
    setRemaining(totalSec);
    if (totalSec > 0) setMode("counting");
  };

  if (mode === "idle") {
    if (totalSec === 0) {
      return (
        <TouchableOpacity style={s.timerIdle} onPress={() => setMode("input")}>
          <Ionicons name="timer-outline" size={12} color={SUB} />
          <Text style={s.timerIdleTxt}>{t("recipe.setTimer")}</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity style={s.timerIdleActive} onPress={() => { setMode("counting"); setRunning(true); }}>
        <Ionicons name="timer-outline" size={12} color={BRAND} />
        <Text style={s.timerIdleActiveTxt}>{t("dyn.minStartTimer", { n: Math.round(totalSec / 60) })}</Text>
      </TouchableOpacity>
    );
  }

  if (mode === "input") {
    return (
      <View style={s.timerInput}>
        <Ionicons name="timer-outline" size={13} color={BRAND} />
        <Text style={s.timerInputLabel}>{t("recipe.timer")}</Text>
        <TextInput
          style={s.timerNumInput}
          value={inputMin}
          onChangeText={setInputMin}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={HINT}
          maxLength={2}
        />
        <Text style={s.timerInputLabel}>{t("recipe.min")}</Text>
        <TextInput
          style={s.timerNumInput}
          value={inputSec}
          onChangeText={setInputSec}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={HINT}
          maxLength={2}
        />
        <Text style={s.timerInputLabel}>{t("recipe.sec")}</Text>
        <TouchableOpacity style={s.timerStartBtn} onPress={handleConfirm}>
          <Text style={s.timerStartBtnTxt}>{t("recipe.start")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode("idle")}>
          <Text style={{ fontSize: 12, color: SUB }}>{t("recipe.cancel")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progress = totalSec > 0 ? (totalSec - remaining) / totalSec : 0;
  return (
    <View style={[s.timerCounting, isDone && s.timerDone, running && !isDone && s.timerRunning]}>
      <Ionicons name="timer-outline" size={14} color={isDone ? "#EA580C" : running ? BRAND : SUB} />
      <Text style={[s.timerDisplay, isDone && { color: "#EA580C" }, running && !isDone && { color: BRAND }]}>
        {isDone ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="notifications-outline" size={14} color="#EA580C" />
            <Text style={[s.timerDisplay, { color: "#EA580C" }]}>{t("recipe.timeUp")}</Text>
          </View>
        ) : fmt(remaining)}
      </Text>
      {!isDone && totalSec > 0 && (
        <View style={s.timerProgress}>
          <View style={[s.timerProgressFill, { width: `${progress * 100}%` as any }]} />
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 4, marginLeft: "auto" as any }}>
        {isDone ? (
          <TouchableOpacity style={s.timerStopBtn} onPress={() => { setRunning(false); handleReset(); }}>
            <Text style={s.timerStopBtnTxt}>{t("recipe.stop")}</Text>
          </TouchableOpacity>
        ) : running ? (
          <TouchableOpacity style={s.timerControlBtn} onPress={() => setRunning(false)}>
            <Ionicons name="pause" size={13} color={BRAND} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.timerControlBtn, { backgroundColor: BRAND }]} onPress={() => setRunning(true)}>
            <Ionicons name="play" size={13} color="#fff" />
          </TouchableOpacity>
        )}
        {!isDone && (
          <>
            <TouchableOpacity style={s.timerControlBtn} onPress={handleReset}>
              <Ionicons name="refresh" size={13} color={SUB} />
            </TouchableOpacity>
            <TouchableOpacity style={s.timerControlBtn} onPress={() => { setRunning(false); setMode("input"); }}>
              <Ionicons name="pencil" size={11} color={SUB} />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  timerIdle: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#F9F6F2", borderRadius: 10, borderWidth: 1.5, borderColor: BORDER, alignSelf: "flex-start" as any, borderStyle: "dashed" as any },
  timerIdleTxt: { fontSize: 12, color: SUB, fontWeight: "600" },
  timerIdleActive: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#E8F0FA", borderRadius: 10, borderWidth: 1.5, borderColor: COPPER, alignSelf: "flex-start" as any },
  timerIdleActiveTxt: { fontSize: 12, color: BRAND, fontWeight: "700" },
  timerInput: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, padding: 8, backgroundColor: "#E8F0FA", borderRadius: 12, borderWidth: 1.5, borderColor: COPPER, flexWrap: "wrap" as any },
  timerInputLabel: { fontSize: 12, color: SUB },
  timerNumInput: { width: 44, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1.5, borderColor: COPPER, fontSize: 14, fontWeight: "700", textAlign: "center" as any, backgroundColor: CARD, color: TEXT },
  timerStartBtn: { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: BRAND, borderRadius: 8 },
  timerStartBtnTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },
  timerCounting: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, padding: 8, backgroundColor: "#F9F6F2", borderRadius: 12, borderWidth: 1.5, borderColor: BORDER },
  timerRunning: { backgroundColor: "#E8F0FA", borderColor: COPPER },
  timerDone: { backgroundColor: "#FFF7ED", borderColor: "#FB923C" },
  timerDisplay: { fontVariant: ["tabular-nums"] as any, fontSize: 17, fontWeight: "900", color: SUB, minWidth: 52 },
  timerProgress: { flex: 1, height: 4, backgroundColor: "#E5E7EB", borderRadius: 99, overflow: "hidden" },
  timerProgressFill: { height: "100%" as any, backgroundColor: BRAND, borderRadius: 99 },
  timerControlBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: "#E8F0FA", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: BORDER },
  timerStopBtn: { paddingHorizontal: 12, paddingVertical: 5, height: 30, borderRadius: 8, backgroundColor: "#EA580C", alignItems: "center", justifyContent: "center" },
  timerStopBtnTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },
});
