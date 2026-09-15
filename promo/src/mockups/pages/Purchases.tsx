import { useState } from 'react'
import type { Page } from '../App'
import PageHeader from '../components/PageHeader'

interface Props {
  navigate: (p: Page) => void
}

interface Order {
  no: string
  supplier: string
  total: string
  status: string
  date: string
  statusColor: string
  editable?: boolean
  isNew?: boolean
}

const initialOrders: Order[] = [
  { no: 'PO-1#', supplier: 'مؤسسة التجارة الشمالية', total: '2,000.00 SAR', status: 'تم الاستلام', date: '#1', statusColor: 'bg-green-100 text-green-700' },
  { no: 'PO-1#', supplier: 'مؤسسة التجارة الشمالية', total: '2,000.00 SAR', status: 'تم الاستلام', date: '#1', statusColor: 'bg-green-100 text-green-700' },
  { no: 'PO-1#', supplier: 'مؤسسة التجارة الشمالية', total: '2,000.00 SAR', status: 'موزع منتوج', date: '#1', statusColor: 'bg-blue-100 text-blue-700' },
  { no: 'PO-1#', supplier: 'محمد منتوج', total: '200.00 SAR', status: 'تم الاستلام', date: '#1', statusColor: 'bg-green-100 text-green-700', editable: true },
  { no: 'PO-1#', supplier: 'محمد منتوج', total: '100.00 SAR', status: 'تم الاستلام', date: '#1', statusColor: 'bg-green-100 text-green-700', editable: true },
  { no: 'PO-1#', supplier: 'Albasam', total: '100.00 SAR', status: 'تم الاستلام', date: '#1', statusColor: 'bg-green-100 text-green-700' },
]

export default function Purchases({ navigate: _navigate }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)

  const addDemoOrder = () => {
    const order: Order = {
      no: `PO-${orders.length + 2}#`,
      supplier: 'مؤسسة الرياض للتوريد',
      total: '3,450.00 SAR',
      status: 'قيد التجهيز',
      date: '#1',
      statusColor: 'bg-yellow-100 text-yellow-700',
      isNew: true,
    }
    setOrders((prev) => [order, ...prev])
    setTimeout(() => {
      setOrders((prev) => prev.map((o) => (o === order ? { ...o, isNew: false } : o)))
    }, 2600)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="إدارة المشتريات والتوريد" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <button id="btn-new-po" onClick={addDemoOrder} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1">
            <span>+</span> إنشاء طلب توريد
          </button>
          <div className="text-right">
            <h2 className="text-sm font-bold text-gray-800">سجل التوريدات</h2>
            <p className="text-[11px] text-gray-500">هذه قائمة طلبات التوريد وإمكانية إضافة والبحث عن الموردين</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-blue-800 text-white">
                <th className="px-4 py-3 text-right font-semibold">الإجراءات</th>
                <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
                <th className="px-4 py-3 text-right font-semibold">الحالة</th>
                <th className="px-4 py-3 text-right font-semibold">الإجمالي</th>
                <th className="px-4 py-3 text-right font-semibold">المورد</th>
                <th className="px-4 py-3 text-right font-semibold">رقم الطلب</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, i) => (
                <tr key={i} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors duration-1000 ${order.isNew ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <button className="bg-blue-50 text-blue-600 hover:bg-blue-100 text-[11px] font-semibold px-2 py-0.5 rounded transition-colors">تفصيل</button>
                      {order.editable && (
                        <>
                          <button className="text-green-600 hover:text-green-800 text-[11px] bg-green-50 px-1.5 py-0.5 rounded">تعديل</button>
                          <button className="text-red-500 hover:text-red-700">🗑</button>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-[11px]">
                    {order.date && <span className="text-gray-400">#{i + 1}</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${order.statusColor}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-gray-800">{order.total}</td>
                  <td className="px-4 py-2.5 text-gray-700 font-medium">{order.supplier}</td>
                  <td className="px-4 py-2.5 text-blue-600 font-semibold">{order.no}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
