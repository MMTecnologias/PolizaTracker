// @ts-nocheck
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
    Swal.fire({ title, text, icon });
  }

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
      case status.toLowerCase().includes("vencer"):
        return "rgb(255 255 0 / 80%)";
      default:
        return "";
    }
  }

  function fillTableVencimientos(resp) {
    console.log(resp);
    const itemsOnPage = 5;
    const { data, recordsTotal } = resp;
    const table = $("#table-vencimientos");
    table.html("");
    $.each(data, function (idx, poliza) {
      table.append(
        `<tr class="tableOption">
          <td>
            <p class="td-clickable" id="td-clickable_${poliza.id}">
                ${poliza.poliza}
            </p>
          </td>
          <td>${poliza.endoso}</td>
          <td>${poliza.cliente}</td>
          <td>${poliza.agente}</td>
          <td>${poliza.ramo}</td>
          <td>${poliza.subramo}</td>
          <td>${poliza.forma_pago}</td>
        </tr>`
      );
    });
    $(".tableOption").slice(5).hide();
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

  function getVencimientos(formDataFechas = null, start = 0, length = 10) {
    console.log(formDataFechas);
    $.ajax({
      ...ajaxConfig,
      url: "/vencimientos/get_upcoming_policies",

      data: formDataFechas ? formDataFechas : $.param({ start, length }),
      success: fillTableVencimientos,
      error: (xhr, status, error) => console.error(error),
    });
  }

  $("#form-fechas").submit(function (e) {
    e.preventDefault();
    if (!this.checkValidity())
      return alert("Debes llenar los dos campos de fecha", "warning");
    const formDataFechas = $("#form-fechas").serialize();
    getVencimientos(formDataFechas);
  });

//   $("#searchPoliza").on("keyup", function (e) {
//     e.preventDefault();
//     const searchValue = e.target.value;
//     if (searchValue == "") return getVencimientos();
//     if (searchValue.length >= 3)
//       $.ajax({
//         ...ajaxConfig,
//         url: "/polizas/get",
//         data: $.param({ start: 0, length: 0, searchValue }),
//         success: fillTableVencimientos,
//         error: (xhr, status, error) => console.error(error),
//       });
//   });

  getVencimientos();
});
