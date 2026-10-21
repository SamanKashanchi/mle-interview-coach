// Web Push on this device: the service worker (public/sw.js) shows the notifications that the
// send-reminders edge function sends. iPhone only allows this for an app added to the Home Screen.

import { db, isMock } from './db'

/** Public half of the VAPID key pair; the private half is in Supabase Vault. */
const VAPID_PUBLIC_KEY = 'BGfh57zPOr9S8d99ndLuDSTocyQnI3WQbYaGFEZqVgrLgoTg70rqqD56qa1lJjI3cNxuvYGDBFnP9Aj0_U_D8xQ'

export type PushState =
  | 'unsupported' // this browser can't do push at all
  | 'needs-install' // iPhone/iPad in Safari: add to Home Screen first
  | 'denied' // the user blocked notifications for this app
  | 'off' // can turn on
  | 'on' // subscribed on this device

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || isMock) return
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Push just stays unavailable.
  })
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

export async function pushState(): Promise<PushState> {
  if (isMock) return mockOn ? 'on' : 'off'
  if (!supported()) return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const sub = await currentSubscription()
  if (sub) {
    await db.savePushSubscription(toInput(sub)) // keeps the server copy current
    return 'on'
  }
  return 'off'
}

let mockOn = false

export async function turnOn(): Promise<PushState> {
  if (isMock) {
    mockOn = true
    return 'on'
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'))
  await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) }))
  await db.savePushSubscription(toInput(sub))
  return 'on'
}

export async function turnOff(): Promise<PushState> {
  if (isMock) {
    mockOn = false
    return 'off'
  }
  const sub = await currentSubscription()
  if (sub) {
    await db.removePushSubscription(sub.endpoint)
    await sub.unsubscribe()
  }
  return 'off'
}

function toInput(sub: PushSubscription) {
  const json = sub.toJSON()
  return { endpoint: sub.endpoint, p256dh: json.keys!.p256dh, auth: json.keys!.auth, device: deviceName() }
}

function deviceName() {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua) || isIOS()) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows'
  return 'Browser'
}

function base64UrlToBytes(s: string) {
  const b64 = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}
