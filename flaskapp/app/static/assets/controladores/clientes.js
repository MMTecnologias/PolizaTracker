
$(document).ready(function() {
    
    //Funcion para mostrar nuevo grupo input
    $('#grupo').change(function() {
        var selectedOption = $(this).val();
        if (selectedOption === 'New') {
            $('.nuevo-grupo-input').show(); // Corrected class name
            $('#nuevo_grupo').prop('required', true);
        } else {
            $('.nuevo-grupo-input').hide(); // Corrected class name
            $('#nuevo_grupo').prop('required', false);
        }
    });

    // Funcion para recargar tabla y regresar form a status inicial
    function resetPage() {
        // Reset the form values
        $('#userForm')[0].reset();
        // Reset the form validation state
        $('#userForm').removeClass('was-validated');
        // Enable all form inputs
        $('#userForm input').prop('disabled', false);
        $('#userForm select').prop('disabled', false);
        // Set usuario_id value to "New"
        $('#usuario_id').val("New");
        // Change the text of the Save button back to "Crear"
        $('#Savebtn').text('Crear');
        if ($.fn.DataTable.isDataTable('#myTable')) {
            var table = $('#myTable').DataTable();
            table.ajax.reload();
        }
    }


    // Configuracion de Tabla de clientes
    var table = $("#myTable").DataTable({
        "responsive": false,
        "lengthChange": true,
        "autoWidth": true,
        "serverSide": true,
        "ajax": {
            "url": "/get_clients_data",
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
            {"data": "fullname"},
            {"data": "correo"},
            {"data": "tel_movil"},
            {
                "data": null,
                "render": function (data, type, row, meta) {
                    return "<a href=\"#\" class=\"edit\" data-id=\"" + row.id + "\" data-row=\"" + meta.row + "\"><img src=\"" + editicon + "\" width=\"15\" height=\"15\" /><i class=\"material-icons\" data-toggle=\"tooltip\" title=\"Edit\"></i></a>" +
                        "<a href=\"#\" class=\"delete\" data-id=\"" + row.id + "\" data-row=\"" + meta.row + "\"><img src=\"" + deleteicon + "\" width=\"20\" height=\"20\" /><i class=\"material-icons\" data-toggle=\"tooltip\" title=\"Delete\"></i></a>";
                }
            },
            {"data": "id", "visible": false, "title": "Id"},
            {"data": "nombre", "visible": false, "title": "Nombre"},
            {"data": "apellido", "visible": false, "title": "Apellido"},
            {"data": "grupo_id", "visible": false, "title": "Grupo ID"},
            {"data": "grupo", "visible": false, "title": "Grupo"},
            {"data": "rfc", "visible": false, "title": "RFC"},
            {"data": "tel_oficina", "visible": false, "title": "Teléfono Oficina"},
            {"data": "tel_casa", "visible": false, "title": "Teléfono Casa"},
            {"data": "direccion", "visible": false, "title": "Dirección"},
            {"data": "fecha_nacimiento", "visible": false, "title": "Fecha de Nacimiento"},
            {"data": "sexo", "visible": false, "title": "Sexo"},
            {"data": "ocupacion", "visible": false, "title": "Ocupación"},
            {"data": "actividad", "visible": false, "title": "Actividad"}
            //{"data": "status", "visible": false, "title": "Status"}
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
        },
        "buttons": [
            {
                
                extend: 'csv',
                text: 'Exportar',
                exportOptions: {
                    columns: [0, 1, 2, 8,9,10,11,12,13,14,15,16]
                },
                filename: 'usuarios_data',
                className: 'btn btn-success',
                customize: function(csv) {
                    return '\uFEFF' + csv;
                }
            }
        ]
    });
    //Asignar funcionalidad de exportar al boton
    $('#exportCSVButton').on('click', function() {
        table.buttons().trigger();
    });

    $('#myTable_wrapper .col-md-6:eq(0)').append($('#myTable_wrapper .dt-buttons'));
    $('#myTable_length').appendTo('#LengthMenu');
    $("#myTable_filter").appendTo('#Buscador');
    $('#myTable_info').appendTo('#InfoEmpaty');
    $('#myTable_paginate').appendTo('#Paginacion');


});