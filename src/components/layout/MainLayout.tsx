import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { DetailPanel } from './DetailPanel';
import { AIInputBar } from '../ai/AIInputBar';
import { useTheme } from '../../hooks/useTheme';
import { Contact, Company, Task } from '../../types';

interface MainLayoutProps {
  children: React.ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
  selectedItem?: Contact | Company | Task | null;
  onCloseDetail?: () => void;
}

export function MainLayout({ children, currentView, onViewChange, selectedItem, onCloseDetail }: MainLayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const [aiExpanded, setAiExpanded] = useState(false);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: 'var(--color-bg-primary)', overflow: 'hidden' }}>
      <Sidebar 
        currentView={currentView} 
        onViewChange={onViewChange}
        theme={theme}
        onThemeToggle={toggleTheme}
      />
      
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
        
        <AIInputBar expanded={aiExpanded} onToggleExpand={() => setAiExpanded(!aiExpanded)} />
      </main>

      <AnimatePresence>
        {selectedItem && (
          <DetailPanel item={selectedItem} onClose={onCloseDetail || (() => {})} />
        )}
      </AnimatePresence>
    </div>
  );
}
