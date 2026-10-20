"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Activity,
  ArrowLeft,
  Check,
  Inbox,
  LogOut,
  Palette,
  Search,
  Send,
  Settings,
  Users,
} from "lucide-react";
import { signOut } from "@/app/(auth)/login/actions";
import { Kbd } from "@/components/ui";
import type { Role } from "@/lib/auth";
import { applyTheme, readStoredTheme, saveTheme } from "@/lib/theme-client";
import { isThemeId, THEME_CHOICES, type ThemeId } from "@/lib/themes";

export interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  role?: Role;
}

export function CommandPalette({
  open: controlledOpen,
  onOpenChange,
  role = "rep",
}: CommandPaletteProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = controlledOpen ?? internalOpen;

  const [view, setView] = React.useState<"root" | "theme">("root");
  const [search, setSearch] = React.useState("");
  const [activeValue, setActiveValue] = React.useState("");

  const setIsOpen = React.useCallback(
    (openState: boolean) => {
      if (onOpenChange) {
        onOpenChange(openState);
      } else {
        setInternalOpen(openState);
      }
    },
    [onOpenChange]
  );

  const handleClose = React.useCallback(() => {
    if (view === "theme") {
      applyTheme(readStoredTheme());
    }
    setView("root");
    setSearch("");
    setIsOpen(false);
  }, [view, setIsOpen]);

  // Global ⌘K / Ctrl+K keyboard shortcut
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          handleClose();
        } else {
          setView("root");
          setSearch("");
          setIsOpen(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose, setIsOpen]);



  const handleSelectNav = (path: string) => {
    handleClose();
    router.push(path);
  };

  const handleOpenTheme = () => {
    setView("theme");
    setSearch("");
    setActiveValue(readStoredTheme());
  };

  const handleSelectTheme = async (themeId: ThemeId) => {
    await saveTheme(themeId);
    setView("root");
    setSearch("");
    setIsOpen(false);
  };

  const handleBackToRoot = () => {
    applyTheme(readStoredTheme());
    setView("root");
    setSearch("");
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-xs select-none"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg rounded-dialog border border-border bg-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          loop
          label="Command Palette"
          value={activeValue}
          onValueChange={(val) => {
            setActiveValue(val);
            if (view === "theme" && isThemeId(val)) {
              applyTheme(val);
            }
          }}
          className="flex flex-col w-full bg-surface"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              if (view === "theme") {
                handleBackToRoot();
              } else {
                handleClose();
              }
            } else if (e.key === "Backspace" && !search && view === "theme") {
              e.preventDefault();
              handleBackToRoot();
            }
          }}
        >
          {/* Header & Search Input */}
          <div className="flex h-12 items-center border-b border-border px-3.5 gap-2">
            {view === "theme" ? (
              <button
                type="button"
                onClick={handleBackToRoot}
                aria-label="Back to commands"
                className="rounded-control p-1 text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <Search className="h-4 w-4 text-muted shrink-0" aria-hidden="true" />
            )}
            <Command.Input
              autoFocus
              value={search}
              onValueChange={setSearch}
              placeholder={
                view === "theme" ? "Search themes..." : "Type a command or search..."
              }
              className="flex-1 bg-transparent text-body text-text placeholder:text-subtle outline-none"
            />
            <Kbd>ESC</Kbd>
          </div>

          {/* Results List */}
          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-meta text-muted">
              No results found.
            </Command.Empty>

            {view === "root" && (
              <>
                <Command.Group
                  heading="Navigation"
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-label [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:font-mono"
                >
                  <Command.Item
                    value="queue"
                    onSelect={() => handleSelectNav("/queue")}
                    className="flex h-9 items-center gap-2.5 rounded-control px-2.5 text-body text-text cursor-pointer select-none transition-colors data-[selected=true]:bg-surface-2"
                  >
                    <Inbox className="h-4 w-4 text-muted shrink-0" />
                    <span>Go to Queue</span>
                  </Command.Item>

                  <Command.Item
                    value="leads"
                    onSelect={() => handleSelectNav("/leads")}
                    className="flex h-9 items-center gap-2.5 rounded-control px-2.5 text-body text-text cursor-pointer select-none transition-colors data-[selected=true]:bg-surface-2"
                  >
                    <Users className="h-4 w-4 text-muted shrink-0" />
                    <span>Go to Leads</span>
                  </Command.Item>

                  <Command.Item
                    value="sequences"
                    onSelect={() => handleSelectNav("/sequences")}
                    className="flex h-9 items-center gap-2.5 rounded-control px-2.5 text-body text-text cursor-pointer select-none transition-colors data-[selected=true]:bg-surface-2"
                  >
                    <Send className="h-4 w-4 text-muted shrink-0" />
                    <span>Go to Sequences</span>
                  </Command.Item>

                  {role === "admin" && (
                    <Command.Item
                      value="ops"
                      onSelect={() => handleSelectNav("/ops")}
                      className="flex h-9 items-center gap-2.5 rounded-control px-2.5 text-body text-text cursor-pointer select-none transition-colors data-[selected=true]:bg-surface-2"
                    >
                      <Activity className="h-4 w-4 text-muted shrink-0" />
                      <span>Go to Ops</span>
                    </Command.Item>
                  )}

                  <Command.Item
                    value="settings"
                    onSelect={() => handleSelectNav("/settings")}
                    className="flex h-9 items-center gap-2.5 rounded-control px-2.5 text-body text-text cursor-pointer select-none transition-colors data-[selected=true]:bg-surface-2"
                  >
                    <Settings className="h-4 w-4 text-muted shrink-0" />
                    <span>Go to Settings</span>
                  </Command.Item>
                </Command.Group>

                <Command.Group
                  heading="Actions"
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-label [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:font-mono mt-1"
                >
                  <Command.Item
                    value="change theme"
                    onSelect={handleOpenTheme}
                    className="flex h-9 items-center gap-2.5 rounded-control px-2.5 text-body text-text cursor-pointer select-none transition-colors data-[selected=true]:bg-surface-2"
                  >
                    <Palette className="h-4 w-4 text-muted shrink-0" />
                    <span>Change theme…</span>
                  </Command.Item>

                  <Command.Item
                    value="sign out"
                    onSelect={async () => {
                      handleClose();
                      await signOut();
                    }}
                    className="flex h-9 items-center gap-2.5 rounded-control px-2.5 text-body text-bad cursor-pointer select-none transition-colors data-[selected=true]:bg-bad/10"
                  >
                    <LogOut className="h-4 w-4 text-bad shrink-0" />
                    <span>Sign out</span>
                  </Command.Item>
                </Command.Group>
              </>
            )}

            {view === "theme" && (
              <Command.Group
                heading="Select theme (preview live, Enter to save, Esc to cancel)"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-label [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:font-mono"
              >
                {THEME_CHOICES.map((choice) => {
                  const isSaved = readStoredTheme() === choice.id;

                  return (
                    <Command.Item
                      key={choice.id}
                      value={choice.id}
                      onSelect={() => handleSelectTheme(choice.id)}
                      onMouseEnter={() => applyTheme(choice.id)}
                      className="flex h-9 items-center justify-between rounded-control px-2.5 text-body text-text cursor-pointer select-none transition-colors data-[selected=true]:bg-surface-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <Palette className="h-4 w-4 text-muted shrink-0" />
                        <span>{choice.label}</span>
                      </div>
                      {isSaved && (
                        <Check className="h-4 w-4 text-accent shrink-0" />
                      )}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
