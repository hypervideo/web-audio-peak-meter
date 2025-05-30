import { PeakMeterConfig, defaultConfig } from './config';
import { dbFromFloat } from './utils';
import peakSampleProcessor from './peak-sample-processor.txt';
import truePeakProcessor from './true-peak-processor.txt';

export class WebAudioPeakMeter {
  channelCount: number;
  node?: AudioWorkletNode;
  config: PeakMeterConfig;
  tempPeaks: Array<number>;
  heldPeaks: Array<number>;
  peakHoldTimeouts: Array<number>;
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

    private peakCallback?: (peakVolume: number) => void,
    options: Partial<PeakMeterConfig> = {}
  ) {
    this.config = Object.assign({ ...defaultConfig }, options);
    this.channelCount = srcNode.channelCount;
    this.tempPeaks = new Array(this.channelCount).fill(0.0);
    this.heldPeaks = new Array(this.channelCount).fill(0.0);
    this.peakHoldTimeouts = new Array(this.channelCount).fill(0);
    this.initNode();
  }

  private async initNode() {
    if (this.srcNode.context.state === 'closed') {
      console.warn('WebAudioPeakMeter: The AudioContext is closed, cannot initialize the node.');
      return;
    }

    const { audioMeterStandard } = this.config;
    try {
      this.node = new AudioWorkletNode(this.srcNode.context, `${audioMeterStandard}-processor`, {
        parameterData: {},
      });
    } catch (err) {
      const workletString =
        audioMeterStandard === 'true-peak' ? truePeakProcessor : peakSampleProcessor;
      const blob = new Blob([workletString], { type: 'application/javascript' });
      const objectURL = URL.createObjectURL(blob);
      await this.srcNode.context.audioWorklet.addModule(objectURL);
      this.node = new AudioWorkletNode(this.srcNode.context, `${audioMeterStandard}-processor`, {
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

  private handleNodePortMessage(ev: MessageEvent) {
    if (ev.data.type === 'message') {
      console.log(ev.data.message);
    }
    if (ev.data.type === 'peaks') {
      const { peaks } = ev.data;
      for (let i = 0; i < this.tempPeaks.length; i += 1) {
        if (peaks.length > i) {
          this.tempPeaks[i] = peaks[i];
        } else {
          this.tempPeaks[i] = 0.0;
        }
      }
      if (peaks.length < this.channelCount) {
        this.tempPeaks.fill(0.0, peaks.length);
      }
      for (let i = 0; i < peaks.length; i += 1) {
        if (peaks[i] > this.heldPeaks[i]) {
          this.heldPeaks[i] = peaks[i];
          if (this.peakHoldTimeouts[i]) {
            clearTimeout(this.peakHoldTimeouts[i]);
          }
          if (this.config.peakHoldDuration) {
            this.peakHoldTimeouts[i] = window.setTimeout(() => {
              this.clearPeak(i);
            }, this.config.peakHoldDuration);
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
      currentDB: this.tempPeaks.map(dbFromFloat),
      maxesDB: this.heldPeaks.map(dbFromFloat),
    };
  }

  public getNormalizedCurrentPeakVolume() {
    let volume = dbFromFloat(Math.max(...this.heldPeaks));
    if (this.config.peakCallbackNormalizeVolume) {
      const { dbRangeMin, dbRangeMax, normalizedRangeMin, normalizedRangeMax } =
        this.config.peakCallbackNormalizeVolume;
      const normalizedRange = normalizedRangeMax - normalizedRangeMin;
      const dbRange = dbRangeMax - dbRangeMin;
      volume = Math.max(dbRangeMin, Math.min(dbRangeMax, volume));
      volume = normalizedRangeMin + ((volume - dbRangeMin) * normalizedRange) / dbRange; // Linear mapping to normalized range
    }
    return volume;
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
    this.clearPeaks();
    if (this.node) {
      this.node.disconnect();
    }
  }
}
