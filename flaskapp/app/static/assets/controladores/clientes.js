import { datatableConfig } from './datatable-config.js';

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
      $('#cliente-form')[0].reset();
      // Reset the form validation state
      $('#cliente-form').removeClass('was-validated');
      // Enable all form inputs
      $('#cliente-form input').prop('disabled', false);
      $('#cliente-form select').prop('disabled', false);
      // Set usuario_id value to "New"
      $('#cliente_id').val('New');
      // Change the text of the Save button back to "Crear"
      $('#Savebtn').text('Crear');
      if ($.fn.DataTable.isDataTable('#myTable')) {
         var table = $('#myTable').DataTable();
         table.ajax.reload();
      }
      $('#nuevo_grupo_div').hide(); // Corrected class name
   }

   // Configuracion de Tabla de clientes

   var table = $('#myTable').DataTable({
      ...datatableConfig,
      'ajax': {
         'url': '/get_clients_data',
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
         { 'data': 'fullname' },
         { 'data': 'correo' },
         { 'data': 'tel_movil' },
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
         { 'data': 'nombre', 'visible': false, 'title': 'Nombre' },
         { 'data': 'apellido', 'visible': false, 'title': 'Apellido' },
         { 'data': 'grupo_id', 'visible': false, 'title': 'Grupo ID' },
         { 'data': 'grupo', 'visible': false, 'title': 'Grupo' },
         { 'data': 'rfc', 'visible': false, 'title': 'RFC' },
         {
            'data': 'tel_oficina',
            'visible': false,
            'title': 'Teléfono Oficina'
         },
         { 'data': 'tel_casa', 'visible': false, 'title': 'Teléfono Casa' },
         { 'data': 'direccion', 'visible': false, 'title': 'Dirección' },
         {
            'data': 'fecha_nacimiento',
            'visible': false,
            'title': 'Fecha de Nacimiento'
         },
         { 'data': 'sexo', 'visible': false, 'title': 'Sexo' },
         { 'data': 'ocupacion', 'visible': false, 'title': 'Ocupación' },
         { 'data': 'actividad', 'visible': false, 'title': 'Actividad' }
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

   // Ruta de AJAX para la creacion/edicion de clientes
   $('#cliente-form').submit(function (e) {
      e.preventDefault();

      var formData = $(this).serialize();

      // Checar que el formulario este validado
      if (!this.checkValidity()) {
         $(this).addClass('was-validated');
         return;
      }

      $.ajax({
         type: 'POST',
         url: '/create_client',
         data: formData,
         success: function (response) {
            if (response.error) {
               Swal.fire({
                  title: 'Cliente incorrecto',
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
      var clientId = $(this).data('id');
      var data = table.row(row).data();
      $('#cliente_id').val(clientId);
      $('#nombre').val(data.nombre);
      $('#apellido').val(data.apellido);
      $('#correo').val(data.correo);
      $('#cel').val(data.tel_movil);
      $('#grupo').val(data.grupo_id);
      $('#rfc').val(data.rfc);
      $('#telefono_oficina').val(data.tel_oficina);
      $('#telefono_movil').val(data.tel_movil);
      $('#telefono_casa').val(data.tel_casa);
      $('#direccion_fiscal').val(data.direccion);
      $('#fecha_nacimiento').val(data.fecha_nacimiento);
      $('#sexo').val(data.sexo);
      $('#ocupacion').val(data.ocupacion);
      $('#giro_actividad').val(data.actividad);

      // Disable the RFC field
      $('#rfc').prop('disabled', true);

      $('#Savebtn').text('Guardar');
      $('#nuevo_grupo_div').hide(); // Corrected class name
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
