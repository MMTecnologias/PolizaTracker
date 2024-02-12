
function login() {
    // Prevent default form submission
    event.preventDefault();

    // Serialize form data
    var formData = $('#loginform').serialize();

    // Send AJAX POST request
    $.ajax({
        type: 'POST',
        url: 'login_ajax',  // Flask route for login
        data: formData,
        success: function(response) {
            // Check response for success or error
            if (response.success) {
                // Redirect user to the desired page
                window.location.href = response.redirect;
            } else {
                // Display error message
                $('#mensajeError').css('display', 'block');
            }
        },
        error: function(xhr, status, error) {
            Swal.fire({
                title: 'Error ineserado',
                text: 'Lamentamos el inconveniente, porfavor vuelve a intentarlo',
                icon: 'error',
            });
        }
    });

    // Return false to prevent form submission
    return false;
}


function enviarValidacion(){
    var usuarioIngresado = document.getElementById('InputUsuario').value;
    if (usuarioIngresado.trim() === "Abi") {
        Swal.fire({
            title: '¡Solicitud Enviada!',
            text: 'Revisa tu correo, el administrador te hará llegar una nueva contraseña',
            icon: 'success',
        });
    } else {
        Swal.fire({
            title: '¡Error!',
            text: 'Hubo un problema, y no se pudo enviar tu solicitud',
            icon: 'error',
        });
    }
}