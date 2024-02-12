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

//Validaciones de Modales
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

//Accesos y usuarios

// Base de datos de usuarios (simulada)
const usersDatabase = {
    "Abi": {
      contraseña: "1234",
      rol: "admin"
    },
    "Luis": {
      contraseña: "qwerty",
      rol: "gerente"
    },
    // Agrega más usuarios si es necesario
  };

  function darAcceso(usuario, contraseña, pantallaRequerida) {
    // Verificar si el usuario existe en la base de datos
    if (usuario in usersDatabase) {
      // Verificar si la contraseña coincide
      if (usersDatabase[usuario].contraseña === contraseña) {
        // Verificar si el usuario tiene acceso a la pantalla requerida
        if (usersDatabase[usuario].rol === "admin" || usersDatabase[usuario].rol === pantallaRequerida) {
          return true; // Usuario autorizado a acceder a la pantalla requerida
        } else {
          return false; // Usuario no tiene permiso para acceder a la pantalla requerida
        }
      } else {
        return false; // Contraseña incorrecta
      }
    } else {
      return false; // Usuario no encontrado
    }
  }


if (darAcceso(nombreUsuario, contraseña, pantallaRequerida)) {
  console.log("¡Usuario autorizado a acceder a la pantalla requerida!");
} else {
  console.log("¡Error de acceso! Usuario no autorizado o contraseña incorrecta.");
}

