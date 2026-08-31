import React, { useState, useEffect } from 'react';
import { shiftService } from '@/services/shiftService';
import { CashierShift } from '@/types';
import { db } from '@/services/storage/db';
import { formatLKR, formatDateTime, formatTime } from '@/utils/format';
import { CalendarDays, CheckCircle2, AlertTriangle, Printer, Eye, X } from 'lucide-react';

export const AdminShiftsPage: React.FC = () => {
  const [shifts, setShifts] = useState(shiftService.getAllShifts());
  const [inspectingShift, setInspectingShift] = useState<CashierShift | null>(null);

  useEffect(() => {
    const unsub = db.subscribe(() => setShifts(shiftService.getAllShifts()));
    return unsub;
  }, []);

  return (
    <div className="space-y-5 w-full pb-12 animate-in fade-in">
      {/* Shifts Table */}
      <div className="bg-white rounded-3xl border border-border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-cream-50 text-text-secondary font-extrabold uppercase text-[10px]">
                <th className="py-3 px-4">Shift #</th>
                <th className="py-3 px-4">Cashier</th>
                <th className="py-3 px-4">Terminal</th>
                <th className="py-3 px-4">Opened / Closed</th>
                <th className="py-3 px-4 text-right">Opening Float</th>
                <th className="py-3 px-4 text-right">Cash Sales</th>
                <th className="py-3 px-4 text-right">Card + QR</th>
                <th className="py-3 px-4 text-right">Expected</th>
                <th className="py-3 px-4 text-right">Actual Count</th>
                <th className="py-3 px-4 text-center">Variance</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100 font-medium">
              {shifts.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-10 text-text-secondary">
                    No cashier shifts recorded yet.
                  </td>
                </tr>
              ) : (
                shifts.map((sh) => {
                  const isClosed = sh.status === 'CLOSED';
                  const expected = sh.expectedClosingCash || (sh.openingCash + sh.cashSales + sh.cashIn - sh.cashRefunds - sh.cashOut);

                  return (
                    <tr key={sh.id} className="hover:bg-cream-50/60 transition-colors">
                      <td className="py-3 px-4 font-black text-brand-brown-dark">#{sh.shiftNumber}</td>
                      <td className="py-3 px-4 font-bold">{sh.cashierName}</td>
                      <td className="py-3 px-4 text-text-secondary">{sh.terminalName}</td>
                      <td className="py-3 px-4 text-text-secondary">
                        <div>{formatDateTime(sh.openedAt)}</div>
                        {sh.closedAt && <div className="text-[10px] text-text-secondary/80">Closed: {formatTime(sh.closedAt)}</div>}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums">{formatLKR(sh.openingCash)}</td>
                      <td className="py-3 px-4 text-right font-bold text-status-success tabular-nums">{formatLKR(sh.cashSales)}</td>
                      <td className="py-3 px-4 text-right text-text-secondary font-semibold tabular-nums">
                        {formatLKR(sh.cardSales + sh.qrSales)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-text-primary tabular-nums">
                        {formatLKR(expected)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-brand-brown-deep tabular-nums">
                        {isClosed && sh.closingCashEntered !== undefined ? formatLKR(sh.closingCashEntered) : '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isClosed && sh.variance !== undefined ? (
                          <span
                            className={`px-2 py-0.5 rounded-full font-black text-[10px] uppercase tabular-nums ${
                              sh.variance === 0
                                ? 'bg-status-success-bg text-status-success'
                                : sh.variance < 0
                                ? 'bg-status-danger-bg text-status-danger'
                                : 'bg-status-warning-bg text-status-warning'
                            }`}
                          >
                            {sh.variance === 0 ? 'Balanced' : `${sh.variance < 0 ? '-' : '+'}${formatLKR(Math.abs(sh.variance))}`}
                          </span>
                        ) : (
                          <span className="text-text-secondary">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase ${
                            isClosed
                              ? 'bg-cream-100 text-brand-brown border border-cream-200'
                              : 'bg-status-success-bg text-status-success animate-pulse'
                          }`}
                        >
                          {sh.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setInspectingShift(sh)}
                          className="px-2.5 py-1 bg-cream-100 hover:bg-brand-teal hover:text-white rounded-lg text-brand-brown font-bold text-[11px] transition-colors"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shift Detailed Report Modal */}
      {inspectingShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-brown-deep/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-elevated border border-border overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 bg-cream-50 border-b border-border">
              <div>
                <h3 className="font-extrabold text-base text-brand-brown-dark">
                  Shift #{inspectingShift.shiftNumber} Summary Report
                </h3>
                <p className="text-xs text-text-secondary">
                  Cashier: {inspectingShift.cashierName} • {inspectingShift.terminalName}
                </p>
              </div>
              <button onClick={() => setInspectingShift(null)} className="p-1.5 text-text-secondary hover:bg-cream-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-cream-50 rounded-2xl border border-border">
                <div>
                  <span className="text-text-secondary text-[10px] uppercase font-bold">Opened</span>
                  <div className="font-bold">{formatDateTime(inspectingShift.openedAt)}</div>
                </div>
                <div>
                  <span className="text-text-secondary text-[10px] uppercase font-bold">Closed</span>
                  <div className="font-bold">{inspectingShift.closedAt ? formatDateTime(inspectingShift.closedAt) : 'Currently Active'}</div>
                </div>
              </div>

              {/* Financial Lines */}
              <div className="space-y-2 p-4 bg-white rounded-2xl border border-border">
                <div className="flex justify-between text-text-secondary">
                  <span>Opening Float:</span>
                  <span className="font-bold text-text-primary tabular-nums">{formatLKR(inspectingShift.openingCash)}</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Cash Sales:</span>
                  <span className="font-bold text-status-success tabular-nums">{formatLKR(inspectingShift.cashSales)}</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Card Sales:</span>
                  <span className="font-bold text-text-primary tabular-nums">{formatLKR(inspectingShift.cardSales)}</span>
                </div>
                {inspectingShift.cashIn > 0 && (
                  <div className="flex justify-between text-text-secondary">
                    <span>Cash In (Float Top-up):</span>
                    <span className="font-bold text-status-success tabular-nums">+{formatLKR(inspectingShift.cashIn)}</span>
                  </div>
                )}
                {inspectingShift.cashOut > 0 && (
                  <div className="flex justify-between text-text-secondary">
                    <span>Cash Out (Expenses):</span>
                    <span className="font-bold text-status-danger tabular-nums">-{formatLKR(inspectingShift.cashOut)}</span>
                  </div>
                )}
                {inspectingShift.cashRefunds > 0 && (
                  <div className="flex justify-between text-text-secondary">
                    <span>Cash Refunds:</span>
                    <span className="font-bold text-status-danger tabular-nums">-{formatLKR(inspectingShift.cashRefunds)}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-border flex justify-between font-extrabold text-sm text-brand-brown-dark">
                  <span>Expected Drawer Cash:</span>
                  <span className="tabular-nums">
                    {formatLKR(
                      inspectingShift.expectedClosingCash ||
                        inspectingShift.openingCash + inspectingShift.cashSales + inspectingShift.cashIn - inspectingShift.cashRefunds - inspectingShift.cashOut
                    )}
                  </span>
                </div>

                {inspectingShift.closingCashEntered !== undefined && (
                  <>
                    <div className="flex justify-between font-extrabold text-sm text-brand-brown-dark">
                      <span>Actual Counted Cash:</span>
                      <span className="tabular-nums">{formatLKR(inspectingShift.closingCashEntered)}</span>
                    </div>
                    <div className="pt-2 border-t border-border flex justify-between font-black text-sm text-brand-teal">
                      <span>Reconciliation Variance:</span>
                      <span className="tabular-nums">{formatLKR(inspectingShift.variance || 0)} ({inspectingShift.varianceStatus})</span>
                    </div>
                  </>
                )}
              </div>

              {inspectingShift.closingNotes && (
                <div className="p-3 bg-cream-50 rounded-xl border border-border">
                  <span className="font-bold text-[10px] uppercase text-text-secondary block mb-0.5">Variance Reason / Note:</span>
                  <p className="text-text-primary font-medium">{inspectingShift.closingNotes}</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-cream-50 border-t border-border flex justify-end">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-teal text-white rounded-xl font-bold text-xs shadow-teal hover:bg-brand-teal-dark"
              >
                <Printer className="w-4 h-4" />
                Print Shift Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
