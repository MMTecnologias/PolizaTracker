// datatable-config.js
export const datatableConfig = {
   'responsive': false,
   'lengthChange': true,
   'autoWidth': true,
   'serverSide': true,
   'language': {
      'decimal': '',
      'emptyTable': 'No hay datos disponibles en la tabla',
      'info': 'Mostrando _START_ a _END_ de _TOTAL_ entradas',
      'infoEmpty': 'Mostrando 0 a 0 de 0 entradas',
      'infoFiltered': '(filtrado de MAX entradas totales)',
      'infoPostFix': '',
      'thousands': ',',
      'lengthMenu':
         '<span class="d-flex">Mostrar <select class="form-control form-control-sm ml-2 mr-2"> ' +
         '<option value="10">10</option>' +
         '<option value="20">20</option>' +
         '<option value="30">30</option>' +
         ' ' +
         ' entradas</span>',
      'loadingRecords': 'Cargando...',
      'processing': 'Procesando...',
      'search': 'Buscar:',
      'zeroRecords': 'No se encontraron registros coincidentes',
      'paginate': {
         'first': 'Primero',
         'last': 'Último',
         'next': 'Siguiente',
         'previous': 'Anterior'
      },
      'aria': {
         'sortAscending':
            ': activar para ordenar la columna en orden ascendente',
         'sortDescending':
            ': activar para ordenar la columna en orden descendente'
      }
   }
};

export const datatableConfig_plane = {
   'responsive': false,
   'lengthChange': true,
   'autoWidth': true,
   'serverSide': true,
   'searching': false, // Disable search
   'ordering': false, // Disable sorting
   'language': {
      'decimal': '',
      'emptyTable': 'No hay datos disponibles en la tabla',
      'info': 'Mostrando _START_ a _END_ de _TOTAL_ entradas',
      'infoEmpty': 'Mostrando 0 a 0 de 0 entradas',
      'infoPostFix': '',
      'thousands': ',',
      'lengthMenu':
         '<span class="d-flex">Mostrar <select class="form-control form-control-sm ml-2 mr-2"> ' +
         '<option value="10">10</option>' +
         '<option value="20">20</option>' +
         '<option value="30">30</option>' +
         ' ' +
         ' entradas</span>',
      'loadingRecords': 'Cargando...',
      'processing': 'Procesando...',
      'zeroRecords': 'No se encontraron registros coincidentes',
      'paginate': {
         'first': 'Primero',
         'last': 'Último',
         'next': 'Siguiente',
         'previous': 'Anterior'
      }
   }
};
