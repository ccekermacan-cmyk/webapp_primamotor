import React from 'react';

interface MenuOption {
  id: string;
  text_1: string;
}

interface PosNavbarProps {
  showNavbar: boolean;
  menuOptions: MenuOption[];
  userLevel: string;
  selectedMenu: string;
  getThemeConfig: (menu: string) => any;
  handleMenuChange: (menuName: string) => void;
}

export const PosNavbar: React.FC<PosNavbarProps> = React.memo(({
  showNavbar,
  menuOptions,
  userLevel,
  selectedMenu,
  getThemeConfig,
  handleMenuChange,
}) => {
  return (
    <div
      className={`shrink-0 transition-all duration-300 ${
        showNavbar ? 'opacity-100 max-h-24 mb-6' : 'opacity-0 max-h-0 mb-0 overflow-hidden'
      }`}
    >
      <div className="flex p-1.5 bg-slate-200/60 rounded-2xl w-full sm:w-fit shadow-sm border border-slate-200/50 overflow-x-auto no-scrollbar">
        <div className="flex gap-1.5 sm:gap-2 px-1">
          {menuOptions
            .filter(m => userLevel !== '10' || m.text_1.toLowerCase() === 'overview')
            .map(m => {
              const tabTheme = getThemeConfig(m.text_1);
              const isActive = selectedMenu === m.text_1;
              return (
                <button
                  key={m.id}
                  onClick={() => handleMenuChange(m.text_1)}
                  className={`flex-1 sm:w-40 py-2.5 px-4 text-[10px] md:text-[11px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
                    isActive
                      ? `${tabTheme.main} text-white shadow-md shadow-${tabTheme.main.replace('bg-', '')}/30 scale-95`
                      : `text-slate-500 hover:text-slate-700 hover:bg-white/50`
                  }`}
                >
                  {m.text_1}
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
});
