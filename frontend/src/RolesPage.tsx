// RolesPage.tsx
import { apiFetch } from './api'
import { useState, useEffect } from 'react'
import { useTranslation } from './i18n'

interface Role {
  id: number
  name: string
}

interface RoleUsage {
  employee_count: number
  shift_count: number
}

function RolesPage({ theme = 'light' }: { theme?: string }) {
  const { t } = useTranslation()
  const [roles, setRoles] = useState<Role[]>([])
  const [name, setName] = useState('')
  const [deletingRole, setDeletingRole] = useState<Role | null>(null)
  const [usage, setUsage] = useState<RoleUsage | null>(null)

  useEffect(() => {
    apiFetch(`/roles`)
      .then(res => res.json())
      .then(data => setRoles(data))
  }, [])

  const addRole = () => {
    apiFetch(`/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
      .then(res => res.json())
      .then(newRole => {
        setRoles([...roles, newRole])
        setName('')
      })
  }

  const handleDeleteClick = (role: Role) => {
    apiFetch(`/roles/${role.id}/usage`)
      .then(res => res.json())
      .then(data => {
        setUsage(data)
        setDeletingRole(role)
      })
  }

  const confirmDelete = () => {
    if (!deletingRole) return
    apiFetch(`/roles/${deletingRole.id}`, { method: 'DELETE' })
      .then(() => {
        setRoles(roles.filter(r => r.id !== deletingRole.id))
        setDeletingRole(null)
        setUsage(null)
      })
  }

  const card = theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
  const text = theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
  const subtext = theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  const input = theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900'
  const divider = theme === 'dark' ? 'border-gray-700' : 'border-gray-100'

  return (
    <div className={text}>
      <h1 className="text-2xl font-bold mb-4">{t('roles.title')}</h1>

      {deletingRole && usage && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className={`${card} rounded-lg shadow-lg p-6 max-w-sm w-full`}>
            <p className={`font-semibold mb-2 ${text}`}>{t('roles.deletePrefix')} "{deletingRole.name}"?</p>
            {(usage.employee_count > 0 || usage.shift_count > 0) ? (
              <div className="bg-orange-50 border border-orange-200 rounded p-3 mb-4 text-sm">
                <p className="text-orange-700 font-semibold mb-1">{t('roles.inUse')}</p>
                {usage.employee_count > 0 && (
                  <p className="text-orange-600">{t('roles.assignedToEmployee')} {usage.employee_count} {usage.employee_count > 1 ? t('roles.employees') : t('roles.employee')}</p>
                )}
                {usage.shift_count > 0 && (
                  <p className="text-orange-600">{t('roles.requiredByShift')} {usage.shift_count} {usage.shift_count > 1 ? t('roles.shifts') : t('roles.shift')}</p>
                )}
                <p className="text-orange-500 text-xs mt-2">{t('roles.deleteWarningDetail')}</p>
              </div>
            ) : (
              <p className={`text-sm mb-4 ${subtext}`}>{t('roles.safeToDelete')}</p>
            )}
            <div className="flex gap-3">
              <button onClick={confirmDelete} className="bg-red-500 text-white px-4 py-2 rounded-lg">{t('roles.delete')}</button>
              <button onClick={() => { setDeletingRole(null); setUsage(null) }} className={`px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}>{t('roles.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      <div className={`${card} p-4 rounded-lg shadow mb-6`}>
        <h2 className={`text-lg font-semibold mb-3 ${text}`}>{t('roles.createRole')}</h2>
        <div className="flex gap-2">
          <input
            className={`border rounded-lg px-3 py-2 text-sm outline-none flex-1 ${input}`}
            placeholder={t('roles.namePlaceholder')}
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <button onClick={addRole} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
            {t('roles.add')}
          </button>
        </div>
      </div>

      <div className={`${card} rounded-lg shadow`}>
        {roles.length === 0 && <p className={`p-4 ${subtext}`}>{t('roles.noRoles')}</p>}
        {roles.map(role => (
          <div key={role.id} className={`p-4 border-b flex justify-between items-center ${divider}`}>
            <span className={`font-medium ${text}`}>{role.name}</span>
            <button onClick={() => handleDeleteClick(role)} className="text-red-400 hover:text-red-500 text-sm transition-colors">
              {t('roles.delete')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default RolesPage