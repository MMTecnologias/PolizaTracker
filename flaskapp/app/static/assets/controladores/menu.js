document.addEventListener('DOMContentLoaded', function () {
  const polizas = document.getElementById('polizas');
  const clientes = document.getElementById('clientes');
  const recibos = document.getElementById('recibos');
  const vencimientos = document.getElementById('vencimientos');
  const reportes = document.getElementById('reportes');
  const utilerias = document.getElementById('utilerias');
  const acerca = document.getElementById('acerca');
  const usuarios = document.getElementById('usuarios');
  const reportesG = document.getElementById('reportesG');
  const solicitudes = document.getElementById('solicitudes');
  //1	Administrador
  //3	Desarollador
  //4	Gerente
  //2	Usuario
  polizas.style.display = 'none';
  clientes.style.display = 'none';
  recibos.style.display = 'none';
  vencimientos.style.display = 'none';
  reportes.style.display = 'none';
  utilerias.style.display = 'none';
  acerca.style.display = 'none';
  usuarios.style.display = 'none';
  reportesG.style.display = 'none';
  solicitudes.style.display = 'none';
  if (nivelUsuario == 'Desarollador') {
    polizas.style.display = 'block';
    clientes.style.display = 'block';
    recibos.style.display = 'block';
    vencimientos.style.display = 'block';
    reportes.style.display = 'block';
    utilerias.style.display = 'block';
    acerca.style.display = 'block';
    usuarios.style.display = 'block';
    reportesG.style.display = 'block';
  }
  if (nivelUsuario === 'Administrador') {
    polizas.style.display = 'none';
    clientes.style.display = 'none';
    recibos.style.display = 'none';
    vencimientos.style.display = 'none';
    reportes.style.display = 'none';
    utilerias.style.display = 'block';
    acerca.style.display = 'none';
    usuarios.style.display = 'block';
    reportesG.style.display = 'none';
    solicitudes.style.display = 'block';
  }
  if (nivelUsuario == 'Gerente') {
    polizas.style.display = 'block';
    clientes.style.display = 'block';
    recibos.style.display = 'block';
    vencimientos.style.display = 'none';
    reportes.style.display = 'block';
    utilerias.style.display = 'block';
    acerca.style.display = 'none';
    usuarios.style.display = 'block';
    reportesG.style.display = 'block';
  }

  if (nivelUsuario == 'Usuario') {
    polizas.style.display = 'block';
    clientes.style.display = 'block';
    recibos.style.display = 'block';
    vencimientos.style.display = 'block';
    reportes.style.display = 'block';
    utilerias.style.display = 'block';
    acerca.style.display = 'none';
    usuarios.style.display = 'none';
    reportesG.style.display = 'none';
  }
});

const numberOfRequests = async () => {
  const response = await fetch('/solicitudes/get_pending');
  const data = await response.json();
  const bubble = document.querySelector('.numberOfRequests');
  const bubbleTxt = document.querySelector('#numberOfRequests');
  console.log(data.recordsTotal);
  data.recordsTotal == 0
    ? bubble.classList.add('hidden')
    : bubble.classList.remove('hidden');
  bubbleTxt.innerHTML = await data.recordsTotal;
  console.log(data.recordsTotal);
};

numberOfRequests();
