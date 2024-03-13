import { datatableConfig } from './datatable-config.js';
import { datatableConfig_plane } from './datatable-config.js';

function fetch_test() {
   document.getElementById('demo').innerHTML = '';
   // fetch('/get_usuarios_data2')
   fetch('/get_polizas_data2')
      .then((response) => response.json())
      .then(function (data) {
         for (var i = 0; i < data.length; i++) {
            document.getElementById('demo').innerHTML += `<tr>
                        <td>${data[i]['poliza']}</td>
                        <td>${data[i]['cliente']}</td>
                        <td>${data[i]['subramo']}</td>
                        <td>${data[i]['fechaInicio']}</td>
                        <td>${data[i]['fechaFin']}</td>
                        <td>${data[i]['primaNeta']}</td>
                        <td>${data[i]['primaTotal']}</td>
                        <td>${data[i]['aseguradora']}</td>
                        <td>${data[i]['tipoPago']}</td>
                        </tr>`;
         }
      });
}

fetch_test();

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
            document.getElementById('demo').innerHTML += `<tr>
                        <td>${coincidencias[0]['poliza']}</td>
                        <td>${coincidencias[0]['cliente']}</td>
                        <td>${coincidencias[0]['subramo']}</td>
                        <td>${coincidencias[0]['fechaInicio']}</td>
                        <td>${coincidencias[0]['fechaFin']}</td>
                        <td>${coincidencias[0]['primaNeta']}</td>
                        <td>${coincidencias[0]['primaTotal']}</td>
                        <td>${coincidencias[0]['aseguradora']}</td>
                        <td>${coincidencias[0]['tipoPago']}</td>
                        </tr>`;
            return console.log(coincidencias);
         });
      });
}

buscarPoliza();

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
