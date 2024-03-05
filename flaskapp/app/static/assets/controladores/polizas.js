import { datatableConfig } from './datatable-config.js';
import { datatableConfig_plane } from './datatable-config.js';

$(document).ready(function() {

    // Configuracion de Tabla de polizas
    var table = $("#polizasTable").DataTable({
        ...datatableConfig,
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
        ]
    });

    $('#polizasTable_wrapper .col-md-6:eq(0)').append($('#myTable_wrapper .dt-buttons'));
    $('#polizasTable_length').appendTo('#LengthMenu');
    $("#polizasTable_filter").appendTo('#Buscador');
    $('#polizasTable_info').appendTo('#InfoEmpaty');
    $('#polizasTable_paginate').appendTo('#Paginacion');

    // Configuracion de Tabla de clientes
    var receiptsTable = $("#recibosTable").DataTable({
        ...datatableConfig_plane,
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
            { 
                "data": "pagado",
                "render": function(data, type, row) {
                    // Render a checkbox based on the value of 'pagado'
                    return data ? '<input type="checkbox" checked disabled>' : '<input type="checkbox" disabled>';
                }
            },
            { "data": "fecha_pago" },
            { "data": "comprobante" },
            { 
                "data": "cancelado",
                "render": function(data, type, row) {
                    // Render a checkbox based on the value of 'pagado'
                    return data ? '<input type="checkbox" checked disabled>' : '<input type="checkbox" disabled>';
                }
            }
        ]
    });
    
     
    table.on('click', '.edit', function() {
        //var row = $(this).data('row');
        var polizaId = $(this).data('id');
        //var data = table.row(row).data();
        $('#poliza_id').val(polizaId);
        receiptsTable.ajax.reload();
    });

   
    

});