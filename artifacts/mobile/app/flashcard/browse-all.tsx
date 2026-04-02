import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator, Modal, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import {
  getLearningPaths, getModules, getLessons, getFlashcards, saveFlashcard,
  STANDALONE_LESSON_ID,
  type LearningPath, type Module, type Lesson, type Flashcard,
} from "@/utils/storage";
import Colors, { shadowSm } from "@/constants/colors";
import { useTranslation } from "@/contexts/LanguageContext";
import { QuickAddFlashcardModal } from "@/components/QuickAddFlashcardModal";

interface LessonRow {
  path: LearningPath;
  module: Module;
  lesson: Lesson;
  count: number;
}

const GRAD: [string, string][] = [
  ["#4C6FFF", "#7C47FF"],
  ["#FF6B6B", "#FF9500"],
  ["#38BDF8", "#0EA5E9"],
  ["#7C3AED", "#A855F7"],
  ["#10B981", "#059669"],
  ["#F59E0B", "#EF4444"],
];

const STANDALONE_GRAD: [string, string] = ["#10B981", "#059669"];

// ─── Assign Modal ───────────────────────────────────────────────
function AssignModal({
  card,
  onClose,
  onAssigned,
}: {
  card: Flashcard;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [courses, setCourses] = useState<LearningPath[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [step, setStep] = useState<"course" | "module" | "lesson">("course");
  const [selCourse, setSelCourse] = useState<LearningPath | null>(null);
  const [selModule, setSelModule] = useState<Module | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getLearningPaths().then(setCourses);
  }, []);

  useEffect(() => {
    if (!selCourse) return;
    getModules(selCourse.id).then((m) => setModules(m.sort((a, b) => a.order - b.order)));
  }, [selCourse]);

  useEffect(() => {
    if (!selModule) return;
    getLessons(selModule.id).then((l) => setLessons(l.sort((a, b) => a.order - b.order)));
  }, [selModule]);

  const handleAssign = async (lesson: Lesson) => {
    setSaving(true);
    try {
      await saveFlashcard({ ...card, lessonId: lesson.id });
      onAssigned();
      onClose();
    } catch {
      setSaving(false);
    }
  };

  const title =
    step === "course" ? "Pilih Kursus" :
    step === "module" ? `Modul di "${selCourse?.name}"` :
    `Pelajaran di "${selModule?.name}"`;

  const items: (LearningPath | Module | Lesson)[] =
    step === "course" ? courses :
    step === "module" ? modules :
    lessons;

  const getLabel = (item: LearningPath | Module | Lesson) => item.name;

  const onSelect = (item: LearningPath | Module | Lesson) => {
    if (step === "course") {
      setSelCourse(item as LearningPath);
      setStep("module");
    } else if (step === "module") {
      setSelModule(item as Module);
      setStep("lesson");
    } else {
      handleAssign(item as Lesson);
    }
  };

  const onBack = () => {
    if (step === "module") setStep("course");
    else if (step === "lesson") setStep("module");
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={am.overlay}>
        <View style={am.sheet}>
          <View style={am.handle} />
          <View style={am.header}>
            {step !== "course" ? (
              <TouchableOpacity style={am.backBtn} onPress={onBack}>
                <Feather name="arrow-left" size={18} color={Colors.dark} />
              </TouchableOpacity>
            ) : <View style={{ width: 34 }} />}
            <Text style={am.title} numberOfLines={1}>{title}</Text>
            <TouchableOpacity style={am.backBtn} onPress={onClose}>
              <Feather name="x" size={18} color={Colors.dark} />
            </TouchableOpacity>
          </View>

          <Text style={am.cardPreview} numberOfLines={2}>"{card.question}"</Text>

          {saving ? (
            <View style={am.loadingWrap}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={{ color: Colors.textMuted, fontSize: 13, fontWeight: "600" }}>Memindahkan...</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={am.empty}>
              <Feather name="inbox" size={32} color={Colors.textMuted} />
              <Text style={am.emptyText}>Tidak ada data</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={am.list}>
              {(items as Array<{ id: string; name: string; description?: string }>).map((item) => (
                <TouchableOpacity key={item.id} style={[am.item, shadowSm]} onPress={() => onSelect(item as any)}>
                  <View style={{ flex: 1 }}>
                    <Text style={am.itemLabel}>{getLabel(item as any)}</Text>
                    {item.description ? (
                      <Text style={am.itemSub} numberOfLines={1}>{item.description}</Text>
                    ) : null}
                  </View>
                  <Feather name="chevron-right" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ────────────────────────────────────────────────
export default function FlashcardBrowseAll() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [standaloneCards, setStandaloneCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [standaloneExpanded, setStandaloneExpanded] = useState(false);
  const [assignCard, setAssignCard] = useState<Flashcard | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [paths, standalone] = await Promise.all([
      getLearningPaths(),
      getFlashcards(STANDALONE_LESSON_ID),
    ]);
    setStandaloneCards(standalone);

    const result: LessonRow[] = [];
    for (const path of paths) {
      const mods = (await getModules(path.id)).sort((a, b) => a.order - b.order);
      for (const mod of mods) {
        const lessonList = (await getLessons(mod.id)).sort((a, b) => a.order - b.order);
        for (const lesson of lessonList) {
          const cards = await getFlashcards(lesson.id);
          result.push({ path, module: mod, lesson, count: cards.length });
        }
      }
    }
    setRows(result);
    if (result.length > 0) {
      setExpanded({ [result[0].path.id]: true });
    }
    setLoading(false);
  }, []);

  // Group by path
  const grouped = useMemo(() => {
    const filtered = rows.filter((r) => {
      const q = search.toLowerCase();
      return (
        r.path.name.toLowerCase().includes(q) ||
        r.module.name.toLowerCase().includes(q) ||
        r.lesson.name.toLowerCase().includes(q)
      );
    });
    const map: Record<string, { path: LearningPath; modules: Record<string, { module: Module; lessons: LessonRow[] }> }> = {};
    for (const row of filtered) {
      if (!map[row.path.id]) map[row.path.id] = { path: row.path, modules: {} };
      if (!map[row.path.id].modules[row.module.id])
        map[row.path.id].modules[row.module.id] = { module: row.module, lessons: [] };
      map[row.path.id].modules[row.module.id].lessons.push(row);
    }
    return Object.values(map);
  }, [rows, search]);

  const filteredStandalone = useMemo(() => {
    if (!search) return standaloneCards;
    const q = search.toLowerCase();
    return standaloneCards.filter(
      (c) => c.question.toLowerCase().includes(q) || c.answer.toLowerCase().includes(q) || (c.tag ?? "").toLowerCase().includes(q)
    );
  }, [standaloneCards, search]);

  const totalCards = rows.reduce((s, r) => s + r.count, 0) + standaloneCards.length;
  const pathColors = useMemo(() => {
    const map: Record<string, [string, string]> = {};
    rows.forEach((r, i) => { if (!map[r.path.id]) map[r.path.id] = GRAD[i % GRAD.length]; });
    return map;
  }, [rows]);

  const hasContent = grouped.length > 0 || filteredStandalone.length > 0;

  return (
    <View style={styles.root}>
      {/* Modals */}
      <QuickAddFlashcardModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSaved={loadAll}
      />
      {assignCard && (
        <AssignModal
          card={assignCard}
          onClose={() => setAssignCard(null)}
          onAssigned={loadAll}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={() => setShowAdd(true)}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Header */}
      <LinearGradient
        colors={["#4C6FFF", "#7C47FF"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: Platform.OS === "web" ? 56 : insets.top + 12 }]}
      >
        <View style={styles.blob1} />
        <View style={styles.blob2} />
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSub}>{t.common.cards.toUpperCase()}</Text>
            <Text style={styles.headerTitle}>{t.browse.flash_header}</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{totalCards}</Text>
            <Text style={styles.countBadgeSub}>{t.common.cards.toLowerCase()}</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Feather name="search" size={15} color={Colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t.browse.search_ph}
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>{t.common.loading}</Text>
        </View>
      ) : !hasContent ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🃏</Text>
          <Text style={styles.emptyTitle}>
            {(rows.length === 0 && standaloneCards.length === 0) ? t.browse.empty_flash : t.browse.not_found}
          </Text>
          <Text style={styles.emptySub}>
            {(rows.length === 0 && standaloneCards.length === 0) ? t.browse.flash_empty_sub : t.browse.try_other}
          </Text>
          <TouchableOpacity
            style={styles.emptyFabHint}
            onPress={() => setShowAdd(true)}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.emptyFabHintText}>Tambah Flashcard Pertama</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>

          {/* ── Koleksi Pribadi (standalone) ── */}
          {filteredStandalone.length > 0 && (
            <View style={[styles.courseCard, shadowSm, styles.standaloneCard]}>
              {/* Section header */}
              <TouchableOpacity
                style={styles.courseHeader}
                onPress={() => setStandaloneExpanded((p) => !p)}
                activeOpacity={0.75}
              >
                <LinearGradient colors={STANDALONE_GRAD} style={styles.courseIcon}>
                  <Feather name="user" size={20} color="#fff" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.courseName}>Koleksi Pribadi</Text>
                  <Text style={styles.courseMeta}>
                    {filteredStandalone.length} kartu · Tidak terikat kursus
                  </Text>
                </View>
                <View style={styles.standaloneActions}>
                  {filteredStandalone.length > 0 && (
                    <TouchableOpacity
                      style={[styles.startBtn, { backgroundColor: STANDALONE_GRAD[0], width: 36, height: 36, borderRadius: 10 }]}
                      onPress={() => router.push(`/flashcard/${STANDALONE_LESSON_ID}` as any)}
                    >
                      <Feather name="play" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                  <Feather name={standaloneExpanded ? "chevron-up" : "chevron-down"} size={16} color={Colors.textMuted} />
                </View>
              </TouchableOpacity>

              {/* Individual cards when expanded */}
              {standaloneExpanded && (
                <View style={styles.moduleWrap}>
                  <View style={styles.moduleLabel}>
                    <View style={[styles.moduleDot, { backgroundColor: STANDALONE_GRAD[0] }]} />
                    <Text style={styles.moduleName}>Kartu Mandiri</Text>
                  </View>
                  {filteredStandalone.map((card) => (
                    <View key={card.id} style={[styles.lessonRow, styles.standaloneCardRow]}>
                      <View style={styles.lessonLeft}>
                        <View style={[styles.lessonDot, { backgroundColor: STANDALONE_GRAD[0] + "60" }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.lessonName} numberOfLines={2}>{card.question}</Text>
                          <Text style={styles.lessonDesc} numberOfLines={1}>{card.answer}</Text>
                          {card.tag ? (
                            <View style={styles.tagChip}>
                              <Text style={styles.tagText}>#{card.tag}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.assignBtn}
                        onPress={() => setAssignCard(card)}
                        activeOpacity={0.8}
                      >
                        <Feather name="folder-plus" size={13} color={Colors.primary} />
                        <Text style={styles.assignBtnText}>Assign</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── Course-linked flashcards ── */}
          {grouped.map(({ path, modules }) => {
            const isOpen = !!expanded[path.id];
            const grad = pathColors[path.id] ?? GRAD[0];
            const total = Object.values(modules).reduce((s, m) => s + m.lessons.reduce((ss, l) => ss + l.count, 0), 0);

            return (
              <View key={path.id} style={[styles.courseCard, shadowSm]}>
                {/* Course header */}
                <TouchableOpacity
                  style={styles.courseHeader}
                  onPress={() => setExpanded((p) => ({ ...p, [path.id]: !p[path.id] }))}
                  activeOpacity={0.75}
                >
                  <LinearGradient colors={grad} style={styles.courseIcon}>
                    <Text style={{ fontSize: 18 }}>{path.name.charAt(0).toUpperCase()}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.courseName} numberOfLines={1}>{path.name}</Text>
                    <Text style={styles.courseMeta}>
                      {Object.keys(modules).length} {t.common.modules} · {total} {t.common.cards}
                    </Text>
                  </View>
                  <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={Colors.textMuted} />
                </TouchableOpacity>

                {/* Modules + Lessons */}
                {isOpen && Object.values(modules).map(({ module, lessons }) => (
                  <View key={module.id} style={styles.moduleWrap}>
                    <View style={styles.moduleLabel}>
                      <View style={[styles.moduleDot, { backgroundColor: grad[0] }]} />
                      <Text style={styles.moduleName} numberOfLines={1}>{module.name}</Text>
                    </View>
                    {lessons.map((row) => (
                      <TouchableOpacity
                        key={row.lesson.id}
                        style={[styles.lessonRow, { opacity: row.count === 0 ? 0.5 : 1 }]}
                        onPress={() => {
                          if (row.count > 0) router.push(`/flashcard/${row.lesson.id}` as any);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.lessonLeft}>
                          <View style={styles.lessonDot} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.lessonName} numberOfLines={1}>{row.lesson.name}</Text>
                            {row.lesson.description ? (
                              <Text style={styles.lessonDesc} numberOfLines={1}>{row.lesson.description}</Text>
                            ) : null}
                          </View>
                        </View>
                        <View style={styles.lessonRight}>
                          {row.count > 0 ? (
                            <>
                              <View style={[styles.countChip, { backgroundColor: grad[0] + "18" }]}>
                                <Text style={[styles.countChipText, { color: grad[0] }]}>{row.count} kartu</Text>
                              </View>
                              <View style={[styles.startBtn, { backgroundColor: grad[0] }]}>
                                <Feather name="play" size={11} color="#fff" />
                              </View>
                            </>
                          ) : (
                            <Text style={styles.emptyChip}>Kosong</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 20, overflow: "hidden" },
  blob1: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(74,158,255,0.1)", top: -50, right: -40 },
  blob2: { position: "absolute", width: 110, height: 110, borderRadius: 55, backgroundColor: "rgba(108,99,255,0.08)", bottom: -20, left: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerSub: { fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  headerTitle: { fontSize: 22, fontWeight: "900", color: "#fff", letterSpacing: -0.3 },
  countBadge: { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center" },
  countBadgeText: { fontSize: 20, fontWeight: "900", color: "#fff" },
  countBadgeSub: { fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: "700" },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.dark, fontWeight: "500" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, color: Colors.textMuted, fontWeight: "600" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: Colors.dark, textAlign: "center" },
  emptySub: { fontSize: 14, color: Colors.textMuted, fontWeight: "500", textAlign: "center", lineHeight: 20 },
  emptyFabHint: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12,
  },
  emptyFabHintText: { fontSize: 14, fontWeight: "800", color: "#fff" },
  list: { padding: 16, paddingBottom: 100, gap: 12 },
  courseCard: { backgroundColor: "#fff", borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  standaloneCard: { borderColor: "#10B981" + "40" },
  courseHeader: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  courseIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  courseName: { fontSize: 15, fontWeight: "800", color: Colors.dark },
  courseMeta: { fontSize: 12, color: Colors.textMuted, fontWeight: "600", marginTop: 2 },
  standaloneActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  moduleWrap: { borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  moduleLabel: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  moduleDot: { width: 8, height: 8, borderRadius: 4 },
  moduleName: { fontSize: 12, fontWeight: "800", color: Colors.textSecondary, flex: 1 },
  lessonRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, paddingLeft: 16, paddingRight: 4,
    borderRadius: 12, marginBottom: 4,
    backgroundColor: Colors.background,
  },
  standaloneCardRow: { alignItems: "flex-start", paddingRight: 8 },
  lessonLeft: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 10, minWidth: 0 },
  lessonDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border, flexShrink: 0, marginTop: 5 },
  lessonName: { fontSize: 13, fontWeight: "700", color: Colors.dark },
  lessonDesc: { fontSize: 11, color: Colors.textMuted, fontWeight: "500", marginTop: 1 },
  tagChip: {
    alignSelf: "flex-start", backgroundColor: Colors.primaryLight,
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4,
  },
  tagText: { fontSize: 10, fontWeight: "700", color: Colors.primary },
  lessonRight: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 },
  countChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  countChipText: { fontSize: 11, fontWeight: "800" },
  startBtn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  emptyChip: { fontSize: 11, color: Colors.textMuted, fontWeight: "600" },
  assignBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1.5, borderColor: Colors.primary + "40",
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5,
    backgroundColor: Colors.primaryLight, marginLeft: 8, flexShrink: 0, marginTop: 2,
  },
  assignBtnText: { fontSize: 11, fontWeight: "800", color: Colors.primary },
  fab: {
    position: "absolute", right: 20, width: 56, height: 56, borderRadius: 18,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
    zIndex: 50, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 10,
  },
});

// ─── Assign Modal Styles ────────────────────────────────────────
const am = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "80%", paddingBottom: 28 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginTop: 12, marginBottom: 4 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "800", color: Colors.dark },
  cardPreview: {
    marginHorizontal: 20, marginBottom: 12, fontSize: 13, fontWeight: "600",
    color: Colors.textSecondary, fontStyle: "italic",
    backgroundColor: Colors.background, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderLeftWidth: 3, borderLeftColor: Colors.primary,
  },
  loadingWrap: { alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  list: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  item: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: Colors.border },
  itemLabel: { fontSize: 14, fontWeight: "800", color: Colors.dark, marginBottom: 2 },
  itemSub: { fontSize: 12, color: Colors.textMuted, fontWeight: "500" },
  empty: { alignItems: "center", paddingVertical: 36, gap: 10 },
  emptyText: { fontSize: 14, color: Colors.textMuted, fontWeight: "600" },
});
