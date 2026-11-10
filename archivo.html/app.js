// Nombre único que localStorage usa como clave para encontrar la lista de reservas.
// Si cambia esta clave, el navegador buscará otra lista y las reservas anteriores seguirán bajo la clave antigua.
const STORAGE_KEY = 'quinesiomed-reservas-v1';

// Para habilitar usuarios reales, conecta estas rutas al servidor y cambia mode a 'server'.
// El servidor debe enviar un código al contacto ya verificado del paciente, crear una
// sesión segura (cookie HttpOnly) y asociar las citas al usuario autenticado, nunca al RUT recibido.
// Configuración central de la agenda. Object.freeze evita que el resto del código la cambie por accidente.
const AGENDA_CONFIG = Object.freeze({
    mode: 'local',
    apiBaseUrl: '/api',
    authRequestPath: '/auth/solicitar-codigo',
    authVerifyPath: '/auth/verificar-codigo',
    mySessionsPath: '/mi-cuenta/sesiones'
});

// Con querySelector guardamos referencias a los elementos HTML que JavaScript necesita actualizar.
// Los nombres que empiezan con "Input" son campos donde el paciente escribe o selecciona información.
const formulario = document.querySelector('#formulario-reserva');
const botonReservar = formulario.querySelector('button[type="submit"]');
const fechaInput = document.querySelector('#fecha');
const horaInput = document.querySelector('#hora');
const rutReservaInput = document.querySelector('#rut-reserva');
const nombreInput = document.querySelector('#nombre');
const telefonoInput = document.querySelector('#telefono');
const formularioUsuario = document.querySelector('#formulario-usuario');
const rutUsuarioInput = document.querySelector('#rut-usuario');
const codigoInput = document.querySelector('#codigo-verificacion');
const grupoCodigo = document.querySelector('#grupo-codigo');
const botonConsultar = document.querySelector('#boton-consultar');
const lista = document.querySelector('#lista-reservas');
const estadoVacio = document.querySelector('#estado-vacio');
const contador = document.querySelector('#contador');
const mensaje = document.querySelector('#mensaje');

/**
 * Quita puntos, guiones y espacios del RUT y convierte la letra K a mayúscula.
 * Así se pueden comparar entradas como "12.345.678-5" y "123456785" con el mismo formato.
 * @param {string} valor Texto que escribió el usuario.
 * @returns {string} RUT compacto, sin separadores.
 */
function normalizarRut(valor) {
    return valor.replace(/[.\-\s]/g, '').toUpperCase();
}

/**
 * Comprueba el formato y el dígito verificador de un RUT chileno usando el algoritmo módulo 11.
 * Multiplica los dígitos del cuerpo por factores que se repiten de 2 a 7, suma esos productos
 * y calcula el dígito esperado. El RUT solo se acepta si ese dígito coincide con el ingresado.
 * Esta validación detecta errores de escritura; por sí sola no demuestra quién es la persona.
 * @param {string} valor RUT con o sin puntos y guion.
 * @returns {boolean} true si el formato y el dígito verificador son válidos.
 */
function rutValido(valor) {
    const rut = normalizarRut(valor);
    if (!/^\d{7,8}[0-9K]$/.test(rut)) return false; // Exige 7 u 8 dígitos y un verificador numérico o K.
    const cuerpo = rut.slice(0, -1); // Separa el número principal del dígito verificador.
    let suma = 0;
    let factor = 2;
    for (let i = cuerpo.length - 1; i >= 0; i--) { // Recorre el RUT de derecha a izquierda.
        suma += Number(cuerpo[i]) * factor;
        factor = factor === 7 ? 2 : factor + 1;
    }
    const resto = 11 - (suma % 11); // Obtiene el dígito según módulo 11.
    const digito = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
    return rut.endsWith(digito);
}

/**
 * Lee y valida la lista de reservas guardada en el navegador.
 * El try/catch permite iniciar la página aunque el almacenamiento esté vacío o tenga datos dañados.
 * @returns {Array<object>} Reservas con los campos mínimos que necesita la página.
 */
function leerReservasLocales() {
    try {
        const guardadas = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); // JSON transforma el texto almacenado nuevamente en datos.
        return Array.isArray(guardadas) ? guardadas.filter(reserva => // Descarta elementos incompletos para no romper la agenda.
            reserva && typeof reserva.id === 'string' &&
            typeof reserva.fecha === 'string' && typeof reserva.hora === 'string' &&
            typeof reserva.nombre === 'string' && typeof reserva.telefono === 'string'
        ) : [];
    } catch {
        return [];
    }
}

/**
 * Convierte las reservas a texto JSON y las guarda de forma persistente en este navegador.
 * No comparte información con otros dispositivos; para eso se usará la API del servidor.
 * @param {Array<object>} reservas Lista completa que se quiere guardar.
 */
function guardarReservasLocales(reservas) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reservas)); // localStorage solo puede guardar texto, por eso se serializa el arreglo.
    } catch {
        throw new Error('No se pudo guardar. Revisa el espacio disponible del navegador.');
    }
}

/**
 * Envía una petición HTTP al servidor y convierte su respuesta JSON en datos de JavaScript.
 * credentials:'include' permite enviar/recibir la cookie de sesión segura creada al verificar el código.
 * @param {string} url Dirección del endpoint del servidor.
 * @param {object} opciones Método HTTP, encabezados y cuerpo opcionales.
 * @returns {Promise<any>} Datos JSON de la respuesta, o null si el servidor contestó 204.
 */
async function solicitarServidor(url, opciones = {}) {
    const respuesta = await fetch(url, {
        ...opciones,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...opciones.headers }
    });
    if (!respuesta.ok) { // Convierte respuestas 4xx/5xx en errores que los formularios pueden mostrar.
        const error = new Error('No se pudo completar la operación con la agenda.');
        error.status = respuesta.status;
        throw error;
    }
    return respuesta.status === 204 ? null : respuesta.json();
}

// Adaptador: la interfaz utiliza los mismos métodos sin importar dónde se guardan las reservas.
// En modo "server", cada método llama a una ruta HTTP. El servidor debe autorizar cada operación.
const agendaService = AGENDA_CONFIG.mode === 'server' ? {
    // Solicita al servidor que envíe un código de un solo uso al contacto verificado del paciente.
    pedirCodigo: rut => solicitarServidor(`${AGENDA_CONFIG.apiBaseUrl}${AGENDA_CONFIG.authRequestPath}`, {
        method: 'POST', body: JSON.stringify({ rut })
    }),
    // Envía el código; el servidor debe validarlo y establecer una cookie HttpOnly de sesión.
    verificarCodigo: (rut, codigo) => solicitarServidor(`${AGENDA_CONFIG.apiBaseUrl}${AGENDA_CONFIG.authVerifyPath}`, {
        method: 'POST', body: JSON.stringify({ rut, codigo })
    }),
    // Esta ruta debe devolver únicamente las sesiones de la cuenta autenticada por la cookie.
    listar: () => solicitarServidor(`${AGENDA_CONFIG.apiBaseUrl}${AGENDA_CONFIG.mySessionsPath}`),
    // Crea una reserva para la cuenta autenticada. El servidor debe revisar horarios ocupados.
    reservar: datos => solicitarServidor(`${AGENDA_CONFIG.apiBaseUrl}${AGENDA_CONFIG.mySessionsPath}`, {
        method: 'POST', body: JSON.stringify(datos)
    }),
    // Cancela una cita propia; encodeURIComponent protege el identificador al usarlo en la URL.
    cancelar: id => solicitarServidor(`${AGENDA_CONFIG.apiBaseUrl}${AGENDA_CONFIG.mySessionsPath}/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    })
} : (() => {
    // Modo de demostración: carga las citas locales una sola vez y las mantiene en memoria mientras la página está abierta.
    let reservasLocales = leerReservasLocales();
    return {
        // Devuelve la lista local. Sigue siendo async para coincidir con la versión conectada al servidor.
        listar: async () => reservasLocales,
        // Rechaza una hora ya ocupada, crea un identificador simple y guarda la lista actualizada.
        reservar: async datos => {
            if (reservasLocales.some(reserva => reserva.fecha === datos.fecha && reserva.hora === datos.hora)) {
                const error = new Error('Ese horario ya está reservado. Elige otra hora.');
                error.status = 409;
                throw error;
            }
            const reserva = { ...datos, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
            const siguientes = [...reservasLocales, reserva]; // Crea otra lista para conservar la anterior si el guardado falla.
            guardarReservasLocales(siguientes);
            reservasLocales = siguientes;
            return reserva;
        },
        // Quita la reserva indicada y persiste la lista sin esa cita.
        cancelar: async id => {
            const siguientes = reservasLocales.filter(reserva => reserva.id !== id);
            guardarReservasLocales(siguientes);
            reservasLocales = siguientes;
        }
    };
})();

// Estado de la interfaz: citas cargadas, RUT que ya se consultó y RUT que está esperando su código.
let reservas = [];
let rutActual = '';
let rutPendiente = '';

/**
 * Convierte una fecha a AAAA-MM-DD usando la zona horaria del computador.
 * El ajuste evita que toISOString cambie el día cuando la hora local no está en UTC.
 * @param {Date} fecha Fecha que se quiere convertir (por defecto, hoy).
 * @returns {string} Fecha lista para el atributo min/value de un input type="date".
 */
function fechaLocalISO(fecha = new Date()) {
    const zona = fecha.getTimezoneOffset() * 60000;
    return new Date(fecha.getTime() - zona).toISOString().slice(0, 10);
}

/**
 * Combina fecha y hora locales en un objeto Date para comparar horarios y ordenarlos.
 * @param {string} fecha Fecha AAAA-MM-DD.
 * @param {string} hora Hora HH:MM.
 * @returns {Date} Fecha y hora local.
 */
function fechaHora(fecha, hora) {
    return new Date(`${fecha}T${hora}:00`);
}

/**
 * Actualiza el aviso accesible que aparece debajo del formulario.
 * La clase "exito" aplica el color verde para mensajes confirmados.
 * @param {string} texto Mensaje que verá el usuario.
 * @param {boolean} exito Indica si el mensaje representa una operación exitosa.
 */
function mostrarMensaje(texto = '', exito = false) {
    mensaje.textContent = texto;
    mensaje.classList.toggle('exito', exito);
}

/**
 * Dibuja en la página las sesiones del paciente actual, ordenadas por fecha y hora.
 * En modo local filtra por RUT; en modo servidor confía en que la API ya devolvió
 * solamente citas del usuario autenticado. Los elementos se crean con textContent
 * para mostrar los datos como texto, sin interpretar contenido del usuario como HTML.
 */
function renderizarReservas() {
    const propias = AGENDA_CONFIG.mode === 'server'
        ? reservas // El servidor devuelve solo las sesiones del usuario autenticado.
        : rutActual
            ? reservas.filter(reserva => reserva.rut && normalizarRut(reserva.rut) === rutActual)
            : [];
    const ordenadas = [...propias].sort((a, b) => fechaHora(a.fecha, a.hora) - fechaHora(b.fecha, b.hora));
    lista.replaceChildren();
    contador.textContent = String(ordenadas.length);
    estadoVacio.hidden = ordenadas.length > 0;
    estadoVacio.textContent = rutActual ? 'No encontramos sesiones para este RUT.' : 'Consulta con tu RUT para ver tus sesiones.';

    for (const reserva of ordenadas) { // Cada vuelta crea una tarjeta visible para una sesión.
        const fechaObjeto = fechaHora(reserva.fecha, '12:00');
        const dia = fechaObjeto.toLocaleDateString('es-CL', { day: '2-digit' });
        const mes = fechaObjeto.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '');
        const fechaCompleta = fechaObjeto.toLocaleDateString('es-CL', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
        const item = document.createElement('li');
        item.className = 'reserva';
        const bloqueFecha = document.createElement('div');
        bloqueFecha.className = 'fecha-reserva';
        const numeroDia = document.createElement('strong');
        numeroDia.textContent = dia;
        const nombreMes = document.createElement('span');
        nombreMes.textContent = mes;
        bloqueFecha.append(numeroDia, nombreMes);

        const detalle = document.createElement('div');
        detalle.className = 'detalle-reserva';
        const nombre = document.createElement('strong');
        nombre.textContent = reserva.nombre;
        const horario = document.createElement('span');
        horario.textContent = `${fechaCompleta} · ${reserva.hora}`;
        detalle.append(nombre, horario);

        const quitar = document.createElement('button');
        quitar.type = 'button';
        quitar.className = 'quitar-reserva';
        quitar.textContent = 'Cancelar';
        quitar.setAttribute('aria-label', `Cancelar sesión de ${reserva.nombre}, ${fechaCompleta} a las ${reserva.hora}`);
        quitar.addEventListener('click', async () => { // El botón cancela esta cita y vuelve a cargar la lista.
            quitar.disabled = true;
            try {
                await agendaService.cancelar(reserva.id);
                reservas = await agendaService.listar();
                mostrarMensaje('La reserva fue cancelada.', true);
                renderizarReservas();
            } catch {
                quitar.disabled = false;
                mostrarMensaje('No se pudo cancelar la reserva. Inténtalo nuevamente.');
            }
        });

        item.append(bloqueFecha, detalle, quitar);
        lista.append(item);
    }
}

// Consulta de sesiones: en modo local filtra las reservas del navegador por RUT.
// En modo server primero solicita un código y luego lo verifica antes de acceder a la cuenta.
formularioUsuario.addEventListener('submit', async evento => {
    evento.preventDefault(); // Evita que el navegador recargue la página al enviar el formulario.
    mostrarMensaje();
    const rut = normalizarRut(rutUsuarioInput.value);
    if (!rutValido(rut)) {
        rutUsuarioInput.setCustomValidity('Ingresa un RUT chileno válido.');
        rutUsuarioInput.reportValidity();
        rutUsuarioInput.setCustomValidity('');
        return;
    }
    rutUsuarioInput.value = rut;
    botonConsultar.disabled = true;

    try {
        if (AGENDA_CONFIG.mode === 'server') {
            if (!grupoCodigo.hidden && rutPendiente === rut) {
                // Segundo paso de acceso: valida el código y carga los datos permitidos por la sesión.
                await agendaService.verificarCodigo(rut, codigoInput.value.trim());
                rutActual = rut;
                reservas = await agendaService.listar();
                grupoCodigo.hidden = true;
                codigoInput.value = '';
                codigoInput.required = false;
                botonConsultar.textContent = 'Consultar';
                mostrarMensaje('Identidad verificada. Ya puedes gestionar tus sesiones.', true);
            } else {
                // Primer paso de acceso: el servidor envía el código al contacto que ya tiene registrado.
                await agendaService.pedirCodigo(rut);
                rutPendiente = rut;
                grupoCodigo.hidden = false;
                codigoInput.required = true;
                botonConsultar.textContent = 'Verificar código';
                mostrarMensaje('Enviamos un código al contacto registrado en tu cuenta.', true);
                botonConsultar.disabled = false;
                codigoInput.focus();
                return;
            }
        } else {
            // En demostración no hay identidad autenticada: solo se filtra la lista local por el RUT escrito.
            rutActual = rut;
            reservas = await agendaService.listar();
            mostrarMensaje('Mostrando sesiones asociadas a este RUT en este navegador.', true);
        }
        rutReservaInput.value = rutActual;
        botonReservar.disabled = false;
        renderizarReservas();
    } catch (error) {
        mostrarMensaje(error.status === 401
            ? 'El código no es válido o venció. Solicita otro e inténtalo nuevamente.'
            : 'No se pudo verificar o cargar la cuenta. Inténtalo nuevamente.');
    } finally {
        botonConsultar.disabled = false;
    }
});

// Si se cambia el RUT después de pedir un código, ese código ya no corresponde al nuevo usuario.
rutUsuarioInput.addEventListener('input', () => {
    if (AGENDA_CONFIG.mode === 'server' && rutPendiente && normalizarRut(rutUsuarioInput.value) !== rutPendiente) {
        grupoCodigo.hidden = true;
        codigoInput.required = false;
        codigoInput.value = '';
        botonConsultar.textContent = 'Consultar';
        rutPendiente = '';
    }
});

// Impide elegir días anteriores a hoy y deja hoy seleccionado al abrir la agenda.
fechaInput.min = fechaLocalISO();
fechaInput.value = fechaInput.min;
botonReservar.disabled = AGENDA_CONFIG.mode === 'server';

// Reserva una sesión: valida RUT, usuario autenticado (en modo servidor), fecha y hora,
// y luego crea la cita mediante el adaptador local o la API.
formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    mostrarMensaje();
    const rut = normalizarRut(rutReservaInput.value);
    if (!rutValido(rut)) {
        rutReservaInput.setCustomValidity('Ingresa un RUT chileno válido.');
        rutReservaInput.reportValidity();
        rutReservaInput.setCustomValidity('');
        return;
    }
    if (AGENDA_CONFIG.mode === 'server' && rut !== rutActual) { // El formulario no puede reservar para otro RUT.
        mostrarMensaje('Verifica tu identidad en el portal antes de reservar.');
        return;
    }

    const fecha = fechaInput.value;
    const hora = horaInput.value;
    const inicio = fechaHora(fecha, hora);
    if (!fecha || !hora || Number.isNaN(inicio.getTime())) {
        mostrarMensaje('Selecciona una fecha y hora válidas.');
        return;
    }
    if (inicio <= new Date()) {
        mostrarMensaje('Elige un horario futuro para tu sesión.');
        return;
    }

    botonReservar.disabled = true;
    try {
        const datosReserva = { // Datos necesarios para crear la cita; el servidor obtiene el RUT desde la sesión autenticada.
            nombre: nombreInput.value.trim(),
            telefono: telefonoInput.value.trim(),
            fecha,
            hora
        };
        if (AGENDA_CONFIG.mode === 'local') datosReserva.rut = rut; // Solo la demostración guarda el RUT junto a la cita.
        await agendaService.reservar(datosReserva);
        rutActual = rut;
        rutUsuarioInput.value = rut;
        reservas = await agendaService.listar();
        mostrarMensaje('¡Sesión reservada! Ya aparece en tu calendario.', true);
        formulario.reset();
        rutReservaInput.value = rut;
        fechaInput.value = fechaInput.min;
        renderizarReservas();
    } catch (error) {
        if (error.status === 409) {
            mostrarMensaje('Ese horario ya está reservado. Elige otra hora.');
        } else {
            mostrarMensaje(error.message || 'No se pudo guardar la reserva. Inténtalo nuevamente.');
        }
    } finally {
        botonReservar.disabled = false;
    }
});

/**
 * Preparación inicial de la página. El modo local carga las citas guardadas,
 * mientras que el modo servidor espera a que el paciente verifique su identidad.
 */
async function iniciarAgenda() {
    if (AGENDA_CONFIG.mode === 'local') {
        reservas = await agendaService.listar();
        renderizarReservas();
    }
}

// Ejecuta la carga inicial una vez que el navegador terminó de leer este archivo.
iniciarAgenda();
