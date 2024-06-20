// @ts-ignore
$(function () {
  let ordered = false;

  const ajaxConfig = {
    url: "",
    type: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    dataType: "json",
  };

  function alert(text = "", icon = "success", title = "") {
    // @ts-ignore
    Swal.fire({ title, text, icon });
  }

  function alertConfirm(text = "") {
    // @ts-ignore
    return Swal.fire({
      title: "",
      text,
      showCancelButton: true,
      allowOutsideClick: false,
      confirmButtonText: "Aceptar",
      cancelButtonText: "Cancelar",
      icon: "warning",
    });
  }

  function resetForm() {
    // @ts-ignore
    $("#cliente-form")[0].reset();
    // @ts-ignore
    $("#cliente-form").removeClass("was-validated");
    // @ts-ignore
    $("#cliente-form input").prop("disabled", false);
    // @ts-ignore
    $("#cliente-form select").prop("disabled", false);
    // @ts-ignore
    $("#cliente_id").val("New");
    // @ts-ignore
    $("#Savebtn").text("Crear");
    // @ts-ignore
    $("#nuevo_grupo_div").hide();
  }

  function editClient(id) {
    const clientsPerPage = 5;
    // @ts-ignore
    $.ajax({
      ...ajaxConfig,
      url: "/clientes/get",
      // @ts-ignore
      data: $.param({ start: 0, length: clientsPerPage, cliente_id: id }),
      success: function (resp) {
        // @ts-ignore
        $("#cliente_id").val(resp.data[0].id);
        // @ts-ignore
        $("#nombre").val(resp.data[0].nombre);
        // @ts-ignore
        $("#apellido").val(resp.data[0].apellido);
        // @ts-ignore
        $("#rfc").val(resp.data[0].rfc);
        // @ts-ignore
        $("#telefono_oficina").val(resp.data[0].tel_oficina);
        // @ts-ignore
        $("#telefono_movil").val(resp.data[0].tel_movil);
        // @ts-ignore
        $("#telefono_casa").val(resp.data[0].tel_casa);
        // @ts-ignore
        $("#correo").val(resp.data[0].correo);
        // @ts-ignore
        $("#direccion_fiscal").val(resp.data[0].direccion);
        // @ts-ignore
        $("#fecha_nacimiento").val(resp.data[0].fecha_nacimiento);
        // @ts-ignore
        $("#sexo").html(`<option value='${resp.data[0].sexo}'>
         ${resp.data[0].sexo}
         </option>
         <option value="Mujer">Mujer</option>
         <option value="Hombre">Hombre</option>
         <option value="Otro">Otro</option>
         `);
        // @ts-ignore
        $("#ocupacion").val(resp.data[0].ocupacion);
        // @ts-ignore
        $("#giro_actividad").val(resp.data[0].actividad);
        // @ts-ignore
        $("#grupo").html(`<option value='${resp.data[0].grupo_id}'> ${
          resp.data[0].grupo
        }</option>
         ${fetch("/grupo")
           .then((response) => response.json())
           .then((data) => {
             resp.forEach((grupo) => {
               // @ts-ignore
               document.querySelector("#grupo").innerHTML += `
               <option value='${grupo.id}'>${grupo.nombre}</option>
               `;
             });
           })}
         `);
        // @ts-ignore
        $("#cuenta").val(resp.data[0].cuenta);
      },
      error: (xhr, status, error) => console.error(error),
    });
  }

  async function deleteClient(client_id) {
    const { isConfirmed } = await alertConfirm(
      "¿Esta seguro de eliminar este cliente?"
    );
    if (!isConfirmed) return;
    // @ts-ignore
    $.ajax({
      ...ajaxConfig,
      url: "/clientes/delete",
      // @ts-ignore
      data: $.param({ client_id }),
      success: function (resp) {
        if (!resp.error) {
          alert(resp.msg, undefined, resp.title);
        } else {
          alert(resp.msg, "error");
        }
      },
      error: function (xhr, status, error) {
        console.log(error);
        alert(
          "Lamentamos el inconveniente, por favor vuelve a intentarlo",
          "error"
        );
      },
    });
  }

  function fillTable(resp) {
    const itemsOnPage = 5;
    const { data, recordsTotal } = resp;
    // @ts-ignore
    const table = $("#table-clientes");
    table.html("");
    // @ts-ignore
    $.each(data, function (idx, client) {
      table.append(
        `<tr class="tableOption">
            <td>${client.fullname}</td>
            <td>${client.mail}</td>
            <td>${client.phone}</td>
            <td>
               <ul class="btn_table_options">
                  <li>
                     <a class="btn__icon_delete pointer" id="btnDelete_${client.id}">
                        <svg class="noClickable" xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M292.309-140.001q-29.923 0-51.115-21.193-21.193-21.192-21.193-51.115V-720h-40v-59.999H360v-35.384h240v35.384h179.999V-720h-40v507.691q0 30.308-21 51.308t-51.308 21H292.309ZM680-720H280v507.691q0 5.385 3.462 8.847 3.462 3.462 8.847 3.462h375.382q4.616 0 8.463-3.846 3.846-3.847 3.846-8.463V-720ZM376.155-280h59.999v-360h-59.999v360Zm147.691 0h59.999v-360h-59.999v360ZM280-720v520-520Z"/></svg>
                     </a>
                  </li>
                  <li>
                     <a class="btn__icon_edit pointer" id="btnEdit_${client.id}">
                        <svg class="noClickable" xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M200-200h50.461l409.463-409.463-50.461-50.461L200-250.461V-200Zm-59.999 59.999v-135.383l527.616-527.384q9.073-8.241 20.036-12.736 10.963-4.495 22.993-4.495 12.029 0 23.307 4.27 11.277 4.269 19.969 13.576l48.846 49.461q9.308 8.692 13.269 20.004 3.962 11.311 3.962 22.622 0 12.065-4.121 23.028-4.12 10.964-13.11 20.037l-527.384 527H140.001Zm620.384-570.153-50.231-50.231 50.231 50.231Zm-126.134 75.903-24.788-25.673 50.461 50.461-25.673-24.788Z"/></svg>
                     </a>
                  </li>
                  <li>
                     <a class="btn__icon_show pointer" id="btnShow_${client.id}">
                        <svg class="noClickable" xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/></svg>
                     </a>
                  </li>
               </ul>
            </td>
         </tr>`
      );
      // @ts-ignore
      $(`#btnEdit_${client.id}`).on("click", (e) => editClient(client.id));
      // @ts-ignore
      $(`#btnDelete_${client.id}`).on("click", (e) => deleteClient(client.id));
      // @ts-ignore
      $(`#btnShow_${client.id}`).on("click", (e) => {
        // @ts-ignore
        //   $("#hist").modal();
      });
    });
    // @ts-ignore
    $(".tableOption").slice(10).hide();
    // @ts-ignore
    $("#pagination").pagination({
      items: recordsTotal,
      itemsOnPage: itemsOnPage,
      onPageClick: (noofele) =>
        // @ts-ignore
        $(".tableOption")
          .hide()
          .slice(
            itemsOnPage * (noofele - 1),
            itemsOnPage + itemsOnPage * (noofele - 1)
          )
          .show(),
    });
  }

  function getClients(order = false, start = 0, length = 0) {
    // @ts-ignore
    $.ajax({
      ...ajaxConfig,
      url: "/clientes/get",
      // @ts-ignore
      data: $.param(order ? { start, length, order } : { start, length }),
      success: fillTable,
      error: (xhr, status, error) => console.error(error),
    });
  }

  // @ts-ignore
  $("#grupo").change(function () {
    // @ts-ignore
    var selectedOption = $(this).val();
    if (selectedOption === "New") {
      // @ts-ignore
      $("#nuevo_grupo_div").show();
      // @ts-ignore
      $("#nuevo_grupo").prop("required", true);
    } else {
      // @ts-ignore
      $("#nuevo_grupo_div").hide();
      // @ts-ignore
      $("#nuevo_grupo").prop("required", false);
    }
  });

  // @ts-ignore
  $("#sortByName").click((e) => {
    e.preventDefault();
    ordered = !ordered;
    getClients(ordered);
  });

  getClients();
});

const polizasByClientId = async (id) => {
  let polizas = [];
  // const index = currentIndex;
  //Solicitamos los datos
  const polizaData = await fetch("/clientes/poliza", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    // @ts-ignore
    body: new URLSearchParams({
      start: 0,
      // @ts-ignore
      length: clientsPerPage,
      search_value: id,
    }),
  });
  console.log(`ID recibido ${id}`);
  //Convertimos los datos a JSON
  let data = await polizaData.json();
  console.log(data);

  //Creamos un objeto llamado ClientData y lo llenamos iterando en la data JSON

  //Rellenamos el arreglo "clientData" con los datos del servidor
  data.data.forEach((poliza) => {
    polizas.push({
      poliza: poliza.poliza,
      cliente: poliza.cliente,
      aseguradora: poliza.aseguradora,
      vigencia: poliza.vigencia,
      ramo: poliza.ramo,
      subramo: poliza.subramo,
      primaNeta: poliza.primaNeta,
      primaTotal: poliza.primaTotal,
      fechaFin: poliza.fechaFin,
      status: poliza.status,
    });
  });
  console.log(data);

  return polizas;
};

const updateTable = async (clientData) => {
  let iterator = 0;
  const rows = document.querySelectorAll("#demo>tr.tableOption");
  console.log(`estoy imprimiendo desde updateTable ${clientData}`);

  clientData.forEach((client) => {
    rows[
      iterator
    ].innerHTML = `<td>${client.fullname}</td><td>${client.mail}</td><td>${client.phone}</td><td><ul class="btn_table_options">
                              <li>
                                 <a href="#" class="btn__icon_delete" id="btnDelete_${client.id}">
                                    <svg class="noClickable" xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M292.309-140.001q-29.923 0-51.115-21.193-21.193-21.192-21.193-51.115V-720h-40v-59.999H360v-35.384h240v35.384h179.999V-720h-40v507.691q0 30.308-21 51.308t-51.308 21H292.309ZM680-720H280v507.691q0 5.385 3.462 8.847 3.462 3.462 8.847 3.462h375.382q4.616 0 8.463-3.846 3.846-3.847 3.846-8.463V-720ZM376.155-280h59.999v-360h-59.999v360Zm147.691 0h59.999v-360h-59.999v360ZM280-720v520-520Z"/></svg>
                                 </a>
                              </li>
                              <li>
                                 <a href="#" class="btn__icon_edit" id="btnEdit_${client.id}">
                                    <svg class="noClickable" xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M200-200h50.461l409.463-409.463-50.461-50.461L200-250.461V-200Zm-59.999 59.999v-135.383l527.616-527.384q9.073-8.241 20.036-12.736 10.963-4.495 22.993-4.495 12.029 0 23.307 4.27 11.277 4.269 19.969 13.576l48.846 49.461q9.308 8.692 13.269 20.004 3.962 11.311 3.962 22.622 0 12.065-4.121 23.028-4.12 10.964-13.11 20.037l-527.384 527H140.001Zm620.384-570.153-50.231-50.231 50.231 50.231Zm-126.134 75.903-24.788-25.673 50.461 50.461-25.673-24.788Z"/></svg>
                                 </a>
                              </li>
                              <li>
                                 <a href="#" class="btn__icon_show" id="btnShow_${client.id}">
                                    <svg class="noClickable" xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/></svg>
                                 </a>
                              </li>
                           </ul></td>`;
    iterator++;
  });
  await addBtnDelete();
  await addBtnEdit();
  await addBtnShow();
};

const showPoliza = async (id) => {
  //Solicitamos los datos
  const data = await polizasByClientId(id);
  console.log(data);
  //Llenar Tabla modal
  const modalTable = document.querySelector("#table__modal");
  // @ts-ignore
  modalTable.innerHTML = "";
  console.log(`Datos solicitados para el id ${id}`);
  if (data.length === 0) {
    // @ts-ignore
    modalTable.innerHTML = `<tr>
         <td>No hay polizas registradas</td>
         <td></td>
         <td></td>
      </tr>`;
  } else
    data.forEach((poliza) => {
      // @ts-ignore
      modalTable.innerHTML += `
                  <tr  class="tableOption">
                        <td>${poliza.poliza}</td>
                        <td>${poliza.ramo}</td>
                        <td>${poliza.subramo}</td>
                        <td>${poliza.primaNeta}</td>
                        <td>${poliza.primaTotal}</td>
                        <td>${poliza.fechaFin}</td>
                        <td>${poliza.status}</td>
                  </tr>`;
    });
};

const verGrupos = async () => {
  fetch("/grupo")
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
    });
};

const sortButton = document.querySelector("#sortByName");
// @ts-ignore
sortButton.addEventListener("click", async () => {
  // @ts-ignore
  sorting = !sorting;
  // @ts-ignore
  console.log(`el valor de sorting es ${sorting}`);
  // @ts-ignore
  currentIndex = 0;
  await updateTable(await currentPageData());
  // @ts-ignore
  pintarPaginacion();
});

// @ts-ignore
$(document).ready(function () {
  //Funcion para mostrar nuevo grupo input
  // @ts-ignore
  $("#grupo").change(function () {
    // @ts-ignore
    var selectedOption = $(this).val();
    if (selectedOption === "New") {
      // @ts-ignore
      $("#nuevo_grupo_div").show(); // Corrected class name
      // @ts-ignore
      $("#nuevo_grupo").prop("required", true);
    } else {
      // @ts-ignore
      $("#nuevo_grupo_div").hide(); // Corrected class name
      // @ts-ignore
      $("#nuevo_grupo").prop("required", false);
    }
  });

  // Funcion para recargar tabla y regresar form a status inicial
  function resetPage() {
    // Reset the form values
    // @ts-ignore
    $("#cliente-form")[0].reset();
    // Reset the form validation state
    // @ts-ignore
    $("#cliente-form").removeClass("was-validated");
    // Enable all form inputs
    // @ts-ignore
    $("#cliente-form input").prop("disabled", false);
    // @ts-ignore
    $("#cliente-form select").prop("disabled", false);
    // Set usuario_id value to "New"
    // @ts-ignore
    $("#cliente_id").val("New");
    // Change the text of the Save button back to "Crear"
    // @ts-ignore
    $("#Savebtn").text("Crear");
    // @ts-ignore
    $("#nuevo_grupo_div").hide(); // Corrected class name
  }

  // Configuracion de Tabla de clientes

  // Ruta de AJAX para la creacion/edicion de clientes
  // @ts-ignore
  $("#cliente-form").submit(function (e) {
    e.preventDefault();

    // @ts-ignore
    var formData = $(this).serialize();

    // Checar que el formulario este validado
    if (!this.checkValidity()) {
      // @ts-ignore
      $(this).addClass("was-validated");
      return;
    }

    // @ts-ignore
    $.ajax({
      type: "POST",
      url: "/clientes/create",
      data: formData,
      success: function (response) {
        if (response.error) {
          // @ts-ignore
          Swal.fire({
            title: "Cliente incorrecto",
            text: response.msg,
            icon: "error",
          }).then(function () {
            resetPage();
          });
        } else {
          // @ts-ignore
          Swal.fire({
            title: response.title,
            html: response.msg,
            icon: "success",
          }).then(function () {
            if (response.add_group_opt) {
              // @ts-ignore
              var option = $(
                '<option value="' +
                  response.new_group_id +
                  '">' +
                  response.new_group_name +
                  "</option>"
              );

              // Insert the new option before the existing "Nuevo Grupo" option
              // @ts-ignore
              $("#grupo").find('option[value="New"]').before(option);
            }
            resetPage();
          });
        }
      },
      // @ts-ignore
      error: function (xhr, status, error) {
        // @ts-ignore
        Swal.fire({
          title: "Error inesperado",
          text: "Lamentamos el inconveniente, porfavor vuelve a intentarlo",
          icon: "error",
        }).then(function () {
          resetPage();
        });
      },
    });

    return false;
  });

  // @ts-ignore
  $("#Resetbtn").click(function () {
    resetPage();
  });
});

//modal
const btnCancelar = document.querySelector("#btn_close-modal");
// @ts-ignore
btnCancelar.addEventListener("click", function (e) {
  e.preventDefault();
  // @ts-ignore
  $(".container__modal").removeClass("modal-active");
});

//Buscar cliente
const inputSearchClient = document.querySelector("#searchClient");
// @ts-ignore
inputSearchClient.addEventListener("keyup", async (e) => {
  let clientData = [];
  // @ts-ignore
  let searchValue = e.target.value;
  if (searchValue.length >= 3) {
    console.log(searchValue);
    const response = await fetch("/clientes/get", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      // @ts-ignore
      body: new URLSearchParams({
        start: 0,
        length: 10,
        searchValue: searchValue,
      }),
    });
    const data = await response.json();
    console.log(data);
    data.data.forEach((client) => {
      clientData.push({
        id: client.id,
        fullname: client.fullname,
        mail: client.correo,
        phone: client.tel_movil,
      });
    });
    await fillTable(clientData);
  } else {
    await fillTable(await currentPageData());
  }
  //Enviamos el objeto/array para actualizar la tabla
  // return updateTable(data);
});



