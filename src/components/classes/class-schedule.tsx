"use client";
import { useState } from "react";
import { Tabs } from "@mantine/core";
import { ClassTypeManager } from "./class-type-manager";
import { ScheduleBoard } from "./schedule-board";
import styles from "./classes.module.css";

// Tabs unmount when hidden so the schedule reloads newly added class types.
// The count stays here so the hidden tab keeps its last known badge.
export function ClassSchedule() {
  const [typeCount, setTypeCount] = useState<number>();
  return (
    <Tabs defaultValue="schedule" keepMounted={false} className={styles.tabs}>
      <Tabs.List aria-label="수업 관리">
        <Tabs.Tab value="schedule">시간표</Tabs.Tab>
        <Tabs.Tab
          value="types"
          aria-label={typeCount === undefined ? undefined : `수업 종류, 사용 중 ${typeCount}개`}
          rightSection={typeCount === undefined ? undefined : <span className={styles.tabBadge} aria-hidden="true">{typeCount}</span>}
        >
          수업 종류
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="schedule">
        <ScheduleBoard onTypeCount={setTypeCount} />
      </Tabs.Panel>
      <Tabs.Panel value="types">
        <ClassTypeManager onCount={setTypeCount} />
      </Tabs.Panel>
    </Tabs>
  );
}
