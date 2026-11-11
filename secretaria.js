// Claves compartidas con app.js: las reservas y sus marcas de recordatorio viven en el navegador.
const CLAVE_RESERVAS = 'quinesiomed-reservas-v1';
const CLAVE_RECORDATORIOS = 'quinesiomed-recordatorios-v1';
const CLAVE_CREDENCIALES = 'quinesiomed-secretaria-credenciales-v1';
const CLAVE_SESION = 'quinesiomed-secretaria-activa-v1';

// Cuenta temporal solo para presentar el flujo mientras la web funciona sin servidor.
// Estas credenciales están visibles en el código y no sirven para proteger pacientes reales.
const CUENTA_TEMPORAL = Object.freeze({ usuario: 'secretaria', clave: 'JJuanalcachofa' });

// Elementos de interfaz: hay una vista de acceso, cambio obligatorio de clave y panel de sesiones.
const vistaAcceso = document.querySelector('#vista-acceso');
const vistaCambioClave = document.querySelector('#vista-cambio-clave');
const vistaAgenda = document.querySelector('#vista-agenda-secretaria');
const formularioAcceso = document.querySelector('#formulario-acceso');
const formularioCambioClave = document.querySelector('#formulario-cambio-clave');
const mensajeAcceso = document.querySelector('#mensaje-acceso');
const mensajeClave = document.querySelector('#mensaje-clave');
const listaSesiones = document.querySelector('#lista-sesiones-secretaria');
const estadoPanel = document.querySelector('#estado-panel');
const sinSesiones = document.querySelector('#sin-sesiones');
const filtroSesiones = document.querySelector('#filtro-sesiones');
const buscarSesion = document.querySelector('#buscar-sesion');

// Recupera las credenciales que la secretaria haya cambiado en este mismo navegador.
function leerCredenciales() {
    try {
        const guardadas = JSON.parse(localStorage.getItem(CLAVE_CREDENCIALES) || 'null');
        return guardadas && guardadas.usuario && guardadas.clave
            ? guardadas
            : { ...CUENTA_TEMPORAL, debeCambiar: true };
    } catch {
        return { ...CUENTA_TEMPORAL, debeCambiar: true };
    }
}

// Lee las citas creadas por agenda.html. La validación básica evita que registros dañados rompan el panel.
function leerSesiones() {
    try {
        const datos = JSON.parse(localStorage.getItem(CLAVE_RESERVAS) || '[]');
        return Array.isArray(datos) ? datos.filter(sesion =>
            sesion && typeof sesion.id === 'string' && typeof sesion.nombre === 'string' &&
            typeof sesion.telefono === 'string' && typeof sesion.fecha === 'string' && typeof sesion.hora === 'string'
        ) : [];
    } catch {
        return [];
    }
}

// Lee el mapa de recordatorios enviados, indexado por el identificador único de cada reserva.
function leerRecordatorios() {
    try {
        const datos = JSON.parse(localStorage.getItem(CLAVE_RECORDATORIOS) || '{}');
        return datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {};
    } catch {
        return {};
    }
}

// Convierte fecha y hora de la reserva a tiempo local para ordenar y filtrar sesiones futuras.
function instanteSesion(sesion) {
    return new Date(`${sesion.fecha}T${sesion.hora}:00`);
}

// Presenta una fecha completa en español de Chile, usando el día local de la reserva.
function formatoFecha(sesion) {
    const fechaLocal = new Date(`${sesion.fecha}T12:00:00`);
    return fechaLocal.toLocaleDateString('es-CL', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
}

// Calcula cuántas horas faltan para la cita; se usa para el filtro de recordatorios próximos.
function horasHasta(sesion, ahora = new Date()) {
    return (instanteSesion(sesion).getTime() - ahora.getTime()) / 3_600_000;
}

// Convierte un teléfono chileno a dígitos internacionales para crear el enlace wa.me.
function telefonoWhatsApp(valor) {
    let digitos = String(valor || '').replace(/\D/g, '');
    if (digitos.startsWith('00')) digitos = digitos.slice(2);
    if (digitos.startsWith('56')) return digitos;
    if (digitos.startsWith('0')) digitos = digitos.slice(1);
    return `56${digitos}`;
}

// Guarda en localStorage la fecha en que la secretaria confirmó que envió el aviso manualmente.
function marcarRecordatorio(id, enviado) {
    const recordatorios = leerRecordatorios();
    if (enviado) {
        recordatorios[id] = { enviadoEn: new Date().toISOString() };
    } else {
        delete recordatorios[id];
    }
    localStorage.setItem(CLAVE_RECORDATORIOS, JSON.stringify(recordatorios));
}

// Muestra el paso adecuado. Las contraseñas y esta sesión local no son un control de acceso de servidor.
function mostrarVista() {
    const credenciales = leerCredenciales();
    const autenticada = sessionStorage.getItem(CLAVE_SESION) === 'si';
    vistaAcceso.hidden = autenticada;
    vistaCambioClave.hidden = !autenticada || credenciales.debeCambiar === false;
    vistaAgenda.hidden = !autenticada || credenciales.debeCambiar !== false;
    if (!vistaAgenda.hidden) dibujarSesiones();
}

// Prepara las citas, aplica el filtro elegido y crea tarjetas con acciones seguras basadas en textContent.
function dibujarSesiones() {
    const ahora = new Date();
    const recordatorios = leerRecordatorios();
    const busqueda = buscarSesion.value.trim().toLocaleLowerCase('es-CL');
    const modo = filtroSesiones.value;
    const sesiones = leerSesiones().sort((a, b) => instanteSesion(a) - instanteSesion(b));
    const proximas = sesiones.filter(sesion => horasHasta(sesion, ahora) >= 0);
    const pendientes = proximas.filter(sesion => horasHasta(sesion, ahora) <= 48 && !recordatorios[sesion.id]);

    document.querySelector('#total-proximas').textContent = String(proximas.length);
    document.querySelector('#total-pendientes').textContent = String(pendientes.length);
    document.querySelector('#total-recordadas').textContent = String(Object.keys(recordatorios).length);
    estadoPanel.textContent = sesiones.length
        ? 'Los cambios se guardan en este navegador.'
        : 'Todavía no hay reservas guardadas en este navegador.';

    let visibles = {
        pendientes,
        proximas,
        recordadas: sesiones.filter(sesion => Boolean(recordatorios[sesion.id])),
        todas: sesiones
    }[modo] || pendientes;

    if (busqueda) {
        visibles = visibles.filter(sesion =>
            [sesion.nombre, sesion.rut, sesion.telefono].some(valor =>
                String(valor || '').toLocaleLowerCase('es-CL').includes(busqueda)
            )
        );
    }

    listaSesiones.replaceChildren();
    sinSesiones.hidden = visibles.length > 0;
    for (const sesion of visibles) listaSesiones.append(crearTarjeta(sesion, recordatorios[sesion.id]));
}

// Construye la tarjeta individual de una cita y su acceso a WhatsApp con un texto ya rellenado.
function crearTarjeta(sesion, recordatorio) {
    const item = document.createElement('li');
    item.className = 'sesion-secretaria';

    const fecha = document.createElement('div');
    fecha.className = 'fecha-panel';
    const numeroDia = document.createElement('strong');
    numeroDia.textContent = new Date(`${sesion.fecha}T12:00:00`).toLocaleDateString('es-CL', { day: '2-digit' });
    const mes = document.createElement('span');
    mes.textContent = new Date(`${sesion.fecha}T12:00:00`).toLocaleDateString('es-CL', { month: 'short' }).replace('.', '');
    fecha.append(numeroDia, mes);

    const detalle = document.createElement('div');
    detalle.className = 'detalle-panel';
    const nombre = document.createElement('strong');
    nombre.textContent = sesion.nombre;
    const fechaHora = document.createElement('span');
    fechaHora.textContent = `${formatoFecha(sesion)} · ${sesion.hora}`;
    const contacto = document.createElement('span');
    contacto.textContent = `Teléfono: ${sesion.telefono}`;
    detalle.append(nombre, fechaHora, contacto);

    const acciones = document.createElement('div');
    acciones.className = 'acciones-panel';
    const enlace = document.createElement('a');
    enlace.className = 'boton-whatsapp';
    enlace.target = '_blank';
    enlace.rel = 'noopener noreferrer';
    enlace.textContent = recordatorio ? 'Abrir WhatsApp otra vez' : 'Abrir WhatsApp';
    const numero = telefonoWhatsApp(sesion.telefono);
    const texto = `Hola ${sesion.nombre}, te recordamos tu sesión en Quinesiomed el ${formatoFecha(sesion)} a las ${sesion.hora}. Si necesitas cambiarla, contáctanos.`;
    enlace.href = `https://wa.me/${encodeURIComponent(numero)}?text=${encodeURIComponent(texto)}`;
    enlace.setAttribute('aria-label', `Preparar recordatorio de ${sesion.nombre} por WhatsApp`);

    const marca = document.createElement('button');
    marca.type = 'button';
    marca.className = recordatorio ? 'boton-marca enviado' : 'boton-marca';
    marca.textContent = recordatorio ? 'Recordatorio enviado' : 'Marcar como enviado';
    marca.addEventListener('click', () => {
        marcarRecordatorio(sesion.id, !recordatorio);
        dibujarSesiones();
    });
    acciones.append(enlace, marca);

    item.append(fecha, detalle, acciones);
    return item;
}

// Comprueba la cuenta temporal del navegador y solicita renovar la contraseña en el primer ingreso.
formularioAcceso.addEventListener('submit', evento => {
    evento.preventDefault();
    const credenciales = leerCredenciales();
    const usuario = document.querySelector('#usuario-secretaria').value.trim();
    const clave = document.querySelector('#clave-secretaria').value;
    if (usuario !== credenciales.usuario || clave !== credenciales.clave) {
        mensajeAcceso.textContent = 'El usuario o la contraseña no coinciden.';
        return;
    }
    sessionStorage.setItem(CLAVE_SESION, 'si');
    mensajeAcceso.textContent = '';
    mostrarVista();
});

// Guarda una nueva contraseña de demostración y abre el panel de sesiones.
formularioCambioClave.addEventListener('submit', evento => {
    evento.preventDefault();
    const nueva = document.querySelector('#clave-nueva').value;
    const confirmar = document.querySelector('#clave-confirmar').value;
    if (nueva.length < 10) {
        mensajeClave.textContent = 'Usa al menos 10 caracteres.';
        return;
    }
    if (nueva !== confirmar) {
        mensajeClave.textContent = 'Las contraseñas no coinciden.';
        return;
    }
    localStorage.setItem(CLAVE_CREDENCIALES, JSON.stringify({ usuario: CUENTA_TEMPORAL.usuario, clave: nueva, debeCambiar: false }));
    mostrarVista();
});

// Cierra la sesión de la secretaria en esta pestaña y vuelve a la pantalla de acceso.
document.querySelector('#boton-salir').addEventListener('click', () => {
    sessionStorage.removeItem(CLAVE_SESION);
    mostrarVista();
});

// Vuelve a dibujar la lista al escribir o cambiar el criterio de fechas/avisos.
filtroSesiones.addEventListener('change', dibujarSesiones);
buscarSesion.addEventListener('input', dibujarSesiones);

// Abre el acceso o la sesión ya iniciada al cargar la página.
mostrarVista();
