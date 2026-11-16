---
title: Preferencias de interfaz por rol
description: Cómo la página de aterrizaje por defecto de un rol y su navegación vertical oculta moldean la sesión al iniciar sesión y al suplantar, qué valores se aceptan y qué nunca cambia la ruta que pidió el usuario.
---

## Por qué existe

Un rol suele implicar una forma de trabajar. Un rol de back-office aterriza en un panel de control. Un rol de quiosco no necesita una barra lateral y solo debe llegar a unas pocas páginas. Sin un mecanismo, todos los usuarios aterrizan en la misma raíz y cada rol restringido necesita una estructura a medida.

El rol lleva dos preferencias, que se editan en la pantalla de roles de IAM, y el frontend las aplica cada vez que se establece una sesión.

## Cómo funciona

| Campo del rol | Efecto |
| --- | --- |
| `defaultRedirection` | La ruta en la que aterriza el usuario después de iniciar sesión. Vacío significa la raíz de la aplicación. |
| `hasHiddenVerticalNavigation` | Colapsa la navegación vertical (la barra lateral) para los usuarios con este rol. `null` se lee como `false`. |

### De dónde sale la página de aterrizaje

Cuando se establece una sesión, la ruta de aterrizaje es la primera de estas que sea válida:

1. Un valor `?redirectURL=` con el que se rebotó el flujo de inicio de sesión.
2. La `defaultRedirection` del **primer rol**, en el orden en que el servidor devuelve los roles de la cuenta, cuyo valor no esté vacío.
3. La raíz de la aplicación, `/`.

Un valor solo se acepta si es una ruta del mismo origen: empieza por una única `/`, no es relativo al protocolo (`//`), no contiene barras invertidas y no es una URL absoluta `http://` o `https://`. Un valor que no cumple no aborta el flujo: pasa al siguiente candidato. La descripción del campo del rol habla de "URLs absolutas", pero el frontend las ignora a propósito, de modo que un valor de rol editado en la pantalla de administración no pueda convertirse en una redirección abierta. Si el usuario no tiene permiso para la ruta de aterrizaje, el guard de permisos lo envía a `/`.

### De dónde sale la preferencia de la barra lateral

La preferencia es el **OR entre los roles del usuario**: si algún rol oculta la navegación, queda oculta. Colapsa la barra lateral una vez en esa sesión. Si una sesión posterior no pide el colapso, la barra lateral vuelve al estado que tenía el usuario antes del colapso forzado, de modo que un colapso forzado no persista en el estado guardado de la barra. Por ejemplo, un operador que suplanta una cuenta con navegación oculta y luego termina la suplantación recupera su propia barra lateral.

### Cuándo se ejecuta

Las preferencias se aplican en los tres puntos en los que se establece una sesión: un inicio de sesión local correcto, el comienzo de una suplantación y su final. No se aplican nunca en un arranque en frío, una recarga de página o una renovación transparente del token, porque esos casos no deben apartar al usuario de la ruta que pidió.

La espera está acotada. Si la cuenta no termina de cargar en 15 segundos, el usuario aterriza en la redirección explícita o en `/`, nunca en un valor de rol en el que no se pudo confiar, y la barra lateral no se toca.

## Cuándo aplica

- Configuras un rol que debe aterrizar en una pantalla concreta, o funcionar sin barra lateral.
- Un usuario informa de que aterriza en la página equivocada tras iniciar sesión: revisa el orden de los roles, porque gana el primer rol con valor.
- Un usuario aterriza en `/` tras iniciar sesión aunque su rol tiene un valor: el valor no es una ruta del mismo origen, o el usuario no tiene permiso para ella.

## Compromisos y límites

- Ocultar la navegación no quita acceso. Solo simplifica la interfaz: los permisos siguen decidiendo qué puede abrir un usuario.
- El orden de los roles es el del servidor. Con varios roles que declaran una página de aterrizaje, solo se aplica el primero.

## Relacionado

- [Estrategias de autenticación](../../backend/authentication-strategies/)
- [Impersonación de cuentas](../../backend/account-impersonation/)
