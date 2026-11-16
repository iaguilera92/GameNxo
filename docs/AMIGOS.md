# AMIGOS (21-11-2026)

Estado: **solo la pantalla**. No hay cuentas, servidor ni base de datos todavía (decisión pendiente, ver `docs/BASE-DE-DATOS.md`).

## Qué hay
- `frontend/src/domain/friends.ts` (TypeScript puro): `FriendEntry`, `FriendRequest`, `FriendsSnapshot`, la interfaz `FriendsRepository` (`load`, `answer`, `remove`), `offlineFriends` (sin cuenta: vacío, `available = false`), `sampleFriends()` (solo modo desarrollo) y `sortFriends` / `friendStatusText`.
- `frontend/src/ui/FriendsDialog.ts`: la ventana. Pestañas AMIGOS y SOLICITUDES, lista con desplazamiento, INVITAR (por ahora solo avisa), quitar con doble toque, AÑADIR AMIGO y CERRAR. Sin modo desarrollo usa `offlineFriends` (vacía con aviso); con modo desarrollo, amigos de ejemplo para revisar el diseño.
- `frontend/src/ui/FriendsButton.ts`: la card AMIGOS del menú (ya no está bloqueada); punto rojo si hay solicitudes.

## Qué falta (necesita servidor)
- Repositorio real contra el servidor (mismo contrato `FriendsRepository`; la pantalla no cambia).
- Añadir por código o nombre (hace falta un campo de texto: Phaser no trae uno; se haría con un input del DOM).
- INVITAR a una amistosa: sala privada entre dos cuentas (`docs/MULTIJUGADOR.md`).
- Estado en línea / en partida en tiempo real.
- Reglas a decidir: límite de amigos, si hay ranking entre amigos, si se ve el perfil del amigo al tocarlo.