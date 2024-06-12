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
  function resetForm() {
    // @ts-ignore
    $("#user-form").removeClass("was-validated");
    // @ts-ignore
    $("#user-form select").prop("disabled", false);
    // @ts-ignore
    $("#usuario_id").val("New");
    // @ts-ignore
    $("#Savebtn").text("Crear");
  }

  function editUser(usuario_id) {
    // @ts-ignore
    $.ajax({
      ...ajaxConfig,
      url: "/usuarios/get",
      // @ts-ignore
      data: $.param({ start: 0, length: 0, usuario_id }),
      success: function (resp) {
        // @ts-ignore
        $("#usuario_id").val(resp.data[0].id);
        // @ts-ignore
        $("#nombre").val(resp.data[0].nombre);
        // @ts-ignore
        $("#apellido").val(resp.data[0].apellido);
        // @ts-ignore
        $("#email").val(resp.data[0].correo);
        // @ts-ignore
        $("#cel").val(resp.data[0].telefono);
        // @ts-ignore
        $("#username").val(resp.data[0].username);
        // @ts-ignore
        $("#acceso").html(`<option value='${resp.data[0].acceso}'>
        ${resp.data[0].acceso}
        </option>
        <option value="1">Administrador</option>
        <option value="2">Usuario</option>
        <option value="3">Desarrollador</option>
        <option value="4">Gerente</option>
        `);
      },
      error: (xhr, status, error) => console.error(error),
    });
  }

  function deleteUser(user_id) {
    // @ts-ignore
    $.ajax({
      ...ajaxConfig,
      url: "/usuarios/delete",
      // @ts-ignore
      data: $.param({ user_id }),
      success: function (resp) {
        if (!resp.error) {
          // @ts-ignore
          Swal.fire({
            title: resp.title,
            text: resp.msg,
            icon: "success",
          });
          getUsers();
        } else {
          // @ts-ignore
          Swal.fire({
            title: "Error",
            text: resp.msg,
            icon: "error",
          });
        }
      },
      error: function (xhr, status, error) {
        console.log(error);
        // @ts-ignore
        Swal.fire({
          title: "Error inesperado",
          text: "Lamentamos el inconveniente, por favor vuelve a intentarlo",
          icon: "error",
        });
      },
    });
  }

  function fillTableUsers(resp) {
    const itemsOnPage = 5;
    const { data, recordsTotal } = resp;
    // @ts-ignore
    const table = $("#table-users");
    table.html("");
    // @ts-ignore
    $.each(data, function (idx, usuario) {
      table.append(
        `<tr class="tableOption">
          <td>${usuario.fullname}</td>
          <td>${usuario.correo}</td>
          <td>${usuario.telefono}</td>
          <td>${usuario.acceso}</td>
          <td>
            <ul class="btn_table_options">
              <li>
                <a class="btn__icon_delete" id="btnDelete_${usuario.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M292.309-140.001q-29.923 0-51.115-21.193-21.193-21.192-21.193-51.115V-720h-40v-59.999H360v-35.384h240v35.384h179.999V-720h-40v507.691q0 30.308-21 51.308t-51.308 21H292.309ZM680-720H280v507.691q0 5.385 3.462 8.847 3.462 3.462 8.847 3.462h375.382q4.616 0 8.463-3.846 3.846-3.847 3.846-8.463V-720ZM376.155-280h59.999v-360h-59.999v360Zm147.691 0h59.999v-360h-59.999v360ZM280-720v520-520Z"/></svg>
                </a>
              </li>
              <li>
                <a class="btn__icon_edit" id="btnEdit_${usuario.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M200-200h50.461l409.463-409.463-50.461-50.461L200-250.461V-200Zm-59.999 59.999v-135.383l527.616-527.384q9.073-8.241 20.036-12.736 10.963-4.495 22.993-4.495 12.029 0 23.307 4.27 11.277 4.269 19.969 13.576l48.846 49.461q9.308 8.692 13.269 20.004 3.962 11.311 3.962 22.622 0 12.065-4.121 23.028-4.12 10.964-13.11 20.037l-527.384 527H140.001Zm620.384-570.153-50.231-50.231 50.231 50.231Zm-126.134 75.903-24.788-25.673 50.461 50.461-25.673-24.788Z"/></svg>
                </a>
              </li>
              <li>
                <a class="btn__icon_show" id="btnShow_${usuario.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/></svg>
                </a>
              </li>
            </ul>
          </td>
        </tr>`
      );
      // @ts-ignore
      $(`#btnEdit_${usuario.id}`).on("click", (e) => editUser(usuario.id));
      // @ts-ignore
      $(`#btnDelete_${usuario.id}`).on("click", (e) => deleteUser(usuario.id));
      // @ts-ignore
      $(`#btnShow_${usuario.id}`).on("click", (e) => {
        // @ts-ignore
        $("#hist").modal()
        getHistory(usuario.id);
      });
    });
    // @ts-ignore
    $(".tableOption").slice(5).hide();
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

  function fillTablePassword(resp) {
    const itemsOnPage = 5;
    const { data, recordsTotal } = resp;
    // @ts-ignore
    const table = $("#table-password");
    table.html("");
    // @ts-ignore
    $.each(data, function (idx, contra) {
      table.append(
        `<tr  class="table-option">
          <td>${contra.usuario}</td>
          <td>${contra.correo}</td>
          <td>${contra.status}</td>
        </tr>`
      );
    });
    // @ts-ignore
    $(".table-option").slice(5).hide();
    // @ts-ignore
    $("#pagination-password").pagination({
      items: recordsTotal,
      itemsOnPage: itemsOnPage,
      onPageClick: (noofele) =>
        // @ts-ignore
        $(".table-option")
          .hide()
          .slice(
            itemsOnPage * (noofele - 1),
            itemsOnPage + itemsOnPage * (noofele - 1)
          )
          .show(),
    });
  }

  function fillTableHistory(resp) {
    const itemsOnPage = 5;
    const { data, recordsTotal } = resp;
    // @ts-ignore
    const table = $("#table-history");
    table.html("");
    // @ts-ignore
    $.each(data, function (idx, hist) {
      table.append(
        `<tr class="table-option-hist">
          <td>${hist.usuario}</td>
          <td>${hist.timestamp}</td>
          <td>${hist.descripcion}</td>
          <td>${hist.status}</td>
        </tr>`
      );
    });
    // @ts-ignore
    $(".table-option-hist").slice(5).hide();
    // @ts-ignore
    $("#pagination-history").pagination({
      items: recordsTotal,
      itemsOnPage: itemsOnPage,
      onPageClick: (noofele) =>
        // @ts-ignore
        $(".table-option-hist")
          .hide()
          .slice(
            itemsOnPage * (noofele - 1),
            itemsOnPage + itemsOnPage * (noofele - 1)
          )
          .show(),
    });
  }

  function getUsers(order = false, start = 0, length = 0) {
    // @ts-ignore
    $.ajax({
      ...ajaxConfig,
      url: "/usuarios/get",
      // @ts-ignore
      data: $.param(order ? { start, length, order } : { start, length }),
      success: fillTableUsers,
      error: (xhr, status, error) => console.error(error),
    });
  }

  function getHistory(user_id) {
    // @ts-ignore
    $.ajax({
      ...ajaxConfig,
      url: "/usuarios/get_requests",
      // @ts-ignore
      data: $.param({ user_id }),
      success: fillTableHistory,
      error: (xhr, status, error) => console.error(error),
    });
  }

  function getChangesPassword(start = 0, length = 0) {
    // @ts-ignore
    $.ajax({
      ...ajaxConfig,
      url: "/usuarios/get_solicitudes_contrasenas",
      // @ts-ignore
      data: $.param({ start, length }),
      success: fillTablePassword,
      error: (xhr, status, error) => console.error(error),
    });
  }

  // @ts-ignore
  $("#reset-btn").click((e) => resetForm());

  // @ts-ignore
  $("#sortByName").click((e) => {
    ordered = !ordered;
    getUsers(ordered);
  });

  // @ts-ignore
  $("#searchUser").on("keyup", function (e) {
    const searchValue = e.target.value;
    if (searchValue == "") return getUsers();
    if (searchValue.length >= 3)
      // @ts-ignore
      $.ajax({
        ...ajaxConfig,
        url: "/usuarios/get",
        // @ts-ignore
        data: $.param({ start: 0, length: 0, searchValue }),
        success: fillTableUsers,
        error: (xhr, status, error) => console.error(error),
      });
  });

  getUsers();
  getChangesPassword();
});
