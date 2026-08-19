// SchedulePage.tsx
import { apiFetch } from './api'
import { useState, useEffect } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { useTranslation } from './i18n'

interface ScheduleEntry {
  id: number
  employee: string
  day: string
  start_time: string
  end_time: string
  role_name?: string
}

interface UnassignedShift {
  shift_id: number
  day: string
  start_time: string
  end_time: string
  required_role: string | null
  potential_substitutes: { id: number, name: string, role_match: boolean }[]
}

interface AssignedEntry {
  id: number
  employee: string
  day: string
  start_time: string
  end_time: string
}

interface DayShift {
  shift_id: number
  start_time: string
  end_time: string
  role: string | null
  assigned_employee: string | null
  schedule_id: number | null
  assigned_employee_id: number | null
}

interface AvailableEmployee {
  id: number
  name: string
  roles: string[]
  available: boolean
}

interface DayOverview {
  shifts: DayShift[]
  available_employees: AvailableEmployee[]
}

const ROLE_KEYS: Record<string, string> = {
  'Server': 'role.server',
  'Host': 'role.host',
  'Cook': 'role.cook',
  'Cashier': 'role.cashier',
  'Shelf Restocker': 'role.shelfRestocker',
  'Cleaner': 'role.cleaner',
}

function SchedulePage({ theme = 'light', active = true }: { theme?: string, active?: boolean }) {
  const { t } = useTranslation()
  const roleLabel = (role: string) => t(ROLE_KEYS[role] || role)
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [unassignedShifts, setUnassignedShifts] = useState<UnassignedShift[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => getMonday(new Date()))
  const [assigningShift, setAssigningShift] = useState<UnassignedShift | null>(null)
  const [confirmMismatch, setConfirmMismatch] = useState<{ shiftId: number, employeeId: number, employeeName: string } | null>(null)
  const [unassigningEntry, setUnassigningEntry] = useState<AssignedEntry | null>(null)
  const [conflictIds, setConflictIds] = useState<number[]>([])

  const [editingDay, setEditingDay] = useState<string | null>(null)
  const [dayOverview, setDayOverview] = useState<DayOverview | null>(null)
  const [selectedDayShift, setSelectedDayShift] = useState<DayShift | null>(null)
  const [staffSearch, setStaffSearch] = useState('')
  const [confirmReassign, setConfirmReassign] = useState<{shift: DayShift, employee: AvailableEmployee, otherShift?: DayShift} | null>(null)

  function getMonday(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  function toDateString(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function addDays(date: Date, n: number): Date {
    const d = new Date(date)
    d.setDate(d.getDate() + n)
    return d
  }

  function formatDayHeader(date: Date): string {
    return date.toLocaleDateString('en-CA', { weekday: 'short', day: 'numeric' })
  }

  function formatWeekLabel(monday: Date): string {
    const sunday = addDays(monday, 6)
    const start = monday.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
    const end = sunday.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${start} – ${end}`
  }

  const fetchUnassigned = (start: string, end: string) => {
    apiFetch(`/schedule/unassigned?start_date=${start}&end_date=${end}`)
      .then(res => res.json())
      .then(data => setUnassignedShifts(data))
  }

  const fetchSchedule = () => {
    apiFetch(`/schedule`)
      .then(res => res.json())
      .then(data => setSchedule(data))
  }

  const fetchConflicts = () => {
    apiFetch(`/schedule/conflicts`)
      .then(res => res.json())
      .then(data => setConflictIds(data.conflict_ids))
  }

  const weeksToShow = [selectedWeekStart, addDays(selectedWeekStart, 7)]

useEffect(() => {
  if (!active) return
  const start = toDateString(selectedWeekStart)
  const end = toDateString(addDays(selectedWeekStart, 13))
  fetchSchedule()
  fetchUnassigned(start, end)
  fetchConflicts()
}, [selectedWeekStart, active])

  const openEditDay = (dateStr: string) => {
    setEditingDay(dateStr)
    setSelectedDayShift(null)
    setStaffSearch('')
    apiFetch(`/schedule/day?date=${dateStr}`)
      .then(res => res.json())
      .then(data => setDayOverview(data))
  }

  const closeEditDay = () => {
    setEditingDay(null)
    setDayOverview(null)
    setSelectedDayShift(null)
    setStaffSearch('')
    setConfirmReassign(null)
  }

  const handleAssignInDay = (shift: DayShift, employee: AvailableEmployee) => {
  const roleWarning = shift.role && !employee.roles.includes(shift.role)
  const availabilityWarning = !employee.available

  const otherShift = dayOverview?.shifts.find(
    s => s.shift_id !== shift.shift_id && s.assigned_employee_id === employee.id
  )

  if (shift.assigned_employee || roleWarning || availabilityWarning || otherShift) {
    setConfirmReassign({ shift, employee, otherShift })
    return
  }
  doAssignInDay(shift, employee)
}

  const doAssignInDay = (shift: DayShift, employee: AvailableEmployee) => {
    apiFetch(`/schedule/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shift_id: shift.shift_id, employee_id: employee.id })
    }).then(() => {
      openEditDay(editingDay!)
      fetchSchedule()
      fetchConflicts()
      const start = toDateString(selectedWeekStart)
      const end = toDateString(addDays(selectedWeekStart, 6))
      fetchUnassigned(start, end)
      setConfirmReassign(null)
      setSelectedDayShift(null)
    })
  }

  const handleUnassignInDay = (shift: DayShift) => {
    if (!shift.schedule_id) return
    apiFetch(`/schedule/${shift.schedule_id}`, { method: 'DELETE' })
      .then(() => {
        openEditDay(editingDay!)
        fetchSchedule()
        fetchConflicts()
        const start = toDateString(selectedWeekStart)
        const end = toDateString(addDays(selectedWeekStart, 6))
        fetchUnassigned(start, end)
      })
  }

  const handleGenerateClick = () => {
    const start = toDateString(selectedWeekStart)
    const end = toDateString(addDays(selectedWeekStart, 13))
    apiFetch(`/schedule/check?start_date=${start}&end_date=${end}`)
      .then(res => res.json())
      .then(data => {
        if (data.has_schedule) setConfirmOpen(true)
        else generateSchedule()
      })
  }

  const generateSchedule = () => {
    const start = toDateString(selectedWeekStart)
    const end = toDateString(addDays(selectedWeekStart, 13))
    apiFetch(`/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_date: start, end_date: end })
    })
      .then(res => res.json())
      .then(() => apiFetch(`/schedule`))
      .then(res => res.json())
      .then(data => {
        setSchedule(data)
        setConfirmOpen(false)
        fetchUnassigned(start, end)
        fetchConflicts()
      })
  }

  const assignShift = (shiftId: number, employeeId: number) => {
    apiFetch(`/schedule/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shift_id: shiftId, employee_id: employeeId })
    }).then(() => {
      const start = toDateString(selectedWeekStart)
      const end = toDateString(addDays(selectedWeekStart, 6))
      fetchSchedule()
      fetchConflicts()
      fetchUnassigned(start, end)
      setAssigningShift(null)
    })
  }

  const unassignShift = (scheduleId: number) => {
    apiFetch(`/schedule/${scheduleId}`, { method: 'DELETE' })
      .then(() => {
        const start = toDateString(selectedWeekStart)
        const end = toDateString(addDays(selectedWeekStart, 6))
        fetchSchedule()
        fetchConflicts()
        fetchUnassigned(start, end)
        setUnassigningEntry(null)
      })
  }

  const getEntriesForDay = (date: Date): ScheduleEntry[] => {
    const dateStr = toDateString(date)
    return schedule.filter(entry => entry.day === dateStr)
  }

  const getUnassignedForDay = (date: Date): UnassignedShift[] => {
    const dateStr = toDateString(date)
    return unassignedShifts.filter(s => s.day === dateStr)
  }

  const hasShiftsInRange = Array.from({ length: 14 }, (_, i) => addDays(selectedWeekStart, i))
    .some(day => getEntriesForDay(day).length > 0 || getUnassignedForDay(day).length > 0)

  const filteredStaff = dayOverview?.available_employees.filter(e =>
    e.name.toLowerCase().includes(staffSearch.toLowerCase())
  ) ?? []

  const card = theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
  const text = theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
  const subtext = theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  const popupCard = theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
  const btnBorder = theme === 'dark' ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
  const panelBg = theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
  const shiftRow = theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-100'

  return (
    <div className={text}>
      <h1 className="text-2xl font-bold mb-4">{t('schedule.title')}</h1>

      <div className={`${card} p-4 rounded-lg shadow mb-6 flex items-center gap-4 flex-wrap`}>
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedWeekStart(addDays(selectedWeekStart, -7))} className={`border px-3 py-2 rounded-lg text-sm transition-colors ${btnBorder}`}></button>
          <span className={`font-medium w-52 text-center text-sm ${text}`}>{formatWeekLabel(selectedWeekStart)}</span>
          <button onClick={() => setSelectedWeekStart(addDays(selectedWeekStart, 7))} className={`border px-3 py-2 rounded-lg text-sm transition-colors ${btnBorder}`}></button>
          {toDateString(selectedWeekStart) !== toDateString(getMonday(new Date())) && (
            <button onClick={() => setSelectedWeekStart(getMonday(new Date()))} className={`border px-3 py-2 rounded-lg text-sm transition-colors ${btnBorder}`}>{t('schedule.today')}</button>
          )}
        </div>
        <button onClick={handleGenerateClick} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          {t('schedule.generate')}
        </button>
      </div>

      {!hasShiftsInRange && (
        <div className={`${card} p-3 rounded-lg mb-6 text-sm ${subtext}`}>
          {t('schedule.noShiftsThisWeek')}
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className={`${popupCard} rounded-lg shadow-lg p-6 max-w-sm w-full`}>
            <p className={`font-semibold mb-2 ${text}`}>{t('schedule.alreadyHasSchedule')}</p>
            <p className={`text-sm mb-4 ${subtext}`}>{t('schedule.regenerateConfirm')}</p>
            <div className="flex gap-3">
              <button onClick={generateSchedule} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">{t('schedule.yesRegenerate')}</button>
              <button onClick={() => setConfirmOpen(false)} className={`px-4 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}>{t('schedule.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {assigningShift && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className={`${popupCard} rounded-lg shadow-lg p-6 max-w-sm w-full`}>
            <p className={`font-semibold mb-1 ${text}`}>{t('schedule.assignShift')}</p>
            <p className={`text-sm mb-4 ${subtext}`}>
              {assigningShift.day} · {assigningShift.start_time.slice(0,5)} – {assigningShift.end_time.slice(0,5)}
              {assigningShift.required_role && ` · ${assigningShift.required_role}`}
            </p>
            {assigningShift.potential_substitutes.length === 0 ? (
              <p className={`text-sm mb-4 ${subtext}`}>{t('schedule.noEligible')}</p>
            ) : (
              <div className="mb-4 flex flex-col gap-2">
                {assigningShift.potential_substitutes.filter(e => e.role_match).map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => assignShift(assigningShift.shift_id, emp.id)}
                    className={`w-full text-left px-4 py-2 rounded-lg border text-sm transition-colors ${theme === 'dark' ? 'border-gray-600 text-gray-200 hover:bg-indigo-900' : 'border-gray-200 text-gray-700 hover:bg-indigo-50'}`}
                  >
                    {emp.name}
                  </button>
                ))}
                {assigningShift.potential_substitutes.some(e => !e.role_match) && (
                  <div className="mt-2">
                    <p className={`text-xs mb-2 ${subtext}`}>{t('schedule.noRoleMatchHeader')}</p>
                    {assigningShift.potential_substitutes.filter(e => !e.role_match).map(emp => (
                      <button
                        key={emp.id}
                        onClick={() => setConfirmMismatch({ shiftId: assigningShift.shift_id, employeeId: emp.id, employeeName: emp.name })}
                        className={`w-full text-left px-4 py-2 rounded-lg border border-dashed text-sm transition-colors mb-2 ${theme === 'dark' ? 'border-gray-600 text-gray-400 hover:bg-gray-700' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                      >
                        {emp.name} <span className="text-xs">({t('schedule.noRoleTag')})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button onClick={() => setAssigningShift(null)} className={`px-4 py-2 rounded-lg w-full text-sm ${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}>{t('schedule.cancel')}</button>
          </div>
        </div>
      )}

      {confirmMismatch && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className={`${popupCard} rounded-lg shadow-lg p-6 max-w-sm w-full`}>
            <p className={`font-semibold mb-2 ${text}`}>{t('schedule.roleMismatchTitle')}</p>
            <p className={`text-sm mb-4 ${subtext}`}>
              {confirmMismatch.employeeName} {t('schedule.roleMismatchBody')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  assignShift(confirmMismatch.shiftId, confirmMismatch.employeeId)
                  setConfirmMismatch(null)
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                {t('schedule.assignAnyway')}
              </button>
              <button
                onClick={() => setConfirmMismatch(null)}
                className={`px-4 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}
              >
                {t('schedule.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {unassigningEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className={`${popupCard} rounded-lg shadow-lg p-6 max-w-sm w-full`}>
            <p className={`font-semibold mb-1 ${text}`}>{t('schedule.removeAssignment')}</p>
            <p className={`text-sm mb-2 ${subtext}`}>
              {unassigningEntry.employee} · {unassigningEntry.day} · {unassigningEntry.start_time.slice(0,5)} – {unassigningEntry.end_time.slice(0,5)}
            </p>
            <p className={`text-sm mb-4 ${subtext}`}>{t('schedule.removeConfirm')}</p>
            <div className="flex gap-3">
              <button onClick={() => unassignShift(unassigningEntry.id)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">{t('schedule.remove')}</button>
              <button onClick={() => setUnassigningEntry(null)} className={`px-4 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}>{t('schedule.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {editingDay && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className={`${panelBg} border rounded-xl w-[640px] h-[560px] flex flex-col shadow-2xl`} style={{padding: '20px 24px'}}>

            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div>
                <span className={`text-lg font-semibold ${text}`}>
                  {new Date(editingDay + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
                <span className={`text-xs ml-2 ${subtext}`}>{dayOverview?.shifts.length ?? '—'} {t('schedule.shifts')}</span>
              </div>
              <button onClick={closeEditDay} className={`text-sm ${subtext} hover:${text} transition-colors`}><X size={16} strokeWidth={1.75} /></button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 mb-4">
              {!dayOverview && <p className={`text-sm ${subtext}`}>Loading...</p>}
              {dayOverview?.shifts.map(shift => {
                const isSelected = selectedDayShift?.shift_id === shift.shift_id
                const isUnassigned = !shift.assigned_employee
                return (
                  <div
                    key={shift.shift_id}
                    className={`rounded-lg px-3 py-2.5 border flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-indigo-500 ' + (theme === 'dark' ? 'bg-indigo-950' : 'bg-indigo-50')
                        : isUnassigned
                          ? theme === 'dark' ? 'bg-red-950 border-red-800' : 'bg-red-50 border-red-200'
                          : shiftRow
                    }`}
                    onClick={() => setSelectedDayShift(isSelected ? null : shift)}
                  >
                    <div>
                      <p className={`text-sm font-medium ${isUnassigned ? 'text-red-500' : text}`}>
                        {shift.start_time.slice(0,5)} – {shift.end_time.slice(0,5)}
                        {shift.role && <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>{roleLabel(shift.role)}</span>}
                      </p>
                      <p className={`text-xs mt-0.5 ${isUnassigned ? 'text-red-400' : subtext}`}>
                        {shift.assigned_employee ?? t('schedule.unassigned')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!isUnassigned && (
                        <button
                          onClick={e => { e.stopPropagation(); handleUnassignInDay(shift) }}
                          className="text-xs text-red-400 hover:text-red-500 transition-colors"
                        >
                          {t('schedule.remove')}
                        </button>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedDayShift(isSelected ? null : shift) }}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : btnBorder
                        }`}
                      >
                        {isSelected ? t('schedule.selected') : shift.assigned_employee ? t('schedule.change') : t('schedule.assign')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className={`border-t flex-shrink-0 pt-3 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`text-xs ${subtext}`}>
                  {selectedDayShift
                    ? `${t('schedule.availableStaff')} · ${filteredStaff.length}`
                    : t('schedule.selectShiftPrompt')}
                </p>
                {selectedDayShift && (
                  <input
                    type="text"
                    placeholder={t('schedule.searchStaff')}
                    value={staffSearch}
                    onChange={e => setStaffSearch(e.target.value)}
                    className={`text-xs border rounded-lg px-2.5 py-1.5 outline-none w-36 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900'}`}
                  />
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {selectedDayShift && filteredStaff.length === 0 && (
                  <p className={`text-xs ${subtext}`}>{t('schedule.noStaffFound')}</p>
                )}
                {selectedDayShift && filteredStaff.map(emp => {
                  const roleMatch = !selectedDayShift.role || emp.roles.includes(selectedDayShift.role)
                  return (
                    <button
                      key={emp.id}
                      onClick={() => handleAssignInDay(selectedDayShift, emp)}
                      className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                        !emp.available
                          ? theme === 'dark' ? 'border-gray-700 text-gray-500 hover:bg-gray-800' : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                          : roleMatch
                            ? theme === 'dark' ? 'border-gray-600 text-gray-200 hover:bg-indigo-900 hover:border-indigo-500' : 'border-gray-200 text-gray-700 hover:bg-indigo-50 hover:border-indigo-300'
                            : theme === 'dark' ? 'border-orange-800 text-orange-400 hover:bg-orange-950' : 'border-orange-200 text-orange-600 hover:bg-orange-50'
                      }`}
                      title={!emp.available ? t('schedule.markedUnavailable') : !roleMatch ? `⚠️ ${selectedDayShift.role}` : ''}
                    >
                      <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-xs flex-shrink-0">
                        {emp.name.charAt(0)}
                      </div>
                      {emp.name}
                      {!emp.available && <AlertTriangle size={12} className="text-gray-400"/>}
                      {emp.available && !roleMatch && <AlertTriangle size={12} className="text-orange-400"/>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {confirmReassign && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
              <div className={`${popupCard} rounded-lg shadow-lg p-6 max-w-sm w-full`}>
                <p className={`font-semibold mb-2 ${text}`}>{t('schedule.confirmAssignment')}</p>
                {confirmReassign.shift.assigned_employee && (
                  <p className={`text-sm mb-2 ${subtext}`}>
                    {t('schedule.currentlyAssignedTo')} <span className="font-medium">{confirmReassign.shift.assigned_employee}</span>. {t('schedule.willBeUnassigned')}
                  </p>
                )}
                {!confirmReassign.employee.available && (
                  <div className="bg-orange-50 border border-orange-200 rounded p-3 mb-3 text-sm">
                    <p className="text-orange-700 flex items-center gap-1"><AlertTriangle size={14}/> {confirmReassign.employee.name} {t('schedule.markedUnavailable')}</p>
                  </div>
                )}
                {selectedDayShift?.role && !confirmReassign.employee.roles.includes(selectedDayShift.role) && (
                  <div className="bg-orange-50 border border-orange-200 rounded p-3 mb-3 text-sm">
                    <p className="text-orange-700 flex items-center gap-1"><AlertTriangle size={14}/> {confirmReassign.employee.name} {t('schedule.missingRole')} <span className="font-semibold">{selectedDayShift.role}</span>{t('schedule.roleAssignAnyway')}</p>
                  </div>
                )}
                {confirmReassign.otherShift && (
                  <div className="bg-orange-50 border border-orange-200 rounded p-3 mb-3 text-sm">
                    <p className="text-orange-700 flex items-center gap-1">
                      <AlertTriangle size={14}/> {confirmReassign.employee.name} {t('schedule.alreadyWorking')} {confirmReassign.otherShift.start_time.slice(0,5)}–{confirmReassign.otherShift.end_time.slice(0,5)} {t('schedule.thisDayAssignAnyway')}
                    </p>
                  </div>
                )}
                <div className="flex gap-3 mt-3">
                  <button onClick={() => doAssignInDay(confirmReassign.shift, confirmReassign.employee)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                    {t('schedule.confirm')}
                  </button>
                  <button onClick={() => setConfirmReassign(null)} className={`px-4 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}>
                    {t('schedule.cancel')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {unassignedShifts.length > 0 && (
        <div className={`border rounded-lg p-4 mb-6 ${theme === 'dark' ? 'bg-red-950 border-red-800' : 'bg-red-50 border-red-200'}`}>
          <h2 className="text-red-500 font-semibold mb-3 text-sm">
            ⚠️ {unassignedShifts.length} {t('schedule.needsCoverage')}
          </h2>
          {unassignedShifts.map((shift, i) => (
            <div key={i} className={`mb-3 pb-3 border-b last:border-0 ${theme === 'dark' ? 'border-red-800' : 'border-red-100'}`}>
              <p className="text-sm font-medium text-red-500">
                {shift.day} · {shift.start_time.slice(0,5)} – {shift.end_time.slice(0,5)}
                {shift.required_role && <span className="ml-2 text-red-400">({shift.required_role})</span>}
              </p>
              {shift.potential_substitutes.length > 0 ? (
                <p className={`text-xs mt-1 ${subtext}`}>💡 {shift.potential_substitutes.map(s => s.name).join(', ')}</p>
              ) : (
                <p className={`text-xs mt-1 ${subtext}`}>{t('schedule.noEligible')}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {weeksToShow.map((weekMonday, weekIndex) => (
        <div key={weekIndex} className="mb-6">
          <h2 className={`text-xs font-semibold mb-2 uppercase tracking-widest ${subtext}`}>
            {formatWeekLabel(weekMonday)}
          </h2>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }, (_, i) => {
              const day = addDays(weekMonday, i)
              const entries = getEntriesForDay(day)
              const unassigned = getUnassignedForDay(day)
              const isToday = toDateString(day) === toDateString(new Date())
              const dateStr = toDateString(day)

              return (
                <div key={i} className={`rounded-lg p-2 min-h-24 ${isToday ? 'ring-2 ring-indigo-500' : ''} ${card}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-semibold ${isToday ? 'text-indigo-500' : subtext}`}>
                      {formatDayHeader(day)}
                    </span>
                    {(entries.length > 0 || unassigned.length > 0) && (
                      <button
                        onClick={() => openEditDay(dateStr)}
                        className={`text-xs px-1.5 py-0.5 rounded transition-colors ${theme === 'dark' ? 'text-gray-500 hover:text-indigo-400' : 'text-gray-300 hover:text-indigo-500'}`}
                      >
                        {t('schedule.edit')}
                      </button>
                    )}
                  </div>

                  {entries.length === 0 && unassigned.length === 0 ? (
                    <p className={`text-xs ${theme === 'dark' ? 'text-gray-600' : 'text-gray-300'}`}>—</p>
                  ) : (
                    <>
                      {entries.map((entry, i) => {
                        const hasConflict = conflictIds.includes(entry.id)
                        return (
                          <div
                            key={i}
                            onClick={() => setUnassigningEntry(entry)}
                            className={`rounded p-1.5 mb-1 text-xs cursor-pointer border-l-2 border-indigo-400 transition-colors ${
                              theme === 'dark' ? 'bg-indigo-950 hover:bg-indigo-900' : 'bg-indigo-50 hover:bg-indigo-100'
                            }`}
                          >
                            <div className={`font-semibold truncate ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-700'}`}>
                              {entry.employee}{entry.role_name && <span className="font-normal opacity-70"> · {roleLabel(entry.role_name)}</span>}
                            </div>
                            <div className={subtext}>{entry.start_time.slice(0,5)} – {entry.end_time.slice(0,5)}</div>
                            {entry.role_name && (
                              <div className={`text-xs mt-0.5 px-1 py-0.5 rounded inline-block ${theme === 'dark' ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>{roleLabel(entry.role_name)}</div>
                            )}
                            {hasConflict && (
                              <div className={`text-xs mt-0.5 px-1 py-0.5 rounded inline-flex items-center gap-1 ${theme === 'dark' ? 'bg-orange-950 text-orange-400' : 'bg-orange-50 text-orange-600'}`}>
                                <AlertTriangle size={10} /> {t('schedule.conflict')}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {unassigned.map((shift, i) => (
                        <div
                          key={i}
                          onClick={() => setAssigningShift(shift)}
                          className={`rounded p-1.5 mb-1 text-xs cursor-pointer border-l-2 border-red-400 border border-dashed transition-colors ${
                            theme === 'dark' ? 'bg-red-950 hover:bg-red-900 border-red-800' : 'bg-red-50 hover:bg-red-100 border-red-200'
                          }`}
                        >
                          <div className="font-medium text-red-500">{t('schedule.unassigned')}</div>
                          <div className={subtext}>{shift.start_time.slice(0,5)} – {shift.end_time.slice(0,5)}</div>
                          {shift.required_role && <div className="text-red-400 text-xs">{roleLabel(shift.required_role)}</div>}
                          <div className="text-red-400 text-xs mt-0.5">{t('schedule.clickToAssign')}</div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default SchedulePage