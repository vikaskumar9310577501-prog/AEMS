import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, CheckCircle2, ArrowRight, Layers, MapPin, Building2, Hash, Tag, Cpu, ShieldCheck } from 'lucide-react';
import type { Asset } from '../types';
import DeviceThumb from './DeviceThumb';
import { assetRouteId } from '../lib/assetLookup';

interface AvailableAssetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  onSelectAsset: (asset: Asset) => void;
}

export default function AvailableAssetsModal({
  isOpen,
  onClose,
  assets,
  onSelectAsset,
}: AvailableAssetsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Filter ONLY available assets according to existing AEMS status logic
  const availableAssets = useMemo(() => {
    return assets.filter((a) => !a.status || a.status === 'Available');
  }, [assets]);

  // Compute category-wise breakdown dynamically from existing available assets
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const asset of availableAssets) {
      // Group primarily by assetType (Laptop, Desktop, Monitor, etc.) or mainCategory
      const catKey = asset.assetType?.trim() || asset.mainCategory?.trim() || 'General';
      counts.set(catKey, (counts.get(catKey) || 0) + 1);
    }
    return counts;
  }, [availableAssets]);

  // Sort categories by count descending
  const sortedCategories = useMemo(() => {
    const list = Array.from(categoryCounts.entries()).map(([name, count]) => ({ name, count }));
    list.sort((a, b) => b.count - a.count);
    return list;
  }, [categoryCounts]);

  // Filtered available assets based on search query & selected category
  const filteredAvailableAssets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return availableAssets.filter((asset) => {
      // Category filter
      if (selectedCategory !== 'All') {
        const catKey = asset.assetType?.trim() || asset.mainCategory?.trim() || 'General';
        if (catKey !== selectedCategory) return false;
      }

      // Search filter
      if (!query) return true;

      const idMatch = String(asset.id || '').toLowerCase().includes(query);
      const codeMatch = String(asset.assetCode || '').toLowerCase().includes(query);
      const serialMatch = String(asset.serialNumber || '').toLowerCase().includes(query);
      const typeMatch = String(asset.assetType || '').toLowerCase().includes(query);
      const catMatch = String(asset.mainCategory || '').toLowerCase().includes(query);
      const makeMatch = String(asset.make || '').toLowerCase().includes(query);
      const modelMatch = String(asset.model || '').toLowerCase().includes(query);
      const plantMatch = String(asset.plantCode || '').toLowerCase().includes(query);
      const locMatch = String(asset.location || '').toLowerCase().includes(query);
      const deptMatch = String(asset.department || '').toLowerCase().includes(query);

      return (
        idMatch ||
        codeMatch ||
        serialMatch ||
        typeMatch ||
        catMatch ||
        makeMatch ||
        modelMatch ||
        plantMatch ||
        locMatch ||
        deptMatch
      );
    });
  }, [availableAssets, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto bg-slate-900/75 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-50 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-white border-b border-slate-200 px-6 py-5 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200/60 text-emerald-600 flex items-center justify-center shadow-xs">
                  <CheckCircle2 size={24} className="stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      Available Assets
                    </h2>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-black tracking-wide border border-emerald-200">
                      {availableAssets.length} Available
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Assets currently in stock and ready for immediate employee assignment.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Bar */}
            <div className="mt-4 relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search available assets by ID, Make, Model, Serial Number, Category, Plant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-700"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Interactive Category Tabs / Chips (Sections 8, 9, 13) */}
            <div className="mt-3.5 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              <button
                type="button"
                onClick={() => setSelectedCategory('All')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === 'All'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                <Layers size={13} />
                <span>All Categories</span>
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                    selectedCategory === 'All' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {availableAssets.length}
                </span>
              </button>

              {sortedCategories.map(({ name, count }) => {
                const isActive = selectedCategory === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSelectedCategory(name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>{name}</span>
                    <span
                      className={`ml-1 px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                        isActive ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Asset List Content Area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
            {filteredAvailableAssets.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-3.5 shadow-xs">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-base font-black text-slate-800">No Available Assets</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  {searchQuery || selectedCategory !== 'All'
                    ? 'No available assets match your current category or search filter.'
                    : 'All registered assets are currently assigned to employees or undergoing maintenance.'}
                </p>
                {(searchQuery || selectedCategory !== 'All') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                    }}
                    className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAvailableAssets.map((asset) => {
                  const displayId = asset.assetCode || (asset.id ? `IT-${String(asset.id).padStart(3, '0')}` : 'N/A');

                  return (
                    <div
                      key={asset.id}
                      onClick={() => {
                        onClose();
                        onSelectAsset(asset);
                      }}
                      className="group bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-4.5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer relative"
                    >
                      <div>
                        {/* Top Badge & Thumbnail */}
                        <div className="flex items-start gap-3.5">
                          <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 p-1.5 overflow-hidden">
                            <DeviceThumb
                              assetType={asset.assetType}
                              mainCategory={asset.mainCategory}
                              subCategory={asset.subCategory}
                              imageUrl={asset.imageUrl}
                              size="md"
                              className="w-full h-full object-contain"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
                                #{displayId}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-black uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Available
                              </span>
                            </div>

                            <h4 className="text-sm font-black text-slate-900 truncate mt-0.5 group-hover:text-emerald-700 transition-colors">
                              {asset.assetType || asset.subCategory || 'Asset'}
                            </h4>

                            <p className="text-xs text-slate-600 font-semibold truncate">
                              {asset.make ? `${asset.make} ${asset.model || ''}`.trim() : asset.model || 'Standard Configuration'}
                            </p>
                          </div>
                        </div>

                        {/* Specs & Meta Information */}
                        <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600 font-medium">
                          {asset.serialNumber && (
                            <div className="flex items-center gap-2 text-[11px] truncate">
                              <Hash size={13} className="text-slate-400 shrink-0" />
                              <span className="text-slate-400 font-sans">S/N:</span>
                              <span className="font-mono font-bold text-slate-800 truncate">{asset.serialNumber}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-[11px] truncate">
                            <Building2 size={13} className="text-slate-400 shrink-0" />
                            <span className="text-slate-400 font-sans">Plant:</span>
                            <span className="font-bold text-slate-800 truncate">
                              {asset.plantCode || 'Main Plant'} {asset.location ? `· ${asset.location}` : ''}
                            </span>
                          </div>

                          {asset.department && (
                            <div className="flex items-center gap-2 text-[11px] truncate">
                              <Tag size={13} className="text-slate-400 shrink-0" />
                              <span className="text-slate-400 font-sans">Dept:</span>
                              <span className="font-bold text-slate-800 truncate">{asset.department}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 group-hover:text-emerald-600 transition-colors">
                          Ready for Assignment
                        </span>
                        <div className="flex items-center gap-1.5 text-xs font-black text-emerald-600 group-hover:translate-x-0.5 transition-transform">
                          <span>Assign / View</span>
                          <ArrowRight size={14} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="bg-white border-t border-slate-200 px-6 py-3.5 shrink-0 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>
              Showing <strong className="text-slate-800 font-black">{filteredAvailableAssets.length}</strong> of{' '}
              <strong className="text-slate-800 font-black">{availableAssets.length}</strong> available assets
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
