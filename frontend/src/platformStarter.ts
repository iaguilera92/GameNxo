import { Capacitor } from '@capacitor/core';
import { setStarterSkin } from './domain/playerStore';

/**
 * Personaje con el que empieza un jugador NUEVO: Nxo en la app (APK); Mai en la web (navegador).
 * Va en el PRIMER import de main.ts para que se fije antes de que nada cargue el perfil. Las partidas ya guardadas
 * conservan su personaje.
 */
setStarterSkin(Capacitor.isNativePlatform() ? 'nxo' : 'mai');
