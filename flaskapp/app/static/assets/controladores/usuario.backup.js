import { datatableConfig } from './datatable-config.js';

let userPerPage = 5;

let currentIndex = 0;

let sorting = false;

let totalPages = 0;

let userData = [];
let userData1 = [];
const currentIndexToShow = (currentIndex) => currentIndex + 1;

const currentPageData = async () => {
   let currentData = {};

   let C_Data = [];
   const index = currentIndex;

   //Solicitamos los datos
   if (sorting == true) {
        currentData = await fetch('/usuarios/get', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    start: `${index === undefined ? 0 : index * userPerPage}`,
                    length: userPerPage,
                    order: true
                })
                });
   } else{
        currentData = await fetch('/usuarios/get', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                start: `${index === undefined ? 0 : index * userPerPage}`,
                length: userPerPage
            })
            });
   }

   //Convertimos los datos a JSON
   let data = await currentData.json();
   console.log(data);

   totalPages = Math.floor(data.recordsTotal / userPerPage);
   console.log(`numero total de página ${totalPages}`);

   //Creamos un objeto llamado userData y lo llenamos iterando en la data JSON

   //Rellenamos el arreglo "userData" con los datos del servidor
   data.data.forEach((usuario) => {
      userData.push({
         'id': usuario.id,
         'acceso':usuario.acceso,
         'fullname': usuario.fullname,
         'mail': usuario.correo,
         'phone': usuario.telefono
      });
   });
   console.log(`Estoy imprimiendo desde currentPageData ${userData}`);
   return userData;
};

const updateTable = async (userData) => {
   let iterator = 0;
   const rows = document.querySelectorAll('#demo>tr.tableOption');

   console.log(`estoy imprimiendo desde updateTable`);
   console.log(userData)


   userData.forEach((usuario) => {
      rows[
         iterator
      ].innerHTML = `<td>${usuario.fullname}</td><td>${usuario.mail}</td><td>${usuario.phone}</td><td>${usuario.acceso}</td><td><ul class="btn_table_options">

                              <li>
                                 <a href="#" class="btn__icon_delete" id="btnDelete_${usuario.id}">
                                    <svg class="noClickable" xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M292.309-140.001q-29.923 0-51.115-21.193-21.193-21.192-21.193-51.115V-720h-40v-59.999H360v-35.384h240v35.384h179.999V-720h-40v507.691q0 30.308-21 51.308t-51.308 21H292.309ZM680-720H280v507.691q0 5.385 3.462 8.847 3.462 3.462 8.847 3.462h375.382q4.616 0 8.463-3.846 3.846-3.847 3.846-8.463V-720ZM376.155-280h59.999v-360h-59.999v360Zm147.691 0h59.999v-360h-59.999v360ZM280-720v520-520Z"/></svg>
                                 </a>
                              </li>
                              <li>
                                 <a href="#" class="btn__icon_edit" id="btnEdit_${usuario.id}">
                                    <svg class="noClickable" xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M200-200h50.461l409.463-409.463-50.461-50.461L200-250.461V-200Zm-59.999 59.999v-135.383l527.616-527.384q9.073-8.241 20.036-12.736 10.963-4.495 22.993-4.495 12.029 0 23.307 4.27 11.277 4.269 19.969 13.576l48.846 49.461q9.308 8.692 13.269 20.004 3.962 11.311 3.962 22.622 0 12.065-4.121 23.028-4.12 10.964-13.11 20.037l-527.384 527H140.001Zm620.384-570.153-50.231-50.231 50.231 50.231Zm-126.134 75.903-24.788-25.673 50.461 50.461-25.673-24.788Z"/></svg>
                                 </a>
                              </li>
                              <li>
                                 <a href="#" class="btn__icon_show1" id="btnShow_${usuario.id}">
                                    <svg class="noClickable" xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/></svg>
                                 </a>
                              </li>
                           </ul></td>`;
      iterator++;
   });
   await addBtnDelete();
   await addBtnEdit();
   await addBtnHistorial();

};

//Eliminar usuario desde la tabla
const addBtnDelete = async () => {
   const btnDelete = document.querySelectorAll('.btn__icon_delete');

   btnDelete.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
         //función eliminar
         await deleteUser(e.target.id.split('_')[1]);
         await updateTable(await currentPageData());
      });
   });
};

//Función para eliminar usuario
const deleteUser = async (id) => {
   //insertar función eliminar
   try {
    const response =await fetch('/delete', {
      method: 'POST',
      headers: {
         'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        user_id: id
      })
   });
   const responseData = await response.json();
   if (!responseData.error) {
    // Success response
    Swal.fire({
       title: responseData.title,
       text: responseData.msg,
       icon: 'success'
    });
    } else {
        // Error response
        Swal.fire({
        title: 'Error',
        text: responseData.msg,
        icon: 'error'
        });
    }

    } catch (error) {
        // Fetch error
        Swal.fire({
        title: 'Error inesperado',
        text: 'Lamentamos el inconveniente, por favor vuelve a intentarlo',
        icon: 'error'
        }).then(function () {
        resetPage();
        });
    }

};

//Editar usuario desde la tabla
const addBtnEdit = async () => {
   const btnEdit = document.querySelectorAll('.btn__icon_edit');

   btnEdit.forEach((btn) => {
      btn.addEventListener('click', async (event) => {
         console.log(
            `se ha realizado la consulta, id enviado: ${
               event.target.id.split('_')[1]
            }`
         );
         await editClient(event.target.id.split('_')[1]);
      });
   });
};

//Función para editar usuario
const editClient = async (id) => {
   //insertar función eliminar

   const response = await fetch('/usuarios/get', {
      method: 'POST',
      headers: {
         'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        start:0,
        length:1,
        usuario_id: id
      })
   });
   console.log(`imprime desde editClient ${id}`);
   const data = await response.json();
   console.log(data.data[0]);
   $('#usuario_id').val(data.data[0].id);
   $('#nombre').val(data.data[0].nombre);
   $('#apellido').val(data.data[0].apellido);
   $('#correo').val(data.data[0].correo);
   $('#telefono_movil').val(data.data[0].telefono);
   $('#username').val(data.data[0].username);
   $('#grupo').html(`<option value='${data.data[0].acceso}'>
   ${data.data[0].acceso}
   </option>
   <option value="1">Administrador</option>
   <option value="4">Gerente</option>
   <option value="2">Usuario</option>
   <option value="3">Desarrollador</option>

   `);



//    Swal.fire({
//     title: "En proceso",
//     text: "Tenia logica de clientes",
//     icon: 'error'
//     });

};


const pintarPaginacion = async () => {
   await fetch('/usuarios/get', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                start: 0,
                length: 1
            })
            })
      .then((response) => response.json())
      .then((data) => {
         document.querySelector(
            '#current-index'
         ).innerHTML = `<p>${currentIndexToShow(currentIndex)}</p>`;

         if (
            currentIndex == 0 &&
            Math.floor(data.recordsTotal / userPerPage) == 0
         ) {
            document.querySelector('#prev-index').classList.add('noClickable');
            document.querySelector('#next-index').classList.add('noClickable');
         } else if (currentIndex == 0) {
            document.querySelector('#prev-index').classList.add('noClickable');
         } else if (
            currentIndex == Math.floor(data.recordsTotal /userPerPage)
         ) {
            document.querySelector('#next-index').classList.add('noClickable');
         } else {
            document
               .querySelector('#prev-index')
               .classList.remove('noClickable');
            document
               .querySelector('#next-index')
               .classList.remove('noClickable');
         }
      });
};

const nextIndex = document.querySelector('#next-index');
nextIndex.addEventListener('click', async () => {
   ++currentIndex;
   console.log(`el indice actual es ${currentIndex}`);
   await pintarPaginacion();
   if (currentIndex == totalPages) {
      await fillTable(await currentPageData());
   } else {
      await updateTable(await currentPageData());
   }
});

const prevIndex = document.querySelector('#prev-index');
prevIndex.addEventListener('click', async () => {
   --currentIndex;
   console.log(`el indice actual es ${currentIndex}`);
   await pintarPaginacion();
   if (currentIndex == totalPages - 1) {
      await fillTable(await currentPageData());
   } else {
      await updateTable(await currentPageData());
   }
});

const sortButton = document.querySelector('#sortByName');
sortButton.addEventListener('click', async () => {
   sorting = !sorting;
   console.log(`el valor de sorting es ${sorting}`);
   currentIndex = 0;
   await updateTable(await currentPageData());
   pintarPaginacion();
});

$(document).ready(function () {

   // Funcion para recargar tabla y regresar form a status inicial
   function resetPage() {
      // Reset the form values
      $('#user-form')[0].reset();
      // Reset the form validation state
      $('#user-form').removeClass('was-validated');
      // Enable all form inputs
      // $('#user-form input').prop('disabled', false);
      $('#user-form select').prop('disabled', false);
      // Set usuario_id value to "New"
      $('#usuario_id').val('New');

      // Change the text of the Save button back to "Crear"
      $('#Savebtn').text('Crear');

   }

   // Configuracion de Tabla de usuarios

   // Ruta de AJAX para la creacion/edicion de usuarios
   $('#user-form').submit(function (e) {
      e.preventDefault();

      var formData = $(this).serialize();

      // Checar que el formulario este validado
      if (!this.checkValidity()) {
         $(this).addClass('was-validated');
         return;
      }

      $.ajax({
         type: 'POST',
         url: '/usuarios/create',
         data: formData,
         success: function (response) {
            if (response.error) {
               Swal.fire({
                  title: 'Usuario incorrecto',
                  text: response.msg,
                  icon: 'error'
               }).then(function () {
                  resetPage();
               });
            } else {
               Swal.fire({
                  title: response.title,
                  html: response.msg,
                  icon: 'success'
               }).then(function () {
                  resetPage();
               });
            }
         },
         error: function (xhr, status, error) {
            Swal.fire({
               title: 'Error inesperado',
               text: 'Lamentamos el inconveniente, porfavor vuelve a intentarlo',
               icon: 'error'
            }).then(function () {
               resetPage();
            });
         }
      });

      return false;
   });


   $('#Resetbtn').click(function () {
      resetPage();
   });
});


//modal
const btnCancelar = document.querySelector('#btn_close-modal');
btnCancelar.addEventListener('click', function (e) {
   e.preventDefault();
   $('.container__modal').removeClass('modal-active');
});

// const closeZone = document.querySelector('.container__modal');
// closeZone.addEventListener('click', function (e) {
//    e.preventDefault();
//    $('.container__modal').removeClass('modal-active');
// });

//Buscar usuario
const inputSearchUser = document.querySelector('#searchUser');
inputSearchUser.addEventListener('keyup', async (e) => {
   let userData = [];
   let searchValue = e.target.value;
   if (searchValue.length >= 3) {
      console.log(searchValue);
      const response = await fetch('/usuarios/get', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
         },
         body: new URLSearchParams({
            start: 0,
            length: 10,
            searchValue: searchValue
         })
      });
      const data = await response.json();
      console.log(data);
      data.data.forEach((usuario) => {
         userData.push({
            'id': usuario.id,
            'acceso':usuario.acceso,
            'fullname': usuario.fullname,
            'mail': usuario.correo,
            'phone': usuario.telefono
         });
      });
      await fillTable(userData);
   } else {
      await fillTable(await currentPageData());
   }
});

//Llena la tabla por primera vez al cargar/actualizar la página
const fillTable = async (data) => {
   document.querySelector('#demo').innerHTML = '';

   data.forEach((usuario) => {
      document.querySelector('#demo').innerHTML += `
                  <tr  class="tableOption">
                        <td>${usuario.fullname}</td>
                        <td>${usuario.mail}</td>
                        <td>${usuario.phone}</td>
                        <td>${usuario.acceso}</td>
                        <td>
                        <!-- Este solo se debe mostrar al genrente -->
                           <ul class="btn_table_options">
                              <li>
                                 <a href="#" class="btn__icon_delete" id="btnDelete_${usuario.id}">
                                    <svg class="Clickable" xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M292.309-140.001q-29.923 0-51.115-21.193-21.193-21.192-21.193-51.115V-720h-40v-59.999H360v-35.384h240v35.384h179.999V-720h-40v507.691q0 30.308-21 51.308t-51.308 21H292.309ZM680-720H280v507.691q0 5.385 3.462 8.847 3.462 3.462 8.847 3.462h375.382q4.616 0 8.463-3.846 3.846-3.847 3.846-8.463V-720ZM376.155-280h59.999v-360h-59.999v360Zm147.691 0h59.999v-360h-59.999v360ZM280-720v520-520Z"/></svg>
                                 </a>
                              </li>
                              <li>
                                 <a href="#" class="btn__icon_edit" id="btnEdit_${usuario.id}">
                                    <svg class="Clickable" xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M200-200h50.461l409.463-409.463-50.461-50.461L200-250.461V-200Zm-59.999 59.999v-135.383l527.616-527.384q9.073-8.241 20.036-12.736 10.963-4.495 22.993-4.495 12.029 0 23.307 4.27 11.277 4.269 19.969 13.576l48.846 49.461q9.308 8.692 13.269 20.004 3.962 11.311 3.962 22.622 0 12.065-4.121 23.028-4.12 10.964-13.11 20.037l-527.384 527H140.001Zm620.384-570.153-50.231-50.231 50.231 50.231Zm-126.134 75.903-24.788-25.673 50.461 50.461-25.673-24.788Z"/></svg>
                                 </a>
                              </li>
                              <li>
                                 <a href="#" class="btn__icon_show1" id="btnShow_${usuario.id}">
                                    <svg class="Clickable" xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/></svg>
                                 </a>
                              </li>
                           </ul>
                        </td>
                  </tr>`;
   });
   await pintarPaginacion();
   await addBtnDelete();
   await addBtnEdit();
   await addBtnHistorial();
};

fillTable(await currentPageData());

/*
$('#myTable').on('click', '.edit', function () {
    var row = $(this).data('row');
    var userId = $(this).data('id');
    var data = table.row(row).data();
    $('#usuarios_id').val(userId);
    $('#nombre').val(data.nombre);
    $('#apellido').val(data.apellido);
    $('#cel').val(data.telefono);
    $('#correo').val(data.correo);
    $('#username').val(data.username);

    // Disable the RFC field
    $('#rfc').prop('disabled', true);

    $('#Savebtn').text('Guardar');

 }); */


//Cambio de Contraseña
// const dataStatus = async (data)
// dataStatus= data;

//Historial de acciones
const HistorialByUsuarioId = async (id) => {
   let historial = [];
   // const index = currentIndex;
   //Solicitamos los datos
   const historialData = await fetch('/requests', {
      method: 'POST',
      headers: {
         'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
         start: 0,
         length: userPerPage,
         search_value: id
      })
   });
   console.log(`ID recibido ${id}`);
   //Convertimos los datos a JSON
   let data = await historialData.json();
   console.log(data);

   //Creamos un objeto llamado ClientData y lo llenamos iterando en la data JSON

   //Rellenamos el arreglo "clientData" con los datos del servidor
   data.data.forEach((historial) => {
      historial.push({
         'usuario_id': historial.usuario_id,
         'accion': historial.description,
         'fecha': historial.timestamp,
         'entidad': historial.table_name,
         'status': historial.status
      });
   });
   console.log(data);

   return historial;
};



const showHistorial = async (id) => {
   //Solicitamos los datos
   const data = await HistorialByUsuarioId(id);
   console.log(data);
   //Llenar Tabla modal
   const modalTable = document.querySelector('#table__modal');
   modalTable.innerHTML = '';
   console.log(`Datos solicitados para el id ${id}`);
   if (data.length === 0) {
      modalTable.innerHTML = `<tr>
         <td>No hay cambios para mostrar</td>
         <td></td>
         <td></td>
      </tr>`;
   } else
      data.forEach((historial) => {
         modalTable.innerHTML += `
                  <tr  class="tableOption">
                        <td>${historial.usuario_id}</td>
                        <td>${historial.description}</td>
                        <td>${poliza.timestamp}</td>
                        <td>${poliza.table_name}</td>
                        <td>${poliza.status}</td>
                  </tr>`;
      });
};


//Tabla de Contraseña

const currentPageData1 = async () => {
   let currentData1 = {};
   const index = currentIndex;

   //Solicitamos los datos
   currentData1 = await fetch('/usuarios/get_solicitudes_contrasenas', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
         //  start: `${index === undefined ? 0 : index * userPerPage}`,
         //  length: userPerPage
      })
      });


   //Convertimos los datos a JSON
   let data = await currentData1.json();
   console.log(data);

   totalPages = Math.floor(data.recordsTotal / userPerPage);
   console.log(`numero total de página ${totalPages}`);

   //Creamos un objeto y lo llenamos iterando en la data JSON

   //Rellenamos el arreglo con los datos del servidor
   data.data.forEach((contra) => {
      userData1.push({
         'usuario':contra.usuario,
         'correo': contra.correo
      });
   });
   console.log(`Estoy imprimiendo desde currentPageData ${userData1}`);
   return userData1;
};
const pintarPaginacion1 = async () => {
   await fetch('/usuarios/get_solicitudes_contrasenas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                start: 0,
                length: 1
            })
            })
      .then((response) => response.json())
};
const fillTable1 = async (data) => {
   document.querySelector('#demo1').innerHTML = '';

   data.forEach((contra) => {
      document.querySelector('#demo1').innerHTML +=
                  `<tr  class="tableOption">
                        <td>${contra.usuario}</td>
                        <td>${contra.correo}</td>
                  </tr>`;
   });
   await pintarPaginacion1();
   await addBtnHistorial();
};

fillTable1(await currentPageData1());


//Agregar modal de historial de cambios
const addBtnHistorial = async () => {
   const btnShow1 = document.querySelectorAll('.btn__icon_show1');

   btnShow1.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
         await historialTable(e.target.id.split('_')[1]);
         // Activa el modal
         $('.container__modal1').addClass('modal-active');
      });
   });
};

//Mostrar tabla de historial

const historialTable = async (id) => {
   //Solicitamos los datos
   currentData2 = await fetch('/solicitudes/get_all', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
         //  start: `${index === undefined ? 0 : index * userPerPage}`,
         //  length: userPerPage
      })
      });
   console.log(data);
   //Llenar Tabla modal
   const tablaHistorial = document.querySelector('#table__modal');
   tablaHistorial.innerHTML = '';
   console.log(`Datos solicitados para el id ${id}`);
   if (data.length === 0) {
      tablaHistorial.innerHTML = `<tr>
         <td>No hay polizas registradas</td>
         <td></td>
         <td></td>
      </tr>`;
   } else
      data.forEach((poliza) => {
         tablaHistorial.innerHTML += `
                  <tr  class="tableOption">
                        <td>${poliza.poliza}</td>
                        <td>${poliza.ramo}</td>
                        <td>${poliza.subramo}</td>
                        <td>${poliza.primaNeta}</td>
                        <td>${poliza.primaTotal}</td>
                        <td>${poliza.fechaFin}</td>
                        <td>${poliza.status}</td>
                  </tr>`;
      });
};