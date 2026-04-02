import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Modal, ScrollView, ActivityIndicator, Platform, Image, KeyboardAvoidingView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "@/utils/fs-compat";
import {
  getLearningPaths, getModules, getLessons, saveFlashcard, generateId,
  STANDALONE_LESSON_ID,
  type LearningPath, type Module, type Lesson, type Flashcard,
} from "@/utils/storage";
import Colors, { shadowSm } from "@/constants/colors";
import { toast } from "@/components/Toast";

const IMAGE_DIR = (FileSystem.documentDirectory ?? "") + "flashcard-images/";

const ensureDir = async () => {
  if ((Platform.OS as string) === "web") return;
  const info = await FileSystem.getInfoAsync(IMAGE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function QuickAddFlashcardModal({ visible, onClose, onSaved }: Props) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [tag, setTag] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
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
    setQuestion(""); setAnswer(""); setTag(""); setImageUri(null);
    setSelCourse(null); setSelModule(null); setSelLesson(null); setPickerStep(null);
  };

  const pickImage = async () => {
    if ((Platform.OS as string) !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") { toast.error("Izinkan akses galeri"); return; }
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.8 });
    if (!r.canceled && r.assets[0]) setImageUri(r.assets[0].uri);
  };

  const handleSave = async () => {
    if (!question.trim() || !answer.trim()) { toast.error("Pertanyaan dan jawaban wajib diisi"); return; }
    setSaving(true);
    try {
      const id = generateId();
      let savedImage: string | undefined;
      if (imageUri && (Platform.OS as string) !== "web") {
        try {
          await ensureDir();
          const ext = imageUri.split(".").pop()?.split("?")[0] ?? "jpg";
          const dest = IMAGE_DIR + id + "." + ext;
          await FileSystem.copyAsync({ from: imageUri, to: dest });
          savedImage = dest;
        } catch { savedImage = imageUri; }
      } else if (imageUri) { savedImage = imageUri; }

      const card: Flashcard = {
        id,
        lessonId: selLesson?.id ?? STANDALONE_LESSON_ID,
        question: question.trim(), answer: answer.trim(), tag: tag.trim(),
        image: savedImage, createdAt: new Date().toISOString(),
      };
      await saveFlashcard(card);
      toast.success(selLesson ? "Flashcard berhasil ditambahkan!" : "Flashcard disimpan ke Koleksi Pribadi!");
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
              <Text style={s.title}>Tambah Flashcard</Text>
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
                <Feather name="book-open" size={16} color={selLesson ? Colors.primary : Colors.textMuted} />
                <Text style={[s.pickerBtnText, selLesson ? { color: Colors.primary } : null]} numberOfLines={1}>
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

              {/* Form */}
              <Text style={[s.label, { marginTop: 16 }]}>Pertanyaan / Depan Kartu *</Text>
              <TextInput
                style={s.input} multiline placeholder="Tulis pertanyaan..."
                placeholderTextColor={Colors.textMuted} value={question}
                onChangeText={setQuestion} textAlignVertical="top"
              />

              <Text style={s.label}>Jawaban / Belakang Kartu *</Text>
              <TextInput
                style={[s.input, { minHeight: 80 }]} multiline placeholder="Tulis jawaban..."
                placeholderTextColor={Colors.textMuted} value={answer}
                onChangeText={setAnswer} textAlignVertical="top"
              />

              <Text style={s.label}>Tag (opsional)</Text>
              <TextInput
                style={[s.input, { minHeight: 44 }]} placeholder="contoh: biologi-sel"
                placeholderTextColor={Colors.textMuted} value={tag}
                onChangeText={setTag}
              />

              {/* Image */}
              <TouchableOpacity style={s.imgBtn} onPress={pickImage}>
                <Feather name="image" size={16} color={Colors.primary} />
                <Text style={s.imgBtnText}>{imageUri ? "Ganti Gambar" : "Tambah Gambar (opsional)"}</Text>
              </TouchableOpacity>
              {imageUri ? (
                <View style={s.imgPreviewWrap}>
                  <Image source={{ uri: imageUri }} style={s.imgPreview} resizeMode="cover" />
                  <TouchableOpacity style={s.imgRemove} onPress={() => setImageUri(null)}>
                    <Feather name="x" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity
                style={[s.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave} disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Feather name="check" size={18} color="#fff" />}
                <Text style={s.saveBtnText}>{saving ? "Menyimpan..." : "Simpan Flashcard"}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        {/* Cascade picker modals */}
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
            ? <TouchableOpacity style={ps.backBtn} onPress={onBack}>
                <Feather name="arrow-left" size={18} color={Colors.dark} />
              </TouchableOpacity>
            : <View style={{ width: 34 }} />}
          <Text style={ps.title} numberOfLines={1}>{title}</Text>
          <TouchableOpacity style={ps.backBtn} onPress={onClose}>
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
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "90%", paddingBottom: 32 },
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
  pickerBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  pickerBtnText: { flex: 1, fontSize: 13, fontWeight: "600", color: Colors.textMuted },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.dark,
    minHeight: 56, backgroundColor: Colors.background, marginBottom: 4,
  },
  imgBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: Colors.primaryLight, borderRadius: 12,
    backgroundColor: Colors.primaryLight, marginTop: 4, marginBottom: 4,
  },
  imgBtnText: { fontSize: 13, fontWeight: "700", color: Colors.primary },
  imgPreviewWrap: { position: "relative", alignSelf: "flex-start", marginBottom: 4 },
  imgPreview: { width: 100, height: 75, borderRadius: 10 },
  imgRemove: { position: "absolute", top: 4, right: 4, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 10, padding: 3 },
  optional: { fontSize: 11, fontWeight: "500", color: Colors.textMuted },
  standaloneBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.border, alignSelf: "flex-start",
  },
  standaloneBadgeText: { fontSize: 11, fontWeight: "600", color: Colors.textMuted },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 15, marginTop: 16,
  },
  saveBtnText: { fontSize: 15, fontWeight: "900", color: "#fff" },
});

const ps = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end", zIndex: 10 },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "75%", paddingBottom: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "800", color: Colors.dark },
  list: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  item: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: Colors.border },
  itemLabel: { fontSize: 14, fontWeight: "800", color: Colors.dark, marginBottom: 2 },
  itemSub: { fontSize: 12, color: Colors.textMuted, fontWeight: "500" },
  empty: { alignItems: "center", paddingVertical: 36, gap: 10 },
  emptyText: { fontSize: 14, color: Colors.textMuted, fontWeight: "600" },
});
