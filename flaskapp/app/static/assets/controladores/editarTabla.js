async function mostrarRecibos(polizaSeleccionada) {
    try {
        // Hacer una solicitud GET al servidor para obtener los recibos de la poliza seleccionada
        const response = await fetch(`url_del_servidor/recibos?poliza=${polizaSeleccionada}`);

        // Verificar si la solicitud fue exitosa
        if (!response.ok) {
            throw new Error('Error al obtener los recibos');
        }

        // Convertir la respuesta a formato JSON
        const recibos = await response.json();

        // Mostrar los recibos en la consola o en algún otro lugar de la interfaz de usuario
        console.log('Recibos:');
        console.log(recibos);
    } catch (error) {
        console.error('Error al obtener los recibos:', error);
    }
}

// Llamar a la función para mostrar los recibos cuando se seleccione una póliza
const polizaSeleccionada = 'poliza_123'; 

mostrarRecibos(polizaSeleccionada);


const data = await response.json();
   console.log(data[0]);
   document.querySelector('#cliente_id').value = data[0].id;
   document.querySelector('#nombre').value = data[0].nombre;
   document.querySelector('#apellido').value = data[0].apellido;
   document.querySelector('#rfc').value = data[0].rfc;
   document.querySelector('#telefono_oficina').value = data[0].tel_oficina;
   document.querySelector('#telefono_movil').value = data[0].tel_movil;
   document.querySelector('#telefono_casa').value = data[0].tel_casa;
   document.querySelector('#correo').value = data[0].correo;
   document.querySelector('#direccion_fiscal').value = data[0].direccion;
   document.querySelector('#fecha_nacimiento').value = data[0].fecha_nacimiento;
   document.querySelector('#sexo').innerHTML = `<option value='${data[0].sexo}'>
         ${data[0].sexo}
         </option>
         <option value="Mujer">Mujer</option>
         <option value="Hombre">Hombre</option>
         <option value="Otro">Otro</option>

         `;
   document.querySelector('#ocupacion').value = data[0].ocupacion;
   document.querySelector('#giro_actividad').value = data[0].actividad;
   document.querySelector('#grupo').innerHTML = `<option value='${
      data[0].grupo_id
   }'> ${data[0].grupo}</option>
         <!-- pintar todas las opciones -->
         ${fetch('/grupo')
            .then((response) => response.json())
            .then((data) => {
               data.forEach((grupo) => {
                  document.querySelector('#grupo').innerHTML += `
               <option value='${grupo.id}'>${grupo.nombre}</option>
               `;
               });
            })}
         `;