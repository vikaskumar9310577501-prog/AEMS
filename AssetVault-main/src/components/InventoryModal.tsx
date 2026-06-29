import { useEffect, useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { X } from 'lucide-react';
import type { InventoryItem } from '../types/inventory';
import { EMPTY_INVENTORY_ITEM } from '../types/inventory';
import { MAIN_CATEGORIES } from '../lib/assetCatalogByType';
import { parseJsonResponse } from '../lib/apiFetch';
import SmartSelect from './SmartSelect';
import { useInventory } from '../hooks/useInventory';
import { useApp } from '../context/AppProvider';

interface InventoryModalProps {
  open: boolean;
  initial?: Partial<InventoryItem>;
  onClose: () => void;
  onSaved: (item: InventoryItem) => void;
}

const STATUSES = ['Available', 'Assigned', 'Damaged'];

export default function InventoryModal({ open, initial, onClose, onSaved }: InventoryModalProps) {
  const [form, setForm] = useState<InventoryItem>(EMPTY_INVENTORY_ITEM());
  const [saving, setSaving] = useState(false);
  const { inventory } = useInventory();
  const { visibleCategories } = useApp();

  const brandOptions = useMemo(() => {
    return Array.from(new Set(
      inventory
        .filter(item => item.category === (form.category || visibleCategories[0]) && item.brandName)
        .map(item => item.brandName.trim())
    )).sort((a: string, b: string) => a.localeCompare(b));
  }, [inventory, form.category, visibleCategories]);

  const modelOptions = useMemo(() => {
    return Array.from(new Set(
      inventory
        .filter(item => item.category === (form.category || visibleCategories[0]) && item.brandName === form.brandName && item.model)
        .map(item => item.model.trim())
    )).sort((a: string, b: string) => a.localeCompare(b));
  }, [inventory, form.category, form.brandName, visibleCategories]);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...EMPTY_INVENTORY_ITEM(),
      ...initial,
      itemId: String(initial?.itemId || '').trim().toUpperCase(),
      category: initial?.category || visibleCategories[0] || 'IT Assets'
    });
  }, [open, initial, visibleCategories]);

  if (!open) return null;

  const isEdit = !!initial?.itemId;

  const save = async () => {
    if (!form.itemId.trim() || !form.itemName.trim()) {
      return toast.error('Item ID and Item Name are required');
    }
    setSaving(true);
    try {
      const url = isEdit ? `/api/inventory/${encodeURIComponent(form.itemId)}` : '/api/inventory';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, syncSheet: true }),
      });
      const data = await parseJsonResponse<{
        success?: boolean;
        item?: InventoryItem;
        error?: string;
        sheetWarning?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || 'Save failed');
      const saved = (data.item || form) as InventoryItem;
      if (data.sheetWarning) {
        toast.error(`Saved locally. Sheet sync: ${data.sheetWarning}`, { duration: 6000 });
      } else {
        toast.success(isEdit ? 'Inventory item updated' : 'Inventory item added');
      }
      onSaved(saved);
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-8">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              {isEdit ? 'Edit inventory item' : 'Add inventory item'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {isEdit ? 'Update stock details and alerts.' : 'Register new stock items or consumable materials.'}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="p-2 hover:bg-slate-100 rounded-lg shrink-0 disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 mt-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-caps block mb-1">Item ID *</label>
              <input
                value={form.itemId}
                onChange={(e) => setForm((f) => ({ ...f, itemId: e.target.value.toUpperCase() }))}
                placeholder="INV-001"
                disabled={isEdit || saving}
                className="w-full input-geometric uppercase disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="label-caps block mb-1">Item Name *</label>
              <input
                value={form.itemName}
                onChange={(e) => setForm((f) => ({ ...f, itemName: e.target.value }))}
                placeholder="e.g. Keyboard"
                disabled={saving}
                className="w-full input-geometric disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <SmartSelect
                label="Brand Name"
                value={form.brandName}
                onChange={(val) => setForm((f) => ({ ...f, brandName: val, model: '' }))}
                options={brandOptions}
                onAddCustom={() => {}}
                placeholder="e.g. Dell"
                disabled={saving}
              />
            </div>
            <div>
              <SmartSelect
                label="Model"
                value={form.model}
                onChange={(val) => setForm((f) => ({ ...f, model: val }))}
                options={modelOptions}
                onAddCustom={() => {}}
                placeholder="e.g. KB216"
                disabled={saving}
              />
            </div>
          </div>

          <div>
            <label className="label-caps block mb-1">Serial Number</label>
            <input
              value={form.serialNumber}
              onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))}
              placeholder="e.g. SN-980890"
              disabled={saving}
              className="w-full input-geometric uppercase disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-caps block mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                disabled={saving}
                className="w-full input-geometric bg-white disabled:opacity-50"
              >
                {visibleCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-caps block mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))}
                disabled={saving}
                className="w-full input-geometric bg-white disabled:opacity-50"
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-caps block mb-1">Stock Quantity</label>
              <input
                type="number"
                min="0"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: Math.max(0, parseInt(e.target.value) || 0) }))}
                disabled={saving}
                className="w-full input-geometric disabled:opacity-50"
              />
            </div>
            <div>
              <label className="label-caps block mb-1">Min Stock Threshold (Alert)</label>
              <input
                type="number"
                min="0"
                value={form.minStock}
                onChange={(e) => setForm((f) => ({ ...f, minStock: Math.max(0, parseInt(e.target.value) || 0) }))}
                disabled={saving}
                className="w-full input-geometric disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-8 justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary-geometric disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} className="btn-primary-geometric">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add to Stock'}
          </button>
        </div>
      </div>
    </div>
  );
}
