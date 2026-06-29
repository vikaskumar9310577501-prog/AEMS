import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { X } from 'lucide-react';
import type { MissingItemRecord } from '../types/redesigned';
import type { Employee } from '../types/employee';
import { parseJsonResponse } from '../lib/apiFetch';
import { optionsWithValue } from '../lib/formAsset';
import {
  mergeCatalog,
  getBrandListForAssetType,
  getModelsForBrandAndType,
  getMissingItemTypeList,
  getMissingItemNameList,
  addMissingItemType,
  removeMissingItemType,
  addMissingItemName,
  removeMissingItemName,
  addBrandForType,
  removeBrandForType,
  addModelForType,
  removeModelForType,
  type AssetCatalog,
} from '../lib/assetCatalog';
import EmployeeSelector, { type EmployeeAssignmentValues } from './EmployeeSelector';
import SmartSelect from './SmartSelect';

interface MarkMissingModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type AppSettingsSnapshot = {
  locations: string[];
  plants: { code: string; name: string; location?: string }[];
  assetFields: unknown[];
};

const emptyEmployeeValues = (): EmployeeAssignmentValues => ({
  employeeId: '',
  contactName: '',
  contactEmail: '',
  contactMobile: '',
  department: '',
  location: '',
  plantCode: '',
});

function confirmRemoveOption(value: string, onRemove: () => void) {
  if (!window.confirm(`Remove "${value}" from the list?`)) return;
  onRemove();
  toast.success(`Removed "${value}"`);
}

export default function MarkMissingModal({ open, onClose, onSaved }: MarkMissingModalProps) {
  const [assetType, setAssetType] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [itemName, setItemName] = useState('');
  const [employeeValues, setEmployeeValues] = useState<EmployeeAssignmentValues>(emptyEmployeeValues);
  const [linkedEmployee, setLinkedEmployee] = useState<Employee | null>(null);
  const [missingDate, setMissingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<AssetCatalog>(() => mergeCatalog());
  const [appSettings, setAppSettings] = useState<AppSettingsSnapshot>({
    locations: [],
    plants: [],
    assetFields: [],
  });

  const assetTypeOptions = useMemo(() => getMissingItemTypeList(catalog), [catalog]);
  const itemNameOptions = useMemo(() => getMissingItemNameList(catalog), [catalog]);

  const brandOptions = useMemo(() => {
    if (!assetType) return [];
    return optionsWithValue(getBrandListForAssetType(catalog, assetType), brand);
  }, [catalog, assetType, brand]);

  const modelOptions = useMemo(() => {
    if (!assetType || !brand) return [];
    return optionsWithValue(getModelsForBrandAndType(catalog, assetType, brand), model);
  }, [catalog, assetType, brand, model]);

  useEffect(() => {
    if (!open) return;
    setAssetType('');
    setBrand('');
    setModel('');
    setItemName('');
    setEmployeeValues(emptyEmployeeValues());
    setLinkedEmployee(null);
    setMissingDate(new Date().toISOString().slice(0, 10));
    setRemarks('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/settings?refresh=1')
      .then((r) => r.json())
      .then((data) => {
        setAppSettings({
          locations: data.locations || [],
          plants: data.plants || [],
          assetFields: data.assetFields || [],
        });
        setCatalog(mergeCatalog(data.catalog));
      })
      .catch(() => {});
  }, [open]);

  const persistCatalog = (updater: AssetCatalog | ((prev: AssetCatalog) => AssetCatalog)) => {
    setCatalog((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locations: appSettings.locations,
          plants: appSettings.plants,
          assetFields: appSettings.assetFields,
          catalog: next,
        }),
      }).catch(() => {});
      return next;
    });
  };

  if (!open) return null;

  const onAssetTypeChange = (nextType: string) => {
    setAssetType(nextType);
    setBrand('');
    setModel('');
    if (!itemName.trim() && nextType) setItemName(nextType);
  };

  const onBrandChange = (nextBrand: string) => {
    setBrand(nextBrand);
    setModel('');
  };

  const save = async () => {
    const resolvedAssetType = assetType.trim();
    const trimmedName = itemName.trim() || resolvedAssetType;
    if (!trimmedName) return toast.error('Select asset type or missing item name');
    if (!linkedEmployee) {
      return toast.error('Link a saved employee profile using Employee ID');
    }

    setSaving(true);
    try {
      const displayName = [brand, model].filter(Boolean).join(' ').trim();
      const row: MissingItemRecord = {
        'Record ID': '',
        'Parent Asset ID': '',
        'Parent Asset Name': displayName || resolvedAssetType || trimmedName,
        'Missing Item Name': trimmedName,
        'Asset Type': resolvedAssetType || trimmedName,
        Brand: brand.trim(),
        Model: model.trim(),
        'Employee ID': linkedEmployee.employeeId,
        'Assigned Person': linkedEmployee.name,
        'Missing Date': missingDate,
        Status: 'Missing',
        Remarks: remarks.trim(),
        'Recovered Date': '',
        'Recovered By': '',
      };
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/missing-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: row, syncSheet: true }),
      });
      const data = await parseJsonResponse<{ error?: string; sheetWarning?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (data.sheetWarning) toast.error(`Saved locally. ${data.sheetWarning}`, { duration: 5000 });
      else toast.success('Missing item recorded');
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-slate-900">Missing item</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-4">
          Register a missing item with type, brand, model and linked employee profile.
        </p>

        <div className="space-y-4">
          <SmartSelect
            label="Asset type"
            required
            value={assetType}
            options={assetTypeOptions}
            onChange={onAssetTypeChange}
            onAddCustom={(v) => {
              persistCatalog((c) => addMissingItemType(c, v));
              toast.success(`Added "${v}"`);
            }}
            onDeleteOption={(v) => {
              confirmRemoveOption(v, () => {
                if (assetType === v) onAssetTypeChange('');
                persistCatalog((c) => removeMissingItemType(c, v));
              });
            }}
            placeholder="Select type"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SmartSelect
              label="Brand"
              value={brand}
              options={brandOptions}
              onChange={onBrandChange}
              disabled={!assetType}
              onAddCustom={(v) => {
                if (!assetType) return;
                persistCatalog((c) => addBrandForType(c, assetType, v));
                toast.success(`Added "${v}"`);
              }}
              onDeleteOption={(v) => {
                if (!assetType) return;
                confirmRemoveOption(v, () => {
                  if (brand === v) onBrandChange('');
                  persistCatalog((c) => removeBrandForType(c, assetType, v));
                });
              }}
              placeholder={assetType ? 'Select brand' : 'Select type first'}
            />
            <SmartSelect
              label="Model"
              value={model}
              options={modelOptions}
              onChange={setModel}
              disabled={!assetType || !brand}
              onAddCustom={(v) => {
                if (!assetType || !brand) return;
                persistCatalog((c) => addModelForType(c, assetType, brand, v));
                toast.success(`Added "${v}"`);
              }}
              onDeleteOption={(v) => {
                if (!assetType || !brand) return;
                confirmRemoveOption(v, () => {
                  if (model === v) setModel('');
                  persistCatalog((c) => removeModelForType(c, assetType, brand, v));
                });
              }}
              placeholder={brand ? 'Select model' : 'Select brand first'}
            />
          </div>

          <SmartSelect
            label="Missing item name"
            required
            value={itemName}
            options={itemNameOptions}
            onChange={setItemName}
            onAddCustom={(v) => {
              persistCatalog((c) => addMissingItemName(c, v));
              toast.success(`Added "${v}"`);
            }}
            onDeleteOption={(v) => {
              confirmRemoveOption(v, () => {
                if (itemName === v) setItemName('');
                persistCatalog((c) => removeMissingItemName(c, v));
              });
            }}
            placeholder="Select or add item name"
          />

          <EmployeeSelector
            values={employeeValues}
            onChange={(patch) => setEmployeeValues((prev) => ({ ...prev, ...patch }))}
            onEmployeeResolved={setLinkedEmployee}
            requireSavedProfile
            compactLookupOnly
            hideDepartmentField
          />

          <div>
            <label className="label-caps block mb-1">Missing date</label>
            <input
              type="date"
              value={missingDate}
              onChange={(e) => setMissingDate(e.target.value)}
              className="w-full input-geometric"
            />
          </div>
          <div>
            <label className="label-caps block mb-1">Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="w-full input-geometric min-h-[72px]"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-8 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary-geometric">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="btn-primary-geometric bg-amber-600 hover:bg-amber-700"
          >
            {saving ? 'Saving…' : 'Save record'}
          </button>
        </div>
      </div>
    </div>
  );
}
