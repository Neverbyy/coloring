declare module '#app' {
  interface PageMeta {
    // Страница только для гостей (вход): вошедшего игрока отправляем дальше
    guestOnly?: boolean
    // Фоновая музыка экрана (адрес трека); нет — тишина
    music?: string
  }
}

export {}
