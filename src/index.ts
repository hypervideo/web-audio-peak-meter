import { PeakMeterConfig, defaultConfig } from './config';
import { dbFromFloat } from './utils';
import truePeakProcessor from './true-peak-processor.txt';
import { TruePeakProcessorMessage } from './true-peak-processor';

export type Peak = {
  volume: number;
  amplitude: number;
}

export class WebAudioPeakMeter {
  channelCount: number;
  node?: AudioWorkletNode;
  config: PeakMeterConfig;
  tempPeaks: Array<Peak>;
  heldPeaks: Array<Peak>;
  peakHoldIntervals: Array<number | undefined>;
  animationRequestId?: number;
  intervalId?: number;

  constructor(
    private srcNode: AudioNode,
    /**
     * Callback that will be called with maximum current peak volume. options.peakCallbackDelay
     * determines how often this callback will be called. options.peakCallbackNormalizeVolume
     * determines if and how the decibel values will be normalized (linear mapping to a range of
     * peakCallbackNormalizeVolume.normalizedRangeMin to
     * peakCallbackNormalizeVolume.normalizedRangeMax).
     */

    private peakCallback?: (peak: Peak) => void,
    options: Partial<PeakMeterConfig> = {},
  ) {
    this.config = Object.assign({ ...defaultConfig }, options);
    this.channelCount = srcNode.channelCount;
    this.tempPeaks = new Array<Peak>(this.channelCount).fill({ volume: -Infinity, amplitude: 0.0 } satisfies Peak);
    this.heldPeaks = new Array<Peak>(this.channelCount).fill({ volume: -Infinity, amplitude: 0.0 } satisfies Peak);
    this.peakHoldIntervals = new Array<number | undefined>(this.channelCount).fill(undefined);
    this.initNode().catch((err) => {
      console.error('WebAudioPeakMeter: Failed to initialize the AudioWorkletNode.', err);
    });
  }

  private async initNode() {
    if (this.srcNode.context.state === 'closed') {
      console.warn('WebAudioPeakMeter: The AudioContext is closed, cannot initialize the node.');
      return;
    }

    try {
      this.node = new AudioWorkletNode(this.srcNode.context, `true-peak-processor`, {
        parameterData: {},
      });
    } catch (err) {
      const blob = new Blob([truePeakProcessor], { type: 'application/javascript' });
      const objectURL = URL.createObjectURL(blob);
      await this.srcNode.context.audioWorklet.addModule(objectURL);
      this.node = new AudioWorkletNode(this.srcNode.context, `true-peak-processor`, {
        parameterData: {},
      });
    }
    this.node.port.onmessage = (ev: MessageEvent) => this.handleNodePortMessage(ev);
    this.srcNode.connect(this.node).connect(this.srcNode.context.destination);

    if (this.config.peakCallbackDelay === 'requestAnimationFrame' && this.peakCallback) {
      const invokeCallback = () => {
        this.peakCallback?.call(null, this.getNormalizedCurrentPeakVolume());
        this.animationRequestId = requestAnimationFrame(invokeCallback);
      };
      this.animationRequestId = requestAnimationFrame(invokeCallback);
    }

    if (typeof this.config.peakCallbackDelay === 'number' && this.peakCallback) {
      this.intervalId = window.setInterval(() => {
        this.peakCallback?.call(null, this.getNormalizedCurrentPeakVolume());
      }, this.config.peakCallbackDelay);
    }
  }

  private handleNodePortMessage(ev: MessageEvent<TruePeakProcessorMessage>) {
    if (ev.data.type === 'message') {
      console.log(ev.data.message);
    }
    if (ev.data.type === 'peaks') {
      const { volumes, amplitudes } = ev.data;
      for (let i = 0; i < this.tempPeaks.length; i += 1) {
        if (volumes.length > i) {
          this.tempPeaks[i] = { volume: volumes[i], amplitude: amplitudes[i] };
        } else {
          this.tempPeaks[i] = { volume: -Infinity, amplitude: 0.0 };
        }
      }
      if (volumes.length < this.channelCount) {
        this.tempPeaks.fill({
          volume: -Infinity,
          amplitude: 0.0
        }, volumes.length);
      }
      for (let i = 0; i < volumes.length; i += 1) {
        if (volumes[i] > this.heldPeaks[i].volume || amplitudes[i] > this.heldPeaks[i].amplitude) {
          this.heldPeaks[i] = { volume: Math.max(this.heldPeaks[i].volume, volumes[i]), amplitude: Math.max(this.heldPeaks[i].amplitude, amplitudes[i]) };

          // Re-start the interval so that the new peak is held for 1 full duration.
          if (this.peakHoldIntervals[i]) {
            clearInterval(this.peakHoldIntervals[i]);
          }
          if (this.config.peakHoldDuration) {
            this.peakHoldIntervals[i] = window.setInterval(
              () => this.clearPeak(i),
              this.config.peakHoldDuration,
            );
          }
        }
      }
      if (this.config.peakCallbackDelay === 'immediate' && this.peakCallback) {
        this.peakCallback(this.getNormalizedCurrentPeakVolume());
      }
    }
  }

  private clearPeak(i: number) {
    this.heldPeaks[i] = this.tempPeaks[i];
  }

  public clearPeaks() {
    for (let i = 0; i < this.heldPeaks.length; i += 1) {
      this.clearPeak(i);
    }
  }

  public getPeaks() {
    return {
      current: this.tempPeaks,
      maxes: this.heldPeaks,
      currentDB: this.tempPeaks.map(({ volume }) => dbFromFloat(volume)),
      maxesDB: this.heldPeaks.map(({ volume }) => dbFromFloat(volume)),
    };
  }

  public getNormalizedCurrentPeakVolume(): Peak {
    // eslint-disable-next-line prefer-const
    let { volume, amplitude } = this.heldPeaks.reduce((acc, peak) => {
      return {
        volume: Math.max(acc.volume, dbFromFloat(peak.volume)),
        amplitude: Math.max(acc.amplitude, peak.amplitude),
      };
    }, { volume: -Infinity, amplitude: 0.0 });
    if (this.config.peakCallbackNormalizeVolume) {
      const { dbRangeMin, dbRangeMax, normalizedRangeMin, normalizedRangeMax } =
        this.config.peakCallbackNormalizeVolume;
      const normalizedRange = normalizedRangeMax - normalizedRangeMin;
      const dbRange = dbRangeMax - dbRangeMin;
      volume = Math.max(dbRangeMin, Math.min(dbRangeMax, volume));
      volume = normalizedRangeMin + ((volume - dbRangeMin) * normalizedRange) / dbRange; // Linear mapping to normalized range
    }
    return { volume, amplitude };
  }

  cleanup() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    if (this.animationRequestId) {
      cancelAnimationFrame(this.animationRequestId);
      this.animationRequestId = undefined;
    }
    for (let i = 0; i < this.peakHoldIntervals.length; ++i) {
      if (this.peakHoldIntervals[i]) {
        clearInterval(this.peakHoldIntervals[i]);
        this.peakHoldIntervals[i] = undefined;
      }
    }
    this.clearPeaks();
    if (this.node) {
      try {
        this.srcNode.disconnect(this.node);
      } catch {
        // Errors when the node is already disconnected, which we can safely ignore.
      }
      this.node.disconnect();
    }
  }
}
