import React, { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, X } from 'lucide-react';
import type { MaintenanceMachine } from '../types/maintenance';
import { buildMaintenanceScanUrl } from '../lib/maintenanceCodes';

interface MaintenanceQRPrintModalProps {
  machines: MaintenanceMachine[];
  onClose: () => void;
}

/** Print labels: QR + very small asset code under it (boss requirement). */
export default function MaintenanceQRPrintModal({ machines, onClose }: MaintenanceQRPrintModalProps) {
  const qrItems = useMemo(
    () =>
      machines.map((m) => ({
        id: m.id,
        qrValue: buildMaintenanceScanUrl(m),
        assetCode: m.assetCode,
        machineNumber: m.machineNumber,
        machineType: m.machineType,
      })),
    [machines]
  );

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/80 z-[130] flex items-center justify-center p-4 overflow-y-auto no-print">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-black text-slate-900">Machine QR Print</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {qrItems.length} label{qrItems.length === 1 ? '' : 's'} · asset code prints very small under QR
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {qrItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center gap-2"
                >
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <QRCodeSVG value={item.qrValue} size={110} level="H" includeMargin={false} />
                  </div>
                  <span className="text-[9px] font-mono font-bold text-slate-600 tracking-tight leading-none">
                    {item.assetCode}
                  </span>
                  <span className="text-[10px] text-slate-400 text-center leading-tight">
                    {item.machineNumber} · {item.machineType}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 uppercase tracking-wider"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl flex items-center gap-2 uppercase tracking-wider"
            >
              <Printer size={15} strokeWidth={2.5} />
              Print Labels
            </button>
          </div>
        </div>
      </div>

      <style>{`
        #printable-maint-qr-grid { display: none; }
        @media print {
          @page { margin: 12mm 8mm; size: portrait; }
          body * {
            visibility: hidden;
            background-color: transparent !important;
            box-shadow: none !important;
          }
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #printable-maint-qr-grid, #printable-maint-qr-grid * { visibility: visible; }
          #printable-maint-qr-grid {
            display: grid !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 14px !important;
            padding: 4px !important;
            background: white !important;
          }
          .maint-qr-card-print {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            border: 1px dashed #94a3b8 !important;
            border-radius: 6px !important;
            padding: 10px 8px !important;
            background: white !important;
            text-align: center !important;
          }
          .maint-qr-svg-print {
            width: 3.2cm !important;
            height: 3.2cm !important;
          }
          .maint-qr-code-print {
            font-size: 6pt !important;
            font-family: ui-monospace, Menlo, Consolas, monospace !important;
            font-weight: 700 !important;
            margin-top: 4px !important;
            color: #0f172a !important;
            letter-spacing: 0.02em !important;
            line-height: 1 !important;
          }
          .maint-qr-meta-print {
            font-size: 5.5pt !important;
            color: #64748b !important;
            margin-top: 2px !important;
            max-width: 90% !important;
            line-height: 1.2 !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div id="printable-maint-qr-grid">
        {qrItems.map((item) => (
          <div key={item.id} className="maint-qr-card-print">
            <QRCodeSVG
              value={item.qrValue}
              size={128}
              level="H"
              includeMargin={false}
              className="maint-qr-svg-print"
            />
            <div className="maint-qr-code-print">{item.assetCode}</div>
            <div className="maint-qr-meta-print">
              {item.machineNumber} · {item.machineType}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
