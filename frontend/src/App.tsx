import { useState } from 'react'
import EmployeesPage from './EmployeesPage'
import ShiftsPage from './ShiftsPage'
import SchedulePage from './SchedulePage'
import RolesPage from './RolesPage'
import EmployeeSchedulePage from './EmployeeSchedulePage'
import EmployeeAvailabilityPage from './EmployeeAvailabilityPage'
import ShiftTradesPage from './ShiftTradesPage'
import ManagerTradesPage from './ManagerTradesPage'
import SettingsPage from './SettingsPage'
import { Calendar, Users, Clock, Tag, ArrowLeftRight } from 'lucide-react'
import { useTranslation } from './i18n'

const week1 = [
  { n:'1', pills:[{t:'Joe · 9–5',c:'g'},{t:'Amy · 12–8',c:'i'}] },
  { n:'2', pills:[{t:'Alfred · 10–6',c:'g'}] },
  { n:'3', pills:[{t:'Joe · 12–8',c:'i'},{t:'Sam · 8–2',c:'o'}], today:true as true },
  { n:'4', pills:[{t:'Unassigned',c:'r'}] },
  { n:'5', pills:[{t:'Amy · 9–5',c:'g'}] },
  { n:'6', pills:[{t:'Alfred · 11–7',c:'i'}] },
  { n:'7', pills:[] },
]

const week2 = [
  { n:'8', pills:[{t:'Joe · 9–5',c:'g'}] },
  { n:'9', pills:[{t:'Sam · 8–2',c:'o'},{t:'Amy · 1–9',c:'i'}] },
  { n:'10', pills:[{t:'Alfred · 10–6',c:'g'}] },
  { n:'11', pills:[{t:'Joe · 12–8',c:'i'}] },
  { n:'12', pills:[{t:'Unassigned',c:'r'}] },
  { n:'13', pills:[{t:'Amy · 9–5',c:'g'}] },
  { n:'14', pills:[{t:'Sam · 10–6',c:'i'}] },
]

const pillColor = (c: string) => {
  if (c === 'g') return 'bg-green-50 text-green-800 border-green-400'
  if (c === 'i') return 'bg-indigo-50 text-indigo-800 border-indigo-400'
  if (c === 'o') return 'bg-orange-50 text-orange-800 border-orange-400'
  return 'bg-red-50 text-red-800 border-red-400 italic'
}

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [role, setRole] = useState<string | null>(localStorage.getItem('role'))
  const [username, setUsername] = useState<string | null>(localStorage.getItem('username'))
  const [page, setPage] = useState(localStorage.getItem('role') === 'manager' ? 'schedule' : 'my-schedule')
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [theme, setTheme] = useState<string>(localStorage.getItem('theme') || 'light')
  const [showResetFlow, setShowResetFlow] = useState(false)
  const [resetUsername, setResetUsername] = useState('')
  const [resetEligible, setResetEligible] = useState<boolean | null>(null)
  const [resetChecking, setResetChecking] = useState(false)
  const [resetNewPassword, setResetNewPassword] = useState('')
  const [resetConfirmPassword, setResetConfirmPassword] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetDone, setResetDone] = useState(false)
  const { t } = useTranslation()

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('theme', next)
  }

  const handleLogin = () => {
  fetch('http://127.0.0.1:8000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: loginUsername, password: loginPassword })
  })
    .then(res => {
      if (res.status === 429) {
        setLoginError('Too many login attempts. Please wait a minute and try again.')
        return null
      }
      return res.json()
    })
    .then(data => {
      if (!data) return
      if (data.error) { setLoginError(data.error); return }
      localStorage.setItem('token', data.token)
      localStorage.setItem('role', data.role)
      localStorage.setItem('username', data.username)
      setToken(data.token)
      setRole(data.role)
      setUsername(data.username)
      setLoginUsername('')
      setLoginPassword('')
      setLoginError('')
      setPage(data.role === 'manager' ? 'schedule' : 'my-schedule')
    })
}
  const checkResetEligibility = () => {
  setResetChecking(true)
  setResetError('')
  fetch(`http://127.0.0.1:8000/auth/reset-status?username=${encodeURIComponent(resetUsername)}`)
    .then(res => {
      if (res.status === 429) {
        setResetChecking(false)
        setResetError('Too many attempts. Please wait a minute and try again.')
        return null
      }
      return res.json()
    })
    .then(data => {
      if (!data) return
      setResetChecking(false)
      setResetEligible(data.eligible)
      if (!data.eligible) {
        setResetError('No pending reset found for this username. Ask your manager to trigger one.')
      }
    })
}

  const submitNewPassword = () => {
  setResetError('')
  if (resetNewPassword.length < 1) {
    setResetError('Please enter a new password.')
    return
  }
  if (resetNewPassword !== resetConfirmPassword) {
    setResetError('Passwords do not match.')
    return
  }
  fetch('http://127.0.0.1:8000/auth/reset-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: resetUsername, new_password: resetNewPassword })
  })
    .then(res => {
      if (res.status === 429) {
        setResetError('Too many attempts. Please wait a minute and try again.')
        return null
      }
      return res.json()
    })
    .then(data => {
      if (!data) return
      if (data.error) {
        setResetError(data.error)
        return
      }
      setResetDone(true)
    })
}

const backToLogin = () => {
  setShowResetFlow(false)
  setResetUsername('')
  setResetEligible(null)
  setResetNewPassword('')
  setResetConfirmPassword('')
  setResetError('')
  setResetDone(false)
}

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('username')
    setToken(null)
    setRole(null)
    setUsername(null)
  }

  if (!token) {
    return (
      <div className="h-screen flex overflow-hidden">
        <div className="w-2/5 bg-white flex flex-col justify-center px-12 flex-shrink-0">
          <div className="flex items-center gap-2 mb-10">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-sm font-semibold">S</div>
            <span className="text-sm font-medium text-gray-900">Shift Scheduler</span>
          </div>
          {!showResetFlow ? (
  <>
    <h2 className="text-2xl font-semibold text-gray-900 tracking-tight mb-7">Welcome back</h2>
    <label className="text-xs font-medium text-gray-500 mb-1.5 block">Username</label>
    <input
      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all mb-4"
      placeholder="your-username"
      value={loginUsername}
      onChange={e => setLoginUsername(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && handleLogin()}
    />
    <label className="text-xs font-medium text-gray-500 mb-1.5 block">Password</label>
    <input
      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all mb-2"
      placeholder="••••••••"
      type="password"
      value={loginPassword}
      onChange={e => setLoginPassword(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && handleLogin()}
    />
    <button
      onClick={() => setShowResetFlow(true)}
      className="text-indigo-500 text-xs mb-4 hover:underline text-left"
    >
      Forgot password?
    </button>
    {loginError && <p className="text-red-500 text-xs mb-4">{loginError}</p>}
    <button
      onClick={handleLogin}
      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
    >
      Sign in →
    </button>
  </>
) : (
  <>
    <h2 className="text-2xl font-semibold text-gray-900 tracking-tight mb-7">Reset password</h2>
          {resetDone ? (
            <>
              <p className="text-green-600 text-sm mb-6">✓ Password reset successfully. You can now sign in with your new password.</p>
              <button
                onClick={backToLogin}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
              >
                Back to sign in
              </button>
            </>
          ) : resetEligible ? (
            <>
              <p className="text-xs text-gray-500 mb-4">Set a new password for <span className="font-medium">{resetUsername}</span>.</p>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">New password</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all mb-4"
                type="password"
                value={resetNewPassword}
                onChange={e => setResetNewPassword(e.target.value)}
              />
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Confirm new password</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all mb-4"
                type="password"
                value={resetConfirmPassword}
                onChange={e => setResetConfirmPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitNewPassword()}
              />
              {resetError && <p className="text-red-500 text-xs mb-4">{resetError}</p>}
              <button
                onClick={submitNewPassword}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors mb-2"
              >
                Set new password
              </button>
              <button onClick={backToLogin} className="text-gray-400 text-xs hover:underline">
                Cancel
              </button>
            </>
          ) : (
            <>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Username</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all mb-4"
                placeholder="your-username"
                value={resetUsername}
                onChange={e => setResetUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && checkResetEligibility()}
              />
              {resetError && <p className="text-red-500 text-xs mb-4">{resetError}</p>}
              <button
                onClick={checkResetEligibility}
                disabled={resetChecking || !resetUsername}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors mb-2 disabled:opacity-50"
              >
                {resetChecking ? 'Checking...' : 'Continue'}
              </button>
              <button onClick={backToLogin} className="text-gray-400 text-xs hover:underline">
                Back to sign in
              </button>
            </>
          )}
        </>
      )}
        </div>

        <div className="flex-1 flex items-center justify-center overflow-hidden" style={{background: '#f4f3ff'}}>
          <div style={{perspective: '900px', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div style={{
              transform: 'rotateX(8deg) rotateY(-12deg) rotateZ(2deg) translateX(-40px) translateY(-60px)',
              transformStyle: 'preserve-3d',
              width: '95%',
              background: '#fff',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 24px 60px rgba(79,70,229,0.18)',
              border: '0.5px solid #e8e6ff'
            }}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px'}}>
                <span style={{fontSize:'9px', fontWeight:500, color:'#a5b4fc', letterSpacing:'0.08em', textTransform:'uppercase'}}>Schedule preview</span>
                <span style={{fontSize:'9px', color:'#c4b5fd'}}>Jun 1 – Jun 14, 2026</span>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px', marginBottom:'4px'}}>
                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                  <div key={d} style={{fontSize:'8px', fontWeight:500, color:'#a5b4fc', textAlign:'center', textTransform:'uppercase'}}>{d}</div>
                ))}
              </div>
              <div style={{fontSize:'8px', color:'#c4b5fd', marginBottom:'4px'}}>Week 1 — Jun 1–7</div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px', marginBottom:'8px'}}>
                {week1.map((day, i) => (
                  <div key={i} style={{
                    background: day.today ? '#fff' : '#fafafa',
                    border: day.today ? '1.5px solid #6366f1' : '0.5px solid #f0efff',
                    borderRadius:'6px', padding:'5px', height:'80px', overflow:'hidden'
                  }}>
                    <div style={{fontSize:'7px', fontWeight:500, color: day.today ? '#4f46e5' : '#c4b5fd', marginBottom:'3px'}}>{day.n}</div>
                    {day.pills.map((p,j) => (
                      <div key={j} className={`text-[10px] px-1 py-0.5 rounded mb-0.5 border-l-2 truncate ${pillColor(p.c)}`} style={{fontSize:'6.5px'}}>{p.t}</div>
                    ))}
                  </div>
                ))}
              </div>
              <div style={{fontSize:'8px', color:'#c4b5fd', marginBottom:'4px'}}>Week 2 — Jun 8–14</div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px'}}>
                {week2.map((day, i) => (
                  <div key={i} style={{
                    background:'#fafafa', border:'0.5px solid #f0efff',
                    borderRadius:'6px', padding:'5px', height:'64px', overflow:'hidden'
                  }}>
                    <div style={{fontSize:'7px', fontWeight:500, color:'#c4b5fd', marginBottom:'3px'}}>{day.n}</div>
                    {day.pills.map((p,j) => (
                      <div key={j} className={`text-[10px] px-1 py-0.5 rounded mb-0.5 border-l-2 truncate ${pillColor(p.c)}`} style={{fontSize:'6.5px'}}>{p.t}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (role === 'manager') {
    return (
      <div className={`flex h-screen overflow-hidden ${theme === 'dark' ? 'dark' : ''}`} style={{background: theme === 'dark' ? '#0d1424' : '#f9f9f5'}}>
        <div
          className="group flex flex-col flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            width: '56px',
            background: theme === 'dark' ? '#080d1a' : '#ffffff',
            borderRight: theme === 'dark' ? '0.5px solid #1a2236' : '0.5px solid #e8e8e2',
          }}
          onMouseEnter={e => (e.currentTarget.style.width = '200px')}
          onMouseLeave={e => (e.currentTarget.style.width = '56px')}
        >
          <div className="flex items-center gap-3 px-3.5 py-4 mb-2" style={{borderBottom: theme === 'dark' ? '0.5px solid #1a2236' : '0.5px solid #e8e8e2'}}>
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">S</div>
            
          </div>
            <span className="text-sm font-medium whitespace-nowrap overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{color: theme === 'dark' ? '#e2e8f0' : '#0a0a0a'}}>{t('app.name')}</span>
          {[
              { icon: <Calendar size={18} strokeWidth={1.75}/>, label: t('nav.schedule'), key: 'schedule' },
              { icon: <Users size={18} strokeWidth={1.75}/>, label: t('nav.employees'), key: 'employees' },
              { icon: <Clock size={18} strokeWidth={1.75}/>, label: t('nav.shifts'), key: 'shifts' },
              { icon: <Tag size={18} strokeWidth={1.75}/>, label: t('nav.roles'), key: 'roles' },
              { icon: <ArrowLeftRight size={18} strokeWidth={1.75}/>, label: t('nav.trades'), key: 'trades' },
            ].map(item => (
            <button
              key={item.key}
              onClick={() => setPage(item.key)}
              className="flex items-center gap-3 px-3.5 py-2.5 mx-2 rounded-lg transition-colors duration-150 text-left"
              style={{
                background: page === item.key
                  ? theme === 'dark' ? '#1a2040' : '#eef2ff'
                  : 'transparent',
                color: page === item.key
                  ? '#6366f1'
                  : theme === 'dark' ? '#4b5563' : '#9ca3af',
              }}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="text-sm font-medium whitespace-nowrap overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-200">{item.label}</span>
            </button>
          ))}

          {/* Profile — click to open Settings */}
          <div className="mt-auto px-2 pb-4">
            <button
              onClick={() => setPage('settings')}
              onMouseEnter={e => { if (page !== 'settings') e.currentTarget.style.background = theme === 'dark' ? '#151b2e' : '#f5f5f0' }}
              onMouseLeave={e => { if (page !== 'settings') e.currentTarget.style.background = 'transparent' }}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-colors duration-150 w-full text-left"
              style={{
                background: page === 'settings'
                  ? theme === 'dark' ? '#1a2040' : '#eef2ff'
                  : 'transparent',
              }}
            >
              <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <span className="text-indigo-600 text-xs font-semibold">{username?.charAt(0).toUpperCase()}</span>
              </div>
              <span
                className="text-xs whitespace-nowrap overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{color: page === 'settings' ? '#6366f1' : theme === 'dark' ? '#4b5563' : '#9ca3af'}}
              >
                {username}
              </span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8">
          <div key={page} className="page-transition">
            {page === 'employees' && <EmployeesPage theme={theme} />}
            {page === 'shifts' && <ShiftsPage theme={theme} />}
            {page === 'schedule' && <SchedulePage theme={theme} />}
            {page === 'roles' && <RolesPage theme={theme} />}
            {page === 'trades' && <ManagerTradesPage theme={theme} />}
            {page === 'settings' && <SettingsPage theme={theme} toggleTheme={toggleTheme} handleLogout={handleLogout} username={username} />}
          </div>
        </div>
      </div>
    )
  }

  if (role === 'employee') {
  const employeeId = JSON.parse(atob(token.split('.')[1])).employee_id
  return (
    <div className="min-h-screen" style={{background: theme === 'dark' ? '#0d1424' : '#f9f9f5'}}>

      {/* Top nav */}
      <nav style={{
        background: theme === 'dark' ? '#080d1a' : '#ffffff',
        borderBottom: theme === 'dark' ? '0.5px solid #1a2236' : '0.5px solid #e8e8e2'
      }} className="px-8 py-3 flex items-center gap-2">

        {/* Logo */}
        <div className="flex items-center gap-2 mr-6">
          <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center text-white text-xs font-semibold">S</div>
          <span className="text-sm font-medium" style={{color: theme === 'dark' ? '#e2e8f0' : '#0a0a0a'}}>{t('app.name')}</span>
        </div>

        {/* Nav tabs */}
        {[
          { label: t('empSchedule.title'), key: 'my-schedule' },
          { label: t('empAvailability.title'), key: 'my-availability' },
          { label: t('trades.employeeTitle'), key: 'my-trades' },
        ].map(item => (
          <button
            key={item.key}
            onClick={() => setPage(item.key)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: page === item.key
                ? theme === 'dark' ? '#1a2040' : '#eef2ff'
                : 'transparent',
              color: page === item.key
                ? '#6366f1'
                : theme === 'dark' ? '#4b5563' : '#9ca3af',
            }}
          >
            {item.label}
          </button>
        ))}

        {/* Right side — profile, click to open Settings */}
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setPage('settings')}
            onMouseEnter={e => { if (page !== 'settings') e.currentTarget.style.background = theme === 'dark' ? '#151b2e' : '#f5f5f0' }}
            onMouseLeave={e => { if (page !== 'settings') e.currentTarget.style.background = 'transparent' }}
            className="flex items-center gap-2 px-2 py-1 rounded-lg transition-colors"
            style={{
              background: page === 'settings'
                ? theme === 'dark' ? '#1a2040' : '#eef2ff'
                : 'transparent',
            }}
          >
            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-indigo-600 text-xs font-semibold">{username?.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-sm" style={{color: page === 'settings' ? '#6366f1' : theme === 'dark' ? '#4b5563' : '#9ca3af'}}>{username}</span>
          </button>
        </div>
      </nav>

      {/* Page content */}
      <div className="p-8">
        <div key={page} className="page-transition">
          {page === 'my-schedule' && <EmployeeSchedulePage employeeId={employeeId} theme={theme} />}
          {page === 'my-availability' && <EmployeeAvailabilityPage employeeId={employeeId} theme={theme} />}
          {page === 'my-trades' && <ShiftTradesPage employeeId={employeeId} theme={theme} />}
          {page === 'settings' && <SettingsPage theme={theme} toggleTheme={toggleTheme} handleLogout={handleLogout} username={username} />}
        </div>
      </div>
    </div>
  )
}
}

export default App