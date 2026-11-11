import { Capacitor } from '@capacitor/core';

export type AdPlacement = 'match_victory' | 'wheel_reward_bonus' | 'daily_reward' | 'daily_reward_bonus';
export interface AdsProvider {
  showInterstitial(options: { placement: AdPlacement; adUnitId: string }): Promise<void>;
  /** `true` solo cuando el SDK confirma que el usuario completó el anuncio recompensado. */
  showRewarded(options: { placement: AdPlacement; adUnitId: string }): Promise<boolean>;
}

declare global {
  interface Window { GameNxoAds?: AdsProvider }
}

const settings = {
  enabled: import.meta.env.VITE_ADS_ENABLED === 'true',
  androidAppId: import.meta.env.VITE_ADMOB_ANDROID_APP_ID ?? '',
  iosAppId: import.meta.env.VITE_ADMOB_IOS_APP_ID ?? '',
  androidInterstitial: import.meta.env.VITE_ADMOB_ANDROID_INTERSTITIAL_ID ?? '',
  iosInterstitial: import.meta.env.VITE_ADMOB_IOS_INTERSTITIAL_ID ?? '',
  androidRewarded: import.meta.env.VITE_ADMOB_ANDROID_REWARDED_ID ?? '',
  iosRewarded: import.meta.env.VITE_ADMOB_IOS_REWARDED_ID ?? '',
};

/** IDs listos para inicializar el SDK nativo desde el adaptador de Capacitor. */
export function getAdsConfig() {
  const ios = Capacitor.getPlatform() === 'ios';
  return {
    enabled: settings.enabled,
    appId: ios ? settings.iosAppId : settings.androidAppId,
    interstitialId: adUnit('interstitial'),
    rewardedId: adUnit('rewarded'),
    testMode: import.meta.env.VITE_ADS_TEST_MODE !== 'false',
    /** IDs de tus teléfonos de prueba (separados por coma): ven anuncios de prueba aunque el build sea de producción */
    testDevices: (import.meta.env.VITE_ADMOB_TEST_DEVICES ?? '').split(',').map((s: string) => s.trim()).filter(Boolean),
    /** 'EEA' = simular que el teléfono de prueba está en Europa para ver el aviso de consentimiento */
    consentDebugEea: import.meta.env.VITE_ADMOB_CONSENT_DEBUG === 'EEA',
  };
}

/** Botón "privacidad de anuncios" de AJUSTES: lo registra el adaptador cuando el aviso de consentimiento aplica (UE). */
let privacyHandler: (() => Promise<void>) | undefined;
export function registerAdsPrivacy(fn: (() => Promise<void>) | undefined) {
  privacyHandler = fn;
}
/** true = hay que ofrecer al jugador volver a elegir su consentimiento de anuncios (obligatorio en la UE). */
export function adsPrivacyAvailable() {
  return !!privacyHandler;
}
/** Vuelve a mostrar el formulario de consentimiento de anuncios. */
export function openAdsPrivacy(): Promise<void> {
  return privacyHandler ? privacyHandler().catch(() => undefined) : Promise.resolve();
}

let provider: AdsProvider | undefined;
let lastInterstitialAt = 0;
// Red de seguridad por si el SDK nunca responde. Debe superar la duración de un video (hasta ~30 s) más la carga:
// el adaptador (admobProvider) ya limita la carga a 10 s y espera el cierre real del anuncio.
const AD_TIMEOUT_MS = 120_000;
const INTERSTITIAL_COOLDOWN_MS = 90_000;

/** Adaptador que se conectará al SDK nativo cuando se creen las cuentas de anuncios. */
export function registerAdsProvider(next: AdsProvider | undefined) {
  provider = next;
}

function adUnit(kind: 'interstitial' | 'rewarded') {
  const ios = Capacitor.getPlatform() === 'ios';
  return kind === 'interstitial'
    ? (ios ? settings.iosInterstitial : settings.androidInterstitial)
    : (ios ? settings.iosRewarded : settings.androidRewarded);
}

/**
 * ANUNCIO DE PRUEBA (solo para probar los botones con anuncio sin SDK): activo por defecto con `npm run dev` en el
 * navegador; `localStorage.setItem('dev.adsSim', '0' | '1')` lo apaga / fuerza. Muestra una pantalla negra ~3 s y cuenta
 * como completado. SOLO existe en desarrollo: en cualquier build (web publicada, APK, release) está apagado siempre,
 * así nadie puede cobrar premios x2 sin ver un anuncio de verdad.
 */
function simOn() {
  if (!import.meta.env.DEV) return false;
  try {
    const v = localStorage.getItem('dev.adsSim');
    if (v === '1') return true;
    if (v === '0') return false;
    // en desarrollo (npm run dev, sin app nativa) el anuncio de prueba va por defecto: así los botones x2 se ven y se
    // pueden probar en localhost. La web publicada y la app no lo usan nunca (DEV = false en el build).
    return import.meta.env.DEV && !Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
const simProvider: AdsProvider = {
  showInterstitial: () => simAd(2000).then(() => undefined),
  showRewarded: () => simAd(3000).then(() => true),
};
function simAd(ms: number) {
  return new Promise<void>((resolve) => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font:bold 26px sans-serif;gap:14px';
    d.innerHTML = '<div>ANUNCIO DE PRUEBA</div><div id="n" style="font-size:56px">3</div>';
    document.body.appendChild(d);
    const n = d.querySelector('#n') as HTMLElement;
    const t0 = Date.now();
    const iv = setInterval(() => (n.textContent = String(Math.max(0, Math.ceil((ms - (Date.now() - t0)) / 1000)))), 200);
    setTimeout(() => {
      clearInterval(iv);
      d.remove();
      resolve();
    }, ms);
  });
}

function activeProvider() {
  if (simOn()) return simProvider;
  return settings.enabled && typeof navigator !== 'undefined' && navigator.onLine
    ? provider ?? (import.meta.env.DEV ? window.GameNxoAds : undefined)
    : undefined;
}

export function canShowRewardedAds() {
  return Boolean(activeProvider() && (simOn() || adUnit('rewarded')));
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => globalThis.setTimeout(() => reject(new Error('ad_timeout')), AD_TIMEOUT_MS)),
  ]);
}

/** Anuncio interstitial opcional: el flujo continúa siempre si no está listo o falla. */
export async function showInterstitial(placement: AdPlacement): Promise<boolean> {
  const sdk = activeProvider();
  const id = adUnit('interstitial');
  const now = Date.now();
  if (!sdk || !id || now - lastInterstitialAt < INTERSTITIAL_COOLDOWN_MS) return false;
  lastInterstitialAt = now;
  try {
    await withTimeout(sdk.showInterstitial({ placement, adUnitId: id }));
    return true;
  } catch {
    return false;
  }
}

/** Anuncio recompensado: solo `true` si fue completado; cancelar o fallar no entrega bonus. */
export async function showRewarded(placement: AdPlacement): Promise<boolean> {
  const sdk = activeProvider();
  const id = simOn() ? 'sim' : adUnit('rewarded');
  if (!sdk || !id) return false;
  try {
    return (await withTimeout(sdk.showRewarded({ placement, adUnitId: id }))) === true;
  } catch {
    return false;
  }
}
