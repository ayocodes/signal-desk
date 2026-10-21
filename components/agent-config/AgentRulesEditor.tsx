"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  Button,
  Input,
  Pill,
  showToast,
} from "@/components/ui";
import { previewThreshold, saveAgentConfig } from "@/lib/api";
import {
  validateRules,
  type HiringCategoryRule,
  type RulesDoc,
} from "@/lib/rules";
import type { CurrentRules, RulesVersion, ThresholdPreview } from "@/lib/types";
import { VersionHistory } from "./VersionHistory";

export interface AgentRulesEditorProps {
  config: CurrentRules;
  versions?: RulesVersion[];
}

export function formatRuleError(code: string): string {
  switch (code) {
    case "out_of_range":
      return "Value is out of allowed range.";
    case "empty":
      return "Cannot be blank.";
    case "duplicate":
      return "Duplicate entry.";
    case "min_above_max":
      return "Minimum cannot be greater than maximum.";
    case "bad_id":
      return "Use lowercase letters, digits, and underscores (must start with a letter).";
    case "has_digit":
      return "Proof points cannot contain digits (numbers).";
    case "too_few":
      return "Too few entries.";
    case "too_many":
      return "Too many entries.";
    case "not_allowed":
      return "Value is not allowed.";
    case "no_strong_signal_source":
      return "At least one strong signal source (hiring or launch) must be enabled.";
    case "above_max_score":
      return "Threshold cannot be higher than the maximum possible score.";
    case "not_descending":
      return "Score bands must be ordered from highest to lowest.";
    case "lowest_band_not_threshold":
      return "The lowest score band minimum must match the threshold.";
    case "not_ascending":
      return "Freshness intervals must increase in hours.";
    case "missing":
      return "Required field is missing.";
    default:
      return code.replace(/_/g, " ");
  }
}

/** Reusable tag input for lists of phrases */
function ChipListEditor({
  items,
  onChange,
  placeholder,
  error,
  readOnly = false,
  ariaLabel,
}: {
  items: string[];
  onChange?: (items: string[]) => void;
  placeholder?: string;
  error?: string;
  readOnly?: boolean;
  ariaLabel: string;
}) {
  const [inputVal, setInputVal] = React.useState("");

  const handleAdd = () => {
    const trimmed = inputVal.trim();
    if (!trimmed || !onChange) return;
    if (!items.includes(trimmed)) {
      onChange([...items, trimmed]);
    }
    setInputVal("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRemove = (index: number) => {
    if (!onChange || readOnly) return;
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5 items-center min-h-[32px] p-2 rounded-control border border-border bg-surface">
        {items.map((item, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 rounded-control bg-surface-2 px-2 py-0.5 text-meta text-text border border-border"
          >
            <span>{item}</span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                aria-label={`Remove ${item}`}
                className="text-muted hover:text-bad rounded-xs"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {!readOnly && (
          <div className="inline-flex items-center gap-1 flex-1 min-w-[140px]">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder ?? "Add item..."}
              aria-label={ariaLabel}
              className="w-full bg-transparent text-meta text-text placeholder:text-subtle outline-none px-1 py-0.5"
            />
            {inputVal.trim() && (
              <button
                type="button"
                onClick={handleAdd}
                className="text-meta text-accent hover:underline font-medium px-1"
              >
                Add
              </button>
            )}
          </div>
        )}
      </div>
      {error && <p className="text-meta text-bad font-medium">{error}</p>}
    </div>
  );
}

export function AgentRulesEditor({ config, versions }: AgentRulesEditorProps) {
  const router = useRouter();
  const initialRules = React.useMemo(
    () => structuredClone(config.rules),
    [config.rules]
  );
  const [rules, setRules] = React.useState<RulesDoc>(initialRules);
  const [isSaving, setIsSaving] = React.useState(false);
  const [preview, setPreview] = React.useState<ThresholdPreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);

  // Validate on every change
  const errors = React.useMemo(() => validateRules(rules), [rules]);

  const errorMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const err of errors) {
      if (!map.has(err.path)) {
        map.set(err.path, formatRuleError(err.code));
      }
    }
    return map;
  }, [errors]);

  // Errors inside a list ("outreach.proofPoints.0") show under the list itself.
  const errorUnder = (prefix: string): string | undefined => {
    const err = errors.find((e) => e.path === prefix || e.path.startsWith(`${prefix}.`));
    return err ? formatRuleError(err.code) : undefined;
  };

  const isDirty = React.useMemo(() => {
    return JSON.stringify(rules) !== JSON.stringify(initialRules);
  }, [rules, initialRules]);

  // Debounced threshold preview
  React.useEffect(() => {
    let active = true;

    const timer = setTimeout(async () => {
      setIsPreviewLoading(true);
      try {
        const res = await previewThreshold(rules.threshold);
        if (active && res.ok) {
          setPreview(res.data);
        }
      } finally {
        if (active) setIsPreviewLoading(false);
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [rules.threshold]);

  const handleDiscard = () => {
    setRules(structuredClone(initialRules));
    showToast("Changes discarded", { tone: "default" });
  };

  const handleSave = async () => {
    if (errors.length > 0 || isSaving) return;
    setIsSaving(true);

    try {
      const res = await saveAgentConfig(rules);
      if (res.ok) {
        showToast(`Rules saved as version ${res.data.version}`, {
          tone: "good",
        });
        router.refresh();
      } else {
        showToast(res.error.message, { tone: "bad" });
      }
    } catch {
      showToast("Saving rules failed. Check connection.", { tone: "bad" });
    } finally {
      setIsSaving(false);
    }
  };

  // Category list reordering and management
  const moveCategory = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= rules.hiring.categories.length) return;
    setRules((prev) => {
      const list = [...prev.hiring.categories];
      const [item] = list.splice(index, 1);
      list.splice(target, 0, item);
      return {
        ...prev,
        hiring: { ...prev.hiring, categories: list },
      };
    });
  };

  const addCategory = () => {
    if (rules.hiring.categories.length >= 8) return;
    // Ids must be unique and can't be edited in the form, so take the first unused number.
    const taken = new Set(rules.hiring.categories.map((c) => c.id));
    let count = rules.hiring.categories.length + 1;
    while (taken.has(`category_${count}`)) count += 1;
    const newCat: HiringCategoryRule = {
      id: `category_${count}`,
      name: `Category ${count}`,
      enabled: true,
      points: 20,
      foundingBonus: 5,
      keywords: ["new keyword"],
      exclusions: [],
    };
    setRules((prev) => ({
      ...prev,
      hiring: {
        ...prev.hiring,
        categories: [...prev.hiring.categories, newCat],
      },
    }));
  };

  const removeCategory = (index: number) => {
    if (rules.hiring.categories.length <= 1) return;
    setRules((prev) => ({
      ...prev,
      hiring: {
        ...prev.hiring,
        categories: prev.hiring.categories.filter((_, i) => i !== index),
      },
    }));
  };

  const updateCategory = (
    index: number,
    patch: Partial<HiringCategoryRule>
  ) => {
    setRules((prev) => {
      const next = [...prev.hiring.categories];
      next[index] = { ...next[index], ...patch };
      return {
        ...prev,
        hiring: { ...prev.hiring, categories: next },
      };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Sticky top action bar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 p-4 rounded-panel border border-border bg-surface shadow-xs">
        <div className="flex items-center gap-3">
          <span className="text-body font-semibold text-text">
            Agent rules, {config.version === 0 ? "defaults" : `version ${config.version}`}
          </span>
          {isDirty ? (
            <Pill tone="warn" dot>
              Unsaved changes
            </Pill>
          ) : (
            <Pill tone="neutral" dot={false}>
              Current
            </Pill>
          )}
          {errors.length > 0 && (
            <Pill tone="bad" dot>
              {errors.length} {errors.length === 1 ? "error" : "errors"}
            </Pill>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDiscard}
            disabled={!isDirty || isSaving}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Discard changes</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || errors.length > 0 || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Save new version</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Every problem in one place, so a disabled Save always says why. */}
      {errors.length > 0 && (
        <div className="rounded-panel border border-bad/30 bg-bad/5 p-3.5 text-meta flex flex-col gap-1">
          <span className="font-medium text-bad">Fix these before saving:</span>
          <ul className="list-disc pl-5 text-text">
            {errors.slice(0, 8).map((err) => (
              <li key={`${err.path}:${err.code}`}>
                <span className="font-mono text-label text-muted">{err.path}</span> {formatRuleError(err.code)}
              </li>
            ))}
          </ul>
          {errors.length > 8 && <span className="text-subtle">and {errors.length - 8} more</span>}
        </div>
      )}

      {/* Global problem banner if defaults are running */}
      {config.problem && (
        <div className="rounded-panel border border-warn/30 bg-warn/10 p-3.5 text-meta text-warn flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{config.problem}</span>
        </div>
      )}

      {/* SECTION 1: ICP and Partial-match rules */}
      <div className="rounded-panel border border-border bg-surface p-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pb-3 border-b border-border">
          <div>
            <h2 className="text-section font-semibold text-text">
              Ideal customer profile (ICP)
            </h2>
            <p className="text-meta text-muted mt-0.5">
              Requirements for companies discovered by the agent.
            </p>
          </div>
          <span className="text-label text-subtle font-mono">
            Effect shows after the next agent run (every 30 min)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-label uppercase tracking-wider font-semibold text-muted">
              Company status
            </label>
            <select
              value={rules.icp.status}
              onChange={(e) =>
                setRules((prev) => ({
                  ...prev,
                  icp: {
                    ...prev.icp,
                    status: e.target.value as RulesDoc["icp"]["status"],
                  },
                }))
              }
              className="h-9 px-3 rounded-control border border-border bg-surface text-body text-text"
            >
              <option value="Active">Active</option>
              <option value="Acquired">Acquired</option>
              <option value="Inactive">Inactive</option>
              <option value="Public">Public</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-label uppercase tracking-wider font-semibold text-muted">
              B2B required
            </label>
            <div className="flex items-center h-9">
              <label className="inline-flex items-center gap-2 cursor-pointer text-body text-text">
                <input
                  type="checkbox"
                  checked={rules.icp.b2b}
                  onChange={(e) =>
                    setRules((prev) => ({
                      ...prev,
                      icp: { ...prev.icp, b2b: e.target.checked },
                    }))
                  }
                  className="rounded border-border accent-accent"
                />
                <span>Must be B2B</span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-label uppercase tracking-wider font-semibold text-muted">
              Max YC batch age (years)
            </label>
            <Input
              type="number"
              value={rules.icp.maxBatchAgeYears}
              onChange={(e) =>
                setRules((prev) => ({
                  ...prev,
                  icp: {
                    ...prev.icp,
                    maxBatchAgeYears: Number(e.target.value),
                  },
                }))
              }
            />
            {errorMap.get("icp.maxBatchAgeYears") && (
              <p className="text-meta text-bad">
                {errorMap.get("icp.maxBatchAgeYears")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-label uppercase tracking-wider font-semibold text-muted">
              Team size min
            </label>
            <Input
              type="number"
              value={rules.icp.teamSizeMin}
              onChange={(e) =>
                setRules((prev) => ({
                  ...prev,
                  icp: { ...prev.icp, teamSizeMin: Number(e.target.value) },
                }))
              }
            />
            {errorMap.get("icp.teamSizeMin") && (
              <p className="text-meta text-bad">
                {errorMap.get("icp.teamSizeMin")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-label uppercase tracking-wider font-semibold text-muted">
              Team size max
            </label>
            <Input
              type="number"
              value={rules.icp.teamSizeMax}
              onChange={(e) =>
                setRules((prev) => ({
                  ...prev,
                  icp: { ...prev.icp, teamSizeMax: Number(e.target.value) },
                }))
              }
            />
            {errorMap.get("icp.teamSizeMax") && (
              <p className="text-meta text-bad">
                {errorMap.get("icp.teamSizeMax")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-label uppercase tracking-wider font-semibold text-muted">
              Full match points
            </label>
            <Input
              type="number"
              value={rules.icp.points.full}
              onChange={(e) =>
                setRules((prev) => ({
                  ...prev,
                  icp: {
                    ...prev.icp,
                    points: {
                      ...prev.icp.points,
                      full: Number(e.target.value),
                    },
                  },
                }))
              }
            />
            {errorMap.get("icp.points.full") && (
              <p className="text-meta text-bad">
                {errorMap.get("icp.points.full")}
              </p>
            )}
          </div>
        </div>

        {/* Partial match sub-section */}
        <div className="pt-3 border-t border-border/70 flex flex-col gap-3">
          <span className="text-label uppercase tracking-wider font-semibold text-muted">
            Partial ICP match boundaries
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-meta text-muted">Partial team size min</label>
              <Input
                type="number"
                value={rules.partial.teamSizeMin}
                onChange={(e) =>
                  setRules((prev) => ({
                    ...prev,
                    partial: {
                      ...prev.partial,
                      teamSizeMin: Number(e.target.value),
                    },
                  }))
                }
              />
              {errorMap.get("partial.teamSizeMin") && (
                <p className="text-meta text-bad">
                  {errorMap.get("partial.teamSizeMin")}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-meta text-muted">Partial team size max</label>
              <Input
                type="number"
                value={rules.partial.teamSizeMax}
                onChange={(e) =>
                  setRules((prev) => ({
                    ...prev,
                    partial: {
                      ...prev.partial,
                      teamSizeMax: Number(e.target.value),
                    },
                  }))
                }
              />
              {errorMap.get("partial.teamSizeMax") && (
                <p className="text-meta text-bad">
                  {errorMap.get("partial.teamSizeMax")}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-meta text-muted">
                Partial match points
              </label>
              <Input
                type="number"
                value={rules.icp.points.partial}
                onChange={(e) =>
                  setRules((prev) => ({
                    ...prev,
                    icp: {
                      ...prev.icp,
                      points: {
                        ...prev.icp.points,
                        partial: Number(e.target.value),
                      },
                    },
                  }))
                }
              />
              {errorMap.get("icp.points.partial") && (
                <p className="text-meta text-bad">
                  {errorMap.get("icp.points.partial")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Hiring categories */}
      <div className="rounded-panel border border-border bg-surface p-5 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pb-3 border-b border-border">
          <div>
            <h2 className="text-section font-semibold text-text">
              Hiring categories
            </h2>
            <p className="text-meta text-muted mt-0.5">
              Categories are checked in order; the first match wins.
            </p>
          </div>
          <span className="text-label text-subtle font-mono">
            Effect shows after the next agent run (every 30 min)
          </span>
        </div>

        {errorMap.get("hiring.categories") && (
          <p className="text-meta text-bad">
            {errorMap.get("hiring.categories")}
          </p>
        )}

        <div className="flex flex-col gap-4">
          {rules.hiring.categories.map((cat, idx) => (
            <div
              key={cat.id}
              className="rounded-control border border-border bg-surface-2/40 p-4 flex flex-col gap-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-label font-mono text-muted bg-surface px-1.5 py-0.5 rounded-control border border-border">
                    #{idx + 1}
                  </span>
                  <Input
                    value={cat.name}
                    onChange={(e) =>
                      updateCategory(idx, { name: e.target.value })
                    }
                    placeholder="Category name"
                    className="font-medium text-body h-8 w-48"
                  />
                  {errorMap.get(`hiring.categories.${idx}.name`) && (
                    <span className="text-meta text-bad">
                      {errorMap.get(`hiring.categories.${idx}.name`)}
                    </span>
                  )}
                  <span className="font-mono text-label text-subtle">
                    ({cat.id})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-meta text-text mr-2">
                    <input
                      type="checkbox"
                      checked={cat.enabled}
                      onChange={(e) =>
                        updateCategory(idx, { enabled: e.target.checked })
                      }
                      className="rounded border-border accent-accent"
                    />
                    <span>Enabled</span>
                  </label>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moveCategory(idx, -1)}
                    disabled={idx === 0}
                    aria-label={`Move ${cat.name} up`}
                    title="Move up (higher priority)"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moveCategory(idx, 1)}
                    disabled={idx === rules.hiring.categories.length - 1}
                    aria-label={`Move ${cat.name} down`}
                    title="Move down (lower priority)"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCategory(idx)}
                    disabled={rules.hiring.categories.length <= 1}
                    aria-label={`Delete ${cat.name}`}
                    title="Delete category"
                  >
                    <Trash2 className="h-4 w-4 text-bad" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-meta text-muted w-24 shrink-0">
                    Points:
                  </label>
                  <Input
                    type="number"
                    value={cat.points}
                    onChange={(e) =>
                      updateCategory(idx, { points: Number(e.target.value) })
                    }
                    className="h-8 w-24"
                  />
                  {errorMap.get(`hiring.categories.${idx}.points`) && (
                    <span className="text-meta text-bad">
                      {errorMap.get(`hiring.categories.${idx}.points`)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-meta text-muted w-32 shrink-0">
                    Founding bonus:
                  </label>
                  <Input
                    type="number"
                    value={cat.foundingBonus}
                    onChange={(e) =>
                      updateCategory(idx, {
                        foundingBonus: Number(e.target.value),
                      })
                    }
                    className="h-8 w-24"
                  />
                  {errorMap.get(`hiring.categories.${idx}.foundingBonus`) && (
                    <span className="text-meta text-bad">
                      {errorMap.get(`hiring.categories.${idx}.foundingBonus`)}
                    </span>
                  )}
                </div>
              </div>

              {/* Keywords chips */}
              <div className="flex flex-col gap-1">
                <span className="text-label uppercase tracking-wider font-semibold text-muted">
                  Keywords ({cat.keywords.length})
                </span>
                <ChipListEditor
                  items={cat.keywords}
                  onChange={(keywords) => updateCategory(idx, { keywords })}
                  placeholder="Add role keyword..."
                  ariaLabel={`Keywords for ${cat.name}`}
                  error={errorUnder(`hiring.categories.${idx}.keywords`)}
                />
              </div>

              {/* Exclusion chips */}
              <div className="flex flex-col gap-1">
                <span className="text-label uppercase tracking-wider font-semibold text-muted">
                  Category exclusions ({cat.exclusions.length})
                </span>
                <ChipListEditor
                  items={cat.exclusions}
                  onChange={(exclusions) => updateCategory(idx, { exclusions })}
                  placeholder="Add category exclusion..."
                  ariaLabel={`Exclusions for ${cat.name}`}
                  error={errorUnder(`hiring.categories.${idx}.exclusions`)}
                />
              </div>
            </div>
          ))}

          {rules.hiring.categories.length < 8 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={addCategory}
              className="self-start"
            >
              <Plus className="h-4 w-4" />
              <span>Add hiring category</span>
            </Button>
          )}
        </div>

        {/* Shared founding phrases and global exclusions */}
        <div className="pt-4 border-t border-border flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-label uppercase tracking-wider font-semibold text-muted">
              Shared founding role phrases
            </span>
            <ChipListEditor
              items={rules.hiring.founding}
              onChange={(founding) =>
                setRules((prev) => ({
                  ...prev,
                  hiring: { ...prev.hiring, founding },
                }))
              }
              placeholder="Add founding phrase..."
              ariaLabel="Founding phrases"
              error={errorUnder("hiring.founding")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-label uppercase tracking-wider font-semibold text-muted">
              Global role exclusions
            </span>
            <ChipListEditor
              items={rules.hiring.exclude}
              onChange={(exclude) =>
                setRules((prev) => ({
                  ...prev,
                  hiring: { ...prev.hiring, exclude },
                }))
              }
              placeholder="Add global exclusion..."
              ariaLabel="Global exclusions"
              error={errorUnder("hiring.exclude")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-label uppercase tracking-wider font-semibold text-muted">
              Global exclusion exceptions
            </span>
            <ChipListEditor
              items={rules.hiring.excludeExceptions}
              onChange={(excludeExceptions) =>
                setRules((prev) => ({
                  ...prev,
                  hiring: { ...prev.hiring, excludeExceptions },
                }))
              }
              placeholder="Add exception phrase..."
              ariaLabel="Exclusion exceptions"
              error={errorUnder("hiring.excludeExceptions")}
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: Other signal types */}
      <div className="rounded-panel border border-border bg-surface p-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pb-3 border-b border-border">
          <div>
            <h2 className="text-section font-semibold text-text">
              Other buying signals
            </h2>
            <p className="text-meta text-muted mt-0.5">
              Launch signals and YC batch funding signals.
            </p>
          </div>
          <span className="text-label text-subtle font-mono">
            Effect shows after the next agent run (every 30 min)
          </span>
        </div>

        {errorMap.get("signals") && (
          <p className="text-meta text-bad">{errorMap.get("signals")}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-control border border-border bg-surface-2/40 p-3.5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-body text-text">
                Product launch
              </span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-meta text-text">
                <input
                  type="checkbox"
                  checked={rules.signals.launch.enabled}
                  onChange={(e) =>
                    setRules((prev) => ({
                      ...prev,
                      signals: {
                        ...prev.signals,
                        launch: {
                          ...prev.signals.launch,
                          enabled: e.target.checked,
                        },
                      },
                    }))
                  }
                  className="rounded border-border accent-accent"
                />
                <span>Enabled</span>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-meta text-muted">Points:</label>
              <Input
                type="number"
                value={rules.signals.launch.points}
                onChange={(e) =>
                  setRules((prev) => ({
                    ...prev,
                    signals: {
                      ...prev.signals,
                      launch: {
                        ...prev.signals.launch,
                        points: Number(e.target.value),
                      },
                    },
                  }))
                }
                className="h-8 w-24"
              />
              {errorMap.get("signals.launch.points") && (
                <span className="text-meta text-bad">
                  {errorMap.get("signals.launch.points")}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-control border border-border bg-surface-2/40 p-3.5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-body text-text">
                YC recent batch
              </span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-meta text-text">
                <input
                  type="checkbox"
                  checked={rules.signals.ycRecent.enabled}
                  onChange={(e) =>
                    setRules((prev) => ({
                      ...prev,
                      signals: {
                        ...prev.signals,
                        ycRecent: {
                          ...prev.signals.ycRecent,
                          enabled: e.target.checked,
                        },
                      },
                    }))
                  }
                  className="rounded border-border accent-accent"
                />
                <span>Enabled</span>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-meta text-muted">Points:</label>
              <Input
                type="number"
                value={rules.signals.ycRecent.points}
                onChange={(e) =>
                  setRules((prev) => ({
                    ...prev,
                    signals: {
                      ...prev.signals,
                      ycRecent: {
                        ...prev.signals.ycRecent,
                        points: Number(e.target.value),
                      },
                    },
                  }))
                }
                className="h-8 w-24"
              />
              {errorMap.get("signals.ycRecent.points") && (
                <span className="text-meta text-bad">
                  {errorMap.get("signals.ycRecent.points")}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: Queue threshold with LIVE preview */}
      <div className="rounded-panel border border-border bg-surface p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-section font-semibold text-text">
            Queue threshold
          </h2>
          <p className="text-meta text-muted mt-0.5">
            Minimum score required for a lead to appear in the review queue.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <label className="text-meta font-medium text-text">Threshold:</label>
            <Input
              type="number"
              value={rules.threshold}
              onChange={(e) => {
                const val = Number(e.target.value);
                setRules((prev) => {
                  // Keep lowest band min equal to threshold automatically if matching
                  const lastBandIdx = prev.scoreBands.length - 1;
                  const nextBands = [...prev.scoreBands];
                  if (lastBandIdx >= 0) {
                    nextBands[lastBandIdx] = {
                      ...nextBands[lastBandIdx],
                      min: val,
                    };
                  }
                  return {
                    ...prev,
                    threshold: val,
                    scoreBands: nextBands,
                  };
                });
              }}
              className="h-9 w-28 font-mono text-body"
            />
          </div>

          <div className="flex items-center gap-2 text-meta text-muted">
            {isPreviewLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                <span>Checking queue counts...</span>
              </div>
            ) : preview ? (
              <span className="font-mono text-text bg-surface-2 px-2.5 py-1 rounded-control border border-border">
                {preview.wouldBeReady} leads in the queue at this threshold, was{" "}
                {preview.readyNow}
              </span>
            ) : null}
          </div>
        </div>

        {errorMap.get("threshold") && (
          <p className="text-meta text-bad">{errorMap.get("threshold")}</p>
        )}
      </div>

      {/* SECTION 5: Score bands, Freshness, Stacking, Windows */}
      <div className="rounded-panel border border-border bg-surface p-5 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pb-3 border-b border-border">
          <div>
            <h2 className="text-section font-semibold text-text">
              Score calculation and windows
            </h2>
            <p className="text-meta text-muted mt-0.5">
              Score bands, freshness decay, multi-signal bonus, and lookback
              windows.
            </p>
          </div>
          <span className="text-label text-subtle font-mono">
            Effect shows after the next agent run (every 30 min)
          </span>
        </div>

        {/* Score bands */}
        <div className="flex flex-col gap-2">
          <span className="text-label uppercase tracking-wider font-semibold text-muted">
            Score bands
          </span>
          {errorUnder("scoreBands") && (
            <p className="text-meta text-bad">{errorUnder("scoreBands")}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {rules.scoreBands.map((band, idx) => (
              <div
                key={idx}
                className="rounded-control border border-border bg-surface-2/40 p-2.5 flex items-center gap-2"
              >
                <Input
                  value={band.label}
                  onChange={(e) => {
                    const next = [...rules.scoreBands];
                    next[idx] = { ...next[idx], label: e.target.value };
                    setRules((prev) => ({ ...prev, scoreBands: next }));
                  }}
                  className="h-8 text-meta"
                  placeholder="Band label"
                />
                <Input
                  type="number"
                  value={band.min}
                  onChange={(e) => {
                    const next = [...rules.scoreBands];
                    next[idx] = {
                      ...next[idx],
                      min: Number(e.target.value),
                    };
                    setRules((prev) => ({ ...prev, scoreBands: next }));
                  }}
                  className="h-8 w-20 text-meta font-mono"
                  placeholder="Min"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Freshness table */}
        <div className="flex flex-col gap-2">
          <span className="text-label uppercase tracking-wider font-semibold text-muted">
            Freshness decay points
          </span>
          {errorUnder("freshness") && (
            <p className="text-meta text-bad">{errorUnder("freshness")}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {rules.freshness.map((step, idx) => (
              <div
                key={idx}
                className="rounded-control border border-border bg-surface-2/40 p-2.5 flex items-center justify-between gap-2 text-meta"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-muted">Under</span>
                  <Input
                    type="number"
                    value={step.maxHours}
                    onChange={(e) => {
                      const next = [...rules.freshness];
                      next[idx] = {
                        ...next[idx],
                        maxHours: Number(e.target.value),
                      };
                      setRules((prev) => ({ ...prev, freshness: next }));
                    }}
                    // Wide enough for "168" next to the browser's up/down arrows.
                    className="h-8 w-24 shrink-0 text-meta font-mono"
                  />
                  <span className="text-muted">hours:</span>
                </div>
                <Input
                  type="number"
                  value={step.points}
                  onChange={(e) => {
                    const next = [...rules.freshness];
                    next[idx] = {
                      ...next[idx],
                      points: Number(e.target.value),
                    };
                    setRules((prev) => ({ ...prev, freshness: next }));
                  }}
                  className="h-8 w-16 text-meta font-mono"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Stacking bonus and windows */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-label uppercase tracking-wider font-semibold text-muted">
              Extra signal type bonus
            </label>
            <Input
              type="number"
              value={rules.stackedPerExtraSignalType}
              onChange={(e) =>
                setRules((prev) => ({
                  ...prev,
                  stackedPerExtraSignalType: Number(e.target.value),
                }))
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-label uppercase tracking-wider font-semibold text-muted">
              Jobs refresh (hours)
            </label>
            <Input
              type="number"
              value={rules.signalWindows.jobsRefreshHours}
              onChange={(e) =>
                setRules((prev) => ({
                  ...prev,
                  signalWindows: {
                    ...prev.signalWindows,
                    jobsRefreshHours: Number(e.target.value),
                  },
                }))
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-label uppercase tracking-wider font-semibold text-muted">
              Launch lookback (days)
            </label>
            <Input
              type="number"
              value={rules.signalWindows.launchLookbackDays}
              onChange={(e) =>
                setRules((prev) => ({
                  ...prev,
                  signalWindows: {
                    ...prev.signalWindows,
                    launchLookbackDays: Number(e.target.value),
                  },
                }))
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-label uppercase tracking-wider font-semibold text-muted">
              Funding lookback (months)
            </label>
            <Input
              type="number"
              value={rules.signalWindows.fundingRecentMonths}
              onChange={(e) =>
                setRules((prev) => ({
                  ...prev,
                  signalWindows: {
                    ...prev.signalWindows,
                    fundingRecentMonths: Number(e.target.value),
                  },
                }))
              }
            />
          </div>
        </div>
      </div>

      {/* SECTION 6: Outreach */}
      <div className="rounded-panel border border-border bg-surface p-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pb-3 border-b border-border">
          <div>
            <h2 className="text-section font-semibold text-text">Outreach</h2>
            <p className="text-meta text-muted mt-0.5">
              Sender branding, default offer pitch, and verified proof points.
            </p>
          </div>
          <span className="text-label text-subtle font-mono">
            Effect shows after the next agent run (every 30 min)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-label uppercase tracking-wider font-semibold text-muted">
              Sender name
            </label>
            <Input
              value={rules.outreach.senderName}
              onChange={(e) =>
                setRules((prev) => ({
                  ...prev,
                  outreach: {
                    ...prev.outreach,
                    senderName: e.target.value,
                  },
                }))
              }
            />
            {errorMap.get("outreach.senderName") && (
              <p className="text-meta text-bad">
                {errorMap.get("outreach.senderName")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-label uppercase tracking-wider font-semibold text-muted">
              Offer summary
            </label>
            <Input
              value={rules.outreach.offer}
              onChange={(e) =>
                setRules((prev) => ({
                  ...prev,
                  outreach: {
                    ...prev.outreach,
                    offer: e.target.value,
                  },
                }))
              }
            />
            {errorMap.get("outreach.offer") && (
              <p className="text-meta text-bad">
                {errorMap.get("outreach.offer")}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-label uppercase tracking-wider font-semibold text-muted">
              Allowed customer proof points (cannot contain digits)
            </label>
            <span className="text-label text-subtle font-mono">
              {rules.outreach.proofPoints.length} of 6
            </span>
          </div>
          <ChipListEditor
            items={rules.outreach.proofPoints}
            onChange={(proofPoints) =>
              setRules((prev) => ({
                ...prev,
                outreach: { ...prev.outreach, proofPoints },
              }))
            }
            placeholder="Add customer claim proof point..."
            ariaLabel="Customer proof points"
            error={errorUnder("outreach.proofPoints")}
          />
        </div>
      </div>

      {/* SECTION 7: Email guardrails */}
      <div className="rounded-panel border border-border bg-surface p-5 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pb-3 border-b border-border">
          <div>
            <h2 className="text-section font-semibold text-text">
              Email guardrails
            </h2>
            <p className="text-meta text-muted mt-0.5">
              Draft validation parameters and house style rules.
            </p>
          </div>
          <span className="text-label text-subtle font-mono">
            Effect shows after the next agent run (every 30 min)
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <label className="text-meta font-medium text-text">
            Max body words (40 to 150):
          </label>
          <Input
            type="number"
            value={rules.guardrails.maxBodyWords}
            onChange={(e) =>
              setRules((prev) => ({
                ...prev,
                guardrails: {
                  ...prev.guardrails,
                  maxBodyWords: Number(e.target.value),
                },
              }))
            }
            className="h-9 w-28 font-mono"
          />
          {errorMap.get("guardrails.maxBodyWords") && (
            <p className="text-meta text-bad">
              {errorMap.get("guardrails.maxBodyWords")}
            </p>
          )}
        </div>

        {/* Custom extra banned phrases */}
        <div className="flex flex-col gap-1.5">
          <label className="text-label uppercase tracking-wider font-semibold text-muted">
            Custom banned phrases
          </label>
          <ChipListEditor
            items={rules.guardrails.extraBannedPhrases}
            onChange={(extraBannedPhrases) =>
              setRules((prev) => ({
                ...prev,
                guardrails: {
                  ...prev.guardrails,
                  extraBannedPhrases,
                },
              }))
            }
            placeholder="Add phrase to ban..."
            ariaLabel="Custom banned phrases"
            error={errorUnder("guardrails.extraBannedPhrases")}
          />
        </div>

        {/* Locked rules and built-in banned phrases */}
        <div className="rounded-control border border-border/80 bg-surface-2/40 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-meta font-semibold text-text">
            <Lock className="h-4 w-4 text-muted shrink-0" />
            <span>Locked guardrails (enforced for all drafts)</span>
          </div>

          <ul className="flex flex-col gap-2 text-meta text-muted list-none p-0 m-0">
            <li className="flex items-baseline gap-2">
              <span className="font-semibold text-text shrink-0">
                Grounding:
              </span>
              <span>every email must quote a real signal</span>
            </li>
            <li className="flex items-baseline gap-2">
              <span className="font-semibold text-text shrink-0">
                Invented facts:
              </span>
              <span>
                numbers and customer claims must come from the signals or proof
                points
              </span>
            </li>
            <li className="flex items-baseline gap-2">
              <span className="font-semibold text-text shrink-0">
                No em or en dashes:
              </span>
              <span>house style for every email</span>
            </li>
          </ul>

          <div className="flex flex-col gap-1.5 pt-2 border-t border-border/60">
            <span className="text-label uppercase tracking-wider font-semibold text-muted">
              Built-in banned phrases (read-only)
            </span>
            <ChipListEditor
              items={config.builtInBannedPhrases}
              readOnly
              ariaLabel="Built-in banned phrases"
            />
          </div>
        </div>
      </div>

      {/* Version history */}
      {versions && <VersionHistory versions={versions} />}
    </div>
  );
}
