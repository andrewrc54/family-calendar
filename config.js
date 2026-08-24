// Client ID público de OAuth de Google (no es secreto, es seguro exponerlo en el frontend).
// Consíguelo en https://console.cloud.google.com/apis/credentials
// -> Crear credenciales -> ID de cliente de OAuth -> Aplicación web
// -> Orígenes de JavaScript autorizados: la URL exacta donde quede publicada esta app.
const GOOGLE_CLIENT_ID = "567946621551-mmmjk0a0ugfokg6vo0pjf4r6ldb1hp57.apps.googleusercontent.com";

const GOOGLE_CALENDAR_SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly";
