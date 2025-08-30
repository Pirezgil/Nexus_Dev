import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { SidebarProps } from './Sidebar.types';

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, items = [] }) => {
  const pathname = usePathname();
  
  // Determinar item ativo baseado na rota atual
  const isActiveItem = (href?: string) => {
    if (!href) return false;
    return pathname === href || (href !== '/' && pathname.startsWith(href));
  };

  return (
    <div 
      className={`${isOpen ? 'w-56' : 'w-16'} transition-all duration-300 shadow-sm`}
      style={{ 
        backgroundColor: 'white',
        borderRight: '1px solid #E2E8F0'
      }}
    >
      {/* Header */}
      <div 
        className="p-4"
        style={{ borderBottom: '1px solid #E2E8F0' }}
      >
        <div className="flex items-center justify-between">
          {isOpen && (
            <h1 
              className="text-xl font-semibold"
              style={{ color: '#020617' }}
            >
              ERP Nexus
            </h1>
          )}
          <button 
            onClick={onToggle} 
            className="p-2 rounded-lg transition-colors hover:bg-slate-100"
          >
            <Menu size={20} style={{ color: '#64748B' }} />
          </button>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="p-4 space-y-2">
        {items.map((item, index) => {
          const isActive = isActiveItem(item.href);
          
          return (
            <Link 
              key={index} 
              href={item.href || '#'} 
              className={`flex items-center rounded-lg transition-all duration-300 ${
                isActive 
                  ? 'border-r-2' 
                  : 'hover:bg-slate-50'
              } ${isOpen ? 'p-3' : 'p-4 mx-1'}`}
              style={{
                backgroundColor: isActive ? '#EFF6FF' : 'transparent',
                color: isActive ? '#2563EB' : '#64748B',
                borderRightColor: isActive ? '#2563EB' : 'transparent',
                ...(isOpen && { paddingLeft: '12px', paddingRight: '12px' }),
                ...(!isOpen && { 
                  justifyContent: 'center',
                  minHeight: '48px',
                  width: '48px',
                  marginLeft: 'auto',
                  marginRight: 'auto'
                })
              }}
            >
              <item.icon 
                size={isOpen ? 20 : 36} 
                style={{ 
                  color: isActive ? '#2563EB' : '#64748B',
                  marginRight: isOpen ? '12px' : '0'
                }} 
              />
              {isOpen && (
                <span 
                  className="font-medium"
                  style={{ color: isActive ? '#2563EB' : '#334155' }}
                >
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;