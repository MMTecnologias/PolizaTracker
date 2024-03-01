function buscar() {

    // Obtenemos el valor del input de búsqueda
    var input = document.getElementById('inputBusqueda');
    var filter = input.value.toUpperCase();
    // Obtenemos la lista de elementos a buscar
    var ul = document.getElementById('listaElementos');
    var li = ul.getElementsByTagName('li');

    // Recorremos todos los elementos de la lista y mostramos u ocultamos según coincidan con la búsqueda
    for (var i = 0; i < li.length; i++) {
        var txtValue = li[i].textContent || li[i].innerText;
        if (txtValue.toUpperCase().indexOf(filter) > -1) {
            li[i].style.display = '';
        } else {
            li[i].style.display = 'none';
        }
    }
}

function seleccionar(elemento) {
    // Resaltamos el elemento seleccionado
    var listaElementos = document.getElementById('listaElementos');
    var elementos = listaElementos.getElementsByTagName('li');
    for (var i = 0; i < elementos.length; i++) {
        elementos[i].classList.remove('seleccionado');
    }
    elemento.classList.add('seleccionado');

    // Realizar alguna acción con el elemento seleccionado, como enviarlo a una función
    // Por ejemplo:
    console.log('Elemento seleccionado:', elemento.textContent);
}


function marcarCheckbox(valor) {
    var checkbox = document.getElementById('checkSolicitudes');
    checkbox.checked = valor;
}

// Ejemplo de uso:
// Recibir un valor booleano, por ejemplo, true o false
var valorRecibido = true; 
marcarCheckbox(valorRecibido);

