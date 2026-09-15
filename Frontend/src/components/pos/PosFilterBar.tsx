import React from 'react';
import { createPortal } from 'react-dom';
import { Search, List, Grid, Filter, ChevronDown, User, X } from 'lucide-react';

interface PosFilterBarProps {
  selectedMenu: string;
  activeTheme: any;
  searchInputRef: React.RefObject<HTMLInputElement>;
  searchInput: string;
  setSearchInput: (val: string) => void;
  viewMode: 'list' | 'grid';
  setViewMode: (mode: 'list' | 'grid') => void;
  showFilters: boolean;
  setShowFilters: (val: boolean) => void;
  filterStatus: string;
  setFilterStatus: (val: string) => void;
  filterPerson: string;
  setFilterPerson: (val: string) => void;
  selectedMenuFilters: string[];
  setSelectedMenuFilters: (val: string[]) => void;
  allPersons: any[];
  personButtonRef: React.RefObject<HTMLButtonElement>;
  isPersonFilterOpen: boolean;
  setIsPersonFilterOpen: (val: boolean) => void;
  dropdownPosition: { top: number; left: number };
  setDropdownPosition: (pos: { top: number; left: number }) => void;
  personFilterSearch: string;
  setPersonFilterSearch: (val: string) => void;
  menuOptions: any[];
  setPage: (page: number) => void;
}

export const PosFilterBar: React.FC<PosFilterBarProps> = ({
  selectedMenu,
  activeTheme,
  searchInputRef,
  searchInput,
  setSearchInput,
  viewMode,
  setViewMode,
  showFilters,
  setShowFilters,
  filterStatus,
  setFilterStatus,
  filterPerson,
  setFilterPerson,
  selectedMenuFilters,
  setSelectedMenuFilters,
  allPersons,
  personButtonRef,
  isPersonFilterOpen,
  setIsPersonFilterOpen,
  dropdownPosition,
  setDropdownPosition,
  personFilterSearch,
  setPersonFilterSearch,
  menuOptions,
  setPage,
}) => {
  return (
    <div className="p-2 sm:p-3 md:p-4 mb-2 sm:mb-3 bg-slate-200/60 rounded-2xl border border-slate-200/50 shadow-sm shrink-0 flex flex-col gap-1 sm:gap-2 md:gap-3">
      {/* BARIS UTAMA: Search + Filter Button + Indikator */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Input Pencarian */}
        <div className="relative w-full group flex-1 min-w-[180px]">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${activeTheme.text} opacity-50 group-focus-within:opacity-100`} size={18} />
          <input 
            ref={searchInputRef}
            type="text" 
            placeholder={`Cari ${selectedMenu}... (F2 / /)`} 
            className={`w-full pl-10 pr-4 py-2.5 bg-white/90 border-2 border-transparent hover:border-slate-300 rounded-xl focus:bg-white focus:border-transparent focus:ring-4 ${activeTheme.focusRing} outline-none transition-all shadow-sm text-sm font-bold text-slate-700 placeholder-slate-400`}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        {/* Grup Tombol & Indikator */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tombol Toggle View (Desktop & Tablet) - hanya jika bukan Overview */}
          {selectedMenu.toLowerCase() !== 'overview' && (
            <div className="hidden sm:flex bg-white/80 border border-slate-200 rounded-xl p-1 shadow-sm shrink-0 items-center">
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all duration-300 ${viewMode === 'list' ? `${activeTheme.main} text-white shadow-sm` : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                <List size={16} />
              </button>
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all duration-300 ${viewMode === 'grid' ? `${activeTheme.main} text-white shadow-sm` : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                <Grid size={16} />
              </button>
            </div>
          )}

          {/* Tombol Filter & Indikator (hanya untuk Overview) */}
          {selectedMenu === 'Overview' && (
            <>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 bg-white/90 border border-slate-200 hover:border-slate-300 hover:bg-white shadow-sm"
              >
                <Filter size={14} />
                Filter
                {(() => {
                  const totalActive = (filterStatus !== 'all' ? 1 : 0) + (filterPerson ? 1 : 0) + (selectedMenuFilters.length > 0 ? 1 : 0);
                  return totalActive > 0 ? (
                    <span className="ml-1 bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                      {totalActive}
                    </span>
                  ) : null;
                })()}
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Indikator Filter Person */}
              {filterPerson && (
                <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 flex items-center gap-1 shrink-0">
                  <User size={12} />
                  {allPersons.find(p => p.id_lama === filterPerson)?.text_1 || filterPerson}
                  <button
                    onClick={() => {
                      setFilterPerson('');
                      setFilterStatus('all');
                      const url = new URL(window.location.href);
                      url.searchParams.delete('person');
                      url.searchParams.delete('status');
                      window.history.replaceState({}, '', url.toString());
                    }}
                    className="ml-0.5 text-blue-400 hover:text-blue-600"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Area Filter (collapsible) - hanya untuk Overview */}
      {selectedMenu === 'Overview' && (
        <div
          className={`overflow-visible transition-all duration-300 ease-in-out ${
            showFilters ? 'max-h-[800px] opacity-100 mt-1' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 md:gap-3 p-3 bg-white/80 rounded-xl border border-slate-200/60 shadow-sm">
      
            {/* === GRUP FILTER STATUS === */}
            <div className="flex flex-wrap items-center gap-1 bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
              {['all', 'lunas', 'belum'].map(status => (
                <button
                  key={status}
                  onClick={() => {
                    setFilterStatus(status);
                    setPage(1);
                    const url = new URL(window.location.href);
                    if (status === 'all') {
                      url.searchParams.delete('status');
                    } else {
                      url.searchParams.set('status', status);
                    }
                    if (filterPerson) url.searchParams.set('person', filterPerson);
                    window.history.replaceState({}, '', url.toString());
                  }}
                  className={`px-2.5 py-1 text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 whitespace-nowrap ${
                    filterStatus === status
                      ? `${activeTheme.main} text-white shadow-sm scale-95`
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {status === 'all' ? 'Semua' : status}
                </button>
              ))}
            </div>

            {/* Pemisah (hanya tampil di desktop) */}
            <div className="hidden md:block w-px h-6 bg-slate-300/50"></div>

            {/* === GRUP FILTER PERSON === */}
            <div className="relative" style={{ zIndex: 9999 }}>
              <button
                ref={personButtonRef}
                onClick={() => {
                  if (!isPersonFilterOpen && personButtonRef.current) {
                    const rect = personButtonRef.current.getBoundingClientRect();
                    setDropdownPosition({
                      top: rect.bottom + window.scrollY,
                      left: rect.left + window.scrollX,
                    });
                  }
                  setIsPersonFilterOpen(!isPersonFilterOpen);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 bg-white border border-slate-200 hover:border-slate-300 shadow-sm ${
                  filterPerson ? `${activeTheme.main} text-white border-transparent shadow-md` : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <User size={13} />
                <span className="truncate max-w-[70px] md:max-w-[100px]">
                  {filterPerson
                    ? allPersons.find(p => p.id_lama === filterPerson)?.text_1 || 'Person'
                    : 'Person'}
                </span>
                {filterPerson && (
                  <X
                    size={13}
                    className="ml-0.5 cursor-pointer hover:text-white/70"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilterPerson('');
                      setFilterStatus('all');
                      const url = new URL(window.location.href);
                      url.searchParams.delete('person');
                      url.searchParams.delete('status');
                      window.history.replaceState({}, '', url.toString());
                    }}
                  />
                )}
                <ChevronDown
                  size={13}
                  className={`transition-transform duration-200 ${isPersonFilterOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown Person (Portal) */}
              {isPersonFilterOpen && createPortal(
                <>
                  <div className="fixed inset-0 z-[9998]" onClick={() => setIsPersonFilterOpen(false)} />
                  <div 
                    className="fixed z-[9999] w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 max-h-72 overflow-y-auto custom-scrollbar"
                    style={{
                      top: dropdownPosition.top + 8,
                      left: dropdownPosition.left,
                    }}
                  >
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Cari customer / supplier..."
                        className="w-full pl-8 pr-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                        value={personFilterSearch}
                        onChange={(e) => setPersonFilterSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="mt-2 space-y-1">
                      {allPersons
                        .filter(p =>
                          (p.jenis?.toLowerCase().includes('customer') || p.jenis?.toLowerCase().includes('supplier')) &&
                          (p.text_1.toLowerCase().includes(personFilterSearch.toLowerCase()) ||
                            (p.text_2 && p.text_2.toLowerCase().includes(personFilterSearch.toLowerCase())))
                        )
                        .map(p => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setFilterPerson(p.id_lama);
                              setIsPersonFilterOpen(false);
                              setPersonFilterSearch('');
                              const currentStatus = filterStatus === 'all' ? 'belum' : filterStatus;
                              const url = new URL(window.location.href);
                              url.searchParams.set('person', p.id_lama);
                              url.searchParams.set('status', currentStatus);
                              window.history.replaceState({}, '', url.toString());
                            }}
                            className={`px-3 py-2.5 rounded-xl cursor-pointer hover:bg-blue-50 text-xs font-bold flex justify-between items-center transition-colors ${
                              filterPerson === p.id_lama ? 'bg-blue-100 text-blue-700' : 'text-slate-700'
                            }`}
                          >
                            <span className="truncate">
                              {p.text_1} {p.text_2 ? `- ${p.text_2}` : ''}
                            </span>
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                              {p.jenis}
                            </span>
                          </div>
                        ))}
                      {allPersons.filter(p => p.jenis?.toLowerCase().includes('customer') || p.jenis?.toLowerCase().includes('supplier')).length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-500">Tidak ada data</div>
                      )}
                    </div>
                  </div>
                </>,
                document.body
              )}
            </div>

            {/* Pemisah (hanya tampil di desktop) */}
            <div className="hidden md:block w-px h-6 bg-slate-300/50"></div>

            {/* === GRUP FILTER JENIS MENU === */}
            <div className="flex flex-wrap items-center gap-1 bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
              <button
                onClick={() => {
                  setSelectedMenuFilters([]);
                  setPage(1);
                  const url = new URL(window.location.href);
                  url.searchParams.delete('jenis');
                  window.history.replaceState({}, '', url.toString());
                }}
                className={`px-2.5 py-1 text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 whitespace-nowrap ${
                  selectedMenuFilters.length === 0
                    ? `${activeTheme.main} text-white shadow-sm scale-95`
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                Semua Jenis
              </button>
              {menuOptions
                .filter(m => m.text_1 !== 'Overview')
                .map(menu => (
                  <button
                    key={menu.id}
                    onClick={() => {
                      const newFilters = selectedMenuFilters.includes(menu.text_1)
                        ? selectedMenuFilters.filter(j => j !== menu.text_1)
                        : [...selectedMenuFilters, menu.text_1];
                      setSelectedMenuFilters(newFilters);
                      setPage(1);
                      const url = new URL(window.location.href);
                      if (newFilters.length > 0) {
                        url.searchParams.set('jenis', newFilters.join(','));
                      } else {
                        url.searchParams.delete('jenis');
                      }
                      window.history.replaceState({}, '', url.toString());
                    }}
                    className={`px-2.5 py-1 text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 whitespace-nowrap ${
                      selectedMenuFilters.includes(menu.text_1)
                        ? `${activeTheme.main} text-white shadow-sm scale-95`
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {menu.text_1}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
