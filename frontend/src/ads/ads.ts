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
  };
}

let provider: AdsProvider | undefined;
let lastInterstitialAt = 0;
const AD_TIMEOUT_MS = 12_000;
const INTERSTITIAL_COOLDOWN_MS = 90_000;

/** Adaptador que se conectará al SDK nativo cuando se creen las cuentas de anuncios. */
export function registerAdsProvider(next: AdsProvider) {
  provider = next;
}

function adUnit(kind: 'interstitial' | 'rewarded') {
  const ios = Capacitor.getPlatform() === 'ios';
  return kind === 'interstitial'
    ? (ios ? settings.iosInterstitial : settings.androidInterstitial)
    : (ios ? settings.iosRewarded : settings.androidRewarded);
}

function activeProvider() {
  return settings.enabled && typeof navigator !== 'undefined' && navigator.onLine
    ? provider ?? window.GameNxoAds
    : undefined;
}

export function canShowRewardedAds() {
  return Boolean(activeProvider() && adUnit('rewarded'));
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
  const id = adUnit('rewarded');
  if (!sdk || !id) return false;
  try {
    return (await withTimeout(sdk.showRewarded({ placement, adUnitId: id }))) === true;
  } catch {
    return false;
  }
}
