import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Modal, ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  getLearningPaths, getModules, getLessons, saveQuiz, generateId,
  STANDALONE_LESSON_ID,
  type LearningPath, type Module, type Lesson, type Quiz,
} from "@/utils/storage";
import Colors, { shadowSm } from "@/constants/colors";
import { toast } from "@/components/Toast";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type QuizType = "multiple-choice" | "true-false";

const LETTERS = ["A", "B", "C", "D"];

export function QuickAddQuizModal({ visible, onClose, onSaved }: Props) {
  const [quizType, setQuizType] = useState<QuizType>("multiple-choice");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [answerIndex, setAnswerIndex] = useState<number | null>(null);
  const [tfAnswer, setTfAnswer] = useState<"Benar" | "Salah" | null>(null);
  const [explanation, setExplanation] = useState("");
  const [saving, setSaving] = useState(false);

  const [courses, setCourses] = useState<LearningPath[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selCourse, setSelCourse] = useState<LearningPath | null>(null);
  const [selModule, setSelModule] = useState<Module | null>(null);
  const [selLesson, setSelLesson] = useState<Lesson | null>(null);
  const [pickerStep, setPickerStep] = useState<"course" | "module" | "lesson" | null>(null);

  useEffect(() => {
    if (!visible) return;
    reset();
    getLearningPaths().then(setCourses);
  }, [visible]);

  useEffect(() => {
    if (!selCourse) { setModules([]); setLessons([]); return; }
    getModules(selCourse.id).then((m) => setModules(m.sort((a, b) => a.order - b.order)));
  }, [selCourse]);

  useEffect(() => {
    if (!selModule) { setLessons([]); return; }
    getLessons(selModule.id).then((l) => setLessons(l.sort((a, b) => a.order - b.order)));
  }, [selModule]);

  const reset = () => {
    setQuizType("multiple-choice"); setQuestion(""); setOptions(["", "", "", ""]);
    setAnswerIndex(null); setTfAnswer(null); setExplanation("");
    setSelCourse(null); setSelModule(null); setSelLesson(null); setPickerStep(null);
  };

  const updateOption = (i: number, val: string) => {
    setOptions((prev) => { const next = [...prev]; next[i] = val; return next; });
  };

  const handleSave = async () => {
    if (!question.trim()) { toast.error("Pertanyaan wajib diisi"); return; }
    let finalOptions: string[] = [];
    let finalAnswer = "";

    if (quizType === "multiple-choice") {
      finalOptions = options.map((o) => o.trim()).filter(Boolean);
      if (finalOptions.length < 2) { toast.error("Minimal 2 pilihan jawaban"); return; }
      if (answerIndex === null || !options[answerIndex]?.trim()) {
        toast.error("Pilih jawaban yang benar"); return;
      }
      finalAnswer = options[answerIndex].trim();
    } else {
      finalOptions = ["Benar", "Salah"];
      if (!tfAnswer) { toast.error("Pilih Benar atau Salah"); return; }
      finalAnswer = tfAnswer;
    }

    setSaving(true);
    try {
      const quiz: Quiz = {
        id: generateId(), lessonId: selLesson?.id ?? STANDALONE_LESSON_ID,
        question: question.trim(), options: finalOptions,
        answer: finalAnswer, type: quizType,
        explanation: explanation.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      await saveQuiz(quiz);
      toast.success(selLesson ? "Soal berhasil ditambahkan!" : "Soal disimpan ke Koleksi Pribadi!");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error("Gagal menyimpan: " + (e?.message ?? ""));
    } finally {
      setSaving(false);
    }
  };

  const lessonLabel = selLesson
    ? `${selCourse?.name} › ${selModule?.name} › ${selLesson.name}`
    : "Pilih pelajaran tujuan";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.header}>
              <Text style={s.title}>Tambah Soal Quiz</Text>
              <TouchableOpacity style={s.closeBtn} onPress={onClose}>
                <Feather name="x" size={20} color={Colors.dark} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">

              {/* Lesson Picker */}
              <Text style={s.label}>Assign ke Pelajaran <Text style={s.optional}>(opsional — bisa diisi nanti)</Text></Text>
              <TouchableOpacity
                style={[s.pickerBtn, selLesson ? s.pickerBtnActive : null]}
                onPress={() => setPickerStep("course")}
              >
                <Feather name="book-open" size={16} color={selLesson ? Colors.danger : Colors.textMuted} />
                <Text style={[s.pickerBtnText, selLesson ? { color: Colors.danger } : null]} numberOfLines={1}>
                  {lessonLabel}
                </Text>
                <Feather name="chevron-right" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              {!selLesson && (
                <View style={s.standaloneBadge}>
                  <Feather name="user" size={12} color={Colors.textMuted} />
                  <Text style={s.standaloneBadgeText}>Akan masuk ke Koleksi Pribadi kamu</Text>
                </View>
              )}

              {/* Quiz type toggle */}
              <Text style={[s.label, { marginTop: 16 }]}>Tipe Soal</Text>
              <View style={s.typeRow}>
                {(["multiple-choice", "true-false"] as QuizType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[s.typeBtn, quizType === t && s.typeBtnActive]}
                    onPress={() => { setQuizType(t); setAnswerIndex(null); setTfAnswer(null); }}
                  >
                    <Feather
                      name={t === "multiple-choice" ? "list" : "toggle-right"}
                      size={15}
                      color={quizType === t ? "#fff" : Colors.textMuted}
                    />
                    <Text style={[s.typeBtnText, quizType === t && s.typeBtnTextActive]}>
                      {t === "multiple-choice" ? "Pilihan Ganda" : "Benar / Salah"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Question */}
              <Text style={s.label}>Pertanyaan *</Text>
              <TextInput
                style={[s.input, { minHeight: 72 }]} multiline placeholder="Tulis pertanyaan..."
                placeholderTextColor={Colors.textMuted} value={question}
                onChangeText={setQuestion} textAlignVertical="top"
              />

              {/* Multiple choice options */}
              {quizType === "multiple-choice" && (
                <>
                  <Text style={s.label}>Pilihan Jawaban (tap radio = jawaban benar)</Text>
                  {options.map((opt, i) => (
                    <View key={i} style={s.optRow}>
                      <TouchableOpacity
                        style={[s.radio, answerIndex === i && s.radioActive]}
                        onPress={() => setAnswerIndex(i)}
                      >
                        {answerIndex === i
                          ? <Feather name="check" size={12} color="#fff" />
                          : <Text style={s.radioLetter}>{LETTERS[i]}</Text>}
                      </TouchableOpacity>
                      <TextInput
                        style={[s.optInput, answerIndex === i && s.optInputActive]}
                        placeholder={`Pilihan ${LETTERS[i]}`}
                        placeholderTextColor={Colors.textMuted}
                        value={opt}
                        onChangeText={(v) => updateOption(i, v)}
                      />
                    </View>
                  ))}
                </>
              )}

              {/* True/False */}
              {quizType === "true-false" && (
                <>
                  <Text style={s.label}>Jawaban yang Benar</Text>
                  <View style={s.tfRow}>
                    {(["Benar", "Salah"] as const).map((v) => (
                      <TouchableOpacity
                        key={v}
                        style={[s.tfBtn, tfAnswer === v && (v === "Benar" ? s.tfTrue : s.tfFalse)]}
                        onPress={() => setTfAnswer(v)}
                      >
                        <Feather
                          name={v === "Benar" ? "check-circle" : "x-circle"}
                          size={18}
                          color={tfAnswer === v ? "#fff" : Colors.textMuted}
                        />
                        <Text style={[s.tfBtnText, tfAnswer === v && { color: "#fff" }]}>{v}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Explanation */}
              <Text style={s.label}>Penjelasan (opsional)</Text>
              <TextInput
                style={[s.input, { minHeight: 60 }]} multiline placeholder="Penjelasan jawaban..."
                placeholderTextColor={Colors.textMuted} value={explanation}
                onChangeText={setExplanation} textAlignVertical="top"
              />

              <TouchableOpacity
                style={[s.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave} disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Feather name="check" size={18} color="#fff" />}
                <Text style={s.saveBtnText}>{saving ? "Menyimpan..." : "Simpan Soal"}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        {/* Cascade picker */}
        {pickerStep === "course" && (
          <PickerSheet
            title="Pilih Kursus"
            items={courses}
            getLabel={(c) => c.name}
            getSub={(c) => c.description}
            onSelect={(c) => { setSelCourse(c); setSelModule(null); setSelLesson(null); setPickerStep("module"); }}
            onClose={() => setPickerStep(null)}
          />
        )}
        {pickerStep === "module" && selCourse && (
          <PickerSheet
            title={`Modul di "${selCourse.name}"`}
            items={modules}
            getLabel={(m) => m.name}
            getSub={(m) => m.description}
            onSelect={(m) => { setSelModule(m); setSelLesson(null); setPickerStep("lesson"); }}
            onClose={() => setPickerStep(null)}
            onBack={() => setPickerStep("course")}
          />
        )}
        {pickerStep === "lesson" && selModule && (
          <PickerSheet
            title={`Pelajaran di "${selModule.name}"`}
            items={lessons}
            getLabel={(l) => l.name}
            getSub={(l) => l.description}
            onSelect={(l) => { setSelLesson(l); setPickerStep(null); }}
            onClose={() => setPickerStep(null)}
            onBack={() => setPickerStep("module")}
          />
        )}
      </View>
    </Modal>
  );
}

function PickerSheet<T extends { id: string }>({
  title, items, getLabel, getSub, onSelect, onClose, onBack,
}: {
  title: string;
  items: T[];
  getLabel: (item: T) => string;
  getSub: (item: T) => string;
  onSelect: (item: T) => void;
  onClose: () => void;
  onBack?: () => void;
}) {
  return (
    <View style={ps.overlay}>
      <View style={ps.sheet}>
        <View style={s.handle} />
        <View style={ps.header}>
          {onBack
            ? <TouchableOpacity style={ps.iconBtn} onPress={onBack}>
                <Feather name="arrow-left" size={18} color={Colors.dark} />
              </TouchableOpacity>
            : <View style={{ width: 34 }} />}
          <Text style={ps.title} numberOfLines={1}>{title}</Text>
          <TouchableOpacity style={ps.iconBtn} onPress={onClose}>
            <Feather name="x" size={18} color={Colors.dark} />
          </TouchableOpacity>
        </View>
        {items.length === 0 ? (
          <View style={ps.empty}>
            <Feather name="inbox" size={32} color={Colors.textMuted} />
            <Text style={ps.emptyText}>Tidak ada data</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={ps.list}>
            {items.map((item) => (
              <TouchableOpacity key={item.id} style={[ps.item, shadowSm]} onPress={() => onSelect(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={ps.itemLabel}>{getLabel(item)}</Text>
                  {getSub(item) ? <Text style={ps.itemSub} numberOfLines={1}>{getSub(item)}</Text> : null}
                </View>
                <Feather name="chevron-right" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "92%", paddingBottom: 32 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginTop: 12, marginBottom: 4 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: "900", color: Colors.dark },
  closeBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 20, paddingBottom: 8, gap: 6 },
  label: { fontSize: 13, fontWeight: "700", color: Colors.dark, marginTop: 4, marginBottom: 6 },
  pickerBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: Colors.background,
  },
  pickerBtnActive: { borderColor: Colors.danger, backgroundColor: "#FFF5F5" },
  pickerBtnText: { flex: 1, fontSize: 13, fontWeight: "600", color: Colors.textMuted },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.dark,
    minHeight: 56, backgroundColor: Colors.background, marginBottom: 4,
  },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  typeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingVertical: 10, backgroundColor: Colors.background,
  },
  typeBtnActive: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  typeBtnText: { fontSize: 13, fontWeight: "700", color: Colors.textMuted },
  typeBtnTextActive: { color: "#fff" },
  optRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  radio: {
    width: 30, height: 30, borderRadius: 10, borderWidth: 2, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center", backgroundColor: Colors.background, flexShrink: 0,
  },
  radioActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  radioLetter: { fontSize: 12, fontWeight: "800", color: Colors.textMuted },
  optInput: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.dark,
    backgroundColor: Colors.background,
  },
  optInputActive: { borderColor: Colors.success, backgroundColor: "#F0FDF4" },
  tfRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  tfBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14, paddingVertical: 14,
    backgroundColor: Colors.background,
  },
  tfTrue: { backgroundColor: Colors.success, borderColor: Colors.success },
  tfFalse: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  tfBtnText: { fontSize: 15, fontWeight: "800", color: Colors.textMuted },
  optional: { fontSize: 11, fontWeight: "500", color: Colors.textMuted },
  standaloneBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.border, alignSelf: "flex-start",
  },
  standaloneBadgeText: { fontSize: 11, fontWeight: "600", color: Colors.textMuted },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.danger, borderRadius: 16, paddingVertical: 15, marginTop: 16,
  },
  saveBtnText: { fontSize: 15, fontWeight: "900", color: "#fff" },
});

const ps = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end", zIndex: 10 },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "75%", paddingBottom: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "800", color: Colors.dark },
  list: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  item: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: Colors.border },
  itemLabel: { fontSize: 14, fontWeight: "800", color: Colors.dark, marginBottom: 2 },
  itemSub: { fontSize: 12, color: Colors.textMuted, fontWeight: "500" },
  empty: { alignItems: "center", paddingVertical: 36, gap: 10 },
  emptyText: { fontSize: 14, color: Colors.textMuted, fontWeight: "600" },
});
