import { API_URL } from './config'
import { useState, useEffect } from 'react'
import { useTranslation } from './i18n'

interface ScheduleEntry {
  id: number
  employee: string
  day: string
  start_time: string
  end_time: string
  role: string | null
  shift_id: number
}

interface TradeRequest {
  id: number
  requester_name: string
  day: string
  start_time: string
  end_time: string
  employee_status: string
  manager_status: string
}

const ROLE_KEYS: Record<string, string> = {
  'Server': 'role.server',
  'Host': 'role.host',
  'Cook': 'role.cook',
  'Cashier': 'role.cashier',
  'Shelf Restocker': 'role.shelfRestocker',
  'Cleaner': 'role.cleaner',
}

function ShiftTradesPage({ employeeId, theme = 'light' }: { employeeId: number, theme?: string }) {
  const { t } = useTranslation()
  const roleLabel = (role: string | null) => role ? t(ROLE_KEYS[role] || role) : null
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [incomingTrades, setIncomingTrades] = useState<TradeRequest[]>([])
  const [employeeRoles, setEmployeeRoles] = useState<string[]>([])
  const [requestedShiftIds, setRequestedShiftIds] = useState<number[]>([])
  const [successMessage, setSuccessMessage] = useState('')
  const [roleMismatchShift, setRoleMismatchShift] = useState<ScheduleEntry | null>(null)
  const [myEmployeeName, setMyEmployeeName] = useState<string>('')

  useEffect(() => {
    fetch(`${API_URL}/schedule`)
      .then(res => res.json())
      .then(data => setSchedule(data))

    fetch(`http://127.0.0.1:8000/trades/employee/${employeeId}`)
      .then(res => res.json())
      .then(data => setIncomingTrades(data))

    fetch(`http://127.0.0.1:8000/employee-roles/${employeeId}`)
      .then(res => res.json())
      .then(data => setEmployeeRoles(data.map((r: {id: number, name: string}) => r.name)))
  }, [employeeId])

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/employees`)
      .then(res => res.json())
      .then(data => {
        const me = data.find((e: {id: number, name: string}) => e.id === employeeId)
        if (me) setMyEmployeeName(me.name)
      })
  }, [employeeId])

  const hasRole = (requiredRole: string | null) => {
    if (!requiredRole) return true
    return employeeRoles.includes(requiredRole)
  }

  const requestTrade = (shift: ScheduleEntry, skipEmployeeApproval: boolean = false) => {
    fetch(`${API_URL}/trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requester_id: employeeId,
        shift_id: shift.shift_id,
        skip_employee_approval: skipEmployeeApproval
      })
    })
      .then(res => res.json())
      .then(() => {
        setRequestedShiftIds([...requestedShiftIds, shift.shift_id])
        setSuccessMessage(t('trades.tradeRequestSent'))
        setRoleMismatchShift(null)
      })
  }

  const respondToTrade = (tradeId: number, status: string) => {
    fetch(`http://127.0.0.1:8000/trades/${tradeId}/employee`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    }).then(() => {
      setIncomingTrades(incomingTrades.filter(t => t.id !== tradeId))
    })
  }

  const filteredShifts = schedule.filter(entry => entry.employee !== myEmployeeName)

  const text = theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
  const subtext = theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  const card = theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
  const divider = theme === 'dark' ? 'border-gray-700' : 'border-gray-100'
  const popupCard = theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'

  return (
    <div className={text}>
      <h1 className="text-2xl font-bold mb-6">{t('trades.employeeTitle')}</h1>

      {/* Role mismatch popup */}
      {roleMismatchShift && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className={`${popupCard} rounded-lg shadow-lg p-6 max-w-sm w-full`}>
            <p className={`font-semibold mb-2 ${text}`}>{t('trades.roleMismatch')}</p>
            <p className={`text-sm mb-4 ${subtext}`}>
              {t('trades.roleMismatchDesc1')} <span className="font-semibold text-indigo-500">{roleLabel(roleMismatchShift.role)}</span> {t('trades.roleMismatchDesc2')}
            </p>
            <div className="flex gap-3">
              <button onClick={() => requestTrade(roleMismatchShift, true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                {t('trades.sendToManager')}
              </button>
              <button onClick={() => setRoleMismatchShift(null)} className={`px-4 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}>
                {t('trades.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming trade requests */}
      {incomingTrades.length > 0 && (
        <div className={`${card} p-4 rounded-lg shadow mb-6`}>
          <h2 className={`text-lg font-semibold mb-3 ${text}`}>{t('trades.incomingRequests')}</h2>
          {incomingTrades.map(trade => (
            <div key={trade.id} className={`flex items-center justify-between p-3 border-b ${divider}`}>
              <div className="text-sm">
                <span className={`font-semibold ${text}`}>{trade.requester_name}</span>
                <span className={`ml-2 ${subtext}`}>{t('trades.wantsYourShiftOn')}</span>
                <span className={`font-semibold ml-2 ${text}`}>{trade.day}</span>
                <span className={`ml-2 ${subtext}`}>{trade.start_time.slice(0,5)} – {trade.end_time.slice(0,5)}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => respondToTrade(trade.id, 'approved')} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm transition-colors">{t('trades.approve')}</button>
                <button onClick={() => respondToTrade(trade.id, 'denied')} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm transition-colors">{t('trades.deny')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Request a shift trade */}
      <div className={`${card} p-4 rounded-lg shadow`}>
        <h2 className={`text-lg font-semibold mb-1 ${text}`}>{t('trades.requestTitle')}</h2>
        <p className={`text-sm mb-4 ${subtext}`}>{t('trades.requestDesc')}</p>
        {filteredShifts.length === 0 && <p className={subtext}>{t('trades.noShiftsAvailable')}</p>}
        {filteredShifts.map((entry, i) => {
          const roleMatch = hasRole(entry.role)
          const alreadyRequested = requestedShiftIds.includes(entry.shift_id)
          return (
            <div key={i} className={`flex items-center justify-between p-3 border-b ${divider}`}>
              <div className="text-sm">
                <span className={`font-semibold ${text}`}>{entry.day}</span>
                <span className={`ml-2 ${subtext}`}>{entry.start_time.slice(0,5)} – {entry.end_time.slice(0,5)}</span>
                <span className="text-indigo-500 ml-2">{entry.employee}</span>
                {entry.role && (
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${roleMatch ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {roleLabel(entry.role)}
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  if (alreadyRequested) return
                  if (!roleMatch) setRoleMismatchShift(entry)
                  else requestTrade(entry)
                }}
                disabled={alreadyRequested}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${alreadyRequested ? (theme === 'dark' ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400') : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
              >
                {alreadyRequested ? t('trades.requested') : t('trades.request')}
              </button>
            </div>
          )
        })}
        {successMessage && <p className="text-green-500 text-sm mt-3">{successMessage}</p>}
      </div>
    </div>
  )
}

export default ShiftTradesPage