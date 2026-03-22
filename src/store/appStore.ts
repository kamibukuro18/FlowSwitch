import { useState, useCallback } from "react";
import { Config, Mode, AppSettings, ModeExecutionResult } from "../types";

export type View = "modes" | "editor" | "settings" | "execution";

export type AppState = {
  config: Config | null;
  settings: AppSettings;
  currentView: View;
  editingMode: Mode | null;
  lastExecutionResult: ModeExecutionResult | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
};

const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  language: "en",
};

export function useAppStore() {
  const [state, setState] = useState<AppState>({
    config: null,
    settings: DEFAULT_SETTINGS,
    currentView: "modes",
    editingMode: null,
    lastExecutionResult: null,
    isLoading: false,
    error: null,
    searchQuery: "",
  });

  const setConfig = useCallback((config: Config | null) => {
    setState((s) => ({ ...s, config }));
  }, []);

  const setSettings = useCallback((settings: Partial<AppSettings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...settings } }));
  }, []);

  const navigateTo = useCallback((view: View) => {
    setState((s) => ({ ...s, currentView: view }));
  }, []);

  const startEditingMode = useCallback((mode: Mode | null) => {
    setState((s) => ({ ...s, editingMode: mode, currentView: "editor" }));
  }, []);

  const setLastExecutionResult = useCallback(
    (result: ModeExecutionResult | null) => {
      setState((s) => ({ ...s, lastExecutionResult: result }));
    },
    []
  );

  const setLoading = useCallback((isLoading: boolean) => {
    setState((s) => ({ ...s, isLoading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((s) => ({ ...s, error }));
  }, []);

  const setSearchQuery = useCallback((searchQuery: string) => {
    setState((s) => ({ ...s, searchQuery }));
  }, []);

  const saveMode = useCallback((mode: Mode) => {
    setState((s) => {
      if (!s.config) return s;
      const existing = s.config.modes.findIndex((m) => m.id === mode.id);
      const modes =
        existing >= 0
          ? s.config.modes.map((m) => (m.id === mode.id ? mode : m))
          : [...s.config.modes, mode];
      return {
        ...s,
        config: { ...s.config, modes },
        currentView: "modes",
        editingMode: null,
      };
    });
  }, []);

  const deleteMode = useCallback((modeId: string) => {
    setState((s) => {
      if (!s.config) return s;
      return {
        ...s,
        config: {
          ...s.config,
          modes: s.config.modes.filter((m) => m.id !== modeId),
        },
      };
    });
  }, []);

  return {
    state,
    setConfig,
    setSettings,
    navigateTo,
    startEditingMode,
    setLastExecutionResult,
    setLoading,
    setError,
    setSearchQuery,
    saveMode,
    deleteMode,
  };
}
