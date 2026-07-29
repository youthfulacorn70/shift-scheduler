import { useState, useEffect } from 'react'
import { useTranslation } from './i18n'

interface ScheduleEntry {
  id: number
  employee: string
  day: string
  start_time: string
  end_time: string
}

function EmployeeSchedulePage({ employeeId, theme = 'light' }: { employeeId: number, theme?: string }) {
  const { t } = useTranslation()
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [weekOffset, setWeekOffset] = useState(0)

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/schedule/employee/${employeeId}`)
      .then(res => res.json())
      .then(data => setSchedule(data))
  }, [employeeId])

  function getMonday(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  function addDays(date: Date, n: number): Date {
    const d = new Date(date)
    d.setDate(d.getDate() + n)
    return d
  }

  function toDateString(date: Date): string {
    return date.toISOString().split('T')[0]
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

  const thisWeekMonday = getMonday(new Date())
  const week1Monday = addDays(thisWeekMonday, weekOffset * 7)
  const week2Monday = addDays(week1Monday, 7)
  const weeksToShow = [week1Monday, week2Monday]

  const getEntriesForDay = (date: Date): ScheduleEntry[] => {
    const dateStr = toDateString(date)
    return schedule.filter(entry => entry.day === dateStr)
  }

  const text = theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
  const subtext = theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  const card = theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
  const btnStyle = theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'

  return (
    <div className={text}>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">{t('empSchedule.title')}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(prev => prev - 1)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${btnStyle}`}>{t('empSchedule.previous')}</button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${btnStyle}`}>{t('empSchedule.today')}</button>
          )}
          <button onClick={() => setWeekOffset(prev => prev + 1)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${btnStyle}`}>{t('empSchedule.next')}</button>
        </div>
      </div>

      {weeksToShow.map((weekMonday, weekIndex) => (
        <div key={weekIndex} className="mb-6">
          <h2 className={`text-xs font-semibold mb-2 uppercase tracking-widest ${subtext}`}>
            {weekOffset === 0 && weekIndex === 0 ? t('empSchedule.thisWeek') : weekOffset === 0 && weekIndex === 1 ? t('empSchedule.nextWeek') : ''} — {formatWeekLabel(weekMonday)}
          </h2>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }, (_, i) => {
              const day = addDays(weekMonday, i)
              const entries = getEntriesForDay(day)
              const isToday = toDateString(day) === toDateString(new Date())

              return (
                <div key={i} className={`rounded-lg p-2 min-h-24 ${isToday ? 'ring-2 ring-indigo-500' : ''} ${card}`}>
                  <div className={`text-xs font-semibold mb-1.5 ${isToday ? 'text-indigo-500' : subtext}`}>
                    {formatDayHeader(day)}
                  </div>
                  {entries.length === 0 ? (
                    <p className={`text-xs ${theme === 'dark' ? 'text-gray-600' : 'text-gray-300'}`}>—</p>
                  ) : (
                    entries.map((entry, idx) => (
                      <div key={idx} className={`rounded p-1.5 mb-1 text-xs border-l-2 border-green-400 ${theme === 'dark' ? 'bg-green-950 text-green-300' : 'bg-green-50 text-green-700'}`}>
                        <div className="font-semibold">{entry.start_time.slice(0, 5)} – {entry.end_time.slice(0, 5)}</div>
                      </div>
                    ))
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

export default EmployeeSchedulePage