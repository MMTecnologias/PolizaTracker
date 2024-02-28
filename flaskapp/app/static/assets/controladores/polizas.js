$(document).ready(function() {

    // Configuracion de Tabla de polizas
    var table = $("#polizasTable").DataTable({
        "responsive": false,
        "lengthChange": true,
        "autoWidth": true,
        "serverSide": true,
        "ajax": {
            "url": "/get_polizas_data",
            "type": "POST",
            "dataSrc": "data",
            "error": function(xhr, textStatus, errorThrown) {
                Swal.fire({
                    title: 'Error inesperado',
                    text: 'Lamentamos el inconveniente, por favor vuelve a intentarlo',
                    icon: 'error'
                });
            }
        },
        "columns": [
            {"data": "poliza"},
            {"data": "cliente"},
            {"data": "aseguradora"},
            {"data": "vigencia"},
            {
                "data": null,
                "render": function (data, type, row, meta) {
                    return "<a href=\"#\" class=\"edit\" data-id=\"" + row.id + "\" data-row=\"" + meta.row + "\"><img src=\"" + seeicon + "\" width=\"15\" height=\"15\" /><i class=\"material-icons\" data-toggle=\"tooltip\" title=\"See\"></i></a>" ;
                },
                "width": "2%"
            },
            {"data": "id", "visible": false, "title": "Id"},
        ],
        "language": {
            "decimal": "",
            "emptyTable": "No hay datos disponibles en la tabla",
            "info": "Mostrando _START_ a _END_ de _TOTAL_ entradas",
            "infoEmpty": "Mostrando 0 a 0 de 0 entradas",
            "infoFiltered": "(filtrado de MAX entradas totales)",
            "infoPostFix": "",
            "thousands": ",",
            "lengthMenu": '<span class="d-flex">Mostrar <select class="form-control form-control-sm ml-2 mr-2"> ' +
                '<option value="10">10</option>' +
                '<option value="20">20</option>' +
                '<option value="30">30</option>' + " " +
                ' entradas</span>',
            "loadingRecords": "Cargando...",
            "processing": "Procesando...",
            "search": "Buscar:",
            "zeroRecords": "No se encontraron registros coincidentes",
            "paginate": {
                "first": "Primero",
                "last": "Último",
                "next": "Siguiente",
                "previous": "Anterior"
            },
            "aria": {
                "sortAscending": ": activar para ordenar la columna en orden ascendente",
                "sortDescending": ": activar para ordenar la columna en orden descendente"
            }
        }
    });

    $('#polizasTable_wrapper .col-md-6:eq(0)').append($('#myTable_wrapper .dt-buttons'));
    $('#polizasTable_length').appendTo('#LengthMenu');
    $("#polizasTable_filter").appendTo('#Buscador');
    $('#polizasTable_info').appendTo('#InfoEmpaty');
    $('#polizasTable_paginate').appendTo('#Paginacion');

    var receiptsTable = $("#recibosTable").DataTable({
        "responsive": false,
        "lengthChange": true,
        "autoWidth": true,
        "serverSide": true,
        "searching": false, // Disable search
        "ordering": false, // Disable sorting
        "ajax": {
            "url": "/get_receipts_data",
            "type": "POST",
            "data": function(d) {
                // Additional data to send with the request
                d.poliza_id = $('#poliza_id').val(); // Assuming the id is obtained from some element
            },
            "dataSrc": "data",
            "error": function(xhr, textStatus, errorThrown) {
                Swal.fire({
                    title: 'Error inesperado',
                    text: 'Lamentamos el inconveniente, por favor vuelve a intentarlo',
                    icon: 'error'
                });
            }
        },
        "columns": [
            { "data": "numero" },
            { "data": "fecha_recibo" },
            { "data": "vencimiento" },
            { "data": "prima_neta" },
            { "data": "prima_total" },
            { "data": "comision" },
            { "data": "pagado" },
            { "data": "fecha_pago" },
            { "data": "comprobante" },
            { "data": "cancelado" }
        ],
        "language": {
            "decimal": "",
            "emptyTable": "No hay datos disponibles en la tabla",
            "info": "Mostrando _START_ a _END_ de _TOTAL_ entradas",
            "infoEmpty": "Mostrando 0 a 0 de 0 entradas",
            "infoPostFix": "",
            "thousands": ",",
            "lengthMenu": '<span class="d-flex">Mostrar <select class="form-control form-control-sm ml-2 mr-2"> ' +
                '<option value="10">10</option>' +
                '<option value="20">20</option>' +
                '<option value="30">30</option>' + " " +
                ' entradas</span>',
            "loadingRecords": "Cargando...",
            "processing": "Procesando...",
            "zeroRecords": "No se encontraron registros coincidentes",
            "paginate": {
                "first": "Primero",
                "last": "Último",
                "next": "Siguiente",
                "previous": "Anterior"
            },
        }
    });
    
     
    table.on('click', '.edit', function() {
        //var row = $(this).data('row');
        var polizaId = $(this).data('id');
        //var data = table.row(row).data();
        $('#poliza_id').val(polizaId);
        receiptsTable.ajax.reload();
    });

   
    

});