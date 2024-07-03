// @ts-nocheck
$(function () {
  let ordered = false;
  let crearEndoso = false;

  const ajaxConfig = {
    url: "",
    type: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    dataType: "json",
  };

  function getColor(status) {
    if (!status) return "";
    switch (status) {
      case "Vigente":
        // return "#46d139";
        return "rgb(0 255 0 / 50%)";
      case "Cancelada":
        // return "#ff0000";
        return "rgb(255 0 0 / 80%)";
      case "Por vencer":
        // return "#fff800";
        return "rgb(255 255 0 / 80%)";
      case status.includes("Cancel"):
        return "#ff0000";
      case status.includes("Vencer"):
        return "#fff800";
      default:
        return "";
    }
  }

  function getNoRecibos(pago) {
    switch (pago) {
      case "1":
        return 1;
      case "2":
        return 12;
      case "3":
        return 4;
      case "4":
        return 2;
      case "5":
        return 24;
      default:
        return 0;
    }
  }

  function alert(text = "", icon = "success", title = "") {
    Swal.fire({ title, text, icon });
  }

  function alertConfirm(text = "") {
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

  async function resetForm() {
    try {
      const data = await getFormData();
      $("#form-polizas")[0].reset();
      $("#form-polizas").removeClass("was-validated");
      $("#form-polizas select").prop("disabled", false);
      $("#poliza_id").val("New");
      $("#tipo").val("");
      $("#btnGenerarEndoso").hide();
      $("#div_poliza_id").hide();
      $("#btnGuardar").show();
      $("#div_search_client").show();
      $("#div_renovacion").show();
      $("#div_poliza_anterior").show();
      $("#title_poliza").text("Póliza");
      $("#prima_neta").prop("disabled", false);
      $("#prima_total").prop("disabled", false);
      $("#ramo").html("");
      $("#subramo").html("");
      $("#aseguradora").html("");
      $("#Pago").html("");
      $("#vendedor").html("");
      $("#agente").html("");
      for (const ramo of data.Ramo) {
        $("#ramo").append(`<option value='${ramo.id}'>
        ${ramo.ramo}
        </option>
        `);
      }
      for (const subramo of data.Subramo) {
        $("#subramo").append(`<option value='${subramo.id}'>
        ${subramo.subramo}
        </option>
        `);
      }
      for (const aseguradora of data.Aseguradora) {
        $("#aseguradora").append(`<option value='${aseguradora.id}'>
        ${aseguradora.aseguradora}
        </option>
        `);
      }
      for (const pago of data.TipoPago) {
        $("#Pago").append(`<option value='${pago.id}'>
        ${pago.tipo_pago}
        </option>
        `);
      }
      for (const vendedor of data.Vendedor) {
        $("#vendedor").append(`<option value='${vendedor.id}'>
        ${vendedor.nombre}
        </option>
        `);
      }
      for (const agente of data.Agente) {
        $("#agente").append(`<option value='${agente.id}'>
        ${agente.nombre}
        </option>
        `);
      }
    } catch (error) {
      console.log(error);
    }
  }

  async function createEndozo(poliza_id, tipo) {
    await resetForm();
    $("#endoso-type").modal("toggle");
    $("#tipo").val(tipo);
    $("#btnGenerarEndoso").show();
    $("#btnGuardar").hide();
    $("#div_renovacion").hide();
    $("#div_poliza_anterior").hide();
    $("#poliza_id").val(poliza_id);
    $("#div_search_client").hide();
    $("#title_poliza").text("Endoso");
    $("#div_poliza_id").show();
    $.ajax({
      ...ajaxConfig,
      url: "/polizas/get",
      data: $.param({ start: 0, length: 0, poliza_id }),
      success: function (resp) {
        $("#id_poliza").val(resp.data[0].poliza);
        $("#selected-client-id").val(resp.data[0].cliente_id);
        if (tipo === "B" || tipo === "D") {
          $("#prima_neta").prop("disabled", false);
          $("#prima_total").prop("disabled", false);
          return;
        }
        $("#Poliza").val(resp.data[0].poliza);
        $("#serie").val(resp.data[0].serie);
        $("#ramo").html(`<option value='${resp.data[0].ramo_id}'>
            ${resp.data[0].ramo}
            </option>
        `);
        $("#subramo").html(`<option value='${resp.data[0].subramo_id}'>
            ${resp.data[0].subramo}
            </option>
        `);
        $("#VigenciaI").val(resp.data[0].fecha_inicio);
        $("#prima_neta").val(resp.data[0].prima_neta);
        $("#prima_total").val(resp.data[0].prima_total);
        $("#prima_neta").prop("disabled", true);
        $("#prima_total").prop("disabled", true);
        $("#VigenciaF").val(resp.data[0].VigenciaF);
        $("#aseguradora").html(`<option value='${resp.data[0].aseguradora_id}'>
            ${resp.data[0].aseguradora}
            </option>
        `);
        $("#Pago").html(`<option value='${resp.data[0].tipo_pago_id}'>
            ${resp.data[0].tipoPago}
            </option>
        `);
        $("#vendedor").html(`<option value='${resp.data[0].vendedor_id}'>
            ${resp.data[0].vendedor_id}
            </option>
        `);
        $("#Moneda").val(resp.data[0].moneda);
        $("#agente").html(`<option value='${resp.data[0].agente_id}'>
            ${resp.data[0].agente_id}
            </option>
        `);
        $("#notas").val(resp.data[0].notas);
        $("#polizaAnterior").val(resp.data[0].poliza_anterior);
        $("#renovacion").val(resp.data[0].renovacion);
      },
      error: (xhr, status, error) => console.error(error),
    });
  }

  async function cancelPoliza(poliza_id) {
    const { isConfirmed } = await alertConfirm(
      "¿Esta seguro de cancelar esta poliza?"
    );
    if (!isConfirmed) return;
    $.ajax({
      ...ajaxConfig,
      url: "/polizas/delete",
      data: $.param({ poliza_id }),
      success: function (resp) {
        if (!resp.error) {
          alert(resp.msg, undefined, resp.title);
          getPolizas();
        } else {
          alert(resp.msg, "error");
        }
      },
      error: function (xhr, status, error) {
        console.error(error);
        alert(
          "Lamentamos el inconveniente, por favor vuelve a intentarlo",
          "error"
        );
      },
    });
  }

  function getRecibos(poliza_id, order = false, start = 0, length = 100) {
    $.ajax({
      ...ajaxConfig,
      url: "/polizas/get_receipts",
      data: $.param(
        order
          ? { start, length, order, poliza_id }
          : { start, length, poliza_id }
      ),
      success: (resp) => fillTableRecibos(resp, poliza_id),
      error: (xhr, status, error) => console.error(error),
    });
  }

  function getEndosos(poliza_id, order = false, start = 0, length = 100) {
    $.ajax({
      ...ajaxConfig,
      url: "/polizas/get_endosos",
      data: $.param(
        order
          ? { start, length, order, poliza_id }
          : { start, length, poliza_id }
      ),
      success: fillTableEndosos,
      error: (xhr, status, error) => console.error(error),
    });
  }

  function fillTableEndosos(resp) {
    console.log(resp);
  }

  function changeReciboPagado(recibo_id, accion, poliza_id) {
    $.ajax({
      type: "POST",
      url: "/polizas/process_receipt",
      data: $.param({ recibo_id, accion }),
      success: function (resp) {
        if (resp.error) {
          alert(resp.msg, "error");
        } else {
          alert(resp.msg, "success");
          getRecibos(poliza_id);
        }
      },
      error: function (xhr, status, error) {
        console.error(error);
        alert(
          "Lamentamos el inconveniente, porfavor vuelve a intentarlo",
          "error"
        );
      },
    });
  }

  function getFormData() {
    return new Promise((resolve, reject) => {
      $.ajax({
        type: "GET",
        url: "/polizas/get_form_data",
        data: {},
        success: function (resp) {
          resolve(resp);
          console.log(resp);
        },
        error: function (xhr, status, error) {
          reject(error);
          console.error(error);
          alert(
            "Lamentamos el inconveniente, porfavor vuelve a intentarlo",
            "error"
          );
        },
      });
    });
  }

  function fillTableRecibos(resp, poliza_id) {
    const itemsOnPage = 10;
    const { data, recordsTotal } = resp;
    const table = $("#receiptsTable");
    table.html("");
    $.each(data, function (idx, recibo) {
      table.append(
        `<tr class="tableOption-recibos">
            <td>${recibo.numero}</td>
            <td>${recibo.fecha_recibo}</td>
            <td>${recibo.vencimiento}</td>
            <td>${recibo.prima_neta}</td>
            <td>${recibo.prima_total}</td>
            <td>
                <input type="checkbox" id="check_pagado${
                  recibo.id
                }" name="check_pagado${recibo.id}" />
            </td>
            <td>${recibo.fecha_pago}</td>
            <td>${recibo.cancelado ? "Cancelado" : ""}</td>
         </tr>`
      );
      if (recibo.pagado) $(`#check_pagado${recibo.id}`).prop("checked", true);
      $(`#check_pagado${recibo.id}`).on("click", function () {
        if ($(`#check_pagado${recibo.id}`).is(":checked") == true) {
          changeReciboPagado(recibo.id, "Pagar", poliza_id);
        } else {
          changeReciboPagado(recibo.id, "Cancelar Pago", poliza_id);
        }
      });
    });
    if (!data.length) return $("#pagination-recibos").html("");
    $(".tableOption-recibos").slice(10).hide();
    $("#pagination-recibos").pagination({
      items: recordsTotal,
      itemsOnPage: itemsOnPage,
      onPageClick: (noofele) =>
        $(".tableOption-recibos")
          .hide()
          .slice(
            itemsOnPage * (noofele - 1),
            itemsOnPage + itemsOnPage * (noofele - 1)
          )
          .show(),
    });
  }

  function fillTablePolizas(resp) {
    const itemsOnPage = 8;
    const { data, recordsTotal } = resp;
    const table = $("#polizas-table");
    table.html("");
    $.each(data, function (idx, poliza) {
      table.append(
        `<tr class="tableOption" style="background-color: ${getColor(
          poliza.status
        )}">
          <td>
            <p class="td-clickable" id="td-clickable_${poliza.id}">
                ${poliza.poliza}
            </p>
          </td>
          <td>${poliza.cliente}</td>
          <td>${poliza.subramo}</td>
          <td>${poliza.aseguradora}</td>
          <td>${poliza.tipoPago}</td>
          <td>
            <ul class="btn_table_options">
              <li>
                <a class="btn__icon_delete pointer" id="btnDelete_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000"><path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q54 0 104-17.5t92-50.5L228-676q-33 42-50.5 92T160-480q0 134 93 227t227 93Zm252-124q33-42 50.5-92T800-480q0-134-93-227t-227-93q-54 0-104 17.5T284-732l448 448Z"/></svg>
                </a>
              </li>
              <li>
                <a class="btn__icon_edit pointer" id="btnEdit_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M200-200h50.461l409.463-409.463-50.461-50.461L200-250.461V-200Zm-59.999 59.999v-135.383l527.616-527.384q9.073-8.241 20.036-12.736 10.963-4.495 22.993-4.495 12.029 0 23.307 4.27 11.277 4.269 19.969 13.576l48.846 49.461q9.308 8.692 13.269 20.004 3.962 11.311 3.962 22.622 0 12.065-4.121 23.028-4.12 10.964-13.11 20.037l-527.384 527H140.001Zm620.384-570.153-50.231-50.231 50.231 50.231Zm-126.134 75.903-24.788-25.673 50.461 50.461-25.673-24.788Z"/></svg>
                </a>
              </li>
              <li>
                <a class="btn__icon_show pointer" id="btnShow_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/></svg>
                </a>
              </li>
            </ul>
          </td>
        </tr>`
      );
      $(`#td-clickable_${poliza.id}`).on("click", (e) => {
        $("#recib").modal();
        getRecibos(poliza.id);
      });
      $(`#btnEdit_${poliza.id}`).on("click", (e) => {
        $("#poliza_id").val(poliza.id);
        $("#endoso-type").modal();
      });
      $(`#btnDelete_${poliza.id}`).on("click", (e) => cancelPoliza(poliza.id));
      $(`#btnShow_${poliza.id}`).on("click", (e) => {
        getEndosos(poliza.id);
        $("#endoso-list").modal();
      });
    });
    if (!data.length) return;
    $(".tableOption").slice(8).hide();
    $("#pagination").pagination({
      items: recordsTotal,
      itemsOnPage: itemsOnPage,
      onPageClick: (noofele) =>
        $(".tableOption")
          .hide()
          .slice(
            itemsOnPage * (noofele - 1),
            itemsOnPage + itemsOnPage * (noofele - 1)
          )
          .show(),
    });
  }

  function getPolizas(order = false, start = 0, length = 0) {
    $.ajax({
      ...ajaxConfig,
      url: "/polizas/get",
      data: $.param(order ? { start, length, order } : { start, length }),
      success: fillTablePolizas,
      error: (xhr, status, error) => console.error(error),
    });
  }

  function fetchClientOptions(query) {
    $.ajax({
      url: "polizas/search_clients",
      method: "POST",
      dataType: "json",
      data: { query },
      success: function (response) {
        const options = response.options;
        const dropdownMenu = $("#client-options");
        dropdownMenu.empty();
        if (options.length === 0) {
          dropdownMenu.append(
            '<p class="dropdown-item no-results">No hay coincidencias</p>'
          );
        } else {
          $.each(options, function (i, option) {
            dropdownMenu.append(
              `<a class="dropdown-item" id="client__${option.id}">
                ${option.name}
              </a>`
            );
            $(`#client__${option.id}`).on("click", (e) => {
              $("#buscar-cliente").val(option.name);
              $("#selected-client-id").val(option.id);
              $("#client-options").hide();
              $("#buscar-cliente")[0].setCustomValidity("");
            });
          });
        }
        dropdownMenu.show();
      },
      error: function (xhr, textStatus, error) {
        console.error(error);
        alert(
          "Lamentamos el inconveniente, por favor vuelve a intentarlo",
          "error"
        );
      },
    });
  }

  function createReceipts(selectPoliza) {
    const netPremium = $("#prima-neta").val();
    const totalPremium = $("#prima-total").val();
    const iva = $("#iva").val();
    const insurance = $("#derecho_poliza").val();
    const commission = $("#comision").val();
    const receipts = $("#nopagos").val();
    $.ajax({
      ...ajaxConfig,
      url: "/polizas/save_receipts",
      data: $.param({
        netPremium,
        totalPremium,
        iva,
        insurance,
        commission,
        receipts,
        selectPoliza,
      }),
      success: function (resp) {
        if (resp.error) {
          // alert(resp.msg, "error", resp.title);
          console.log("Error crear recibos", resp.error, resp.msg);
        } else {
          // alert(resp.msg, "success", resp.title);
          console.log("Recibos creados exitosamente");
        }
      },
      error: function (xhr, status, error) {
        console.error(error);
        alert(
          "Lamentamos el inconveniente, porfavor vuelve a intentarlo",
          "error"
        );
      },
    });
  }

  $("#btnGenerarEndoso").hide();
  $("#div_poliza_id").hide();

  $("#form-polizas").submit(function (e) {
    e.preventDefault();
    if (!this.checkValidity()) {
      $(this).addClass("was-validated");
      return;
    }
    const primaNeta = $("#prima_neta").val();
    const primaTotal = $("#prima_total").val();
    const pago = $("#Pago").val();
    const noRecibos = getNoRecibos(pago);
    const iva = primaTotal * 0.16;
    $("#prima-neta").val(primaNeta);
    $("#prima-total").val(primaTotal);
    $("#nopagos").val(noRecibos);
    $("iva").val(iva);
    $("#create-recib").modal();
  });

  $("#form-recibo").submit(function (e) {
    e.preventDefault();
    if (!this.checkValidity()) {
      $(this).addClass("was-validated");
      return;
    }
    const formDataPoliza = $("#form-polizas").serialize();
    if ($("#tipo").val()) {
      $.ajax({
        type: "POST",
        url: "/polizas/create_endoso",
        data: formDataPoliza,
        success: function (resp) {
          if (resp.error) {
            alert(resp.msg, "error", resp.title);
          } else {
            $("#create-recib").modal("toggle");
            createReceipts(resp.poliza_id);
            alert(resp.msg, "success");
            getPolizas();
            resetForm();
          }
        },
        error: function (xhr, status, error) {
          console.error(error);
          alert(
            "Lamentamos el inconveniente, porfavor vuelve a intentarlo",
            "error"
          );
        },
      });
    } else {
      $.ajax({
        type: "POST",
        url: "/polizas/create",
        data: formDataPoliza,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        dataType: "json",
        success: function (resp) {
          if (resp.error) {
            alert(resp.title, "error");
          } else {
            $("#create-recib").modal("toggle");
            createReceipts(resp.poliza_id);
            alert(resp.title, "success");
            getPolizas();
            resetForm();
          }
        },
        error: function (xhr, status, error) {
          console.error("Error al crear poliza", error);
          alert(
            "Lamentamos el inconveniente, porfavor vuelve a intentarlo",
            "error"
          );
        },
      });
    }
  });

  $("#reset-btn").click((e) => {
    e.preventDefault();
    resetForm();
  });

  $("#btnCalcular").click((e) => {
    e.preventDefault();
    const netPremium = $("#prima-neta").val();
    const totalPremium = $("#prima-total").val();
    const iva = $("#iva").val();
    const insurance = $("#derecho_poliza").val();
    const commission = $("#comision").val();
    const receipts = $("#nopagos").val();
    if (!iva || !insurance || !commission)
      return alert(
        "debe llenar los campos, derecho de póliza, iva y comisión",
        "warning"
      );
    $.ajax({
      ...ajaxConfig,
      url: "/polizas/calculate_receipts",
      data: $.param({
        netPremium,
        totalPremium,
        iva,
        insurance,
        commission,
        receipts,
      }),
      success: function (resp) {
        $("#prima_neta_1er").val(resp.firstpay.netPremium);
        $("#prima_neta_subs").val(resp.subspay.netPremium);
        $("#prima_total_1er").val(resp.firstpay.totalPremium);
        $("#prima_total_subs").val(resp.subspay.totalPremium);
        $("#comision_1er").val(resp.firstpay.comision);
        $("#comision_subs").val(resp.subspay.comision);
      },
      error: (xhr, status, error) => console.error(error),
    });
  });

  $("#sortByPoliza").click((e) => {
    e.preventDefault();
    ordered = !ordered;
    getPolizas(ordered);
  });

  $("#searchPoliza").on("keyup", function (e) {
    e.preventDefault();
    const searchValue = e.target.value;
    if (searchValue == "") return getPolizas();
    if (searchValue.length >= 3)
      $.ajax({
        ...ajaxConfig,
        url: "/polizas/get",
        data: $.param({ start: 0, length: 0, searchValue }),
        success: fillTablePolizas,
        error: (xhr, status, error) => console.error(error),
      });
  });

  $("#buscar-cliente").on("keyup", function (e) {
    e.preventDefault();
    const inputValue = e.target.value;
    if (inputValue.length >= 3) {
      fetchClientOptions(inputValue);
    } else {
      $("#client-options").hide();
      $("#buscar-cliente")[0].setCustomValidity("");
    }
  });

  $("#endoso_tipo_a").click((e) => createEndozo($("#poliza_id").val(), "A"));
  $("#endoso_tipo_b").click((e) => createEndozo($("#poliza_id").val(), "B"));
  $("#endoso_tipo_d").click((e) => createEndozo($("#poliza_id").val(), "D"));

  getPolizas();
});
