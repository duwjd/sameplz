"use client";
// SKL-04: install steps per tool. Switching the tab swaps the three steps and the example command
// (CopyField falls back to selecting the text when the clipboard is blocked, m:copy).
import { useId, useState } from "react";
import { CopyField, Tabs } from "@/components/ds";

export interface InstallGuideItem {
  tool: string;
  label: string;
  steps: string[];
  command?: string;
}

export function InstallGuide({ guides }: { guides: InstallGuideItem[] }) {
  const [tool, setTool] = useState(guides[0]?.tool ?? "");
  const idPrefix = `install-${useId().replace(/:/g, "")}`;
  const current = guides.find((g) => g.tool === tool) ?? guides[0];
  if (!current) return null;
  const tabbed = guides.length > 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {tabbed && (
        <Tabs
          size="sm"
          idPrefix={idPrefix}
          value={current.tool}
          onChange={setTool}
          items={guides.map((g) => ({ value: g.tool, label: g.label }))}
        />
      )}
      <div
        id={`${idPrefix}-panel`}
        role={tabbed ? "tabpanel" : undefined}
        aria-labelledby={tabbed ? `${idPrefix}-tab-${current.tool}` : undefined}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <ol
          aria-label={`${current.label} 설치 단계`}
          style={{
            margin: 0,
            paddingLeft: 20,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--sp-fg-secondary)",
          }}
        >
          {current.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        {current.command && (
          <CopyField label="설치 명령 (예시)" value={current.command} />
        )}
      </div>
    </div>
  );
}
