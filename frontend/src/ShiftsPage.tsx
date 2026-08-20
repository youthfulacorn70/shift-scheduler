// ShiftsPage.tsx
import { apiFetch } from './api'
import { useState, useEffect } from 'react'
import { Repeat } from 'lucide-react'
import { useTranslation } from './i18n'

interface Shift {
  id: number
  day: string
  start_time: string
  end_time: string
  role_id: number | null
  role_name: string | null
  template_id?: number | null
}

interface Role {
  id: number
  name: string
}

const DAY_KEYS: Record<string, string> = {
  'Monday': 'day.monday',
  'Tuesday': 'day.tuesday',
  'Wednesday': 'day.wednesday',
  'Thursday': 'day.thursday',
  'Friday': 'day.friday',
  'Saturday': 'day.saturday',
  'Sunday': 'day.sunday',
}

const ROLE_KEYS: Record<string, string> = {
  'Server': 'role.server',
  'Host': 'role.host',
  'Cook': 'role.cook',
  'Cashier': 'role.cashier',
  'Shelf Restocker': 'role.shelfRestocker',
  'Cleaner': 'role.cleaner',
}

function TimeSelect({ value, onChange, input }: { value: string, onChange: (v: string) => void, input: string }) {
  const parts = value ? value.split(':') : []
  const h = parts[0] || '09'
  const m = parts[1] || '00'
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutes = ['00', '15', '30', '45']
  return (
    <div className="flex gap-1 items-center">
      <select
        className={`border rounded-lg px-2 py-2 text-sm outline-none ${input}`}
        value={h}
        onChange={e => onChange(`${e.target.value}:${m}`)}
      >
        {hours.map(hh => <option key={hh} value={hh}>{hh}</option>)}
      </select>
      <span className="text-sm">:</span>
      <select
        className={`border rounded-lg px-2 py-2 text-sm outline-none ${input}`}
        value={m}
        onChange={e => onChange(`${h}:${e.target.value}`)}
      >
        {minutes.map(mm => <option key={mm} value={mm}>{mm}</option>)}
      </select>
    </div>
  )
}

function ShiftsPage({ theme = 'light', active = true }: { theme?: string, active?: boolean }) {
  const { t } = useTranslation()
  const roleLabel = (role: string) => t(ROLE_KEYS[role] || role)
  const dayLabel = (day: string) => t(DAY_KEYS[day] || day)

  const [shifts, setShifts] = useState<Shift[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [day, setDay] = useState(new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [roleId, setRoleId] = useState<number | null>(null)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [deletingShift, setDeletingShift] = useState<Shift | null>(null)
  const [deleteAssignedTo, setDeleteAssignedTo] = useState<string | null>(null)
  const [_templates, setTemplates] = useState<{id: number, day_name: string, start_time: string, end_time: string, role_id: number | null, role_name: string | null, active: boolean}[]>([])
  const [showRecurringModal, setShowRecurringModal] = useState(false)
  const [recurringDay, setRecurringDay] = useState('Monday')
  const [recurringStart, setRecurringStart] = useState('')
  const [recurringEnd, setRecurringEnd] = useState('')
  const [recurringRoleId, setRecurringRoleId] = useState<number | null>(null)
  const [recurringError, setRecurringError] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'templates'>('all')
  const [recurringQuantity, setRecurringQuantity] = useState(1)

  useEffect(() => {
    apiFetch(`/shifts`)
      .then(res => res.json())
      .then(data => setShifts(data))
    apiFetch(`/shift-templates`)
      .then(res => res.json())
      .then(data => setTemplates(data))
  }, [])

  useEffect(() => {
    if (!active) return
    apiFetch(`/roles`)
      .then(res => res.json())
      .then(data => setRoles(data))
  }, [active])

  const formatTime = (time: string) => {
    const parts = time.split(':')
    const hours = parts[0].padStart(2, '0')
    const minutes = parts[1].padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const createRecurringShift = () => {
  setRecurringError('')
  apiFetch(`/shift-templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      day_name: recurringDay,
      start_time: recurringStart,
      end_time: recurringEnd,
      role_id: recurringRoleId,
      quantity: recurringQuantity
    })
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        setRecurringError(data.error)
        return
      }
      apiFetch(`/shift-templates`).then(res => res.json()).then(setTemplates)
      apiFetch(`/shifts`).then(res => res.json()).then(setShifts)
      setShowRecurringModal(false)
      setRecurringStart('')
      setRecurringEnd('')
      setRecurringRoleId(null)
      setRecurringQuantity(1)
    })
}

  const addShift = () => {
    apiFetch(`/shifts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day, start_time: startTime, end_time: endTime, role_id: roleId })
    })
      .then(res => res.json())
      .then(newShift => {
        setShifts([...shifts, newShift])
        setStartTime('')
        setEndTime('')
        setRoleId(null)
      })
  }

  const saveEdit = () => {
    if (!editingShift) return
    apiFetch(`/shifts/${editingShift.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        day: editingShift.day,
        start_time: editingShift.start_time,
        end_time: editingShift.end_time,
        role_id: editingShift.role_id
      })
    }).then(() => {
      const roleName = editingShift.role_id
        ? roles.find(r => r.id === editingShift.role_id)?.name ?? null
        : null
      setShifts(shifts.map(s => s.id === editingShift.id
        ? { ...editingShift, role_name: roleName }
        : s
      ))
      setEditingShift(null)
    })
  }

  const handleDeleteClick = (shift: Shift) => {
    apiFetch(`/shifts/${shift.id}/assignment`)
      .then(res => res.json())
      .then(data => {
        setDeleteAssignedTo(data.employee)
        setDeletingShift(shift)
      })
  }

  const confirmDelete = () => {
    if (!deletingShift) return
    apiFetch(`/shifts/${deletingShift.id}`, { method: 'DELETE' })
      .then(() => {
        setShifts(shifts.filter(s => s.id !== deletingShift.id))
        setEditingShift(null)
        setDeletingShift(null)
        setDeleteAssignedTo(null)
      })
  }

  const card = theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
  const text = theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
  const subtext = theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  const input = theme === 'dark'
    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
    : 'bg-white border-gray-200 text-gray-900'
  const divider = theme === 'dark' ? 'border-gray-700' : 'border-gray-100'

  return (
    <div className={text}>
      <h1 className="text-2xl font-bold mb-4">{t('shifts.title')}</h1>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'all'
              ? 'bg-indigo-600 text-white'
              : theme === 'dark' ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          {t('shifts.allShifts')}
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'templates'
              ? 'bg-indigo-600 text-white'
              : theme === 'dark' ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          {t('shifts.recurringTemplates')}
        </button>
      </div>

      {deletingShift && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className={`${card} rounded-lg shadow-lg p-6 max-w-sm w-full`}>
            <p className={`font-semibold mb-2 ${text}`}>{t('shifts.deleteConfirm')}</p>
            <p className={`text-sm mb-3 ${subtext}`}>
              {deletingShift.day} · {formatTime(deletingShift.start_time)} - {formatTime(deletingShift.end_time)}
            </p>
            {deleteAssignedTo ? (
              <div className="bg-orange-50 border border-orange-200 rounded p-3 mb-4 text-sm">
                <p className="text-orange-700 font-semibold">⚠️ {t('shifts.assignedTo')} {deleteAssignedTo}</p>
                <p className="text-orange-500 text-xs mt-1">{t('shifts.deleteWillRemove')}</p>
              </div>
            ) : (
              <p className={`text-sm mb-4 ${subtext}`}>{t('shifts.notAssigned')}</p>
            )}
            <div className="flex gap-3">
              <button onClick={confirmDelete} className="bg-red-500 text-white px-4 py-2 rounded-lg">{t('shifts.delete')}</button>
              <button
                onClick={() => { setDeletingShift(null); setDeleteAssignedTo(null) }}
                className={`px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}
              >
                {t('shifts.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`${card} p-4 rounded-lg shadow mb-6`}>
        <h2 className={`text-lg font-semibold mb-3 ${text}`}>{t('shifts.addShift')}</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="date"
            className={`border rounded-lg px-3 py-2 text-sm outline-none ${input}`}
            value={day}
            onChange={e => setDay(e.target.value)}
          />
          <TimeSelect
            value={startTime}
            onChange={v => setStartTime(v + ':00')}
            input={input}
          />
          <TimeSelect
            value={endTime}
            onChange={v => setEndTime(v + ':00')}
            input={input}
          />
          <select
            className={`border rounded-lg px-3 py-2 text-sm outline-none ${input}`}
            value={roleId ?? ''}
            onChange={e => setRoleId(e.target.value ? parseInt(e.target.value) : null)}
          >
            <option value="">{t('shifts.anyRole')}</option>
            {roles.map(r => (
              <option key={r.id} value={r.id}>{roleLabel(r.name)}</option>
            ))}
          </select>
          <button onClick={addShift} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
            {t('shifts.add')}
          </button>
        </div>
      </div>

<div className="mb-6">
  <button
    onClick={() => setShowRecurringModal(true)}
    className={`px-4 py-2 rounded-lg text-sm border transition-colors ${theme === 'dark' ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
  >
    {t('shifts.addRecurringShift')}
  </button>
</div>

{showRecurringModal && (
  <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
    <div className={`${card} rounded-lg shadow-lg p-6 max-w-sm w-full`}>
      <p className={`font-semibold mb-3 ${text}`}>{t('shifts.addRecurringShiftTitle')}</p>

      <label className={`text-xs mb-1 block ${subtext}`}>{t('shifts.dayOfWeek')}</label>
      <select
        className={`border rounded-lg px-3 py-2 text-sm outline-none w-full mb-3 ${input}`}
        value={recurringDay}
        onChange={e => setRecurringDay(e.target.value)}
      >
        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
          <option key={d} value={d}>{dayLabel(d)}</option>
        ))}
      </select>

      <div className="flex gap-2 mb-3">
        <div className="flex-1">
          <label className={`text-xs mb-1 block ${subtext}`}>{t('shifts.startTime')}</label>
          <TimeSelect
            value={recurringStart.slice(0, 5)}
            onChange={v => setRecurringStart(v + ':00')}
            input={input}
          />
        </div>
        <div className="flex-1">
          <label className={`text-xs mb-1 block ${subtext}`}>{t('shifts.endTime')}</label>
          <TimeSelect
            value={recurringEnd.slice(0, 5)}
            onChange={v => setRecurringEnd(v + ':00')}
            input={input}
          />
        </div>
      </div>

      <label className={`text-xs mb-1 block ${subtext}`}>{t('shifts.role')}</label>
      <select
        className={`border rounded-lg px-3 py-2 text-sm outline-none w-full mb-4 ${input}`}
        value={recurringRoleId ?? ''}
        onChange={e => setRecurringRoleId(e.target.value ? parseInt(e.target.value) : null)}
      >
        <option value="">{t('shifts.anyRole')}</option>
        {roles.map(r => (
          <option key={r.id} value={r.id}>{roleLabel(r.name)}</option>
        ))}
      </select>

      <label className={`text-xs mb-1 block ${subtext}`}>How many people?</label>
      <input
        type="number"
        min={1}
        max={20}
        className={`border rounded-lg px-3 py-2 text-sm outline-none w-full mb-4 ${input}`}
        value={recurringQuantity}
        onChange={e => setRecurringQuantity(Math.max(1, parseInt(e.target.value) || 1))}
      />

      {recurringError && <p className="text-red-500 text-sm mb-3">{recurringError}</p>}

      <div className="flex gap-3">
        <button onClick={createRecurringShift} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
          {t('shifts.create')}
        </button>
        <button
          onClick={() => { setShowRecurringModal(false); setRecurringError(''); setRecurringQuantity(1) }}
          className={`px-4 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}
        >
          {t('shifts.cancel')}
        </button>
      </div>
    </div>
  </div>
)}

      {activeTab === 'all' && (
        <>
          <div className="mb-6">
            <h2 className={`text-xs font-semibold mb-2 uppercase tracking-widest ${subtext}`}>{t('shifts.recurringShiftsSection')}</h2>
            <div className={`${card} rounded-lg shadow`}>
              {shifts.filter(s => s.template_id).length === 0 && (
                <p className={`p-4 text-sm ${subtext}`}>{t('shifts.noRecurring')}</p>
              )}
              {shifts.filter(s => s.template_id).map(shift => (
                <div key={shift.id} className={`p-4 border-b ${divider}`}>
                  {editingShift?.id === shift.id ? (
                    <div className="flex gap-2 items-center flex-wrap">
                      <input
                        type="date"
                        className={`border rounded-lg px-3 py-2 text-sm outline-none ${input}`}
                        value={editingShift.day}
                        onChange={e => setEditingShift({...editingShift, day: e.target.value})}
                      />
                      <TimeSelect
                        value={editingShift.start_time.slice(0, 5)}
                        onChange={v => setEditingShift({...editingShift, start_time: v + ':00'})}
                        input={input}
                      />
                      <TimeSelect
                        value={editingShift.end_time.slice(0, 5)}
                        onChange={v => setEditingShift({...editingShift, end_time: v + ':00'})}
                        input={input}
                      />
                      <select
                        className={`border rounded-lg px-3 py-2 text-sm outline-none ${input}`}
                        value={editingShift.role_id ?? ''}
                        onChange={e => setEditingShift({...editingShift, role_id: e.target.value ? parseInt(e.target.value) : null})}
                      >
                        <option value="">{t('shifts.anyRole')}</option>
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{roleLabel(r.name)}</option>
                        ))}
                      </select>
                      <button onClick={saveEdit} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm">{t('shifts.save')}</button>
                      <button onClick={() => setEditingShift(null)} className={`px-3 py-1.5 rounded-lg text-sm ${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}>{t('shifts.cancel')}</button>
                      <button onClick={() => handleDeleteClick(editingShift)} className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm">{t('shifts.delete')}</button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${text}`}>{shift.day}</span>
                      <span className={subtext}>{formatTime(shift.start_time)} - {formatTime(shift.end_time)}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-indigo-500 text-sm font-medium">{shift.role_name ? roleLabel(shift.role_name) : t('shifts.any')}</span>
                        <Repeat size={13} strokeWidth={2} className="text-indigo-400" />
                      </div>
                      <button onClick={() => setEditingShift(shift)} className={`text-sm ${theme === 'dark' ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                        {t('shifts.edit')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className={`text-xs font-semibold mb-2 uppercase tracking-widest ${subtext}`}>{t('shifts.oneTimeShiftsSection')}</h2>
            <div className={`${card} rounded-lg shadow`}>
              {shifts.filter(s => !s.template_id).length === 0 && (
                <p className={`p-4 text-sm ${subtext}`}>{t('shifts.noOneTime')}</p>
              )}
              {shifts.filter(s => !s.template_id).map(shift => (
                <div key={shift.id} className={`p-4 border-b ${divider}`}>
                  {editingShift?.id === shift.id ? (
                    <div className="flex gap-2 items-center flex-wrap">
                      <input
                        type="date"
                        className={`border rounded-lg px-3 py-2 text-sm outline-none ${input}`}
                        value={editingShift.day}
                        onChange={e => setEditingShift({...editingShift, day: e.target.value})}
                      />
                      <TimeSelect
                        value={editingShift.start_time.slice(0, 5)}
                        onChange={v => setEditingShift({...editingShift, start_time: v + ':00'})}
                        input={input}
                      />
                      <TimeSelect
                        value={editingShift.end_time.slice(0, 5)}
                        onChange={v => setEditingShift({...editingShift, end_time: v + ':00'})}
                        input={input}
                      />
                      <select
                        className={`border rounded-lg px-3 py-2 text-sm outline-none ${input}`}
                        value={editingShift.role_id ?? ''}
                        onChange={e => setEditingShift({...editingShift, role_id: e.target.value ? parseInt(e.target.value) : null})}
                      >
                        <option value="">{t('shifts.anyRole')}</option>
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{roleLabel(r.name)}</option>
                        ))}
                      </select>
                      <button onClick={saveEdit} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm">{t('shifts.save')}</button>
                      <button onClick={() => setEditingShift(null)} className={`px-3 py-1.5 rounded-lg text-sm ${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}>{t('shifts.cancel')}</button>
                      <button onClick={() => handleDeleteClick(editingShift)} className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm">{t('shifts.delete')}</button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${text}`}>{shift.day}</span>
                      <span className={subtext}>{formatTime(shift.start_time)} - {formatTime(shift.end_time)}</span>
                      <span className="text-indigo-500 text-sm font-medium">{shift.role_name ? roleLabel(shift.role_name) : t('shifts.any')}</span>
                      <button onClick={() => setEditingShift(shift)} className={`text-sm ${theme === 'dark' ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                        {t('shifts.edit')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'templates' && (
        <div className={`${card} rounded-lg shadow p-4`}>
          <p className={subtext}>{t('shifts.templatesComingNext')}</p>
        </div>
      )}
    </div>
  )
}

export default ShiftsPage