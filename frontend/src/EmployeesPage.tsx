import { apiFetch } from './api'
import { useState, useEffect } from 'react'
import { useTranslation } from './i18n'

interface Employee {
  id: number
  name: string
  desired_hours: number
}

interface Rating {
  id: number
  category: string
  score: number
}

interface SpecificOverride {
  id: number
  date: string
  status: string
}

const ROLE_KEYS: Record<string, string> = {
  'Server': 'role.server',
  'Host': 'role.host',
  'Cook': 'role.cook',
  'Cashier': 'role.cashier',
  'Shelf Restocker': 'role.shelfRestocker',
  'Cleaner': 'role.cleaner',
}

const PRESET_CATEGORIES = ['Punctuality', 'Reliability', 'Speed', 'Customer Attitude', 'Teamwork']
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

const CATEGORY_KEYS: Record<string, string> = {
  'Punctuality': 'category.punctuality',
  'Reliability': 'category.reliability',
  'Speed': 'category.speed',
  'Customer Attitude': 'category.customerAttitude',
  'Teamwork': 'category.teamwork',
}

function EmployeesPage({ theme = 'light' }: { theme?: string }) {
  const { t } = useTranslation()
  const roleLabel = (role: string) => t(ROLE_KEYS[role] || role)
  const dayLabel = (day: string) => t(DAY_KEYS[day] || day)
  const categoryLabel = (cat: string) => t(CATEGORY_KEYS[cat] || cat)

  const [roles, setRoles] = useState<{id: number, name: string}[]>([])
  const [employeeRoles, setEmployeeRoles] = useState<{id: number, name: string}[]>([])
  const [availability, setAvailability] = useState<string[]>([])
  const [specificOverrides, setSpecificOverrides] = useState<SpecificOverride[]>([])
  const [newOverrideDate, setNewOverrideDate] = useState('')
  const [newOverrideStatus, setNewOverrideStatus] = useState('unavailable')
  const [overrideError, setOverrideError] = useState('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [name, setName] = useState('')
  const [desiredHours, setDesiredHours] = useState('')
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
  const [ratings, setRatings] = useState<Rating[]>([])
  const [category, setCategory] = useState(PRESET_CATEGORIES[0])
  const [customCategory, setCustomCategory] = useState('')
  const [score, setScore] = useState('')
  const [hasLogin, setHasLogin] = useState<boolean | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [createLoginError, setCreateLoginError] = useState('')
  const [showAllRatings, setShowAllRatings] = useState(false)
  const [editingAvailability, setEditingAvailability] = useState(false)
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null)
  const [deleteEmployeeInfo, setDeleteEmployeeInfo] = useState<{shift_count: number, has_login: boolean} | null>(null)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [resetPassword, setResetPassword] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)
  const [resetRequestSent, setResetRequestSent] = useState(false)
  const [resetTriggerError, setResetTriggerError] = useState('')

  useEffect(() => {
    apiFetch(`/employees`)
      .then(res => res.json())
      .then(data => setEmployees(data))
    apiFetch(`/roles`)
      .then(res => res.json())
      .then(data => setRoles(data))
  }, [])

  const addEmployee = () => {
    apiFetch(`/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, desired_hours: parseInt(desiredHours) })
    })
      .then(res => res.json())
      .then(newEmployee => {
        setEmployees([...employees, newEmployee])
        setName('')
        setDesiredHours('')
      })
  }

  const fetchAvailability = (empId: number) => {
    apiFetch(`/availability/${empId}`)
      .then(res => res.json())
      .then(data => {
        setAvailability(data.days)
        setSpecificOverrides(data.specific_overrides || [])
      })
  }

  const selectEmployee = (emp: Employee) => {
    setSelectedEmp(emp)
    setHasLogin(null)
    setNewUsername('')
    setNewPassword('')
    setCreateLoginError('')
    setShowAllRatings(false)
    setOverrideError('')
    setNewOverrideDate('')
    setResetRequestSent(false)
    setResetTriggerError('')
    apiFetch(`/ratings/${emp.id}`)
      .then(res => res.json())
      .then(data => setRatings(data))
    fetchAvailability(emp.id)
    apiFetch(`/employee-roles/${emp.id}`)
      .then(res => res.json())
      .then(data => setEmployeeRoles(data))
    apiFetch(`/auth/user-by-employee/${emp.id}`)
      .then(res => res.json())
      .then(data => setHasLogin(data.exists))
  }

  const handleDeleteClick = (emp: Employee) => {
    apiFetch(`/employees/${emp.id}/usage`)
      .then(res => res.json())
      .then(data => {
        setDeleteEmployeeInfo(data)
        setDeletingEmployee(emp)
      })
  }

  const confirmDeleteEmployee = () => {
    if (!deletingEmployee) return
    apiFetch(`/employees/${deletingEmployee.id}`, { method: 'DELETE' })
      .then(() => {
        setEmployees(employees.filter(e => e.id !== deletingEmployee.id))
        if (selectedEmp?.id === deletingEmployee.id) setSelectedEmp(null)
        setDeletingEmployee(null)
        setDeleteEmployeeInfo(null)
      })
  }

  const addSpecificOverride = () => {
    if (!selectedEmp || !newOverrideDate) return
    setOverrideError('')
    apiFetch(`/availability/specific`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: selectedEmp.id,
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
    apiFetch(`/availability/specific/${overrideId}`, { method: 'DELETE' })
      .then(() => {
        setSpecificOverrides(specificOverrides.filter(o => o.id !== overrideId))
      })
  }

  const addRating = () => {
    const finalCategory = customCategory || category
    apiFetch(`/ratings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: selectedEmp?.id,
        category: finalCategory,
        score: parseFloat(score)
      })
    })
      .then(res => res.json())
      .then(newRating => {
        setRatings([...ratings, newRating])
        setScore('')
        setCustomCategory('')
      })
  }

  const createLogin = () => {
    if (!newUsername || !newPassword) {
      setCreateLoginError(t('employees.usernamePasswordRequired'))
      return
    }
    apiFetch(`/auth/create-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: newUsername,
        password: newPassword,
        role: 'employee',
        employee_id: selectedEmp?.id
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setCreateLoginError(data.error)
        } else {
          setHasLogin(true)
          setNewUsername('')
          setNewPassword('')
          setCreateLoginError('')
        }
      })
  }

const triggerPasswordReset = () => {
  setResetTriggerError('')
  apiFetch(`/auth/reset-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employee_id: selectedEmp?.id })
  })
    .then(res => {
      if (res.status === 429) {
        setResetTriggerError(t('employees.tooManyAttempts'))
        return null
      }
      return res.json()
    })
    .then(data => {
      if (!data) return
      setResetRequestSent(true)
    })
}

  const sortedRatings = [...ratings].sort((a, b) => b.score - a.score)
  const averageScore = ratings.length > 0
    ? (ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length).toFixed(1)
    : null

  const scoreColor = (s: number) => {
    if (s >= 4) return 'text-green-500'
    if (s >= 3) return 'text-yellow-500'
    return 'text-red-500'
  }

  const scoreBg = (s: number) => {
    if (s >= 4) return 'bg-green-100 text-green-700'
    if (s >= 3) return 'bg-yellow-100 text-yellow-700'
    return 'bg-red-100 text-red-700'
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

  const card = theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
  const text = theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
  const subtext = theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  const input = theme === 'dark'
    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
    : 'bg-white border-gray-200 text-gray-900'
  const divider = theme === 'dark' ? 'border-gray-700' : 'border-gray-100'
  const hover = theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'

  return (
    <div className={text}>
      <h1 className="text-2xl font-bold mb-4">{t('employees.title')}</h1>

      <div className={`${card} p-4 rounded-lg shadow mb-6`}>
        <h2 className={`text-lg font-semibold mb-3 ${text}`}>{t('employees.addEmployee')}</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            className={`border rounded-lg px-3 py-2 text-sm outline-none ${input}`}
            placeholder={t('employees.namePlaceholder')}
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <input
            className={`border rounded-lg px-3 py-2 text-sm outline-none ${input}`}
            placeholder={t('employees.desiredHoursPlaceholder')}
            value={desiredHours}
            onChange={e => setDesiredHours(e.target.value)}
          />
          <button onClick={addEmployee} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
            {t('employees.add')}
          </button>
        </div>
      </div>

      <div className={`${card} rounded-lg shadow mb-6`}>
        {employees.map(emp => (
          <div
            key={emp.id}
            className={`p-4 border-b flex items-center justify-between ${divider} ${hover} ${selectedEmp?.id === emp.id ? theme === 'dark' ? 'bg-gray-700' : 'bg-indigo-50' : ''}`}
          >
            <div className="cursor-pointer flex-1" onClick={() => selectEmployee(emp)}>
              <span className={`font-medium ${text}`}>{emp.name}</span>
              <span className={`ml-2 text-sm ${subtext}`}>{emp.desired_hours} {t('employees.hrsPerWeek')}</span>
            </div>
            <button
              onClick={() => handleDeleteClick(emp)}
              className="text-red-400 hover:text-red-500 text-sm transition-colors"
            >
              {t('employees.delete')}
            </button>
          </div>
        ))}
      </div>

      {selectedEmp && (
        <div className={`${card} p-6 rounded-lg shadow`}>

          <div className="flex items-center justify-between mb-3">
            <h2 className={`text-lg font-semibold ${text}`}>{t('employees.ratingsFor')} {selectedEmp.name}</h2>
            {averageScore && (
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${scoreBg(parseFloat(averageScore))}`}>
                {t('employees.avg')} {averageScore}/5
              </span>
            )}
          </div>

          <div className="flex gap-2 flex-wrap items-center mb-4">
            <select
              className={`border rounded-lg px-3 py-2 text-sm outline-none ${input}`}
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              {PRESET_CATEGORIES.map(c => (
                <option key={c} value={c}>{categoryLabel(c)}</option>
              ))}
            </select>
            <input
              className={`border rounded-lg px-3 py-2 text-sm outline-none ${input}`}
              placeholder={t('employees.customCategoryPlaceholder')}
              value={customCategory}
              onChange={e => setCustomCategory(e.target.value)}
            />
            <input
              className={`border rounded-lg px-3 py-2 text-sm outline-none w-20 ${input}`}
              placeholder={t('employees.scorePlaceholder')}
              value={score}
              onChange={e => setScore(e.target.value)}
            />
            <button onClick={addRating} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
              {t('employees.addRating')}
            </button>
          </div>

          <div className="mb-2">
            {ratings.length === 0 && (
              <p className={`text-sm p-2 ${subtext}`}>{t('employees.noRatingsYet')}</p>
            )}
            {(showAllRatings ? sortedRatings : sortedRatings.slice(0, 3)).map(r => (
              <div key={r.id} className={`flex justify-between items-center p-2 border-b ${divider}`}>
                <span className={`${scoreColor(r.score)}`}>{categoryLabel(r.category)}</span>
                <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${scoreBg(r.score)}`}>
                  {r.score}/5
                </span>
              </div>
            ))}
            {sortedRatings.length > 3 && (
              <button
                onClick={() => setShowAllRatings(!showAllRatings)}
                className="text-indigo-500 text-sm mt-2 hover:underline"
              >
                {showAllRatings ? t('employees.showLess') : `${t('employees.showAll')} ${sortedRatings.length} ${t('employees.ratings')}`}
              </button>
            )}
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className={`text-lg font-semibold ${text}`}>{t('employees.recurringAvailability')}</h2>
              {!editingAvailability && (
                <button onClick={() => setEditingAvailability(true)} className="text-indigo-500 text-sm hover:underline">
                  {t('employees.editAvailability')}
                </button>
              )}
            </div>

            {editingAvailability ? (
              <div>
                <div className="flex gap-4 flex-wrap mb-3">
                  {DAYS.map(day => (
                    <label key={day} className={`flex items-center gap-1 cursor-pointer text-sm ${text}`}>
                      <input
                        type="checkbox"
                        checked={availability.includes(day)}
                        onChange={() => {
                          const updated = availability.includes(day)
                            ? availability.filter(d => d !== day)
                            : [...availability, day]
                          setAvailability(updated)
                        }}
                      />
                      {dayLabel(day)}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      apiFetch(`/availability`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ employee_id: selectedEmp.id, days: availability })
                      }).then(() => setEditingAvailability(false))
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    {t('employees.save')}
                  </button>
                  <button
                    onClick={() => setEditingAvailability(false)}
                    className={`px-4 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}
                  >
                    {t('employees.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {DAYS.map(day => (
                  <span
                    key={day}
                    className={`px-3 py-1 rounded-full text-sm ${
                      availability.includes(day)
                        ? 'bg-green-100 text-green-700'
                        : theme === 'dark' ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {dayLabel(day)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6">
            <h2 className={`text-lg font-semibold mb-2 ${text}`}>{t('employees.specificDateOverrides')}</h2>
            <p className={`text-xs mb-3 ${subtext}`}>
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

          <div className="mt-6">
            <h2 className={`text-lg font-semibold mb-2 ${text}`}>{t('employees.roles')}</h2>
            <div className="flex gap-2 flex-wrap">
              {roles.map(role => {
                const hasRole = employeeRoles.some(r => r.id === role.id)
                return (
                  <button
                    key={role.id}
                    onClick={() => {
                      if (hasRole) {
                        apiFetch(`/employee-roles`, {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ employee_id: selectedEmp.id, role_id: role.id })
                        }).then(() => setEmployeeRoles(employeeRoles.filter(r => r.id !== role.id)))
                      } else {
                        apiFetch(`/employee-roles`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ employee_id: selectedEmp.id, role_id: role.id })
                        }).then(() => setEmployeeRoles([...employeeRoles, role]))
                      }
                    }}
                    className={`px-3 py-1 rounded-lg border text-sm transition-colors ${
                      hasRole
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : theme === 'dark' ? 'bg-transparent text-gray-300 border-gray-600' : 'bg-white text-gray-700 border-gray-200'
                    }`}
                  >
                    {roleLabel(role.name)}
                  </button>
                )
              })}
              {roles.length === 0 && <p className={subtext}>{t('employees.noRolesYet')}</p>}
            </div>
          </div>

          <div className="mt-6">
            <h2 className={`text-lg font-semibold mb-2 ${text}`}>{t('employees.loginAccount')}</h2>
            {hasLogin === null && <p className={`text-sm ${subtext}`}>{t('employees.checking')}</p>}
            {hasLogin === true && (
              <div>
                <p className="text-green-500 text-sm mb-2">{t('employees.hasLogin')}</p>

                <div className="flex gap-4 items-center mb-2">
                  <button
                    onClick={triggerPasswordReset}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                  >
                    {t('employees.triggerReset')}
                  </button>
                  {!resettingPassword && (
                    <button
                      onClick={() => { setResettingPassword(true); setResetSuccess(false) }}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${theme === 'dark' ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      {t('employees.emergencyOverride')}
                    </button>
                  )}
                </div>

                {resetRequestSent && (
                  <p className="text-green-500 text-sm mb-2">
                    {t('employees.resetRequestSent')}
                  </p>
                )}
                {resetTriggerError && (
                  <p className="text-red-500 text-sm mb-2">{resetTriggerError}</p>
                )}

                {resettingPassword && (
                  <div className="flex gap-2 items-center flex-wrap mt-2">
                    <input
                      className={`border rounded-lg px-3 py-2 text-sm outline-none ${input}`}
                      placeholder={t('employees.newPasswordPlaceholder')}
                      type="password"
                      value={resetPassword}
                      onChange={e => setResetPassword(e.target.value)}
                    />
                    <button
                      onClick={() => {
                        apiFetch(`/auth/reset-password`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ employee_id: selectedEmp?.id, new_password: resetPassword })
                        }).then(() => {
                          setResetSuccess(true)
                          setResettingPassword(false)
                          setResetPassword('')
                        })
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                    >
                      {t('employees.save')}
                    </button>
                    <button
                      onClick={() => { setResettingPassword(false); setResetPassword('') }}
                      className={`px-4 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}
                    >
                      {t('employees.cancel')}
                    </button>
                  </div>
                )}
                {resetSuccess && <p className="text-green-500 text-sm mt-2">{t('employees.resetSuccess')}</p>}
              </div>
            )}
            {hasLogin === false && (
              <div className="flex gap-2 items-center flex-wrap">
                <input
                  className={`border rounded-lg px-3 py-2 text-sm outline-none ${input}`}
                  placeholder={t('employees.usernamePlaceholder')}
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                />
                <input
                  className={`border rounded-lg px-3 py-2 text-sm outline-none ${input}`}
                  placeholder={t('employees.passwordPlaceholder')}
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
                <button onClick={createLogin} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                  {t('employees.createLogin')}
                </button>
                {createLoginError && <p className="text-red-500 text-sm w-full">{createLoginError}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {deletingEmployee && deleteEmployeeInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className={`${card} rounded-lg shadow-lg p-6 max-w-sm w-full`}>
            <p className={`font-semibold mb-2 ${text}`}>{t('employees.deletePrefix')} "{deletingEmployee.name}"?</p>
            {(deleteEmployeeInfo.shift_count > 0 || deleteEmployeeInfo.has_login) ? (
              <div className="bg-orange-50 border border-orange-200 rounded p-3 mb-4 text-sm">
                <p className="text-orange-700 font-semibold mb-1">{t('employees.activeWarning')}</p>
                {deleteEmployeeInfo.shift_count > 0 && (
                  <p className="text-orange-600">• {t('employees.scheduledFor')} {deleteEmployeeInfo.shift_count} {deleteEmployeeInfo.shift_count > 1 ? t('employees.shifts') : t('employees.shift')}</p>
                )}
                {deleteEmployeeInfo.has_login && (
                  <p className="text-orange-600">{t('employees.hasLoginBullet')}</p>
                )}
                <p className="text-orange-500 text-xs mt-2">{t('employees.deleteWarningDetail')}</p>
              </div>
            ) : (
              <p className={`text-sm mb-4 ${subtext}`}>{t('employees.safeToDelete')}</p>
            )}
            <div className="flex gap-3">
              <button onClick={confirmDeleteEmployee} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                {t('employees.delete')}
              </button>
              <button
                onClick={() => { setDeletingEmployee(null); setDeleteEmployeeInfo(null) }}
                className={`px-4 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}
              >
                {t('employees.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmployeesPage