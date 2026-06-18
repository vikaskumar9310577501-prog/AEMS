import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, Pencil, Trash2, X, RefreshCw } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useUsersData, type AppUser } from '../hooks/useUsersData';
import { TableSkeleton, PageHeaderSkeleton } from '../components/LoadingSkeleton';
import { MAIN_CATEGORIES } from '../lib/assetCatalogByType';
import { MISSING_ITEMS_FEATURE_ENABLED } from '../lib/features';
import { useApp } from '../context/AppProvider';
import {
  assignableRoles,
  canAccessUserManagement,
  canAddUser,
  canDeleteUser,
  canEditUser,
  isItAdminRole,
} from '../lib/userPermissions';
import { ViewModeToggle, useListViewMode } from '../components/ViewModeToggle';

interface PlantRecord {
  code: string;
  name: string;
  location: string;
}

interface AppSettings {
  locations: string[];
  plants: PlantRecord[];
}

const emptyForm = (): AppUser => ({
  email: '',
  role: 'User',
  locations: [],
  plants: [],
  categories: [],
  allowDelete: false,
});

const MANAGEABLE_CATEGORIES = MISSING_ITEMS_FEATURE_ENABLED
  ? MAIN_CATEGORIES
  : MAIN_CATEGORIES.filter((cat) => String(cat) !== 'Missing Items');

const sanitizeCategories = (categories: string[] = []) =>
  MISSING_ITEMS_FEATURE_ENABLED
    ? categories
    : categories.filter((cat) => cat !== 'Missing Items');

function sameSettingValue(left: unknown, right: unknown): boolean {
  return String(left ?? '').trim().toLowerCase() === String(right ?? '').trim().toLowerCase();
}

export default function UserManagement() {
  const { user: loggedInUser } = useApp();
  if (!loggedInUser || !canAccessUserManagement(loggedInUser.role) || loggedInUser.role === 'HR') {
    return <Navigate to="/employees" replace />;
  }
  const { users, initialLoading, syncing, syncHint, refreshUsers } = useUsersData();
  const [settings, setSettings] = useState<AppSettings>({ locations: [], plants: [] });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [form, setForm] = useState<AppUser>(emptyForm());
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useListViewMode('assetvault.users.viewMode', 'grid');

  const isITAdmin = isItAdminRole(loggedInUser?.role);
  const roleOptions = assignableRoles(loggedInUser?.role);
  const canManageUsers = !!loggedInUser && canAccessUserManagement(loggedInUser.role);

  useEffect(() => {
    fetch((import.meta.env.VITE_API_BASE_URL || "") + '/api/settings?refresh=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setSettings({
            locations: data.locations || [],
            plants: data.plants || [],
          });
        }
      })
      .catch(() => {});
  }, []);

  // Filter locations and plants this Admin is allowed to assign to others
  const allowedLocations = useMemo(() => {
    if (!loggedInUser) return [];
    if (isITAdmin || loggedInUser.locations?.includes('All')) return settings.locations;
    return settings.locations.filter((loc) =>
      loggedInUser.locations?.some((allowed) => sameSettingValue(allowed, loc))
    );
  }, [settings.locations, loggedInUser, isITAdmin]);

  const allowedPlants = useMemo(() => {
    if (!loggedInUser) return [];
    if (isITAdmin || loggedInUser.plants?.includes('All')) return settings.plants;
    return settings.plants.filter((p) =>
      loggedInUser.plants?.some((allowed) => sameSettingValue(allowed, p.code) || sameSettingValue(allowed, p.name))
    );
  }, [settings.plants, loggedInUser, isITAdmin]);

  const plantsForSelectedLocations = useMemo(() => {
    const list = selectedLocations.length === 0 
      ? allowedPlants 
      : allowedPlants.filter((p) => selectedLocations.some((loc) => sameSettingValue(loc, p.location)));
    return list;
  }, [allowedPlants, selectedLocations]);

  const allowedCategories = useMemo(() => {
    if (!loggedInUser) return [];
    if (isITAdmin || loggedInUser.categories?.includes('All')) return [...MANAGEABLE_CATEGORIES];
    const adminCats = loggedInUser.categories || [];
    return MANAGEABLE_CATEGORIES.filter((cat) => adminCats.includes(cat));
  }, [loggedInUser, isITAdmin]);

  // Filter users list so Admins only see users who share location/plant access
  const displayedUsers = useMemo(() => {
    if (!loggedInUser) return [];
    if (isITAdmin || loggedInUser.locations?.includes('All')) return users;
    const adminLocs = loggedInUser.locations || [];
    const adminPlants = loggedInUser.plants || [];
    const adminCats = loggedInUser.categories || [];
    return users.filter((u) => {
      if (u.role === 'IT Admin') return true;
      const uLocs = u.locations || [];
      const uPlants = u.plants || [];
      const sharesLoc =
        uLocs.includes('All') || uLocs.some((loc) => adminLocs.some((adminLoc) => sameSettingValue(adminLoc, loc)));
      const sharesPlant =
        uPlants.includes('All') || uPlants.some((p) => adminPlants.some((adminPlant) => sameSettingValue(adminPlant, p)));
      const sharesCategory =
        adminCats.includes('All') ||
        adminCats.length === 0 ||
        (u.categories || []).includes('All') ||
        (u.categories || []).some((c) => adminCats.includes(c));
      return (sharesLoc || sharesPlant) && sharesCategory;
    });
  }, [users, loggedInUser, isITAdmin]);

  if (!canManageUsers) {
    return <Navigate to="/dashboard" replace />;
  }

  const toggleLocation = (loc: string) => {
    setSelectedLocations((prev) => {
      const next = prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc];
      const allowedPlantsList = allowedPlants
        .filter((p) => next.some((selectedLoc) => sameSettingValue(selectedLoc, p.location)))
        .map((p) => p.code);
      setSelectedPlants((plants) =>
        plants.filter((p) => allowedPlantsList.some((allowed) => sameSettingValue(allowed, p)))
      );
      return next;
    });
  };

  const togglePlant = (code: string) => {
    setSelectedPlants((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
    );
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const openAdd = () => {
    setEditingEmail(null);
    setForm(emptyForm());
    setSelectedLocations([]);
    setSelectedPlants([]);
    setSelectedCategories(allowedCategories.length === 1 ? [...allowedCategories] : []);
    setModalOpen(true);
  };

  const openEdit = (user: AppUser) => {
    if (!canEditUser(loggedInUser.role)) {
      toast.error('Only IT Admin can edit users');
      return;
    }
    setEditingEmail(user.email);
    setForm({ ...user });
    setSelectedLocations([...user.locations]);
    setSelectedPlants([...user.plants]);
    setSelectedCategories(sanitizeCategories(user.categories || []));
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (editingEmail && !canEditUser(loggedInUser.role)) {
      return toast.error('Only IT Admin can edit users');
    }
    const isRoleITAdmin = form.role === 'IT Admin';
    if (isRoleITAdmin && !isITAdmin) {
      return toast.error('Only IT Admin can assign the IT Admin role');
    }
    const payload: AppUser = {
      ...form,
      email: form.email.trim().toLowerCase(),
      locations: isRoleITAdmin ? ['All'] : selectedLocations,
      plants: isRoleITAdmin ? ['All'] : selectedPlants,
      categories: isRoleITAdmin ? ['All'] : selectedCategories,
    };
    if (!payload.email) return toast.error('Email is required');
    if (!isRoleITAdmin) {
      if (selectedLocations.length === 0) return toast.error('Select at least one location');
      if (selectedPlants.length === 0) return toast.error('Select at least one plant');
      if (selectedCategories.length === 0) return toast.error('Select at least one category access');
      if (!isITAdmin && selectedCategories.some((c) => !allowedCategories.includes(c))) {
        return toast.error('You can only assign categories you have access to');
      }
    }

    setSaving(true);
    try {
      const url = editingEmail
        ? `/api/users/${encodeURIComponent(editingEmail)}`
        : '/api/users';
      const method = editingEmail ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(editingEmail ? 'User updated' : 'User added');
      setModalOpen(false);
      refreshUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirmEmail) return;
    const target = users.find((u) => u.email === deleteConfirmEmail);
    if (target && !canDeleteUser(loggedInUser.role, target)) {
      toast.error('IT Admin users cannot be deleted');
      setDeleteConfirmEmail(null);
      return;
    }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/users/${encodeURIComponent(deleteConfirmEmail)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      toast.success('User deleted');
      setDeleteConfirmEmail(null);
      refreshUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          {initialLoading && displayedUsers.length === 0 ? (
            <PageHeaderSkeleton />
          ) : (
            <div>
              <h2 className="text-2xl font-black text-black tracking-tight">User Management</h2>
              <p className="text-sm text-gray-600 mt-1">
                {displayedUsers.length} user{displayedUsers.length !== 1 ? 's' : ''}
                {syncing ? ' — syncing in background…' : ''}
              </p>
            </div>
          )}
          <div className="flex gap-2 shrink-0">
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
            <button
              type="button"
              onClick={refreshUsers}
              disabled={syncing}
              className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-60"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> Refresh
            </button>
            {canAddUser(loggedInUser.role) && (
              <button
                type="button"
                onClick={openAdd}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2"
              >
                <Plus size={16} /> Add User
              </button>
            )}
          </div>
        </div>

        {syncHint && (
          <p className="mb-4 text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            {syncHint}
          </p>
        )}

        {allowedLocations.length === 0 && (
          <p className="mb-4 text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-xl p-3">
            No authorized locations found — add or configure them in <strong>Settings</strong> first.
          </p>
        )}

        {initialLoading && displayedUsers.length === 0 ? (
          <TableSkeleton rows={5} />
        ) : displayedUsers.length === 0 ? (
          <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl text-center">
            <p className="text-gray-600 mb-3">
              {users.length === 0
                ? 'No users in Google Sheet yet. Add users here or in the Users tab.'
                : 'No users found under your location/plant access.'}
            </p>
            {syncHint && <p className="text-sm text-amber-700 mb-3">{syncHint}</p>}
            {canAddUser(loggedInUser.role) && (
              <button type="button" onClick={openAdd} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold">
                Add First User
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedUsers.map((u) => (
              <div key={u.email} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <p className="text-sm font-bold text-black truncate">{u.email}</p>
                <p className="text-xs text-gray-600 mt-2">{u.role}</p>
                <p className="text-xs text-gray-500 mt-2">{u.locations.join(', ') || '—'}</p>
                <p className="text-xs text-gray-500 mt-1">{u.plants.join(', ') || '—'}</p>
                <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                  {canEditUser(loggedInUser.role) && (
                    <button type="button" onClick={() => openEdit(u)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-700" title="Edit">
                      <Pencil size={16} />
                    </button>
                  )}
                  {canDeleteUser(loggedInUser.role, u) && (
                    <button type="button" onClick={() => setDeleteConfirmEmail(u.email)} className="p-2 rounded-lg hover:bg-red-50 text-red-600" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full table-auto">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left text-xs font-bold text-black uppercase">Email</th>
                  <th className="p-3 text-left text-xs font-bold text-black uppercase">Role</th>
                  <th className="p-3 text-left text-xs font-bold text-black uppercase">Locations</th>
                  <th className="p-3 text-left text-xs font-bold text-black uppercase">Plants</th>
                  <th className="p-3 text-left text-xs font-bold text-black uppercase">Categories</th>
                  <th className="p-3 text-right text-xs font-bold text-black uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedUsers.map((u) => (
                  <tr key={u.email} className="border-t border-gray-100">
                    <td className="p-3 text-sm text-black">{u.email}</td>
                    <td className="p-3 text-sm text-gray-700">{u.role}</td>
                    <td className="p-3 text-sm text-gray-600">{u.locations.join(', ') || '—'}</td>
                    <td className="p-3 text-sm text-gray-600">{u.plants.join(', ') || '—'}</td>
                    <td className="p-3 text-sm text-gray-600">
                      {u.role === 'IT Admin' ? 'All' : sanitizeCategories(u.categories || []).join(', ') || '—'}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        {canEditUser(loggedInUser.role) && (
                          <button type="button" onClick={() => openEdit(u)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-700" title="Edit">
                            <Pencil size={16} />
                          </button>
                        )}
                        {canDeleteUser(loggedInUser.role, u) && (
                          <button type="button" onClick={() => setDeleteConfirmEmail(u.email)} className="p-2 rounded-lg hover:bg-red-50 text-red-600" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-black text-black">
                {editingEmail ? 'Edit User' : 'Add User'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  disabled={!!editingEmail}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-black disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-black"
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {form.role === 'Admin' && (
                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.allowDelete}
                      onChange={(e) => setForm({ ...form, allowDelete: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                  </label>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Allow Asset Deletion</p>
                    <p className="text-xs text-gray-500">Grants this Admin permission to delete assets.</p>
                  </div>
                </div>
              )}

              {form.role === 'IT Admin' ? (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-3 mt-2 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <span className="text-xl">✨</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-900">IT Admin Global Access</h4>
                    <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                      IT Admins automatically have unrestricted master access to all Locations, Plant codes, and Asset categories. Checklist selections are disabled.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">Locations (select one or more)</label>
                    {allowedLocations.length === 0 ? (
                      <p className="text-sm text-gray-500">No authorized locations — configure in Settings first.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border border-gray-200 rounded-xl p-3">
                        {allowedLocations.map((loc) => (
                          <label
                            key={loc}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer border ${
                              selectedLocations.includes(loc)
                                ? 'bg-blue-100 border-blue-400 text-blue-900 font-bold'
                                : 'bg-gray-50 border-gray-200 text-gray-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedLocations.includes(loc)}
                              onChange={() => toggleLocation(loc)}
                              className="w-4 h-4"
                            />
                            {loc}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">Plants (select multiple)</label>
                    {selectedLocations.length === 0 ? (
                      <p className="text-sm text-gray-500">Select a location first.</p>
                    ) : plantsForSelectedLocations.length === 0 ? (
                      <p className="text-sm text-gray-500">No plants for selected location — add in Settings.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-3">
                        {plantsForSelectedLocations.map((p) => (
                          <label
                            key={p.code}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer border ${
                              selectedPlants.includes(p.code)
                                ? 'bg-emerald-100 border-emerald-400 text-emerald-900 font-bold'
                                : 'bg-gray-50 border-gray-200 text-gray-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedPlants.includes(p.code)}
                              onChange={() => togglePlant(p.code)}
                              className="w-4 h-4"
                            />
                            {p.code} — {p.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">Category Access (select one or more)</label>
                    {allowedCategories.length === 0 ? (
                      <p className="text-sm text-gray-500">No authorized categories assigned to your account.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-3">
                        {allowedCategories.map((cat) => (
                          <label
                            key={cat}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer border ${
                              selectedCategories.includes(cat)
                                ? 'bg-purple-100 border-purple-400 text-purple-900 font-bold'
                                : 'bg-gray-50 border-gray-200 text-gray-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedCategories.includes(cat)}
                              onChange={() => toggleCategory(cat)}
                              className="w-4 h-4"
                            />
                            {cat}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Saving...
                  </>
                ) : (
                  editingEmail ? 'Update User' : 'Add User'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmEmail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">
            <h3 className="text-lg font-black text-slate-900 mb-2">Delete User</h3>
            <p className="text-slate-600 text-sm mb-6">Are you sure you want to delete user <b>{deleteConfirmEmail}</b>? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirmEmail(null)} className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={executeDelete} className="px-4 py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
