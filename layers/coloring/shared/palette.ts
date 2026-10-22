export interface PaletteColor {
  hex: string
  name: string
}

export const PALETTE: readonly PaletteColor[] = [
  { hex: '#9D0B62', name: 'Бордовый' },
  { hex: '#12DEEC', name: 'Бирюзовый' },
  { hex: '#E5EC12', name: 'Жёлтый' },
  { hex: '#9CEC12', name: 'Салатовый' },
  { hex: '#12ECAE', name: 'Мятный' },
  { hex: '#E8112D', name: 'Красный' },
  { hex: '#FF5A5F', name: 'Коралловый' },
  { hex: '#FF7A00', name: 'Оранжевый' },
  { hex: '#FFA94D', name: 'Светло-оранжевый' },
  { hex: '#FFD21F', name: 'Золотой' },
  { hex: '#FFF27A', name: 'Светло-жёлтый' },
  { hex: '#CFF5A0', name: 'Светло-зелёный' },
  { hex: '#4CC417', name: 'Зелёный' },
  { hex: '#1E8C3A', name: 'Тёмно-зелёный' },
  { hex: '#0F9D8A', name: 'Морская волна' },
  { hex: '#8FD8FF', name: 'Светло-голубой' },
  { hex: '#12ABEC', name: 'Голубой' },
  { hex: '#1C41E8', name: 'Синий' },
  { hex: '#0B1F7A', name: 'Тёмно-синий' },
  { hex: '#4B1A8C', name: 'Тёмно-фиолетовый' },
  { hex: '#7B3FE4', name: 'Фиолетовый' },
  { hex: '#B57BFF', name: 'Сиреневый' },
  { hex: '#FF8FC8', name: 'Светло-розовый' },
  { hex: '#EC12AB', name: 'Розовый' },
  { hex: '#F5C9A0', name: 'Персиковый' },
  { hex: '#C68642', name: 'Светло-коричневый' },
  { hex: '#8B4A1C', name: 'Коричневый' },
  { hex: '#5A2A0C', name: 'Тёмно-коричневый' },
  { hex: '#FFFFFF', name: 'Белый' },
  { hex: '#A6A6A6', name: 'Серый' },
  { hex: '#5C5C5C', name: 'Тёмно-серый' },
  { hex: '#000000', name: 'Чёрный' }
]

export function paletteColorName(hex: string): string {
  return PALETTE.find(color => color.hex === hex)?.name ?? hex
}
