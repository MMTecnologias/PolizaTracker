import { datatableConfig } from './datatable-config.js';
import { datatableConfig_plane } from './datatable-config.js';

const serie = document.getElementById('serie');

let clientsPerPage = 10;

let currentIndex = 0;

let sorting = false;

const currentIndexToShow = (currentIndex) => currentIndex + 1;

const currentPageData = async () => {
   let polizaData = [];
   const index = currentIndex;
   //Solicitamos los datos
   const currentPageData = await fetch('/get_polizas_data', {
      method: 'POST',
      headers: {
         'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
         start: `${index === undefined ? 0 : index * clientsPerPage}`,
         length: clientsPerPage
      })
   });

   //Convertimos los datos a JSON
   let data = await currentPageData.json();

   console.log(data);

   //Creamos un objeto llamado ClientData y lo llenamos iterando en la data JSON

   //Rellenamos el arreglo "clientData" con los datos del servidor
   data.data.forEach((poliza) => {
      polizaData.push({
         'poliza': poliza.poliza,
         'cliente': poliza.cliente,
         'aseguradora': poliza.aseguradora,
         'vigencia': poliza.vigencia,
         'id': poliza.id,
         'subramo': poliza.subramo,
         'fechaInicio': poliza.fechaInicio,
         'fechaFin': poliza.fechaFin,
         'primaNeta': poliza.primaNeta,
         'primaTotal': poliza.primaTotal,
         'tipoPago': poliza.tipoPago
      });
   });

   return polizaData;
};

const fillTable = async () => {
   document.querySelector('#demo').innerHTML = '';
   const currentData = await currentPageData();

   currentData.forEach((poliza) => {
      document.getElementById('demo').innerHTML += `

               <tr  class="tableOption" >

                     <td><p class="td-clickable" id="td-clickable_${poliza.poliza}">${poliza.poliza}</p></td>
                     <td>${poliza.cliente}</td>
                     <td>${poliza.subramo}</td>
                     <td>${poliza.fechaInicio}</td>
                     <td>${poliza.fechaFin}</td>
                     <td>${poliza.primaNeta}</td>
                     <td>${poliza.primaTotal}</td>
                     <td>${poliza.aseguradora}</td>
                     <td>${poliza.tipoPago}</td>

               </tr>

            `;
   });
   await addBtnShow();
   await pintarPaginacion();
};

fillTable();

const updateTable = async () => {
   const rows = document.querySelectorAll('#demo>tr.tableOption');
   let poliza = '';
   if (sorting === true) {
      poliza = await sortedCurrentPageData();
   } else {
      poliza = await currentPageData();
   }
   console.log(rows);
   for (let i = 0; i < rows.length; i++) {
      rows[i].innerHTML = `

               <tr  class="tableOption">

                     <td><p class="td-clickable" id="td-clickable_${poliza.poliza}">${poliza.poliza}</p></td>
                     <td>${poliza.cliente}</td>
                     <td>${poliza.subramo}</td>
                     <td>${poliza.fechaInicio}</td>
                     <td>${poliza.fechaFin}</td>
                     <td>${poliza.primaNeta}</td>
                     <td>${poliza.primaTotal}</td>
                     <td>${poliza.aseguradora}</td>
                     <td>${poliza.tipoPago}</td>

               </tr>

            `;
   }
   await addBtnShow();
};

const addBtnShow = async (id) => {
   const btnShow = document.querySelectorAll('.td-clickable');

   btnShow.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
         await rellenarFormulario(e.target.id.split('_')[1]);
         console.log(`id enviado: ${e.target.id.split('_')[1]}`);
         // Activa el modal
         // $('.container__modal').addClass('modal-active');
      });
   });
};

const pintarPaginacion = async () => {
   await fetch('/get_polizas_data', {
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

         if (currentIndex == 0) {
            document.querySelector('#prev-index').classList.add('noClickable');
         } else {
            document
               .querySelector('#prev-index')
               .classList.remove('noClickable');
         }

         if (data.recordsTotal < clientsPerPage) {
            document.querySelector('#next-index').classList.add('noClickable');
         }
      });
};

const nextIndex = document.querySelector('#next-index');
nextIndex.addEventListener('click', async () => {
   ++currentIndex;
   console.log(`el indice actual es ${currentIndex}`);
   await pintarPaginacion();
   await updateTable();
});

const prevIndex = document.querySelector('#prev-index');
prevIndex.addEventListener('click', async () => {
   --currentIndex;
   console.log(`el indice actual es ${currentIndex}`);
   await pintarPaginacion();
   await updateTable();
});

function buscarPoliza() {
   const inputPoliza = document.getElementById('Poliza');
   fetch('/get_polizas_data2')
      .then((response) => response.json())
      .then(function (data) {
         inputPoliza.addEventListener('input', (event) => {
            console.log(event.target.value);
            let coincidencias = data.filter((objeto) => {
               let idString = objeto.poliza.toString();
               let ultimosTresDigitos = idString.substring(idString.length - 3);

               return ultimosTresDigitos.includes(event.target.value);
            });
            document.getElementById('demo').innerHTML = '';
            console.log(typeof coincidencias);
            console.log(coincidencias);
            for (var i = 0; i < coincidencias.length; i++) {
               console.log(coincidencias);
               document.getElementById('demo').innerHTML += `
               <tr class='tableOption'>
                  <td> <p class="td-clickable">${coincidencias[i]['poliza']}</p></td>
                  <td>${coincidencias[i]['cliente']}</td>
                  <td>${coincidencias[i]['subramo']}</td>
                  <td>${coincidencias[i]['fechaInicio']}</td>
                  <td>${coincidencias[i]['fechaFin']}</td>
                  <td>${coincidencias[i]['primaNeta']}</td>
                  <td>${coincidencias[i]['primaTotal']}</td>
                  <td>${coincidencias[i]['aseguradora']}</td>
                  <td>${coincidencias[i]['tipoPago']}</td>
               </tr>

               `;
            }
            console.log(document.querySelectorAll('.td-clickable'));
            return console.log(coincidencias);
         });
      });
}

buscarPoliza();

const rellenarFormulario = async (poliza) => {
   fetch('/get_polizas_data2')
      .then((response) => response.json())
      .then(async function (data) {
         let coincidencia = await data.find((objeto) => {
            return objeto.poliza == poliza;
         });
         console.log(coincidencia);
         document.getElementById('buscar-cliente').value = coincidencia.cliente;
         document.getElementById('Poliza').value = coincidencia.poliza;
         document.getElementById('serie').value = coincidencia.serie;
         document.getElementById(
            'ramo'
         ).innerHTML = `<option value="${coincidencia.ramo}">
        ${coincidencia.ramo}
         </option>`;
         document.getElementById(
            'subramo'
         ).innerHTML = `<option value="${coincidencia.subramo}">
        ${coincidencia.subramo}
         </option>`;
         document.getElementById('VigenciaI').value = coincidencia.fechaInicio;
         document.getElementById('prima_neta').value = coincidencia.primaNeta;
         document.getElementById('prima_total').value = coincidencia.primaTotal;
         document.getElementById('VigenciaF').value = coincidencia.fechaFin;
         document.getElementById(
            'Aseguradora'
         ).innerHTML = `<option value="${coincidencia.aseguradora}">
        ${coincidencia.aseguradora}
         </option>`;
         document.getElementById(
            'Pago'
         ).innerHTML = `<option value="${coincidencia.tipoPago}">
        ${coincidencia.tipoPago}
         </option>`;
         //Falta Vendedor, Moneda, Agente, Poliza anterior
      });
};

const sortedCurrentPageData = async () => {
   let clientData = [];
   const index = currentIndex;
   //Solicitamos los datos
   const currentPageData = await fetch('/get_sorted_poliza_data', {
      method: 'POST',
      headers: {
         'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
         start: `${index === undefined ? 0 : index * clientsPerPage}`,
         length: clientsPerPage
      })
   });

   //Convertimos los datos a JSON
   let data = await currentPageData.json();
   console.log(data);

   //Creamos un objeto llamado ClientData y lo llenamos iterando en la data JSON

   //Rellenamos el arreglo "clientData" con los datos del servidor
   data.data.forEach((poliza) => {
      polizaData.push({
         'poliza': poliza.poliza,
         'cliente': poliza.cliente,
         'aseguradora': poliza.aseguradora,
         'vigencia': poliza.vigencia,
         'id': poliza.id,
         'subramo': poliza.subramo,
         'fechaInicio': poliza.fechaInicio,
         'fechaFin': poliza.fechaFin,
         'primaNeta': poliza.primaNeta,
         'primaTotal': poliza.primaTotal,
         'tipoPago': poliza.tipoPago
      });
   });

   return clientData;
};

const sortButton = document.querySelector('#sortByPoliza');
sortButton.addEventListener('click', async () => {
   sorting = !sorting;
   console.log(`el valor de sorting es ${sorting}`);
   currentIndex = 0;
   updateTable();
   pintarPaginacion();
});

$(document).ready(function () {
   // funcion para mostrar nuevo ramo/subramo
   function cambioramosubramo(ramo, subramo) {
      if (ramo == 'New' || subramo == 'New') {
         $('#nuevo_ramo_subramo_div').show();
         if (ramo == 'New') {
            $('#nuevo_ramo_div').show();
            $('#nuevo_ramo').prop('required', true);
         } else {
            $('#nuevo_ramo_div').hide();
            $('#nuevo_ramo').prop('required', false);
         }
         if (subramo == 'New') {
            $('#nuevo_subramo_div').show();
            $('#nuevo_subramo').prop('required', true);
         } else {
            $('#nuevo_subramo_div').hide();
            $('#nuevo_subramo').prop('required', false);
         }
      } else {
         $('#nuevo_ramo_subramo_div').hide(); // Corrected class name
         $('#nuevo_ramo_div').hide();
         $('#nuevo_subramo_div').hide();
         $('#nuevo_ramo').prop('required', false);
         $('#nuevo_subramo').prop('required', false);
      }
   }
   $('#ramo').change(function () {
      var ramoopt = $('#ramo').val();
      var subramoopt = $('#subramo').val();
      cambioramosubramo(ramoopt, subramoopt);
   });
   $('#subramo').change(function () {
      var ramoopt = $('#ramo').val();
      var subramoopt = $('#subramo').val();
      cambioramosubramo(ramoopt, subramoopt);
   });

   // funcion para mostrar nueva aseguradora
   $('#Aseguradora').change(function () {
      var opt = $('#Aseguradora').val();
      if (opt == 'New') {
         $('#nuevo_aseguradora_div').show();
         $('#nuevo_aseguradora').prop('required', true);
      } else {
         $('#nuevo_aseguradora_div').hide();
         $('#nuevo_aseguradora').prop('required', false);
      }
   });

   $('#vendedor').change(function () {
      var opt = $('#vendedor').val();
      if (opt == 'New') {
         $('#nuevo_vendedor_div').show();
         $('#nuevo_vendedor').prop('required', true);
      } else {
         $('#nuevo_vendedor_div').hide();
         $('#nuevo_vendedor').prop('required', false);
      }
   });

   // funcion para mostrar nuevo agente
   $('#agente').change(function () {
      var opt = $('#agente').val();
      if (opt == 'New') {
         $('#nuevo_agente_div').show();
         $('#nuevo_agente').prop('required', true);
      } else {
         $('#nuevo_agente_div').hide();
         $('#nuevo_agente').prop('required', false);
      }
   });

   // funcion para buscar clientes
   function fetchClientOptions(inputValue) {
      $.ajax({
         url: '/search_clients', // Your server route to fetch client options
         method: 'POST',
         dataType: 'json',
         data: { query: inputValue }, // Send the input value as data
         success: function (response) {
            var options = response.options;
            var dropdownMenu = $('#client-options');
            dropdownMenu.empty(); // Clear existing options
            if (options.length === 0) {
               dropdownMenu.append(
                  '<p class="dropdown-item no-results" href="#">No hay coincidencias</p>'
               );
            } else {
               options.forEach(function (option) {
                  dropdownMenu.append(
                     '<a class="dropdown-item" href="#" data-id="' +
                        option.id +
                        '">' +
                        option.name +
                        '</a>'
                  );
               });
            }
            dropdownMenu.show(); // Show the dropdown
         },
         error: function (xhr, textStatus, errorThrown) {
            Swal.fire({
               title: 'Error inesperado',
               text: 'Lamentamos el inconveniente, por favor vuelve a intentarlo',
               icon: 'error'
            });
         }
      });
   }
   //variables para guardar cliente seleccionado
   var selectedName = '';
   var selectedId = '';
   // Buscar cliente si cambia el input
   $('#buscar-cliente').on('keyup', function () {
      var inputValue = $(this).val(); // Get the input value
      if (inputValue.length >= 3) {
         // Minimum characters to trigger search
         fetchClientOptions(inputValue); // Fetch options based on input value
      } else {
         $('#client-options').hide();
         $('#buscar-cliente')[0].setCustomValidity('');
      }
   });

   // Seleccionar cliente de la lista
   $('#client-options').on('click', '.dropdown-item', function (event) {
      event.preventDefault(); // Prevent the default behavior of the click event
      if ($(this).hasClass('no-results')) {
         return; // Do nothing if it's a no results item
      }
      selectedId = $(this).data('id');
      selectedName = $(this).text();
      $('#buscar-cliente').val(selectedName);
      $('#selected-client-id').val(selectedId); // Store selected client ID
      $('#client-options').hide();
      $('#buscar-cliente')[0].setCustomValidity('');
   });

   // Enviar el form solo si se selecciono un clientes
   $('#form-polizas').on('submit', function (event) {
      var inputValue = $('#buscar-cliente').val();
      if (
         $('#client-options').is(':visible') ||
         selectedName != inputValue ||
         inputValue.length < 3
      ) {
         event.preventDefault(); // Prevent form submission if input value is not in dropdown
         $('#buscar-cliente')[0].setCustomValidity('Ingresa un dato valido'); // Set custom validation message
      } else {
         $('#buscar-cliente')[0].setCustomValidity(''); // Reset custom validation message if input is valid
      }
   });

   // Configuracion de Tabla de polizas
   var table = $('#polizasTable').DataTable({
      ...datatableConfig,
      'ajax': {
         'url': '/get_polizas_data',
         'type': 'POST',
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
         { 'data': 'poliza' },
         { 'data': 'cliente' },
         { 'data': 'aseguradora' },
         { 'data': 'vigencia' },
         {
            'data': null,
            'render': function (data, type, row, meta) {
               return (
                  '<a href="#" class="edit" data-id="' +
                  row.id +
                  '" data-row="' +
                  meta.row +
                  '"><img src="' +
                  seeicon +
                  '" width="15" height="15" /><i class="material-icons" data-toggle="tooltip" title="See"></i></a>'
               );
            },
            'width': '2%'
         },
         { 'data': 'id', 'visible': false, 'title': 'Id' }
      ]
   });

   $('#polizasTable_wrapper .col-md-6:eq(0)').append(
      $('#myTable_wrapper .dt-buttons')
   );
   $('#polizasTable_length').appendTo('#LengthMenu');
   $('#polizasTable_filter').appendTo('#Buscador');
   $('#polizasTable_info').appendTo('#InfoEmpaty');
   $('#polizasTable_paginate').appendTo('#Paginacion');

   // Configuracion de Tabla de clientes
   var receiptsTable = $('#recibosTable').DataTable({
      ...datatableConfig_plane,
      'ajax': {
         'url': '/get_receipts_data',
         'type': 'POST',
         'data': function (d) {
            // Additional data to send with the request
            d.poliza_id = $('#poliza_id').val(); // Assuming the id is obtained from some element
         },
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
         { 'data': 'numero' },
         { 'data': 'fecha_recibo' },
         { 'data': 'vencimiento' },
         { 'data': 'prima_neta' },
         { 'data': 'prima_total' },
         { 'data': 'comision' },
         {
            'data': 'pagado',
            'render': function (data, type, row) {
               // Render a checkbox based on the value of 'pagado'
               return data
                  ? '<input type="checkbox" checked disabled>'
                  : '<input type="checkbox" disabled>';
            }
         },
         { 'data': 'fecha_pago' },
         { 'data': 'comprobante' },
         {
            'data': 'cancelado',
            'render': function (data, type, row) {
               // Render a checkbox based on the value of 'pagado'
               return data
                  ? '<input type="checkbox" checked disabled>'
                  : '<input type="checkbox" disabled>';
            }
         }
      ]
   });

   table.on('click', '.edit', function () {
      //var row = $(this).data('row');
      var polizaId = $(this).data('id');
      //var data = table.row(row).data();
      $('#poliza_id').val(polizaId);
      receiptsTable.ajax.reload();
   });
});
