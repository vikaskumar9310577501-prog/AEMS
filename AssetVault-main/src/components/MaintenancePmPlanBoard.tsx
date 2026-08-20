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
    return Math.max(0, now.getMonth() - 1);
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
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 bg-[#FFFCF8] rounded-2xl border border-stone-200/80 overflow-hidden flex flex-col shadow-[0_8px_32px_-8px_rgba(120,90,60,0.14)]">
        {loading ? (
          <p className="p-10 text-sm text-stone-500 text-center">Loading plan board…</p>
        ) : machines.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CalendarDays size={32} className="mx-auto text-stone-300" />
            <p className="text-sm text-stone-500">No machines with PM planned this month.</p>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-x-auto overflow-y-auto bg-[#F7F3EE]/50" style={{ maxHeight: '100%' }}>
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
                        className={`h-7 text-[10px] font-black uppercase tracking-wide border-b border-r border-stone-400/70 box-border ${monthHeaderClass(col, now)}`}
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
                          className={`h-6 text-[9px] font-black border-b-2 border-stone-400/70 box-border ${w === 4 ? 'border-r-2 border-stone-400/80' : 'border-r border-stone-300/90'} ${weekHeaderClass(col, now)}`}
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
      className={`bg-gradient-to-b from-[#F0EBE3] to-[#E8E2DA] text-[10px] font-black uppercase tracking-wider text-stone-700 border-b border-r border-stone-300/70 box-border ${
        edge ? 'border-r border-stone-300/80' : ''
      }`}
      style={{
        position: 'sticky',
        left,
        top: 0,
        zIndex: z,
        width,
        minWidth: width,
        maxWidth: width,
        boxShadow: edge ? '4px 0 12px -4px rgba(120,90,60,0.15)' : undefined,
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
    boxShadow: edge ? '4px 0 12px -4px rgba(120,90,60,0.15)' : undefined,
  };
}

function isCurrentMonth(col: MonthCol, now: Date) {
  return col.year === now.getFullYear() && col.month === now.getMonth();
}

function monthHeaderClass(col: MonthCol, now: Date) {
  if (isCurrentMonth(col, now)) return 'bg-gradient-to-b from-blue-500 to-indigo-600 text-white shadow-inner';
  return col.month % 2 === 0 ? 'bg-stone-200/80 text-stone-800' : 'bg-[#EDE8E0] text-stone-800';
}

function weekHeaderClass(col: MonthCol, now: Date) {
  if (isCurrentMonth(col, now)) return 'bg-blue-100/90 text-blue-900';
  return col.month % 2 === 0 ? 'bg-stone-100/90 text-stone-600' : 'bg-[#F5F0E8] text-stone-600';
}

function monthCellBg(col: MonthCol, now: Date, machineStripe: string, week: number) {
  const alt = week % 2 === 0;
  if (isCurrentMonth(col, now)) {
    return alt ? 'bg-blue-50' : 'bg-blue-100/80';
  }
  if (col.month % 2 === 0) {
    if (alt) return machineStripe;
    return machineStripe === 'bg-[#FFFCF8]' ? 'bg-[#F0EBE3]' : 'bg-[#EDE8E0]';
  }
  return alt ? 'bg-[#F5F0E8]' : 'bg-[#E8E2DA]';
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

  const name = machine.equipmentName?.trim() || `${machine.machineType.replace(/\s+Machine$/i, '')} ${machine.machineNumber}`.trim();
  const freq = machineTrendMonths(machine);
  const freqLabel = isCustomTrend(freq) ? 'Custom' : freq === 1 ? '1 month' : `${freq} months`;
  const stripe = index % 2 === 0 ? 'bg-[#FFFCF8]' : 'bg-[#F7F3EE]';
  const dept = machine.department?.trim();
  const resp = machine.responsibility?.trim();
  const cellH = { height: ROW_H, minHeight: ROW_H };

  return (
    <>
      <tr className="group">
        <td
          rowSpan={2}
          className={`border-b border-r border-stone-400/80 px-2.5 py-1.5 align-middle box-border ${stripe} group-hover:bg-[#FFFDF9]`}
          style={stickyTdStyle(LEFT_OFFSETS.name, COL_NAME, false, 9)}
        >
          <p className="font-bold text-[11px] text-stone-800 leading-snug line-clamp-2">{name}</p>
          <span className="inline-flex mt-1 px-1.5 py-0.5 rounded-md bg-blue-50/90 border border-blue-100 font-mono text-[9px] text-blue-700 font-bold">
            {machine.assetCode}
          </span>
        </td>
        <td
          rowSpan={2}
          className={`border-b border-r border-stone-400/80 text-center align-middle box-border ${stripe} group-hover:bg-[#FFFDF9]`}
          style={stickyTdStyle(LEFT_OFFSETS.freq, COL_FREQ, false, 9)}
        >
          <span className="inline-flex px-2 py-0.5 rounded-md bg-stone-100/90 border border-stone-200/70 text-[10px] font-bold text-stone-700">
            {freqLabel}
          </span>
        </td>
        <td
          rowSpan={2}
          className={`border-b border-r border-stone-400/80 px-1 text-center align-middle box-border ${stripe} group-hover:bg-[#FFFDF9]`}
          style={stickyTdStyle(LEFT_OFFSETS.dept, COL_DEPT, false, 9)}
        >
          {dept ? (
            <span className="inline-flex px-1.5 py-0.5 rounded-md bg-violet-50/90 border border-violet-100 text-[9px] font-black uppercase text-violet-700">
              {dept}
            </span>
          ) : (
            <span className="text-stone-400">—</span>
          )}
        </td>
        <td
          rowSpan={2}
          className={`border-b border-r border-stone-400/80 px-1 text-center align-middle box-border ${stripe} group-hover:bg-[#FFFDF9]`}
          style={stickyTdStyle(LEFT_OFFSETS.resp, COL_RESP, false, 9)}
        >
          {resp ? (
            <span className="inline-flex px-1.5 py-0.5 rounded-md bg-amber-50/90 border border-amber-100 text-[9px] font-bold text-amber-800">
              {resp}
            </span>
          ) : (
            <span className="text-stone-400">—</span>
          )}
        </td>
        <td
          className="border-b border-r-2 border-stone-400/80 text-center text-[9px] font-black uppercase text-amber-800 bg-gradient-to-r from-amber-50 to-amber-100/80 align-middle box-border shadow-[inset_0_0_0_1px_rgba(251,191,36,0.25)]"
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
      <tr className="group">
        <td
          className="border-b-2 border-r-2 border-stone-400/80 text-center text-[9px] font-black uppercase text-emerald-800 bg-gradient-to-r from-emerald-50 to-emerald-100/80 align-middle box-border shadow-[inset_0_0_0_1px_rgba(52,211,153,0.25)]"
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
          const monthEdge = w === 4 ? 'border-r-2 border-stone-400/80' : 'border-r border-stone-300/90';
          const bottom = mark === 'A' ? 'border-b-2 border-stone-400/80' : 'border-b border-stone-300/90';
          let cell = `text-center align-middle box-border ${bottom} ${monthEdge} ${monthCellBg(col, now, stripe, w)} shadow-[inset_0_0_0_1px_rgba(168,152,136,0.32)]`;
          if (isToday) cell += ' !bg-blue-200/70 ring-2 ring-inset ring-blue-400/55';
          let chip =
            'inline-flex w-[22px] h-[22px] rounded-lg items-center justify-center shadow-sm transition-transform hover:scale-105';
          if (hit && mark === 'P' && overdue) chip += ' bg-gradient-to-br from-rose-500 to-rose-600 text-white ring-1 ring-rose-300/60 shadow-rose-200/50';
          else if (hit && mark === 'P') chip += ' bg-gradient-to-br from-amber-400 to-amber-500 text-amber-950 ring-1 ring-amber-300/60 shadow-amber-200/50';
          else if (hit && mark === 'A') chip += ' bg-gradient-to-br from-emerald-500 to-emerald-600 text-white ring-1 ring-emerald-300/60 shadow-emerald-200/50';
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

export function PmPlanLegend() {
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <Legend
        swatch="bg-gradient-to-br from-amber-400 to-amber-500 shadow-sm shadow-amber-200/80 ring-1 ring-amber-300/60"
        label="Plan"
        icon={<CalendarDays size={11} />}
      />
      <Legend
        swatch="bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm shadow-emerald-200/80 ring-1 ring-emerald-300/60"
        label="Actual"
        icon={<Check size={11} />}
      />
      <Legend
        swatch="bg-gradient-to-br from-rose-500 to-rose-600 shadow-sm shadow-rose-200/80 ring-1 ring-rose-300/60"
        label="Overdue"
        icon={<AlertTriangle size={11} />}
      />
      <Legend
        swatch="bg-gradient-to-br from-sky-300 to-blue-400 shadow-sm shadow-blue-200/80 ring-2 ring-blue-400/50"
        label="This week"
      />
    </div>
  );
}

function Legend({ swatch, label, icon }: { swatch: string; label: string; icon?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-stone-200/70 shadow-sm text-[9px] font-black uppercase tracking-wide text-stone-700">
      <span className={`w-4 h-4 rounded-md ${swatch} inline-flex items-center justify-center text-white`}>
        {icon}
      </span>
      {label}
    </span>
  );
}
