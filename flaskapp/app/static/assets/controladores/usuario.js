$(document).ready(function() {
    $("#userForm").submit(function(e) {
        e.preventDefault();

        var formData = $(this).serialize();

        // Check if form passes validation
        if (!this.checkValidity()) {
            // If form is invalid, don't submit and display validation messages
            $(this).addClass('was-validated');
            return;
        }

        $.ajax({
            type: 'POST',
            url: '/create_user', // Flask route for creating user
            data: formData,
            success: function(response) {
                if(response.error){
                    Swal.fire({
                        title: 'Usuario Incorrecto',
                        text: 'Ese usuario ya existe, intente de nuevo con otro usuario',
                        icon: 'error',
                    });
                }else {
                    // Display error message if username already exists
                    Swal.fire({
                        title: 'Usuario añadido, envia las credenciales al usuario',
                        html: '<pre>' + response.msg + '</pre>',
                        icon: 'success',
                    }).then(function() {
                        window.location.href = response.redirect;
                    });
                }
            },
            error: function(xhr, status, error) {
                Swal.fire({
                    title: 'Error inesperado',
                    text: 'Lamentamos el inconveniente, porfavor vuelve a intentarlo',
                    icon: 'error',
                });
            }
        });

        return false;
    });
});
