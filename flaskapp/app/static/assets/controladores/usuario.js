
function validarContrasenia() {

    var contraseña1= document.getElementById('contraseña').value;
    var contraseña2 = document.getElementById('validacionContra').value;


    if (contraseña1 != contraseña2) {
        document.getElementById('invalid-feedback-password-equal').style.display='block'
    }
};
