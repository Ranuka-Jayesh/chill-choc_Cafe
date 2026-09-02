import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { db } from '@/services/storage/db';
import { Employee } from '@/types';
import { attendanceService, EmployeeLiveAttendanceState } from '@/services/attendanceService';
import { SignaturePadCanvas, SignaturePadRef } from '@/features/pos/components/SignaturePadCanvas';
import { formatDateTime } from '@/utils/format';
import {
  UserCheck,
  X,
  Search,
  CheckCircle2,
  Sparkles,
  Trophy,
  Check,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface PosAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PosAttendanceModal: React.FC<PosAttendanceModalProps> = ({ isOpen, onClose }) => {
  const [employees, setEmployees] = useState<Employee[]>(() => db.getSnapshot().employees || []);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [hasSignature, setHasSignature] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Overtime Celebration Popup State
  const [celebrationData, setCelebrationData] = useState<{
    employeeName: string;
    overtimeHours: number;
    workedHours: number;
  } | null>(null);

  const sigPadRef = useRef<SignaturePadRef | null>(null);

  // Live timer for current clock
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Subscribe to DB changes
  useEffect(() => {
    const unsub = db.subscribe(() => {
      setEmployees(db.getSnapshot().employees || []);
    });
    return unsub;
  }, []);

  // Filter active employees
  const activeEmployees = useMemo(() => {
    return employees.filter((e) => e.active);
  }, [employees]);

  // Evaluated live attendance states for all active employees
  const liveStates = useMemo(() => {
    const map = new Map<string, EmployeeLiveAttendanceState>();
    activeEmployees.forEach((emp) => {
      map.set(emp.id, attendanceService.getEmployeeLiveState(emp, currentTime));
    });
    return map;
  }, [activeEmployees, currentTime]);

  // Default selection when opened
  useEffect(() => {
    if (isOpen && activeEmployees.length > 0 && !selectedEmpId) {
      setSelectedEmpId(activeEmployees[0].id);
    }
  }, [isOpen, activeEmployees, selectedEmpId]);

  // Reset signature when selected employee changes
  useEffect(() => {
    setHasSignature(false);
    sigPadRef.current?.clear();
  }, [selectedEmpId]);

  // Close with Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (celebrationData) {
          setCelebrationData(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, celebrationData]);

  if (!isOpen) return null;

  // Search filtered list
  const filteredEmployees = activeEmployees.filter((emp) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return emp.name.toLowerCase().includes(q) || emp.role.toLowerCase().includes(q);
  });

  const selectedEmployee = activeEmployees.find((e) => e.id === selectedEmpId) || activeEmployees[0];
  const selectedState = selectedEmployee ? liveStates.get(selectedEmployee.id) : null;

  // Attended counts
  const signedCount = Array.from(liveStates.values()).filter((s) => s.isClockedIn).length;

  const handleClockIn = async () => {
    if (!selectedEmployee) return;
    const dataUrl = sigPadRef.current?.getSignatureDataUrl();
    if (!dataUrl) {
      toast.error('Please draw your digital signature before confirming attendance.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = attendanceService.clockInEmployee(selectedEmployee.id, dataUrl);
      toast.success(
        res.isLate
          ? `Clock-in recorded for ${selectedEmployee.name} (${res.lateMinutes}m Late).`
          : `On-time clock-in confirmed for ${selectedEmployee.name}!`,
        { icon: '✓' }
      );
      setHasSignature(false);
      sigPadRef.current?.clear();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record clock-in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClockOut = async () => {
    if (!selectedEmployee) return;
    const dataUrl = sigPadRef.current?.getSignatureDataUrl();
    if (!dataUrl) {
      toast.error('Please draw your digital signature before signing out.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = attendanceService.clockOutEmployee(selectedEmployee.id, dataUrl);

      if (res.isOvertime) {
        setCelebrationData({
          employeeName: selectedEmployee.name,
          overtimeHours: res.overtimeHours,
          workedHours: res.workedHours,
        });
      } else if (res.isEarlyLeave) {
        toast.warning(
          `Early departure logged for ${selectedEmployee.name} (${res.earlyMinutes} mins before shift end).`
        );
      } else {
        toast.success(`Clock-out completed for ${selectedEmployee.name} (${res.workedHours}h worked).`);
      }

      setHasSignature(false);
      sigPadRef.current?.clear();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record clock-out.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-brand-brown-deep/80 backdrop-blur-md overflow-hidden animate-in fade-in select-none"
    >
      <div className="relative w-full max-w-[1380px] w-[96vw] h-[92vh] max-h-[820px] flex flex-col justify-between">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-3 text-white shrink-0 mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white drop-shadow-sm">
              Staff Attendance
            </h1>
            <span className="px-3.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold text-cream-100 border border-white/25 uppercase tracking-wide">
              Daily Check-In &amp; Out
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md text-white text-xs sm:text-sm font-bold transition-all border border-white/20 cursor-pointer active:scale-95 shadow-sm"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Close</span>
          </button>
        </div>

        {/* Dual Floating Cards Grid (Fluid Responsive Flexbox filling height) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 flex-1 min-h-0 items-stretch">
          {/* ========================================================================= */}
          {/* CARD 1 (LEFT - 5 Cols): SINGLE-LINE STAFF DIRECTORY                        */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 flex flex-col h-full bg-white rounded-2xl sm:rounded-[28px] shadow-2xl border border-[#E9E0D5] overflow-hidden min-h-0">
            {/* Header: Pure White, Minimal */}
            <div className="p-4 sm:p-5 border-b border-[#F0EAE1] shrink-0">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-black uppercase tracking-wider text-brand-brown-dark flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-brand-teal" />
                  Staff Directory
                </span>

                <span className="text-xs font-bold text-text-muted font-mono">
                  {signedCount} / {activeEmployees.length} Signed
                </span>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search staff..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-cream-50/50 border border-[#EAE3DA] rounded-xl text-xs font-bold text-brand-brown-dark placeholder:text-text-muted focus:outline-none focus:border-brand-teal"
                />
              </div>
            </div>

            {/* Staff List Body - STRICT SINGLE LINE ROWS, SCROLLS INTERNALLY ONLY */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-2 scrollbar-thin">
              {filteredEmployees.length === 0 ? (
                <div className="text-center py-16 text-text-muted">
                  <p className="font-bold text-xs">No staff members found.</p>
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const state = liveStates.get(emp.id);
                  const isSelected = emp.id === selectedEmpId;

                  // Clean status color badges
                  const badgeClasses =
                    state?.colorCategory === 'GREEN'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : state?.colorCategory === 'ORANGE'
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : state?.colorCategory === 'YELLOW'
                      ? 'bg-yellow-50 text-yellow-800 border-yellow-300'
                      : state?.colorCategory === 'PURPLE'
                      ? 'bg-purple-50 text-purple-700 border-purple-300'
                      : 'bg-rose-50 text-rose-700 border-rose-300'; // RED

                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => setSelectedEmpId(emp.id)}
                      className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                        isSelected
                          ? 'ring-2 ring-brand-teal bg-cream-50/70 border-brand-teal shadow-2xs'
                          : 'border-[#F0EAE1] hover:border-brand-teal/40 bg-white hover:bg-cream-50/30'
                      }`}
                    >
                      {/* Left: Name and Role on ONE single line */}
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="font-extrabold text-xs sm:text-sm text-brand-brown-dark truncate">
                          {emp.name}
                        </span>
                        <span className="text-text-muted text-[11px] font-semibold truncate hidden sm:inline">
                          • {emp.role}
                        </span>
                      </div>

                      {/* Right: Clean Status Badge & Arrow */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border shrink-0 ${badgeClasses}`}
                        >
                          {state?.statusLabel}
                        </span>
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform ${
                            isSelected ? 'text-brand-teal translate-x-0.5' : 'text-zinc-300'
                          }`}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CARD 2 (RIGHT - 7 Cols): CLEAN SIGNATURE FORM CARD                        */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 flex flex-col h-full bg-white rounded-2xl sm:rounded-[28px] shadow-2xl border border-[#E9E0D5] overflow-hidden min-h-0 p-5 sm:p-6">
            {selectedEmployee && selectedState ? (
              <div className="flex-1 min-h-0 flex flex-col justify-between space-y-3">
                {/* Header: Pure White, Minimal, Single-Line */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#F0EAE1] shrink-0">
                  <div className="min-w-0">
                    <h3 className="font-black text-lg sm:text-2xl text-brand-brown-dark truncate">
                      {selectedEmployee.name}
                    </h3>
                    <span className="text-xs sm:text-sm font-bold text-brand-teal block">
                      {selectedEmployee.role}
                    </span>
                  </div>

                  {/* Clean Status Badge */}
                  <span
                    className={`px-3.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide border shrink-0 ${
                      selectedState.colorCategory === 'GREEN'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : selectedState.colorCategory === 'ORANGE'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : selectedState.colorCategory === 'YELLOW'
                        ? 'bg-yellow-50 text-yellow-900 border-yellow-300'
                        : selectedState.colorCategory === 'PURPLE'
                        ? 'bg-purple-50 text-purple-800 border-purple-300'
                        : 'bg-rose-50 text-rose-800 border-rose-300'
                    }`}
                  >
                    {selectedState.statusLabel}
                  </span>
                </div>

                {/* Signature Canvas Area (Fluid expansion inside flexbox) */}
                {!selectedState.isClockedOut ? (
                  <div className="flex-1 min-h-0 flex flex-col space-y-2">
                    <div className="flex items-center justify-between shrink-0">
                      <span className="text-[11px] font-black uppercase tracking-wider text-text-muted">
                        {!selectedState.isClockedIn ? 'Clock-In Signature' : 'Clock-Out Signature'}
                      </span>
                      {selectedState.isClockedIn && (
                        <span className="text-xs font-mono font-bold text-brand-teal">
                          Active: {selectedState.workedHoursFormatted}
                        </span>
                      )}
                    </div>

                    <SignaturePadCanvas
                      ref={sigPadRef}
                      onSignatureChange={(_dataUrl, isEmpty) => setHasSignature(!isEmpty)}
                      className="flex-1 min-h-0 w-full"
                    />
                  </div>
                ) : (
                  /* Completed View for Today */
                  <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center p-6 space-y-4">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
                      <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
                    </div>
                    <div>
                      <h4 className="font-black text-base text-brand-brown-dark">
                        Attendance Completed for Today
                      </h4>
                      <p className="text-xs text-text-muted mt-1">
                        {selectedEmployee.name} has signed both arrival and departure.
                      </p>
                    </div>

                    {/* Signatures preview */}
                    <div className="grid grid-cols-2 gap-3 w-full max-w-sm pt-2">
                      {selectedState.record?.checkInSignature && (
                        <div className="p-3 bg-cream-50/50 rounded-2xl border border-[#EAE3DA]">
                          <span className="text-[10px] font-bold text-text-muted block mb-1">
                            Check-In ({selectedState.record.checkInTime})
                          </span>
                          <img
                            src={selectedState.record.checkInSignature}
                            alt="In Sign"
                            className="h-12 mx-auto object-contain"
                          />
                        </div>
                      )}
                      {selectedState.record?.checkOutSignature && (
                        <div className="p-3 bg-cream-50/50 rounded-2xl border border-[#EAE3DA]">
                          <span className="text-[10px] font-bold text-text-muted block mb-1">
                            Check-Out ({selectedState.record.checkOutTime})
                          </span>
                          <img
                            src={selectedState.record.checkOutSignature}
                            alt="Out Sign"
                            className="h-12 mx-auto object-contain"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center py-20 text-text-muted">
                <p className="text-xs font-bold">Select a staff member from the list to begin.</p>
              </div>
            )}
          </div>
        </div>

        {/* SEPARATE FLOATING BOTTOM ACTION BAR - Always visible, never cut off */}
        {selectedEmployee && selectedState && !selectedState.isClockedOut && (
          <div className="flex items-center justify-between gap-3 pt-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                sigPadRef.current?.clear();
                setHasSignature(false);
              }}
              disabled={!hasSignature || isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md text-white text-xs sm:text-sm font-bold border border-white/20 transition-all cursor-pointer active:scale-95 shadow-sm disabled:opacity-40"
            >
              Clear Signature
            </button>

            {!selectedState.isClockedIn ? (
              <button
                type="button"
                onClick={handleClockIn}
                disabled={!hasSignature || isSubmitting}
                className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-brand-teal hover:bg-brand-teal-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black shadow-teal transition-all active:scale-95 cursor-pointer"
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>CONFIRM &amp; CLOCK IN</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClockOut}
                disabled={!hasSignature || isSubmitting}
                className={`flex items-center gap-2 px-8 py-3 rounded-2xl text-white text-sm font-black shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer ${
                  selectedState.overtimeMinutes > 0
                    ? 'bg-purple-700 hover:bg-purple-800 shadow-purple-200'
                    : 'bg-brand-teal hover:bg-brand-teal-dark shadow-teal'
                }`}
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>
                  {selectedState.overtimeMinutes > 0
                    ? 'CONFIRM & MARK OVERTIME LEAVE'
                    : 'CONFIRM & CLOCK OUT'}
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* OVERTIME CONGRATULATIONS CELEBRATION MODAL */}
      {celebrationData &&
        createPortal(
          <div
            onClick={() => setCelebrationData(null)}
            className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-brand-brown-deep/80 backdrop-blur-md animate-in fade-in select-none"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md bg-gradient-to-b from-white via-cream-50 to-[#FAF7F2] rounded-[36px] shadow-2xl border-2 border-purple-200 p-6 sm:p-8 text-center space-y-5 overflow-hidden animate-in zoom-in-95 duration-200"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-purple-500 to-emerald-400" />
              <div className="absolute -top-12 -left-12 w-32 h-32 bg-purple-200/50 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-200/50 rounded-full blur-2xl pointer-events-none" />

              <div className="relative mx-auto w-20 h-20 rounded-3xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-500 text-white flex items-center justify-center shadow-lg shadow-purple-300/50 animate-bounce">
                <Trophy className="w-10 h-10 stroke-[2.2] text-amber-300" />
                <Sparkles className="w-5 h-5 absolute -top-1 -right-1 text-amber-300 animate-pulse" />
              </div>

              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-[11px] font-black uppercase tracking-wider border border-purple-200">
                  🎉 Overtime Completed!
                </span>
                <h3 className="font-black text-xl sm:text-2xl text-brand-brown-dark leading-tight pt-1">
                  Thank You, {celebrationData.employeeName}!
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed px-2">
                  Your dedication and hard work make our café special! Today you completed{' '}
                  <strong className="text-purple-700 font-bold">{celebrationData.workedHours}h</strong> including{' '}
                  <strong className="text-emerald-700 font-bold">+{celebrationData.overtimeHours} hours</strong> of
                  overtime logged for payroll.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 py-1">
                <div className="p-3 bg-white rounded-2xl border border-purple-100 shadow-2xs">
                  <span className="text-[10px] font-bold text-text-muted block">Total Hours</span>
                  <span className="text-base font-black text-brand-brown-dark font-mono">
                    {celebrationData.workedHours} hrs
                  </span>
                </div>
                <div className="p-3 bg-purple-50/80 rounded-2xl border border-purple-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-purple-700 block">Overtime Bonus</span>
                  <span className="text-base font-black text-purple-800 font-mono">
                    +{celebrationData.overtimeHours} hrs
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCelebrationData(null)}
                className="w-full py-3.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-200 active:scale-95 transition-all cursor-pointer"
              >
                Wonderful, Thank You! ✨
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
