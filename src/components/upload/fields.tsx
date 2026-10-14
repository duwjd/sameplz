"use client";
// Small form pieces for the upload wizard. Every control gets a stable id from its field path so
// 「다음」 errors and 「고치러 가기」 can focus it (F5-1).
import type { CSSProperties, ReactNode } from "react";
import { Button, Chip, Field, Icon, TextInput } from "@/components/ds";

export const fid = (field: string) =>
  `up-${field.replace(/[^a-zA-Z0-9]/g, "-")}`;
export const eid = (field: string) => `${fid(field)}-error`;

export type Errors = Record<string, string>;

export function FormField({
  field,
  label,
  description,
  required,
  errors,
  children,
  style,
}: {
  field: string;
  label: ReactNode;
  description?: ReactNode;
  required?: boolean;
  errors: Errors;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const msg = errors[field];
  return (
    <Field
      label={label}
      htmlFor={fid(field)}
      description={description}
      required={required}
      error={
        msg ? (
          <span id={eid(field)} role="alert">
            {msg}
          </span>
        ) : undefined
      }
      style={style}
    >
      {children}
    </Field>
  );
}

/** aria wiring for a control bound to `field`. */
export const ariaFor = (field: string, errors: Errors) => ({
  id: fid(field),
  "aria-invalid": errors[field] ? true : undefined,
  "aria-describedby": errors[field] ? eid(field) : undefined,
});

/** Editable list of short lines (agent flow, does / does-not, prepare). */
export function LineList({
  field,
  values,
  onChange,
  placeholder,
  max,
  maxLength,
  errors,
  addLabel,
}: {
  field: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  max: number;
  maxLength: number;
  errors: Errors;
  addLabel: string;
}) {
  const rows = values.length ? values : [""];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((v, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <TextInput
            {...(i === 0
              ? ariaFor(field, errors)
              : { id: fid(`${field}.${i}`) })}
            aria-label={`${addLabel.replace(" 추가", "")} ${i + 1}`}
            value={v}
            maxLength={maxLength}
            placeholder={placeholder}
            onChange={(e) =>
              onChange(rows.map((x, j) => (j === i ? e.target.value : x)))
            }
            style={{ flex: 1 }}
          />
          {rows.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              color="secondary"
              size="md"
              aria-label={`${i + 1}번째 줄 지우기`}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
            >
              <Icon name="CloseOutlineIcon" size={16} />
            </Button>
          )}
        </div>
      ))}
      {rows.length < max && (
        <Button
          type="button"
          variant="outline"
          color="secondary"
          size="md"
          style={{ alignSelf: "flex-start" }}
          onClick={() => onChange([...rows, ""])}
        >
          {addLabel}
        </Button>
      )}
    </div>
  );
}

/** Toggle chips for code lists (jobs, tools). */
export function CodeChips({
  field,
  options,
  value,
  onChange,
  max,
  errors,
}: {
  field: string;
  options: { code: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  max: number;
  errors: Errors;
}) {
  return (
    <div
      id={fid(field)}
      tabIndex={-1}
      role="group"
      aria-describedby={errors[field] ? eid(field) : undefined}
      style={{ display: "flex", flexWrap: "wrap", gap: 8, outline: "none" }}
    >
      {options.map((o) => {
        const on = value.includes(o.code);
        return (
          <Chip
            key={o.code}
            size="sm"
            selected={on}
            disabled={!on && value.length >= max}
            onClick={() =>
              onChange(
                on ? value.filter((c) => c !== o.code) : [...value, o.code],
              )
            }
          >
            {o.label}
          </Chip>
        );
      })}
    </div>
  );
}
