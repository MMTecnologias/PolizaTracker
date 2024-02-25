$(document).ready(function () {
   $('#loginform').submit(function (e) {
      //---------------^---------------
      e.preventDefault();

      // Serialize form data
      var formData = $('#loginform').serialize();

      // Send AJAX POST request
      $.ajax({
         type: 'POST',
         url: 'login_ajax', // Flask route for login
         data: formData,
         success: function (response) {
            // Check response for success or error
            if (response.success) {
               // Redirect user to the desired page
               window.location.href = response.redirect;
            } else {
               // Display error message
               $('#mensajeError').css('opacity', '1');
               //espera 3 segundos y oculta
               setTimeout(function () {
                  $('#mensajeError').css('opacity', '0');
               }, 3000);
            }
         },
         error: function (xhr, status, error) {
            Swal.fire({
               title: 'Error inesperado',
               text: 'Lamentamos el inconveniente, porfavor vuelve a intentarlo',
               icon: 'error'
            });
         }
      });

      // Return false to prevent form submission
      return false;
   });
});

$(document).ready(function () {
   $('#forgotpassform').submit(function (e) {
      //---------------^---------------
      e.preventDefault();

      // Serialize form data
      var formData = $('#forgotpassform').serialize();

      $.ajax({
         type: 'POST',
         url: 'forgotpass_ajax', // Flask route for login
         data: formData,
         success: function (response) {
            // Check response for success or error
            if (response.correctuser) {
               if (response.new) {
                  Swal.fire({
                     title: '¡Solicitud Enviada!',
                     text: 'Revisa tu correo, el administrador te hará llegar una nueva contraseña',
                     icon: 'success'
                  }).then(function () {
                     window.location.href = response.redirect;
                  });
               } else {
                  Swal.fire({
                     title: 'Ya tiene una solicitud Pendiente',
                     text: 'Revisa tu correo, el administrador te hará llegar una nueva contraseña',
                     icon: 'success'
                  }).then(function () {
                     window.location.href = response.redirect;
                  });
               }
            } else {
               // Display error message
               $('#mensajeError').css('display', 'block');
            }
         },
         error: function (xhr, status, error) {
            Swal.fire({
               title: 'Error inesperado',
               text: 'Lamentamos el inconveniente, porfavor vuelve a intentarlo',
               icon: 'error'
            });
         }
      });

      // Return false to prevent form submission
      return false;
   });
});
