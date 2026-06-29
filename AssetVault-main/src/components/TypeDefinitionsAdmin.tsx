import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, Save } from 'lucide-react';
import type { AssetTypeDefinition, FieldDefinition, FieldInputType } from '../types/categoryTypes';
import { MAIN_CATEGORIES } from '../lib/assetCatalogByType';
import { useTypeDefinitions } from '../hooks/useTypeDefinitions';

const FIELD_TYPES: FieldInputType[] = ['text', 'number', 'date', 'select', 'checkbox', 'textarea', 'email'];

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'type';
}

export default function TypeDefinitionsAdmin() {
  const { config, loading, refresh } = useTypeDefinitions();
  const [types, setTypes] = useState<AssetTypeDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!loading) setTypes(config.types);
  }, [config, loading]);

  const selected = types.find((t) => t.id === selectedId) || types[0];

  const saveAll = async () => {
    setSaving(true);
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || "") + '/api/type-definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ types, syncSheet: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setTypes(data.types || types);
      toast.success('Asset types saved');
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addType = () => {
    const id = `custom_${Date.now()}`;
    const t: AssetTypeDefinition = {
      id,
      name: 'New Asset Type',
      mainCategory: 'Office Assets',
      fields: [{ key: 'notes', label: 'Notes', type: 'textarea' }],
    };
    setTypes((prev) => [...prev, t]);
    setSelectedId(id);
  };

  const updateSelected = (patch: Partial<AssetTypeDefinition>) => {
    if (!selected) return;
    setTypes((prev) => prev.map((t) => (t.id === selected.id ? { ...t, ...patch } : t)));
  };

  const addField = () => {
    if (!selected) return;
    const f: FieldDefinition = {
      key: `field_${selected.fields.length + 1}`,
      label: 'New Field',
      type: 'text',
    };
    updateSelected({ fields: [...selected.fields, f] });
  };

  const updateField = (index: number, patch: Partial<FieldDefinition>) => {
    if (!selected) return;
    const fields = selected.fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    updateSelected({ fields });
  };

  const removeField = (index: number) => {
    if (!selected) return;
    updateSelected({ fields: selected.fields.filter((_, i) => i !== index) });
  };

  const removeType = (id: string) => {
    setTypes((prev) => prev.filter((t) => t.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  if (loading) {
    return <p className="text-sm text-slate-500 font-bold animate-pulse py-8">Loading asset types…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">Asset types &amp; custom fields</h2>
          <p className="text-sm text-slate-500 mt-1">
            Define fields per asset type. Data saves to Asset_Details sheet (not RAM/ROM columns).
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={addType} className="btn-secondary-geometric flex items-center gap-2 text-xs">
            <Plus size={14} /> Add type
          </button>
          <button
            type="button"
            onClick={saveAll}
            disabled={saving}
            className="btn-primary-geometric flex items-center gap-2 text-xs"
          >
            <Save size={14} /> {saving ? 'Saving…' : 'Save all'}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-6">
        <ul className="space-y-1 border border-slate-200 rounded-xl p-2 bg-slate-50 max-h-[480px] overflow-y-auto">
          {types.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  (selectedId || types[0]?.id) === t.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                {t.name}
                <span className="block text-[10px] opacity-70 font-medium truncate">{t.mainCategory}</span>
              </button>
            </li>
          ))}
        </ul>

        {selected && (
          <div className="border border-slate-200 rounded-xl p-6 bg-white space-y-5">
            <div className="flex justify-between items-start gap-2">
              <h3 className="font-black text-slate-900">Edit type</h3>
              {!['laptop', 'desktop'].includes(selected.id) && (
                <button
                  type="button"
                  onClick={() => removeType(selected.id)}
                  className="text-red-500 hover:bg-red-50 p-2 rounded-lg"
                  title="Delete type"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label-caps block mb-1">Display name</label>
                <input
                  value={selected.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    updateSelected({ name, id: selected.id.startsWith('custom_') ? slugify(name) : selected.id });
                  }}
                  className="w-full input-geometric"
                />
              </div>
              <div>
                <label className="label-caps block mb-1">Type ID</label>
                <input value={selected.id} readOnly className="w-full input-geometric bg-slate-100 text-slate-500" />
              </div>
              <div>
                <label className="label-caps block mb-1">Main category</label>
                <select
                  value={selected.mainCategory}
                  onChange={(e) => updateSelected({ mainCategory: e.target.value })}
                  className="w-full input-geometric bg-white"
                >
                  {MAIN_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-caps block mb-1">Sub category (optional)</label>
                <input
                  value={selected.subCategory || ''}
                  onChange={(e) => updateSelected({ subCategory: e.target.value })}
                  className="w-full input-geometric"
                  placeholder="e.g. Fan"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={!!selected.useLegacyItForm}
                onChange={(e) => updateSelected({ useLegacyItForm: e.target.checked })}
                className="rounded"
              />
              Use legacy IT form (Laptop/Desktop RAM, CPU, etc.)
            </label>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Custom fields</h4>
                <button type="button" onClick={addField} className="text-xs font-bold text-blue-600 flex items-center gap-1">
                  <Plus size={12} /> Add field
                </button>
              </div>

              {selected.fields.map((field, idx) => (
                <div key={idx} className="grid md:grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-lg">
                  <div className="md:col-span-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Key</label>
                    <input
                      value={field.key}
                      onChange={(e) => updateField(idx, { key: slugify(e.target.value) })}
                      className="w-full input-geometric text-xs py-2"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Label</label>
                    <input
                      value={field.label}
                      onChange={(e) => updateField(idx, { label: e.target.value })}
                      className="w-full input-geometric text-xs py-2"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Type</label>
                    <select
                      value={field.type}
                      onChange={(e) => updateField(idx, { type: e.target.value as FieldInputType })}
                      className="w-full input-geometric text-xs py-2 bg-white"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Options (comma)</label>
                    <input
                      value={(field.options || []).join(', ')}
                      onChange={(e) =>
                        updateField(idx, {
                          options: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      className="w-full input-geometric text-xs py-2"
                      placeholder="For select only"
                    />
                  </div>
                  <div className="md:col-span-1 flex gap-2 pb-1">
                    <label className="flex items-center gap-1 text-[10px] font-bold">
                      <input
                        type="checkbox"
                        checked={!!field.required}
                        onChange={(e) => updateField(idx, { required: e.target.checked })}
                      />
                      Req
                    </label>
                    <button type="button" onClick={() => removeField(idx)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
