import type { ReactNode } from 'react'
import type { Page } from '../App'
import Sidebar from './Sidebar'

interface Props {
  page: Page
  navigate: (p: Page) => void
  children: ReactNode
}

const POS_PAGES: Page[] = ['pos', 'quick-invoice']

export default function Layout({ page, navigate, children }: Props) {
  const posMode = POS_PAGES.includes(page)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#1e1b4b]" style={{ direction: 'rtl', transformStyle: 'preserve-3d' }}>
      {/* Window title bar */}
      <div className="flex items-center bg-[#1e1b4b] h-7 flex-shrink-0" style={{ direction: 'ltr', transform: 'translateZ(5px)' }}>
        <div className="flex-1 flex items-center px-3 gap-2">
          <div className="w-4 h-4 bg-indigo-800 rounded-sm flex items-center justify-center">
            <span className="text-white text-[8px] font-bold">B</span>
          </div>
          <span className="text-gray-300 text-xs">البصمة الذكية</span>
        </div>
        <div className="flex items-center h-full">
          <button className="h-full px-3.5 text-gray-400 hover:bg-[#374151] text-[11px] transition-colors">─</button>
          <button className="h-full px-3.5 text-gray-400 hover:bg-[#374151] text-[11px] transition-colors">□</button>
          <button className="h-full px-3.5 text-gray-400 hover:bg-red-600 hover:text-white text-xs transition-colors">✕</button>
        </div>
      </div>

      {/* Menu bar */}
      <div className="flex items-center bg-[#111827] h-6 flex-shrink-0" style={{ direction: 'ltr', transform: 'translateZ(5px)' }}>
        <div className="flex items-center px-3 gap-4 text-gray-400 text-[11px]">
          {['File', 'Edit', 'View', 'Window', 'Help'].map((m) => (
            <span key={m} className="cursor-pointer hover:text-gray-200 transition-colors">{m}</span>
          ))}
        </div>
      </div>

      {/* App body */}
      <div className="flex flex-1 overflow-hidden bg-[#f1f5f9]" style={{ transformStyle: 'preserve-3d' }}>
        {/* Sidebar first = appears on RIGHT in RTL */}
        <div style={{ transform: 'translateZ(20px)', transformStyle: 'preserve-3d' }}>
          <Sidebar page={page} navigate={navigate} posMode={posMode} />
        </div>
        {/* Main content */}
        <div className="flex-1 overflow-hidden flex flex-col" style={{ transformStyle: 'preserve-3d' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
