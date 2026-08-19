import React, { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { MissingItemRecord } from '../types/redesigned';
import type { Employee } from '../types/employee';
import EmployeeSelector, { type EmployeeAssignmentValues } from './EmployeeSelector';
import { parseJsonResponse } from '../lib/apiFetch';

interface ReassignMissingModalProps {
  open: boolean;
  item: MissingItemRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

const emptyEmployeeValues = (): EmployeeAssignmentValues => ({
  employeeId: '',
  contactName: '',
  contactEmail: '',
  contactMobile: '',
  department: '',
  location: '',
  plantCode: '',
});

export default function ReassignMissingModal({
  open,
  item,
  onClose,
  onSaved,
}: ReassignMissingModalProps) {
  const [employeeValues, setEmployeeValues] = useState<EmployeeAssignmentValues>(emptyEmployeeValues);
  const [linkedEmployee, setLinkedEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open || !item) return null;

  const handleReassign = async () => {
    if (!linkedEmployee) {
      return toast.error('Link a saved employee profile using Employee ID');
    }

    setSaving(true);
    try {
      const res = await fetch(
        (import.meta.env.VITE_API_BASE_URL || '') +
          `/api/missing-items/${encodeURIComponent(item['Record ID'])}/reassign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: linkedEmployee.employeeId }),
        }
      );
      const data = await parseJsonResponse<{ error?: string; sheetWarning?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Reassignment failed');
      if (data.sheetWarning) {
        toast.error(`Reassigned locally. ${data.sheetWarning}`, { duration: 5000 });
      } else {
        toast.success('Item reassigned successfully');
      }
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Reassignment failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-8 font-sans">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-slate-900">Reassign Missing Item</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-6">
          Reassign the recovered item <b>{item['Missing Item Name']}</b> (Brand: {item.Brand || '—'}, Model: {item.Model || '—'}) to a new employee.
        </p>

        <div className="space-y-6">
          <EmployeeSelector
            values={employeeValues}
            onChange={(patch) => setEmployeeValues((prev) => ({ ...prev, ...patch }))}
            onEmployeeResolved={setLinkedEmployee}
            requireSavedProfile
            compactLookupOnly
            hideDepartmentField
          />
        </div>

        <div className="flex gap-3 mt-8 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary-geometric">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleReassign}
            disabled={saving}
            className="btn-primary-geometric bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl px-4 py-2.5 font-bold transition-all text-xs"
          >
            {saving ? 'Reassigning…' : 'Reassign Item'}
          </button>
        </div>
      </div>
    </div>
  );
}
