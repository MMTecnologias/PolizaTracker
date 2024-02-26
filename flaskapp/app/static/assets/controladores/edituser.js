$(document).ready(function() {

    // Funcion para recargar tabla y regresar form a status inicial
    function resetPage() {
        // Reset the form values
        $('#userForm')[0].reset();
        // Reset the form validation state
        $('#userForm').removeClass('was-validated');
        $('#nombre').val(nombre);
        $('#apellido').val(apellido);
        $('#email').val(correo);
        $('#cel').val(telefono);
    }
    
    resetPage()

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
            url: 'edit_cuser',
            data: formData,
            success: function(response) {
                if (response.error) {
                    Swal.fire({
                        title: 'Contraseña incorrecta',
                        text: response.msg,
                        icon: 'error',
                    }).then(function() {
                        resetPage();
                    });
                } else {
                    Swal.fire({
                        title: response.title,
                        html: response.msg ,
                        icon: 'success',
                    }).then(function() {
                        window.location.href = response.redirect;;
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



});
