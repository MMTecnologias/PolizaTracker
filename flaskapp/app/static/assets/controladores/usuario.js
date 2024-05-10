import { datatableConfig } from './datatable-config.js';

let userPerPage = 5;

let currentIndex = 0;

let sorting = false;

let totalPages = 0;

const currentIndexToShow = (currentIndex) => currentIndex + 1;

const currentPageData = async () => {
   let currentData = {};
   let userData = [];
   const index = currentIndex;

   //Solicitamos los datos
   currentData = await fetch('/get_usuarios_data2');
   //Solicitamos los datos
   // if (sorting === true) {
   //    currentData = await fetch('/get_usuarios_data2', {
   //       method: 'GET',
   //       headers: {
   //          'Content-Type': 'application/x-www-form-urlencoded'
   //       },
   //       body: new URLSearchParams({
   //          start: `${index === undefined ? 0 : index * userPerPage}`,
   //          length: userPerPage
   //       })
   //    });
   // } else {
   //    currentData = await fetch('/get_usuarios_data2', {
   //       method: 'GET',
   //       headers: {
   //          'Content-Type': 'application/x-www-form-urlencoded'
   //       },
   //       body: new URLSearchParams({
   //          start: `${index === undefined ? 0 : index * userPerPage}`,
   //          length: userPerPage
   //       })
   //    });
   // }

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
         'fullname': usuario.nombre,
         'mail': usuario.correo,
         'phone': usuario.telefono
      });
   });
   console.log(`Estoy imprimiendo desde currentPageData ${userData}`);
   return userData;
};

const polizasByClientId = async (id) => {
   let polizas = [];
   // const index = currentIndex;
   //Solicitamos los datos
   const polizaData = await fetch('/get_poliza_byClientID', {
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
   let data = await polizaData.json();
   console.log(data);

   //Creamos un objeto llamado userData y lo llenamos iterando en la data JSON

   //Rellenamos el arreglo "userData" con los datos del servidor
   data.data.forEach((poliza) => {
      polizas.push({
         'poliza': poliza.poliza,
         'cliente': poliza.cliente,
         'aseguradora': poliza.aseguradora,
         'vigencia': poliza.vigencia,
         'ramo': poliza.ramo,
         'subramo': poliza.subramo,
         'primaNeta': poliza.primaNeta,
         'primaTotal': poliza.primaTotal,
         'fechaFin': poliza.fechaFin,
         'status': poliza.status
      });
   });
   console.log(data);

   return polizas;
};

const updateTable = async (userData) => {
   let iterator = 0;
   const rows = document.querySelectorAll('#demo>tr.tableOption');
   console.log(`estoy imprimiendo desde updateTable ${userData}`);

   userData.forEach((usuario) => {
      rows[
         iterator
      ].innerHTML = `<td>${usuario.nombre}</td><td>${usuario.correo}</td><td>${usuario.telefono}</td><td><ul class="btn_table_options">
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
                                 <a href="#" class="btn__icon_show" id="btnShow_${usuario.id}">
                                    <svg class="noClickable" xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/></svg>
                                 </a>
                              </li>
                           </ul></td>`;
      iterator++;
   });
   await addBtnDelete();
   await addBtnEdit();
   await addBtnShow();
};

//Eliminar usuario desde la tabla
const addBtnDelete = async () => {
   const btnDelete = document.querySelectorAll('.btn__icon_delete');

   btnDelete.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
         //función eliminar
         await deleteClient(e.target.id.split('_')[1]);
         await updateTable(await currentPageData());
      });
   });
};

//Función para eliminar usuario
const deleteClient = async (id) => {
   //insertar función eliminar

   await fetch('/delete_user', {
      method: 'POST',
      headers: {
         'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
         usuarios_id: id
      })
   });
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

   const response = await fetch('/get_clients_filtered', {
      method: 'POST',
      headers: {
         'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
         search_value: id
      })
   });
   console.log(`imprime desde editClient ${id}`);
   const data = await response.json();
   console.log(data.data[0]);
   $('#usuarios_id').val(data.data[0].id);
   $('#nombre').val(data.data[0].nombre);
   $('#apellido').val(data.data[0].apellido);
   $('#rfc').val(data.data[0].rfc);
   $('#telefono_oficina').val(data.data[0].tel_oficina);
   $('#telefono_movil').val(data.data[0].tel_movil);
   $('#telefono_casa').val(data.data[0].tel_casa);
   $('#correo').val(data.data[0].correo);
   $('#direccion_fiscal').val(data.data[0].direccion);
   $('#fecha_nacimiento').val(data.data[0].fecha_nacimiento);
   $('#sexo').html(`<option value='${data.data[0].sexo}'>
         ${data.data[0].sexo}
         </option>
         <option value="Mujer">Mujer</option>
         <option value="Hombre">Hombre</option>
         <option value="Otro">Otro</option>

         `);
   $('#ocupacion').val(data.data[0].ocupacion);
   $('#giro_actividad').val(data.data[0].actividad);
   $('#grupo').html(`<option value='${data.data[0].grupo_id}'> ${
      data.data[0].grupo
   }</option>
         <!-- pintar todas las opciones -->
         ${fetch('/grupo')
            .then((response) => response.json())
            .then((data) => {
               data.forEach((grupo) => {
                  document.querySelector('#grupo').innerHTML += `
               <option value='${grupo.id}'>${grupo.nombre}</option>
               `;
               });
            })}
         `);
};

const addBtnShow = async () => {
   const btnShow = document.querySelectorAll('.btn__icon_show');

   btnShow.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
         await showPoliza(e.target.id.split('_')[1]);
         // Activa el modal
         $('.container__modal').addClass('modal-active');
      });
   });
};

const showPoliza = async (id) => {
   //Solicitamos los datos
   const data = await polizasByClientId(id);
   console.log(data);
   //Llenar Tabla modal
   const modalTable = document.querySelector('#table__modal');
   modalTable.innerHTML = '';
   console.log(`Datos solicitados para el id ${id}`);
   if (data.length === 0) {
      modalTable.innerHTML = `<tr>
         <td>No hay polizas registradas</td>
         <td></td>
         <td></td>
      </tr>`;
   } else
      data.forEach((poliza) => {
         modalTable.innerHTML += `
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

const verGrupos = async () => {
   fetch('/grupo')
      .then((response) => response.json())
      .then((data) => {
         console.log(data);
      });
};

const pintarPaginacion = async () => {
   await fetch('/get_usuarios_data2') //, {
   //    method: 'GET',
   //    headers: {
   //       'Content-Type': 'application/x-www-form-urlencoded'
   //    },
   //    body: new URLSearchParams({
   //       start: 0,
   //       length: 1
   //    })
   // })
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
   //Funcion para mostrar nuevo grupo input
   $('#grupo').change(function () {
      var selectedOption = $(this).val();
      if (selectedOption === 'New') {
         $('#nuevo_grupo_div').show(); // Corrected class name
         $('#nuevo_grupo').prop('required', true);
      } else {
         $('#nuevo_grupo_div').hide(); // Corrected class name
         $('#nuevo_grupo').prop('required', false);
      }
   });
   // Funcion para recargar tabla y regresar form a status inicial
   function resetPage() {
      // Reset the form values
      $('#user-form')[0].reset();
      // Reset the form validation state
      $('#user-form').removeClass('was-validated');
      // Enable all form inputs
      $('#user-form input').prop('disabled', false);
      $('#user-form select').prop('disabled', false);
      // Set usuario_id value to "New"
      $('#usuarios_id').val('New');
      // Change the text of the Save button back to "Crear"
      $('#Savebtn').text('Crear');
      if ($.fn.DataTable.isDataTable('#myTable')) {
         var table = $('#myTable').DataTable();
         table.ajax.reload();
      }
      $('#nuevo_grupo_div').hide(); // Corrected class name
   }

   // Configuracion de Tabla de usuarios

   var table = $('#myTable').DataTable({
      ...datatableConfig,
      'ajax': {
         'url': '/get_usuarios_data2',
         'type': 'GET',
         'dataSrc': 'data',
         'error': function (xhr, textStatus, errorThrown) {
            Swal.fire({
               title: 'Error inesperado',
               text: 'Lamentamos el inconveniente, por favor vuelve a intentarlo',
               icon: 'error'
            });
         }
      },
      'columns': [
         { 'data': 'nombre' },
         { 'data': 'correo' },
         { 'data': 'telefono' },
         {
            'data': null,
            'render': function (data, type, row, meta) {
               return (
                  '<a href="#" class="edit" data-id="' +
                  row.id +
                  '" data-row="' +
                  meta.row +
                  '"><img src="' +
                  editicon +
                  '" width="15" height="15" /><i class="material-icons" data-toggle="tooltip" title="Edit"></i></a>' +
                  '<a href="#" class="delete" data-id="' +
                  row.id +
                  '" data-row="' +
                  meta.row +
                  '"><img src="' +
                  deleteicon +
                  '" width="20" height="20" /><i class="material-icons" data-toggle="tooltip" title="Delete"></i></a>'
               );
            }
         },
         { 'data': 'id', 'visible': false, 'title': 'Id' },
         { 'data': 'username', 'visible': false, 'title': 'Username' },
         { 'data': 'password', 'visible': false, 'title': 'Contraseña' },
         { 'data': 'nivel_id', 'visible': false, 'title': 'Nivel' },
         { 'data': 'nombre', 'visible': false, 'title': 'Nombre' },
         { 'data': 'correo', 'visible': false, 'title': 'Correo' },
         {
            'data': 'telefono',
            'visible': false,
            'title': 'Teléfono'
         },
         { 'data': 'status', 'visible': false, 'title': 'Status' }
         //{"data": "status", "visible": false, "title": "Status"}
      ]
   });

   $('#myTable_wrapper .col-md-6:eq(0)').append(
      $('#myTable_wrapper .dt-buttons')
   );
   $('#myTable_length').appendTo('#LengthMenu');
   $('#myTable_filter').appendTo('#Buscador');
   $('#myTable_info').appendTo('#InfoEmpaty');
   $('#myTable_paginate').appendTo('#Paginacion');

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
         url: '/create_user',
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
                  if (response.add_group_opt) {
                     var option = $(
                        '<option value="' +
                           response.new_group_id +
                           '">' +
                           response.new_group_name +
                           '</option>'
                     );

                     // Insert the new option before the existing "Nuevo Grupo" option
                     $('#grupo').find('option[value="New"]').before(option);
                  }
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

   // Llenado de formulario al presionar editar
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
      
   });

  //Funcion con AJAX para eliminacion de usuarios
   $('#myTable').on('click', '.delete', function () {
      var row = $(this).data('row');
      var clienteId = $(this).data('id');
      var data = table.row(row).data();

      Swal.fire({
         title: 'Deseas eliminar a ' + data.nombre + ' ' + data.apellido,
         text: '¡No podrás revertir esto!',
         icon: 'warning',
         showCancelButton: true,
         confirmButtonColor: '#3085d6',
         cancelButtonColor: '#d33',
         confirmButtonText: 'Eliminar'
      }).then((result) => {
         if (result.isConfirmed) {
            $.ajax({
               type: 'POST',
               url: '/delete_client',
               data: { client_id: clienteId },
               success: function (response) {
                  if (!response.error) {
                     table.ajax.reload();
                     Swal.fire({
                        title: response.title,
                        text: response.msg,
                        icon: 'success'
                     }).then(function () {
                        resetPage();
                     });
                  } else {
                     Swal.fire({
                        title: 'Error',
                        text: response.msg,
                        icon: 'error'
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
         }
      });
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

//Buscar cliente
const inputSearchClient = document.querySelector('#searchClient');
inputSearchClient.addEventListener('keyup', async (e) => {
   let userData = [];
   let searchValue = e.target.value;
   if (searchValue.length >= 3) {
      console.log(searchValue);
      const response = await fetch('/get_clients_filtered_byName', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
         },
         body: new URLSearchParams({
            start: 0,
            length: 5,
            search_value: searchValue
         })
      });
      const data = await response.json();
      console.log(data);
      data.data.forEach((usuario) => {
         userData.push({
            'id': usuario.id,
            'fullname': usuario.fullname,
            'mail': usuario.correo,
            'phone': usuario.tel_movil
         });
      });
      await fillTable(userData);
   } else {
      await fillTable(await currentPageData());
   }
   //Enviamos el objeto/array para actualizar la tabla
   // return updateTable(data);
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
                        <td>
                        <!-- Este solo se debe mostrar al genrente -->
                           <ul class="btn_table_options">
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
                                 <a href="#" class="btn__icon_show" id="btnShow_${usuario.id}">
                                    <svg class="noClickable" xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/></svg>
                                 </a>
                              </li>
                           </ul>
                        </td>
                     
                  </tr>`;
   });
   await pintarPaginacion();
   await addBtnDelete();
   await addBtnEdit();
   await addBtnShow();
};

fillTable(await currentPageData());