import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform,
  Modal,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import {
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  PenLine,
  FileText,
  Clock,
} from "lucide-react-native";
import {
  getNotes,
  saveNote,
  deleteNote,
  getLessons,
  generateId,
  type Note,
} from "@/utils/storage";
import Colors from "@/constants/colors";
import { toast } from "@/components/Toast";
import { useTranslation } from "@/contexts/LanguageContext";

export default function NotesScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { t } = useTranslation();
  const [notes, setNotes] = useState<Note[]>([]);
  const [lessonName, setLessonName] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showModal, setShowModal] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [lessonId]);

  const loadData = async () => {
    const data = await getNotes(lessonId);
    setNotes(data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    const lessons = await getLessons();
    const lesson = lessons.find((l) => l.id === lessonId);
    if (lesson) setLessonName(lesson.name);
  };

  const openAdd = () => {
    setEditNote(null);
    setTitle("");
    setContent("");
    setShowModal(true);
  };

  const openEdit = (note: Note) => {
    setEditNote(note);
    setTitle(note.title);
    setContent(note.content);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error(t.notes.error_title);
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    const note: Note = {
      id: editNote?.id ?? generateId(),
      lessonId: lessonId ?? "",
      title: title.trim(),
      content: content.trim(),
      createdAt: editNote?.createdAt ?? now,
      updatedAt: now,
    };
    await saveNote(note);
    setSaving(false);
    setShowModal(false);
    toast.success(editNote ? t.notes.updated : t.notes.saved);
    loadData();
  };

  const handleDelete = (note: Note) => {
    Alert.alert(t.notes.delete_title, t.notes.delete_msg(note.title), [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.delete,
        style: "destructive",
        onPress: async () => {
          await deleteNote(note.id);
          toast.info(t.notes.deleted);
          loadData();
        },
      },
    ]);
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === "web" ? 60 : insets.top + 12 },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <X size={20} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSub} numberOfLines={1}>
            {lessonName}
          </Text>
          <Text style={styles.headerTitle}>{t.common.notes}</Text>
        </View>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
          <Plus size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollViewCompat
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      >
        {notes.length === 0 ? (
          <TouchableOpacity style={styles.emptyCard} onPress={openAdd} activeOpacity={0.85}>
            <FileText size={40} color={Colors.primary} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>{t.notes.empty_title}</Text>
            <Text style={styles.emptySub}>{t.notes.empty_sub}</Text>
          </TouchableOpacity>
        ) : (
          notes.map((note) => {
            const isOpen = !!expanded[note.id];
            return (
              <View key={note.id} style={styles.noteCard}>
                <TouchableOpacity
                  style={styles.noteHeader}
                  onPress={() => toggleExpand(note.id)}
                  activeOpacity={0.75}
                >
                  <View style={styles.noteIconWrap}>
                    <PenLine size={16} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.noteTitle}>{note.title}</Text>
                    <View style={styles.noteMeta}>
                      <Clock size={10} color={Colors.textMuted} />
                      <Text style={styles.noteDate}>{formatDate(note.updatedAt)}</Text>
                    </View>
                  </View>
                  <View style={styles.noteActions}>
                    <TouchableOpacity
                      onPress={() => openEdit(note)}
                      style={styles.iconBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <PenLine size={14} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(note)}
                      style={[styles.iconBtn, styles.iconBtnDanger]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={14} color={Colors.danger} />
                    </TouchableOpacity>
                    {isOpen ? (
                      <ChevronUp size={16} color={Colors.textMuted} />
                    ) : (
                      <ChevronDown size={16} color={Colors.textMuted} />
                    )}
                  </View>
                </TouchableOpacity>

                {isOpen && (
                  <View style={styles.noteBody}>
                    {note.content ? (
                      <Text style={styles.noteContent}>{note.content}</Text>
                    ) : (
                      <Text style={styles.noteContentEmpty}>
                        (tidak ada isi catatan)
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </KeyboardAwareScrollViewCompat>

      {/* Add / Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalBox,
              { paddingBottom: Math.max(insets.bottom, 24) + 16 },
            ]}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {editNote ? t.notes.modal_edit : t.notes.modal_new}
            </Text>

            <Text style={styles.fieldLabel}>{t.notes.title_ph.replace("...", "")}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t.notes.title_ph}
              style={styles.input}
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>{t.common.notes}</Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder={t.notes.content_ph}
              style={[styles.input, styles.textArea]}
              placeholderTextColor={Colors.textMuted}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                style={styles.saveBtn}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? t.common.saving : t.common.save}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  headerTitle: { fontSize: 22, fontWeight: "900", color: Colors.white },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: { padding: 16, paddingBottom: 40, gap: 10 },
  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 36,
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    borderStyle: "dashed",
    marginTop: 24,
  },
  emptyTitle: { fontSize: 17, fontWeight: "900", color: Colors.dark },
  emptySub: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: "500",
    textAlign: "center",
  },
  noteCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  noteIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  noteTitle: { fontSize: 14, fontWeight: "800", color: Colors.dark },
  noteMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  noteDate: { fontSize: 10, color: Colors.textMuted, fontWeight: "500" },
  noteActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnDanger: { backgroundColor: Colors.dangerLight },
  noteBody: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: 14,
    backgroundColor: Colors.background,
  },
  noteContent: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: "500",
    lineHeight: 22,
  },
  noteContentEmpty: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: "italic",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10,22,40,0.55)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: "900", color: Colors.dark, marginBottom: 4 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "600",
    color: Colors.dark,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginTop: 6,
  },
  textArea: { height: 160, textAlignVertical: "top" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 14, fontWeight: "700", color: Colors.textSecondary },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
  },
  saveBtnText: { fontSize: 14, fontWeight: "900", color: Colors.white },
});
