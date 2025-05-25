export interface PeakMeterConfig {
  audioMeterStandard: string;
  peakHoldDuration: number;
  /**
   * When providing a callback, determine how often it should be called.
   * - 'immediate': every audio worklet message will trigger an update.
   * - 'requestAnimationFrame': the callback will be called on the next animation frame.
   * - number: the callback will be called every `number` milliseconds.
   */
  peakCallbackDelay?: 'immediate' | 'requestAnimationFrame' | number;
  /**
   * Determines if and in what range the peaks should be normalized.
   */
  peakCallbackNormalizeVolume?: {
    dbRangeMin: number;
    dbRangeMax: number;
    normalizedRangeMin: number;
    normalizedRangeMax: number;
  };
}

export const defaultConfig: PeakMeterConfig = {
  audioMeterStandard: 'peak-sample',
  peakHoldDuration: 0,
  peakCallbackDelay: 'immediate',
};
