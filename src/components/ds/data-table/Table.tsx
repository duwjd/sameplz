"use client";

import * as React from "react";

/* SAMEPLZ Table — data table. `columns` = [{key,header,width,align}], `rows` =
   array of record objects. Optional row hover + zebra striping. */

/** A row record. Defaults to plain renderable values; pass your own row type for typed renderers. */
export type TableRowData = Record<string, React.ReactNode>;

export interface TableColumn<Row extends object = TableRowData> {
  key: string;
  header: React.ReactNode;
  width?: number | string;
  align?: "left" | "center" | "right";
  /** Custom cell renderer: (value, row) => node. */
  render?: (value: Row[keyof Row], row: Row) => React.ReactNode;
}

/** Data table. Define `columns` and pass `rows` of record objects. */
export interface TableProps<Row extends object = TableRowData> {
  columns: TableColumn<Row>[];
  rows: Row[];
  striped?: boolean;
  hoverable?: boolean;
  style?: React.CSSProperties;
}

export function Table<Row extends object = TableRowData>({
  columns = [],
  rows = [],
  striped = false,
  hoverable = true,
  style = {},
}: TableProps<Row>) {
  return (
    <div
      style={{
        border: "1px solid var(--sp-border-normal)",
        borderRadius: "var(--sp-radius-400)",
        overflow: "hidden",
        ...style,
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: "var(--sp-font-sans)",
          fontSize: 14,
        }}
      >
        <thead>
          <tr style={{ background: "var(--sp-bg-canvas)" }}>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: c.align || "left",
                  padding: "12px 16px",
                  width: c.width,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--sp-fg-hint)",
                  borderBottom: "1px solid var(--sp-border-normal)",
                  whiteSpace: "nowrap",
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <TableRow
              key={ri}
              columns={columns}
              row={row}
              striped={striped && ri % 2 === 1}
              hoverable={hoverable}
              last={ri === rows.length - 1}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface TableRowProps<Row extends object> {
  columns: TableColumn<Row>[];
  row: Row;
  striped: boolean;
  hoverable: boolean;
  last: boolean;
}

function TableRow<Row extends object>({
  columns,
  row,
  striped,
  hoverable,
  last,
}: TableRowProps<Row>) {
  const [hover, setHover] = React.useState(false);
  const bg =
    hover && hoverable
      ? "var(--sp-bg-hover)"
      : striped
        ? "var(--sp-bg-canvas)"
        : "var(--sp-bg-surface)";
  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: bg,
        transition:
          "background var(--sp-duration-fast) var(--sp-easing-standard)",
      }}
    >
      {columns.map((c) => {
        const value = row[c.key as keyof Row];
        return (
          <td
            key={c.key}
            style={{
              textAlign: c.align || "left",
              padding: "12px 16px",
              color: "var(--sp-fg-normal)",
              borderBottom: last
                ? "none"
                : "1px solid var(--sp-border-secondary)",
            }}
          >
            {c.render ? c.render(value, row) : (value as React.ReactNode)}
          </td>
        );
      })}
    </tr>
  );
}

export default Table;
