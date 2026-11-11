# Balance de las habilidades (Defensivo, Especial, Ulti)

Última medición: 10-11-2026. Herramienta: `frontend/tools/sim-balance.mjs`.

## Cómo medir

Desde `frontend/`:

```
node tools/sim-balance.mjs --exp=all --matches=200 --seed=1
```

- `--exp`: `usage` (cuánto se usa cada habilidad), `impact` (cuánto pesa cada una) o `matrix` (cómo cambian la distancia
  entre niveles). `all` hace los tres. `--tiers=normal,dificil` limita los niveles. La semilla repite el resultado.
- "Qué pasaría si…" sin tocar el juego: `--smashCd=30` (recarga del Especial, s), `--dashCd=8`, `--ultiPts=4` (puntos de la
  Ulti), `--powerSpeed=0.85` o `--powerByTier=0.7,0.75,0.85,0.9,1` (velocidad de los tiros de poder), `--stunS=0.4`
  (aturdimiento), `--weakK=0.8` (devolución tras alcanzar un tiro de poder), `--table=plana|p2` (tablas de uso de
  prueba, en `tools/sim/run.ts`).

Es bot contra bot, sin pantalla. Usa el código real de `ai/BotBrain`, `logic/BotAI`, la física de `objects/Ball`
(`stepBall`, `aimShot`), `logic/Score` y `logic/PowerImpact`. El lado izquierdo usa el mismo cerebro con el campo espejado.

**Lo que NO es real** (valen para comparar configuraciones, no como valor absoluto):
- El saque: la calidad sale de probabilidades, no de pulsaciones.
- La Ulti se ejecuta al instante (sin los 2 s de cinemática ni el desplazamiento).
- No hay Zona ni jugador humano (los dos lados son el mismo cerebro), ni Perfect Timing, ni estiradas.
- La pared del fondo no se simula (da los mismos resultados que el 2º bote / bote fuera).
- Los niveles altos tienen peloteos larguísimos (hay puntos que se agotan a los 90 s; en la tabla salen como "sin
  resolver"). Eso alarga sus partidos y por tanto sube cuántas veces usan las habilidades.

## Qué se encontró

1. **El bot no usaba el Especial ni la Ulti.** Pedían una calidad de contacto de 0,6, pero el bot golpea en cuanto la pelota
   entra en su alcance, y ahí la calidad es ~0,1 (el 99,8 % de sus golpes está por debajo de 0,3). Se quitó la exigencia
   (`SMASH_AI.minQuality` y `ULTI_AI.minQuality` = 0 en `ai/BotBrain.ts`). Subir las probabilidades por nivel no habría servido.
2. **Con las habilidades funcionando son decisivas.** Un lado con las tres contra uno sin ninguna gana 70-96 % de los
   partidos (según el nivel). El Especial solo gana 60-93 %, la Ulti sola 61-71 %, y el Defensivo solo no pesa (45-50 %).
3. **Cada uso del Especial vale mucho:** gana el 58-73 % de los puntos en que se usa; la Ulti, 79-96 %. La mayoría de los
   tiros de poder no los toca nadie (punto directo) o dejan al rival aturdido con una devolución floja.
4. **Las habilidades agrandan la distancia entre niveles.** Sin habilidades, "experto" le gana a "normal" el 59,5 % de los
   partidos; con habilidades en los dos, el 99 %. Los niveles altos las usan mucho más (experto: ~15 Especiales por
   partido, 86 % de lo que permite la recarga; principiante: ~4).
5. **Sin ajuste, el Especial del nivel más bajo ganaba el 99 % de los puntos en que lo usaba** (un jugador nuevo no llega a
   esa velocidad). Ya aplicado: los niveles bajos lanzan los tiros de poder más lentos (`power` en la tabla `ABIL`:
   0,7 / 0,75 / 0,85 / 0,9 / 1). Con eso baja a ~58 % en principiante y ~60 % en fácil.

## Decisiones pendientes (valores que puso el diseño)

Probados con la simulación, sobre el estado actual (Especial 20 s, Ulti 3 puntos):

| Cambio | Efecto medido (nivel "normal", lado con habilidades contra lado sin ellas) |
|---|---|
| Especial 30 s y Ulti 4 puntos | casi no cambia: sigue en 94-99 % (el Especial pesa por cada uso, no por cuántas veces se usa) |
| Especial 120 s (≈ 1-2 por partido) | Especial solo 65 %, todas 91 % |
| Ulti 5 puntos | la Ulti sola baja a 55-69 %; todas siguen en 95-100 % |
| Tiros de poder más lentos (×0,85) | Especial por uso 73-85 % en niveles bajos y 52 % en experto; todas 66-95 % |
| Tiros de poder ×0,7 | el Especial deja de pesar en normal/experto (~50 %) |
| Tabla de uso plana + Especial efectivo 30 s | experto vs normal 92 % (antes 99 %) |

Conclusión: lo que más mueve el resultado es **cuánto vale cada tiro de poder** (velocidad, aturdimiento, devolución floja),
no la recarga. Si se quiere que las habilidades pesen pero no decidan, hay que bajar el valor de cada tiro (por ejemplo
`SMASH_SPEED_MULT` en `config.ts`, o `POWER_IMPACT.stunMs` en `logic/PowerImpact.ts`) y comprobarlo con la simulación.
Esos valores afectan también al jugador, por eso no se tocaron sin decidirlo.
