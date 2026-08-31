import React, { useState, useEffect, useMemo } from 'react';
import { auditService } from '@/services/settingsService';
import { AuditLog, AuditAction } from '@/types';
import { db } from '@/services/storage/db';
import { formatDateTime } from '@/utils/format';
import { MonthYearPicker, MonthYearValue } from '@/components/ui/MonthYearPicker';
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect';
import {
  ShieldCheck,
  Search,
  X,
  User,
  Activity,
  Calendar,
  Layers,
  ArrowUpDown,
  Lock,
  ShoppingBag,
  DollarSign,
  Boxes,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';

const ACTION_FILTER_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All Action Types' },
  { value: 'LOGIN', label: 'Logins' },
  { value: 'LOGOUT', label: 'Logouts' },
  { value: 'SHIFT_OPEN', label: 'Shift Openings' },
  { value: 'SHIFT_CLOSE', label: 'Shift Closings' },
  { value: 'ORDER_CREATE', label: 'Orders Created' },
  { value: 'REFUND', label: 'Refunds & Returns' },
  { value: 'CASH_IN', label: 'Cash In (Drawer)' },
  { value: 'CASH_OUT', label: 'Cash Out / Expenses' },
  { value: 'STOCK_ADJUSTMENT', label: 'Stock Adjustments' },
  { value: 'SETTINGS_CHANGE', label: 'Settings Changes' },
  { value: 'USER_CHANGE', label: 'User & Staff Changes' },
];

export const AdminAuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>(auditService.getLogs());
  const [search, setSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [actionFilter, setActionFilter] = useState('ALL');

  // Month & Year Filter state (Default to current month/year)
  const [dateRange, setDateRange] = useState<MonthYearValue>(() => {
    const now = new Date();
    return {
      year: String(now.getFullYear()),
      month: String(now.getMonth() + 1),
    };
  });

  useEffect(() => {
    const unsub = db.subscribe(() => setLogs(auditService.getLogs()));
    return unsub;
  }, []);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      // 1. Month / Year filter
      if (l.timestamp) {
        const logDate = new Date(l.timestamp);
        const logYear = String(logDate.getFullYear());
        const logMonth = String(logDate.getMonth() + 1);
        if (dateRange.year !== 'ALL' && logYear !== dateRange.year) {
          return false;
        }
        if (dateRange.month !== 'ALL' && logMonth !== dateRange.month) {
          return false;
        }
      }

      // 2. Action filter
      if (actionFilter !== 'ALL' && l.action !== actionFilter) {
        return false;
      }

      // 3. Search filter
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesUser = l.userName?.toLowerCase().includes(q);
        const matchesAction = l.action?.toLowerCase().includes(q);
        const matchesEntity = l.entity?.toLowerCase().includes(q);
        const matchesDetails = l.details?.toLowerCase().includes(q);
        const matchesTerminal = l.terminalId?.toLowerCase().includes(q);
        return matchesUser || matchesAction || matchesEntity || matchesDetails || matchesTerminal;
      }

      return true;
    });
  }, [logs, dateRange, actionFilter, search]);

  const handleResetFilters = () => {
    const now = new Date();
    setDateRange({ year: String(now.getFullYear()), month: String(now.getMonth() + 1) });
    setActionFilter('ALL');
    setSearch('');
  };

  // Helper badge for action types
  const getActionBadge = (action: AuditAction) => {
    switch (action) {
      case 'LOGIN':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'LOGOUT':
        return 'bg-zinc-100 text-zinc-700 border-zinc-200';
      case 'SHIFT_OPEN':
        return 'bg-teal-50 text-brand-teal-dark border-teal-200';
      case 'SHIFT_CLOSE':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'ORDER_CREATE':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'REFUND':
      case 'ORDER_VOID':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'CASH_IN':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'CASH_OUT':
      case 'CASH_DROP':
        return 'bg-orange-50 text-orange-800 border-orange-200';
      case 'STOCK_ADJUSTMENT':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'SETTINGS_CHANGE':
      case 'USER_CHANGE':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-[#FAF7F2] text-brand-brown border-[#E0D7CC]';
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3 w-full pb-20 animate-in fade-in min-h-0">
      {/* 1. TOP HEADER & FILTER BAR */}
      <div className="flex-shrink-0 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E9E0D5] shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-black text-brand-brown-dark tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-teal" />
            Audit Trail & Security Logs
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Immutable activity log of cashier sessions, authorizations, orders & inventory movements
          </p>
        </div>

        {/* Filter Controls (Action Filter & Month Year Picker) */}
        <div className="flex items-center gap-2.5 flex-wrap self-stretch lg:self-auto">
          {/* Action Filter Custom Select */}
          <div className="w-[180px] sm:w-[200px]">
            <CustomSelect
              value={actionFilter}
              onChange={(val) => setActionFilter(val)}
              options={ACTION_FILTER_OPTIONS}
              buttonClassName="h-9 !py-0 px-3.5 bg-[#FAF7F2] hover:bg-cream-100 border-[#E0D7CC] rounded-2xl text-xs font-bold text-brand-brown-dark shadow-xs"
            />
          </div>

          {/* Month Year Capsule Picker */}
          <MonthYearPicker
            value={dateRange}
            onChange={(newVal) => setDateRange(newVal)}
          />
        </div>
      </div>

      {/* 2. AUDIT LOGS TABLE (Only records inside scroll) */}
      <div className="bg-white rounded-2xl border border-[#E9E0D5] shadow-xs flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 scrollbar-thin">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#FAF7F2] z-10 shadow-xs border-b border-[#EAE3DA]">
              <tr className="text-text-muted font-extrabold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3.5 bg-[#FAF7F2] whitespace-nowrap">Timestamp</th>
                <th className="py-2.5 px-3.5 bg-[#FAF7F2] whitespace-nowrap">User</th>
                <th className="py-2.5 px-3.5 bg-[#FAF7F2] whitespace-nowrap">Action</th>
                <th className="py-2.5 px-3.5 bg-[#FAF7F2] whitespace-nowrap">Entity</th>
                <th className="py-2.5 px-3.5 bg-[#FAF7F2]">Details</th>
                <th className="py-2.5 px-3.5 bg-[#FAF7F2] text-right whitespace-nowrap">Terminal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2ECE4] font-medium">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-text-muted">
                    <Activity className="w-7 h-7 mx-auto mb-1.5 text-text-muted/50" />
                    <div className="font-bold text-brand-brown-dark text-xs">
                      No audit logs found
                    </div>
                    <p className="text-[11px] text-text-secondary mt-0.5">
                      No system events matching the selected date and filters.
                    </p>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="mt-2.5 px-3.5 py-1 rounded-full bg-[#FAF7F2] hover:bg-cream-100 border border-[#E0D7CC] text-xs font-bold text-brand-brown transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset Filters
                    </button>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-[#FAF7F2]/70 transition-colors"
                    >
                      {/* Timestamp */}
                      <td className="py-2 px-3.5 text-text-secondary whitespace-nowrap font-mono text-[11px]">
                        {formatDateTime(log.timestamp)}
                      </td>

                      {/* User */}
                      <td className="py-2 px-3.5 font-bold text-brand-brown-dark whitespace-nowrap text-xs">
                        {log.userName || 'System'}
                      </td>

                      {/* Action Badge */}
                      <td className="py-2 px-3.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md font-black text-[9.5px] uppercase border tracking-wider ${getActionBadge(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>

                      {/* Target Entity */}
                      <td className="py-2 px-3.5 text-text-secondary font-medium whitespace-nowrap text-xs">
                        {log.entity || '-'}
                      </td>

                      {/* Event Details */}
                      <td className="py-2 px-3.5 text-brand-brown-deep font-normal text-xs">
                        {log.details || '-'}
                      </td>

                      {/* Terminal ID */}
                      <td className="py-2 px-3.5 text-right whitespace-nowrap font-mono text-[10px] text-text-muted">
                        {log.terminalId || 'BACKOFFICE'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. FLOATING BOTTOM POP-UP SEARCH BAR */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none select-none">
        <div className="bg-[#1E1917]/95 text-white backdrop-blur-xl border border-white/10 shadow-2xl rounded-full h-[52px] px-4 flex items-center gap-2 transition-all duration-300 pointer-events-auto">
          <Search className="w-4 h-4 text-white/50 shrink-0 pointer-events-none" />
          <input
            type="text"
            placeholder="Search audit trail by user, action or details..."
            value={search}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            onChange={(e) => setSearch(e.target.value)}
            className={`bg-transparent border-0 border-none outline-none focus:outline-none focus:ring-0 text-xs font-semibold text-white placeholder:text-white/40 shadow-none transition-all duration-300 ease-out ${
              isSearchFocused || search ? 'w-56 sm:w-72 md:w-80' : 'w-28 sm:w-36'
            }`}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
