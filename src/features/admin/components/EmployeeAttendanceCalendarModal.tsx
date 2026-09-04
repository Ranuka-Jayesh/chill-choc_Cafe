import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  X,
  Eye,
} from 'lucide-react';
import { Employee, AttendanceDayStatus, EmployeeAttendanceDay } from '@/types';
import { accountingService } from '@/services/accountingService';

interface EmployeeAttendanceCalendarModalProps {
  employee: Employee;
  initialYear?: number;
  initialMonth?: number; // 1-12
  onClose: () => void;
  onUpdate?: () => void;
}

export const EmployeeAttendanceCalendarModal: React.FC<EmployeeAttendanceCalendarModalProps> = ({
  employee,
  initialYear = new Date().getFullYear(),
  initialMonth = new Date().getMonth() + 1,
  onClose,
  onUpdate,
}) => {
  const [currentYear, setCurrentYear] = useState<number>(initialYear);
  const [currentMonth, setCurrentMonth] = useState<number>(initialMonth);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  // Month attendance map
  const attendanceMap = useMemo(() => {
    return accountingService.getEmployeeAttendanceMap(employee.id, currentYear, currentMonth);
  }, [employee.id, employee.attendanceRecords, currentYear, currentMonth]);

  // Month metadata
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  // Starting day on Monday (0 = Mon, 6 = Sun)
  const startingDayOffset = (firstDayOfWeek + 6) % 7;

  // Month summary statistics - strictly from actual database records
  const stats = useMemo(() => {
    let presentCount = 0;
    let lateCount = 0;
    let earlyLeaveCount = 0;
    let overtimeCount = 0;
    let absentCount = 0;
    let holidayCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const record = attendanceMap[dateKey];
      if (record) {
        if (record.status === 'PRESENT') presentCount++;
        else if (record.status === 'LATE') lateCount++;
        else if (record.status === 'EARLY_LEAVE') earlyLeaveCount++;
        else if (record.status === 'OVERTIME') overtimeCount++;
        else if (record.status === 'ABSENT') absentCount++;
        else if (record.status === 'HOLIDAY') holidayCount++;
      } else {
        const dow = new Date(currentYear, currentMonth - 1, day).getDay();
        if (dow === 0) holidayCount++;
        // Unrecorded days are NOT counted as present!
      }
    }

    return {
      presentCount,
      lateCount,
      earlyLeaveCount,
      overtimeCount,
      absentCount,
      holidayCount,
      totalAttended: presentCount + lateCount + earlyLeaveCount + overtimeCount,
      workingDays: daysInMonth - holidayCount,
    };
  }, [attendanceMap, currentYear, currentMonth, daysInMonth]);

  // Navigate months
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Toggle day status on double-click / cycle
  const handleCycleDayStatus = (dateKey: string) => {
    const current = attendanceMap[dateKey]?.status;
    let nextStatus: AttendanceDayStatus | 'CLEAR' = 'PRESENT';
    if (!current) nextStatus = 'PRESENT';
    else if (current === 'PRESENT') nextStatus = 'LATE';
    else if (current === 'LATE') nextStatus = 'EARLY_LEAVE';
    else if (current === 'EARLY_LEAVE') nextStatus = 'OVERTIME';
    else if (current === 'OVERTIME') nextStatus = 'ABSENT';
    else if (current === 'ABSENT') nextStatus = 'HOLIDAY';
    else if (current === 'HOLIDAY') nextStatus = 'CLEAR';

    if (nextStatus === 'CLEAR') {
      accountingService.deleteEmployeeAttendanceDay(employee.id, dateKey);
    } else {
      accountingService.updateEmployeeAttendanceDay(employee.id, dateKey, {
        status: nextStatus,
        overtimeHours: nextStatus === 'OVERTIME' ? 2 : undefined,
        workedHours: nextStatus === 'ABSENT' || nextStatus === 'HOLIDAY' ? 0 : 8,
      });
    }
    if (onUpdate) onUpdate();
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthTitle = `${monthNames[currentMonth - 1]} ${currentYear}`;
  const selectedDayRecord = selectedDayKey ? attendanceMap[selectedDayKey] : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center p-3 sm:p-5 animate-in fade-in select-none"
      onClick={onClose}
    >
      {/* Top Header Bar with Separate Cancel Button */}
      <div
        className="w-full max-w-2xl flex items-center justify-between mb-2.5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          <CalendarIcon className="w-5 h-5 text-brand-teal" />
          <h2 className="text-sm sm:text-base font-extrabold tracking-wide">
            Attendance &amp; Digital Signature Calendar
          </h2>
          <span className="hidden sm:inline-block text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded-full text-white/80 border border-white/10">
            {employee.name}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/15 transition-all cursor-pointer active:scale-95 shadow-sm"
        >
          Close
        </button>
      </div>

      {/* Main Modal Body */}
      <div
        className="w-full max-w-2xl bg-white rounded-3xl border border-[#E9E0D5] shadow-2xl overflow-hidden p-4 sm:p-5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 items-stretch">
          {/* Left Side: Employee Summary & Counters */}
          <div className="md:col-span-5 flex flex-col items-center text-center justify-between p-3.5 sm:p-4 bg-[#FAF7F2] rounded-2xl border border-[#EAE3DA]">
            <div className="w-full flex flex-col items-center space-y-2">
              <img
                src="/logobg.webp"
                alt="Cafe Logo"
                className="w-20 sm:w-24 h-20 sm:h-24 object-contain drop-shadow-sm"
              />
              <div>
                <h3 className="font-black text-sm sm:text-base text-brand-brown-dark leading-tight">
                  {employee.name}
                </h3>
                <span className="text-[11px] font-bold text-brand-teal uppercase tracking-wider block mt-0.5">
                  {employee.role}
                </span>
              </div>
            </div>

            {/* Attendance Counters Breakdown */}
            <div className="w-full pt-3 mt-3 border-t border-[#EAE3DA] space-y-1.5 text-left text-xs">
              <div className="flex justify-between items-center">
                <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> On-Time:
                </span>
                <span className="font-extrabold text-emerald-800 font-mono text-[11px]">
                  {stats.presentCount} Days
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-amber-700 font-bold text-[11px] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Late:
                </span>
                <span className="font-extrabold text-amber-800 font-mono text-[11px]">
                  {stats.lateCount} Days
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-yellow-800 font-bold text-[11px] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" /> Early Leave:
                </span>
                <span className="font-extrabold text-yellow-900 font-mono text-[11px]">
                  {stats.earlyLeaveCount} Days
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-purple-700 font-bold text-[11px] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500" /> Overtime:
                </span>
                <span className="font-extrabold text-purple-800 font-mono text-[11px]">
                  {stats.overtimeCount} Days
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-rose-700 font-bold text-[11px] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Absent:
                </span>
                <span className="font-extrabold text-rose-800 font-mono text-[11px]">
                  {stats.absentCount} Days
                </span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-[#EAE3DA]">
                <span className="text-brand-brown-dark font-extrabold text-[11px]">Total Attended:</span>
                <span className="font-black text-brand-brown-dark font-mono text-xs sm:text-sm">
                  {stats.totalAttended} / {stats.workingDays} Days
                </span>
              </div>
            </div>
          </div>

          {/* Right Side: Month Switcher & Calendar Matrix */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-2.5">
            {/* Month Switcher */}
            <div className="flex items-center justify-between py-1 px-1.5 bg-[#FAF7F2] rounded-xl border border-[#EAE3DA]">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 hover:bg-cream-200 rounded-lg text-brand-brown-dark transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="font-extrabold text-xs text-brand-brown-dark font-mono">
                {monthTitle}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 hover:bg-cream-200 rounded-lg text-brand-brown-dark transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Legend with exact colors */}
            <div className="flex items-center justify-between text-[9px] font-extrabold px-1 flex-wrap gap-1">
              <div className="flex items-center gap-1 text-emerald-800">
                <span className="w-2 h-2 rounded-full border border-emerald-600 bg-emerald-500 inline-block" />
                <span>Green: On-Time</span>
              </div>
              <div className="flex items-center gap-1 text-amber-800">
                <span className="w-2 h-2 rounded-full border border-amber-600 bg-amber-500 inline-block" />
                <span>Orange: Late</span>
              </div>
              <div className="flex items-center gap-1 text-yellow-900">
                <span className="w-2 h-2 rounded-full border border-yellow-600 bg-yellow-400 inline-block" />
                <span>Yellow: Early</span>
              </div>
              <div className="flex items-center gap-1 text-purple-800">
                <span className="w-2 h-2 rounded-full border border-purple-600 bg-purple-500 inline-block" />
                <span>Purple: OT</span>
              </div>
              <div className="flex items-center gap-1 text-rose-800">
                <span className="w-2 h-2 rounded-full border border-rose-600 bg-rose-500 inline-block" />
                <span>Red: Absent</span>
              </div>
            </div>

            {/* Calendar Matrix */}
            <div className="pt-0.5">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-1 text-center">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dayChar, idx) => (
                  <div
                    key={idx}
                    className={`text-[10px] font-extrabold ${
                      idx === 6 ? 'text-rose-500' : 'text-text-muted'
                    }`}
                  >
                    {dayChar}
                  </div>
                ))}
              </div>

              {/* Date cells */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty offset days */}
                {Array.from({ length: startingDayOffset }).map((_, i) => (
                  <div key={`empty-${i}`} className="w-8 h-8 sm:w-9 sm:h-9 mx-auto aspect-square" />
                ))}

                {/* Month days */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const record = attendanceMap[dateKey];
                  const isPresent = record?.status === 'PRESENT';
                  const isLate = record?.status === 'LATE';
                  const isEarlyLeave = record?.status === 'EARLY_LEAVE';
                  const isOvertime = record?.status === 'OVERTIME';
                  const isAbsent = record?.status === 'ABSENT';
                  const isHoliday = record?.status === 'HOLIDAY';
                  const isSelected = selectedDayKey === dateKey;

                  return (
                    <div
                      key={dateKey}
                      onClick={() => setSelectedDayKey(dateKey)}
                      onDoubleClick={() => handleCycleDayStatus(dateKey)}
                      className="flex items-center justify-center p-0.5"
                    >
                      <button
                        type="button"
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full aspect-square flex items-center justify-center cursor-pointer transition-all ${
                          isSelected
                            ? 'ring-2 ring-brand-teal ring-offset-2 ring-offset-[#FAF7F2] shadow-sm scale-110 z-10'
                            : 'hover:scale-105'
                        } ${
                          isPresent
                            ? 'border-2 border-emerald-600 bg-emerald-50 text-emerald-700 font-extrabold text-[11px] sm:text-xs shadow-2xs'
                            : isLate
                            ? 'border-2 border-amber-600 bg-amber-50 text-amber-700 font-extrabold text-[11px] sm:text-xs shadow-2xs'
                            : isEarlyLeave
                            ? 'border-2 border-yellow-500 bg-yellow-50 text-yellow-900 font-extrabold text-[11px] sm:text-xs shadow-2xs'
                            : isOvertime
                            ? 'border-2 border-purple-600 bg-purple-50 text-purple-700 font-extrabold text-[11px] sm:text-xs shadow-2xs'
                            : isAbsent
                            ? 'border-2 border-rose-600 bg-rose-50 text-rose-700 font-extrabold text-[11px] sm:text-xs shadow-2xs'
                            : isHoliday
                            ? 'text-rose-400/80 font-bold text-[11px] sm:text-xs hover:bg-cream-100'
                            : 'text-text-muted/80 font-semibold text-[11px] sm:text-xs hover:bg-cream-100'
                        }`}
                        title={`${dateKey}: ${record?.status || 'No record'} (Click to inspect, double-click to toggle)`}
                      >
                        {dayNum}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Date Inspector Card */}
            {selectedDayKey && (
              <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#EAE3DA] space-y-2.5 text-xs animate-in fade-in shadow-xs">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#EAE3DA] pb-2">
                  <span className="font-extrabold text-brand-brown-dark font-mono flex items-center gap-1.5 text-xs">
                    <CalendarIcon className="w-3.5 h-3.5 text-brand-teal" />
                    {new Date(selectedDayKey + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCycleDayStatus(selectedDayKey)}
                      className="px-2.5 py-0.5 rounded-lg bg-white border border-[#E0D7CC] hover:bg-cream-100 text-[10px] text-brand-teal font-extrabold transition-colors cursor-pointer shadow-2xs"
                      title="Cycle: Present → Late → Early Leave → Overtime → Absent → Holiday → Clear"
                    >
                      Cycle Status
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDayKey(null)}
                      className="p-1 rounded-lg text-text-muted hover:text-brand-brown-dark hover:bg-cream-200 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 4-Metric Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="bg-white p-2 rounded-xl border border-[#EAE3DA]">
                    <span className="text-[9px] font-extrabold uppercase text-text-muted block mb-0.5">
                      Status
                    </span>
                    {selectedDayRecord?.status === 'PRESENT' ? (
                      <span className="font-extrabold text-emerald-700 text-xs">Present ✓</span>
                    ) : selectedDayRecord?.status === 'LATE' ? (
                      <span className="font-extrabold text-amber-700 text-xs">Late Arrival</span>
                    ) : selectedDayRecord?.status === 'EARLY_LEAVE' ? (
                      <span className="font-extrabold text-yellow-900 text-xs">Early Leave</span>
                    ) : selectedDayRecord?.status === 'OVERTIME' ? (
                      <span className="font-extrabold text-purple-700 text-xs">+ Overtime</span>
                    ) : selectedDayRecord?.status === 'ABSENT' ? (
                      <span className="font-extrabold text-rose-700 text-xs">Absent</span>
                    ) : selectedDayRecord?.status === 'HOLIDAY' ? (
                      <span className="font-extrabold text-text-muted text-xs">Weekly Off</span>
                    ) : (
                      <span className="font-bold text-text-muted text-xs">No Record</span>
                    )}
                  </div>

                  <div className="bg-white p-2 rounded-xl border border-[#EAE3DA]">
                    <span className="text-[9px] font-extrabold uppercase text-text-muted block mb-0.5">
                      Worked Hours
                    </span>
                    <span className="font-black text-brand-brown-dark font-mono text-xs">
                      {!selectedDayRecord ||
                      selectedDayRecord.status === 'ABSENT' ||
                      selectedDayRecord.status === 'HOLIDAY'
                        ? '0.0 hrs'
                        : selectedDayRecord.workedHours !== undefined
                        ? `${selectedDayRecord.workedHours.toFixed(1)} hrs`
                        : `${selectedDayRecord.standardShiftHours || 8}.0 hrs`}
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded-xl border border-[#EAE3DA]">
                    <span className="text-[9px] font-extrabold uppercase text-text-muted block mb-0.5">
                      Check In
                    </span>
                    <span className="font-bold text-brand-brown-dark font-mono text-xs">
                      {selectedDayRecord?.checkInTime || '—'}
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded-xl border border-[#EAE3DA]">
                    <span className="text-[9px] font-extrabold uppercase text-text-muted block mb-0.5">
                      Check Out
                    </span>
                    <span className="font-bold text-brand-brown-dark font-mono text-xs">
                      {selectedDayRecord?.checkOutTime || '—'}
                    </span>
                  </div>
                </div>

                {/* Additional Info if present */}
                {(selectedDayRecord?.notes || selectedDayRecord?.lateMinutes || selectedDayRecord?.overtimeHours) && (
                  <div className="text-[10px] text-text-secondary bg-white p-1.5 px-2.5 rounded-lg border border-[#EAE3DA] flex items-center justify-between">
                    <span className="font-medium">{selectedDayRecord.notes || 'Shift record'}</span>
                    {selectedDayRecord.isLate && selectedDayRecord.lateMinutes ? (
                      <span className="font-extrabold text-amber-700">Late: {selectedDayRecord.lateMinutes}m</span>
                    ) : selectedDayRecord.overtimeHours ? (
                      <span className="font-extrabold text-purple-700">OT: +{selectedDayRecord.overtimeHours}h</span>
                    ) : null}
                  </div>
                )}

                {/* Digital Signatures Thumbnail */}
                <div className="pt-1.5 border-t border-[#EAE3DA]">
                  {selectedDayRecord?.checkInSignature || selectedDayRecord?.checkOutSignature ? (
                    <div className="flex items-center gap-2">
                      {selectedDayRecord.checkInSignature && (
                        <div className="flex-1 p-1.5 bg-white rounded-xl border border-[#EAE3DA] text-center shadow-2xs">
                          <span className="text-[9px] font-extrabold uppercase text-text-muted block mb-0.5">
                            Check-In Signature ({selectedDayRecord.checkInTime || 'In'})
                          </span>
                          <img
                            src={selectedDayRecord.checkInSignature}
                            alt="Sign In"
                            className="h-8 mx-auto object-contain"
                          />
                        </div>
                      )}
                      {selectedDayRecord.checkOutSignature && (
                        <div className="flex-1 p-1.5 bg-white rounded-xl border border-[#EAE3DA] text-center shadow-2xs">
                          <span className="text-[9px] font-extrabold uppercase text-text-muted block mb-0.5">
                            Check-Out Signature ({selectedDayRecord.checkOutTime || 'Out'})
                          </span>
                          <img
                            src={selectedDayRecord.checkOutSignature}
                            alt="Sign Out"
                            className="h-8 mx-auto object-contain"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-1 text-[10px] text-text-muted italic">
                      No handwritten digital signature recorded for this date.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Status text */}
            <div className="pt-2 border-t border-[#F0E8DF] flex items-center justify-between text-xs text-text-secondary">
              <span className="text-[11px] text-text-muted">Click date to inspect • Double-click to toggle</span>
              <span className="font-extrabold text-brand-brown-dark font-mono">
                {stats.totalAttended} / {stats.workingDays} Days
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
