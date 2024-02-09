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