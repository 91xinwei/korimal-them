import { useMemo, useState, type DragEvent } from "react";
import { Eye, EyeOff, GripVertical, Percent, Split } from "lucide-react";
import {
  TOP_INFO_COLUMN_OPTIONS,
  TOP_INFO_ITEM_OPTIONS,
  TOP_INFO_PROGRESS_ITEM_IDS,
  TOP_INFO_SPLIT_ITEM_IDS,
  type TopInfoColumnCount,
  type TopInfoItemId,
  type TopInfoProgressItemId,
  type TopInfoProgressSettings,
  type TopInfoSettings,
  type TopInfoSplitItemId,
  type TopInfoSplitSettings,
  type VisualStyleSettings,
} from "@/hooks/useVisualStyle";

type TopInfoPatch = Pick<
  VisualStyleSettings,
  "topInfo" | "topInfoProgress" | "topInfoSplit" | "topInfoOrder" | "topInfoColumns"
>;

interface TopInfoSettingsPanelProps {
  settings: TopInfoSettings;
  progress: TopInfoProgressSettings;
  split: TopInfoSplitSettings;
  order: TopInfoItemId[];
  columns: TopInfoColumnCount;
  onChange: (patch: Partial<TopInfoPatch>) => void;
  manage?: boolean;
}

export function TopInfoSettingsPanel({
  settings,
  progress,
  split,
  order,
  columns,
  onChange,
  manage = false,
}: TopInfoSettingsPanelProps) {
  const [draggingId, setDraggingId] = useState<TopInfoItemId | null>(null);
  const [dragOverId, setDragOverId] = useState<TopInfoItemId | null>(null);
  const optionById = useMemo(
    () => new Map(TOP_INFO_ITEM_OPTIONS.map((option) => [option.id, option])),
    [],
  );
  const orderedOptions = useMemo(() => {
    const seen = new Set<TopInfoItemId>();
    const normalized = order
      .map((id) => optionById.get(id))
      .filter((option): option is (typeof TOP_INFO_ITEM_OPTIONS)[number] =>
        Boolean(option),
      )
      .filter((option) => {
        if (seen.has(option.id)) return false;
        seen.add(option.id);
        return true;
      });

    for (const option of TOP_INFO_ITEM_OPTIONS) {
      if (seen.has(option.id)) continue;
      normalized.push(option);
    }

    return normalized;
  }, [optionById, order]);

  const toggleItem = (id: TopInfoItemId) => {
    onChange({
      topInfo: {
        ...settings,
        [id]: !settings[id],
      },
    });
  };

  const isProgressItem = (id: TopInfoItemId): id is TopInfoProgressItemId =>
    TOP_INFO_PROGRESS_ITEM_IDS.includes(id as TopInfoProgressItemId);

  const toggleProgress = (id: TopInfoProgressItemId) => {
    onChange({
      topInfoProgress: {
        ...progress,
        [id]: !progress[id],
      },
    });
  };

  const isSplitItem = (id: TopInfoItemId): id is TopInfoSplitItemId =>
    TOP_INFO_SPLIT_ITEM_IDS.includes(id as TopInfoSplitItemId);

  const toggleSplit = (id: TopInfoSplitItemId) => {
    onChange({
      topInfoSplit: {
        ...split,
        [id]: !split[id],
      },
    });
  };

  const moveItem = (fromId: TopInfoItemId, toId: TopInfoItemId) => {
    if (fromId === toId) return;
    const ids = orderedOptions.map((option) => option.id);
    const fromIndex = ids.indexOf(fromId);
    const toIndex = ids.indexOf(toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...ids];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange({ topInfoOrder: next });
  };

  const handleDragStart = (
    event: DragEvent<HTMLDivElement>,
    id: TopInfoItemId,
  ) => {
    setDraggingId(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (
    event: DragEvent<HTMLDivElement>,
    id: TopInfoItemId,
  ) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  };

  const handleDrop = (
    event: DragEvent<HTMLDivElement>,
    id: TopInfoItemId,
  ) => {
    event.preventDefault();
    const fromId = event.dataTransfer.getData("text/plain") as TopInfoItemId;
    if (fromId) moveItem(fromId, id);
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  return (
    <div className="top-info-settings-panel">
      <div className="top-info-layout-card">
        <div className="top-info-layout-head">
          <span>每行数量</span>
          <strong>
            {columns === 0
              ? "自动"
              : `${TOP_INFO_COLUMN_OPTIONS.find((option) => option.value === columns)?.label ?? columns}`}
          </strong>
        </div>
        <div className="top-info-column-list" role="list">
          {TOP_INFO_COLUMN_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="top-info-column-button"
              data-active={columns === option.value ? "true" : "false"}
              onClick={() => onChange({ topInfoColumns: option.value })}
              title={option.description}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="top-info-sort-list"
        data-manage={manage ? "true" : "false"}
        role="list"
      >
        {orderedOptions.map((option) => {
          const enabled = settings[option.id];
          const progressId = isProgressItem(option.id) ? option.id : null;
          const progressEnabled = progressId ? progress[progressId] : false;
          const splitId = isSplitItem(option.id) ? option.id : null;
          const splitEnabled = splitId ? split[splitId] : false;

          return (
            <div
              key={option.id}
              className="top-info-sort-card"
              data-active={enabled ? "true" : "false"}
              data-dragging={draggingId === option.id ? "true" : "false"}
              data-drag-over={dragOverId === option.id ? "true" : "false"}
              draggable
              onDragStart={(event) => handleDragStart(event, option.id)}
              onDragOver={(event) => handleDragOver(event, option.id)}
              onDrop={(event) => handleDrop(event, option.id)}
              onDragEnd={handleDragEnd}
              role="listitem"
            >
              <span className="top-info-drag-handle" title="拖动排序">
                <GripVertical size={15} />
              </span>
              <button
                type="button"
                className="top-info-sort-toggle"
                onClick={() => toggleItem(option.id)}
                aria-pressed={enabled}
              >
                <span className="top-info-sort-main">
                  <span className="visual-style-preset-name">{option.label}</span>
                  <span className="visual-style-preset-copy">
                    {option.description}
                  </span>
                </span>
                <span className="top-info-sort-state">
                  {enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                </span>
              </button>
              {progressId && (
                <button
                  type="button"
                  className="top-info-progress-toggle"
                  data-active={progressEnabled ? "true" : "false"}
                  onClick={() => toggleProgress(progressId)}
                  disabled={!enabled}
                  title={progressEnabled ? "隐藏百分比条" : "显示百分比条"}
                  aria-pressed={progressEnabled}
                >
                  <Percent size={13} />
                  <span>{progressEnabled ? "百分比条" : "已隐藏"}</span>
                </button>
              )}
              {splitId && (
                <button
                  type="button"
                  className="top-info-progress-toggle top-info-split-toggle"
                  data-active={splitEnabled ? "true" : "false"}
                  onClick={() => toggleSplit(splitId)}
                  disabled={!enabled}
                  title={splitEnabled ? "合并显示" : "拆开显示"}
                  aria-pressed={splitEnabled}
                >
                  <Split size={13} />
                  <span>{splitEnabled ? "已拆开" : "拆开显示"}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
