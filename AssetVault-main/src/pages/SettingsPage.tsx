import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, MapPin, Building2, List, Layers, Edit2, Check, X, Archive, AlertTriangle } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppProvider';
import TypeDefinitionsAdmin from '../components/TypeDefinitionsAdmin';

interface PlantRecord {
  code: string;
  name: string;
  location: string;
}

interface AssetFieldRecord {
  key: string;
  label: string;
  enabled: boolean;
}

interface AppSettings {
  locations: string[];
  plants: PlantRecord[];
  assetFields: AssetFieldRecord[];
}

type Tab = 'locations' | 'plants' | 'fields' | 'types';

const getInitialTab = (): Tab => {
  try {
    const stored = localStorage.getItem('assestflow_user') || localStorage.getItem('assetflow_user');
    if (stored) {
      const u = JSON.parse(stored);
      if (u && ['Admin', 'ADMIN', 'admin'].includes(u.role)) {
        return 'fields';
      }
    }
  } catch {}
  return 'locations';
};

export default function SettingsPage() {
  const { user } = useApp();
  if (user?.role === 'HR') {
    return <Navigate to="/employees" replace />;
  }

  const [tab, setTab] = useState<Tab>(getInitialTab);
  const [userRole, setUserRole] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('assestflow_user') || localStorage.getItem('assetflow_user');
      if (stored) {
        const u = JSON.parse(stored);
        return u.role || 'User';
      }
    } catch {}
    return 'User';
  });
  const [settings, setSettings] = useState<AppSettings>({
    locations: [],
    plants: [],
    assetFields: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [newLocation, setNewLocation] = useState('');
  const [plantForm, setPlantForm] = useState<PlantRecord>({ code: '', name: '', location: '' });
  const [fieldForm, setFieldForm] = useState({ key: '', label: '' });

  // Inline editing states
  const [editingLoc, setEditingLoc] = useState<string | null>(null);
  const [editingLocVal, setEditingLocVal] = useState('');
  
  const [editingPlantCode, setEditingPlantCode] = useState<string | null>(null);
  const [editingPlantForm, setEditingPlantForm] = useState<PlantRecord>({ code: '', name: '', location: '' });

  // Delete modal targets
  const [deleteLocTarget, setDeleteLocTarget] = useState<string | null>(null);
  const [deletePlantTarget, setDeletePlantTarget] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch((import.meta.env.VITE_API_BASE_URL || "") + '/api/settings?refresh=1');
        if (!res.ok) throw new Error('Failed to load settings');
        const data = await res.json();
        setSettings({
          locations: data.locations || [],
          plants: data.plants || [],
          assetFields: data.assetFields || [],
        });
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const saveSettings = async (next: AppSettings, actionMsg: string = 'Saving...') => {
    setSaving(true);
    setActionMessage(actionMsg);
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || "") + '/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSettings(data.settings || next);
      if (data.sheetWarning) {
        toast.error(`Saved locally but Database sync failed: ${data.sheetWarning}`);
      } else {
        toast.success('Saved — Locations/Plants tabs + location/plant view sheets updated in Google Sheet');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
      setActionMessage(null);
    }
  };

  const addLocation = () => {
    const name = newLocation.trim();
    if (!name) return toast.error('Enter location name');
    if (settings.locations.includes(name)) return toast.error('Location already exists');
    const next = { ...settings, locations: [...settings.locations, name] };
    setNewLocation('');
    saveSettings(next, 'Adding location...');
  };

  const startRenameLocation = (loc: string) => {
    setEditingLoc(loc);
    setEditingLocVal(loc);
  };

  const cancelRenameLocation = () => {
    setEditingLoc(null);
    setEditingLocVal('');
  };

  const saveRenameLocation = async (oldName: string) => {
    const newName = editingLocVal.trim();
    if (!newName) return toast.error('Location name cannot be empty');
    if (oldName === newName) {
      setEditingLoc(null);
      return;
    }
    if (settings.locations.includes(newName)) return toast.error('Location already exists');

    setSaving(true);
    setActionMessage('Renaming location...');
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || "") + '/api/settings/rename-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rename failed');
      setSettings(data.settings);
      setEditingLoc(null);
      toast.success('Location renamed and sheet tab updated successfully');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
      setActionMessage(null);
    }
  };

  const executeDeleteLocation = async (name: string, deleteOrArchive: 'delete' | 'archive') => {
    setSaving(true);
    setActionMessage(deleteOrArchive === 'archive' ? 'Archiving location...' : 'Deleting location...');
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || "") + '/api/settings/delete-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, deleteOrArchive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deletion failed');
      setSettings(data.settings);
      setDeleteLocTarget(null);
      toast.success(`Location ${deleteOrArchive === 'archive' ? 'archived' : 'deleted'} successfully`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
      setActionMessage(null);
    }
  };

  const addPlant = () => {
    const code = plantForm.code.trim();
    const name = plantForm.name.trim();
    const location = plantForm.location.trim();
    if (!code || !name || !location) return toast.error('Fill plant code, name and location');
    if (settings.plants.some((p) => p.code === code)) return toast.error('Plant code already exists');
    const next = {
      ...settings,
      plants: [...settings.plants, { code, name, location }],
    };
    setPlantForm({ code: '', name: '', location: '' });
    saveSettings(next, 'Adding plant...');
  };

  const startRenamePlant = (p: PlantRecord) => {
    setEditingPlantCode(p.code);
    setEditingPlantForm({ ...p });
  };

  const cancelRenamePlant = () => {
    setEditingPlantCode(null);
  };

  const saveRenamePlant = async (oldCode: string) => {
    const { code: newCode, name: newName, location } = editingPlantForm;
    const cleanCode = newCode.trim();
    const cleanName = newName.trim();
    if (!cleanCode || !cleanName || !location) {
      return toast.error('All plant fields are required');
    }

    if (oldCode !== cleanCode && settings.plants.some((p) => p.code === cleanCode)) {
      return toast.error('New plant code already exists');
    }

    setSaving(true);
    setActionMessage('Renaming plant...');
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || "") + '/api/settings/rename-plant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldCode, newCode: cleanCode, newName: cleanName, location }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rename failed');
      setSettings(data.settings);
      setEditingPlantCode(null);
      toast.success('Plant renamed and sheet tab updated successfully');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
      setActionMessage(null);
    }
  };

  const executeDeletePlant = async (code: string, deleteOrArchive: 'delete' | 'archive') => {
    setSaving(true);
    setActionMessage(deleteOrArchive === 'archive' ? 'Archiving plant...' : 'Deleting plant...');
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || "") + '/api/settings/delete-plant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, deleteOrArchive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deletion failed');
      setSettings(data.settings);
      setDeletePlantTarget(null);
      toast.success(`Plant ${deleteOrArchive === 'archive' ? 'archived' : 'deleted'} successfully`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
      setActionMessage(null);
    }
  };

  const toggleField = (key: string) => {
    const next = {
      ...settings,
      assetFields: settings.assetFields.map((f) =>
        f.key === key ? { ...f, enabled: !f.enabled } : f
      ),
    };
    saveSettings(next, 'Updating fields...');
  };

  const addAssetField = () => {
    const key = fieldForm.key.trim().replace(/\s+/g, '_').toLowerCase();
    const label = fieldForm.label.trim();
    if (!key || !label) return toast.error('Enter field key and label');
    if (settings.assetFields.some((f) => f.key === key)) return toast.error('Field already exists');
    const next = {
      ...settings,
      assetFields: [...settings.assetFields, { key, label, enabled: true }],
    };
    setFieldForm({ key: '', label: '' });
    saveSettings(next, 'Adding custom field...');
  };

  const removeAssetField = (key: string) => {
    const next = {
      ...settings,
      assetFields: settings.assetFields.filter((f) => f.key !== key),
    };
    saveSettings(next, 'Removing field...');
  };

  const isItAdmin = ['IT Admin', 'IT_ADMIN', 'it admin'].includes(userRole);

  const tabs = [
    { id: 'locations', label: 'Locations', icon: <MapPin size={16} /> },
    { id: 'plants', label: 'Plants', icon: <Building2 size={16} /> },
    { id: 'fields', label: 'Asset Fields', icon: <List size={16} /> },
    { id: 'types', label: 'Asset Types', icon: <Layers size={16} /> },
  ].filter((t) => {
    if (['Admin', 'ADMIN', 'admin'].includes(userRole)) {
      return t.id === 'fields';
    }
    if (t.id === 'types') return isItAdmin;
    return true;
  });

  if (loading) {
    return (
      <div className="flex-1 overflow-auto p-8 bg-slate-50">
        <p className="text-gray-600">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-8 bg-slate-50">
      <div className={tab === 'types' ? 'max-w-6xl mx-auto' : 'max-w-3xl mx-auto'}>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1">Settings</h2>
        <p className="text-sm text-slate-500 mb-6">
          Manage locations, plant codes, custom form fields, and asset types config.
        </p>

        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              disabled={saving}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm ${
                tab === t.id
                  ? 'bg-emerald-600 text-white shadow-emerald-600/10'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          {tab === 'locations' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800">Add Location</h3>
              <div className="flex gap-2">
                <input
                  value={newLocation}
                  disabled={saving}
                  onChange={(e) => setNewLocation(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLocation())}
                  placeholder="e.g. Corporate HQ"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={addLocation}
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm flex items-center gap-1 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  <Plus size={16} /> {saving && actionMessage?.includes('Adding') ? 'Adding...' : 'Add'}
                </button>
              </div>
              
              <div className="pt-2">
                <h4 className="font-bold text-slate-800 text-sm mb-3">Locations List</h4>
                <ul className="space-y-2">
                  {settings.locations.map((loc) => (
                    <li
                      key={loc}
                      className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100/50 transition-colors"
                    >
                      {editingLoc === loc ? (
                        <div className="flex items-center gap-2 flex-1 mr-4">
                          <input
                            value={editingLocVal}
                            onChange={(e) => setEditingLocVal(e.target.value)}
                            className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
                            placeholder="Location name"
                            autoFocus
                          />
                          <button
                            onClick={() => saveRenameLocation(loc)}
                            disabled={saving}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={cancelRenameLocation}
                            disabled={saving}
                            className="p-1 text-slate-400 hover:bg-slate-200 rounded"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-slate-800 font-semibold text-sm">{loc}</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startRenameLocation(loc)}
                              disabled={saving}
                              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                              title="Rename Location"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => setDeleteLocTarget(loc)}
                              disabled={saving}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete/Archive"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                  {settings.locations.length === 0 && (
                    <p className="text-slate-400 text-sm">No locations added yet.</p>
                  )}
                </ul>
              </div>
            </div>
          )}

          {tab === 'plants' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800">Add Plant (under a location)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  value={plantForm.code}
                  disabled={saving}
                  onChange={(e) => setPlantForm({ ...plantForm, code: e.target.value })}
                  placeholder="Plant code e.g. P101"
                  className="px-3 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-emerald-500 placeholder:text-slate-400"
                />
                <input
                  value={plantForm.name}
                  disabled={saving}
                  onChange={(e) => setPlantForm({ ...plantForm, name: e.target.value })}
                  placeholder="Plant name"
                  className="px-3 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-emerald-500 placeholder:text-slate-400"
                />
                <select
                  value={plantForm.location}
                  disabled={saving}
                  onChange={(e) => setPlantForm({ ...plantForm, location: e.target.value })}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-slate-900 bg-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select location</option>
                  {settings.locations.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={addPlant}
                disabled={saving || settings.locations.length === 0}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm flex items-center gap-1 hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                <Plus size={16} /> {saving && actionMessage?.includes('Adding') ? 'Adding...' : 'Add Plant'}
              </button>
              {settings.locations.length === 0 && (
                <p className="text-amber-700 text-sm">Add at least one location first.</p>
              )}

              <div className="pt-2">
                <h4 className="font-bold text-slate-800 text-sm mb-3">Plants List</h4>
                <ul className="space-y-2">
                  {settings.plants.map((p) => (
                    <li
                      key={p.code}
                      className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100/50 transition-colors"
                    >
                      {editingPlantCode === p.code ? (
                        <div className="flex flex-col gap-2 flex-1 mr-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              value={editingPlantForm.code}
                              onChange={(e) => setEditingPlantForm({ ...editingPlantForm, code: e.target.value })}
                              className="px-2 py-1 text-sm border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
                              placeholder="Code"
                            />
                            <input
                              value={editingPlantForm.name}
                              onChange={(e) => setEditingPlantForm({ ...editingPlantForm, name: e.target.value })}
                              className="px-2 py-1 text-sm border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
                              placeholder="Name"
                            />
                            <select
                              value={editingPlantForm.location}
                              onChange={(e) => setEditingPlantForm({ ...editingPlantForm, location: e.target.value })}
                              className="px-2 py-1 text-sm border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none"
                            >
                              <option value="">Select location</option>
                              {settings.locations.map((loc) => (
                                <option key={loc} value={loc}>{loc}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2 justify-end mt-1">
                            <button
                              onClick={() => saveRenamePlant(p.code)}
                              disabled={saving}
                              className="px-2 py-1 text-xs bg-emerald-600 text-white rounded font-bold flex items-center gap-1"
                            >
                              <Check size={14} /> Save
                            </button>
                            <button
                              onClick={cancelRenamePlant}
                              disabled={saving}
                              className="px-2 py-1 text-xs bg-slate-200 text-slate-600 rounded font-bold flex items-center gap-1"
                            >
                              <X size={14} /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <span className="text-slate-900 font-bold text-sm bg-slate-200/50 px-2 py-0.5 rounded-lg mr-2 font-mono">{p.code}</span>
                            <span className="text-slate-700 text-sm font-semibold">
                              {p.name}
                            </span>
                            <span className="text-slate-400 text-xs ml-2">
                              · {p.location}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startRenamePlant(p)}
                              disabled={saving}
                              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                              title="Rename Plant"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => setDeletePlantTarget(p.code)}
                              disabled={saving}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete/Archive"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                  {settings.plants.length === 0 && (
                    <p className="text-slate-400 text-sm">No plants added yet.</p>
                  )}
                </ul>
              </div>
            </div>
          )}

          {tab === 'fields' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800">Asset Form Fields</h3>
              <p className="text-sm text-slate-500">
                Enable or disable fields shown when registering assets. Add custom fields below.
              </p>
              <ul className="space-y-2">
                {settings.assetFields.map((f) => (
                  <li
                    key={f.key}
                    className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={f.enabled}
                        onChange={() => toggleField(f.key)}
                        disabled={saving}
                        className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded"
                      />
                      <span className="text-slate-800 font-semibold text-sm">{f.label}</span>
                      <span className="text-slate-400 text-xs font-mono">({f.key})</span>
                    </div>
                    {!['location', 'plantCode', 'department', 'make', 'model', 'serialNumber', 'assetCode'].includes(f.key) && (
                      <button
                        onClick={() => removeAssetField(f.key)}
                        disabled={saving}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="pt-4 border-t border-slate-100">
                <h4 className="font-bold text-slate-800 text-sm mb-2">Add Custom Field</h4>
                <div className="flex gap-2 flex-wrap">
                  <input
                    value={fieldForm.key}
                    disabled={saving}
                    onChange={(e) => setFieldForm({ ...fieldForm, key: e.target.value })}
                    placeholder="field_key"
                    className="flex-1 min-w-[120px] px-3 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-emerald-500 placeholder:text-slate-400"
                  />
                  <input
                    value={fieldForm.label}
                    disabled={saving}
                    onChange={(e) => setFieldForm({ ...fieldForm, label: e.target.value })}
                    placeholder="Display label"
                    className="flex-1 min-w-[120px] px-3 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-emerald-500 placeholder:text-slate-400"
                  />
                  <button
                    onClick={addAssetField}
                    disabled={saving}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    Add Field
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'types' && isItAdmin && <TypeDefinitionsAdmin />}
        </div>
      </div>

      {/* Confirmation Modal for Location Delete/Archive */}
      {deleteLocTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border border-slate-100">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-black text-slate-900">Delete or Archive Location?</h3>
            </div>
            <p className="text-slate-600 text-sm mb-6">
              You are about to remove the location <strong>"{deleteLocTarget}"</strong>. Do you want to permanently delete the associated Google Sheet tab, or archive it (rename to ARCHIVED_{deleteLocTarget})?
            </p>
            <div className="flex gap-2 flex-wrap justify-end">
              <button
                type="button"
                onClick={() => setDeleteLocTarget(null)}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeDeleteLocation(deleteLocTarget, 'archive')}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-bold text-white bg-amber-600 rounded-xl hover:bg-amber-700 transition-colors shadow-lg shadow-amber-600/20 flex items-center gap-1"
              >
                <Archive size={15} /> Archive Tab
              </button>
              <button
                type="button"
                onClick={() => executeDeleteLocation(deleteLocTarget, 'delete')}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 flex items-center gap-1"
              >
                <Trash2 size={15} /> Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Plant Delete/Archive */}
      {deletePlantTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border border-slate-100">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-black text-slate-900">Delete or Archive Plant?</h3>
            </div>
            <p className="text-slate-600 text-sm mb-6">
              You are about to remove the plant code <strong>"{deletePlantTarget}"</strong>. Do you want to permanently delete the associated Google Sheet tab, or archive it (rename to ARCHIVED_{deletePlantTarget})?
            </p>
            <div className="flex gap-2 flex-wrap justify-end">
              <button
                type="button"
                onClick={() => setDeletePlantTarget(null)}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeDeletePlant(deletePlantTarget, 'archive')}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-bold text-white bg-amber-600 rounded-xl hover:bg-amber-700 transition-colors shadow-lg shadow-amber-600/20 flex items-center gap-1"
              >
                <Archive size={15} /> Archive Tab
              </button>
              <button
                type="button"
                onClick={() => executeDeletePlant(deletePlantTarget, 'delete')}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 flex items-center gap-1"
              >
                <Trash2 size={15} /> Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
