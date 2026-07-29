import { API_URL } from './config'
import { useState, useEffect } from 'react'
import { useTranslation } from './i18n'

interface SpecificOverride {
  id: number
  date: string
  status: string
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const DAY_KEYS: Record<string, string> = {
  'Monday': 'day.monday',
  'Tuesday': 'day.tuesday',
  'Wednesday': 'day.wednesday',
  'Thursday': 'day.thursday',
  'Friday': 'day.friday',
  'Saturday': 'day.saturday',
  'Sunday': 'day.sunday',
}

function EmployeeAvailabilityPage({ employeeId, theme = 'light' }: { employeeId: number, theme?: string }) {
  const { t } = useTranslation()
  const dayLabel = (day: string) => t(DAY_KEYS[day] || day)

  const [availability, setAvailability] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [specificOverrides, setSpecificOverrides] = useState<SpecificOverride[]>([])
  const [newOverrideDate, setNewOverrideDate] = useState('')
  const [newOverrideStatus, setNewOverrideStatus] = useState('unavailable')
  const [overrideError, setOverrideError] = useState('')

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/availability/${employeeId}`)
      .then(res => res.json())
      .then(data => {
        setAvailability(data.days)
        setSpecificOverrides(data.specific_overrides || [])
      })
  }, [employeeId])

  const toggleDay = (day: string) => {
    const updated = availability.includes(day)
      ? availability.filter(d => d !== day)
      : [...availability, day]
    setAvailability(updated)
    setSaved(false)
  }

  const saveAvailability = () => {
    fetch(`${API_URL}/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: employeeId, days: availability })
    })
      .then(res => res.json())
      .then(() => setSaved(true))
  }

  const addSpecificOverride = () => {
    if (!newOverrideDate) return
    setOverrideError('')
    fetch(`${API_URL}/availability/specific`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: employeeId,
        date: newOverrideDate,
        status: newOverrideStatus
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setOverrideError(data.error)
          return
        }
        setSpecificOverrides([...specificOverrides, data].sort((a, b) => a.date.localeCompare(b.date)))
        setNewOverrideDate('')
      })
  }

  const removeSpecificOverride = (overrideId: number) => {
    fetch(`http://127.0.0.1:8000/availability/specific/${overrideId}`, { method: 'DELETE' })
      .then(() => {
        setSpecificOverrides(specificOverrides.filter(o => o.id !== overrideId))
      })
  }

  const getDateConstraints = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dayOfWeek = today.getDay()
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
    const earliest = new Date(today)
    earliest.setDate(today.getDate() + daysUntilMonday)
    const latest = new Date(earliest)
    latest.setDate(earliest.getDate() + 28)
    return {
      min: earliest.toISOString().split('T')[0],
      max: latest.toISOString().split('T')[0]
    }
  }
  const { min: minOverrideDate, max: maxOverrideDate } = getDateConstraints()

  const text = theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
  const subtext = theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  const card = theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
  const input = theme === 'dark'
    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
    : 'bg-white border-gray-200 text-gray-900'

  return (
    <div className={text}>
      <h1 className="text-2xl font-bold mb-2">{t('empAvailability.title')}</h1>
      <p className={`mb-6 text-sm ${subtext}`}>{t('empAvailability.subtitle')}</p>

      <div className={`${card} p-6 rounded-lg shadow mb-6`}>
        <h2 className={`text-lg font-semibold mb-3 ${text}`}>{t('employees.recurringAvailability')}</h2>
        <div className="flex gap-4 flex-wrap mb-6">
          {DAYS.map(day => (
            <label key={day} className={`flex items-center gap-2 cursor-pointer text-sm ${text}`}>
              <input
                type="checkbox"
                checked={availability.includes(day)}
                onChange={() => toggleDay(day)}
                className="w-4 h-4 accent-indigo-600"
              />
              {dayLabel(day)}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <button onClick={saveAvailability} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm transition-colors">
            {t('empAvailability.saveAvailability')}
          </button>
          {saved && <p className="text-green-500 text-sm">{t('empAvailability.saved')}</p>}
        </div>
      </div>

      {/* Specific date overrides */}
      <div className={`${card} p-6 rounded-lg shadow`}>
        <h2 className={`text-lg font-semibold mb-2 ${text}`}>{t('employees.specificDateOverrides')}</h2>
        <p className={`text-xs mb-4 ${subtext}`}>
          {t('employees.overrideDesc')}
        </p>

        <div className="flex gap-2 flex-wrap items-center mb-3">
          <input
            type="date"
            className={`border rounded-lg px-3 py-2 text-sm outline-none ${input}`}
            value={newOverrideDate}
            min={minOverrideDate}
            max={maxOverrideDate}
            onChange={e => setNewOverrideDate(e.target.value)}
          />
          <select
            className={`border rounded-lg px-3 py-2 text-sm outline-none ${input}`}
            value={newOverrideStatus}
            onChange={e => setNewOverrideStatus(e.target.value)}
          >
            <option value="available">{t('employees.available')}</option>
            <option value="unavailable">{t('employees.unavailable')}</option>
          </select>
          <button onClick={addSpecificOverride} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
            {t('employees.addOverride')}
          </button>
        </div>
        {overrideError && <p className="text-red-500 text-sm mb-3">{overrideError}</p>}

        {specificOverrides.length === 0 ? (
          <p className={`text-sm ${subtext}`}>{t('employees.noOverrides')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {specificOverrides.map(override => (
              <div key={override.id} className={`flex items-center justify-between p-2 rounded-lg border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'}`}>
                <div className="text-sm">
                  <span className={`font-medium ${text}`}>{override.date}</span>
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${override.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {override.status === 'available' ? t('employees.available') : t('employees.unavailable')}
                  </span>
                </div>
                <button onClick={() => removeSpecificOverride(override.id)} className="text-red-400 hover:text-red-500 text-sm transition-colors">
                  {t('employees.remove')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default EmployeeAvailabilityPage