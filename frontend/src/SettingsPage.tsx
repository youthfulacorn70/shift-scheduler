import { Sun, Moon, LogOut, Globe } from 'lucide-react'
import { useTranslation } from './i18n'

interface SettingsPageProps {
  theme: string
  toggleTheme: () => void
  handleLogout: () => void
  username: string | null
}

function SettingsPage({ theme, toggleTheme, handleLogout, username }: SettingsPageProps) {
  const { t, language, setLanguage } = useTranslation()

  const text = theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
  const subtext = theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  const card = theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
  const rowBorder = theme === 'dark' ? 'border-gray-700' : 'border-gray-100'

  return (
    <div className={text}>
      <h1 className="text-2xl font-bold mb-1">{t('settings.title')}</h1>
      <p className={`text-sm mb-6 ${subtext}`}>{t('settings.signedInAs')} {username}</p>

      <div className={`${card} rounded-lg shadow divide-y ${rowBorder}`}>

        {/* Theme */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            {theme === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
            <div>
              <p className="text-sm font-medium">{t('settings.theme')}</p>
              <p className={`text-xs ${subtext}`}>{theme === 'dark' ? t('settings.darkMode') : t('settings.lightMode')}</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="text-sm px-4 py-1.5 rounded-lg border transition-colors"
            style={{
              borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
              color: theme === 'dark' ? '#e2e8f0' : '#374151',
            }}
          >
            {theme === 'dark' ? t('settings.switchToLight') : t('settings.switchToDark')}
          </button>
        </div>

        {/* Language */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <Globe size={18} strokeWidth={1.75} />
            <div>
              <p className="text-sm font-medium">{t('settings.language')}</p>
              <p className={`text-xs ${subtext}`}>{t('settings.languageDesc')}</p>
            </div>
          </div>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border outline-none"
            style={{
              borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
              color: theme === 'dark' ? '#e2e8f0' : '#374151',
              background: theme === 'dark' ? '#1a2236' : '#f9fafb',
            }}
          >
            <option value="en">{t('lang.english')}</option>
            <option value="fr">{t('lang.french')}</option>
            <option value="zh">{t('lang.mandarin')}</option>
          </select>
        </div>

        {/* Log out */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <LogOut size={18} strokeWidth={1.75} />
            <div>
              <p className="text-sm font-medium">{t('settings.logout')}</p>
              <p className={`text-xs ${subtext}`}>{t('settings.logoutDesc')}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
          >
            {t('settings.logout')}
          </button>
        </div>

      </div>
    </div>
  )
}

export default SettingsPage