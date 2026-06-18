import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Plus,
  Search,
  RefreshCw,
  Package,
  CheckCircle,
  AlertTriangle,
  Trash2,
  FileDown,
  UserCheck,
  Edit2,
  Trash
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { MAIN_CATEGORIES } from '../lib/assetCatalogByType';
import { useApp } from '../context/AppProvider';
import type { InventoryItem } from '../types/inventory';
import { EMPTY_INVENTORY_ITEM } from '../types/inventory';
import InventoryModal from '../components/InventoryModal';

const displayInventoryStatus = (status?: string) => (status === 'Missing' ? 'Lost' : status || 'Available');

export default function InventoryPage() {
  const { user, assets, visibleCategories } = useApp();
  const navigate = useNavigate();
  const { inventory, loading, refresh } = useInventory();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<InventoryItem>(EMPTY_INVENTORY_ITEM());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'inventory' | 'damaged'>('inventory');
  const [stockFilter, setStockFilter] = useState<'Active' | 'All' | 'Available' | 'Assigned' | 'Damaged' | 'LowStock'>('Active');

  const isAdmin = user?.role === 'IT Admin' || user?.role === 'Admin';

  const filtered = useMemo(() => {
    let list = inventory;
    if (selectedCategory !== 'All') {
      list = list.filter((item) => item.category === selectedCategory);
    }
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (item) =>
          item.itemId.toLowerCase().includes(q) ||
          item.itemName.toLowerCase().includes(q) ||
          item.brandName.toLowerCase().includes(q) ||
          item.model.toLowerCase().includes(q) ||
          item.serialNumber.toLowerCase().includes(q)
      );
    }
    return list;
  }, [inventory, selectedCategory, search]);

  const displayFiltered = useMemo(() => {
    let list = filtered;
    if (stockFilter === 'Active') list = list.filter(a => a.status !== 'Damaged' && a.status !== 'Missing' && a.status !== 'Lost' && a.status !== 'Scrap');
    else if (stockFilter === 'Available') list = list.filter(a => a.status === 'Available');
    else if (stockFilter === 'Assigned') list = list.filter(a => a.status === 'Assigned');
    else if (stockFilter === 'Damaged') list = list.filter(a => a.status === 'Damaged');
    else if (stockFilter === 'LowStock') list = list.filter(a => a.quantity <= a.minStock);
    return list;
  }, [filtered, stockFilter]);

  const filteredDamagedAssets = useMemo(() => {
    let list = assets.filter(a => a.status === 'Damaged' || a.condition === 'Damaged');
    if (selectedCategory !== 'All') {
      list = list.filter((a) => (a.mainCategory || 'IT Assets') === selectedCategory);
    }
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (a) =>
          (a.assetCode || '').toLowerCase().includes(q) ||
          (a.uniqueCode || '').toLowerCase().includes(q) ||
          (a.assetName || '').toLowerCase().includes(q) ||
          (a.make || '').toLowerCase().includes(q) ||
          (a.model || '').toLowerCase().includes(q) ||
          (a.serialNumber || '').toLowerCase().includes(q) ||
          (a.contactName || '').toLowerCase().includes(q) ||
          (a.contactEmail || '').toLowerCase().includes(q) ||
          (a.employeeId || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [assets, selectedCategory, search]);

  // Dashboard Stats Calculations
  const stats = useMemo(() => {
    let totalItems = 0;
    let availableStock = 0;
    let assignedItems = 0;
    let damagedItems = 0;
    let lowStockItems = 0;

    filtered.forEach((item) => {
      totalItems += item.quantity;
      if (item.status === 'Available') {
        availableStock += item.quantity;
      } else if (item.status === 'Assigned') {
        assignedItems += item.quantity;
      } else if (item.status === 'Damaged') {
        damagedItems += item.quantity;
      }

      if (item.quantity <= item.minStock) {
        lowStockItems++;
      }
    });

    return {
      totalItems,
      availableStock,
      assignedItems,
      damagedItems,
      lowStockItems,
    };
  }, [filtered]);

  const openAdd = () => {
    setForm(EMPTY_INVENTORY_ITEM());
    setModalOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setForm({ ...item });
    setModalOpen(true);
  };

  const executeDelete = async (itemId: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/inventory/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Inventory item deleted');
      setDeletingId(null);
      await refresh(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 lg:px-8 py-4 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Inventory Management</h1>
            <p className="text-sm text-slate-500 mt-1">Consumables and stock level registry</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                toast.promise(refresh(true), {
                  loading: 'Syncing with database...',
                  success: 'Database updated successfully',
                  error: 'Sync failed'
                }, { id: 'sync-inventory-page' });
              }}
              className={`px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Sync
            </button>
            <button
              type="button"
              onClick={openAdd}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg shadow-blue-600/20"
            >
              <Plus size={16} /> Add Item
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search inventory..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm text-slate-700 font-bold focus:outline-none"
          >
            <option value="All">All Categories</option>
            {visibleCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 lg:p-8 space-y-6">
        {/* Stats Cards Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div onClick={() => { setActiveTab('inventory'); setStockFilter('All'); }} className={`cursor-pointer transition-all hover:scale-[1.02] bg-white border rounded-2xl p-5 shadow-sm ${activeTab === 'inventory' && stockFilter === 'All' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Items</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.totalItems}</h3>
              </div>
              <Package className="w-6 h-6 text-slate-400" />
            </div>
          </div>

          <div onClick={() => { setActiveTab('inventory'); setStockFilter('Available'); }} className={`cursor-pointer transition-all hover:scale-[1.02] bg-white border rounded-2xl p-5 shadow-sm ${activeTab === 'inventory' && stockFilter === 'Available' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200'}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-wider ${stockFilter === 'Available' ? 'text-emerald-500' : 'text-slate-400'}`}>Available Stock</p>
                <h3 className="text-2xl font-black text-emerald-600 mt-1">{stats.availableStock}</h3>
              </div>
              <CheckCircle className="w-6 h-6 text-emerald-500" />
            </div>
          </div>

          <div onClick={() => { setActiveTab('inventory'); setStockFilter('Assigned'); }} className={`cursor-pointer transition-all hover:scale-[1.02] bg-white border rounded-2xl p-5 shadow-sm ${activeTab === 'inventory' && stockFilter === 'Assigned' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-wider ${stockFilter === 'Assigned' ? 'text-blue-500' : 'text-slate-400'}`}>Assigned Items</p>
                <h3 className="text-2xl font-black text-blue-600 mt-1">{stats.assignedItems}</h3>
              </div>
              <UserCheck className="w-6 h-6 text-blue-500" />
            </div>
          </div>

          <div onClick={() => { setActiveTab('inventory'); setStockFilter('Damaged'); }} className={`cursor-pointer transition-all hover:scale-[1.02] bg-white border rounded-2xl p-5 shadow-sm ${activeTab === 'inventory' && stockFilter === 'Damaged' ? 'border-red-500 ring-2 ring-red-500/20' : 'border-slate-200'}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-wider ${stockFilter === 'Damaged' ? 'text-red-500' : 'text-slate-400'}`}>Damaged Items</p>
                <h3 className="text-2xl font-black text-red-600 mt-1">{stats.damagedItems}</h3>
              </div>
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
          </div>

          <div onClick={() => { setActiveTab('inventory'); setStockFilter('LowStock'); }} className={`cursor-pointer transition-all hover:scale-[1.02] border rounded-2xl p-5 shadow-sm ${activeTab === 'inventory' && stockFilter === 'LowStock' ? 'border-rose-500 ring-2 ring-rose-500/20' : stats.lowStockItems > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-wider ${stockFilter === 'LowStock' ? 'text-rose-600' : stats.lowStockItems > 0 ? 'text-rose-600' : 'text-slate-400'}`}>Low Stock Alerts</p>
                <h3 className={`text-2xl font-black mt-1 ${stats.lowStockItems > 0 ? 'text-rose-700' : 'text-slate-900'}`}>{stats.lowStockItems}</h3>
              </div>
              <AlertTriangle className={`w-6 h-6 ${stats.lowStockItems > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-4 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${
              activeTab === 'inventory' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            Stock Inventory
          </button>
          <button
            onClick={() => setActiveTab('damaged')}
            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${
              activeTab === 'damaged' ? 'border-b-2 border-red-600 text-red-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            Damaged Assets
          </button>
        </div>

        {activeTab === 'damaged' ? (
          /* Damaged Assets Table */
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {filteredDamagedAssets.length === 0 ? (
              <div className="p-16 text-center">
                <Trash2 className="mx-auto mb-3 opacity-30 text-slate-500" size={48} />
                <p className="font-bold text-slate-700">No damaged assets found</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Asset ID</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Asset Name</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Category</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Custodian (Who had it)</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDamagedAssets.map((asset) => (
                    <tr key={asset.id || asset.uniqueCode} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-mono text-sm font-bold text-blue-700">{asset.uniqueCode || asset.assetCode}</td>
                      <td className="px-6 py-4">
                        <p className="font-black text-slate-900 text-sm">{asset.assetName || asset.model || asset.make}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{asset.serialNumber}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{asset.mainCategory}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <UserCheck size={14} className="text-slate-400" />
                          <div>
                            <p className="text-sm font-bold text-slate-700">{asset.contactName || 'Unassigned'}</p>
                            {(asset.employeeId || asset.contactEmail) && (
                              <p className="text-xs text-slate-500">{asset.employeeId} {asset.contactEmail ? `· ${asset.contactEmail}` : ''}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100">
                          {asset.status === 'Damaged' ? 'Damaged' : asset.condition === 'Damaged' ? 'Condition: Damaged' : 'Damaged'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/assets/${encodeURIComponent(asset.uniqueCode || asset.assetCode || asset.id || '')}`)}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <>
          {/* Table of Inventory Items */}
          {loading && displayFiltered.length === 0 ? (
            <p className="text-slate-500 font-bold animate-pulse">Loading stock levels...</p>
          ) : displayFiltered.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
              <Package className="mx-auto mb-3 opacity-30 text-slate-500" size={48} />
              <p className="font-bold text-slate-700">No inventory items found for {stockFilter} filter.</p>
              <button type="button" onClick={openAdd} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/20">
                Add First Stock Item
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Item ID</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Item Name</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Brand / Model</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Serial Number</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Category</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Quantity</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayFiltered.map((item) => {
                    const isLowStock = item.quantity <= item.minStock;
                    return (
                      <tr key={item.itemId} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-mono text-sm font-bold text-blue-700">{item.itemId}</td>
                        <td className="px-6 py-4 font-black text-slate-900 text-sm">{item.itemName}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          {item.brandName} {item.model ? `· ${item.model}` : ''}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{item.serialNumber || '—'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{item.category}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-black ${
                          isLowStock ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-slate-50 text-slate-700'
                        }`}>
                          {item.quantity} {isLowStock ? ' (Low)' : ''}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          displayInventoryStatus(item.status) === 'Available' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          displayInventoryStatus(item.status) === 'Assigned' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                          displayInventoryStatus(item.status) === 'Damaged' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                          'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {displayInventoryStatus(item.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setDeletingId(item.itemId)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                              title="Delete"
                            >
                              <Trash size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
          </>
        )}
      </div>

      <InventoryModal
        open={modalOpen}
        initial={form}
        onClose={() => setModalOpen(false)}
        onSaved={async () => {
          await refresh(true);
        }}
      />

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">
            <h3 className="text-lg font-black text-slate-900 mb-2">Delete Inventory Item</h3>
            <p className="text-slate-600 text-sm mb-6">
              Are you sure you want to delete item <b>{deletingId}</b> from inventory? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => executeDelete(deletingId)}
                className="px-4 py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
