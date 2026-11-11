import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { AdMob, AdmobConsentDebugGeography, AdmobConsentStatus, InterstitialAdPluginEvents, RewardAdPluginEvents } from '@capacitor-community/admob';
import { getAdsConfig, registerAdsPrivacy, registerAdsProvider, type AdsProvider } from './ads';

/**
 * Adaptador de Google AdMob (@capacitor-community/admob v6, compatible con Capacitor 6).
 * Solo en la app nativa: en la web (Netlify) no se registra y los botones con anuncio no aparecen.
 * Precarga un recompensado y un interstitial; tras mostrarse cada uno, carga el siguiente.
 */

const LOAD_TIMEOUT_MS = 10_000;
let testMode = true;
let rewardedReady = false;
let interstitialReady = false;
let loadingRewarded: Promise<boolean> | undefined;
let loadingInterstitial: Promise<boolean> | undefined;

function timeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}

function loadRewarded(adId: string): Promise<boolean> {
  if (rewardedReady) return Promise.resolve(true);
  loadingRewarded ??= AdMob.prepareRewardVideoAd({ adId, isTesting: testMode })
    .then(() => (rewardedReady = true))
    .catch(() => false)
    .finally(() => (loadingRewarded = undefined));
  return loadingRewarded;
}

function loadInterstitial(adId: string): Promise<boolean> {
  if (interstitialReady) return Promise.resolve(true);
  loadingInterstitial ??= AdMob.prepareInterstitial({ adId, isTesting: testMode })
    .then(() => (interstitialReady = true))
    .catch(() => false)
    .finally(() => (loadingInterstitial = undefined));
  return loadingInterstitial;
}

/** Espera a que el anuncio a pantalla completa se cierre (o falle). Sin límite de tiempo: un video dura lo que dura. */
function waitClose(
  events: { dismissed: string; failed: string; reward?: string },
): { done: Promise<boolean>; ready: Promise<void> } {
  const handles: PluginListenerHandle[] = [];
  let earned = false;
  let finish!: (v: boolean) => void;
  const done = new Promise<boolean>((r) => (finish = r));
  const add = (name: string, fn: () => void) =>
    (AdMob.addListener as (n: string, f: () => void) => Promise<PluginListenerHandle>)(name, fn).then((h) => handles.push(h));
  const end = (v: boolean) => {
    handles.forEach((h) => void h.remove());
    finish(v);
  };
  const ready = Promise.all([
    add(events.dismissed, () => end(earned)),
    add(events.failed, () => end(false)),
    events.reward ? add(events.reward, () => (earned = true)) : Promise.resolve(),
  ]).then(() => undefined);
  return { done, ready };
}

const admobProvider: AdsProvider = {
  async showRewarded({ adUnitId }) {
    if (!(await timeout(loadRewarded(adUnitId), LOAD_TIMEOUT_MS, false))) return false;
    const close = waitClose({
      dismissed: RewardAdPluginEvents.Dismissed,
      failed: RewardAdPluginEvents.FailedToShow,
      reward: RewardAdPluginEvents.Rewarded,
    });
    await close.ready;
    rewardedReady = false;
    // La promesa nativa solo se resuelve al ganar el premio: el resultado sale de los eventos.
    AdMob.showRewardVideoAd().catch(() => undefined);
    const earned = await close.done;
    void loadRewarded(adUnitId);
    return earned;
  },
  async showInterstitial({ adUnitId }) {
    if (!(await timeout(loadInterstitial(adUnitId), LOAD_TIMEOUT_MS, false))) throw new Error('ad_not_ready');
    const close = waitClose({
      dismissed: InterstitialAdPluginEvents.Dismissed,
      failed: InterstitialAdPluginEvents.FailedToShow,
    });
    await close.ready;
    interstitialReady = false;
    AdMob.showInterstitial().catch(() => undefined);
    await close.done;
    void loadInterstitial(adUnitId);
  },
};

/**
 * Consentimiento (UMP, mensaje "RGPD" configurado en AdMob > Privacidad y mensajes): pide el estado y, si la ley lo exige
 * (UE / Reino Unido / Suiza), muestra el formulario. En Chile normalmente devuelve NOT_REQUIRED y no se ve nada.
 * Devuelve false solo si el consentimiento sigue pendiente (el jugador cerró sin elegir): entonces no se piden anuncios.
 */
async function gatherConsent(cfg: ReturnType<typeof getAdsConfig>): Promise<boolean> {
  try {
    let info = await AdMob.requestConsentInfo(
      cfg.consentDebugEea ? { debugGeography: AdmobConsentDebugGeography.EEA, testDeviceIdentifiers: cfg.testDevices } : undefined,
    );
    if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) info = await AdMob.showConsentForm();
    // donde el aviso aplica, AJUSTES ofrece volver a elegir (requisito de Google en la UE)
    const applies = info.status === AdmobConsentStatus.OBTAINED || info.status === AdmobConsentStatus.REQUIRED;
    registerAdsPrivacy(applies ? reopenConsent : undefined);
    return info.status !== AdmobConsentStatus.REQUIRED;
  } catch {
    // sin mensaje de consentimiento configurado / sin red: se sigue (el SDK decide qué anuncios puede servir)
    return true;
  }
}

/** AJUSTES > PRIVACIDAD DE ANUNCIOS: borra la elección y vuelve a mostrar el formulario. */
async function reopenConsent() {
  const cfg = getAdsConfig();
  await AdMob.resetConsentInfo();
  const ok = await gatherConsent(cfg);
  registerAdsProvider(ok ? admobProvider : undefined);
}

/** Inicializa AdMob al arrancar la app. No bloquea el juego: cualquier fallo deja los anuncios apagados. */
export async function installAdMob() {
  const cfg = getAdsConfig();
  if (!cfg.enabled || !Capacitor.isNativePlatform()) return;
  testMode = cfg.testMode;
  try {
    // tus teléfonos de prueba (VITE_ADMOB_TEST_DEVICES) reciben anuncios de prueba también en el build de producción
    await AdMob.initialize({ initializeForTesting: testMode || cfg.testDevices.length > 0, testingDevices: cfg.testDevices });
    // primero el consentimiento; sin él (pendiente en la UE) no se carga ningún anuncio
    if (!(await gatherConsent(cfg))) return;
    registerAdsProvider(admobProvider);
    if (cfg.rewardedId) void loadRewarded(cfg.rewardedId);
    if (cfg.interstitialId) void loadInterstitial(cfg.interstitialId);
  } catch {
    // AdMob no disponible: el juego sigue sin anuncios.
  }
}
