import { memo, useState, useCallback, useEffect } from "react";
import { Download, MessageSquare, Code, Mic, Languages } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SettingRow, SettingsSelect, SettingsHeader, SettingsSection } from "@/components/settings/shared";
import { DEFAULT_LANGUAGE, t } from "@/lib/i18n";
import type { AppLanguage, AppSettings, PreferredEditor, VoiceDictationMode } from "@/types";

interface GeneralSettingsProps {
  appSettings: AppSettings | null;
  onUpdateAppSettings: (patch: Partial<AppSettings>) => Promise<void>;
  language?: AppLanguage;
}

// ── Component ──

export const GeneralSettings = memo(function GeneralSettings({
  appSettings,
  onUpdateAppSettings,
  language = DEFAULT_LANGUAGE,
}: GeneralSettingsProps) {
  // Local optimistic state — synced from props once loaded
  const [allowPrerelease, setAllowPrerelease] = useState(false);
  const [chatLimit, setChatLimit] = useState(10);
  const [preferredEditor, setPreferredEditor] = useState<PreferredEditor>("auto");
  const [voiceDictation, setVoiceDictation] = useState<VoiceDictationMode>("native");
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(language);

  useEffect(() => {
    if (appSettings) {
      setAllowPrerelease(appSettings.allowPrereleaseUpdates);
      setChatLimit(appSettings.defaultChatLimit || 10);
      setPreferredEditor(appSettings.preferredEditor || "auto");
      setVoiceDictation(appSettings.voiceDictation || "native");
      setSelectedLanguage(appSettings.language || DEFAULT_LANGUAGE);
    }
  }, [appSettings]);

  const handleTogglePrerelease = useCallback(
    async (checked: boolean) => {
      setAllowPrerelease(checked); // optimistic
      await onUpdateAppSettings({ allowPrereleaseUpdates: checked });
    },
    [onUpdateAppSettings],
  );

  const handleChatLimitChange = useCallback(
    async (value: number) => {
      const clamped = Math.max(5, Math.min(100, value));
      setChatLimit(clamped);
      await onUpdateAppSettings({ defaultChatLimit: clamped });
    },
    [onUpdateAppSettings],
  );

  const handleEditorChange = useCallback(
    async (value: PreferredEditor) => {
      setPreferredEditor(value); // optimistic
      await onUpdateAppSettings({ preferredEditor: value });
    },
    [onUpdateAppSettings],
  );

  const handleVoiceDictationChange = useCallback(
    async (value: VoiceDictationMode) => {
      setVoiceDictation(value); // optimistic
      await onUpdateAppSettings({ voiceDictation: value });
    },
    [onUpdateAppSettings],
  );

  const handleLanguageChange = useCallback(
    async (value: AppLanguage) => {
      setSelectedLanguage(value);
      await onUpdateAppSettings({ language: value });
    },
    [onUpdateAppSettings],
  );

  return (
    <div className="flex h-full flex-col">
      <SettingsHeader title={t(language, "settings.general.title")} description={t(language, "settings.general.description")} />

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-6 py-2">
          <SettingsSection icon={Languages} label={t(language, "settings.general.language.section")} first>
            <SettingRow
              label={t(language, "settings.general.language.label")}
              description={t(language, "settings.general.language.description")}
            >
              <SettingsSelect
                value={selectedLanguage}
                onValueChange={handleLanguageChange}
                options={[
                  { value: "en", label: t(language, "settings.general.language.english") },
                  { value: "zh-CN", label: t(language, "settings.general.language.chinese") },
                ]}
              />
            </SettingRow>
          </SettingsSection>

          {/* ── Updates section ── */}
          <SettingsSection icon={Download} label={t(language, "settings.general.updates.section")}>
            <SettingRow
              label={t(language, "settings.general.updates.prerelease.label")}
              description={t(language, "settings.general.updates.prerelease.description")}
            >
              <Switch
                checked={allowPrerelease}
                onCheckedChange={handleTogglePrerelease}
              />
            </SettingRow>
          </SettingsSection>

          {/* ── Sidebar section ── */}
          <SettingsSection icon={MessageSquare} label={t(language, "settings.general.sidebar.section")}>
            <SettingRow
              label={t(language, "settings.general.sidebar.chatLimit.label")}
              description={t(language, "settings.general.sidebar.chatLimit.description")}
            >
              <SettingsSelect
                value={String(chatLimit)}
                onValueChange={(v) => handleChatLimitChange(Number(v))}
                options={[5, 10, 15, 20, 25, 30, 50, 100].map((n) => ({ value: String(n), label: String(n) }))}
              />
            </SettingRow>
          </SettingsSection>

          {/* ── Editor section ── */}
          <SettingsSection icon={Code} label={t(language, "settings.general.editor.section")}>
            <SettingRow
              label={t(language, "settings.general.editor.default.label")}
              description={t(language, "settings.general.editor.default.description")}
            >
              <SettingsSelect
                value={preferredEditor}
                onValueChange={handleEditorChange}
                options={[
                  { value: "auto", label: t(language, "settings.general.editor.auto") },
                  { value: "cursor", label: "Cursor" },
                  { value: "code", label: "VS Code" },
                  { value: "zed", label: "Zed" },
                ]}
              />
            </SettingRow>
          </SettingsSection>

          {/* ── Voice Dictation section ── */}
          <SettingsSection icon={Mic} label={t(language, "settings.general.voice.section")}>
            <SettingRow
              label={t(language, "settings.general.voice.mode.label")}
              description={t(language, "settings.general.voice.mode.description")}
            >
              <SettingsSelect
                value={voiceDictation}
                onValueChange={handleVoiceDictationChange}
                options={[
                  { value: "native", label: t(language, "settings.general.voice.native") },
                  { value: "whisper", label: t(language, "settings.general.voice.whisper") },
                ]}
              />
            </SettingRow>
          </SettingsSection>
        </div>
      </ScrollArea>
    </div>
  );
});
