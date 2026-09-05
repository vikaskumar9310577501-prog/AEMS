import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  Plus,
  Trash2,
  Save,
  Building2,
  Layers,
  CheckCircle2,
  XCircle,
  ArrowUp,
  ArrowDown,
  Settings2,
} from 'lucide-react';
import type {
  AssetTypeDefinition,
  DepartmentDefinition,
  FieldDefinition,
  FieldInputType,
} from '../types/categoryTypes';
import { MAIN_CATEGORIES } from '../lib/assetCatalogByType';
import { useTypeDefinitions } from '../hooks/useTypeDefinitions';

const FIELD_TYPES: { value: FieldInputType; label: string }[] = [
  { value: 'text', label: 'Single-line Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown Select' },
  { value: 'checkbox', label: 'Checkbox (Yes/No)' },
  { value: 'textarea', label: 'Multi-line Text' },
  { value: 'email', label: 'Email Address' },
  { value: 'file', label: 'File / Document' },
];

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'field'
  );
}

export default function TypeDefinitionsAdmin() {
  const { config, loading, refresh } = useTypeDefinitions();
  const [activeTab, setActiveTab] = useState<'categories' | 'departments'>('categories');
  const [types, setTypes] = useState<AssetTypeDefinition[]>([]);
  const [departments, setDepartments] = useState<DepartmentDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      setTypes(config.types || []);
      setDepartments(config.departments || []);
    }
  }, [config, loading]);

  const selectedType = types.find((t) => t.id === selectedId) || types[0];

  const saveAll = async () => {
    setSaving(true);
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/type-definitions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ types, departments, syncSheet: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (data.types) setTypes(data.types);
      if (data.departments) setDepartments(data.departments);
      toast.success('Configuration saved successfully');
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------
  // Category Management Handlers
  // -------------------------------------------------------------
  const addType = () => {
    const id = `custom_${Date.now()}`;
    const firstDept = departments.find((d) => d.active !== false)?.name || 'IT Assets';
    const t: AssetTypeDefinition = {
      id,
      name: 'New Category',
      mainCategory: firstDept,
      active: true,
      fields: [{ key: 'notes', label: 'Notes', type: 'textarea', active: true, order: 1 }],
    };
    setTypes((prev) => [...prev, t]);
    setSelectedId(id);
  };

  const updateSelectedType = (patch: Partial<AssetTypeDefinition>) => {
    if (!selectedType) return;
    setTypes((prev) => prev.map((t) => (t.id === selectedType.id ? { ...t, ...patch } : t)));
  };

  const removeType = (id: string) => {
    if (!window.confirm('Are you sure you want to delete this category configuration?')) return;
    setTypes((prev) => prev.filter((t) => t.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // Field Handlers
  const addField = () => {
    if (!selectedType) return;
    const currentFields = selectedType.fields || [];
    const nextOrder = currentFields.length + 1;
    const f: FieldDefinition = {
      key: `field_${nextOrder}`,
      label: 'New Field',
      type: 'text',
      required: false,
      active: true,
      order: nextOrder,
    };
    updateSelectedType({ fields: [...currentFields, f] });
  };

  const updateField = (index: number, patch: Partial<FieldDefinition>) => {
    if (!selectedType) return;
    const fields = (selectedType.fields || []).map((f, i) => (i === index ? { ...f, ...patch } : f));
    updateSelectedType({ fields });
  };

  const removeField = (index: number) => {
    if (!selectedType) return;
    const fields = (selectedType.fields || []).filter((_, i) => i !== index);
    updateSelectedType({ fields });
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    if (!selectedType) return;
    const fields = [...(selectedType.fields || [])];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= fields.length) return;
    const temp = fields[index];
    fields[index] = fields[targetIdx];
    fields[targetIdx] = temp;
    // Re-assign display order
    const updated = fields.map((f, i) => ({ ...f, order: i + 1 }));
    updateSelectedType({ fields: updated });
  };

  // -------------------------------------------------------------
  // Department Management Handlers
  // -------------------------------------------------------------
  const addDepartment = () => {
    const id = `dept_${Date.now()}`;
    const nextOrder = departments.length + 1;
    const newDept: DepartmentDefinition = {
      id,
      name: 'New Department',
      active: true,
      displayOrder: nextOrder,
    };
    setDepartments((prev) => [...prev, newDept]);
  };

  const updateDepartment = (index: number, patch: Partial<DepartmentDefinition>) => {
    setDepartments((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const removeDepartment = (index: number) => {
    const dept = departments[index];
    if (!dept) return;
    if (!window.confirm(`Are you sure you want to remove the "${dept.name}" department?`)) return;
    setDepartments((prev) => prev.filter((_, i) => i !== index));
  };

  const moveDepartment = (index: number, direction: 'up' | 'down') => {
    const depts = [...departments];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= depts.length) return;
    const temp = depts[index];
    depts[index] = depts[targetIdx];
    depts[targetIdx] = temp;
    const updated = depts.map((d, i) => ({ ...d, displayOrder: i + 1 }));
    setDepartments(updated);
  };

  if (loading) {
    return <p className="text-sm text-slate-500 font-bold animate-pulse py-8">Loading configuration…</p>;
  }

  // Combine static default categories with dynamic departments for the mainCategory dropdown
  const allDepartmentOptions = Array.from(
    new Set([
      ...departments.filter((d) => d.active !== false).map((d) => d.name),
      ...MAIN_CATEGORIES,
    ])
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Global Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Settings2 className="text-blue-600" size={22} />
            Master Configuration (IT Admin)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure dynamic departments, categories, and custom entry form fields with live validation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'categories' && (
            <button
              type="button"
              onClick={addType}
              className="btn-secondary-geometric flex items-center gap-2 text-xs"
            >
              <Plus size={14} /> Add Category
            </button>
          )}
          {activeTab === 'departments' && (
            <button
              type="button"
              onClick={addDepartment}
              className="btn-secondary-geometric flex items-center gap-2 text-xs"
            >
              <Plus size={14} /> Add Department
            </button>
          )}
          <button
            type="button"
            onClick={saveAll}
            disabled={saving}
            className="btn-primary-geometric flex items-center gap-2 text-xs bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-100/60 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`flex-1 py-2.5 px-4 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'categories'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers size={15} /> Categories &amp; Entry Form Fields ({types.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('departments')}
          className={`flex-1 py-2.5 px-4 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'departments'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 size={15} /> Departments ({departments.length})
        </button>
      </div>

      {/* TAB 1: CATEGORIES & ENTRY FORM FIELDS */}
      {activeTab === 'categories' && (
        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          {/* Category List Sidebar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                Categories ({types.length})
              </span>
            </div>
            <ul className="space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50 max-h-[600px] overflow-y-auto">
              {types.map((t) => {
                const isSelected = (selectedId || types[0]?.id) === t.id;
                const isActive = t.active !== false;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-slate-700 bg-white hover:bg-slate-100 border border-slate-200/60'
                      }`}
                    >
                      <div className="truncate">
                        <div className="truncate font-black">{t.name}</div>
                        <span
                          className={`block text-[10px] truncate ${
                            isSelected ? 'text-blue-100' : 'text-slate-400'
                          }`}
                        >
                          {t.mainCategory || 'General'} · {t.fields?.length || 0} fields
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isActive
                            ? isSelected
                              ? 'bg-blue-500 text-white'
                              : 'bg-emerald-100 text-emerald-700'
                            : isSelected
                            ? 'bg-slate-700 text-slate-300'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Category Details & Entry Form Fields Builder */}
          {selectedType ? (
            <div className="border border-slate-200 rounded-2xl p-6 bg-white space-y-6 shadow-sm">
              <div className="flex justify-between items-start gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    {selectedType.name}
                    <span className="text-xs font-normal text-slate-400">({selectedType.id})</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure category settings, department binding, and dynamic entry form fields.
                  </p>
                </div>
                {!['laptop', 'desktop'].includes(selectedType.id) && (
                  <button
                    type="button"
                    onClick={() => removeType(selectedType.id)}
                    className="text-red-500 hover:bg-red-50 p-2 rounded-xl border border-red-200 text-xs font-bold flex items-center gap-1.5 transition-all"
                    title="Delete Category"
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                )}
              </div>

              {/* General Category Settings */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="label-caps block mb-1">Category Display Name *</label>
                  <input
                    value={selectedType.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      updateSelectedType({
                        name,
                        id: selectedType.id.startsWith('custom_') ? slugify(name) : selectedType.id,
                      });
                    }}
                    className="w-full input-geometric text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="label-caps block mb-1">Associated Department *</label>
                  <select
                    value={selectedType.mainCategory}
                    onChange={(e) => updateSelectedType({ mainCategory: e.target.value })}
                    className="w-full input-geometric text-xs bg-white font-bold"
                  >
                    {allDepartmentOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label-caps block mb-1">Sub-Category (Optional)</label>
                  <input
                    value={selectedType.subCategory || ''}
                    onChange={(e) => updateSelectedType({ subCategory: e.target.value })}
                    className="w-full input-geometric text-xs"
                    placeholder="e.g. Laser Printer, Switch"
                  />
                </div>
              </div>

              {/* Status & Form Toggles */}
              <div className="flex flex-wrap items-center gap-6 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedType.active !== false}
                    onChange={(e) => updateSelectedType({ active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span>Category Active in Entry Form</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!selectedType.useLegacyItForm}
                    onChange={(e) => updateSelectedType({ useLegacyItForm: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span>Use IT Hardware Form (CPU, RAM, Storage specs)</span>
                </label>
              </div>

              {/* Dynamic Entry Form Fields Section */}
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                      Category Custom Fields ({selectedType.fields?.length || 0})
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      These fields appear in the asset registration entry form for this category.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addField}
                    className="btn-secondary-geometric text-xs font-bold text-blue-600 flex items-center gap-1.5 py-1.5 px-3"
                  >
                    <Plus size={13} /> Add Custom Field
                  </button>
                </div>

                {(!selectedType.fields || selectedType.fields.length === 0) && (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">No custom fields defined for this category.</p>
                    <button
                      type="button"
                      onClick={addField}
                      className="mt-2 text-xs text-blue-600 font-bold hover:underline"
                    >
                      + Add the first custom field
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  {(selectedType.fields || []).map((field, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border transition-all ${
                        field.active === false
                          ? 'bg-slate-100/70 border-slate-200 opacity-75'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="grid md:grid-cols-12 gap-3 items-end">
                        {/* Order & Drag */}
                        <div className="md:col-span-1 flex items-center gap-1 pb-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveField(idx, 'up')}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-200"
                            title="Move Up"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === (selectedType.fields?.length || 1) - 1}
                            onClick={() => moveField(idx, 'down')}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-200"
                            title="Move Down"
                          >
                            <ArrowDown size={14} />
                          </button>
                          <span className="text-[10px] font-black text-slate-400 ml-1">#{idx + 1}</span>
                        </div>

                        {/* Label */}
                        <div className="md:col-span-3">
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Field Label *
                          </label>
                          <input
                            value={field.label}
                            onChange={(e) => {
                              const label = e.target.value;
                              updateField(idx, {
                                label,
                                key: field.key.startsWith('field_') ? slugify(label) : field.key,
                              });
                            }}
                            className="w-full input-geometric text-xs py-1.5 font-bold"
                            placeholder="e.g. Warranty Period"
                          />
                        </div>

                        {/* Key */}
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Field Key (DB)
                          </label>
                          <input
                            value={field.key}
                            onChange={(e) => updateField(idx, { key: slugify(e.target.value) })}
                            className="w-full input-geometric text-xs py-1.5 font-mono text-slate-600"
                          />
                        </div>

                        {/* Type */}
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Input Type
                          </label>
                          <select
                            value={field.type}
                            onChange={(e) => updateField(idx, { type: e.target.value as FieldInputType })}
                            className="w-full input-geometric text-xs py-1.5 bg-white font-bold"
                          >
                            {FIELD_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Dropdown Options (for Select) */}
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Options (CSV)
                          </label>
                          <input
                            disabled={field.type !== 'select'}
                            value={(field.options || []).join(', ')}
                            onChange={(e) =>
                              updateField(idx, {
                                options: e.target.value
                                  .split(',')
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              })
                            }
                            className="w-full input-geometric text-xs py-1.5 disabled:bg-slate-200 disabled:opacity-50"
                            placeholder={field.type === 'select' ? 'Opt1, Opt2, Opt3' : 'N/A'}
                          />
                        </div>

                        {/* Toggles & Delete */}
                        <div className="md:col-span-2 flex items-center justify-end gap-2 pb-1">
                          <label
                            className="flex items-center gap-1 text-[11px] font-bold text-slate-700 cursor-pointer"
                            title="Required Field"
                          >
                            <input
                              type="checkbox"
                              checked={!!field.required}
                              onChange={(e) => updateField(idx, { required: e.target.checked })}
                              className="w-3.5 h-3.5 text-blue-600 rounded"
                            />
                            <span>Req</span>
                          </label>

                          <label
                            className="flex items-center gap-1 text-[11px] font-bold text-slate-700 cursor-pointer"
                            title="Active Status"
                          >
                            <input
                              type="checkbox"
                              checked={field.active !== false}
                              onChange={(e) => updateField(idx, { active: e.target.checked })}
                              className="w-3.5 h-3.5 text-emerald-600 rounded"
                            />
                            <span>Active</span>
                          </label>

                          <button
                            type="button"
                            onClick={() => removeField(idx)}
                            className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors ml-1"
                            title="Delete Field"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400 font-bold">
              Select or add a category to edit its configuration.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DEPARTMENTS MANAGEMENT */}
      {activeTab === 'departments' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-sm">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-black text-slate-900">Dynamic Departments</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage global departments. Active departments appear in entry forms and category associations.
              </p>
            </div>
            <button
              type="button"
              onClick={addDepartment}
              className="btn-secondary-geometric flex items-center gap-2 text-xs font-bold text-blue-600"
            >
              <Plus size={14} /> Add Department
            </button>
          </div>

          <div className="space-y-3">
            {departments.map((dept, idx) => (
              <div
                key={dept.id || idx}
                className={`p-4 rounded-xl border transition-all flex flex-wrap md:flex-nowrap items-center justify-between gap-4 ${
                  dept.active === false
                    ? 'bg-slate-100/70 border-slate-200 opacity-75'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Order buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveDepartment(idx, 'up')}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-200"
                    title="Move Up"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === departments.length - 1}
                    onClick={() => moveDepartment(idx, 'down')}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-200"
                    title="Move Down"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <span className="text-xs font-black text-slate-400 ml-1">#{idx + 1}</span>
                </div>

                {/* Department Name Input */}
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Department Name
                  </label>
                  <input
                    value={dept.name}
                    onChange={(e) => updateDepartment(idx, { name: e.target.value })}
                    className="w-full input-geometric text-xs font-black bg-white"
                  />
                </div>

                {/* Department ID / Code */}
                <div className="w-48 shrink-0">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Department Code
                  </label>
                  <input
                    value={dept.id}
                    readOnly
                    className="w-full input-geometric text-xs bg-slate-200/60 text-slate-500 font-mono"
                  />
                </div>

                {/* Active status toggle */}
                <div className="flex items-center gap-4 shrink-0 pt-3 md:pt-0">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dept.active !== false}
                      onChange={(e) => updateDepartment(idx, { active: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span>{dept.active !== false ? 'Active' : 'Inactive'}</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => removeDepartment(idx)}
                    className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Department"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
