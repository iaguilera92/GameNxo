# Base de datos y cuentas: viene pronto

Se va a añadir una base de datos con cuentas. Cada cuenta guardará lo que compró y lo que tiene equipado (ESPECIAL, DEFENSIVO,
ULTI, efecto de carga, color), y el servidor lo validará y se lo mostrará al rival. Antes de tocar poderes, tienda, perfil o el
protocolo del partido, lee `docs/BASE-DE-DATOS.md` (lo que ya existe, lo que falta y las reglas).

Reglas mínimas:

- **El id de un poder no se cambia nunca.** El nombre visible va aparte. Si hay que renombrar, se añade la migración en
  `frontend/src/domain/migrate.ts` (ejemplo: `smash:star` → `smash:light`).
- Lo que se guarda por cuenta va en `frontend/src/domain/` (TypeScript puro, sin Phaser ni DOM) y pasa por `PlayerRepository`.
- Un poder nuevo se define en un solo sitio con su id fijo; evita repartir sus colores y sonidos en más tablas.
- Nada de compras, nivel, monedas ni poderes se decide en el cliente: el servidor lo valida con `domain/operations.ts`.
- **Rareza (normal · especial · épica · legendaria):** cada habilidad, poder o ítem NUEVO se crea PREGUNTANDO ANTES al usuario qué rareza tiene; no la asumas. Hoy: ULTIS, poderes del ESPECIAL y del DEFENSIVO son especiales (el DESTELLO, normal); estilos y cargando golpe aún sin clasificar (ItemRarity en domain/shopCatalog.ts).
- Motor de base de datos, inicio de sesión y qué hacer con los perfiles de `localStorage` no están decididos: pregunta antes.
