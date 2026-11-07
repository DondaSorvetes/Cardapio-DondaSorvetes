/** Display hints only: never change CSS dimensions, aspect ratio or cropping. */
export const imagePresets = {
  thumbnail: { sizes: "64px", quality: 80 },
  productCard: { sizes: "(max-width: 639px) 160px, 187px", quality: 90 },
  productDetail: { sizes: "(max-width: 448px) 100vw, 448px", quality: 90 },
  offer: { sizes: "(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) calc((100vw - 58px) / 2), 342px", quality: 90 },
  storeBanner: { sizes: "(max-width: 767px) calc(100vw - 32px), (max-width: 1151px) calc(100vw - 48px), 1104px", quality: 75 },
  storeLogo: { sizes: "76px", quality: 75 },
} as const;

export type ImagePreset = keyof typeof imagePresets;
