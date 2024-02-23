$(document).ready(function() {

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
    
    // Ruta de AJAX para la creacion/edicion de usuarios
    $("#userForm").submit(function(e) {
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
            success: function(response) {
                if (response.error) {
                    Swal.fire({
                        title: 'Usuario Incorrecto',
                        text: response.msg,
                        icon: 'error',
                    }).then(function() {
                        resetPage();
                    });
                } else {
                    Swal.fire({
                        title: response.title,
                        html: '<pre>' + response.msg + '</pre>',
                        icon: 'success',
                    }).then(function() {
                        resetPage();
                    });
                }
            },
            error: function(xhr, status, error) {
                Swal.fire({
                    title: 'Error inesperado',
                    text: 'Lamentamos el inconveniente, porfavor vuelve a intentarlo',
                    icon: 'error',
                }).then(function() {
                    resetPage();
                });;
            }
        });

        return false;
    });

    // Funcion para validar contraseñas 
    var password = document.getElementById("password");
    var confirm_password = document.getElementById("password2");

    function validatePassword() {
        var passwordValue = password.value;
        var confirmPasswordValue = confirm_password.value;

            // Verificar si las contraseñas coinciden
            if (passwordValue !== confirmPasswordValue) {
                document.getElementById("password2msg").innerHTML="Las contraseñas no coinciden";
                confirm_password.setCustomValidity("Las contraseñas no coinciden");
                return false;
            }

            // Verificar la longitud mínima de la contraseña
            if (passwordValue.length < 8) {
                document.getElementById("password2msg").innerHTML="La contraseña debe tener al menos 8 caracteres";
                confirm_password.setCustomValidity("La contraseña debe tener al menos 8 caracteres");
                return false;
            }

            // Verificar al menos una mayúscula y un dígito
            if (!/[A-Z]/.test(passwordValue) || !/\d/.test(passwordValue)) {
                document.getElementById("password2msg").innerHTML="La contraseña debe contener al menos una mayúscula y un dígito";
                confirm_password.setCustomValidity("La contraseña debe contener al menos una mayúscula y un dígito");
                return false;
            }

            // Si todas las verificaciones pasan, limpiar el mensaje de error
            confirm_password.setCustomValidity('');
            return true;
            }
    

    // Bind the validatePassword function to input events for real-time validation
    $('#password').on('input', validatePassword);
    $('#password2').on('input', validatePassword);

    // Configuracion de Tabla de usuarios
    var table = $("#myTable").DataTable({
        "responsive": false,
        "lengthChange": true,
        "autoWidth": true,
        "serverSide": true,
        "ajax": {
            "url": "/get_usuarios_data",
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
            {
                "data": null,
                "render": function (data, type, row, meta) {
                    return "<a href=\"#\" class=\"edit\" data-id=\"" + row.id + "\" data-row=\"" + meta.row + "\"><img src=\"" + editicon + "\" width=\"15\" height=\"15\" /><i class=\"material-icons\" data-toggle=\"tooltip\" title=\"Edit\"></i></a>" +
                           "<a href=\"#\" class=\"delete\" data-id=\"" + row.id + "\" data-row=\"" + meta.row + "\"><img src=\"" + deleteicon + "\" width=\"20\" height=\"20\" /><i class=\"material-icons\" data-toggle=\"tooltip\" title=\"Delete\"></i></a>";
                }
            },
            {"data": "telefono", "visible": false, "title": "Telefono"},
            {"data": "username", "visible": false, "title": "Usuario"},
            {"data": "id", "visible": false, "title": "Id"},
            {"data": "nombre", "visible": false, "title": "Nombre"},
            {"data": "apellido", "visible": false, "title": "Apellido"},
            {"data": "acceso", "visible": false, "title": "Acceso"}
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
                    columns: [0, 1, 3, 4]
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

    //Llenado de formulario al presionar editar
    $('#myTable').on('click', '.edit', function() {
        var row = $(this).data('row');
        var userId = $(this).data('id');
        var data = table.row(row).data();

        $('#usuario_id').val(userId);
        $('#nombre').val(data.nombre);
        $('#apellido').val(data.apellido);
        $('#email').val(data.correo);
        $('#cel').val(data.telefono);
        $('#username').val(data.username);
        $('#acceso').val(data.acceso);

        $('#password').prop('disabled', true);
        $('#password2').prop('disabled', true);
        $('#acceso').prop('disabled', true);

        $('#Savebtn').text('Guardar');
    });

    //Funcion con AJAX para eliminacion de usuarios
    $('#myTable').on('click', '.delete', function() {
        var row = $(this).data('row');
        var userId = $(this).data('id');
        var data = table.row(row).data();

        Swal.fire({
            title: 'Deseas eliminar a ' + data.nombre + " " + data.apellido,
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
                    url: '/delete_user',
                    data: { user_id: userId },
                    success: function(response) {
                        if (!response.error) {
                            table.ajax.reload();
                            Swal.fire({
                                title: response.title,
                                text: response.msg,
                                icon: 'success'
                            }).then(function() {
                                resetPage();
                            });
                        } else {
                            Swal.fire({
                                title: 'Error',
                                text: response.msg,
                                icon: 'error'
                            }).then(function() {
                                resetPage();
                            });
                        }
                    },
                    error: function(xhr, status, error) {
                        Swal.fire({
                            title: 'Error inesperado',
                            text: 'Lamentamos el inconveniente, porfavor vuelve a intentarlo',
                            icon: 'error',
                        }).then(function() {
                            resetPage();
                        });
                    }
                });
            } 
        });
        
    });

    $('#Resetbtn').click(function() {
        resetPage()
    });

});
