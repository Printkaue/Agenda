<<<<<<< HEAD
// ---------- Chaves usadas no localStorage ----------
const STORAGE_USERS = 'agenda_users_v1';   // onde salva os usuários
const STORAGE_SESS = 'agenda_session_v1';  // onde salva a sessão atual

// ---------- Funções de armazenamento ----------
function loadUsers(){
  // Carrega todos usuários do localStorage
  return JSON.parse(localStorage.getItem(STORAGE_USERS) || '{}')
}
function saveUsers(u){
  // Salva o objeto de usuários no localStorage
  localStorage.setItem(STORAGE_USERS, JSON.stringify(u))
}
function setSession(email){
  // Salva a sessão atual (quem está logado)
  localStorage.setItem(STORAGE_SESS, JSON.stringify({email}))
}
function clearSession(){
  // Remove a sessão (logout)
  localStorage.removeItem(STORAGE_SESS)
}
function getSession(){
  // Retorna o email do usuário logado
  return JSON.parse(localStorage.getItem(STORAGE_SESS) || 'null')
}

// ---------- Função para gerar hash da senha (segurança) ----------
async function hash(text){
  // Converte texto em bytes
  const enc = new TextEncoder();
  const data = enc.encode(text);

  // Gera hash SHA-256
  const digest = await crypto.subtle.digest('SHA-256', data);

  // Converte o hash para string hexadecimal
  return Array.from(new Uint8Array(digest))
              .map(b => b.toString(16).padStart(2,'0'))
              .join('');
}

// ---------- Cadastro do usuário ----------
async function register(name,email,password){
  const users = loadUsers();
  
  // Verifica se email já existe
  if(users[email]) throw new Error('E-mail já cadastrado');

  const pwd = await hash(password);

  // Cria o usuário
  users[email] = {
    name, email, password: pwd, phone:'', events:[]
  };

  saveUsers(users);
  setSession(email);
  renderUser(); // atualiza UI
}

// ---------- Login ----------
async function login(email,password){
  const users = loadUsers();
  const user = users[email];
  
  if(!user) throw new Error('Usuário não encontrado');

  const pwd = await hash(password);

  if(pwd !== user.password)
    throw new Error('Senha inválida');

  setSession(email);
  renderUser();
}

function logout(){
  clearSession();
  renderUser();
}

// ---------- Controle das views (telas) ----------
const views = {
  calendar: document.getElementById('view-calendar'),
  add: document.getElementById('view-add'),
  export: document.getElementById('view-export')
};

// Alterna entre telas da sidebar
document.querySelectorAll('.item').forEach(it => 
  it.addEventListener('click', () => {
    const view = it.dataset.view;
    if(view) showView(view);
    if(it.id === 'btnLogout') logout();
  })
);

// Mostra a tela solicitada
function showView(name){
  for(const k in views){
    views[k].style.display = (k===name ? 'block' : 'none');
  }
  document.querySelectorAll('nav .item')
    .forEach(i => i.classList.toggle('active', i.dataset.view===name));
}

// ---------- Estado global do calendário ----------
let cur = new Date();

// Inicialização do app
function start(){
  renderUser();
  renderMonth(cur);
  requestNotificationPermission();
  scheduleAllAlarms();
}

// ---------- Renderização do calendário ----------
const monthLabel = document.getElementById('monthLabel');
const grid = document.getElementById('calendarGrid');

function renderMonth(date){
  const y = date.getFullYear();
  const m = date.getMonth();

  // Nome do mês
  monthLabel.textContent = date.toLocaleString('pt-BR',{month:'long',year:'numeric'});
  grid.innerHTML = '';

  const first = new Date(y,m,1);         // primeiro dia do mês
  const startDay = first.getDay();       // dia da semana do primeiro dia
  const daysInMonth = new Date(y,m+1,0).getDate(); // total de dias

  const prevMonthDays = startDay;
  const totalCells = Math.ceil((prevMonthDays + daysInMonth)/7)*7;
  const startIndex = 1 - prevMonthDays;

  // Gera cada célula do calendário
  for(let i=0;i<totalCells;i++){
    const day = new Date(y,m,startIndex+i);
    const cell = document.createElement('div');
    
    // Se o dia não é do mês atual, marca como "inativo"
    cell.className = 'cell' + (day.getMonth()===m ? '' : ' inactive');

    const dateDiv = document.createElement('div');
    dateDiv.className = 'date';
    dateDiv.textContent = day.getDate();
    cell.appendChild(dateDiv);

    // Renderiza eventos do dia
    const evs = eventsForDay(day);

    evs.slice(0,3).forEach(e => {
      const ev = document.createElement('div');
      ev.className = 'event ' + (e.category||'');
      ev.textContent = e.title + ' — ' + (e.time||'');
      ev.onclick = (()=>openEditFromEvent(e));
      cell.appendChild(ev);
    });

    if(evs.length>3){
      const more = document.createElement('div');
      more.style.fontSize='12px';
      more.style.color='var(--muted)';
      more.textContent = `+${evs.length-3} mais`;
      cell.appendChild(more);
    }

    // Duplo clique abre criação de evento já com a data
    cell.ondblclick = ()=>openAddWithDate(day);
    
    grid.appendChild(cell);
  }
}

// Retorna eventos de um dia específico
function eventsForDay(day){
  const s = getSession(); if(!s) return [];
  const users = loadUsers(); const user = users[s.email]; if(!user) return [];
  
  const dd = day.toISOString().slice(0,10);

  return (user.events||[])
    .filter(ev => ev.date === dd)
    .sort((a,b)=> (a.time||'')>(b.time||'')?1:-1);
}

// Navegação do calendário
document.getElementById('prevMonth').onclick = ()=>{
  cur.setMonth(cur.getMonth()-1);
  renderMonth(cur);
};
document.getElementById('nextMonth').onclick = ()=>{
  cur.setMonth(cur.getMonth()+1);
  renderMonth(cur);
};
document.getElementById('todayBtn').onclick = ()=>{
  cur = new Date();
  renderMonth(cur);
};

// Abrir formulário de evento
document.getElementById('addEventBtn').onclick = ()=>{
  showView('add'); 
  clearEventForm();
};
document.getElementById('openCalendar').onclick = ()=>showView('calendar');

// ---------- Criar / editar evento ----------
const eventForm = document.getElementById('eventForm');

eventForm.addEventListener('submit',async (e)=>{
  e.preventDefault();
  try{
    await saveEventFromForm();
    showView('calendar');
    renderMonth(cur);
    scheduleAllAlarms();
    alert('Salvo!');
  }catch(err){
    alert(err.message)
  }
});

document.getElementById('cancelEvent').onclick = ()=>showView('calendar');

// Limpa formulário de evento
function clearEventForm(){
  document.getElementById('eventId').value='';
  document.getElementById('title').value='';
  document.getElementById('date').value='';
  document.getElementById('time').value='';
  document.getElementById('description').value='';
  document.getElementById('category').value='personal';
  document.getElementById('notify').value='';
}

// Abre criação de evento com data pré-preenchida
function openAddWithDate(d){
  showView('add');
  clearEventForm();
  document.getElementById('date').value = d.toISOString().slice(0,10);
}

// Abre edição do evento
function openEditFromEvent(e){
  showView('add');
  document.getElementById('eventId').value = e.id;
  document.getElementById('title').value = e.title;
  document.getElementById('date').value = e.date;
  document.getElementById('time').value = e.time||'';
  document.getElementById('description').value = e.description||'';
  document.getElementById('category').value = e.category||'personal';
  document.getElementById('notify').value = e.notify||'';
}

// Salvar evento
async function saveEventFromForm(){
  const s = getSession();
  if(!s) throw new Error('Faça login para salvar eventos');

  const users = loadUsers();
  const user = users[s.email];

  const id = document.getElementById('eventId').value || ('ev_'+Date.now());

  const ev = {
    id,
    title:document.getElementById('title').value.trim(),
    date:document.getElementById('date').value,
    time:document.getElementById('time').value,
    description:document.getElementById('description').value,
    category:document.getElementById('category').value,
    notify:document.getElementById('notify').value
  };

  // Validação
  if(!ev.title || !ev.date)
    throw new Error('Título e data são obrigatórios');

  // Substitui evento caso esteja editando
  user.events = (user.events||[]).filter(x=>x.id!==id);
  user.events.push(ev);

  users[s.email] = user;
  saveUsers(users);
}

// ---------- Exportar eventos em CSV ----------
document.getElementById('exportCsv').onclick = ()=>{
  const s = getSession(); 
  if(!s){alert('Faça login');return}

  const users = loadUsers();
  const user = users[s.email];

  const header=['id','title','date','time','category','description','notify'];

  const csv = [
    header.join(',')
  ].concat(
    (user.events||[])
      .map(ev => header.map(h => ('"'+String(ev[h]||'').replace(/"/g,'""')+'"').join(',')))
  .join('\n'));

  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href=url;
  a.download = 'agenda_events.csv';
  a.click();

  URL.revokeObjectURL(url);
};

// ---------- Notificações ----------
let scheduledTimers = [];

function requestNotificationPermission(){
  if('Notification' in window && Notification.permission!=='granted'){
    Notification.requestPermission();
  }
}

function scheduleAllAlarms(){
  // Limpa alarmes antigos
  scheduledTimers.forEach(t=>clearTimeout(t));
  scheduledTimers = [];

  const s=getSession(); 
  if(!s) return;

  const users = loadUsers();
  const user = users[s.email];
  if(!user) return;

  const now = Date.now();

  (user.events||[]).forEach(ev=>{
    if(!ev.notify) return;

    const dtStr = ev.date + 'T' + (ev.time||'00:00');
    const evTs = new Date(dtStr).getTime();

    const notifyMs = evTs - (parseInt(ev.notify)||0)*60000;

    if(notifyMs > now){
      const t = setTimeout(()=>{
        showNotification(ev);
      }, notifyMs - now);

      scheduledTimers.push(t);
    }
  });
}

// Mostrar notificação
function showNotification(ev){
  const body = ev.title 
             + (ev.time ? (' — '+ev.time) : '')
             + (ev.description ? ('\n'+ev.description) : '');

  if('Notification' in window && Notification.permission==='granted'){
    new Notification(ev.title,{body});
  }else{
    alert('Lembrete: '+ev.title);
  }
}

// ---------- Renderização da UI do usuário ----------
function renderUser(){
  const s=getSession();
  const topUser = document.getElementById('topUser');
  const sidebarEmail = document.getElementById('userEmail');
  const userName = document.getElementById('userName');
  const avatar = document.getElementById('avatar');

  if(!s){
    // Usuário deslogado
    topUser.innerHTML = '<button class="btn" id="openLoginTop">Entrar</button>';
    sidebarEmail.textContent='Faça login';
    userName.textContent='Convidado';
    avatar.textContent='U';
    document.getElementById('btnLogout').style.display='none';
  }else{
    // Usuário logado
    const users = loadUsers();
    const user = users[s.email];

    if(!user){
      clearSession(); 
      renderUser(); 
      return;
    }

    topUser.innerHTML = `<strong>${user.name}</strong> — <span style="color:var(--muted)">${user.email}</span>`;
    sidebarEmail.textContent = user.email;
    userName.textContent = user.name;

    // Avatar pega as iniciais do nome
    avatar.textContent = user.name.split(' ')
                                  .map(x=>x[0])
                                  .slice(0,2)
                                  .join('')
                                  .toUpperCase();

    document.getElementById('btnLogout').style.display='block';
  }

  const b = document.getElementById('openLoginTop');
  if(b) b.onclick = ()=>openAuth();
}

// ---------- Modal de login/cadastro ----------
document.getElementById('openLogin').onclick = openAuth;
document.getElementById('closeAuth').onclick = closeAuth;

document.getElementById('btnLogin').onclick = async ()=>{
  const email=document.getElementById('authEmail').value.trim();
  const pwd=document.getElementById('authPassword').value;
  try{
    await login(email,pwd);
    closeAuth();
    renderMonth(cur);
    scheduleAllAlarms();
    alert('Logado');
  }catch(err){
    alert(err.message)
  }
};

document.getElementById('btnRegister').onclick = async ()=>{
  const name=document.getElementById('authName').value.trim();
  const email=document.getElementById('authEmail').value.trim();
  const pwd=document.getElementById('authPassword').value;

  try{
    if(!name) throw new Error('Nome é necessário para cadastro');
    await register(name,email,pwd);
    closeAuth();
    renderMonth(cur);
    scheduleAllAlarms();
    alert('Conta criada e logado');
  }catch(err){
    alert(err.message)
  }
};

function openAuth(){
  document.getElementById('modalLogin').style.display='flex';
}
function closeAuth(){
  document.getElementById('modalLogin').style.display='none';
}

// ---------- Botão de excluir evento (injetado no formulário) ----------
(function injectDeleteBtn(){
  const del = document.createElement('button');
  del.className='btn ghost';
  del.type='button';
  del.textContent='Excluir Evento';
  del.style.marginLeft='auto';

  del.onclick = ()=>{
    const id = document.getElementById('eventId').value;

    if(!id){
      alert('Selecione um evento para excluir');
      return;
    }
    if(!confirm('Excluir este evento?')) return;

    const s=getSession(); 
    if(!s){alert('Faça login');return}

    const users=loadUsers();
    const user=users[s.email];

    // Remove o evento
    user.events = user.events.filter(x=>x.id!==id);

    users[s.email] = user;
    saveUsers(users);

    clearEventForm();
    showView('calendar');
    renderMonth(cur);
  };

  document.getElementById('eventForm').appendChild(del);
})();

// Permite abrir evento por ID via console
window.openEventById = function(id){
  const s=getSession(); if(!s) return;
  const users=loadUsers();
  const user=users[s.email];
  const e=(user.events||[]).find(x=>x.id===id);
  if(e) openEditFromEvent(e);
}

// ---------- Usuário demo automático ----------
(function seed(){
  const users = loadUsers();
  if(Object.keys(users).length === 0){
    (async()=>{
      try{
        const demoPwd = await hash('123456');
        users['demo@demo.com'] = {
          name:'Demo User',
          email:'demo@demo.com',
          password:demoPwd,
          events:[
            {
              id:'ev_demo1',
              title:'Reunião equipe',
              date:new Date().toISOString().slice(0,10),
              time:'14:00',
              description:'Reunião semanal',
              category:'work',
              notify:'30'
            },
            {
              id:'ev_demo2',
              title:'Estudar JS',
              date:new Date().toISOString().slice(0,10),
              time:'18:00',
              description:'Codificar protótipo',
              category:'study',
              notify:'60'
            }
          ]
        };
        saveUsers(users);
      }catch(e){console.error(e)}
    })();
  }
})();

// ---------- Inicializa o app ----------
start();

// Debug para visualizar os usuários
window._dumpUsers = ()=>{console.log(loadUsers()); alert(JSON.stringify(loadUsers(),null,2))}
=======
// ---------- Chaves usadas no localStorage ----------
const STORAGE_USERS = 'agenda_users_v1';   // onde salva os usuários
const STORAGE_SESS = 'agenda_session_v1';  // onde salva a sessão atual

// ---------- Funções de armazenamento ----------
function loadUsers(){
  // Carrega todos usuários do localStorage
  return JSON.parse(localStorage.getItem(STORAGE_USERS) || '{}')
}
function saveUsers(u){
  // Salva o objeto de usuários no localStorage
  localStorage.setItem(STORAGE_USERS, JSON.stringify(u))
}
function setSession(email){
  // Salva a sessão atual (quem está logado)
  localStorage.setItem(STORAGE_SESS, JSON.stringify({email}))
}
function clearSession(){
  // Remove a sessão (logout)
  localStorage.removeItem(STORAGE_SESS)
}
function getSession(){
  // Retorna o email do usuário logado
  return JSON.parse(localStorage.getItem(STORAGE_SESS) || 'null')
}

// ---------- Função para gerar hash da senha (segurança) ----------
async function hash(text){
  // Converte texto em bytes
  const enc = new TextEncoder();
  const data = enc.encode(text);

  // Gera hash SHA-256
  const digest = await crypto.subtle.digest('SHA-256', data);

  // Converte o hash para string hexadecimal
  return Array.from(new Uint8Array(digest))
              .map(b => b.toString(16).padStart(2,'0'))
              .join('');
}

// ---------- Cadastro do usuário ----------
async function register(name,email,password){
  const users = loadUsers();
  
  // Verifica se email já existe
  if(users[email]) throw new Error('E-mail já cadastrado');

  const pwd = await hash(password);

  // Cria o usuário
  users[email] = {
    name, email, password: pwd, phone:'', events:[]
  };

  saveUsers(users);
  setSession(email);
  renderUser(); // atualiza UI
}

// ---------- Login ----------
async function login(email,password){
  const users = loadUsers();
  const user = users[email];
  
  if(!user) throw new Error('Usuário não encontrado');

  const pwd = await hash(password);

  if(pwd !== user.password)
    throw new Error('Senha inválida');

  setSession(email);
  renderUser();
}

function logout(){
  clearSession();
  renderUser();
}

// ---------- Controle das views (telas) ----------
const views = {
  calendar: document.getElementById('view-calendar'),
  add: document.getElementById('view-add'),
  export: document.getElementById('view-export')
};

// Alterna entre telas da sidebar
document.querySelectorAll('.item').forEach(it => 
  it.addEventListener('click', () => {
    const view = it.dataset.view;
    if(view) showView(view);
    if(it.id === 'btnLogout') logout();
  })
);

// Mostra a tela solicitada
function showView(name){
  for(const k in views){
    views[k].style.display = (k===name ? 'block' : 'none');
  }
  document.querySelectorAll('nav .item')
    .forEach(i => i.classList.toggle('active', i.dataset.view===name));
}

// ---------- Estado global do calendário ----------
let cur = new Date();

// Inicialização do app
function start(){
  renderUser();
  renderMonth(cur);
  requestNotificationPermission();
  scheduleAllAlarms();
}

// ---------- Renderização do calendário ----------
const monthLabel = document.getElementById('monthLabel');
const grid = document.getElementById('calendarGrid');

function renderMonth(date){
  const y = date.getFullYear();
  const m = date.getMonth();

  // Nome do mês
  monthLabel.textContent = date.toLocaleString('pt-BR',{month:'long',year:'numeric'});
  grid.innerHTML = '';

  const first = new Date(y,m,1);         // primeiro dia do mês
  const startDay = first.getDay();       // dia da semana do primeiro dia
  const daysInMonth = new Date(y,m+1,0).getDate(); // total de dias

  const prevMonthDays = startDay;
  const totalCells = Math.ceil((prevMonthDays + daysInMonth)/7)*7;
  const startIndex = 1 - prevMonthDays;

  // Gera cada célula do calendário
  for(let i=0;i<totalCells;i++){
    const day = new Date(y,m,startIndex+i);
    const cell = document.createElement('div');
    
    // Se o dia não é do mês atual, marca como "inativo"
    cell.className = 'cell' + (day.getMonth()===m ? '' : ' inactive');

    const dateDiv = document.createElement('div');
    dateDiv.className = 'date';
    dateDiv.textContent = day.getDate();
    cell.appendChild(dateDiv);

    // Renderiza eventos do dia
    const evs = eventsForDay(day);

    evs.slice(0,3).forEach(e => {
      const ev = document.createElement('div');
      ev.className = 'event ' + (e.category||'');
      ev.textContent = e.title + ' — ' + (e.time||'');
      ev.onclick = (()=>openEditFromEvent(e));
      cell.appendChild(ev);
    });

    if(evs.length>3){
      const more = document.createElement('div');
      more.style.fontSize='12px';
      more.style.color='var(--muted)';
      more.textContent = `+${evs.length-3} mais`;
      cell.appendChild(more);
    }

    // Duplo clique abre criação de evento já com a data
    cell.ondblclick = ()=>openAddWithDate(day);
    
    grid.appendChild(cell);
  }
}

// Retorna eventos de um dia específico
function eventsForDay(day){
  const s = getSession(); if(!s) return [];
  const users = loadUsers(); const user = users[s.email]; if(!user) return [];
  
  const dd = day.toISOString().slice(0,10);

  return (user.events||[])
    .filter(ev => ev.date === dd)
    .sort((a,b)=> (a.time||'')>(b.time||'')?1:-1);
}

// Navegação do calendário
document.getElementById('prevMonth').onclick = ()=>{
  cur.setMonth(cur.getMonth()-1);
  renderMonth(cur);
};
document.getElementById('nextMonth').onclick = ()=>{
  cur.setMonth(cur.getMonth()+1);
  renderMonth(cur);
};
document.getElementById('todayBtn').onclick = ()=>{
  cur = new Date();
  renderMonth(cur);
};

// Abrir formulário de evento
document.getElementById('addEventBtn').onclick = ()=>{
  showView('add'); 
  clearEventForm();
};
document.getElementById('openCalendar').onclick = ()=>showView('calendar');

// ---------- Criar / editar evento ----------
const eventForm = document.getElementById('eventForm');

eventForm.addEventListener('submit',async (e)=>{
  e.preventDefault();
  try{
    await saveEventFromForm();
    showView('calendar');
    renderMonth(cur);
    scheduleAllAlarms();
    alert('Salvo!');
  }catch(err){
    alert(err.message)
  }
});

document.getElementById('cancelEvent').onclick = ()=>showView('calendar');

// Limpa formulário de evento
function clearEventForm(){
  document.getElementById('eventId').value='';
  document.getElementById('title').value='';
  document.getElementById('date').value='';
  document.getElementById('time').value='';
  document.getElementById('description').value='';
  document.getElementById('category').value='personal';
  document.getElementById('notify').value='';
}

// Abre criação de evento com data pré-preenchida
function openAddWithDate(d){
  showView('add');
  clearEventForm();
  document.getElementById('date').value = d.toISOString().slice(0,10);
}

// Abre edição do evento
function openEditFromEvent(e){
  showView('add');
  document.getElementById('eventId').value = e.id;
  document.getElementById('title').value = e.title;
  document.getElementById('date').value = e.date;
  document.getElementById('time').value = e.time||'';
  document.getElementById('description').value = e.description||'';
  document.getElementById('category').value = e.category||'personal';
  document.getElementById('notify').value = e.notify||'';
}

// Salvar evento
async function saveEventFromForm(){
  const s = getSession();
  if(!s) throw new Error('Faça login para salvar eventos');

  const users = loadUsers();
  const user = users[s.email];

  const id = document.getElementById('eventId').value || ('ev_'+Date.now());

  const ev = {
    id,
    title:document.getElementById('title').value.trim(),
    date:document.getElementById('date').value,
    time:document.getElementById('time').value,
    description:document.getElementById('description').value,
    category:document.getElementById('category').value,
    notify:document.getElementById('notify').value
  };

  // Validação
  if(!ev.title || !ev.date)
    throw new Error('Título e data são obrigatórios');

  // Substitui evento caso esteja editando
  user.events = (user.events||[]).filter(x=>x.id!==id);
  user.events.push(ev);

  users[s.email] = user;
  saveUsers(users);
}

// ---------- Exportar eventos em CSV ----------
document.getElementById('exportCsv').onclick = ()=>{
  const s = getSession(); 
  if(!s){alert('Faça login');return}

  const users = loadUsers();
  const user = users[s.email];

  const header=['id','title','date','time','category','description','notify'];

  const csv = [
    header.join(',')
  ].concat(
    (user.events||[])
      .map(ev => header.map(h => ('"'+String(ev[h]||'').replace(/"/g,'""')+'"').join(',')))
  .join('\n'));

  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href=url;
  a.download = 'agenda_events.csv';
  a.click();

  URL.revokeObjectURL(url);
};

// ---------- Notificações ----------
let scheduledTimers = [];

function requestNotificationPermission(){
  if('Notification' in window && Notification.permission!=='granted'){
    Notification.requestPermission();
  }
}

function scheduleAllAlarms(){
  // Limpa alarmes antigos
  scheduledTimers.forEach(t=>clearTimeout(t));
  scheduledTimers = [];

  const s=getSession(); 
  if(!s) return;

  const users = loadUsers();
  const user = users[s.email];
  if(!user) return;

  const now = Date.now();

  (user.events||[]).forEach(ev=>{
    if(!ev.notify) return;

    const dtStr = ev.date + 'T' + (ev.time||'00:00');
    const evTs = new Date(dtStr).getTime();

    const notifyMs = evTs - (parseInt(ev.notify)||0)*60000;

    if(notifyMs > now){
      const t = setTimeout(()=>{
        showNotification(ev);
      }, notifyMs - now);

      scheduledTimers.push(t);
    }
  });
}

// Mostrar notificação
function showNotification(ev){
  const body = ev.title 
             + (ev.time ? (' — '+ev.time) : '')
             + (ev.description ? ('\n'+ev.description) : '');

  if('Notification' in window && Notification.permission==='granted'){
    new Notification(ev.title,{body});
  }else{
    alert('Lembrete: '+ev.title);
  }
}

// ---------- Renderização da UI do usuário ----------
function renderUser(){
  const s=getSession();
  const topUser = document.getElementById('topUser');
  const sidebarEmail = document.getElementById('userEmail');
  const userName = document.getElementById('userName');
  const avatar = document.getElementById('avatar');

  if(!s){
    // Usuário deslogado
    topUser.innerHTML = '<button class="btn" id="openLoginTop">Entrar</button>';
    sidebarEmail.textContent='Faça login';
    userName.textContent='Convidado';
    avatar.textContent='U';
    document.getElementById('btnLogout').style.display='none';
  }else{
    // Usuário logado
    const users = loadUsers();
    const user = users[s.email];

    if(!user){
      clearSession(); 
      renderUser(); 
      return;
    }

    topUser.innerHTML = `<strong>${user.name}</strong> — <span style="color:var(--muted)">${user.email}</span>`;
    sidebarEmail.textContent = user.email;
    userName.textContent = user.name;

    // Avatar pega as iniciais do nome
    avatar.textContent = user.name.split(' ')
                                  .map(x=>x[0])
                                  .slice(0,2)
                                  .join('')
                                  .toUpperCase();

    document.getElementById('btnLogout').style.display='block';
  }

  const b = document.getElementById('openLoginTop');
  if(b) b.onclick = ()=>openAuth();
}

// ---------- Modal de login/cadastro ----------
document.getElementById('openLogin').onclick = openAuth;
document.getElementById('closeAuth').onclick = closeAuth;

document.getElementById('btnLogin').onclick = async ()=>{
  const email=document.getElementById('authEmail').value.trim();
  const pwd=document.getElementById('authPassword').value;
  try{
    await login(email,pwd);
    closeAuth();
    renderMonth(cur);
    scheduleAllAlarms();
    alert('Logado');
  }catch(err){
    alert(err.message)
  }
};

document.getElementById('btnRegister').onclick = async ()=>{
  const name=document.getElementById('authName').value.trim();
  const email=document.getElementById('authEmail').value.trim();
  const pwd=document.getElementById('authPassword').value;

  try{
    if(!name) throw new Error('Nome é necessário para cadastro');
    await register(name,email,pwd);
    closeAuth();
    renderMonth(cur);
    scheduleAllAlarms();
    alert('Conta criada e logado');
  }catch(err){
    alert(err.message)
  }
};

function openAuth(){
  document.getElementById('modalLogin').style.display='flex';
}
function closeAuth(){
  document.getElementById('modalLogin').style.display='none';
}

// ---------- Botão de excluir evento (injetado no formulário) ----------
(function injectDeleteBtn(){
  const del = document.createElement('button');
  del.className='btn ghost';
  del.type='button';
  del.textContent='Excluir Evento';
  del.style.marginLeft='auto';

  del.onclick = ()=>{
    const id = document.getElementById('eventId').value;

    if(!id){
      alert('Selecione um evento para excluir');
      return;
    }
    if(!confirm('Excluir este evento?')) return;

    const s=getSession(); 
    if(!s){alert('Faça login');return}

    const users=loadUsers();
    const user=users[s.email];

    // Remove o evento
    user.events = user.events.filter(x=>x.id!==id);

    users[s.email] = user;
    saveUsers(users);

    clearEventForm();
    showView('calendar');
    renderMonth(cur);
  };

  document.getElementById('eventForm').appendChild(del);
})();

// Permite abrir evento por ID via console
window.openEventById = function(id){
  const s=getSession(); if(!s) return;
  const users=loadUsers();
  const user=users[s.email];
  const e=(user.events||[]).find(x=>x.id===id);
  if(e) openEditFromEvent(e);
}

// ---------- Usuário demo automático ----------
(function seed(){
  const users = loadUsers();
  if(Object.keys(users).length === 0){
    (async()=>{
      try{
        const demoPwd = await hash('123456');
        users['demo@demo.com'] = {
          name:'Demo User',
          email:'demo@demo.com',
          password:demoPwd,
          events:[
            {
              id:'ev_demo1',
              title:'Reunião equipe',
              date:new Date().toISOString().slice(0,10),
              time:'14:00',
              description:'Reunião semanal',
              category:'work',
              notify:'30'
            },
            {
              id:'ev_demo2',
              title:'Estudar JS',
              date:new Date().toISOString().slice(0,10),
              time:'18:00',
              description:'Codificar protótipo',
              category:'study',
              notify:'60'
            }
          ]
        };
        saveUsers(users);
      }catch(e){console.error(e)}
    })();
  }
})();

// ---------- Inicializa o app ----------
start();

// Debug para visualizar os usuários
window._dumpUsers = ()=>{console.log(loadUsers()); alert(JSON.stringify(loadUsers(),null,2))}
>>>>>>> 488a0c6f538568ca0457c2f9c60a652d3b997b5c
