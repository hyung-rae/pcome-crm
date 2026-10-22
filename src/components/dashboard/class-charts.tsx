"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart, type BarChartSeries } from "@mantine/charts";
import { Button, Skeleton } from "@mantine/core";
import { api } from "@/components/auth/auth-forms";
import { addDays, seoulToday, shortDate, weekStart } from "@/lib/classes/dates";
import { countByInstructor, countByWeekday, type DayStat, type InstructorStat } from "@/lib/classes/stats";
import type { ClassSession } from "@/lib/classes/types";
import styles from "./dashboard.module.css";

// Two categorical slots validated with the dataviz palette checks on the white surface.
const SERIES: BarChartSeries[] = [
  { name: "scheduled", label: "정상", color: "#D63E20" },
  { name: "cancelled", label: "휴강", color: "#2A78D6" },
];
const count = (value: number) => `${value}회`;

// Even integer ticks with at least one spare unit above the largest total, so its label clears the legend.
function valueTicks(max: number) {
  const step = max < 6 ? 1 : max < 12 ? 2 : Math.ceil(max / 25) * 5;
  const top = Math.ceil((max + 1) / step) * step;
  return Array.from({ length: top / step + 1 }, (_, index) => index * step);
}

type LabelProps = { x?: number | string; y?: number | string; width?: number | string; height?: number | string; index?: number };
// Total at the tip of each stacked bar, drawn from the top segment so it sits past both series.
function totalLabel(totals: number[], horizontalBars: boolean) {
  return function TotalLabel({ x = 0, y = 0, width = 0, height = 0, index = 0 }: LabelProps) {
    const total = totals[index];
    if (!total) return null;
    const [left, top, w, h] = [x, y, width, height].map(Number);
    return horizontalBars ? (
      <text x={left + w + 6} y={top + h / 2} dominantBaseline="central" fontSize={12} fill="#565656">
        {total}
      </text>
    ) : (
      <text x={left + w / 2} y={top - 6} textAnchor="middle" fontSize={12} fill="#565656">
        {total}
      </text>
    );
  };
}

function Chart({
  data,
  dataKey,
  totals,
  horizontalBars,
  height,
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  totals: number[];
  horizontalBars?: boolean;
  height: number;
}) {
  const ticks = valueTicks(Math.max(0, ...totals));
  const valueAxis = { allowDecimals: false, domain: [0, ticks[ticks.length - 1]], ticks };
  return (
    <BarChart
      h={height}
      data={data}
      dataKey={dataKey}
      series={SERIES}
      type="stacked"
      orientation={horizontalBars ? "vertical" : "horizontal"}
      maxBarWidth={24}
      // Recessive solid hairlines across the value axis only.
      gridAxis={horizontalBars ? "y" : "x"}
      strokeDasharray="0"
      gridColor="#EFEFF1"
      tickLine="none"
      withLegend
      legendProps={{ verticalAlign: "top", height: 32 }}
      valueFormatter={count}
      xAxisProps={horizontalBars ? valueAxis : undefined}
      yAxisProps={horizontalBars ? { width: 80 } : { ...valueAxis, width: 28 }}
      barProps={(series) =>
        series.name === "cancelled" ? { label: totalLabel(totals, !!horizontalBars) } : {}
      }
      barChartProps={{ margin: horizontalBars ? { right: 28 } : { top: 8 } }}
    />
  );
}

// Screen-reader and copy-friendly view of the same counts.
function CountTable({ caption, head, rows }: { caption: string; head: string; rows: [string, number, number][] }) {
  return (
    <table className={styles.srOnly}>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{head}</th>
          <th scope="col">정상</th>
          <th scope="col">휴강</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, scheduled, cancelled]) => (
          <tr key={name}>
            <th scope="row">{name}</th>
            <td>{scheduled}</td>
            <td>{cancelled}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function fetchWeek() {
  const week = weekStart(seoulToday());
  return api(`/api/classes/sessions?from=${week}&to=${addDays(week, 6)}`, "GET");
}

export function ClassCharts() {
  const [week, setWeek] = useState(() => weekStart(seoulToday()));
  const [days, setDays] = useState<DayStat[]>([]);
  const [instructors, setInstructors] = useState<InstructorStat[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // The server's date decides "this week" and "today", so the counts match the schedule page.
  const apply = useCallback((result: { sessions: ClassSession[]; today: string }) => {
    const current = weekStart(result.today);
    setWeek(current);
    setDays(countByWeekday(result.sessions, current, result.today));
    setInstructors(countByInstructor(result.sessions));
    setTotal(result.sessions.length);
  }, []);
  const fail = (error: unknown) =>
    setError(error instanceof Error ? error.message : "수업 현황을 불러오지 못했습니다.");
  useEffect(() => {
    let active = true;
    fetchWeek()
      .then((result) => active && apply(result))
      .catch((error) => active && fail(error))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [apply]);
  async function reload() {
    setLoading(true);
    setError("");
    try {
      apply(await fetchWeek());
    } catch (error) {
      fail(error);
    } finally {
      setLoading(false);
    }
  }

  const cancelled = days.reduce((sum, day) => sum + day.cancelled, 0);
  const dayData = days.map((day) => ({ ...day, label: day.today ? `${day.label}(오늘)` : day.label }));
  const instructorHeight = Math.max(160, instructors.length * 36 + 56);

  return (
    <section className={styles.overview} aria-labelledby="overview-title" aria-busy={loading}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="overview-title">이번 주 수업 현황</h2>
          <p>
            {shortDate(week)} – {shortDate(addDays(week, 6))}
            {!loading && !error && ` · 총 ${total}회${cancelled ? `(휴강 ${cancelled}회)` : ""}`}
          </p>
        </div>
        <Button component={Link} href="/classes" size="xs" variant="default">
          수업 시간표
        </Button>
      </div>
      {loading ? (
        <div className={styles.charts} role="status" aria-label="수업 현황을 불러오는 중입니다.">
          {[0, 1].map((key) => (
            <div key={key} className={styles.chartCard}>
              <Skeleton height={16} width={140} radius={4} />
              <Skeleton height={220} radius={8} mt={16} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className={styles.chartMessage} role="alert">
          <p>{error}</p>
          <Button size="xs" variant="default" onClick={() => void reload()}>
            다시 시도
          </Button>
        </div>
      ) : total === 0 ? (
        <div className={styles.chartMessage}>
          <p>이번 주에 등록된 수업이 없습니다.</p>
          <Button component={Link} href="/classes" size="xs">
            수업 시간표로 이동
          </Button>
        </div>
      ) : (
        <div className={styles.charts}>
          <div className={styles.chartCard}>
            <h3>요일별 수업 수</h3>
            <div aria-hidden="true">
              <Chart data={dayData} dataKey="label" totals={days.map((day) => day.scheduled + day.cancelled)} height={240} />
            </div>
            <CountTable
              caption="이번 주 요일별 수업 수"
              head="요일"
              rows={dayData.map((day) => [day.label, day.scheduled, day.cancelled])}
            />
          </div>
          <div className={styles.chartCard}>
            <h3>강사별 담당 수업 수</h3>
            <div aria-hidden="true">
              <Chart
                data={instructors}
                dataKey="name"
                totals={instructors.map((row) => row.total)}
                horizontalBars
                height={instructorHeight}
              />
            </div>
            <CountTable
              caption="이번 주 강사별 담당 수업 수"
              head="강사"
              rows={instructors.map((row) => [row.name, row.scheduled, row.cancelled])}
            />
          </div>
        </div>
      )}
    </section>
  );
}
