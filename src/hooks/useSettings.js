import { useState, useCallback } from 'react'
import { storage } from '../utils/storage'

const DEFAULTS = {
  googleClientId: '',
  anthropicKey: '',
  googleConnected: false,
  googleToken: null,
  googleTokenExpiry: null,
  googleEmail: '',
  visionStatement: '',
  celebrationsEnabled: true,
  focusTimerMinutes: 25,
}

export function useSettings() {
  const [settings, setSettings] = useState(() => ({ ...DEFAULTS, ...storage.get('settings', {}) }))

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value }
      storage.set('settings', updated)
      return updated
    })
  }, [])

  const saveSettings = useCallback((updates) => {
    setSettings(prev => {
      const updated = { ...prev, ...updates }
      storage.set('settings', updated)
      return updated
    })
  }, [])

  const saveGoogleToken = useCallback((token, expiresIn) => {
    const expiry = Date.now() + (expiresIn * 1000)
    saveSettings({ googleToken: token, googleTokenExpiry: expiry, googleConnected: true })
  }, [saveSettings])

  // The hour is up: drop the token but stay linked, so screens offer a
  // one-tap refresh instead of a full reconnect.
  const expireGoogleToken = useCallback(() => {
    saveSettings({ googleToken: null, googleTokenExpiry: null })
  }, [saveSettings])

  // Disconnect: forget everything about the Google link on this device.
  const clearGoogleToken = useCallback(() => {
    saveSettings({ googleToken: null, googleTokenExpiry: null, googleConnected: false, googleEmail: '' })
  }, [saveSettings])

  const isGoogleTokenValid = () => {
    if (!settings.googleToken || !settings.googleTokenExpiry) return false
    return Date.now() < settings.googleTokenExpiry - 60000
  }

  return {
    settings,
    updateSetting,
    saveSettings,
    saveGoogleToken,
    expireGoogleToken,
    clearGoogleToken,
    isGoogleTokenValid,
  }
}
