// Отдать картинку игроку. На телефоне — системное окно «Поделиться» (в нём же «Сохранить
// изображение»): сохранить прямо в галерею без подтверждения браузер не позволяет.
// На компьютере и где «Поделиться» с файлами нет — скачивание файла
export async function shareImage(image: Blob, title: string): Promise<void> {
  const file = new File([image], `${title}.png`, { type: 'image/png' })
  const touch = window.matchMedia('(pointer: coarse)').matches

  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return
    } catch (error) {
      // Игрок закрыл окно — это не ошибка. Остальные сбои — пробуем скачать
      if ((error as DOMException | null)?.name === 'AbortError') return
    }
  }

  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  // Отзываем не сразу: браузер может начать загрузку не мгновенно
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
