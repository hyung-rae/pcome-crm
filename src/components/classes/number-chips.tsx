"use client";
import { useState } from "react";
import { Chip } from "@mantine/core";
import styles from "./classes.module.css";

export const CAPACITY_OPTIONS = [1, 5, 10, 15, 20];
export const DURATION_OPTIONS = Array.from({ length: 23 }, (_, index) => 10 + index * 5);

// Single-choice number chips. The value at mount stays selectable even outside the presets, so editing can return to it.
export function NumberChips({
  legend,
  unit,
  options,
  value,
  onChange,
  hint,
  disabled,
}: {
  legend: string;
  unit: string;
  options: number[];
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  disabled?: boolean;
}) {
  const [initial] = useState(value);
  const choices = [...new Set([...options, initial, value])].sort((a, b) => a - b);
  return (
    <fieldset className={styles.chipField}>
      <legend className={styles.fieldLabel}>
        {legend}
        {hint && <span className={styles.legendHint}>{hint}</span>}
      </legend>
      <Chip.Group value={String(value)} onChange={(next) => onChange(Number(next))}>
        <div className={styles.chips}>
          {choices.map((choice) => (
            <Chip key={choice} value={String(choice)} size="sm" variant="light" disabled={disabled}>
              {`${choice}${unit}`}
            </Chip>
          ))}
        </div>
      </Chip.Group>
    </fieldset>
  );
}
