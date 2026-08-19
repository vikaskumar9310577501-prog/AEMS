import { useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import type { MaintenanceMachine } from '../types/maintenance';
import { isCustomTrend } from '../types/maintenance';
import {
  actualDatesForYear,
  dateToPmCellKey,
  groupDatesByCellKey,
  isPlanDateCompleted,
  machineTrendMonths,
  plannedDatesForYear,
  pmCellKey,
  weekOfMonth,
} from '../lib/maintenanceCodes';
import { CalendarDays, Check, AlertTriangle } from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const COL_NAME = 176;
const COL_FREQ = 92;
const COL_DEPT = 112;
const COL_RESP = 112;
const COL_TRACK = 58;
const WEEK_W = 42;
const ROW_H = 34;
const LEFT_W = COL_NAME + COL_FREQ + COL_DEPT + COL_RESP + COL_TRACK;

const LEFT_OFFSETS = {
  name: 0,
  freq: COL_NAME,
  dept: COL_NAME + COL_FREQ,
  resp: COL_NAME + COL_FREQ + COL_DEPT,
  track: COL_NAME + COL_FREQ + COL_DEPT + COL_RESP,
};

type MonthCol = { year: number; month: number; label: string };

function buildMonthCols(year: number): MonthCol[] {
  const cols: MonthCol[] = [];
  for (const y of [year, year + 1]) {
    for (let month = 0; month < 12; month += 1) {
      cols.push({ year: y, month, label: `${MONTHS[month]}-${String(y).slice(-2)}` });
    }
  }
  return cols;
}

/** June of the selected year (or January if still before June). */
function defaultStartMonthIndex(year: number, now: Date): number {
  if (now.getFullYear() === year) {
    return now.getMonth() >= 5 ? 5 : 0;
  }
  if (now.getFullYear() === year + 1) {
    return 12 + Math.max(0, now.getMonth() - 1);
  }
  return 0;
}

interface MaintenancePmPlanBoardProps {
  machines: MaintenanceMachine[];
  loading?: boolean;
  year: number;
}

export default function MaintenancePmPlanBoard({ machines, loading, year }: MaintenancePmPlanBoardProps) {
  const now = new Date();
  const monthCols = useMemo(() => buildMonthCols(year), [year]);
  const weekCount = monthCols.length * 4;
  const timelineW = weekCount * WEEK_W;
  const tableW = LEFT_W + timelineW;
  const startMonthIndex = defaultStartMonthIndex(year, now);
  const todayKey = pmCellKey(now.getFullYear(), now.getMonth(), weekOfMonth(now));
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || loading) return;
    const start = el.querySelector<HTMLElement>('[data-pm-scroll-start]');
    const apply = () => {
      if (!start) {
        el.scrollLeft = startMonthIndex * 4 * WEEK_W;
        return;
      }
      el.scrollLeft = Math.max(0, start.offsetLeft - LEFT_W);
    };
    apply();
    requestAnimationFrame(apply);
  }, [year, machines.length, loading, startMonthIndex]);

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <div className="flex-1 min-h-0 bg-white rounded-2xl border-2 border-slate-700 overflow-hidden flex flex-col shadow-sm">
        {loading ? (
          <p className="p-8 text-sm text-slate-500 text-center">Loading…</p>
        ) : machines.length === 0 ? (
          <p className="p-10 text-sm text-slate-500 text-center">No machines to show on the plan.</p>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
              <table
                className="border-separate border-spacing-0 text-slate-900 table-fixed"
                style={{ width: tableW, minWidth: tableW }}
              >
                <colgroup>
                  <col style={{ width: COL_NAME }} />
                  <col style={{ width: COL_FREQ }} />
                  <col style={{ width: COL_DEPT }} />
                  <col style={{ width: COL_RESP }} />
                  <col style={{ width: COL_TRACK }} />
                  {Array.from({ length: weekCount }, (_, i) => (
                    <col key={i} style={{ width: WEEK_W }} />
                  ))}
                </colgroup>
                <thead className="sticky top-0 z-30">
                  <tr>
                    <StickyTh left={LEFT_OFFSETS.name} width={COL_NAME} rowSpan={2} z={40}>
                      Machine Name
                    </StickyTh>
                    <StickyTh left={LEFT_OFFSETS.freq} width={COL_FREQ} rowSpan={2} z={40}>
                      Frequency
                    </StickyTh>
                    <StickyTh left={LEFT_OFFSETS.dept} width={COL_DEPT} rowSpan={2} z={40}>
                      Department
                    </StickyTh>
                    <StickyTh left={LEFT_OFFSETS.resp} width={COL_RESP} rowSpan={2} z={40}>
                      Responsibility
                    </StickyTh>
                    <StickyTh left={LEFT_OFFSETS.track} width={COL_TRACK} rowSpan={2} z={40} edge>
                      {' '}
                    </StickyTh>
                    {monthCols.map((col, idx) => (
                      <th
                        key={col.label}
                        colSpan={4}
                        className={`h-7 text-[10px] font-black uppercase tracking-wide border-b border-r-2 border-slate-700 box-border ${monthHeaderClass(col, now)}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {monthCols.flatMap((col, idx) =>
                      [1, 2, 3, 4].map((w) => (
                        <th
                          key={`${col.label}-W${w}`}
                          data-pm-scroll-start={idx === startMonthIndex && w === 1 ? '1' : undefined}
                          className={`h-6 text-[9px] font-black border-b-2 border-slate-700 box-border ${w === 4 ? 'border-r-2' : 'border-r'} ${weekHeaderClass(col, now)}`}
                          style={{ width: WEEK_W, minWidth: WEEK_W, maxWidth: WEEK_W }}
                        >
                          W{w}
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {machines.map((machine, index) => (
                    <MachineRows
                      key={machine.id}
                      machine={machine}
                      index={index}
                      years={[year, year + 1]}
                      monthCols={monthCols}
                      todayKey={todayKey}
                      now={now}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t-2 border-slate-400 bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-800">
              <p className="normal-case font-semibold text-slate-500 tracking-normal">
                Default: June → December, then next year. Scroll left for Jan–May.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Legend swatch="bg-amber-400 ring-1 ring-amber-700" label="Plan" icon={<CalendarDays size={11} />} />
                <Legend swatch="bg-emerald-500 ring-1 ring-emerald-800" label="Actual" icon={<Check size={11} />} />
                <Legend swatch="bg-rose-500 ring-1 ring-rose-800" label="Overdue" icon={<AlertTriangle size={11} />} />
                <Legend swatch="bg-sky-200 ring-2 ring-sky-600" label="This week" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StickyTh({
  left,
  width,
  rowSpan,
  z,
  edge,
  children,
}: {
  left: number;
  width: number;
  rowSpan?: number;
  z: number;
  edge?: boolean;
  children: ReactNode;
}) {
  return (
    <th
      rowSpan={rowSpan}
      className={`bg-[#dbeafe] text-[10px] font-black uppercase tracking-wide text-slate-800 border-b-2 border-r border-slate-600 box-border ${
        edge ? 'border-r-2 border-slate-800' : ''
      }`}
      style={{
        position: 'sticky',
        left,
        top: 0,
        zIndex: z,
        width,
        minWidth: width,
        maxWidth: width,
        boxShadow: edge ? '3px 0 0 0 #1e293b' : undefined,
      }}
    >
      {children}
    </th>
  );
}

function stickyTdStyle(left: number, width: number, edge?: boolean, z = 8): CSSProperties {
  return {
    position: 'sticky',
    left,
    zIndex: z,
    width,
    minWidth: width,
    maxWidth: width,
    boxSizing: 'border-box',
    boxShadow: edge ? '3px 0 0 0 #1e293b' : undefined,
  };
}

function isCurrentMonth(col: MonthCol, now: Date) {
  return col.year === now.getFullYear() && col.month === now.getMonth();
}

function monthHeaderClass(col: MonthCol, now: Date) {
  if (isCurrentMonth(col, now)) return 'bg-sky-400 text-sky-950';
  return col.month % 2 === 0 ? 'bg-slate-300 text-slate-900' : 'bg-indigo-100 text-slate-900';
}

function weekHeaderClass(col: MonthCol, now: Date) {
  if (isCurrentMonth(col, now)) return 'bg-sky-200 text-sky-900';
  return col.month % 2 === 0 ? 'bg-slate-200 text-slate-700' : 'bg-indigo-50 text-slate-700';
}

function monthCellBg(col: MonthCol, now: Date, machineStripe: string) {
  if (isCurrentMonth(col, now)) return 'bg-sky-100';
  if (col.month % 2 === 0) return machineStripe;
  return machineStripe === 'bg-white' ? 'bg-indigo-50/80' : 'bg-indigo-100/70';
}

function MachineRows({
  machine,
  index,
  years,
  monthCols,
  todayKey,
  now,
}: {
  machine: MaintenanceMachine;
  index: number;
  years: number[];
  monthCols: MonthCol[];
  todayKey: string;
  now: Date;
}) {
  const planned = years.flatMap((y) => plannedDatesForYear(machine, y));
  const actual = years.flatMap((y) => actualDatesForYear(machine, y));
  const planKeys = new Set(planned.map(dateToPmCellKey));
  const actualKeys = new Set(actual.map(dateToPmCellKey));
  const planDatesByKey = groupDatesByCellKey(planned);
  const actualDatesByKey = groupDatesByCellKey(actual);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const overdueKeys = new Set(
    planned
      .filter(
        (d) =>
          d.getTime() < todayStart.getTime() &&
          !isPlanDateCompleted(machine, d) &&
          !actualKeys.has(dateToPmCellKey(d))
      )
      .map(dateToPmCellKey)
  );

  const name = machine.equipmentName?.trim() || `${machine.machineType} ${machine.machineNumber}`.trim();
  const freq = machineTrendMonths(machine);
  const freqLabel = isCustomTrend(freq) ? 'Custom' : freq === 1 ? '1 month' : `${freq} months`;
  const stripe = index % 2 === 0 ? 'bg-white' : 'bg-slate-50';
  const dept = machine.department?.trim();
  const resp = machine.responsibility?.trim();
  const cellH = { height: ROW_H, minHeight: ROW_H };

  return (
    <>
      <tr>
        <td
          rowSpan={2}
          className={`border-b-2 border-r border-slate-600 px-2.5 py-1 align-middle box-border ${stripe}`}
          style={stickyTdStyle(LEFT_OFFSETS.name, COL_NAME, false, 9)}
        >
          <p className="font-bold text-[11px] text-slate-900 leading-snug line-clamp-2">{name}</p>
          <p className="font-mono text-[9px] text-blue-700 font-bold mt-0.5">{machine.assetCode}</p>
        </td>
        <td
          rowSpan={2}
          className={`border-b-2 border-r border-slate-600 text-center text-[11px] font-bold text-slate-800 align-middle box-border ${stripe}`}
          style={stickyTdStyle(LEFT_OFFSETS.freq, COL_FREQ, false, 9)}
        >
          {freqLabel}
        </td>
        <td
          rowSpan={2}
          className={`border-b-2 border-r border-slate-600 px-1 text-center text-[10px] font-semibold text-slate-700 align-middle box-border ${stripe}`}
          style={stickyTdStyle(LEFT_OFFSETS.dept, COL_DEPT, false, 9)}
        >
          {dept || <span className="text-slate-400">—</span>}
        </td>
        <td
          rowSpan={2}
          className={`border-b-2 border-r border-slate-600 px-1 text-center text-[10px] font-semibold text-slate-700 align-middle box-border ${stripe}`}
          style={stickyTdStyle(LEFT_OFFSETS.resp, COL_RESP, false, 9)}
        >
          {resp || <span className="text-slate-400">—</span>}
        </td>
        <td
          className="border-b border-r-2 border-slate-800 text-center text-[9px] font-black uppercase text-amber-900 bg-amber-100 align-middle box-border"
          style={{ ...stickyTdStyle(LEFT_OFFSETS.track, COL_TRACK, true, 9), ...cellH }}
        >
          Plan
        </td>
        <WeekCells
          monthCols={monthCols}
          todayKey={todayKey}
          now={now}
          mark="P"
          keys={planKeys}
          overdueKeys={overdueKeys}
          datesByKey={planDatesByKey}
          stripe={stripe}
        />
      </tr>
      <tr>
        <td
          className="border-b-2 border-r-2 border-slate-800 text-center text-[9px] font-black uppercase text-emerald-900 bg-emerald-100 align-middle box-border"
          style={{ ...stickyTdStyle(LEFT_OFFSETS.track, COL_TRACK, true, 9), ...cellH }}
        >
          Actual
        </td>
        <WeekCells
          monthCols={monthCols}
          todayKey={todayKey}
          now={now}
          mark="A"
          keys={actualKeys}
          overdueKeys={new Set()}
          datesByKey={actualDatesByKey}
          stripe={stripe}
        />
      </tr>
    </>
  );
}

function WeekCells({
  monthCols,
  todayKey,
  now,
  mark,
  keys,
  overdueKeys,
  datesByKey,
  stripe,
}: {
  monthCols: MonthCol[];
  todayKey: string;
  now: Date;
  mark: 'P' | 'A';
  keys: Set<string>;
  overdueKeys: Set<string>;
  datesByKey: Map<string, Date[]>;
  stripe: string;
}) {
  return (
    <>
      {monthCols.flatMap((col) =>
        [1, 2, 3, 4].map((w) => {
          const key = pmCellKey(col.year, col.month, w);
          const hit = keys.has(key);
          const overdue = overdueKeys.has(key);
          const isToday = key === todayKey;
          const monthEdge = w === 4 ? 'border-r-2 border-slate-700' : 'border-r border-slate-500';
          const bottom = mark === 'A' ? 'border-b-2 border-slate-600' : 'border-b border-slate-500';
          let cell = `text-center align-middle box-border ${bottom} ${monthEdge} ${monthCellBg(col, now, stripe)}`;
          if (isToday) cell += ' bg-sky-200';
          let chip =
            'inline-flex w-[22px] h-[22px] rounded-md items-center justify-center shadow-sm';
          if (hit && mark === 'P' && overdue) chip += ' bg-rose-500 text-white ring-1 ring-rose-800';
          else if (hit && mark === 'P') chip += ' bg-amber-400 text-amber-950 ring-1 ring-amber-700';
          else if (hit && mark === 'A') chip += ' bg-emerald-500 text-white ring-1 ring-emerald-800';
          const dates = datesByKey.get(key) || [];
          const dateLabel = dates.map((d) => formatChipDate(d)).join(', ');
          const kind = mark === 'P' ? (overdue ? 'Overdue plan' : 'Plan') : 'Actual';
          const title = hit
            ? `${kind}: ${dateLabel || `${col.label} W${w}`}`
            : `${col.label} W${w}`;
          return (
            <td
              key={`${mark}-${key}`}
              className={cell}
              title={title}
              style={{ width: WEEK_W, minWidth: WEEK_W, maxWidth: WEEK_W, height: ROW_H }}
            >
              {hit ? (
                <span className={chip} title={title}>
                  {mark === 'A' ? (
                    <Check size={13} strokeWidth={3} />
                  ) : overdue ? (
                    <AlertTriangle size={13} strokeWidth={2.5} />
                  ) : (
                    <CalendarDays size={13} strokeWidth={2.5} />
                  )}
                </span>
              ) : null}
            </td>
          );
        })
      )}
    </>
  );
}

function formatChipDate(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function Legend({ swatch, label, icon }: { swatch: string; label: string; icon?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`w-4 h-4 rounded-md ${swatch} inline-flex items-center justify-center text-white`}>
        {icon}
      </span>
      {label}
    </span>
  );
}
