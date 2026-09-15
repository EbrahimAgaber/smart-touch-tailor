import type { ReactNode } from 'react'

interface Props {
  title: string
  rightContent?: ReactNode
}

export default function PageHeader({ title, rightContent }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
      {/* Left side: time + branch info */}
      <div className="flex items-center gap-2 text-[11px] text-gray-500" style={{ direction: 'ltr' }}>
        <span className="font-medium text-gray-600">السبت، ١١ ص</span>
        <span className="text-gray-300">|</span>
        <span className="flex items-center gap-1">
          <span className="text-gray-400 cursor-pointer">×</span>
          <span>الفرع الرئيسي</span>
        </span>
        <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200 text-[10px]">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
          <span>مرتبط بالزكاة</span>
        </span>
      </div>

      {/* Right side: title + optional right content */}
      <div className="flex items-center gap-3">
        {rightContent}
        <h1 className="text-base font-bold text-gray-800">{title}</h1>
      </div>
    </div>
  )
}
