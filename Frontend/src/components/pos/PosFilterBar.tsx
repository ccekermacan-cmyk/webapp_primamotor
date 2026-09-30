import React from 'react';
import { createPortal } from 'react-dom';
import { Search, List, Grid, Filter, ChevronDown, User, X, CheckCircle2, Clock, Layers } from 'lucide-react';

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

export const PosFilterBar: React.FC<PosFilterBarProps> = React.memo(({
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
  const isOverview = selectedMenu?.toLowerCase() === 'overview';

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
          {!isOverview && (
            <div className="hidden sm:flex bg-white/80 border border-slate-200 rounded-xl p-1 shadow-sm shrink-0 items-center">
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all duration-300 ${viewMode === 'list' ? `${activeTheme.main} text-white shadow-sm` : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                <List size={16} />
              </button>
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all duration-300 ${viewMode === 'grid' ? `${activeTheme.main} text-white shadow-sm` : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                <Grid size={16} />
              </button>
            </div>
          )}

          {/* Tombol Filter & Indikator (Tampil untuk Overview & halaman transaksi) */}
          {isOverview && (
            <>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 shadow-sm border ${
                  showFilters
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white/90 border-slate-200 hover:border-slate-300 hover:bg-white text-slate-700'
                }`}
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

              {/* Indikator Active Status Pill */}
              {filterStatus !== 'all' && (
                <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border flex items-center gap-1 shrink-0 shadow-sm transition-all ${
                  filterStatus === 'lunas' 
                    ? 'text-emerald-700 bg-emerald-100/90 border-emerald-300' 
                    : 'text-rose-700 bg-rose-100/90 border-rose-300'
                }`}>
                  {filterStatus === 'lunas' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                  {filterStatus === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                  <button
                    onClick={() => {
                      setFilterStatus('all');
                      setPage(1);
                      const url = new URL(window.location.href);
                      url.searchParams.delete('status');
                      if (filterPerson) url.searchParams.set('person', filterPerson);
                      window.history.replaceState({}, '', url.toString());
                    }}
                    className={`ml-0.5 ${filterStatus === 'lunas' ? 'text-emerald-500 hover:text-emerald-800' : 'text-rose-500 hover:text-rose-800'}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {/* Indikator Filter Person */}
              {filterPerson && (
                <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 flex items-center gap-1 shrink-0">
                  <User size={12} />
                  {(() => {
                    const p = allPersons.find(item => item.id_lama === filterPerson || item.id === filterPerson);
                    return p ? `${p.text_1}${p.text_2 ? ` - ${p.text_2}` : ''}` : filterPerson;
                  })()}
                  <button
                    onClick={() => {
                      setFilterPerson('');
                      setPage(1);
                      const url = new URL(window.location.href);
                      url.searchParams.delete('person');
                      if (filterStatus !== 'all') url.searchParams.set('status', filterStatus);
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

      {/* Area Filter (collapsible) */}
      {isOverview && (
        <div
          className={`overflow-visible transition-all duration-300 ease-in-out ${
            showFilters ? 'max-h-[800px] opacity-100 mt-1' : 'max-h-0 opacity-0 hidden'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 md:gap-3 p-3 bg-white/80 rounded-xl border border-slate-200/60 shadow-sm">
      
            {/* === GRUP FILTER STATUS === */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Status:</span>
              <div className="flex flex-wrap items-center gap-1 bg-slate-100/90 rounded-xl border border-slate-200/80 p-1 shadow-inner">
                {/* Button SEMUA */}
                <button
                  key="all"
                  onClick={() => {
                    setFilterStatus('all');
                    setPage(1);
                    const url = new URL(window.location.href);
                    url.searchParams.delete('status');
                    if (filterPerson) url.searchParams.set('person', filterPerson);
                    if (selectedMenuFilters.length > 0) url.searchParams.set('jenis', selectedMenuFilters.join(','));
                    window.history.replaceState({}, '', url.toString());
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 whitespace-nowrap ${
                    filterStatus === 'all'
                      ? 'bg-slate-800 text-white shadow-md border border-slate-700 ring-2 ring-slate-400/30'
                      : 'text-slate-600 bg-white hover:bg-slate-200/70 border border-slate-200/60'
                  }`}
                >
                  <Layers size={13} />
                  Semua
                </button>

                {/* Button LUNAS */}
                <button
                  key="lunas"
                  onClick={() => {
                    setFilterStatus('lunas');
                    setPage(1);
                    const url = new URL(window.location.href);
                    url.searchParams.set('status', 'lunas');
                    if (filterPerson) url.searchParams.set('person', filterPerson);
                    if (selectedMenuFilters.length > 0) url.searchParams.set('jenis', selectedMenuFilters.join(','));
                    window.history.replaceState({}, '', url.toString());
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 whitespace-nowrap ${
                    filterStatus === 'lunas'
                      ? 'bg-emerald-600 text-white shadow-md border border-emerald-500 ring-2 ring-emerald-400/40'
                      : 'text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200/80'
                  }`}
                >
                  <CheckCircle2 size={13} />
                  Lunas
                </button>

                {/* Button BELUM LUNAS */}
                <button
                  key="belum"
                  onClick={() => {
                    setFilterStatus('belum');
                    setPage(1);
                    const url = new URL(window.location.href);
                    url.searchParams.set('status', 'belum');
                    if (filterPerson) url.searchParams.set('person', filterPerson);
                    if (selectedMenuFilters.length > 0) url.searchParams.set('jenis', selectedMenuFilters.join(','));
                    window.history.replaceState({}, '', url.toString());
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 whitespace-nowrap ${
                    filterStatus === 'belum'
                      ? 'bg-rose-600 text-white shadow-md border border-rose-500 ring-2 ring-rose-400/40'
                      : 'text-rose-700 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/80'
                  }`}
                >
                  <Clock size={13} />
                  Belum Lunas
                </button>
              </div>
            </div>

            {/* Pemisah (hanya tampil di desktop) */}
            <div className="hidden md:block w-px h-6 bg-slate-300/50"></div>

            {/* === GRUP FILTER PERSON === */}
            <div className="relative">
              <button
                ref={personButtonRef}
                onClick={() => {
                  if (!isPersonFilterOpen && personButtonRef.current) {
                    const rect = personButtonRef.current.getBoundingClientRect();
                    const dropdownWidth = 288;
                    let leftPos = rect.left;
                    if (leftPos + dropdownWidth > window.innerWidth - 16) {
                      leftPos = Math.max(16, window.innerWidth - dropdownWidth - 16);
                    }
                    setDropdownPosition({
                      top: rect.bottom,
                      left: leftPos,
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
                    ? (() => {
                        const p = allPersons.find(item => item.id_lama === filterPerson || item.id === filterPerson);
                        return p ? `${p.text_1}${p.text_2 ? ` - ${p.text_2}` : ''}` : 'Person';
                      })()
                    : 'Person'}
                </span>
                {filterPerson && (
                  <X
                    size={13}
                    className="ml-0.5 cursor-pointer hover:text-white/70"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilterPerson('');
                      setPage(1);
                      const url = new URL(window.location.href);
                      url.searchParams.delete('person');
                      if (filterStatus !== 'all') url.searchParams.set('status', filterStatus);
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
                      {/* Tampilkan Pilihan 'Semua Person' */}
                      <div
                        onClick={() => {
                          setFilterPerson('');
                          setIsPersonFilterOpen(false);
                          setPersonFilterSearch('');
                          setPage(1);
                          const url = new URL(window.location.href);
                          url.searchParams.delete('person');
                          if (filterStatus !== 'all') url.searchParams.set('status', filterStatus);
                          window.history.replaceState({}, '', url.toString());
                        }}
                        className={`px-3 py-2 rounded-xl cursor-pointer hover:bg-slate-100 text-xs font-bold transition-colors ${
                          !filterPerson ? 'bg-slate-200 text-slate-800' : 'text-slate-500'
                        }`}
                      >
                        Semua Person
                      </div>

                      {allPersons
                        .filter(p => {
                          if (!personFilterSearch.trim()) return true;
                          const s = personFilterSearch.toLowerCase();
                          const t1 = (p.text_1 || '').toLowerCase();
                          const t2 = (p.text_2 || '').toLowerCase();
                          const j = (p.jenis || '').toLowerCase();
                          const idLama = (p.id_lama || '').toLowerCase();
                          return t1.includes(s) || t2.includes(s) || j.includes(s) || idLama.includes(s);
                        })
                        .map(p => {
                          const personId = p.id_lama || p.id;
                          const isSelected = filterPerson === p.id_lama || filterPerson === p.id;
                          return (
                            <div
                              key={p.id || p.id_lama}
                              onClick={() => {
                                setFilterPerson(personId);
                                setIsPersonFilterOpen(false);
                                setPersonFilterSearch('');
                                setPage(1);
                                const url = new URL(window.location.href);
                                url.searchParams.set('person', personId);
                                if (filterStatus !== 'all') url.searchParams.set('status', filterStatus);
                                window.history.replaceState({}, '', url.toString());
                              }}
                              className={`px-3 py-2.5 rounded-xl cursor-pointer hover:bg-blue-50 text-xs font-bold flex justify-between items-center transition-colors ${
                                isSelected ? 'bg-blue-100 text-blue-700' : 'text-slate-700'
                              }`}
                            >
                              <span className="truncate">
                                {p.text_1} {p.text_2 ? `- ${p.text_2}` : ''}
                              </span>
                              {p.jenis && (
                                <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full capitalize">
                                  {p.jenis}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      {allPersons.length === 0 && (
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
                .filter(m => m.text_1?.toLowerCase() !== 'overview')
                .map(menu => (
                  <button
                    key={menu.id || menu.text_1}
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
});
