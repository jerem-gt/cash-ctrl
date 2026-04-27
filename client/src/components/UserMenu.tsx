import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';

interface UserMenuProps {
  username: string;
  onLogout: () => void;
}

export function UserMenu({ username, onLogout }: Readonly<UserMenuProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermer le menu si on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative px-4 py-4 border-t border-white/[0.07]" ref={menuRef}>
      <button
        aria-label="Menu utilisateur"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-2 rounded-xl transition-all duration-200 ${
          isOpen ? 'bg-white/10' : 'hover:bg-white/5'
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Avatar avec un gradient discret pour le style */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sidebar-accent/40 to-sidebar-accent/10 border border-sidebar-accent/30 flex items-center justify-center text-sidebar-accent font-semibold text-xs shadow-inner">
            {username.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col items-start min-w-0">
            <span className="text-sm font-medium text-white/80 truncate w-24 text-left">
              {username}
            </span>
          </div>
        </div>
        <span
          className={`text-white/20 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
            <path
              d="M1 1L5 5L9 1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute bottom-[85%] left-4 right-4 mb-2 bg-[#121212] border border-white/10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden z-[60] animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="p-1.5 flex flex-col gap-0.5">
            <UserMenuItem
              icon="🔒"
              label="Sécurité"
              to="/settings/security"
              onClick={() => setIsOpen(false)}
            />

            <div className="h-px bg-white/5 my-1 mx-2" />

            <button
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors w-full group"
            >
              <span className="w-4 text-center opacity-70 group-hover:scale-110 transition-transform">
                🚪
              </span>
              <span className="flex-1 text-left">Déconnexion</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenuItem({
  icon,
  label,
  to,
  onClick,
}: Readonly<{
  icon: string;
  label: string;
  to: string;
  onClick: () => void;
}>) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2 text-sm text-white/60 hover:text-white/90 hover:bg-white/5 rounded-lg transition-all group"
    >
      <span className="w-4 text-center opacity-50 group-hover:opacity-100 transition-opacity">
        {icon}
      </span>
      {label}
    </NavLink>
  );
}
