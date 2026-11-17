// Secretaría crea cuentas usando el RUT como identificador de acceso.
(() => {
    const KEY_USERS='quinesiomed-cuentas-demo-v1', KEY_BLOCKS='quinesiomed-bloques-grupales-v1', KEY_RESERVAS='quinesiomed-reservas-v1';
    const panel=document.querySelector('#vista-agenda-secretaria'), heading=panel?.querySelector('.encabezado-panel');
    if(!panel||!heading)return;
    const box=document.createElement('section');box.className='gestion-cuentas-alumnos';box.id='gestion-cuentas-alumnos';
    box.innerHTML=`<span class="etiqueta-inicio">ADMINISTRACIÓN DE ALUMNOS</span><h2>Cuentas y planes de entrenamiento</h2><p>Crea el acceso usando el RUT del alumno y registra las clases grupales contratadas por semana.</p><a class="boton-inicio" href="./gestorusaurios.html">Abrir gestor de usuarios</a>
      <form id="form-cuenta-alumno" class="form-cuenta-alumno">
        <label>Nombre completo del alumno<input name="fullName" maxlength="100" placeholder="Nombre y apellido" required></label>
        <label>RUT del alumno<input name="rut" inputmode="text" autocomplete="off" maxlength="12" placeholder="12.345.678-5" required></label>
        <label>Plan contratado<select name="plan" required><option value="">Selecciona un plan</option></select></label>
        <label>Clases semanales contratadas<input name="weeklyClasses" type="number" min="1" max="21" value="3" required></label>
        <label>Contraseña temporal<span class="campo-clave-temporal"><input name="temporaryPassword" readonly required><button type="button" id="generar-clave-alumno">Generar</button></span></label>
        <button class="boton-inicio" type="submit">Crear o actualizar alumno</button><p id="mensaje-cuenta-alumno" role="status" aria-live="polite"></p>
      </form><h3>Alumnos registrados</h3><ul id="lista-cuentas-alumnos" class="lista-cuentas-alumnos"></ul>
      <p class="aviso-grupos-local">Prototipo local: cuentas y planes se guardan en este navegador. No entregues credenciales reales hasta contar con autenticación segura en servidor.</p>`;
    heading.insertAdjacentElement('afterend',box);
    const form=box.querySelector('#form-cuenta-alumno'),planSelect=form.elements.plan,passInput=form.elements.temporaryPassword,message=box.querySelector('#mensaje-cuenta-alumno'),list=box.querySelector('#lista-cuentas-alumnos');
    const read=key=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[]}catch{return[]}};
    function updatePlans(){const old=planSelect.value;const names=[...new Set(read(KEY_BLOCKS).map(item=>item.plan).filter(Boolean))].sort();planSelect.replaceChildren(new Option('Selecciona un plan',''));names.forEach(name=>planSelect.add(new Option(name,name)));if(names.includes(old))planSelect.value=old}
    function createTemporaryPassword(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';const random=crypto.getRandomValues(new Uint8Array(14));passInput.value=Array.from(random,item=>alphabet[item%alphabet.length]).join('')}
    function renderAccounts(){list.replaceChildren();const accounts=read(KEY_USERS).sort((a,b)=>(a.fullName||a.username).localeCompare(b.fullName||b.username,'es'));if(!accounts.length){const empty=document.createElement('li');empty.className='sin-bloques';empty.textContent='Aún no se han creado cuentas de alumnos.';list.append(empty);return}accounts.forEach(account=>{const li=document.createElement('li');li.className='cuenta-alumno-item';const label=document.createElement('div');const name=document.createElement('strong');name.textContent=account.fullName||account.username;const detail=document.createElement('span');const rut=account.rut||account.username;const grupos=Array.isArray(account.grupos)?account.grupos:[account.plan];detail.textContent=`RUT ${rut} · ${grupos.filter(Boolean).join(', ')||'Sin plan'} · ${Number(account.weeklyClasses)||0} clases por semana`;label.append(name,detail);li.append(label);list.append(li)})}
    async function hashPassword(password,salt){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(atob(salt),character=>character.charCodeAt(0)),iterations:120000,hash:'SHA-256'},material,256);return btoa(String.fromCharCode(...new Uint8Array(bits)))}
    form.elements.rut.addEventListener('blur',()=>{if(form.elements.rut.value.trim())form.elements.rut.value=window.QuinesiomedRut.formatear(form.elements.rut.value)});
    box.querySelector('#generar-clave-alumno').addEventListener('click',createTemporaryPassword);
    form.addEventListener('submit',async event=>{
        event.preventDefault();message.textContent='';if(!crypto?.subtle){message.textContent='Abre el panel mediante Live Server o HTTPS para generar credenciales.';return}
        const rutEscrito=form.elements.rut.value.trim(),rutCompact=window.QuinesiomedRut.normalizar(rutEscrito);
        const expectedVerifier=window.QuinesiomedRut.verificadorEsperado(rutEscrito);if(!expectedVerifier){message.textContent='Ingresa el RUT completo, incluido su dígito verificador.';form.elements.rut.focus();return}if(!window.QuinesiomedRut.valido(rutEscrito)){
                const candidate=window.QuinesiomedRut.formatear(rutCompact.slice(0,-1)+expectedVerifier);
                message.textContent='El dígito verificador no coincide. Para ese número base sería '+candidate+'. Confirma el RUT del alumno.';
                form.elements.rut.focus();return;
            }const formattedRut=window.QuinesiomedRut.formatear(rutEscrito),fullName=form.elements.fullName.value.trim(),weeklyClasses=Number(form.elements.weeklyClasses.value),plan=planSelect.value;
        if(!passInput.value)createTemporaryPassword();
        try{
            const accounts=read(KEY_USERS),existing=accounts.find(item=>window.QuinesiomedRut.normalizar(item.rut||item.username)===rutCompact);
            if(accounts.some(item=>item!==existing&&window.QuinesiomedRut.normalizar(item.rut||item.username)===rutCompact)){message.textContent='Ese RUT ya está registrado.';return}
            if(existing){const oldUsername=existing.username;existing.username=rutCompact;existing.rut=formattedRut;existing.fullName=fullName;existing.plan=plan;existing.grupos=[plan];existing.weeklyClasses=weeklyClasses;if(oldUsername!==rutCompact){const reservations=read(KEY_RESERVAS);reservations.forEach(item=>{if(item.usuarioCuenta===oldUsername){item.usuarioCuenta=rutCompact;item.rut=formattedRut}});localStorage.setItem(KEY_RESERVAS,JSON.stringify(reservations))}localStorage.setItem(KEY_USERS,JSON.stringify(accounts));message.textContent='Datos del alumno actualizados. Su contraseña actual se mantiene.'}
            else{const salt=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))),hash=await hashPassword(passInput.value,salt);accounts.push({username:rutCompact,rut:formattedRut,fullName,plan,grupos:[plan],weeklyClasses,salt,hash,createdAt:new Date().toISOString()});localStorage.setItem(KEY_USERS,JSON.stringify(accounts));message.textContent=`Cuenta creada. Entrega al alumno su RUT y esta contraseña temporal: ${passInput.value}`}
            renderAccounts();window.dispatchEvent(new Event('quinesiomed:cuentas-actualizadas'))
        }catch{message.textContent='No se pudo guardar la cuenta en este navegador.'}
    });
    window.addEventListener('storage',event=>{if(event.key===KEY_BLOCKS)updatePlans();if(event.key===KEY_USERS)renderAccounts()});
    updatePlans();renderAccounts();createTemporaryPassword();
})();