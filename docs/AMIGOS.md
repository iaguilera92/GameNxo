# AMIGOS (21-11-2026)

Estado (27-11-2026): **amigos reales entre invitados** con el servidor (modo en línea). Sin base de datos todavía: archivo JSON en el servidor.

## Cómo funciona (27-11-2026)
- Cada teléfono tiene un id secreto (`riskPlayerId`, el del Modo Riesgo). El servidor le da un id público (el que ven los amigos) y un **código NOMBRE#111** (números seguidos desde 111).
- Servidor: `backend/src/friends/friendsStore.ts` y `backend/src/api/friendsRoutes.ts` (`/api/friends/:deviceId/...`: sync, request, answer, remove, gift, take). Datos en `data/friends.json` (`FRIENDS_DATA_FILE`). Pruebas: `backend/test/friends.test.ts`.
- Juego: `frontend/src/net/friendsApi.ts` (repositorio del servidor). La ventana muestra TU CÓDIGO (tocar = copiar) y AÑADIR AMIGO pide el código del otro (`ui/AddFriendDialog.ts`).
- Regalos: uno por amigo y día; el servidor decide las monedas y las entrega una vez; se suman en el teléfono.
- En línea = sincronizó hace menos de 3 minutos (el menú sincroniza al entrar y cada minuto).
- SUGERENCIAS (27-11-2026): hasta 10 jugadores registrados (vistos en 7 días) que no son tus amigos; en línea primero, luego nivel parecido. AGREGAR = solicitud por id.
- Límites: 100 amigos, 50 solicitudes, 30 regalos sin abrir.
- DUELO (27-11-2026): reto de 30 s al amigo en línea (`ui/DuelDialogs.ts`); al aceptar, sala privada del servidor (`FindRequest.key`) y 1v1. Rechazar obliga al que retó a esperar 30 s, luego 1 min, 2 min… (máx. 30 min; se reinicia al aceptar o tras 1 h).
- Si se borran los datos de la app se pierde el invitado (y sus amigos) hasta que existan cuentas.

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