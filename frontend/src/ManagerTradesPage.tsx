import { useState, useEffect } from 'react'
import { useTranslation } from './i18n'

interface Trade {
  id: number
  requester_name: string
  requester_id: number
  shift_id: number
  day: string
  start_time: string
  end_time: string
  current_employee_name: string
  offered_shift_id: number | null
  employee_status: string
  manager_status: string
}

interface HoursWarning {
  current_hours: number
  shift_hours: number
  projected_hours: number
  desired_hours: number
  over_limit: boolean
}

function ManagerTradesPage({ theme = 'light' }: { theme?: string }) {
  const { t } = useTranslation()
  const [trades, setTrades] = useState<Trade[]>([])
  const [warnings, setWarnings] = useState<{[tradeId: number]: HoursWarning}>({})

  useEffect(() => {
    fetch('http://127.0.0.1:8000/trades')
      .then(res => res.json())
      .then(async (data: Trade[]) => {
        setTrades(data)
        const warningMap: {[tradeId: number]: HoursWarning} = {}
        for (const trade of data) {
          const res = await fetch(`http://127.0.0.1:8000/trades/hours-check?employee_id=${trade.requester_id}&shift_id=${trade.shift_id}`)
          const check = await res.json()
          warningMap[trade.id] = check
        }
        setWarnings(warningMap)
      })
  }, [])

  const respondToTrade = (tradeId: number, status: string) => {
    fetch(`http://127.0.0.1:8000/trades/${tradeId}/manager`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    }).then(() => {
      setTrades(trades.filter(t => t.id !== tradeId))
    })
  }

  const card = theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
  const text = theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
  const subtext = theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  const divider = theme === 'dark' ? 'border-gray-700' : 'border-gray-100'

  return (
    <div className={text}>
      <h1 className="text-2xl font-bold mb-6">{t('trades.managerTitle')}</h1>

      <div className={`${card} rounded-lg shadow`}>
        {trades.length === 0 && (
          <p className={`p-4 ${subtext}`}>{t('trades.noPending')}</p>
        )}
        {trades.map(trade => {
          const warning = warnings[trade.id]
          const employeeApproved = trade.employee_status === 'approved'

          return (
            <div key={trade.id} className={`p-4 border-b ${divider}`}>
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <p className={`font-semibold ${text}`}>
                    {trade.requester_name}
                    <span className={`font-normal ${subtext}`}> {t('trades.wants')} </span>
                    {trade.current_employee_name}{t('trades.shiftSuffix')}
                  </p>
                  <p className={`text-sm mt-1 ${subtext}`}>
                    {trade.day} · {trade.start_time.slice(0,5)} - {trade.end_time.slice(0,5)}
                  </p>
                  <p className="text-sm mt-2">
                    {trade.current_employee_name} {t('trades.employeeResponse')}{' '}
                    <span className={`font-semibold ${employeeApproved ? 'text-green-500' : 'text-yellow-500'}`}>
                      {trade.employee_status}
                    </span>
                  </p>
                  {warning && warning.over_limit && (
                    <p className="text-orange-500 text-sm mt-2">
                      {t('trades.overLimitWarning')} {trade.requester_name} {warning.projected_hours.toFixed(1)} {t('trades.hrsThisWeek')} {warning.desired_hours} {t('trades.hrsSuffix')}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 items-center">
                  {!employeeApproved && (
                    <span className={`text-sm ${subtext}`}>{t('trades.waitingFor')} {trade.current_employee_name}</span>
                  )}
                  {employeeApproved && (
                    <>
                      <button
                        onClick={() => respondToTrade(trade.id, 'approved')}
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                      >
                        {t('trades.approve')}
                      </button>
                      <button
                        onClick={() => respondToTrade(trade.id, 'denied')}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                      >
                        {t('trades.deny')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ManagerTradesPage