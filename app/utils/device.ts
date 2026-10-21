// Основное устройство ввода — палец (телефон, планшет), а не мышь
export function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches
}
