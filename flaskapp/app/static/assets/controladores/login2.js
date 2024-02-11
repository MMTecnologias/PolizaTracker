function validarFormulario() {

    // Obtiene los valores del usuario y la contraseña
    var usuario = document.getElementById('usuarioAutent').value;
    var password = document.getElementById('passwordAutent').value;

    // Validar los datos
    if(usuario === 'userTest' && password === '123'){
        alert('Inicio de sesión exitoso');
    } else {
        document.getElementById('').style.display = 'block';
    }
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